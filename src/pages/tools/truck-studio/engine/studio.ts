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
         releaseProceduralEnvCache, getRenderStats,
         applyColdSpotPool, applyColdShadowType, suspendDraw } from './scene/scene';
import * as models from './vehicle/models';
import * as paint from './vehicle/paint';
import * as livery from './vehicle/livery';
import * as liveryStructure from './vehicle/livery-structure';
import * as catalogMod from './catalog/catalog';
import * as selector from './ui/selector';
import * as environment from './scene/environment';
import {
  qualityInfo, setQualityMode, qualityLevel, qualityMode, getProfile,
  coldPending, coldProfile, appliedColdProfile, markColdApplied,
  setAvailableVariants, renderScale, setRenderScale, scaleBand,
  setColdApplier, cancelPendingColdApply, onQualityChange,
  frameTimeEma, submitTimeEma,
} from './core/quality';
import * as merge from './vehicle/merge';
import * as landingGear from './vehicle/landing-gear';
import * as licensePlate from './vehicle/license-plate';
import * as geometryShare from './vehicle/geometry-share';
import { setShadowCasters } from './vehicle/material-setup';
import { ENVIRONMENTS_DIR } from './core/paths';
import * as captureMod from './scene/capture';
import * as cyclorama from './scene/cyclorama';
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
import { stopRecording, recordScene, canRecord, isRecording } from './scene/record';
import * as trim from './vehicle/trim';
import { loadLiveryArt } from './vehicle/livery-art';
import {
  initLoader, showLoader, setLoaderProgress, finishLoader, hideLoader,
  claimPill, paintFrame, withPill,
} from './ui/loader';
import { initHud, syncHud } from './ui/hud';
import { initWeather } from './scene/weather';
import { initUI, setStatus, setCaptureSubject, exitFullscreen } from './ui/chrome';
import * as timelineMod from './scene/timeline';
import * as outroMod from './scene/outro';
import { disposeOutro } from './scene/outro';
import { teardownTimeline } from './ui/timeline';
/* Ligado daqui e não de dentro de initUI(): ui/paint-panel importa setStatus de
   ui/chrome, então chrome chamar o painel fecharia um ciclo de import. O motor
   já carrega um ciclo de propósito (livery ↔ livery-editor, ver engine/index.ts)
   e um é o suficiente. */
import { initPaintPanel, setPaintPanelColor, closePaintPanel } from './ui/paint-panel';
import { initTrimPanel, refreshTrimPanel } from './ui/trim-panel';
import { initProjectPanel } from './ui/project-panel';
import { setStudioHooks } from './project/document';
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
  const base = t ? { ...choice, trim: t } : choice;
  return withMeasures(base);
};

/* AS MEDIDAS DO BAÚ ENTRAM EM TODA GRAVAÇÃO, pelo mesmo motivo do `trim` logo
   acima: elas não vêm do seletor, mudam a qualquer momento pelo editor, e sem
   isso viveriam só até o próximo F5.
   E aqui isso não é conveniência — é correção. A PLOTAGEM é persistida e as
   medidas não eram, então um F5 devolvia a arte de um baú de 15,4 m colada num
   baú de fábrica: *"continua perdendo a referência de tamanho, posição etc."*.
   Lidas de `getImplementMeasures()` NA HORA, nunca de uma cópia guardada aqui —
   é como as duas superfícies passariam a discordar.
   AUSENTE quando o baú está na medida de fábrica: gravar o padrão faria
   `sameRig()` enxergar diferença onde não há. */
function withMeasures(choice: Choice): Choice {
  const m = liveryStructure.getImplementMeasures();
  if (!m.resizable) return choice;
  const base = models.state.trailerRig?.base;
  const mudou = !base
    || Math.abs(m.height - base.height) > 1e-4
    || Math.abs(m.length - base.length) > 1e-4;
  const doors: NonNullable<Choice['measures']>['doors'] = {};
  let temPorta = false;
  for (const k of liveryStructure.STRUCTURE_KEYS) {
    const list = m.doors[k];
    if (list?.length) { doors[k] = list.map((d) => ({ ...d })); temPorta = true; }
  }
  if (!mudou && !temPorta) return choice;
  return {
    ...choice,
    measures: {
      height: m.height,
      length: m.length,
      ...(temPorta ? { doors } : {}),
    },
  };
}

/* Uma mudança de MEDIDA grava a escolha de novo — mesma assinatura que
   `onTrimChanged` usa para os acabamentos, e pelo mesmo motivo. */
liveryStructure.onMeasuresChanged(persistChoice);

/* Uma mudança de acabamento grava a escolha ATUAL de novo. Sem isto a cor do
   teto viveria só até o próximo F5 — e ela é uma decisão de produto, não um
   estado de sessão. Ver `onTrimChanged` em vehicle/trim.ts para por que a
   notificação vem por assinatura. */
trim.onTrimChanged(persistChoice);

/**
 * Grava a escolha corrente E ATUALIZA A CÓPIA EM MEMÓRIA.
 *
 * ⚠️ A SEGUNDA METADE É A CORREÇÃO, e a ausência dela era um defeito relatado:
 * *"navego e volto para a página, quase tudo está correto, só o Thermo King que
 * volta para a cor original"*.
 *
 * Os dois ouvintes acima faziam `saveChoice(withTrim(currentChoice))` — ou seja
 * escreviam o acabamento no `localStorage` e deixavam `currentChoice` como
 * estava, SEM `trim`. E é a cópia em memória que a saída de rota carrega:
 * `releaseScene()` faz `releasedChoice = currentChoice`, e a volta reaplica
 * ELA. Resultado: `trim.setTrimChoice(undefined)` no `runApply`, e a peça volta
 * de fábrica.
 *
 * POR QUE SÓ O THERMO KING APARECIA, e não as medidas: o implemento NÃO é
 * remontado na volta (só a cena é liberada), então a geometria redimensionada
 * simplesmente continua lá. O acabamento não tem essa sorte — ele é
 * ATIVAMENTE reescrito por `trim.setTrimChoice()`, e reescrever com vazio é o
 * que apaga. Estado que sobrevive por inércia esconde o defeito; estado que é
 * reaplicado o denuncia.
 *
 * `withTrim()` já embute as medidas (ver `withMeasures`), então uma função
 * cobre os dois ouvintes.
 */
function persistChoice() {
  if (!currentChoice) return;
  currentChoice = withTrim(currentChoice);
  saveChoice(currentChoice);
}

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
     desde 2026-08-13 ele está LIGADO — o que era uma dívida anotada virou o
     caminho normal. Esta era a terceira das lacunas que a nota de
     ON_DEMAND_RENDERING listava por nome: o atalho de só-cor pula o pipeline de
     carregamento de propósito, e com ele pula o warmUp() que invalida em todos
     os outros caminhos — a tinta trocaria de material sem trocar a imagem.
     Aqui e não em runColor() porque os DOIS caminhos passam por esta função. */
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

