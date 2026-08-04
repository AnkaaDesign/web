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
   boot() carrega o catálogo, um seletor de QUATRO passos (cenário → fabricante →
   modelo → cor) decide o que construir, e uma cortina de carregamento cobre o
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
import * as catalogMod from './catalog/catalog';
import * as selector from './ui/selector';
import * as environment from './scene/environment';
import * as loader from './ui/loader';
import {
  loadCatalog, loadChoice, saveChoice, defaultChoice,
  getEnvironment, getModel, assetUrl,
} from './catalog/catalog';
import {
  initSelector, openSelector, setBadge, showBadge, setMapBadge, showMapBadge,
  setColorBadge, showColorBadge,
} from './ui/selector';
import { disposePreviews, prewarmCabPreviews, hasCabPreview } from './ui/preview';
import { loadColors, getColor, defaultColor, colorsFor, FINISH_LABEL } from './catalog/colors';
import type { PaintColorDef } from './catalog/colors';
import { applyEnvironment, getCurrentEnvironment, disposeEnvironments } from './scene/environment';
import { disposeReflectionProbe } from './scene/probe';
import {
  initLoader, showLoader, setLoaderProgress, finishLoader, hideLoader,
} from './ui/loader';
import { initHud, syncHud } from './ui/hud';
import { initWeather } from './scene/weather';
import { initUI, setStatus } from './ui/chrome';
import { root, $ } from './core/dom';
import type { Choice, EnvironmentDef, ManufacturerDef, ModelDef } from './catalog/catalog';
import type { CabDef } from './vehicle/models';

/** Uma escolha resolvida contra o catálogo: as entradas concretas que ela nomeia. */
interface ResolvedPick {
  choice: Choice;
  env: EnvironmentDef;
  model: ModelDef;
  manufacturer: ManufacturerDef;
  color: PaintColorDef;
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
   BAIXADO. A cor de propósito não entra: ela não custa um byte de rede. */
const sameRig = (a: Choice | null, b: Choice | null) =>
  !!a && !!b && a.envId === b.envId && a.modelId === b.modelId;

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

/* ---------------- a pílula de estado (#cab-switching) ----------------
   UM elemento, mais de um dono possível, e é por isso que ninguém escreve nele
   direto. Dois trechos deste arquivo querem a pílula:

     1. uma escolha que ENTROU NA FILA atrás de outra — trocar de cor durante um
        carregamento é o caso comum, e sem aviso o card acende, o caminhão não
        muda e a tinta só aparece alguns segundos depois, sozinha;
     2. uma aplicação com `curtain: false`, que é o afordance de console
        descrito em applyChoice().

   As duas podem estar vivas ao mesmo tempo (uma cor enfileirada atrás de um
   carregamento sem cortina), então as reivindicações formam uma PILHA e quem
   aparece é a MAIS ANTIGA: a pílula descreve o que está acontecendo agora, não
   o que está esperando a vez. */
interface PillClaim { text: string }
const pillClaims: PillClaim[] = [];

function drawPill() {
  const showing = pillClaims[0];
  if (!showing) { $('cab-switching').classList.add('hidden'); return; }
  $('cab-switching-text').textContent = showing.text;
  $('cab-switching').classList.remove('hidden');
}

/** Reivindica a pílula. `release()` é idempotente — pode ser chamado duas vezes. */
function claimPill(text: string) {
  const claim: PillClaim = { text };
  pillClaims.push(claim);
  drawPill();
  return {
    set(next: string) { claim.text = next; drawPill(); },
    release() {
      const i = pillClaims.indexOf(claim);
      if (i >= 0) pillClaims.splice(i, 1);
      drawPill();
    },
  };
}

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
  return {
    choice: {
      envId: env.id,
      manufacturerId: found.manufacturer.id,
      modelId: found.model.id,
      colorId: color.id,
    },
    env,
    model: found.model,
    manufacturer: found.manufacturer,
    color,
  };
}

