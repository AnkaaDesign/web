/* Raiz de composição: ciclo de montagem, sequência de boot e handle de debug.
   ---------------------------------------------------------------------------
   INTEGRAÇÃO COM O ANKAA. O engine é um SINGLETON que SOBREVIVE à página React.
   mountStudio() prende a subárvore de DOM do estúdio (montada em core/dom.ts) ao
   elemento hospedeiro e liga o laço de render; unmountStudio() para o laço e
   solta a subárvore, mantendo vivos o contexto WebGL, os modelos já carregados e
   os canvas de plotagem — voltar para a rota é instantâneo em vez de ser outro
   download de centenas de megabytes.

   boot() roda, portanto, no máximo UMA vez por carregamento de página.

   Desde o "Configurador" o estúdio não abre mais direto num caminhão padrão:
   boot() carrega o catálogo, um seletor de CINCO passos (cenário → fabricante →
   modelo → chassi → cor) decide o que construir, e uma cortina de carregamento cobre o
   download antes de voar a foto do caminhão escolhido para o crachá do canto
   inferior esquerdo. Tudo a jusante dessa decisão passa por UMA função,
   applyChoice(), para que o seletor e os crachás não possam divergir — e para
   que uma escolha que chega duas vezes carregue uma vez só.

   A COR é o único campo da escolha que não custa download, e applyChoice tem um
   atalho para isso: trocar só a cor não remonta a cabine. */
import * as THREE from 'three';
import * as sceneMod from './scene/scene';
import { scene, camera, controls, renderer, frameAll, startLoop, stopLoop, resize,
         setVehicleFocus, invalidate, invalidateShadows, warmLightPrograms,
         releaseProceduralEnvCache } from './scene/scene';
import * as models from './vehicle/models';
import * as paint from './vehicle/paint';
import * as livery from './vehicle/livery';
import * as liveryStructure from './vehicle/livery-structure';
import * as catalogMod from './catalog/catalog';
import * as selector from './ui/selector';
import * as environment from './scene/environment';
import * as loader from './ui/loader';
import {
  loadCatalog, loadChoice, saveChoice, defaultChoice,
  getEnvironment, getModel, assetUrl, defaultChassis, fileOf, paintMaterialsOf,
  finishOf,
} from './catalog/catalog';
import {
  initSelector, openSelector, setBadge, showBadge, setMapBadge, showMapBadge,
  setBadgeColor, setBadgeSpecialEdition, chassisSubtitle, truckLabel,
} from './ui/selector';
import { loadRenders, renderUrl } from './catalog/renders';
import { loadColors, getColor, defaultColor, FINISH_LABEL } from './catalog/colors';
import type { PaintColorDef } from './catalog/colors';
import type { FinishDef } from './catalog/catalog';
import { applyEnvironment, getCurrentEnvironment, disposeEnvironments } from './scene/environment';
import { disposeReflectionProbe } from './scene/probe';
import { stopRecording } from './scene/record';
import * as trim from './vehicle/trim';
import { loadLiveryArt } from './vehicle/livery-art';
import {
  initLoader, showLoader, setLoaderProgress, finishLoader, hideLoader,
  claimPill, paintFrame, withPill,
} from './ui/loader';
import { initHud, syncHud } from './ui/hud';
import { initWeather } from './scene/weather';
import { initUI, setStatus, setCaptureSubject, exitFullscreen } from './ui/chrome';
/* Ligado daqui e não de dentro de initUI(): ui/paint-panel importa setStatus de
   ui/chrome, então chrome chamar o painel fecharia um ciclo de import. O motor
   já carrega um ciclo de propósito (livery ↔ livery-editor, ver engine/index.ts)
   e um é o suficiente. */
import { initPaintPanel, setPaintPanelColor, closePaintPanel } from './ui/paint-panel';
import { initTrimPanel, refreshTrimPanel } from './ui/trim-panel';
import { root, $ } from './core/dom';
import { prefetchStats, isWarm } from './core/prefetch';
import type {
  Choice, ChassisDef, EnvironmentDef, ManufacturerDef, ModelDef,
} from './catalog/catalog';

/** Uma escolha resolvida contra o catálogo: as entradas concretas que ela nomeia. */
interface ResolvedPick {
  choice: Choice;
  env: EnvironmentDef;
  model: ModelDef;
  chassis: ChassisDef;
  manufacturer: ManufacturerDef;
  color: PaintColorDef;
  /** O acabamento de fábrica escolhido, quando há um. `null` = tinta normal. */
  finish: FinishDef | null;
}

/** Quais downloads esta aplicação vai rodar, e o peso relativo de cada um. */
type TaskWeights = Partial<Record<'env' | 'cab' | 'trailer', number>>;

/* O handle de ajuste que boot() instala no console. Declarado para que
   `window.__studio` seja uma propriedade CONHECIDA em vez de um buraco `any`
   aberto no tipo global. */
declare global {
  interface Window {
    __studio?: Record<string, unknown>;
  }
}

/* Mensagem legível de um valor lançado — `catch (e)` é `unknown` sob strict. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const fmt = (b: THREE.Box3 | null) =>
  (b ? `${(b.max.x - b.min.x).toFixed(1)}×${(b.max.z - b.min.z).toFixed(1)}m` : '—');

let booted: Promise<void> | null = null;   // boot() roda uma vez por página
let observer: ResizeObserver | null = null;

/* A escolha que a cena está mostrando AGORA, mais a que está sendo carregada
   neste instante. As duas são necessárias: o seletor resolve openSelector() E
   dispara onChange() para a MESMA escolha, então ela chega aqui duas vezes
   dentro do mesmo tick, e `pendingChoice` é o que impede o segundo carregamento. */
let currentChoice: Choice | null = null;
let pendingChoice: Choice | null = null;
/* Serializa as aplicações. Nunca rejeita — runApply() engole os próprios erros. */
let applyQueue: Promise<Choice | null> = Promise.resolve(null);
/* Quantas aplicações estão enfileiradas e ainda não terminaram. Enquanto for
   maior que zero, qualquer coisa que entre na fila agora VAI ESPERAR — e é
   exatamente isso que a pílula de estado precisa saber para avisar. */
let queueDepth = 0;

/* "É o mesmo VEÍCULO na mesma cena?" — a pergunta que decide se algo precisa ser
   BAIXADO. A cor de propósito não entra: ela não custa um byte de rede.
   O CHASSI ENTRA, e tem de entrar: `ChassisDef.cab` pode apontar para outra
   geometria, e sem ele uma troca de chassi cairia no atalho de "só a cor mudou"
   — o card acenderia e absolutamente nada carregaria. */
const sameRig = (a: Choice | null, b: Choice | null) =>
  !!a && !!b && a.envId === b.envId && a.modelId === b.modelId
  && a.chassisId === b.chassisId;

/* ---------------- os ACABAMENTOS na escolha gravada ----------------
   `Choice.trim` é o único campo da escolha que NÃO vem do seletor: quem o
   escreve é o card de acabamentos, a qualquer momento, sem passar por
   applyChoice(). Por isso ele não entra em `sameRig` nem em `sameChoice` — ele
   não decide o que carregar (trocar a cor do teto não custa um byte de rede,
   exatamente como a cor do cavalo) e não pode fazer um clique repetido deixar de
   ser repetido.

   O que ele exige é que TODA gravação o carregue, sempre lido de
   `trim.trimChoice()` na hora — nunca de uma cópia guardada aqui, que é como as
   duas superfícies passariam a discordar. */
const withTrim = (choice: Choice): Choice => {
  const t = trim.trimChoice();
  return t ? { ...choice, trim: t } : choice;
};

/* Uma mudança de acabamento grava a escolha ATUAL de novo. Sem isto a cor do
   teto viveria só até o próximo F5 — e ela é uma decisão de produto, não um
   estado de sessão. Ver `onTrimChanged` em vehicle/trim.ts para por que a
   notificação vem por assinatura. */
trim.onTrimChanged(() => {
  if (currentChoice) saveChoice(withTrim(currentChoice));
});

/* "É a mesma escolha, ponto?" — a pergunta do dedupe. A cor ENTRA aqui: sem
   ela, escolher outra cor para o mesmo caminhão seria descartado como repetido
   e o clique não faria nada. */
const sameChoice = (a: Choice | null, b: Choice | null) =>
  sameRig(a, b) && a!.colorId === b!.colorId;

/* Rótulo pt-BR do download que reportou por último, mostrado sob a barra. */
const TASK_LABELS: Record<string, string> = {
  env: 'Carregando cenário…',
  cab: 'Carregando cabine…',
  trailer: 'Carregando implemento…',
};

/* A PÍLULA DE ESTADO MUDOU DE CASA. Ela era privada deste arquivo e virou
   `claimPill()` em ui/loader.ts, ao lado da cortina — os dois são o mesmo
   vocabulário de "espere um pouco", e ui/hud.ts também precisa dela (um clique
   de preset de clima trava 0,8 s). Ver o cabeçalho daquele bloco. Os dois donos
   originais continuam aqui: a fila (enqueue) e o afordance de console. */

/**
 * Põe um trabalho na fila de aplicações e devolve a fila.
 *
 * Também é o único lugar que sabe se a fila está OCUPADA, e é por isso que o
 * aviso mora aqui: se já há algo rodando, este trabalho vai esperar — em geral
 * alguns segundos — e o usuário tem de ver isso enquanto espera. A pílula é
 * solta no instante em que o trabalho COMEÇA, que é quando quem tem cortina
 * assume a tela.
 */