/* ===========================================================================
   A FUSÃO POR MATERIAL — a costura, que é o que mora aqui

   O motor da fusão está em `vehicle/merge.ts`; o QUE não pode ser fundido está
   com quem é dono de cada peça (`TRIM_MERGE_EXCLUSIONS` em `vehicle/trim.ts`,
   `PAINT_MERGE_EXCLUSIONS` em `vehicle/models.ts`). Este arquivo é o único que
   conhece os três ao mesmo tempo, e é essa a definição de raiz de composição.

   O QUE A FUSÃO DEVOLVE, MEDIDO (GARGALO-2026-08-15.md §2.1): 2 230 → 168
   chamadas no passe principal, quadro 14,9× mais rápido, **com os mesmos
   triângulos**. Não há qualidade trocada por velocidade: há trabalho
   desperdiçado sendo removido.

   ---------------------------------------------------------------------------
   O CAVALO NÃO ENTRA, E ISSO NÃO É CAUTELA — É ARITMÉTICA

   Os bakes de cabine trazem ~85 primitivas em ~85 materiais (§2.3 do GARGALO):
   fundir por material devolveria 85 baldes para 85 malhas, ou seja ZERO chamada
   poupada, ao preço de uma cópia inteira da geometria em memória. Todo o ganho
   vem do implemento, que traz 2 157 primitivas em 38 materiais. Deixar o cavalo
   fora custa nada e tira do caminho a rip FBX da Scania, o `headlight-cover`, os
   halos e os feixes de farol.

   ---------------------------------------------------------------------------
   QUANDO ELA RODA, E POR QUE NESTES TRÊS PONTOS SÓ

   1. no fim de `runApply()`, depois de TUDO que mexe em malha ou material —
      `placeTrailer()`, `refreshVehicleReflection()`, `applyColor()`,
      `trim.setTrimChoice()` — e antes do primeiro quadro, debaixo da cortina que
      já está de pé. É o instante em que a cena parou de se mexer;
   2. em volta de `models.setTrailerDims()`, por `setGeometryGuard()`: solta
      antes, refaz depois. `TrailerBody.rebuild()` regenera o corpo branco e
      `TrailerAssembly.set()` transforma a ferragem peça por peça — um balde de
      pé nesse instante seria medido como se fosse geometria de origem;
   3. SOLTA (e só solta) no topo de `runApply()`, quando há cabine nova —
      acrescentado em 2026-08-16, depois de o Thermo King sair do lugar a cada
      troca de cavalo. Quem refaz é o ponto 1, logo abaixo, então isto não é uma
      segunda fusão: é a mesma, adiada até depois da medição. Ver A FUSÃO SAI DE
      PÉ ANTES DA CABINE, no corpo de `runApply()`.

   ⚠️ ESTA LISTA ERA DE DOIS PONTOS E A APOSTA ESTAVA MAL ESCRITA. Ela dizia
   "não há um terceiro ponto" e nomeava um risco só — trocar `mesh.material` de
   uma malha fora das exclusões, que não aparece. O terceiro ponto existe porque
   **há um segundo risco, e é MEDIR**: `loadCab()` termina medindo a malharia do
   implemento (`placeThermoKing()` → `measureFrontRailUnderside()`), e um balde
   responde a essa pergunta com o número errado por 2,5 m — o defeito está
   medido em `checks-tk-troca-0816.mjs`. A regra completa é:

       com a fusão de pé, não se troca material NEM se mede peça.

   O primeiro risco continua valendo como estava: as duas listas de exclusão
   cobrem os donos que existem hoje (`setPaintTarget`, as quatro peças de
   `trim.ts`); um dono novo tem de entrar numa delas. O sintoma de esquecer está
   escrito no cabeçalho de `trim.ts`. Para o segundo, o cinto está em
   `measureFrontRailUnderside()`: ela recusa baldes e devolve `null`. */

/** O piso do baú em espaço LOCAL da raiz do implemento — o corte do modo `floor`.
 *
 * ⚠️ MEDIDO NA MALHA DO CORPO PARAMÉTRICO, e não em `profile.floorY`. Os dois
 * dizem a mesma coisa, e só um deles diz no referencial certo: `profile.floorY`
 * é a coordenada de MUNDO na pose de carga (`TrailerBody` mede por
 * `mesh.matrixWorld`), e no instante da fusão o implemento já foi engatado,
 * transladado e INCLINADO pelo engate. Dois graus sobre quinze metros movem a
 * ponta mais de trinta centímetros — mais que a saia inteira, que é a folga com
 * que o corte trabalha. A caixa da geometria do corpo, essa, é do referencial da
 * própria raiz e não sabe nada sobre a pose.
 */
function trailerFloorLocalY(): number | null {
  const body = models.state.trailerRig?.body.mesh;
  const g = body?.geometry as THREE.BufferGeometry | undefined;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox ? g.boundingBox.min.y : null;
}

/* ---------------- OS ESCOPOS DA FUSÃO ----------------
   Ver A FUSÃO POR ESCOPO em `vehicle/merge.ts`. Um escopo é um conjunto de nós
   que se funde ENTRE SI, num grupo próprio cujo NOME o dono da peça consegue
   casar com o matcher que ele já tem — e por isso ele preserva a unidade que o
   dono liga e desliga, em vez de exigir que a peça fique fora da fusão.

   O CRITÉRIO É UMA PERGUNTA SÓ, e ela é respondida por `trim.ts`, não aqui:

       a peça é uma UNIDADE DE VISIBILIDADE, e ela NUNCA troca de material?
       ou seja, em `TrimSpec`:  hideable && !paintable

   Hoje só a CAIXA DE COZINHA responde sim (`box.paintable` virou `false` em
   2026-08-13, quando o produto tirou a cor dela), e ela vale **80 → 6 chamadas**
   — 74 poupadas, 13,4 % do quadro. O teto é `paintable`, os paralamas são
   `paintable`, o Thermo King é `paintable`.

   ⚠️ ESTA LEITURA PERTENCE A `trim.ts` E ESTÁ AQUI DE PASSAGEM. O campo certo é
   um `scope?: boolean` em `TRIM_MERGE_EXCLUSIONS.nodes`, escrito por quem possui
   `SPECS` — ver o patch descrito para o dono daquele arquivo. Enquanto ele não
   existir, a decisão é tomada aqui pelo `label`, que é a única chave que as duas
   listas já compartilham.

   ⚠️ E ELA FALHA PARA O LADO SEGURO, de propósito: se o rótulo mudar em
   `trim.ts`, o `Set` deixa de casar, a caixa volta a ser uma EXCLUSÃO e o
   comportamento é o de antes desta funcionalidade — 74 chamadas a mais e mais
   nada. Um acoplamento por string que quebra devolvendo o estado anterior é
   aceitável; um que quebra desenhando errado não seria. */
/* ⚠️ O MAPA DE COMPATIBILIDADE FOI APAGADO (2026-08-16). Ele existia porque
   `TRIM_MERGE_EXCLUSIONS` ainda não tinha o campo `scope`, e a decisão precisava
   sair de algum lugar enquanto isso. Agora ela sai do DONO da peça — `trim.ts`
   declara `scope` ao lado da própria regexp, que é onde a invariante
   (`hideable && !paintable`) pode ser conferida por quem mexe nela. Ter os dois
   ao mesmo tempo era duas fontes de verdade para a mesma pergunta. */

/** A política da fusão, montada das três fontes que a possuem. */
function mergePolicy(): merge.MergePolicy | null {
  const root = models.state.trailer;
  if (!root) return null;
  /* Um escopo por exclusão de NÓ que DECLARE um. As que não declaram continuam
     sendo exclusões, exatamente como antes — o padrão é o comportamento
     conservador, e acrescentar um escopo é um ato explícito de quem é dono da
     peça, em `trim.ts`. */
  const scopes: merge.MergeScope[] = [];
  for (const e of trim.TRIM_MERGE_EXCLUSIONS.nodes) {
    if (e.scope) scopes.push({ re: e.re, motivo: e.label, nome: e.scope });
  }
  return {
    root,
    scopes,
    excludeRoots: [
      /* A UNIDADE INTEIRA do Thermo King, e não só a chapa dela: `trim.ts`
         esconde por `hideRoot` porque a peça tem CINCO malhas (chapa, decalques,
         logo, corpo e detalhe impresso) e casar por material tirava a carcaça
         deixando os decalques flutuando. Fundir as outras quatro reproduziria
         exatamente esse defeito, com o agravante de elas voltarem de dentro de um
         balde que ninguém consegue desligar. */
      { root: models.state.tk, motivo: 'trim: Thermo King' },
    ],
    excludeNodeRe: [
      ...trim.TRIM_MERGE_EXCLUSIONS.nodes,
      /* A PATOLA, e é a única exclusão desta lista que não é sobre COR nem sobre
         VISIBILIDADE: é sobre POSE. As duas pernas telescópicas descem 301 mm
         quando a vista é "só o implemento" (ver `vehicle/landing-gear.ts`), e um
         balde guarda os vértices ASSADOS na pose do instante da fusão — dentro
         de um balde de `metal-preto` que atravessa o implemento inteiro, mover
         um pedaço é impossível. Custa DUAS chamadas: o balde continua existindo
         com 575 membros em vez de 577. */
      ...landingGear.LANDING_GEAR_MERGE_EXCLUSIONS.nodes,
      /* A PLACA, pelo mesmo motivo da patola e com o mesmo preço. A do
         implemento anda o resize inteiro junto com o para-choque (o comprimento
         cresce para trás), e um balde a congelaria no comprimento antigo. As
         duas placas ficam de fora; ver `vehicle/license-plate.ts`. */
      ...licensePlate.LICENSE_PLATE_MERGE_EXCLUSIONS.nodes,
    ].map((e) => ({ re: e.re, motivo: e.label })),
    excludeMaterialRe: [
      ...trim.TRIM_MERGE_EXCLUSIONS.materials,
      ...models.PAINT_MERGE_EXCLUSIONS.materials,
    ].map((e) => ({ re: e.re, motivo: e.label })),
    excludeMeshRe: [
      ...trim.TRIM_MERGE_EXCLUSIONS.meshes,
      ...models.PAINT_MERGE_EXCLUSIONS.meshes,
    ].map((e) => ({ re: e.re, motivo: e.label })),
    floorY: trailerFloorLocalY(),
  };
}