/* A tinta do cavalo, a partir da cor escolhida. UMA chamada e não duas: dentro
   de setPaint() a troca de acabamento reescreve os parâmetros específicos da
   família (flocos, flop, mica) para os defaults dela, e a cor base tem de ser
   aplicada DEPOIS disso, senão a segunda chamada apagaria a primeira.
   Roda em toda aplicação, inclusive quando a cor não mudou: uma troca de cabine
   cria materiais NOVOS, e eles precisam ser dirigidos outra vez. */
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
  /* O editor de arte mostra a chapa do painel ATRÁS do desenho, e ela é branca
     ou é esta tinta, conforme o "pintar o implemento". Quem sabe qual é a tinta
     é aqui; quem sabe se ela vale para o baú é o livery. */
  livery.setCabPaintColor(color.hex);
  setColorBadge({
    colorName: color.name,
    hex: color.hex,
    finishLabel: FINISH_LABEL[color.finish],
  });
  showColorBadge(true);
  /* O laço sujo (scene.ts) só desenha quando alguém diz que a imagem mudou, e
     esta é uma das três lacunas que a nota de ON_DEMAND_RENDERING lista por
     nome: o atalho de só-cor pula o pipeline de carregamento de propósito, e com
     ele pula o warmUp() que invalida em todos os outros caminhos — a tinta
     trocaria de material sem trocar a imagem. Aqui e não em runColor() porque os
     DOIS caminhos passam por esta função. */
  invalidate();
}

/* brands.json e cabs.json são manifestos separados, então o catálogo pode
   oferecer um modelo cuja cabine 3D nunca foi exportada. Ficar de pé numa cabine
   disponível mantém o estúdio usável — um viewport morto no primeiro boot é bem
   pior do que uma geometria provisória, e a linha de estado diz que é isso. */