function enqueue(
  waitLabel: string,
  job: () => Choice | null | Promise<Choice | null>,
): Promise<Choice | null> {
  const pill = queueDepth > 0 ? claimPill(waitLabel) : null;
  queueDepth++;
  /* O MESMO handler nos dois ramos do then: uma fila rejeitada não pode
     envenenar toda aplicação posterior (runApply em si nunca lança, mas a fila
     é compartilhada). */
  const run = async (): Promise<Choice | null> => {
    pill?.release();
    try {
      return await job();
    } finally {
      queueDepth--;
    }
  };
  applyQueue = applyQueue.then(run, run);
  return applyQueue;
}

/* Progresso ponderado. QUAIS tarefas rodam muda a cada aplicação (uma troca
   posterior não tem implemento, e pula o HDRI quando o cenário não mudou), então
   os pesos chegam como um mapa e esta conta nunca precisa ser reescrita quando
   uma tarefa é acrescentada ou some. O destino também é injetado: a cortina de
   carregamento numa aplicação vinda do seletor, a pílula no caminho de console. */
function makeProgress(weights: TaskWeights, sink: (p: number, key: string) => void) {
  const keys = Object.keys(weights) as (keyof TaskWeights)[];
  const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0) || 1;
  const done = {} as Record<keyof TaskWeights, number>;
  for (const k of keys) done[k] = 0;
  /* String vazia e não `keys[0]` quando não há tarefa: ela não casa com nenhum
     TASK_LABELS, e um rótulo indefinido faz setLoaderProgress() manter o que já
     estava — mentir "Carregando cenário…" sem cenário nenhum para carregar seria
     pior do que não dizer nada. */
  let last: string = keys[0] || '';
  const draw = () => {
    /* Sem tarefa nenhuma o progresso é 1, não 0: uma barra que nasce cheia é
       honesta quando não há o que baixar; uma que nasce vazia e nunca anda é a
       definição do que este módulo passou a evitar. */
    if (!keys.length) { sink(1, last); return; }
    let sum = 0;
    for (const k of keys) sum += done[k] * (weights[k] ?? 0);
    sink(sum / total, last);
  };
  return {
    /** callback onProgress de uma tarefa: makeProgress(w, sink).track('cab') */
    track: (k: keyof TaskWeights) => (v: number) => {
      done[k] = Math.max(0, Math.min(1, Number(v) || 0));
      last = k;
      draw();
    },
    complete: () => { for (const k of keys) done[k] = 1; draw(); },
  };
}

/**
 * Transforma uma escolha possivelmente parcial ou velha nas entradas concretas
 * do catálogo que ela nomeia. O catálogo é a única autoridade sobre o que
 * existe, então tudo que ele não conhece é SUBSTITUÍDO em vez de aceito: um id
 * salvo antes de um asset ser renomeado tem de degradar para o padrão, nunca
 * para um boot quebrado.
 */
function resolveChoice(choice: Choice | null): ResolvedPick | null {
  const fallback = defaultChoice();
  const found = (choice && getModel(choice.modelId)) || getModel(fallback.modelId);
  if (!found) return null;                 // catálogo sem modelo nenhum — nada a construir
  const env = (choice && getEnvironment(choice.envId))
    || getEnvironment(currentChoice?.envId)
    || getEnvironment(fallback.envId)
    || catalogMod.catalog.environments[0];
  if (!env) return null;
  /* Mesma escada do cenário: o que veio, senão o que já está na tela, senão o
     padrão da paleta. Uma cor que saiu do catálogo vira a padrão em vez de
     virar um boot sem tinta. */
  const color = getColor(choice?.colorId) || getColor(currentChoice?.colorId) || defaultColor();
  /* O chassi PERTENCE ao modelo, então ele é resolvido DENTRO dele — um
     `chassisId` que veio de outro modelo (escolha velha, manifesto reescrito)
     não pode atravessar. `chassis` é garantidamente não-vazio, então o default
     sempre existe. */
  const chassis = found.model.chassis.find((c) => c.id === choice?.chassisId)
    || defaultChassis(found.model);
  if (!chassis) return null;
  /* O ACABAMENTO É RESOLVIDO DENTRO DO MODELO, pela mesma razão do chassi: o id
     vive no localStorage e sobrevive a uma troca de caminhão. Sem este filtro,
     um `finishId` herdado apagaria a tinta de um modelo que não tem película
     nenhuma para pôr no lugar — `paintMaterialsOf()` leria "[]" e a cabine
     ficaria na cor do rip, calada. */
  const finish = finishOf(found.model, choice?.finishId);
  return {
    choice: {
      envId: env.id,
      manufacturerId: found.manufacturer.id,
      modelId: found.model.id,
      chassisId: chassis.id,
      colorId: color.id,
      finishId: finish ? finish.id : null,
    },
    env,
    model: found.model,
    chassis,
    manufacturer: found.manufacturer,
    color,
    finish,
  };
}

/* A tinta do cavalo, a partir da cor escolhida. UMA chamada e não duas: dentro
   de setPaint() a troca de acabamento reescreve os parâmetros específicos da
   família (flocos, flop, mica) para os defaults dela, e a cor base tem de ser
   aplicada DEPOIS disso, senão a segunda chamada apagaria a primeira.
   Roda em toda aplicação, inclusive quando a cor não mudou: uma troca de cabine
   cria materiais NOVOS, e eles precisam ser dirigidos outra vez. */
/* Verdadeiro enquanto o cavalo em cena for uma edição especial. Módulo-privado e
   escrito num lugar só (setSpecialEdition), porque applyColor() roda por vários
   caminhos e não pode reabrir o crachá de cor que este estado fechou. */
let specialEdition = false;
/* O nome da película em cena, para o crachá. Módulo-privado e escrito no mesmo
   lugar que `specialEdition`, pela mesma razão dele: `applyColor()` roda por
   vários caminhos e não pode adivinhar o que o seletor escolheu. */
let currentFinishName: string | null = null;
/* A última tinta aplicada. Existe porque o CRACHÁ depende de duas coisas que
   chegam em ORDENS diferentes: `applyColor()` roda antes de `setSpecialEdition()`
   no caminho de carga, então quem escrevesse o crachá dentro de applyColor()
   leria o acabamento ANTERIOR — o Metallica entrava em cena e o crachá ainda
   dizia a cor do caminhão de antes. Com as duas metades guardadas, cada uma
   pede a repintura quando muda, e a ordem deixa de importar. */
let lastColor: PaintColorDef | null = null;

/**
 * Repinta o rótulo de cor do crachá a partir do estado corrente.
 *
 * COM ACABAMENTO, O CRACHÁ NOMEIA A PELÍCULA. Antes ele ficava mudo, o que
 * fazia sentido enquanto uma edição especial fosse um MODELO — o nome dele já
 * dizia "Metallica". Agora que a película é uma escolha DENTRO do S-Way 480,
 * calar o crachá esconde justamente o que o usuário acabou de escolher.
 * A amostra continua fora: uma película não tem um hex, e `paintBadgeSwatch()`
 * já a suprime por `badgeSpecial`.
 */
function syncBadgeColor() {
  const c = lastColor;
  if (!c) return;
  setBadgeColor(
    specialEdition ? currentFinishName : c.name,
    specialEdition ? null : c.hex,
    specialEdition
      ? (currentFinishName ? 'Acabamento de fábrica' : null)
      : FINISH_LABEL[c.finish],
  );
}

/** Liga/desliga as afordâncias de tinta do cavalo. Idempotente. */
function setSpecialEdition(on: boolean, finishName?: string | null) {
  specialEdition = on;
  currentFinishName = on ? (finishName ?? null) : null;
  /* Ver `lastColor`: esta é a metade que costuma chegar por último. */
  syncBadgeColor();
  /* O card do caminhão abre o fluxo do caminhão INTEIRO, película ou não — e o
     seletor tira o passo da cor da sequência sozinho quando o modelo é uma
     edição especial (`seqFor`), então não há promessa a quebrar. O que o crachá
     precisa saber é só que não há tinta a anunciar: sem amostra, sem cor no nome
     acessível. */
  setBadgeSpecialEdition(on);
  /* O botão do painel de tinta é do chrome, não deste módulo — por isso pelo id,
     e por isso tolerante: um chrome sem o botão não pode derrubar a carga. */
  const btn = document.getElementById('btn-paint');
  if (btn) btn.classList.toggle('hidden', on);
  if (on) closePaintPanel();
  /* E o editor grande também: "Pintar o implemento com a cor do cavalo" era a
     última afordância de tinta que sobrevivia a uma edição especial, e ela
     oferecia estender ao baú uma cor que este caminhão não tem. Ver
     `livery.setSpecialEdition()` para o porquê de esconder em vez de
     desabilitar, e para a desmarcação obrigatória. */
  livery.setSpecialEdition(on);
}