/** Refaz a fusão no modo que o perfil pedir. Sem implemento em cena, não faz nada. */
function applyMergeNow(mode?: merge.MergeMode): merge.MergeInfo | null {
  const pol = mergePolicy();
  if (!pol) return null;
  const info = merge.applyMerge(pol, mode);
  /* O passe de sombra desenha outro CONJUNTO de objetos agora — os mesmos
     triângulos, em outras malhas. Com `shadowMap.autoUpdate = false` o mapa
     ficaria com o que as origens escreveram antes de sumirem. */
  invalidateShadows();
  invalidate();
  return info;
}

/* O par suspende/retoma que `models.setTrailerDims()` chama. Registrado no tempo
   de avaliação deste módulo, como as outras duas assinaturas logo abaixo — não
   há cena para reconstruir antes do primeiro `applyChoice()`, e `releaseMerge()`
   sem fusão de pé devolve 0 sem tocar em nada. */
models.setGeometryGuard(() => {
  const modo = merge.mergeMode();
  merge.releaseMerge();
  /* Refaz no MESMO modo em que estava, e não no que o perfil pede agora: se o
     usuário trocou de nível no meio do arrasto de medidas, quem manda nisso é o
     ouvinte de qualidade — refazer aqui pelo perfil faria as duas decisões
     correrem na mesma janela, e a última a escrever ganharia. */
  return () => { if (modo !== 'off') applyMergeNow(modo); };
});

/* ---------------- o nível mudou ----------------
   Duas coisas, e são independentes.

   1. `mergeVehicle` pode ter mudado de valor. A tabela de qualidade traz os três
      níveis em `all`, então na prática isto não dispara — mas o campo existe
      para poder ser desligado num diagnóstico, e um modo que só valesse no boot
      seria um botão que mente.

   2. `shadowCasterMinM` pode ter mudado, e aí o `castShadow` de TODA malha do
      veículo está velho — as fundidas e as de origem. `setShadowCasters()` é
      quem sabe reescrever as duas: nos baldes ele lê a BANDA
      (`userData.tsMergeBand`) e nas demais o diâmetro de mundo. **Nenhuma
      refusão acontece aqui**, e é para isso que a banda entra na chave do balde. */
onQualityChange(() => {
  const quer = merge.mergeModeFromProfile();
  if (quer !== merge.mergeMode()) {
    if (models.state.trailer) applyMergeNow(quer);
  }
  for (const raiz of [models.state.trailer, models.state.cab]) {
    if (raiz) setShadowCasters(raiz);
  }
  invalidateShadows();
});

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

/* E o MESMO desenho para o carregamento de projeto.
   ---------------------------------------------------------------------------
   `project/document.ts` sabe escrever todo o estado do estúdio, menos um: como
   se CARREGA um caminhão. Isso é `applyChoice()`, que resolve a escolha contra o
   catálogo, deduplica, enfileira e baixa cabine/implemento/cenário sob a
   cortina — reimplementar qualquer parte disso lá seria criar um segundo caminho
   de carga, e o segundo caminho é sempre o que fica sem as correções.

   Injetado em vez de importado pelo mesmo motivo do aplicador de medidas logo
   acima: a interface do projeto vive em `ui/`, `studio.ts` importa `ui/`, e uma
   seta de volta de `project/` para cá fecharia o ciclo. Feito na avaliação do
   módulo, portanto antes de qualquer boot — não existe janela em que o menu de
   projeto exista e o aplicador não.

   `{ curtain: true }` é o padrão e é o certo aqui: abrir um projeto de outro
   caminhão baixa centenas de megabytes, e a cortina é o estado de carregamento
   honesto para isso. */
setStudioHooks({
  applyChoice: (choice, opts) => applyChoice(choice, opts),
  /* A CORTINA, sob controle de quem carrega um PROJETO.
     Ela existe porque um projeto se monta em etapas que o `applyChoice` não
     conhece — medidas, plotagem, tinta, luz — e cada uma delas muda a imagem.
     Sem isto o usuário via o caminhão nu e depois a plotagem aparecendo por cima
     dele, que foi o relato: *"prefiro ter um loading até tudo estar correto —
     iluminação, cores, logos"*.
     `showCurtain` é para o caso em que `applyChoice` NÃO levanta cortina
     nenhuma: escolha idêntica cai no dedupe e volta na hora, e as etapas
     seguintes ainda precisam de cobertura. `showLoader()` é idempotente. */
  showCurtain: (label) => { showLoader(); if (label) setLoaderProgress(0, label); },
  setCurtainProgress: (p, label) => setLoaderProgress(p, label),
  /* `paintFrame()` de ui/loader.ts — ele já existe para deixar a cortina PINTAR
     um anúncio antes de um trabalho pesado, e a espera aqui é a mesma coisa
     vista do outro lado: deixar o quadro sair antes de decidir que acabou. */
  nextFrame: paintFrame,
  finishCurtain: async () => {
    try { await finishLoader({ flyToBadge: true }); }
    catch (e) { console.warn('[truck-studio] transição de saída falhou', e); hideLoader(); }
  },
  /* A RECEITA DA COR CORRENTE, reaplicada sem recarregar um byte.
     `applyColor()` é privado deste arquivo (ele fala com o painel de tinta, o
     crachá, o editor de arte e o `lastColor`), e é ele que traduz
     `PaintColorDef.effect` — a receita curada do banco — nos parâmetros do
     shader. Reimplementar isso do lado do projeto seria uma segunda tradução da
     mesma coisa, e a que não é exercitada todo dia é a que fica errada. */
  reapplyColor: () => {
    const r = currentChoice && resolveChoice(currentChoice);
    if (r) applyColor(r.color);
  },
  /* O SELETOR COMPLETO — cenário → montadora → modelo → chassi → cor.
     `cancellable: true` porque aqui existe um caminho de volta que no boot não
     existe: lá o estúdio não tem o que mostrar sem uma escolha, e aqui já há um
     caminhão em cena. Cancelar deixa o projeto zerado com o veículo atual.
     Nada é feito com o resultado de propósito — `selector.onChange` (registrado
     no fim de boot()) já leva toda seleção concluída para applyChoice(). Ver o
     docstring de `openPicker` em project/document.ts. */
  openPicker: () => selector.openSelector({ flow: 'full', cancellable: true }),
});

