/* A camada ESTRUTURAL do painel — e a ponte entre as MEDIDAS do implemento e o
   editor de plotagem.
   ---------------------------------------------------------------------------
   O QUE ESTE ARQUIVO NÃO É: não é um segundo editor de livery. `vehicle/livery`
   e `ui/livery-editor` continuam donos de tudo que o usuário DESENHA — as três
   telas fabric, a tipografia, o desfazer, as guias, a captura. Nada aqui toca
   nisso. O que entra é a camada de BAIXO, a que ninguém desenha: a chapa com a
   faixa refletiva, a cantoneira e os vãos de porta que a MEDIDA do implemento
   determina.

   POR QUE ELA É SEPARADA DA ARTE, e não mais uma imagem no fabric
   ---------------------------------------------------------------------------
   Porque as duas mudam em momentos diferentes e por donos diferentes. A faixa e
   o frame são função da MEDIDA: subir 10 cm na altura do baú move a faixa
   superior e o vão da porta, e não deveria exigir que o cliente redesenhasse a
   arte dele. A arte é função do CLIENTE e não deveria se mexer quando a medida
   muda. Chapadas na mesma tela, uma edição de medida teria de reescrever pixels
   que pertencem a outra pessoa.

   Então a pilha estrutural é declarativa e vive em METROS — `./livery-layers`,
   o arquivo ESPELHADO com o desktop —, e é recomposta do zero a cada mudança de
   medida. A arte nem fica sabendo.

   ELA NÃO VAI PARA O 3D, E ISSO É O PONTO MAIS FÁCIL DE ERRAR AQUI
   ---------------------------------------------------------------------------
   Faixa refletiva, frame metálico e porta JÁ EXISTEM COMO GEOMETRIA no
   implemento — em relevo, com sombra própria, e acompanhando o baú pelas regras
   de `trailer-geometry.ts`. Mandar as mesmas peças para a textura do baú
   pintaria cada uma DUAS vezes: uma modelada e outra chapada, no mesmo lugar
   por acidente e em lugares diferentes assim que a medida mudasse. O primeiro
   corte deste trabalho fez exatamente isso, e o cliente o corrigiu com todas as
   letras: os SVGs "não devem refletir no implemento 3D".

   Então esta pilha é a REPRESENTAÇÃO 2D DO LAYOUT. Ela é o que substitui a foto
   estática do painel (`models/vehicles/panels/*.png`) — que hoje mostra a
   ferragem certa mas NÃO redimensiona, e é por isso que o cliente vai fornecer
   os SVGs. Quem alimenta a textura do baú continua sendo, sem nenhuma mudança,
   o editor de plotagem: as três telas fabric de ./livery.ts, com a ARTE do
   cliente, que é a única coisa que não tem equivalente em geometria.

   `LiveryComposer.render()` carrega o `scope` que torna isso mecânico:
   `'preview'` compõe tudo, `'model'` compõe só a chapa e o que estiver marcado
   `scope: 'model'`. Aqui só se chama `'preview'`, e `defaultLayers()` devolve
   tudo como `preview` — ou seja, para uma camada estrutural chegar ao 3D
   alguém teria de marcá-la à mão. É a barreira certa: explícita, e no arquivo
   espelhado, onde os dois apps a leem igual.

   ONDE ELA APARECE, então, são os dois lugares em que o painel é DESENHADO:
     1. no palco do editor, como um canvas inserido ATRÁS do canvas do fabric
        dentro do wrapper que o fabric cria — mesma doutrina da `.guide-svg`;
     2. na miniatura do card, desenhada antes da arte.
   Uma fonte, dois consumidores: recompor uma vez atualiza os dois.

   ONDE ENTRAM OS SVGs QUE O CLIENTE VAI MANDAR
   ---------------------------------------------------------------------------
   Hoje NÃO existe arte de faixa refletiva, de frame metálico nem de porta. O
   `LiveryComposer` já trata isso: uma camada com `source: {kind:'svg',
   markup:''}` cai no `placeholderSvg()` do tipo dela, com a MESMA caixa que a
   arte real vai ocupar — dá para conferir altura de faixa e vão de porta desde
   já, que é justamente o erro que só aparece tarde.

   Quando os arquivos chegarem, o caminho é UMA chamada e nada mais:

       registerLiveryArt('stripe', { kind: 'svg', markup: '<svg …' });
       registerLiveryArt('frame-top', { kind: 'svg', markup: '<svg …' });

   A chave é resolvida primeiro pelo `id` da camada (`stripe-low`, `stripe-high`,
   `frame-top`, `door-0`…) e depois pelo `kind` (`stripe`, `frame`, `door`). Ou
   seja: registrar por `kind` veste todas as camadas daquele papel de uma vez, e
   registrar por `id` cobre o caso em que a faixa de baixo é diferente da de
   cima. Nenhuma outra linha deste arquivo — nem do editor — muda por causa
   disso. É o contrato que o pedido "já prepare tudo e adicione placeholders"
   pede.

   Fontes `{kind:'image'}` também servem (um PNG de faixa, por exemplo); a
   preferência por SVG é só porque o painel é reescalado o tempo todo.

   POR QUE A CAMADA `base` É DESCARTADA AQUI
   ---------------------------------------------------------------------------
   `defaultLayers()` abre a pilha com uma chapa branca opaca, que é o certo no
   desktop — lá a pilha inteira vira a imagem do painel. No web ela seria uma
   demão de tinta branca sobre uma decisão que já tem dono: a variável CSS
   `--ts-implement`, que é o baú branco ou a cor do cavalo conforme "Pintar o
   implemento" (ver syncImplementColor em ./livery.ts). Pintar por cima dela a
   desfaria em silêncio — o mesmo defeito que o fundo branco das telas fabric já
   causou uma vez (ver DEFAULT_BG lá). A chapa é do baú; esta pilha é o que vem
   SOBRE a chapa. */