function applyColor(color: PaintColorDef) {
  /* A RECEITA DA TINTA GANHA DA DERIVAÇÃO.
     vehicle/paint.ts sabe inventar uma cor de flop e uma de floco a partir do
     hex, e é o que ele faz para as ~415 tintas que ninguém mediu. Para as 107
     que têm ajuste no banco isso é jogar fora uma medição: o `Vermelho Ruby`
     pede flop `#ae0034` sobre face `#c01c28`, e o `Verde Saiph` vira amarelo no
     ângulo por causa de uma luz `#c7e52e` — nenhuma rotação de matiz chega lá.

     `null` explícito e não `undefined`: é assim que setPaint() distingue "volte
     a derivar" de "não mexa". Sem isso, trocar de uma tinta COM receita para uma
     SEM deixaria o flop da anterior grudado na nova. */
  const fx = color.effect;
  const finishFromRecipe = fx?.recipeFinish;
  /* Só os campos que a receita REALMENTE traz. `undefined` em setPaint() é
     "não mexa", então uma receita parcial (as que vêm do gerador 2D só têm cor
     de virada e de floco) não zera o resto do acabamento. */
  const has = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  paint.setPaint({
    finish: (finishFromRecipe === 'solid' || finishFromRecipe === 'metallic'
      || finishFromRecipe === 'pearl') ? finishFromRecipe : color.finish,
    color: fx?.color ?? color.hex,
    /* `null` = volte a derivar do hex; ver PaintPatch. */
    flakeColor: fx?.flake ?? null,
    pearlFlip: fx?.flip ?? null,
    ...(has(fx?.metalness) ? { metalness: fx!.metalness } : {}),
    ...(has(fx?.roughness) ? { roughness: fx!.roughness } : {}),
    ...(has(fx?.gloss) ? { gloss: fx!.gloss } : {}),
    ...(has(fx?.pearlAmount) ? { pearlAmount: fx!.pearlAmount } : {}),
    ...(has(fx?.pearlTravel) ? { pearlTravel: fx!.pearlTravel } : {}),
    ...(fx?.pearlMid ? { pearlMid: fx.pearlMid } : {}),
    ...(has(fx?.flakeAmount) ? { flakeAmount: fx!.flakeAmount } : {}),
    ...(has(fx?.flakeDensity) ? { flakeDensity: fx!.flakeDensity } : {}),
    ...(has(fx?.flakeTilt) ? { flakeTilt: fx!.flakeTilt } : {}),
    ...(has(fx?.flakeGloss) ? { flakeGloss: fx!.flakeGloss } : {}),
    ...(has(fx?.peel) ? { peel: fx!.peel } : {}),
    ...(has(fx?.peelScale) ? { peelScale: fx!.peelScale } : {}),
    ...(has(fx?.peelDetail) ? { peelDetail: fx!.peelDetail } : {}),
  });
  /* O painel de ajuste segue a cor que está no veículo: aberto, ele se
     reapresenta na cor nova em vez de continuar editando a anterior — e o
     "Descartar" dele passa a apontar para a receita DESTA cor. */
  setPaintPanelColor(color.id);
  /* O editor de arte mostra a chapa do painel ATRÁS do desenho, e ela é branca
     ou é esta tinta, conforme o "pintar o implemento". Quem sabe qual é a tinta
     é aqui; quem sabe se ela vale para o baú é o livery. */
  livery.setCabPaintColor(color.hex);
  /* A amostra do canto do card do caminhão — o que sobrou do card de cor. Só a
     amostra e o rótulo: repintar o crachá inteiro descartaria a imagem já
     decodificada para pôr a mesma de volta, piscando a cada troca de cor. */
  lastColor = color;
  syncBadgeColor();
  /* O laço sujo (scene.ts) só desenha quando alguém diz que a imagem mudou, e
     esta é uma das três lacunas que a nota de ON_DEMAND_RENDERING lista por
     nome: o atalho de só-cor pula o pipeline de carregamento de propósito, e com
     ele pula o warmUp() que invalida em todos os outros caminhos — a tinta
     trocaria de material sem trocar a imagem. Aqui e não em runColor() porque os
     DOIS caminhos passam por esta função. */
  invalidate();
}

/* ---------------- "a cor não pegou" NÃO é um defeito da interface ----------
   Um bake sem lataria pintável roda `applyColor()` perfeitamente e não muda de
   cor. Do lado de cá isso é indistinguível de um clique perdido — e é o que
   esta função existe para separar.

   ELA MEDIA A COISA ERRADA. O teste era `contagem > 0`, ou seja PRESENÇA, e o
   caso que aparece de verdade não é o zero: é o bake em que a tinta alcança uma
   PEÇA e não o veículo — um retrovisor, uma saia lateral, um emblema. Contagem
   1, aviso calado, e o usuário vendo uma peça trocar de cor enquanto o caminhão
   fica igual. Agora o teste é de COBERTURA: a diagonal da caixa das malhas
   pintadas sobre a diagonal da caixa da cabine. Diagonal e não área porque a
   pergunta é de EXTENSÃO ("a tinta alcança o veículo?"), não de metros
   quadrados, e são duas caixas em vez de uma varredura de triângulos.

   A pergunta é feita ao REGISTRO de tinta (`isPaintMaterial`), não ao nome: o
   nome é o que ESCOLHE o material lá atrás, e um teste que repetisse o mesmo
   critério só confirmaria a si mesmo.

   Ela NÃO conserta o bake (isso é do pipeline de asset) e NÃO bloqueia a
   escolha: a cor continua aplicada, gravada e usada no implemento, que É
   pintável. O que ela faz é DIZER por que o cavalo não mudou — um usuário
   informado é um bug relatado, um usuário calado é um bug perdido. */
const PAINT_COVERAGE_MIN = 0.25;

function cabPaintCoverage(): { mats: number; coverage: number; names: string[] } {
  const cab = models.state.cab as THREE.Object3D | null | undefined;
  if (!cab) return { mats: 0, coverage: 0, names: [] };
  const seen = new Set<THREE.Material>();
  const names = new Set<string>();
  const box = new THREE.Box3();
  cab.updateWorldMatrix(true, true);
  cab.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material;
    if (!mesh.isMesh || !mat) return;
    let hit = false;
    for (const m of (Array.isArray(mat) ? mat : [mat])) {
      if (m && paint.isPaintMaterial(m)) {
        seen.add(m); names.add(m.name || '(sem nome)'); hit = true;
      }
    }
    if (hit) box.expandByObject(mesh);
  });
  const cabBox = new THREE.Box3().setFromObject(cab);
  const span = box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).length();
  const cabSpan = cabBox.isEmpty() ? 0 : cabBox.getSize(new THREE.Vector3()).length();
  return {
    mats: seen.size,
    coverage: cabSpan > 1e-6 ? Math.min(1, span / cabSpan) : 0,
    names: [...names].sort(),
  };
}

function warnIfUnpaintable(color: PaintColorDef) {
  const c = cabPaintCoverage();
  if (c.mats > 0 && c.coverage >= PAINT_COVERAGE_MIN) return;
  const pct = Math.round(c.coverage * 100);
  /* A mensagem NÃO manda mais conferir `cabs.json`: aquele manifesto foi
     aposentado e `paintMaterials` era uma constante cravada em toda cabine.
     Mandar alguém abrir um arquivo que não existe é pior que não dizer nada. */
  console.warn('[truck-studio] a cor "' + color.name + '" foi aplicada, mas '
    + (c.mats === 0
      ? 'a cabine em cena não tem NENHUM material de tinta.'
      : `só ${c.mats} material(is) cobre(m) ~${pct}% da silhueta da cabine `
        + `(${c.names.join(', ')}).`)
    + ' O implemento continua pintável; o cavalo não. Veja o censo `[tinta]` no'
    + ' console: ele lista como este bake nomeia os materiais dele. O conserto é'
    + ' declarar `chassis[].paintMaterials` no brands.json ou corrigir o bake.');
  setStatus($('status').textContent + (c.mats === 0
    ? ' · cavalo sem material de tinta neste bake'
    : ` · só ~${pct}% do cavalo é pintável neste bake`));
}

/* brands.json e cabs.json são manifestos separados, então o catálogo pode
   oferecer um modelo cuja cabine 3D nunca foi exportada. Ficar de pé numa cabine
   disponível mantém o estúdio usável — um viewport morto no primeiro boot é bem
   pior do que uma geometria provisória, e a linha de estado diz que é isso. */
function resolveChassisFile(model: ModelDef, chassis: ChassisDef): string {
  /* A geometria EFETIVA: o `file` do CHASSI ganha do do modelo. É o gancho que
     permite um 4x2 e um 6x4 apontarem para bakes diferentes sem que nada aqui
     mude — e alguns pares SÃO a mesma malha de propósito (um "6x2 taglift" e um
     "6x4" podem ser arquivos byte-idênticos, e as duas cartas continuam
     existindo porque a distinção é comercial). */
  const file = fileOf(model, chassis);
  /* SEM SUBSTITUIÇÃO POR OUTRA MALHA. O caminho antigo caía na primeira cabine
     disponível do `cabs.json` e seguia em frente com um " · geometria
     provisória" na linha de estado — ou seja, mostrava um Scania quando o
     usuário pediu um DAF, e a única pista era um sufixo que ninguém lê. Isso é
     pior do que um erro: a arte é aprovada sobre a lataria da montadora errada.
     Um chassi sem geometria já é marcado "Em breve" e não é clicável, então
     chegar aqui sem `file` significa manifesto inconsistente. */
  if (!file) {
    throw new Error(`O chassi "${chassis.name}" de ${model.name} não declara geometria`
      + ' (`file`) no catálogo. Confira `chassis[].file` em brands.json.');
  }
  return file;
}

/* Compila todo programa e sobe toda textura que a cena vai precisar, e então
   deixa DOIS quadros reais passarem, ANTES de qualquer coisa se declarar
   carregada. `compileAsync` usa KHR_parallel_shader_compile onde o driver tem,
   então isto cede a thread em vez de travá-la como `compile()` faz. */