/* ---------------- O VÃO DE PORTA, COM CARREGAMENTO ----------------
   MEDIDO (`tools/studio-bench/checks-livery-registro.mjs`): um "+ Adicionar
   porta" prendia a thread principal por **2 932 ms**. O motivo está no
   cabeçalho de `models.setTrailerDoors()` e não é acidental — recortar um vão
   reescreve o corpo branco inteiro, então ele delega a `setTrailerDims({})`,
   que é a mesma sequência destrutiva de oito passos de um redimensionamento.

   O pedido é explícito: "prefiro que tenha um loading de carregamento de porta
   do que ele travar". Não dá para tornar o recorte barato sem reescrever a
   geometria paramétrica, e reescrevê-la não é o que se pediu. O que dá — e é o
   que muda a experiência — é fazer o trabalho ACONTECER DEPOIS DE O AVISO
   APARECER, e fazer tudo o que não depende dele acontecer ANTES:

     · a porta entra no desenho 2D no quadro do clique (`setDoorsFor` recompõe
       antes de chamar aqui);
     · o inspetor entra em estado ocupado e desabilita os controles de porta,
       porque um segundo clique durante o recorte enfileiraria outro;
     · o véu do viewport e a pílula sobem, para quem estiver fora do editor;
     · só então, num `setTimeout`, o recorte roda.

   COALESCE PELO MESMO MOTIVO DAS MEDIDAS: arrastar a largura de uma porta
   emite um commit por campo, e três recortes seguidos são nove segundos. O
   último pedido de cada face ganha; não há fila.

   POR QUE UMA JANELA CURTA (60 ms) e não os 260 ms das medidas: medida se
   digita, porta se clica. Um clique não tem valores intermediários a descartar,
   e 260 ms de espera depois de um clique são 260 ms em que o botão parece
   morto. Sessenta é o bastante para o navegador pintar o estado ocupado e para
   fundir os commits em rajada de um mesmo gesto. */
const DOORS_QUIET_MS = 60;
let doorsTimer: ReturnType<typeof setTimeout> | null = null;
const doorsPending = new Map<liveryStructure.DoorFaceKey, liveryStructure.DoorSpec[]>();
let doorsPill: { release(): void } | null = null;

function endDoorsBusy() {
  setViewportBusy(false);
  doorsPill?.release();
  doorsPill = null;
  liveryStructure.setGeometryBusy(false);
}

function flushTrailerDoors() {
  doorsTimer = null;
  const batch = [...doorsPending.entries()];
  doorsPending.clear();
  try {
    for (const [face, doors] of batch) models.setTrailerDoors(face, doors);
  } catch (e) {
    /* Um vão que a geometria recusa não pode deixar o inspetor desabilitado e
       o viewport embaçado para sempre — o usuário ficaria sem caminho de volta
       e sem saber por quê. */
    console.error('[truck-studio] falha ao recortar o vão de porta', e);
  } finally {
    endDoorsBusy();
  }
}

function applyTrailerDoorsDebounced(
  face: liveryStructure.DoorFaceKey, doors: liveryStructure.DoorSpec[],
) {
  doorsPending.set(face, doors);
  if (!doorsPill) {
    doorsPill = claimPill('Abrindo o vão no baú…');
    setViewportBusy(true);
    liveryStructure.setGeometryBusy(true);
  }
  if (doorsTimer) clearTimeout(doorsTimer);
  doorsTimer = setTimeout(flushTrailerDoors, DOORS_QUIET_MS);
}

liveryStructure.setDoorsApplier(applyTrailerDoorsDebounced);