function resolveCabId(model: ModelDef): { id: string; exact: boolean } {
  const wanted = models.state.byId[model.cab];
  if (wanted && wanted.available) return { id: wanted.id, exact: true };
  const alt: CabDef | undefined = models.state.cabs.find((c) => c.available) || models.state.cabs[0];
  return alt ? { id: alt.id, exact: false } : { id: model.cab, exact: true };
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

async function runApply(resolved: ResolvedPick, first: boolean, curtain: boolean) {
  const { choice, env, model, manufacturer, color } = resolved;
  const current = getCurrentEnvironment();
  /* Reaplicar o MESMO cenário não baixaria nada, mas ainda assim zeraria o
     preset de luz, a hora do dia e a exposição — jogando fora o que o usuário
     ajustou na sidebar só porque trocou de cabine. */
  const needEnv = first || !current || current.id !== env.id;
  const cab = resolveCabId(model);
  /* A cabine que já está montada NÃO é remontada. Vale para duas rotas reais:
     a troca só de CENÁRIO (o fluxo parcial do card do topo, em que o modelo não
     muda) e a reconstrução depois da liberação diferida lá embaixo — as duas
     baixavam e reparseavam megabytes de cabine para pôr no lugar exatamente a
     mesma geometria. `state.cabId` é escrito por loadCab() e é null antes do
     primeiro, então o boot sempre carrega. */
  const needCab = first || models.state.cabId !== cab.id;

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
    const modelChanged = !currentChoice || currentChoice.modelId !== choice.modelId;
    showLoader({
      subject: modelChanged ? 'truck' : 'map',
      modelName: model.name,
      modelSubtitle: model.subtitle,
      modelImage: assetUrl(model.image),
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
    if (needCab) tasks.push(models.loadCab(cab.id, progress.track('cab')));
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
    const paint = () => new Promise<void>(r => requestAnimationFrame(() => r()));

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

    phase(0.4, 'Compilando materiais…');
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

    /* E as miniaturas do passo de cor, pelo mesmo motivo e no mesmo lugar: elas
       renderizavam ao abrir o seletor, que é onde o usuário NÃO está esperando.
       Aguardado de propósito — o custo vai para a barra de progresso. */
    phase(0.6, 'Gerando miniaturas de cor…');
    await paint();
    /* Só as tintas DESTA montadora. Cada cor custa um render offscreen aqui
       dentro da cortina, e o catálogo tem 522 linhas: aquecer todas seriam
       minutos de espera para mostrar tinta que este caminhão nunca vai receber.
       A maior paleta de montadora hoje tem 26 cores. */
    await prewarmCabPreviews(cab.id, colorsFor(choice.manufacturerId),
      f => phase(0.6 + 0.3 * f, 'Gerando miniaturas de cor…'));

    /* ui/selector.ts já preenche os dois crachás a partir do catálogo antes de
       disparar os listeners, mas dois caminhos nunca passam pelo seletor — o
       afordance de console e um visitante de volta cuja escolha salva pula a
       overlay inteira — então este é o único lugar garantido. Tem de acontecer
       ANTES de finishLoader(), que voa a foto da cortina para um crachá que já
       precisa estar visível. */
    setBadge({
      modelName: model.name,
      modelSubtitle: model.subtitle,
      modelImage: assetUrl(model.image),
      manufacturerName: manufacturer.name,
      logo: assetUrl(manufacturer.logo),
      /* A MESMA miniatura 3D dos cards, e por isso de graça: prewarmCabPreviews()
         logo acima já renderizou esta cabine nesta cor, então peekCabPreview()
         acerta o cache e o crachá pinta o render sem esperar nada.
         A foto do manifesto continua indo junto como fallback — uma cabine sem
         geometria leve (`preview` ausente no cabs.json) não tem o que renderizar. */
      preview: hasCabPreview(cab.id)
        ? { cabId: cab.id, hex: color.hex, finish: color.finish }
        : null,
    });
    showBadge(true);
    setMapBadge({
      envName: env.name,
      envSubtitle: env.subtitle,
      envThumb: assetUrl(env.thumb),
    });
    showMapBadge(true);

    /* #brand-sub morreu com a topbar. O que ele dizia — qual caminhão, qual
       implemento — está no badge do caminhão e na linha de estado, e nenhum dos
       dois precisava de uma terceira cópia. */
    const stand = cab.exact ? '' : ' · geometria provisória';
    setStatus(first
      ? `Pronto · ${env.name} · ${color.name} · cabine ${fmt(models.state.cabBox)}`
        + ` · implemento ${fmt(models.state.trailerBox ?? null)}`
        + (models.state.trailerMeta ? '' : ' · engate padrão') + stand
      : `${manufacturer.name} ${model.name} · ${color.name} · ${env.name}` + stand);

    currentChoice = choice;
    /* Persiste só o que de fato renderizou: uma escolha que falhou ao carregar
       não pode virar aquela em que a próxima visita entra. (O seletor também
       pode tê-la salvo; saveChoice é idempotente.) */
    saveChoice(choice);
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
    phase(0.9, 'Renderizando o primeiro quadro…');
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
    const runColor = () => {
      applyColor(resolved.color);
      currentChoice = resolved.choice;
      saveChoice(resolved.choice);
      setStatus(`${resolved.manufacturer.name} ${resolved.model.name} · ${resolved.color.name}`);
      return resolved.choice;
    };
    /* O rótulo que enqueue() mostra SE esta cor tiver de esperar. Era o buraco
       de UX do atalho: o card acendia, o caminhão não mudava e não havia
       spinner nenhum — parecia que o clique tinha se perdido, quando na verdade
       a tinta estava correta e presa atrás de um download. */
    return enqueue(`Aplicando ${resolved.color.name}…`, runColor);
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

    $('load-text').textContent = 'Carregando catálogo…';
    /* Três listas independentes: o catálogo diz o que o usuário PODE escolher,
       cabs.json diz o que o carregador 3D consegue montar, e a paleta diz de
       que cores. Nenhuma bloqueia a outra, e nenhuma delas lança. */
    await Promise.all([loadCatalog(), models.loadManifests(), loadColors()]);

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
export function mountStudio(host: HTMLElement): Promise<void> {
  /* PRIMEIRA COISA: uma volta cancela a liberação diferida. Trocar de aba e
     voltar em dez segundos não pode custar nada. */
  cancelRelease();
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
  stopLoop();
  observer?.disconnect();
  observer = null;
  sceneMod.flushSave();
  /* O contexto WebGL das miniaturas é a única coisa aqui que NÃO vale a pena
     manter viva fora da rota: as imagens já geradas ficam em cache no módulo, e
     é isso que faz o seletor reabrir instantâneo — o contexto em si se refaz em
     um quadro. */
  disposePreviews();
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