import {
  LiveryComposer, defaultLayers,
  type DoorSpec, type Face, type LiveryLayer, type LiverySource, type PanelSpec,
} from './livery-layers';
import { state, getTrailerDims, setTrailerDims as setTrailerDimsRaw } from './models';
import type { TrailerDims } from './trailer-geometry';

export type { DoorSpec, LiverySource, PanelSpec };

/** As três faces pintáveis. Mesmas chaves de `SurfaceKey` em ./livery.ts. */
export type StructureKey = 'left' | 'right' | 'rear';
export const STRUCTURE_KEYS: StructureKey[] = ['left', 'right', 'rear'];

/** O lado como o formulário de medidas o chama (`back`, não `rear`). */
export type MeasureSide = 'left' | 'right' | 'back';

export const sideToKey = (s: MeasureSide): StructureKey => (s === 'back' ? 'rear' : s);
export const keyToSide = (k: StructureKey): MeasureSide => (k === 'rear' ? 'back' : k);

/* ---------------- limites, todos vindos do formulário de medidas ------------
   Os números abaixo NÃO são inventados aqui: são os mesmos de
   `implement-measure-form.tsx` e da especificação do formulário, convertidos de
   centímetros para metros. Repetidos porque o engine não pode importar `@/` —
   é a regra que o mantém portátil (ver engine/index.ts) —, e por isso ficam
   juntos, nomeados, num só lugar onde uma divergência é visível. */

/** `Math.max(100, …)` no formulário: um painel nunca desce de 1 m. */
export const MIN_PANEL_LENGTH = 1.0;
/** `min={100} max={400}` no campo de altura. */
export const MIN_PANEL_HEIGHT = 1.0;
export const MAX_PANEL_HEIGHT = 4.0;
/** `Math.max(50, Math.min(layoutHeight, …))` no campo de altura de porta. */
export const MIN_DOOR_HEIGHT = 0.5;
/** A regra dos 2 cm entre Motorista e Sapo, expressa em metros. */
export const SIDE_WIDTH_TOLERANCE = 0.02;

/* Resolução do canvas de representação. 128 px/m põe a faixa refletiva (31,8 cm)
   em 41 px e o friso em 8 — folgado para um desenho de layout, e um quarto da
   memória que 256 px/m custaria. Isto NÃO é textura de GPU: é um canvas 2D que
   o CSS estica sobre a janela do painel, e ele nunca é maior do que a tela o
   mostra. O teto existe para o dia em que alguém pedir um baú de 30 m. */
const PIXELS_PER_METRE = 128;
const MAX_CANVAS_PX = 2048;