async function runApply(
  resolved: ResolvedPick, first: boolean, curtain: boolean, keepCurtain = false,
) {
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

  /* Quantos baldes de fusão foram soltos para esta aplicação — fora do `try`
     porque o `catch` também o lê. Ver o bloco logo abaixo. */
  let soltou = 0;

  try {
    /* ---- A FUSÃO SAI DE PÉ ANTES DA CABINE, E ISSO É O TERCEIRO PONTO ----
       -----------------------------------------------------------------------
       O bloco A FUSÃO POR MATERIAL, acima, dizia "NÃO HÁ UM TERCEIRO PONTO" e
       listava só a mutação de material como risco. Faltava a outra metade, e
       ela custou um defeito: **o caminho da troca de cavalo MEDE a malharia do
       implemento com a fusão de pé.**

       `models.loadCab()` termina em `placeTrailer()` → `placeThermoKing()`, e
       essa última pergunta a altura da travessa da testeira a
       `measureFrontRailUnderside()`, que varre o implemento por peça e devolve
       a face de BAIXO da candidata mais alta. Com os baldes na cena ela deixa
       de ver peças: vê um balde por material, com os triângulos de todas elas
       juntos. O topo continua certo — é a mesma travessa —, mas a face de baixo
       vira o ponto mais baixo de TODA a ferragem da testeira.

       Medido na bancada (`checks-tk-troca-0816.mjs`), Scania R 2009 4x2:

           fusão solta     face de baixo 4093,9 mm   (peça, 344 vértices)
           fusão aplicada  face de baixo 1539,0 mm   (balde, 1920 vértices)
                                        −2554,9 mm

       O efeito na tela: o Thermo King caía de 38,0 mm abaixo do teto para
       719,9 mm, com a base parando exatamente no assoalho — a trava de piso de
       `placeThermoKing()` segurando a queda. E some ao recarregar a página,
       porque no boot `applyMergeNow()` só roda no FIM de `runApply()`: na
       carga não há fusão quando a unidade é assentada, na troca há.

       ISTO É O MESMO GUARDA DE `setTrailerDims()`, no caminho que faltava — e o
       cabeçalho de `setGeometryGuard()` em `vehicle/models.ts` já descrevia a
       falha com todas as letras: "um derivado que ainda estivesse de pé nesse
       instante seria MEDIDO COMO SE FOSSE GEOMETRIA DE ORIGEM".

       ⚠️ NÃO SE REFAZ AQUI, de propósito. `applyMergeNow()` já roda no fim
       desta mesma função (fase "Agrupando chamadas de desenho…"), depois de
       tudo que mexe em malha — refazer também aqui seria uma segunda fusão
       inteira por troca, 99 a 360 ms jogados fora. Soltar custa uma escrita de
       `.visible` em ~2 000 malhas e o download seguinte roda sob a cortina, que
       é onde ninguém está olhando o número de chamadas de desenho.

       Só quando há cabine nova: uma troca só de CENÁRIO não chama `loadCab()`,
       não mede nada do implemento, e soltar ali pagaria uma refusão por nada.

       O RETORNO É GUARDADO porque o caminho de ERRO precisa dele — e por isso
       `soltou` é declarado FORA do `try`, logo acima. O `catch` lá embaixo
       deixa a cena anterior de pé de propósito ("meio aplicada é pior do que
       velha") — e sem esta contagem ele a deixaria de pé SEM FUSÃO, com as
       ~2 000 chamadas de desenho de volta, até a próxima troca que desse certo.
       A imagem seria a mesma (é o contrato do portão de aceitação); o quadro é
       que ficaria 14,9× mais caro, em silêncio. */
    soltou = needCab ? merge.releaseMerge() : 0;

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

    /* ---- A FUSÃO POR MATERIAL ----
       AQUI, e o lugar é contrato. Depois de `setupCommon()` (que escreveu
       `tsWorldDiameter` e decidiu quem projeta sombra), depois de
       `extractDoorKit()` e `buildLiveryPanels()` (que guardam referências e
       recortam chapas), depois de `placeTrailer()` e `applyColor()` — ou seja,
       depois de a última coisa que mexe em malha ou material ter mexido. E ANTES
       de `warmLightPrograms()`, de propósito: quem compila é `renderer.compile()`,
       que percorre só o que está VISÍVEL. Fundir depois dele deixaria os baldes
       sem programa compilado e devolveria o engasgo do primeiro quadro que a
       cortina existe para pagar adiantado.

       ⚠️ `trim.setTrimChoice()` ainda roda LÁ EMBAIXO e troca material das quatro
       peças de acabamento. Isso é seguro porque as quatro estão na lista de
       exclusões (`TRIM_MERGE_EXCLUSIONS`) — se um dia não estiverem, a cor
       escolhida vai parar num material que nenhuma malha visível usa.

       Custa 99 ms (só o que está sob o piso) a 360 ms (tudo), UMA vez, com a
       cortina de pé — medido na bancada, §2.1 do GARGALO. */
    phase(0.30, 'Agrupando chamadas de desenho…');
    await paint();
    applyMergeNow();

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

    /* ---- TROCOU DE MARCA: a tinta do cavalo SAI do implemento ----
       Pedido do dono do produto: *"uma pintura da cor do cavalo quando aplicada
       deve sempre ser removida ao trocar a marca do cavalo — por exemplo estava
       com um scania, trocou para um volvo"*.

       E a razão é mecânica, não só de gosto: a paleta é POR MONTADORA
       (`PaintColorDef.manufacturer`), então trocar de marca troca
       obrigatoriamente a cor. O material do baú compartilha os uniformes da
       tinta, então ele SEGUIRIA a cor nova sem reclamar — e é justamente esse o
       problema: o baú mudaria de cor sozinho, por causa de uma decisão que o
       usuário tomou sobre OUTRO caminhão e que nada na tela liga a este.

       A MARCA e não o MODELO, que é o que foi pedido e é a granularidade certa:
       dentro de uma mesma montadora a cor sobrevive à troca de modelo, então a
       decisão continua fazendo sentido. Já entre marcas ela não tem como
       continuar significando o que significava.

       É a mesma doutrina de `livery.setSpecialEdition()`, que desliga esta mesma
       caixa ao entrar num cavalo sem tinta — e pelo mesmo motivo declarado lá:
       *"quem vem de um caminhão pintável com a caixa marcada trocaria de modelo
       e ficaria com o baú tingido, sem controle visível para desfazer"*.

       ANTES de `currentChoice = choice`, porque a comparação é contra a escolha
       ANTERIOR. E só quando havia uma: no primeiro carregamento da página não
       há marca de onde vir, e desligar ali jogaria fora o estado restaurado. */
    const prevManufacturer = currentChoice?.manufacturerId ?? null;
    if (prevManufacturer && prevManufacturer !== choice.manufacturerId
        && models.state.paintTarget === 'both') {
      livery.setImplementPainted(false, { echo: true });
      setStatus(`Marca trocada para ${manufacturer.name} — a tinta do cavalo saiu do implemento.`);
    }

    currentChoice = choice;
    /* Os acabamentos gravados entram na PEÇA que acabou de ser montada. Aqui e
       não antes: `setTrimChoice()` escreve material em malhas do implemento, e
       até esta linha o implemento pode ser o do caminhão anterior. */
    trim.setTrimChoice(choice.trim);
    /* E AS MEDIDAS GRAVADAS, aqui e não antes, pela mesma razão que o `trim`:
       até esta linha o implemento pode ser o do caminhão anterior.
       ANTES da plotagem assentar, e é isso que torna a restauração exata: o
       recorte redimensiona as chapas, `attachOverlays()` remede o painel e
       `syncSurfaceAspect()` põe a tela do fabric na proporção nova. A arte que
       chegar depois disso encontra a tela do tamanho em que foi autorada — e a
       que já tiver chegado é remapeada preservando o milímetro. Sem isto o F5
       devolvia arte de um baú de 15,4 m sobre um baú de fábrica.
       Um recorte só, com portas e medida juntas: `models.setTrailerDoors()`
       delega a `setTrailerDims()`, então encenar as portas antes e disparar uma
       vez é a diferença entre um recorte de ~3 s e quatro deles. */
    applySavedMeasures(choice.measures);
    /* E a escolha de VISTA (conjunto / só cavalo / só implemento) é reescrita
       nos grupos: a troca de caminhão acabou de repovoá-los, e um grupo novo
       nasce visível. Sem esta linha, quem estivesse olhando só o implemento
       veria o cavalo reaparecer com o controle ainda dizendo o contrário. */
    models.applyVehicleView();
    /* E o card se redesenha: as cores das peças acabaram de ser hidratadas e as
       duas metades do conjunto acabaram de existir — até esta linha o segmentado
       "Em cena" estava com as duas opções de metade desabilitadas, porque no
       boot não havia nem cavalo nem implemento para mostrar sozinhos. */
    refreshTrimPanel();
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
    /* `keepCurtain` ADIA a descida — não a cancela. Quem pediu assume o dever de
       chamar `finishLoader()` depois, e hoje o único que pede é o carregamento
       de PROJETO: ali a cena só está pronta várias etapas adiante (medidas,
       plotagem, tinta, luz), e descer a cortina aqui mostraria o caminhão nu
       enquanto a plotagem ainda está sendo montada por cima dele — que é
       exatamente o que foi relatado. Ver `applyProject()`. */
    if (curtain && !keepCurtain) {
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
    /* A FUSÃO VOLTA. Ela foi solta lá em cima para que `loadCab()` medisse a
       malharia de origem, e quem a refaz no caminho feliz é a fase "Agrupando
       chamadas de desenho…", que este erro pulou. Sem isto a cena antiga — que
       este `catch` existe para preservar — continuaria de pé pagando as ~2 000
       chamadas. Só se houve o que soltar: com o modo em `off` por perfil,
       `soltou` é 0 e nada aqui acontece. */
    if (soltou) applyMergeNow();
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
  opts: { first?: boolean; curtain?: boolean; keepCurtain?: boolean } = {},
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
    () => runApply(resolved, first, curtain, !!opts.keepCurtain),
  );
}

/**
 * Escreve as medidas gravadas no implemento recém-montado.
 *
 * Silencioso quando não há o que fazer: bake que não redimensiona, escolha sem
 * o campo (o caso comum — baú de fábrica sem porta), ou geometria ausente.
 * Nunca lança: uma medida que a geometria recuse não pode impedir o caminhão de
 * aparecer, e o `catch` de `runApply` está longe demais para dizer o que foi.
 */
function applySavedMeasures(m: Choice['measures']) {
  if (!m) return;
  const rig = models.state.trailerRig;
  if (!rig) return;
  try {
    /* As portas ENCENADAS primeiro — `stageDoors()` só enfileira. Só `left` e
       `right` chegam à geometria: a traseira já traz as folhas modeladas no
       bake, a testeira carrega o pino-rei e o teto não tem porta. É a mesma
       inclusão que `pushDoorsToGeometry()` faz, pelas mesmas razões. */
    for (const face of ['left', 'right'] as const) {
      const list = m.doors?.[face] ?? [];
      rig.stageDoors(face, list.map((d) => ({ ...d })));
    }
    const patch: { height?: number; length?: number } = {};
    if (m.height !== undefined) patch.height = m.height;
    if (m.length !== undefined) patch.length = m.length;
    models.setTrailerDims(patch);
    /* E as medidas voltam da GEOMETRIA para os campos do editor: a altura fecha
       um número inteiro de frisos, então o que o baú aceitou raramente é o que
       foi pedido. */
    liveryStructure.refreshFromTrailer();
  } catch (e) {
    console.warn('[truck-studio] medidas gravadas não puderam ser aplicadas —', e);
  }
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
    /* A vinheta de encerramento é um `<video>` de 1,5 MB com uma textura de
       1280 × 720 pendurada nele, e não tem por que sobreviver a um minuto fora
       da rota. Soltar também zera a promessa de carga, então a próxima gravação
       a busca de novo — e é assim que uma sessão aberta a noite inteira não
       guarda um vídeo decorativo que ninguém vai ver. */
    disposeOutro();
    console.info('[truck-studio] cenário liberado após', RELEASE_MS / 1000, 's fora da rota');
  } catch (e) {
    console.warn('[truck-studio] falha ao liberar o cenário', e);
  }
}