/* TODA ESPERA AQUI DENTRO É LIMITADA.
   Uma aba em segundo plano não dispara requestAnimationFrame nenhum, e a
   sondagem de compilação paralela do three pode empacar junto — então um `await`
   simples em qualquer uma das duas pendura o boot() para sempre se o usuário
   trocar de aba enquanto o estúdio carrega, e a cortina nunca desce. Aquecer é
   OTIMIZAÇÃO; nunca pode ser o motivo de o app não subir. */
function bounded<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((res) => setTimeout(res, ms))]);
}

async function warmUp() {
  scene.updateMatrixWorld(true);
  try {
    const r = renderer as THREE.WebGLRenderer & {
      compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
    };
    if (typeof r.compileAsync === 'function') await bounded(r.compileAsync(scene, camera), 8000);
    else renderer.compile(scene, camera);
  } catch (e) {
    console.warn('[truck-studio] warm-up de shaders falhou', e);
  }
  invalidateShadows();      // o primeiro passe de sombra também pertence aqui
  /* Dois quadros apresentados se a aba estiver visível; um timer curto se não
     estiver. setTimeout ainda dispara em segundo plano, rAF não. */
  await bounded(
    new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))),
    500,
  );
}

/* Entrega ao orbit o seu objeto: a caixa do próprio conjunto, medida DEPOIS do
   engate, para ser a silhueta de verdade e não a pose de carga dos dois grupos.
   É também o instante em que todo projetor de sombra parou de se mexer, então é
   aqui que o mapa de sombra é marcado. */
function focusOnRig() {
  const box = new THREE.Box3();
  for (const g of [models.state.cabGroup, models.state.trailerGroup]) {
    if (g.visible) box.expandByObject(g);
  }
  setVehicleFocus(box.isEmpty() ? null : box);
  invalidateShadows();
}

/* ---------------- redimensionamento do baú ----------------
   A interface disto NÃO mora aqui, e não deve: este é o engine. O que mora aqui
   é a costura entre os três donos que um resize toca e que não se conhecem —
   `models` (a geometria e o engate), `livery` (a arte) e `scene` (a câmera).

   O RECORTE DAS CHAPAS É DESTRUTIVO, e é isso que obriga esta função a existir.
   `models.setTrailerDims()` joga fora as malhas SIDE_L/SIDE_R/REAR e recorta
   três novas do corpo redimensionado; as sobreposições de arte que
   `livery.attachOverlays()` havia pendurado nelas foram junto. Reatar não é
   opcional: sem isso o editor continua desenhando nas telas fabric e o baú
   continua branco. Feito por inscrição em vez de chamada direta porque
   vehicle/livery importa vehicle/models — a seta aponta para lá, e uma de volta
   fecharia um ciclo. */
models.onTrailerPanelsRebuilt((trailer) => {
  livery.attachOverlays(trailer);
  /* attachOverlays() remede o painel e reescreve a régua em centímetros, então
     a escala real acompanha o baú novo de graça. O que ela NÃO faz é subir a
     textura: as telas não mudaram, só o objeto que as amostra. */
  livery.markAllDirty();
});

/**
 * Redimensiona o baú e devolve as medidas EFETIVAS (a altura fecha um número
 * inteiro de frisos, então ela é ajustada). `null` num bake que não redimensiona.
 *
 * @param opts.frame reenquadra a câmera. Desligado por padrão de propósito: um
 *   formulário com controle deslizante chamaria isto a cada quadro, e voar a
 *   câmera a cada milímetro é enjoo, não feedback. Os LIMITES do orbit são
 *   rederivados sempre — eles são função da silhueta do conjunto, e deixá-los
 *   velhos prende o zoom numa caixa que não existe mais.
 */
export function setTrailerDims(
  patch: { height?: number; length?: number }, opts: { frame?: boolean } = {},
) {
  const dims = models.setTrailerDims(patch);
  if (!dims) return null;
  if (opts.frame) frameAll([models.state.cabGroup, models.state.trailerGroup]);
  focusOnRig();
  return dims;
}

/* ---------------- o baú redimensionando, COM estado de carregamento ----------
   O recorte é destrutivo (ver a nota da função acima): entre o descarte das
   chapas SIDE_L/SIDE_R/REAR e o `attachOverlays()` que repõe a arte existe uma
   janela em que o baú está BRANCO com o desenho solto. Ela durava um punhado de
   quadros e não tinha aviso nenhum — o pior dos dois mundos, porque um usuário
   que vê a arte sumir não sabe se ela voltou por si ou se ele a perdeu.

   A saída NÃO é a cortina inteira: o formulário de medidas tem de continuar
   visível enquanto o valor é aplicado, senão o usuário perde o contexto do que
   acabou de digitar. É um véu LOCAL sobre o viewport (`.is-rebuilding` em
   #canvas-holder, desenhado em core/studio.css) mais a pílula, que é o mesmo
   vocabulário de todo o resto.

   A GEOMETRIA É COALESCIDA DE VERDADE, e é isso que separa esta versão da
   anterior. Coalescer só o véu e a pílula deixando o recorte rodar a cada
   `input` seria um estado de carregamento que MENTE: o indicador ficaria
   parado e suave enquanto o engasgo que ele deveria estar cobrindo continuava
   acontecendo trinta vezes por segundo. O aplicador agora pode devolver uma
   promessa (ver `DimsApplier` em vehicle/livery-structure.ts), e é ela que
   permite responder "aceitei, mas ainda não recortei".

   DEBOUNCE PURO DE SAÍDA, sem `maxWait` — decisão, não omissão. Um `maxWait`
   daria um recorte a cada ~700 ms durante o arrasto, ou seja devolveria o
   engasgo periódico que este trabalho existe para eliminar; a preferência do
   produto é explícita em não travar DURANTE o uso. Então: ZERO recortes
   enquanto a medida se mexe, UM quando ela assenta.

   O inspetor não fica morto nesse meio-tempo — `setImplementMeasures()` já
   atualiza a pilha 2D de forma otimista e recompõe na hora, então os painéis
   desenhados acompanham o número em tempo real. Quem espera é só a malha 3D, e
   é exatamente sobre ela que o véu está. O indicador passa a descrever o que
   está mesmo acontecendo: "o 3D ainda não é este número".

   E NÃO HÁ FILA. Os patches se FUNDEM num só (`dimsPending`, último valor de
   cada campo ganha) e existe UM temporizador. Arrastar por dez segundos deixa
   exatamente um recorte pendente, nunca uma pilha deles. */
const DIMS_QUIET_MS = 260;
let dimsTimer: ReturnType<typeof setTimeout> | null = null;
let dimsPending: { height?: number; length?: number } | null = null;
let dimsPill: { release(): void } | null = null;
/* Quem espera o recorte coalescido. Todos os chamadores da janela resolvem com
   o MESMO resultado — é um recorte só, então é uma resposta só. */
let dimsWaiters: ((dims: ReturnType<typeof models.setTrailerDims>) => void)[] = [];

function setViewportBusy(on: boolean) {
  const holder = document.getElementById('canvas-holder');
  if (holder) holder.classList.toggle('is-rebuilding', on);
}

function endDimsBusy() {
  setViewportBusy(false);
  dimsPill?.release();
  dimsPill = null;
}

/** O recorte de verdade, uma vez, quando a medida parou de se mexer. */
function flushTrailerDims() {
  dimsTimer = null;
  const patch = dimsPending;
  dimsPending = null;
  const waiters = dimsWaiters;
  dimsWaiters = [];
  let dims: ReturnType<typeof models.setTrailerDims> = null;
  try {
    if (patch) dims = setTrailerDims(patch);
  } catch (e) {
    /* Um recorte que lança não pode deixar o véu preso sobre o viewport para
       sempre — o usuário ficaria com a cena embaçada e sem caminho de volta —
       nem pendurar quem aguardou a promessa. */
    console.error('[truck-studio] falha ao redimensionar o baú', e);
  } finally {
    endDimsBusy();
    for (const w of waiters) w(dims);
  }
}

/**
 * A porta do FORMULÁRIO. Agenda o recorte e devolve uma PROMESSA — o contrato
 * novo do `DimsApplier`, que é o que autoriza a coalescência.
 *
 * `setTrailerDims()` continua exportada e IMEDIATA para o console e para o
 * "resetar", onde não há arrasto e esperar 260 ms não compraria nada.
 */
function applyTrailerDimsDebounced(
  patch: { height?: number; length?: number },
): Promise<ReturnType<typeof models.setTrailerDims>> {
  /* Fusão, não fila: um arrasto que mexe só na altura não pode perder o
     comprimento que veio antes dele. */
  dimsPending = { ...dimsPending, ...patch };
  if (!dimsPill) {
    dimsPill = claimPill('Ajustando o baú…');
    setViewportBusy(true);
  }
  if (dimsTimer) clearTimeout(dimsTimer);
  dimsTimer = setTimeout(flushTrailerDims, DIMS_QUIET_MS);
  return new Promise((resolve) => { dimsWaiters.push(resolve); });
}

/* O EDITOR DE MEDIDAS TEM DE PASSAR POR ESTA PORTA, e não pela crua.
   ---------------------------------------------------------------------------
   `vehicle/livery-structure.ts` é quem recebe a edição de medida vinda do
   inspetor do editor de plotagem, e o padrão dele para redimensionar é
   `models.setTrailerDims` — a porta crua, que regenera a geometria mas não
   reata a arte nem rederiva os limites da órbita. A porta boa é a função logo
   acima, e ela mora aqui porque é aqui que os três donos de um resize se
   encontram.
   Injetado em vez de importado pelo mesmo motivo do gancho
   onTrailerPanelsRebuilt() logo acima: vehicle/* não importa studio.ts, e
   inverter essa seta fecharia um ciclo. Feito na avaliação do módulo, portanto
   antes de qualquer boot — não existe janela em que uma medida seja aplicada
   pela porta crua. */