/* ---------------- o registro de arte (o ponto de extensão) ---------------- */

/**
 * As artes reais, quando existirem. Chave = `id` da camada ou `kind` dela.
 *
 * Vazio hoje, e é por isso que tudo sai como placeholder. Ver o bloco
 * "ONDE ENTRAM OS SVGs" no topo do arquivo.
 */
const artwork = new Map<string, LiverySource>();

/** Registra (ou substitui) a arte de um `id` de camada ou de um `kind`. */
export function registerLiveryArt(key: string, source: LiverySource) {
  artwork.set(key, source);
  void recomposeAll();
}

/** Tira a arte e devolve aquele papel ao placeholder. */
export function unregisterLiveryArt(key: string) {
  if (artwork.delete(key)) void recomposeAll();
}

/** O que já tem arte real — diagnóstico, e o que o console pergunta primeiro. */
export const registeredLiveryArt = () => [...artwork.keys()];

/**
 * A fonte efetiva de uma camada: arte registrada por `id`, senão por `kind`,
 * senão a fonte que `defaultLayers()` pôs — que para as camadas estruturais é
 * um `svg` de markup VAZIO, e é isso que faz o compositor cair no
 * `placeholderSvg()` com a caixa certa.
 */
function resolveSource(layer: LiveryLayer): LiverySource {
  return artwork.get(layer.id) ?? artwork.get(layer.kind) ?? layer.source;
}

/* ---------------- estado por painel ---------------- */

interface PanelState {
  spec: PanelSpec;
  canvas: HTMLCanvasElement;
  composer: LiveryComposer;
  /** Recomposições em voo; a mais nova ganha (ver recompose). */
  token: number;
}

function makePanelState(face: StructureKey, length: number, height: number): PanelState {
  const canvas = document.createElement('canvas');
  canvas.className = 'ts-structure';
  canvas.width = 4; canvas.height = 4;
  return {
    spec: { face: face as Face, length, height, doors: [] },
    canvas, composer: new LiveryComposer(canvas), token: 0,
  };
}

/* Medidas de partida plausíveis, substituídas por `refreshFromTrailer()` assim
   que houver implemento — mesma doutrina do PANEL_MM de ./livery.ts: semear com
   algo utilizável e corrigir pela geometria, nunca reportar um número inventado
   calado. */
const panels: Record<StructureKey, PanelState> = {
  left: makePanelState('left', 14.7, 2.78),
  right: makePanelState('right', 14.7, 2.78),
  rear: makePanelState('rear', 2.6, 2.78),
};

export const structureCanvas = (key: StructureKey) => panels[key].canvas;
export const getPanelSpec = (key: StructureKey): PanelSpec => ({
  ...panels[key].spec, doors: panels[key].spec.doors.map((d) => ({ ...d })),
});
export const getDoors = (key: StructureKey): DoorSpec[] =>
  panels[key].spec.doors.map((d) => ({ ...d }));

/* ---------------- quem aplica o redimensionamento ----------------
   `models.setTrailerDims()` regenera a geometria e é a porta CRUA. A porta boa é
   `studio.setTrailerDims()`, que costura a arte de volta nas chapas novas e
   rederiva os limites da órbita — mas studio.ts está acima deste módulo na
   ordem de import, e chamá-lo daqui fecharia um ciclo.
   Então studio.ts se INSCREVE, do mesmo jeito que já faz em
   `models.onTrailerPanelsRebuilt()`. O padrão dos dois é o mesmo de propósito:
   a seta de import aponta para baixo, e quem está em cima injeta o que sabe.

   ---------------------------------------------------------------------------
   POR QUE O APLICADOR PODE DEVOLVER UMA PROMESSA.

   O recorte das chapas é DESTRUTIVO e caro: descarta as malhas SIDE_L/SIDE_R/
   REAR e corta três novas do corpo redimensionado. Este módulo é chamado a cada
   `input` do inspetor de medidas — um controle deslizante dispararia um recorte
   POR QUADRO, e o resultado era uma sucessão de engasgos durante todo o arrasto.

   A saída é o aplicador COALESCER os recortes (ver studio.ts), e para isso ele
   precisa poder dizer "aceitei, mas ainda não fiz". Uma promessa é exatamente
   essa frase. As três respostas possíveis, e o que cada uma significa:

     TrailerDims  → recortei AGORA; refreshFromTrailer() já corrigiu tudo.
     null         → não há geometria a redimensionar (bake sem o branco de
                    fábrica); este módulo tem de fazer o trabalho 2D sozinho.
     Promise<…>   → ADIEI o recorte. A representação 2D não pode esperar por
                    ele, então recompomos AGORA com o valor otimista e a volta
                    por refreshFromTrailer() corrige quando o recorte acontecer.

   O terceiro caso é novo e é o ponto da mudança. Note que ele NÃO pode ser
   confundido com o segundo: uma promessa é truthy, então um `if (!dims)` cru
   cairia no ramo "aplicado" e o editor ficaria congelado no valor antigo
   durante todo o arrasto — que é o oposto do que se quer. */