/* ---------------- A CORTINA PARA MUDANÇAS FRIAS ----------------
   O perfil de qualidade tem dois tipos de botão (ver `core/quality.ts`): os
   QUENTES, que `applyQualityProfile()` em scene.ts escreve na hora e o medidor
   pode mexer sozinho, e os FRIOS — `spotPool`, `shadowType`, `groundVariant`,
   `hdrVariant`, `antialias` —, que mudam um `#define`, uma chave de cache de
   programa ou uma URL de asset. Um botão frio trocado no meio de um arrasto é
   uma recompilação da cena inteira debaixo do polegar do usuário, que é
   exatamente o defeito que a adaptação automática existe para evitar.

   Então: o MEDIDOR nunca toca neles, `coldPending()` acusa a divergência, e a
   aplicação é um ATO — este. Ela reusa, tijolo por tijolo, a máquina que a
   liberação diferida já tinha: solta o cenário, zera `currentChoice` para o
   dedupe de `applyChoice()` não descartar a reconstrução como repetida, e
   reaplica a MESMA escolha pelo caminho normal, sob a cortina. Nenhum caminho
   novo de carga foi inventado, e é isso que faz esta função ser curta.

   O QUE CADA CAMPO CUSTA AQUI:
     spotPool      `applyColdSpotPool()` desapareia/reapareia as `SpotLight`.
                   Barato, mas move `NUM_SPOT_LIGHTS` — por isso vem ANTES da
                   reconstrução, para o `warmLightPrograms()` de dentro de
                   `runApply()` pré-compilar já o par novo.
     shadowType    `applyColdShadowType()` troca o `#define` e varre a cena
                   marcando material sujo. Caro, e por isso mesmo sob cortina.
     ground/hdr    saem de graça: `groundVariant()`/`hdrVariant()` são lidas no
                   MOMENTO da carga, e a carga é justamente o que vai acontecer.

   ⚠️ **`antialias` NÃO TEM COMO SER APLICADO, E ISTO NÃO É UMA OMISSÃO.** Ele é
   parâmetro de CONSTRUTOR do `WebGLRenderer`, que nasce no escopo de módulo de
   `scene.ts` — não existe, em toda a árvore, um `dispose()` ou um
   `forceContextLoss()`, e `controls`, `record.ts` e `capture.ts` guardam
   referência ao `renderer.domElement`. Recriar o renderer é uma refatoração
   grande e arriscada, e inventá-la aqui seria trocar um botão de qualidade por
   uma classe inteira de defeitos de ciclo de vida.

   Hoje isso não bloqueia nada: **os três níveis pedem `antialias: true`** (é uma
   conclusão medida — MSAA sombreia uma vez por PIXEL e esta cena é limitada por
   fragmento; ver `ColdProfile.antialias`). Se algum dia um nível pedir `false`,
   esta função avisa e recusa em vez de subir uma cortina que não mudaria nada. */

/** Uma aplicação fria em curso — reentrar sobreporia duas reconstruções. */
let coldApplying = false;

/** Os campos frios que ESTA função consegue aplicar sem contexto novo. */
function coldPendingApplicable(): boolean {
  const want = coldProfile(), got = appliedColdProfile();
  return want.spotPool !== got.spotPool
    || want.shadowType !== got.shadowType
    || want.groundVariant !== got.groundVariant
    || want.hdrVariant !== got.hdrVariant;
}

/**
 * Aplica a assinatura fria do nível vigente, reconstruindo a cena sob a cortina.
 *
 * @returns `true` se a cena foi reconstruída; `false` quando não havia nada
 *   pendente, quando o pendente é só `antialias` (que exige recarregar a página)
 *   ou quando não há escolha montada para reaplicar.
 */
export async function applyColdQuality(): Promise<boolean> {
  if (!coldPending()) return false;
  if (coldApplying) return false;

  if (!coldPendingApplicable()) {
    /* Sobra só o `antialias`. Recusar é a resposta honesta: uma cortina de
       segundos que devolve exatamente a mesma imagem é pior que uma frase. */
    console.warn('[truck-studio] a única diferença fria pendente é `antialias`,'
      + ' que é parâmetro de construtor do WebGLRenderer — recarregue a página'
      + ' para que ele valha.');
    setStatus('Qualidade: esta mudança exige recarregar a página');
    return false;
  }

  coldApplying = true;
  /* Um `release` armado no meio disto liberaria o cenário por baixo da
     reconstrução. */
  cancelRelease();
  try {
    /* A FILA PRIMEIRO. `releaseScene()` adia enquanto `queueDepth > 0` — e se
       ele adiar, nós seguiríamos em frente reconstruindo sobre uma cena que
       ninguém soltou. Esvaziar antes é o que faz o resto desta função poder ser
       linear. O laço tem teto porque `applyQueue` é reatribuída a cada
       `enqueue()`: esperar a fila de agora não impede alguém de empurrar outra
       coisa, e um `while (queueDepth)` sem teto seria uma espera sem fim se a
       interface estivesse despejando trabalho. */
    for (let i = 0; i < 4 && queueDepth > 0; i++) await applyQueue.catch(() => null);

    const base = currentChoice || releasedChoice;
    if (!base) {
      console.warn('[truck-studio] nada montado — não há o que reconstruir.');
      return false;
    }

    /* ---- A JANELA DESTRUTIVA ----
       Três instruções que deixam o grafo deliberadamente errado (luzes
       desapareadas, materiais marcados sujos, cenário descartado). Nenhum quadro
       pode ser apresentado no meio delas.

       O `release` sai LOGO DEPOIS de `applyChoice()` ser chamada, e não no fim:
       `applyChoice` → `enqueue` → `applyQueue.then(run)` agenda um MICROTASK, e
       `runApply()` chama `showLoader()` antes do primeiro `await` dele. Ou seja
       a cortina sobe antes de o navegador poder pintar qualquer coisa, e segurar
       `drawSuspended` além deste ponto só faria o quadro de aquecimento de
       `runApply()` (a fase "Renderizando o primeiro quadro…") não desenhar — que
       é justamente o engasgo que aquela fase existe para pagar adiantado. */
    const resume = suspendDraw();
    /* IIFE e não um `let` solto: com um `try/finally` no meio, o verificador de
       fluxo do TypeScript não consegue provar que a variável foi atribuída
       depois do bloco, e o `!` que calaria o erro é exatamente o tipo de
       silenciamento que esconde o caso em que ela de fato não foi. */
    const apply = (() => {
      try {
        applyColdSpotPool();
        applyColdShadowType();
        releaseScene();
        /* `releaseScene()` guardou a escolha em `releasedChoice` e zerou
           `currentChoice` — é isso que faz o dedupe de `applyChoice()` não
           descartar a reconstrução. Limpar `releasedChoice` aqui é o mesmo passo
           que `mountStudio()` dá: sem ele, uma saída de rota depois desta
           reconstrução tentaria reconstruir de novo. */
        const again = releasedChoice || base;
        releasedChoice = null;
        return applyChoice(again);
      } finally {
        resume();
      }
    })();

    const done = await apply;
    if (!done) {
      /* A cena ficou sem cenário e a linha de estado já carrega o erro. Não
         marcar o frio como aplicado é o que mantém `coldPending()` dizendo a
         verdade — o contexto NÃO tem a assinatura nova. */
      console.warn('[truck-studio] a reconstrução fria falhou; a qualidade fria segue pendente.');
      return false;
    }
    /* SÓ AQUI, e só quem reconstruiu chama. Ver `markColdApplied()`. */
    markColdApplied();
    console.info('[truck-studio] qualidade fria aplicada:', appliedColdProfile());
    return true;
  } finally {
    coldApplying = false;
  }
}

/* ---------------- AS VARIANTES DE TEXTURA QUE O SERVIDOR DECLARA ----------
   `coldProfile()` só emite `@ktx2`/`@1k` quando o MANIFESTO diz que os arquivos
   existem — ver o bloco VARIANTES DE ASSET em `core/quality.ts`. A alternativa
   (pedir e degradar no 404) custaria 16 requisições perdidas por boot enquanto
   o deploy não chega e, pior, esconderia um deploy pela metade.

   ⚠️ LIDO AQUI, E NÃO EM `catalog.ts`, e a razão é de escopo desta rodada, não
   de projeto: `normalizeEnvironment()` valida a LISTA de cenários e descarta as
   chaves de RAIZ do arquivo, e `textureVariants` é chave de raiz. O lugar certo
   é `loadEnvironments()` devolver o bloco cru junto com a lista; enquanto isso
   não acontece, esta função relê o mesmo arquivo com `cache: 'force-cache'` —
   `fetchJSON()` acabou de buscá-lo com `no-cache`, ou seja de revalidá-lo, então
   esta segunda leitura sai do cache do navegador e não é uma segunda viagem à
   rede.

   ⚠️ E HÁ UM SEGUNDO DECLARANTE: `declararVariantes()` em `scene/environment.ts`
   lê `set.textureVariants` a cada troca de cenário, pelo mesmo motivo (não
   alcançava a raiz). Os dois compõem porque este roda UMA vez, no boot, antes de
   qualquer cenário — e porque aquele, de propósito, não limpa a lista quando a
   chave está ausente. Se algum dia os dois discordarem, o de lá ganha por ser o
   último a escrever, e a saída é a mesma para os dois: `catalog.ts` repassar a
   raiz e as duas funções morrerem juntas.

   NUNCA LANÇA E NUNCA BLOQUEIA UMA DECISÃO: sem o arquivo, sem a chave ou com a
   chave malformada, o padrão vazio significa "só os arquivos de sempre", que é o
   comportamento de antes desta linha existir. */