liveryStructure.setDimsApplier((patch) => applyTrailerDimsDebounced(patch));

async function runApply(resolved: ResolvedPick, first: boolean, curtain: boolean) {
  const { choice, env, model, chassis, manufacturer, color, finish } = resolved;
  /* 'Highline · 6x4' — o chassi é um passo do seletor agora, então tudo que
     nomeia o veículo (a cortina, o crachá, a linha de estado) tem de dizer qual
     configuração está na tela. */
  const subtitle = chassisSubtitle(model.subtitle, chassis);
  const current = getCurrentEnvironment();
  /* Reaplicar o MESMO cenário não baixaria nada, mas ainda assim zeraria o
     preset de luz, a hora do dia e a exposição — jogando fora o que o usuário
     ajustou na sidebar só porque trocou de cabine. */
  const needEnv = first || !current || current.id !== env.id;
  const cabFile = resolveChassisFile(model, chassis);
  /* A cabine que já está montada NÃO é remontada. Vale para duas rotas reais:
     a troca só de CENÁRIO (o fluxo parcial do card do topo, em que o modelo não
     muda) e a reconstrução depois da liberação diferida lá embaixo — as duas
     baixavam e reparseavam megabytes de cabine para pôr no lugar exatamente a
     mesma geometria. `state.cabId` é escrito por loadCab() e é null antes do
     primeiro, então o boot sempre carrega. */
  /* `state.cabId` é o CAMINHO do arquivo em cena agora, não um id de cabine —
     mesma comparação, chave melhor: dois chassis que apontam para o mesmo .glb
     (os pares byte-idênticos) não pagam um download por troca de carta. */
  const needCab = first || models.state.cabId !== cabFile;

  /* PESOS EM MEGABYTES, não em contagem de tarefas.
     ---------------------------------------------------------------------------
     Eram `{cab: 2, env: 3, trailer: 2}` — três tarefas, fatias parecidas — e
     isso descrevia MAL o que estava acontecendo. Medido: o cavalo são 3,5 a
     6,6 MB (o Scania 46 MB, em FBX), o ambiente são 5,8 MB de HDRI mais 8 a
     29 MB de set com as texturas de chão, e o implemento sozinho são 286 MB.
     Com peso 2, o implemento levava 29% da barra para 88% dos bytes: ela pulava
     para ~43%, subia rápido para ~71% e então RASTEJAVA de 71 a 98 durante
     quase todo o tempo real de espera.

     Os números abaixo são megabytes aproximados. Não precisam ser exatos — a
     barra é uma expectativa, não um contrato — mas precisam estar na mesma
     ORDEM DE GRANDEZA um do outro, que é o que estes estão e os antigos não. */
  const weights: TaskWeights = {};
  if (needCab) weights.cab = 8;
  if (needEnv) weights.env = 25;
  if (first) weights.trailer = 150;

  /* Duas esperas muito diferentes, dois tratamentos muito diferentes:
     - uma aplicação vinda do seletor (boot, "Trocar") ganha a cortina inteira —
       ela mostra o caminhão que o usuário acabou de escolher e voa a foto dele
       para o crachá;
     - `curtain: false` fica na pílula discreta, sem tomar a tela.

     SOBRE O `curtain: false`: ele NÃO tem nenhum acionador na interface. É um
     afordance de console/debug, alcançável só por
     `window.__studio.applyChoice(escolha, { curtain: false })`, e existe para
     comparar cabines em A/B sem a coreografia de segundos da cortina. Este
     comentário dizia "o select de modelo da sidebar", que não existe — a sidebar
     nunca teve um. Mantido porque é barato e porque comparar duas cabines na
     mesma pose é exatamente o que se faz ao calibrar tinta pelo console.

     A porcentagem vai no TEXTO da pílula porque ela não tem barra própria. A
     barra do painel de bootstrap (#load-fill) NÃO é mais escrita aqui: aquele
     painel recebe `.hide` (opacidade 0, sem eventos) assim que o catálogo
     termina, então tudo que se escrevia nele depois disso ia para um elemento
     invisível — um segundo modelo de progresso que ninguém jamais viu. */
  const pill = curtain ? null : claimPill(`Carregando ${model.name}…`);
  const progress = makeProgress(weights, curtain
    ? (p, key) => setLoaderProgress(p, TASK_LABELS[key])
    : (p: number) => pill?.set(`Carregando ${model.name}… ${Math.round(p * 100)}%`));

  if (curtain) {
    /* De qual card a cortina fala. A saída voa a imagem principal dela para o
       crachá correspondente, então isto tem de ser o que REALMENTE mudou: numa
       troca só de cenário (o fluxo parcial do card do topo) mostrar a foto do
       caminhão encolhendo para dentro do crachá do caminhão animaria algo que
       não aconteceu. Troca de modelo — e o primeiro boot, em que o caminhão é a
       recompensa — ficam no caminhão. */
    const modelChanged = !currentChoice || currentChoice.modelId !== choice.modelId
      || currentChoice.chassisId !== choice.chassisId;
    showLoader({
      subject: modelChanged ? 'truck' : 'map',
      modelName: model.name,
      modelSubtitle: subtitle,
      /* O render pré-produzido é a imagem certa da cortina: ela é a MESMA que
         vai voar para o crachá no fim, e uma foto de manifesto voando para
         dentro de um crachá que mostra um render seria a troca de duas
         imagens diferentes disfarçada de uma. Cai na foto quando o render
         daquela combinação ainda não existe. */
      /* O ACABAMENTO MANDA NA IMAGEM. `color.id` é a tinta, e com uma película
         escolhida a tinta não é o que está na tela — a cortina mostrava o S-Way
         BRANCO enquanto o estúdio montava o Metallica. O `colorId` continua
         guardado (é a cor do implemento), mas quem nomeia o card do cavalo aqui
         é o acabamento. */
      modelImage: renderUrl(manufacturer.id, model.id, chassis.id,
        finish ? finish.id : color.id)
        || assetUrl(chassis.image || model.image),
      logo: assetUrl(manufacturer.logo),
      manufacturerName: manufacturer.name,
      envName: env.name,
      envSubtitle: env.subtitle,
      envThumb: assetUrl(env.thumb),
    });
  }

  try {
    /* Cenário e geometria são downloads independentes — rodam juntos. */
    const tasks: Promise<unknown>[] = [];
    if (needCab) {
      tasks.push(models.loadCab(cabFile, progress.track('cab'),
        paintMaterialsOf(model, chassis, finish?.id ?? null)));
    }
    if (needEnv) tasks.push(applyEnvironment(env, progress.track('env')));
    if (first) tasks.push(models.loadTrailer(progress.track('trailer')));

    /* allSettled, e NÃO Promise.all — ESTA É A CORREÇÃO DO ESTADO RASGADO.
       ---------------------------------------------------------------------
       Promise.all rejeita no INSTANTE da primeira falha, com as outras tarefas
       ainda em voo. O catch abaixo então baixava a cortina e devolvia a cena
       ANTIGA com uma mensagem de erro — e um ou dois segundos depois
       applyEnvironment() terminava sozinho e TROCAVA O CENÁRIO POR BAIXO do
       caminhão velho que já estava na tela. O usuário via o erro e via a cena
       mudar depois dele, o que é a pior das duas metades: nem o estado novo,
       nem o antigo.
       allSettled espera todo mundo parar de mexer na cena; só então a primeira
       rejeição é relançada para o catch de sempre. A cortina só desce quando
       não há mais nada em voo. */
    const settled = await Promise.allSettled(tasks);
    const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
    progress.complete();

    /* ---- A FASE PÓS-DOWNLOAD, QUE NÃO REPORTAVA NADA ----
       Daqui até warmUp() são 2 a 8 segundos de trabalho SÍNCRONO e pesado: seis
       renders da sonda de reflexo, dois renderer.compile() da cena inteira e
       doze renders offscreen de miniatura. A barra ficava cravada em 98% (o teto
       de setLoaderProgress) com o rótulo parado em "Carregando implemento…", que
       é o "chega a 100% e fica lá". O creep também não cobria: o teto dele é
       0,90, abaixo dos 0,98 já reportados.

       Agora os downloads ocupam 0..70% e esta fase os 30% restantes, com rótulo
       próprio em cada etapa. `paint()` cede um quadro ANTES de cada bloco
       bloqueante — sem isso o rótulo novo só apareceria depois do trabalho que
       ele anuncia, que é o mesmo nada. */
    const phase = curtain
      ? (f: number, label: string) => setLoaderProgress(0.70 + 0.30 * f, label)
      : () => { /* a pílula não tem barra própria */ };
    /* `paint` era um `const` local daqui; virou `paintFrame()` em ui/loader.ts
       quando os outros quatro pontos de travamento (cor, baú, preset de luz,
       captura) passaram a precisar exatamente do mesmo quadro cedido. */
    const paint = paintFrame;

    if (first) {
      livery.attachOverlays(models.state.trailer as THREE.Object3D);
      livery.setOutlines(models.state.trailerMeta);
    }
    phase(0, 'Posicionando o veículo…');
    await paint();
    /* Uma troca de cabine move o ponto de engate, então o implemento tem de ser
       reposicionado e a câmera reenquadrada nos DOIS caminhos, não só no
       primeiro. */
    models.placeTrailer();

    phase(0.15, 'Capturando reflexos…');
    await paint();
    /* DEPOIS de o implemento estar na pose final e de o set do cenário estar de
       pé: a sonda fotografa o mundo do meio do conjunto, então os dois têm de
       estar onde vão ficar. Uma vez por escolha, nunca por quadro — ver
       scene/probe.ts. */
    models.refreshVehicleReflection();
    frameAll([models.state.cabGroup, models.state.trailerGroup]);
    /* Rederivado em todo caminho, não só no primeiro: uma troca de cabine muda o
       comprimento do conjunto, e os limites do orbit são função dele. */
    focusOnRig();
    /* A tinta vem da ESCOLHA agora, não de um reset para o prata de fábrica: a
       cor é um passo do seletor, e chegar aqui com ela já decidida é o ponto.
       Nos dois caminhos, porque uma troca de cabine traz materiais novos. */
    applyColor(color);
    /* O MESMO aviso do atalho de só-cor, e é aqui que ele faltava: uma cabine
       impintável entrava pelo boot e pelo "Trocar" em silêncio absoluto, e o
       usuário só descobria ao trocar de cor DEPOIS — que é o único caminho que
       já avisava. */
    warnIfUnpaintable(color);

    phase(0.35, 'Compilando materiais…');
    await paint();
    /* POR ÚLTIMO, porque compila o que estiver na cena e tudo acima acrescenta a
       ela — o set, a cabine, o implemento e os materiais de tinta que
       applyColor() acabou de trocar. Ainda dentro do loader, que é o ponto todo:
       esta é a recompilação dia↔noite, tirada do slider de tempo e posta na
       barra de progresso. Ver warmLightPrograms().

       AGUARDADO: warmLightPrograms() passou a usar compileAsync() em vez do
       renderer.compile() síncrono, então ele agora DEVOLVE uma promessa. Sem o
       await a cortina subiria antes de a compilação terminar — que é
       exatamente o travamento que este bloco existe para pagar adiantado. */
    await warmLightPrograms();

    /* A FASE "Gerando miniaturas de cor…" SUMIU DAQUI, e essa é a maior
       economia desta mudança. Ela renderizava a paleta inteira da montadora —
       até 26 cores — num segundo contexto WebGL, dentro da cortina, a cada
       troca de caminhão: de meio a quatro segundos de main thread congelada.
       As imagens agora são pré-produzidas (catalog/renders.ts) e o cache é o do
       navegador. As frações desta fase foram REBALANCEADAS: `warmLightPrograms`
       ficava em 0,4–0,6 e agora ocupa 0,35–0,85, e o primeiro quadro entra em
       0,85 em vez de 0,9 — o tempo real que a fase de miniaturas ocupava foi
       redistribuído em vez de deixar a barra saltar 30 pontos de uma vez. */

    /* ui/selector.ts já preenche os dois crachás a partir do catálogo antes de
       disparar os listeners, mas dois caminhos nunca passam pelo seletor — o
       afordance de console e um visitante de volta cuja escolha salva pula a
       overlay inteira — então este é o único lugar garantido. Tem de acontecer
       ANTES de finishLoader(), que voa a foto da cortina para um crachá que já
       precisa estar visível. */
    setBadge({
      modelName: model.name,
      modelSubtitle: subtitle,
      modelImage: assetUrl(chassis.image || model.image),
      manufacturerName: manufacturer.name,
      logo: assetUrl(manufacturer.logo),
      /* A MESMA imagem dos cards e da cortina. Sem espera, sem token de corrida:
         `renderUrl()` responde do manifesto já carregado, e a cadeia de
         fallback (render → foto → silhueta) mora dentro de setBadge(). */
      /* Mesma regra da cortina: com película, é ela que o crachá do canto
         mostra. Eram os dois lugares em que o caminhão branco aparecia no lugar
         do Metallica. */
      render: {
        url: renderUrl(manufacturer.id, model.id, chassis.id, finish ? finish.id : color.id),
        chassisId: chassis.id,
      },
      colorName: color.name,
      colorHex: color.hex,
      finishLabel: FINISH_LABEL[color.finish],
    });
    showBadge(true);
    /* EDIÇÃO ESPECIAL: some com as duas afordâncias de tinta.
       O seletor já tira o passo "Cor" da sequência, mas o card de cor do canto e
       o botão do painel de tinta vivem FORA dele e continuariam abrindo um fluxo
       que não muda nada — a cabine não tem material de tinta registrado, então
       cada clique seria uma promessa que a cena não cumpre.
       applyColor() acima roda de qualquer forma, e é de propósito: ele também
       alimenta o editor de arte e o crachá, e a cor carregada continua sendo a
       do implemento, que É pintável mesmo atrás de um cavalo de edição especial. */
    /* `specialEdition` (o modelo INTEIRO é uma película) ou um ACABAMENTO
       escolhido — os dois chegam aqui como a mesma coisa, porque para as
       afordâncias de tinta eles são: não há cor de cavalo a oferecer. A
       diferença mora um passo antes, no seletor: o modelo especial some com o
       passo da cor, o acabamento É um card dentro dele. */
    setSpecialEdition(!!model.specialEdition || !!finish, finish?.name ?? null);
    setMapBadge({
      envName: env.name,
      envSubtitle: env.subtitle,
      envThumb: assetUrl(env.thumb),
    });
    showMapBadge(true);

    /* #brand-sub morreu com a topbar. O que ele dizia — qual caminhão, qual
       implemento — está no badge do caminhão e na linha de estado, e nenhum dos
       dois precisava de uma terceira cópia. */
    /* O sufixo " · geometria provisória" SUMIU junto com a substituição de
       malha que ele descrevia: não existe mais um caminho em que o estúdio
       mostre a cabine de outra montadora. Ou a geometria pedida carrega, ou
       resolveChassisFile()/loadCab() lançam e o catch abaixo mantém a cena
       anterior de pé com a mensagem. O que sobrou de "degradado" é o
       posicionamento sem `hitch.json`, e isso a linha diz por si. */
    const stand = models.state.hitch ? '' : ' · engate medido em cena';
    setStatus(first
      ? `Pronto · ${env.name} · ${color.name} · cabine ${fmt(models.state.cabBox)}`
        + ` · implemento ${fmt(models.state.trailerBox ?? null)}`
        + (models.state.trailerMeta ? '' : ' · engate padrão') + stand
      : `${truckLabel(manufacturer.name, model.name)} · ${chassis.name} · ${color.name} · ${env.name}` + stand);
    /* O nome do arquivo da captura carrega o veículo inteiro — quem baixa cinco
       variações não pode acabar com `truck-studio (4).png`. */
    setCaptureSubject([truckLabel(manufacturer.name, model.name), chassis.name, color.name]);

    currentChoice = choice;
    /* Os acabamentos gravados entram na PEÇA que acabou de ser montada. Aqui e
       não antes: `setTrimChoice()` escreve material em malhas do implemento, e
       até esta linha o implemento pode ser o do caminhão anterior. */
    trim.setTrimChoice(choice.trim);
    /* Persiste só o que de fato renderizou: uma escolha que falhou ao carregar
       não pode virar aquela em que a próxima visita entra. (O seletor também
       pode tê-la salvo; saveChoice é idempotente.) */
    saveChoice(withTrim(choice));
    /* applyEnvironment() reaplica o preset, a hora e a exposição da própria
       cena, então todo controle do HUD de luz está velho no instante em que o
       cenário muda. syncHud() relê a cena em vez de confiar nos últimos valores
       que escreveu. */
    if (needEnv) syncHud();
    /* Baixado e parseado NÃO é pronto para desenhar. O primeiro quadro depois de
       a cortina subir é onde o three compila todo programa que ainda não viu e
       sobe toda textura, e nesta cena isso são centenas de milissegundos de
       imagem congelada — que é exatamente o "carrega meio travado e depois
       funciona" que chega como bug de carregamento. Faça isso com a cortina
       ainda de pé, onde a pausa é o que o usuário já está vendo. */
    phase(0.85, 'Renderizando o primeiro quadro…');
    await paint();
    await warmUp();
    /* A saída é cosmética: um soluço na animação de flip não pode transformar
       uma cena perfeitamente carregada num erro, mas a cortina TEM de descer. */
    if (curtain) {
      try {
        await finishLoader({ flyToBadge: true });
      } catch (e) {
        console.warn('[truck-studio] transição de saída falhou', e);
        hideLoader();
      }
    }
    return choice;
  } catch (err: unknown) {
    console.error(err);
    /* Deixe a cena anterior de pé — meio aplicada é pior do que velha. A cortina
       sai de qualquer jeito: mantê-la de pé esconderia a linha de estado, que é
       quem carrega a mensagem. */
    setStatus('Erro ao aplicar seleção: ' + errText(err));
    if (curtain) hideLoader();
    if (first) {
      /* Não foi construído absolutamente nada, então um viewport vazio só leria
         como quebrado — traga o painel de bootstrap de volta para carregar a
         mensagem. */
      $('load-text').textContent = 'Erro ao carregar: ' + errText(err);
      $('loading').classList.remove('hide');
    }
    return null;
  } finally {
    /* Só limpe o marcador se ele ainda for NOSSO: com duas escolhas enfileiradas
       uma atrás da outra, a segunda já é dona de `pendingChoice` e tem de
       continuar sendo. */
    if (pendingChoice === choice) pendingChoice = null;
    pill?.release();
  }
}