type DimsResult = TrailerDims | null;
type DimsApplier = (patch: { height?: number; length?: number })
=> DimsResult | Promise<DimsResult>;
let applyDims: DimsApplier = (patch) => setTrailerDimsRaw(patch);

/** studio.ts entrega aqui a versão que também reata a arte e a câmera. */
export function setDimsApplier(fn: DimsApplier) { applyDims = fn; }

/* `instanceof Promise` reprovaria uma thenable de outra realm ou de outra
   implementação; o teste do `.then` é o que a própria especificação usa. */
const isThenable = (v: unknown): v is Promise<DimsResult> =>
  !!v && (typeof v === 'object' || typeof v === 'function')
  && typeof (v as { then?: unknown }).then === 'function';

/* ---------------- o contrato de portas com a geometria ----------------
   `rig.setDoors(face, doors)` está sendo implementado em paralelo em
   `trailer-geometry.ts`, que é ARQUIVO ESPELHADO e não se edita daqui. Enquanto
   ele não existir, esta chamada simplesmente não acontece — as portas continuam
   entrando como CAMADA (o vão desenhado na textura), que é metade do trabalho e
   a metade que já dá para conferir. No dia em que o método aparecer, ele passa a
   ser chamado sem que nada mude aqui.

   O SISTEMA DE COORDENADAS, que é onde isto pode dar errado calado: `position` é
   medido a partir da borda ESQUERDA DO PAINEL como o editor a mostra — e as duas
   laterais correm em sentidos opostos (`addLiveryUV()` gera u = (z−minZ)/span na
   SIDE_L e u = (maxZ−z)/span na SIDE_R; ver os rótulos ◄ TRASEIRA / ◄ FRENTE no
   palco). É a origem que o usuário enxerga, e é a mesma da textura, então
   camada e vão não podem divergir. Se `trailer-geometry` interpretar `position`
   no referencial do VEÍCULO em vez do painel, a conversão é uma linha e está
   escrita aqui para não precisar ser redescoberta:
       position_veiculo = (face === 'right') ? length - (position + width) : position
*/
type DoorCapableRig = { setDoors?: (face: Face, doors: DoorSpec[]) => void };

let doorsUnsupportedWarned = false;

function pushDoorsToGeometry(key: StructureKey, doors: DoorSpec[]) {
  const rig = state.trailerRig as unknown as DoorCapableRig | null;
  if (!rig) return;
  if (typeof rig.setDoors !== 'function') {
    if (!doorsUnsupportedWarned && doors.length) {
      doorsUnsupportedWarned = true;
      console.info('[medidas] `rig.setDoors()` ainda não existe nesta build da geometria —'
        + ' as portas entram só como camada de livery. Nada a fazer: quando'
        + ' trailer-geometry.ts ganhar o método, o vão passa a ser recortado sozinho.');
    }
    return;
  }
  try {
    rig.setDoors(key as Face, doors.map((d) => ({ ...d })));
  } catch (e: unknown) {
    /* Uma porta que a geometria recusa não pode derrubar a edição de medidas: a
       camada já foi composta e o usuário já viu o vão. */
    console.warn('[medidas] setDoors() recusou as portas de', key, '—',
      e instanceof Error ? e.message : String(e));
  }
}

/* ---------------- composição ---------------- */