async function loadTextureVariants(): Promise<void> {
  try {
    const r = await fetch(assetUrl(ENVIRONMENTS_DIR + 'environments.json'),
      { cache: 'force-cache' });
    if (!r.ok) return;
    const j = await r.json() as { textureVariants?: unknown };
    if (Array.isArray(j?.textureVariants)) {
      setAvailableVariants(j.textureVariants.filter((s): s is string => typeof s === 'string'));
    }
  } catch (e) {
    console.info('[truck-studio] sem `textureVariants` no manifesto —'
      + ' as texturas de sempre.', errText(e));
  }
}

async function boot() {
  try {
    livery.initLivery();
    initWeather();
    initUI();
    initPaintPanel();
    initTrimPanel();
    /* Pelo MESMO motivo de initPaintPanel() logo acima: ui/project-panel importa
       setStatus, makePopover e o cadeado de captura de ui/chrome, então chrome
       chamá-lo fecharia um segundo ciclo de import. */
    initProjectPanel();
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
    /* DEPOIS do catálogo (o arquivo já está no cache do navegador) e ANTES de
       qualquer carga de cenário: `groundVariant()`/`hdrVariant()` são lidas no
       momento em que a URL do mapa é montada, então declarar as variantes
       depois disso deixaria o primeiro cenário baixando os arquivos de sempre e
       os seguintes baixando os comprimidos — meio deploy, que é exatamente o
       estado que o manifesto existe para tornar impossível. */
    await loadTextureVariants();
    /* O card de configurações foi montado ANTES de existir cavalo ou implemento
       em cena, então o segmentado "Em cena" saiu com as duas opções de metade
       desabilitadas. Repintar aqui é o mesmo padrão que o seletor usa, e custa
       uma varredura de três seções. */
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
    /* A PORTA EXPLÍCITA do botão "Aplicar" da qualidade fria. `ui/hud.ts` tem uma
       rede de segurança que vai buscar `window.__studio.quality.applyCold`, mas o
       handle de console só é instalado no FIM do boot — depois do primeiro
       `applyChoice`, que é uma cortina inteira. Registrar aqui fecha essa janela,
       e a inversão de dependência é o que impede o ciclo: `ui/hud.ts` é importado
       POR este arquivo, então quem entrega a função é quem já está de pé.

       ⚠️ EMBRULHADA e não passada crua: o contrato de lá é
       `() => void | Promise<void>` e esta devolve `Promise<boolean>` — e
       `Promise<boolean>` NÃO é atribuível a `Promise<void>` (a regra de
       "retorno void aceita qualquer coisa" do TypeScript só vale quando o
       retorno alvo é exatamente `void`, não uma união que o contém). O `await`
       aqui é o que mantém o botão podendo esperar a cortina descer. */
    /* O HUD não aplica mais a parte fria — ver o bloco MUDANÇA FRIA A CAMINHO
       em `ui/hud.ts`. `applyColdQuality()` continua publicado em
       `window.__studio`, que é por onde o console e a bancada a alcançam. */
    /* E O MESMO CAMINHO, DISPARADO POR ATO DO USUÁRIO — ver `setColdApplier()`
       em core/quality.ts para o porquê e para os números.

       Sem isto, escolher "Média" aplicava só os botões quentes e deixava o pool
       de refletores onde estava: medido na bancada, o pool sozinho vale 2,4×.
       O botão do painel continua existindo para o caminho manual; este gatilho é
       o que faz o caso comum (clicar num nível) fazer o que o nível promete.

       ⚠️ O REGISTRO É AQUI, e não no topo do módulo, de propósito: só existe
       cena para reconstruir depois de `initHud()`/`applyChoice`, e um gatilho
       armado antes disso encontraria `currentChoice` nulo. */
    setColdApplier(() => applyColdQuality());
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
      /* A SALA DE ESTÚDIO, para ajuste pelo console e para a bancada.
         O que se mexe daqui na prática é `setFloorReflection(false)` — a
         segunda passada de renderização do piso polido é o único item caro
         do cenário, e é assim que se mede o que ele custa. */
      cyclorama,
      loader,
      /* O PERFIL DE QUALIDADE, pelo console e pela bancada.
         `quality.info()` responde as três perguntas de uma vez — que hardware a
         sonda viu, em que nível a cena está e quantos ms o medidor mediu — e é
         por onde se diagnostica "por que a imagem piorou sozinha".
         `quality.set('alta')` congela; `quality.set('auto')` devolve ao
         medidor. */
      /* A CAPTURA, pelo console e pela bancada. É por aqui que se prova a regra
         de que a imagem baixada sai no teto mesmo com a vista no piso — ver
         `tools/studio-bench/checks-qualidade.mjs`. */
      capture: captureMod,
      /* O GRAVADOR, pelo console e pela bancada.
         Ele passou a montar o arquivo à mão (WebCodecs + mediabunny, quadro a
         quadro, com carimbo próprio) e isso criou três formas NOVAS de errar em
         silêncio: vídeo preto (o canvas só é legível na mesma tarefa síncrona do
         render), carimbo com fator de 10⁶ trocado, e emenda de laço com salto de
         zoom. ⚠️ Nenhuma das três aparece na interface — todas produzem um
         arquivo que ABRE. `tools/studio-bench/checks-gravacao.mjs` é o portão
         das três, e sem este afordance ele não tem por onde entrar. */
      record: { recordScene, stopRecording, canRecord, isRecording },
      /* O CRIADOR DE VÍDEO, pelo console e pela bancada.
         Ele é o modo `percurso` do gravador, e a coisa que precisa de afordance
         é a CURVA: `buildTimelinePath()` devolve `place(t)`, então dá para
         amostrar o percurso inteiro sem gravar nada e conferir as duas
         propriedades que o cabeçalho de `scene/timeline.ts` promete — que
         nenhum instante intermediário sai do intervalo das chaves (a
         monotonicidade da PCHIP) e que o azimute pega sempre o arco menor. As
         duas produzem vídeo errado em silêncio se quebrarem: a primeira põe a
         câmera dentro da carroceria, a segunda dá uma volta inteira ao
         contrário — e nenhuma das duas aparece antes de alguém assistir. */
      timeline: timelineMod,
      /* A VINHETA DE ENCERRAMENTO, para a bancada. Ela substituiu a marca
         d'água em 2026-08-16, e o que precisa ser conferido mudou junto: não é
         mais "a bandeira foi solta?" e sim se o fecho de fato ENTROU no arquivo
         e se a emenda com a cena é uma dissolvência e não um corte. */
      outro: outroMod,
      /* O handle acompanha o que o perfil GANHOU nesta rodada, e isso não é
         cosmética: é a bancada (`tools/studio-bench/checks-qualidade.mjs`) que
         lê daqui, e um afordance que não alcança o botão dominante deixa de
         medir o botão dominante.
           `renderScale`/`setRenderScale`/`scaleBand` — a escala de render, que é
             o multiplicador que o custo de preenchimento segue ao QUADRADO. Era
             o único jeito de medir "quanto disto é resolução".
           ⚠️ **PARA DIAGNOSTICAR, PREFIRA `stats().frameSplit` AOS DOIS ABAIXO.**
             Os dois canais dizem que a parede é maior que a submissão e não
             dizem QUEM consome a diferença — e as duas leituras possíveis (CPU
             do laço × espera de placa/vsync) pedem consertos OPOSTOS. O
             `frameSplit` reparte a parede em `fora` (navegador, compositor,
             vsync, swap), `laco` (a CPU do nosso laço), `ganchos` (os
             `drawHooks`, onde mora o reflexo do piso) e `submissao`. Ver
             A PAREDE, REPARTIDA EM QUATRO em `scene/scene.ts`.
           `frameTimeEma`/`submitTimeEma` — os dois canais do medidor. Próximos
             um do outro = limitado por GPU/submissão; parede muito maior =
             limitado por CPU fora do `render()` ou por espera de vsync, e aí
             baixar resolução não devolve nada.
           `coldPending`/`applyCold` — a assinatura fria pendente e o ato de
             aplicá-la. Ver `applyColdQuality()`.
           `stats` — `renderer.info` já ordenado (chamadas, triângulos,
             programas). Era alcançável só por `renderer.info` cru. */
      quality: {
        info: qualityInfo,
        set: setQualityMode,
        get level() { return qualityLevel(); },
        get mode() { return qualityMode(); },
        profile: getProfile,
        cold: coldProfile,
        appliedCold: appliedColdProfile,
        get renderScale() { return renderScale(); },
        setRenderScale,
        scaleBand,
        get frameTimeEma() { return frameTimeEma(); },
        get submitTimeEma() { return submitTimeEma(); },
        get coldPending() { return coldPending(); },
        applyCold: applyColdQuality,
        stats: getRenderStats,
      },
      /* A FUSÃO POR MATERIAL, pelo console e pela bancada — e a bancada JÁ
         PROCURA por aqui: `tools/studio-bench/checks-aceitacao.mjs` lê
         `S.merge` e chama `S.merge.info?.()`, e reporta "AUSENTE" se não achar.

         `info()` responde as cinco perguntas de uma vez: em que modo está,
         quantas malhas de origem entraram, em quantos baldes, quantas chamadas
         isso poupou e quantos milissegundos custou construir — mais o motivo de
         cada exclusão, por DONO, que é o que se lê quando a conta não fecha
         ("por que 1 100 malhas ficaram de fora?" tem resposta nominal).

         `apply()` / `release()` existem para o portão de aceitação, que é uma
         comparação PIXEL A PIXEL do render antes e depois na mesma pose: sem os
         dois no mesmo processo não há "antes" para comparar. O ciclo
         aplica→solta→aplica é idempotente de propósito (`applyMerge()` começa
         soltando), então a bancada pode alternar quantas vezes quiser. */
      merge: {
        info: merge.mergeInfo,
        apply: (mode?: merge.MergeMode) => applyMergeNow(mode),
        /* O caminho CURTO da sombra: reescreve `castShadow` nos 45 baldes a
           partir da banda, sem tocar nas ~2 000 origens e sem refundir. O
           caminho longo (`setShadowCasters()` na raiz inteira) é o que roda na
           troca de nível, porque lá as origens também envelhecem; este é para
           quem estiver medindo o corte de sombra do console e não quiser pagar
           a varredura de 5 852 nós a cada tentativa. */
        refreshShadow: (minM?: number) => {
          const n = merge.refreshMergedShadowCasters(minM);
          invalidateShadows();
          return n;
        },
        release: () => {
          const n = merge.releaseMerge();
          invalidateShadows();
          invalidate();
          return n;
        },
      },
      /* A PATOLA, pela bancada. `info()` responde as três perguntas que a trava
         de aceitação faz — ela foi reconhecida?, está descida?, qual é o curso?
         — e `down()` exercita o ciclo sem depender do card de vista, que é
         interface. Ver `tools/studio-bench/checks-patola-0816.mjs`. */
      patola: {
        info: landingGear.landingGearInfo,
        down: landingGear.setLandingGearDown,
      },
      /* A PLACA, pela bancada. `info()` responde as quatro perguntas do portão
         de aceitação de uma vez — o manifesto chegou?, a placa do cavalo entrou
         e em que sítio?, a do implemento achou o para-choque?, e a arte
         decodificou? A última é a que separa "a peça está lá" de "a peça está
         lá com a placa desenhada nela", e ela só existe DEPOIS que a textura
         volta do servidor. Ver `tools/studio-bench/checks-placa-0816.mjs`. */
      placa: {
        info: licensePlate.licensePlateInfo,
        sitio: licensePlate.plateSiteFor,
      },
      /* AS QUATRO PEÇAS, pelo console e pela bancada.
         ---------------------------------------------------------------------
         Publicado por causa da FUSÃO POR ESCOPO: a caixa de cozinha agora se
         funde consigo mesma, e o portão de aceitação dela não é uma comparação
         de pixel e sim QUATRO — fundida/solta × mostrada/escondida (ver
         `tools/studio-bench/checks-fusao-escopo.mjs`). Sem uma porta para ligar
         e desligar a peça no mesmo processo, o ciclo que o casulo existe para
         sustentar não tem como ser exercido, e o defeito que ele previne — as
         origens reacendendo por cima dos baldes — passaria despercebido.
         `setTrim()` e não `setTrimChoice()`: o primeiro mexe numa peça e refaz o
         alvo da tinta, que é o caminho que o card de Configurações usa. */
      trim: {
        get: trim.getTrim,
        set: trim.setTrim,
        keys: trim.TRIM_KEYS,
      },
      /* POSSE DE GEOMETRIA — o par de leituras que diz com qual ACERVO a sessão
         está falando, e o que o redimensionamento cobrou por ele.
         `shareStats(raiz)`: quantas malhas dividem uma `BufferGeometry`. Com o
         `trailer.glb` cru a maior família é 1; com o acervo deduplicado por
         `tools/studio-assets/dedup-cargas.mjs` ela chega a 104. É a única forma
         de uma bancada saber qual arquivo foi servido sem ler o arquivo.
         `claimStats()`: quantos clones o clone-na-escrita fez — o preço, em
         cópias de buffer intercalado, de manter o compartilhamento correto.
         Ver `vehicle/geometry-share.ts` e
         `tools/studio-bench/checks-geometria-partilhada.mjs`. */
      geometria: {
        shareStats: geometryShare.shareStats,
        claimStats: geometryShare.claimStats,
      },
      /* Também no topo, porque a pergunta "quantas chamadas de desenho custa
         isto?" é anterior a qualquer nível de qualidade — ela é o número de que
         toda decisão de scene.ts é argumentada, e até aqui só `renderer.info`
         cru a alcançava. */
      getRenderStats,
      /* TAMBÉM NO TOPO, e não só em `quality.applyCold`: `ui/hud.ts` procura a
         porta nesta ordem — `__studio.applyColdQuality`, depois
         `__studio.quality.applyCold`, depois `__studio.quality.applyColdQuality`.
         Publicar as duas primeiras custa uma referência e tira do caminho a
         classe de defeito em que o botão "Aplicar" da interface não encontra a
         função e não faz nada, em silêncio. */
      applyColdQuality,
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
  /* ⚠️ DEPOIS do descarte da gravação e ANTES do `stopLoop()`. O DOM do criador
     sai sozinho — ele mora dentro de `root`, que é solto inteiro logo abaixo —,
     mas o que ele segurava na CENA não sai: o desvio das construções suspenso e
     a LENTE, que pode estar numa teleobjetiva de 13°. Sem esta linha, sair da
     rota com o criador aberto devolveria o estúdio na próxima visita com o
     enquadramento errado e sem correção de desvio, e nada na interface teria
     como explicar por quê. */
  teardownTimeline();
  /* Uma aplicação fria agendada e não disparada reconstruiria a cena depois de
     a rota já ter trocado — cortina no ar sobre uma tela que ninguém está
     vendo, e trabalho de GPU pago por nada. */
  cancelPendingColdApply();
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