/**
 * A única função que transforma uma escolha em cena: cenário + cabine (+ o
 * implemento no primeiro boot), depois os crachás e a linha de estado.
 * Nunca lança e nunca roda dois carregamentos ao mesmo tempo.
 *
 * @param choice  a escolha a aplicar.
 * @param opts.first    boot: também carrega o implemento e roda o setup único do livery.
 * @param opts.curtain  mostra a cortina inteira (padrão true). `false` deixa a
 *   pílula discreta no lugar dela e NÃO tem acionador na interface: é o
 *   afordance de console exposto por `window.__studio.applyChoice`.
 * @returns a escolha aplicada, ou null quando falhou e a cena antiga foi mantida.
 */
function applyChoice(
  choice: Choice,
  opts: { first?: boolean; curtain?: boolean } = {},
): Promise<Choice | null> {
  const first = !!opts.first;
  const curtain = opts.curtain !== false;
  const resolved = resolveChoice(choice);
  if (!resolved) {
    setStatus('Catálogo vazio — nada a carregar');
    return Promise.resolve(null);
  }
  /* Idempotência, e ela é carregante: ui/selector.ts dispara onChange() para
     TODA seleção concluída — inclusive a de boot, que openSelector() resolve —
     então a mesma escolha chega aqui duas vezes, e repicar o mesmo caminhão no
     fluxo "Trocar" também não pode rebaixar dezenas de megabytes.
     `pendingChoice` é atribuído SINCRONAMENTE lá embaixo, então um segundo
     chamador no mesmo tick sempre o enxerga, mesmo com o primeiro carregamento
     ainda no meio. */
  const reference = pendingChoice || currentChoice;
  if (!first && sameChoice(resolved.choice, reference)) return applyQueue;

  /* SÓ A COR MUDOU. Não há um único byte para baixar: a tinta é um parâmetro de
     material, e o caminho normal daqui para baixo chamaria models.loadCab() —
     ou seja, remontaria a cabine inteira para trocar um hex. Este é o atalho.
     Ele ainda passa pela FILA em vez de rodar na hora: se houver um load em
     voo, aquele load termina aplicando a cor que ELE resolveu, e uma cor
     aplicada antes dele seria desfeita alguns segundos depois, sozinha. */
  if (!first && sameRig(resolved.choice, reference)) {
    /* SEMPRE COM PÍLULA, e não só quando a fila estiver ocupada.
       ---------------------------------------------------------------------
       Este era o furo: `enqueue()` só mostra o aviso se JÁ houver um load em
       voo, e no caso comum — nenhum download pendente — `runColor` rodava
       síncrono e sem feedback nenhum. Só que ele não é barato: applyColor()
       troca o MeshPhysicalMaterial da cabine inteira, reescreve a chapa do
       editor de arte e invalida a cena. Numa cabine grande isso é um engasgo
       visível, e um engasgo sem aviso é indistinguível de um clique perdido.
       `withPill` anuncia, deixa o navegador PINTAR o anúncio (um rAF) e só
       então aplica — custa ~16 ms e elimina o "clique que não fez nada". */
    const runColor = () => withPill(`Aplicando ${resolved.color.name}…`, () => {
      applyColor(resolved.color);
      currentChoice = resolved.choice;
      saveChoice(withTrim(resolved.choice));
      setStatus(`${truckLabel(resolved.manufacturer.name, resolved.model.name)} · ${resolved.color.name}`);
      warnIfUnpaintable(resolved.color);
      return resolved.choice;
    });
    /* O rótulo que enqueue() mostra SE esta cor tiver de esperar ATRÁS de
       outra coisa — a espera na fila e a aplicação em si são estados
       diferentes e dizem frases diferentes. */
    return enqueue(`${resolved.color.name} · aguardando o carregamento atual…`, runColor);
  }

  pendingChoice = resolved.choice;
  return enqueue(
    `${resolved.model.name} · aguardando o carregamento atual…`,
    () => runApply(resolved, first, curtain),
  );
}