/**
 * A pilha estrutural de um painel: o que `defaultLayers()` deriva das medidas,
 * sem a chapa (ver o topo do arquivo) e com cada fonte passada pelo registro de
 * arte.
 *
 * Note que ela é RECALCULADA, nunca remendada. É o que garante que apagar uma
 * porta não deixe o vão dela para trás.
 */
function structuralLayers(spec: PanelSpec): LiveryLayer[] {
  return defaultLayers(spec)
    .filter((l) => l.kind !== 'base')
    .map((l) => ({ ...l, source: resolveSource(l) }));
}

function canvasSize(spec: PanelSpec) {
  const ppm = Math.min(PIXELS_PER_METRE, MAX_CANVAS_PX / Math.max(spec.length, 0.01));
  return Math.max(24, ppm);
}

const structureListeners: ((key: StructureKey) => void)[] = [];

/** Avisa quem desenha o painel em outro lugar (as miniaturas dos cards). */
export function onStructureRedrawn(cb: (key: StructureKey) => void) {
  structureListeners.push(cb);
  return () => { const i = structureListeners.indexOf(cb); if (i >= 0) structureListeners.splice(i, 1); };
}

/**
 * Redesenha o canvas estrutural de um painel.
 *
 * ASSÍNCRONA porque o compositor carrega cada camada como imagem (um data-URL
 * de SVG é uma imagem como outra qualquer), e por isso duas recomposições podem
 * se cruzar — arrastar um campo de medida dispara uma por commit. O `token`
 * resolve: só a mais nova sobe a textura, as atrasadas descobrem que perderam e
 * saem sem escrever nada.
 */
async function recompose(key: StructureKey): Promise<void> {
  const st = panels[key];
  const mine = ++st.token;
  st.composer
    .setPanel(st.spec)
    .setLayers(structuralLayers(st.spec))
    .resize(canvasSize(st.spec));
  /* `'preview'` EXPLÍCITO, apesar de ser o padrão. É a única chamada de render
     deste módulo e o único lugar onde a decisão "isto não vai para o 3D"
     aparece como código em vez de comentário — escrevê-la por extenso é o que
     faz uma futura troca para `'model'` ser uma edição visível num diff. */
  await st.composer.render({ scope: 'preview' });
  if (mine !== st.token) return;
  for (const cb of structureListeners) cb(key);
}

async function recomposeAll() {
  await Promise.all(STRUCTURE_KEYS.map((k) => recompose(k)));
}

/* ---------------- as medidas ---------------- */

const measureListeners: (() => void)[] = [];

/**
 * Avisa que as medidas mudaram — e o interessado é sempre o mesmo tipo de
 * interessado: uma interface que mostra números.
 *
 * Existe porque o que o usuário PEDE e o que o baú ACEITA não são a mesma
 * coisa: `TrailerBody.snapHeight()` fecha a altura num número inteiro de
 * frisos, então digitar 2,80 m pode virar 2,79 m. Um campo que continuasse
 * mostrando 2,80 estaria mentindo sobre o implemento. Quem edita medida aqui
 * tem de se inscrever e reler.
 */
export function onMeasuresChanged(cb: () => void) {
  measureListeners.push(cb);
  return () => { const i = measureListeners.indexOf(cb); if (i >= 0) measureListeners.splice(i, 1); };
}

const emitMeasures = () => { for (const cb of measureListeners) cb(); };

/** As medidas correntes do implemento, em METROS. */
export interface ImplementMeasures {
  /** Fixa por norma (2,60 m) — é o comprimento do painel TRASEIRO. */
  width: number;
  height: number;
  /** Comprimento do baú, que é o comprimento dos painéis laterais. */
  length: number;
  doors: Record<StructureKey, DoorSpec[]>;
  /** `false` num bake que não redimensiona: os campos ficam só de leitura. */
  resizable: boolean;
}

export function getImplementMeasures(): ImplementMeasures {
  return {
    width: panels.rear.spec.length,
    height: panels.left.spec.height,
    length: panels.left.spec.length,
    doors: {
      left: getDoors('left'), right: getDoors('right'), rear: getDoors('rear'),
    },
    resizable: !!state.trailerRig,
  };
}

/** O comprimento editável de uma face. A traseira é a LARGURA do baú, que é
 *  padrão 2,60 m e não entra na edição (ver engine/index.ts). */
export const isLengthEditable = (key: StructureKey) => key !== 'rear';