/* ---------------- liberação diferida da GPU ----------------
   POR QUE NÃO SE LIBERA NADA NA SAÍDA DA ROTA. O engine é um singleton que
   sobrevive à página React exatamente para que voltar não custe outro download
   de centenas de megabytes. Descartar HDRI, PMREM, geometria e texturas de set
   em unmountStudio() apagaria essa propriedade inteira — e trocar de aba dentro
   do Ankaa é justamente o que o usuário faz o tempo todo.

   POR QUE TAMBÉM NÃO SE PODE NÃO LIBERAR NUNCA. disposeEnvironments(),
   disposeReflectionProbe() e disposeSetTextures() existiam e não eram chamados
   por ninguém: os HDRIs, os render targets do PMREM, a geometria do set e os
   mapas de chão ficavam presos pelo resto da VIDA DA ABA depois que o usuário
   saía da rota — da ordem de meia dezena de centenas de megabytes de VRAM
   segurados por uma página que ele não está mais vendo.

   A saída é o mesmo desenho que ui/preview.ts já usa para o contexto WebGL das
   miniaturas: um timer de 60 s armado na saída e CANCELADO pela próxima
   entrada. Uma troca rápida de aba não paga nada; ir embora de verdade devolve
   a memória.

   O QUE NÃO É LIBERADO, e de propósito: cabine, implemento e canvas de plotagem.
   Eles são o download caro (o implemento sozinho são 286 MB) e são o que faz
   voltar ser instantâneo. O que sai é só o CENÁRIO, que é reconstruível a partir
   da escolha salva — e a reconstrução acontece sob a cortina, que é o estado de
   carregamento honesto para ela. */
const RELEASE_MS = 60000;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
/* A escolha que estava na tela quando a cena foi liberada. É o que a próxima
   montagem reaplica; enquanto não for null, a cena está SEM cenário. */
let releasedChoice: Choice | null = null;

function cancelRelease() {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
}

function releaseScene() {
  releaseTimer = null;
  /* Nunca liberar por baixo de um download em voo: applyEnvironment() não é
     cancelável, e uma carga que resolvesse depois do descarte repovoaria os
     caches que acabamos de esvaziar — memória de volta, e nenhuma delas na
     cena. Um carregamento termina; adiar é suficiente. */
  if (queueDepth > 0) { releaseTimer = setTimeout(releaseScene, RELEASE_MS); return; }
  if (!currentChoice) return;              // já liberado, ou nunca chegou a montar
  releasedChoice = currentChoice;
  /* A cena deixa de mostrar esta escolha AGORA, e dizer isso é o que faz o
     dedupe de applyChoice() não descartar a reconstrução como repetida. */
  currentChoice = null;
  try {
    /* disposeEnvironments() já cobre o set e o cache de texturas dele
       (disposeSet + disposeSetTextures lá dentro). A ORDEM importa: ele também
       chama setExternalEnvironment(null) / setLampModel(null) / setLamps(null),
       ou seja tira as coisas da cena ANTES de qualquer descarte de geometria. */
    disposeEnvironments();
    disposeReflectionProbe();
    /* O cache de IBL PROCEDURAL é de scene.ts e não passa por nenhum dos dois
       acima: são até 8 render targets PMREM (o céu por passo de `nightness`,
       por preset), e é o que o `armazem` usa o tempo todo, já que ele não tem
       HDRI. Sem isto, o cenário sem HDRI era justamente o que menos liberava. */
    releaseProceduralEnvCache();
    console.info('[truck-studio] cenário liberado após', RELEASE_MS / 1000, 's fora da rota');
  } catch (e) {
    console.warn('[truck-studio] falha ao liberar o cenário', e);
  }
}