/**
 * Reancora as medidas na geometria — a única direção em que elas viajam de
 * volta.
 *
 * Chamada em dois momentos, os dois por `livery.attachOverlays()`: no boot,
 * quando as chapas nascem, e a cada recorte posterior. É por aqui que a altura
 * ajustada aos frisos volta para os campos.
 */
export function refreshFromTrailer(): void {
  const d = getTrailerDims();
  if (d) {
    panels.left.spec.length = d.length;
    panels.right.spec.length = d.length;
    panels.rear.spec.length = d.width;
    for (const k of STRUCTURE_KEYS) panels[k].spec.height = d.height;
    clampDoors();
  }
  void recomposeAll();
  emitMeasures();
}

/** Uma porta não pode passar da borda nem do teto. Mesmo clamp do formulário. */
function clampDoors() {
  for (const k of STRUCTURE_KEYS) {
    const { length, height } = panels[k].spec;
    for (const d of panels[k].spec.doors) {
      d.width = Math.max(0.01, Math.min(d.width, length));
      d.position = Math.max(0, Math.min(d.position, length - d.width));
      d.height = Math.max(MIN_DOOR_HEIGHT, Math.min(d.height, height));
    }
  }
}

/**
 * A ÚNICA entrada de edição de medida. Devolve as medidas EFETIVAS.
 *
 * `height` e `length` são do BAÚ, não de uma face: as duas laterais são o mesmo
 * corpo. É isso que faz a regra dos 2 cm entre Motorista e Sapo (ver
 * SIDE_WIDTH_TOLERANCE) ser satisfeita por CONSTRUÇÃO aqui — não há dois
 * comprimentos que possam divergir. O formulário React precisa da regra porque
 * lá os dois lados são digitados separadamente; aqui ela é uma consequência.
 */
export function setImplementMeasures(patch: { height?: number; length?: number }): ImplementMeasures {
  const next: { height?: number; length?: number } = {};
  if (patch.height !== undefined && Number.isFinite(patch.height)) {
    next.height = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, patch.height));
  }
  if (patch.length !== undefined && Number.isFinite(patch.length)) {
    next.length = Math.max(MIN_PANEL_LENGTH, patch.length);
  }
  if (next.height === undefined && next.length === undefined) return getImplementMeasures();

  /* Otimista: os campos e a pilha já valem o que foi pedido. Se houver rig, a
     volta por refreshFromTrailer() corrige para o que o baú aceitou; se não
     houver (bake sem o branco de fábrica), este é o único valor que existe e o
     editor continua utilizável mesmo sem 3D paramétrico. */
  if (next.height !== undefined) for (const k of STRUCTURE_KEYS) panels[k].spec.height = next.height;
  if (next.length !== undefined) { panels.left.spec.length = next.length; panels.right.spec.length = next.length; }
  clampDoors();

  /* applyDims() dispara o recorte das chapas, que dispara attachOverlays(), que
     chama refreshFromTrailer() — a recomposição e o aviso saem de lá. Nos OUTROS
     dois casos (sem geometria, ou recorte adiado) esse retorno não vem, e este
     caminho tem de fazer o trabalho 2D por conta própria. Ver DimsApplier. */
  const applied = applyDims(next);
  if (isThenable(applied)) {
    /* RECORTE ADIADO. A pilha 2D já foi atualizada de forma otimista logo
       acima, e é ela que o editor desenha enquanto o usuário arrasta — então
       recompor agora é o que mantém o inspetor VIVO durante a coalescência.
       Quando o recorte finalmente acontecer, attachOverlays() →
       refreshFromTrailer() reescreve por cima com o que o baú aceitou (a altura
       fecha um número inteiro de frisos), e a diferença é de milímetros.
       Nada a fazer no `then`: o gancho de rebuild já cobre o caso com geometria,
       e o caso sem geometria (`null`) já foi coberto por esta recomposição. */
    void recomposeAll();
    emitMeasures();
  } else if (!applied) {
    void recomposeAll();
    emitMeasures();
  }
  return getImplementMeasures();
}

/**
 * As portas de uma face. Vira camada `door` E vai para a geometria.
 *
 * As duas metades sempre juntas, e é o ponto do pedido: uma porta cadastrada
 * que só existisse na textura seria um desenho de porta, e uma que só existisse
 * na geometria não apareceria no editor.
 */
export function setDoorsFor(key: StructureKey, doors: DoorSpec[]): DoorSpec[] {
  panels[key].spec.doors = doors.map((d) => ({
    position: Number(d.position) || 0,
    width: Number(d.width) || 0,
    height: Number(d.height) || 0,
  }));
  clampDoors();
  const applied = getDoors(key);
  pushDoorsToGeometry(key, applied);
  void recompose(key);
  emitMeasures();
  return applied;
}

/** Uma porta nova, com os padrões do formulário (1 m × 1 m), no maior vão. */
export function addDoor(key: StructureKey): DoorSpec[] {
  const { length, doors } = panels[key].spec;
  const w = Math.min(1.0, length);
  const h = Math.min(1.0, panels[key].spec.height);
  let position = length / 2 - w / 2;
  if (doors.length) {
    /* O maior vão livre, como `addDoor()` do formulário: sem isso a segunda
       porta nasce em cima da primeira. */
    const sorted = [...doors].sort((a, b) => a.position - b.position);
    let bestGap = -1, bestPos = 0, cursor = 0;
    for (const d of [...sorted, { position: length, width: 0, height: 0 }]) {
      const gap = d.position - cursor;
      if (gap > bestGap) { bestGap = gap; bestPos = cursor + (gap - w) / 2; }
      cursor = d.position + d.width;
    }
    position = bestPos;
  }
  return setDoorsFor(key, [...doors, {
    position: Math.max(0, Math.min(position, length - w)), width: w, height: h,
  }]);
}

export function removeDoor(key: StructureKey, index: number): DoorSpec[] {
  const doors = panels[key].spec.doors.filter((_, i) => i !== index);
  return setDoorsFor(key, doors);
}

export function updateDoor(key: StructureKey, index: number, patch: Partial<DoorSpec>): DoorSpec[] {
  const doors = panels[key].spec.doors.map((d, i) => (i === index ? { ...d, ...patch } : d));
  return setDoorsFor(key, doors);
}

/* ---------------- a costura com o formulário de medidas ----------------
   `implement-measure-form.tsx` é a FONTE DA VERDADE das medidas e não é editado
   por este trabalho. O que existe aqui é o par de conversores para o formato
   que ele emite (`ImplementMeasureCreateFormData`): altura em metros e uma
   lista de SEÇÕES em que a porta é `isDoor` com `doorHeight`.

   Os tipos são redeclarados em vez de importados porque o engine não importa
   `@/` — ver engine/index.ts. São estruturais: qualquer objeto do formulário
   satisfaz o de entrada. */

export interface ImplementLayoutSection {
  /** metros */
  width: number;
  isDoor: boolean;
  /** metros, do piso até o topo do vão. `null` fora de uma porta. */
  doorHeight?: number | null;
  position?: number;
}

export interface ImplementLayout {
  /** metros */
  height: number;
  sections: ImplementLayoutSection[];
}

/**
 * O layout de uma face no formato do formulário.
 *
 * A lista de seções é a mesma que `calculateSegments()` produz lá: alterna
 * trecho cheio e porta, cobrindo o painel de ponta a ponta.
 */
export function exportImplementLayout(side: MeasureSide): ImplementLayout {
  const key = sideToKey(side);
  const { length, height, doors } = panels[key].spec;
  const sections: ImplementLayoutSection[] = [];
  let cursor = 0;
  for (const d of [...doors].sort((a, b) => a.position - b.position)) {
    if (d.position > cursor) {
      sections.push({ width: d.position - cursor, isDoor: false, doorHeight: null, position: sections.length });
    }
    sections.push({ width: d.width, isDoor: true, doorHeight: d.height, position: sections.length });
    cursor = d.position + d.width;
  }
  if (cursor < length || !sections.length) {
    sections.push({ width: Math.max(0, length - cursor), isDoor: false, doorHeight: null, position: sections.length });
  }
  return { height, sections };
}

/**
 * O caminho de volta: um layout salvo vira medida + portas + camadas.
 *
 * A ALTURA é do baú inteiro, então importar a traseira também mexe nas
 * laterais — é a mesma amarração que o formulário faz ao espelhar a altura
 * entre Motorista e Sapo. O COMPRIMENTO da traseira é ignorado: ele é a largura
 * do baú, que é padrão e não se edita.
 */