async function boot() {
  try {
    livery.initLivery();
    initWeather();
    initUI();
    initPaintPanel();
    initTrimPanel();
    /* A arte estrutural do painel (fita 3M, cantoneira, porta). Sem `await`, e
       de propósito: são 37 kB que só melhoram o desenho do editor, e nenhum
       passo do boot depende deles. O que chega antes de o usuário abrir o editor
       chega a tempo; o que não chegar deixa o placeholder, que é utilizável.
       Ver o cabeçalho de engine/vehicle/livery-art.ts. */
    loadLiveryArt();

    $('load-text').textContent = 'Carregando catálogo…';
    /* Três listas independentes: o catálogo diz o que o usuário PODE escolher,
       cabs.json diz o que o carregador 3D consegue montar, e a paleta diz de
       que cores. Nenhuma bloqueia a outra, e nenhuma delas lança. */
    /* `loadRenders()` entra aqui e não mais tarde: os cards do seletor pedem a
       URL do render de forma SÍNCRONA, então o manifesto tem de estar em
       memória antes de o primeiro grid ser montado. Ele nunca lança e nunca
       bloqueia nada — ausente = todo card cai no placeholder de silhueta. */
    await Promise.all([loadCatalog(), models.loadManifests(), loadColors(), loadRenders()]);
    /* A tira de acabamentos foi montada ANTES da paleta existir — a grade dela
       teria saído só com "Como o baú". Repintar aqui é o mesmo padrão que o
       seletor usa, e custa uma varredura de quatro linhas. */
    refreshTrimPanel();

    /* O IMPLEMENTO COMEÇA A DESCER AGORA — antes de existir seletor na tela.
       Ele é carregado em TODO boot (`if (first) weights.trailer = 150` lá em
       runApply), então isto não é uma aposta: é a mesma transferência, movida
       para o lado do assistente em vez de depois dele. São 31 MB contra alguns
       segundos a um minuto de escolha; no caso comum a barra do implemento já
       nasce cheia.
       DEPOIS dos manifestos e não antes: `assetUrl()` depende de configuração
       carregada, e disputar as duas vagas de MAX_IN_FLIGHT com os quatro
       manifestos atrasaria a única coisa que bloqueia o seletor de abrir. */
    models.prefetchTrailerAssets();

    initSelector();
    initLoader();
    initHud();
    /* A fase de catálogo acabou, e daqui em diante a tela pertence ao seletor ou
       à cortina — aposente o spinner de bootstrap para ele nunca ficar debaixo
       de nenhum dos dois. */
    $('loading').classList.add('hide');

    /* A página deve "começar num seletor", e começa — numa primeira visita. Um
       usuário de volta cuja escolha salva ainda é válida entra direto no
       estúdio: repicar os mesmos quatro cards a cada visita é atrito puro, e o
       "Trocar" do crachá está a um clique. É a troca deliberada. loadChoice()
       revalida os ids salvos contra o catálogo carregado agora, então uma
       escolha velha volta null e leva o usuário ao seletor em vez de a uma cena
       quebrada. */
    let choice: Choice | null = loadChoice();
    if (!choice) {
      choice = await openSelector({ cancellable: false });
      /* cancellable:false não resolve null num cancelamento do usuário, mas
         resolve SIM se outra coisa abrir o seletor primeiro e roubar a overlay.
         Nunca dê boot num talvez. */
      if (!choice) choice = defaultChoice();
    }

    await applyChoice(choice, { first: true });

    // handle de debug para ajuste pelo console — manter!
    window.__studio = {
      scene, camera, controls, renderer, THREE,
      models, livery, paint,
      lighting: sceneMod,
      catalog: catalogMod,
      selector,
      environment,
      loader,
      applyChoice,
      uniforms: paint._sharedPaint,
      /* O redimensionamento do baú, pela porta que costura livery e câmera —
         `models.setTrailerDims` cru deixaria a arte solta. O formulário vive
         fora do engine; isto é o que ele (e o console) chamam. */
      setTrailerDims,
      resetTrailerDims: () => setTrailerDims({
        height: models.state.trailerRig?.base.height ?? 0,
        length: models.state.trailerRig?.base.length ?? 0,
      }, { frame: true }),
      get trailerDims() { return models.getTrailerDims(); },
      get trailerRig() { return models.state.trailerRig; },
      /* As medidas e a representação 2D do painel. `describeStructure('left')`
         diz, camada por camada, o que está desenhado, em que caixa, e se a
         fonte é arte real ou placeholder; `registerLiveryArt('stripe',
         {kind:'svg', markup})` é o ponto de entrada dos SVGs que o cliente vai
         mandar — dá para provar o encaixe pelo console antes de existir
         qualquer interface para isso. Nada disto toca a textura do baú. */
      /* O aquecimento de assets. `stats()` responde a única pergunta que
         importa aqui — "a fila esvazia ANTES do último clique do seletor?" —, e
         a forma de perguntar é abrir o seletor, escolher devagar e olhar
         `pendentes`/`emVoo`. Se não zerarem, o gargalo é a rede, não a fila. */
      prefetch: { stats: prefetchStats, isWarm },
      measures: liveryStructure,
      cabGroup: models.state.cabGroup,
      trailerGroup: models.state.trailerGroup,
      get cab() { return models.state.cab; },
      get trailer() { return models.state.trailer; },
      get choice() { return currentChoice; },
      state: models.state,
    };

    /* Toda escolha POSTERIOR cai aqui — o "Trocar" do crachá, ou qualquer outra
       coisa que ui/selector.ts venha a ganhar. Registrado só AGORA de propósito:
       onChange dispara para toda seleção concluída, inclusive a de boot que
       openSelector() acabou de resolver, então enganchar antes rodaria a escolha
       de boot por este listener E pela aplicação {first:true} acima. O dedupe de
       applyChoice pegaria de qualquer jeito — isto é cinto e suspensório.
       (onChange devolve um cancelamento de inscrição; o engine vive a página
       inteira, então não há de que se desinscrever.) */
    selector.onChange((next: Choice) => { void applyChoice(next); });
  } catch (err: unknown) {
    console.error(err);
    $('load-text').textContent = 'Erro ao carregar: ' + errText(err);
    $('loading').classList.remove('hide');   // a mensagem precisa estar visível
  }
}

/**
 * Prende o estúdio a `host` e começa a renderizar. Seguro chamar de novo depois
 * de unmountStudio() — a essa altura os modelos já estão em memória.
 */
/* ---------------- o modo claro/escuro do host ----------------
   As telas de CARGA e de ERRO seguem o tema do app em volta; o resto da chrome
   (vidro sobre o render) não. Ver o bloco `--ts-screen-*` em core/studio.css,
   que explica por que o escopo é esse.

   O SINAL, em ordem: a classe `.dark` que o Ankaa põe na <html> (Tailwind
   `darkMode: ["class"]`) manda; sem ela, `prefers-color-scheme`. Escrito como um
   teste POSITIVO de claro porque o desktop não tem classe nenhuma e não pode
   cair em claro por omissão — lá quem decide é o sistema operacional. */
const lightQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-color-scheme: light)') : null;
let themeObserver: MutationObserver | null = null;

function applyHostTheme() {
  const html = document.documentElement;
  const light = html.classList.contains('light')
    || (!html.classList.contains('dark') && !!lightQuery?.matches);
  root.classList.toggle('ts-light', light);
}

/** Liga a observação do tema. Idempotente — mountStudio() pode rodar de novo. */
function watchHostTheme() {
  applyHostTheme();
  if (themeObserver) return;
  /* A classe da <html> muda sem evento nenhum quando o usuário aperta o toggle
     do Ankaa, e o estúdio pode estar montado nesse instante. `attributeFilter`
     mantém isto num único atributo de um único nó. */
  themeObserver = new MutationObserver(applyHostTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['class'],
  });
  lightQuery?.addEventListener('change', applyHostTheme);
}

export function mountStudio(host: HTMLElement): Promise<void> {
  /* PRIMEIRA COISA: uma volta cancela a liberação diferida. Trocar de aba e
     voltar em dez segundos não pode custar nada. */
  cancelRelease();
  watchHostTheme();
  /* Contraparte de teardownLivery(): reinstala os listeners globais da plotagem
     (keydown no `document`, resize na `window`). Idempotente, e seguro aqui —
     antes de initLivery(), porque o boot ainda pode não ter rodado. */
  livery.resumeLivery();
  host.appendChild(root);

  // O viewport também muda de tamanho sem um resize de janela (a sidebar do
  // Ankaa recolhendo, o chrome da página assentando no primeiro paint).
  observer = new ResizeObserver(resize);
  observer.observe(sceneMod.holder);
  resize();

  startLoop();
  if (!booted) { booted = boot(); return booted; }

  /* A ausência passou dos 60 s e o cenário foi devolvido à GPU. Reconstruir é o
     caminho normal de aplicação, sob a cortina: ela é o estado de carregamento
     honesto para "estou baixando o cenário de novo", e ela também refaz a sonda
     de reflexo, os crachás e o enquadramento — nada disso sobrevive ao descarte.
     A cabine e o implemento continuam em memória, então runApply() pula o
     download deles (ver `needCab`). */
  const again = releasedChoice;
  if (!again) return booted;
  releasedChoice = null;
  return applyChoice(again).then(() => undefined);
}

/** Para a renderização e solta o estúdio, mantendo modelos e contexto vivos.
 *  Deliberadamente NÃO faz hideLoader(): a cortina vive dentro de
 *  `root`, que é solto inteiro, e o download continua rodando através da troca
 *  de rota — desmontar a cortina aqui só revelaria uma cena pela metade quando o
 *  usuário voltasse no meio do carregamento. */
export function unmountStudio() {
  /* ANTES do stopLoop(), e descartando. Uma gravação em curso vive de quadros
     que o laço desenha; parar o laço primeiro a deixaria rodando o cronômetro
     sobre um canvas congelado até bater no teto — e então baixando um arquivo
     de vários segundos de imagem parada, na cara de uma tela que o usuário já
     trocou. O descarte é o que separa isso de "parar", que continua entregando
     o vídeo. Sem efeito quando não há gravação. */
  stopRecording(true);
  stopLoop();
  /* ANTES de soltar o `root`. O navegador sai de tela cheia sozinho quando o
     elemento em tela cheia deixa o documento, mas o quadro entre uma coisa e
     outra é a rota nova desenhada atrás de uma tela que ainda é da ferramenta
     anterior. Sair explicitamente elimina esse quadro. Não faz nada quando quem
     está em tela cheia não é o estúdio — ver a guarda em ui/chrome.ts. */
  exitFullscreen();
  observer?.disconnect();
  observer = null;
  /* Os dois observadores de tema saem junto com o resto: uma ferramenta que saiu
     da rota não tem por que continuar ouvindo a <html> do app inteiro. */
  themeObserver?.disconnect();
  themeObserver = null;
  lightQuery?.removeEventListener('change', applyHostTheme);
  sceneMod.flushSave();
  /* `disposePreviews()` sumiu daqui junto com ui/preview.ts: não existe mais um
     segundo contexto WebGL para descartar na saída da rota, e o cache das
     imagens dos cards passou a ser o cache HTTP do navegador — que não precisa
     de ninguém para administrá-lo. */
  /* Os dois listeners globais da plotagem saem junto. Eram guardados por
     isMounted() e portanto inofensivos, mas uma ferramenta 3D não tem por que
     manter captura no `document` do app inteiro depois de sair da rota. */
  livery.teardownLivery();
  root.remove();
  /* O resto do cenário sai só se a ausência durar — ver a seção de liberação
     diferida. */
  cancelRelease();
  releaseTimer = setTimeout(releaseScene, RELEASE_MS);
}