export function importImplementLayout(side: MeasureSide, layout: ImplementLayout): ImplementMeasures {
  const key = sideToKey(side);
  const sections = Array.isArray(layout?.sections) ? layout.sections : [];
  const total = sections.reduce((s, sec) => s + (Number(sec?.width) || 0), 0);

  const doors: DoorSpec[] = [];
  let cursor = 0;
  for (const sec of sections) {
    const w = Number(sec?.width) || 0;
    if (sec?.isDoor) {
      doors.push({ position: cursor, width: w, height: Number(sec?.doorHeight) || MIN_DOOR_HEIGHT });
    }
    cursor += w;
  }

  const patch: { height?: number; length?: number } = {};
  if (Number.isFinite(layout?.height) && layout.height > 0) patch.height = layout.height;
  if (isLengthEditable(key) && total > 0) patch.length = total;
  setImplementMeasures(patch);
  setDoorsFor(key, doors);
  return getImplementMeasures();
}

/**
 * A regra dos 2 cm, para quem trouxer os dois lados de fora.
 *
 * Aqui dentro ela não pode falhar (um comprimento só para as duas laterais),
 * mas um layout IMPORTADO pode chegar violando — e importar em silêncio um
 * Motorista de 14,60 m sobre um Sapo de 14,50 m esconderia exatamente o erro
 * que a regra existe para pegar.
 */
export function checkSideWidths(left: ImplementLayout, right: ImplementLayout): string | null {
  const sum = (l: ImplementLayout) =>
    (l?.sections ?? []).reduce((s, sec) => s + (Number(sec?.width) || 0), 0);
  const a = sum(left), b = sum(right), diff = Math.abs(a - b);
  if (diff <= SIDE_WIDTH_TOLERANCE) return null;
  return `O layout possui diferença de largura maior que 2 cm entre os lados. `
    + `Lado Motorista: ${(a * 100).toFixed(0)} cm, Lado Sapo: ${(b * 100).toFixed(0)} cm `
    + `(diferença de ${(diff * 100).toFixed(1)} cm).`;
}

/* ---------------- os dois lugares onde a representação aparece ----------------
   NÃO existe um terceiro. Não há sobreposição no 3D, não há CanvasTexture, não
   há material novo pendurado nas chapas SIDE_L/SIDE_R/REAR. Quem quiser
   acrescentar um caminho para a textura do baú tem de ler antes o bloco "ELA
   NÃO VAI PARA O 3D" no topo deste arquivo: a peça já está modelada, e a
   segunda cópia só se revela quando a medida muda. */

/* NO PALCO DO EDITOR.
   O canvas entra como PRIMEIRO filho do wrapper que o fabric cria
   (`.canvas-container`), portanto atrás do `lowerCanvasEl` — sem z-index, só
   ordem de documento, que é o que o fabric respeita. É a mesma manobra da
   `.guide-svg`, que entra por último e por isso fica na frente de tudo.
   Idempotente: `showSurface()` e o resize passam por aqui várias vezes. */
export function mountStructureCanvas(key: StructureKey, wrapper: HTMLElement) {
  const canvas = panels[key].canvas;
  if (canvas.parentElement === wrapper && wrapper.firstElementChild === canvas) return;
  wrapper.insertBefore(canvas, wrapper.firstChild);
}

/* NA MINIATURA DO CARD.
   Desenhada ANTES da arte, pelo mesmo motivo do renderOrder no 3D. */
export function drawStructureInto(
  ctx: CanvasRenderingContext2D, key: StructureKey, w: number, h: number,
) {
  const c = panels[key].canvas;
  if (!c.width || !c.height) return;
  try { ctx.drawImage(c, 0, 0, w, h); } catch { /* canvas ainda sem conteúdo */ }
}

/** Diagnóstico para o console: a pilha efetiva de um painel, já resolvida. */
export const describeStructure = (key: StructureKey) =>
  structuralLayers(panels[key].spec).map((l) => ({
    id: l.id, kind: l.kind, rect: l.rect, repeat: l.repeat,
    art: l.source.kind === 'svg' && !l.source.markup ? 'placeholder' : l.source.kind,
  }));
