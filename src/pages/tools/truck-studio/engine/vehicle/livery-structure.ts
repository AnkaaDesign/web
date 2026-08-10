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
import { getLiveryArt, onLiveryArtReady, type ArtPiece } from './livery-art';
import {
  state, getTrailerDims, setTrailerDims as setTrailerDimsRaw, setTrailerDoors,
} from './models';
import type { TrailerDims } from './trailer-geometry';
import {
  MIN_DOOR_WIDTH, MIN_DOOR_HEIGHT_GEO, DOOR_REVEAL, HEAD_DROP,
} from './trailer-door';

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
/**
 * Altura mínima de porta.
 *
 * O formulário React diz `Math.max(50, …)`, ou seja 0,5 m — e é COM ESTE
 * NÚMERO que a divergência aparecia: `trailer-door.rejectReason()` recusa
 * qualquer porta abaixo de 0,90 m (a ferragem do fecho não cabe) e devolve o
 * motivo por `console.warn`, que ninguém lê. O resultado era uma porta de 0,6 m
 * desenhada no editor, listada nas medidas, e AUSENTE do baú.
 *
 * O mínimo daqui passa a ser o da geometria. Uma porta que não pode existir em
 * 3D não deve poder ser desenhada em 2D — e `implement-measure-form.tsx` tem de
 * subir o `Math.max(50, …)` para 90 pelo mesmo motivo.
 */
export const MIN_DOOR_HEIGHT = MIN_DOOR_HEIGHT_GEO;
/** A regra dos 2 cm entre Motorista e Sapo, expressa em metros. */
export const SIDE_WIDTH_TOLERANCE = 0.02;

/* Resolução do canvas de representação. 128 px/m põe a faixa refletiva (31,8 cm)
   em 41 px e o friso em 8 — folgado para um desenho de layout, e um quarto da
   memória que 256 px/m custaria. Isto NÃO é textura de GPU: é um canvas 2D que
   o CSS estica sobre a janela do painel, e ele nunca é maior do que a tela o
   mostra. O teto existe para o dia em que alguém pedir um baú de 30 m. */
const PIXELS_PER_METRE = 128;
const MAX_CANVAS_PX = 2048;

/* ---------------- RESOLUÇÃO SOB DEMANDA ----------------
   O PROBLEMA, medido: com `PIXELS_PER_METRE` fixo em 128 e o teto de 2 048 px,
   um painel de 14,6 m sai com 1 869 px de largura. Isso é bom para a miniatura
   do card e para o palco em 100 %, e insuficiente no zoom de 400 % do editor —
   onde 1 869 px são esticados sobre ~7 500 px de tela e a fita refletiva, que
   tem 41 px de altura, vira uma barra borrada.

   Subir a constante não resolve: ela pagaria a resolução do pior caso em TODOS
   os casos, e um canvas de 8 192 × 1 560 são 51 MB de RAM por painel, três
   painéis, recompostos a cada centímetro digitado no formulário de medidas.

   O que resolve é a composição seguir o tamanho EXIBIDO. E ela só pode seguir
   porque a fonte virou VETOR: um SVG rasteriza no tamanho que for pedido, sempre
   nítido e sempre pelo mesmo custo de banda. Com a foto de antes
   (`panels/lateral.png`, 2 048 px de largura para qualquer baú) não haveria o
   que buscar acima daquilo — é literalmente a "criação dos liveries sob demanda"
   do pedido, e ela é de graça agora e era impossível antes.

   O TETO CONTINUA EXISTINDO, e sobe pouco: 4 096 px é o limite prático de um
   canvas 2D em máquina modesta e são ~25 MB por painel no pior caso. Acima
   disso o navegador começa a devolver canvas em branco sem avisar — que é o
   mesmo modo de falha calado que o `MAX_CANVAS_PX` original evitava. */
const MAX_CANVAS_PX_ZOOMED = 4096;

/** Largura em pixels de dispositivo com que cada painel está sendo EXIBIDO. */
const displayedPx: Record<StructureKey, number> = { left: 0, right: 0, rear: 0 };

/**
 * Diz com quantos pixels de CSS o painel está na tela agora.
 *
 * Chamado pelo editor a cada mudança de zoom e a cada resize. `0` (ou nunca
 * chamado) devolve o comportamento de antes — é o que mantém a miniatura do
 * card, que é pequena e não tem zoom, exatamente onde estava.
 *
 * NÃO recompõe sozinho quando a diferença é pequena: recompor é rasterizar três
 * SVGs e desenhar a pilha inteira, e o zoom de um editor passa por dezenas de
 * valores intermediários numa rolagem. O limiar de 1,5× é o que separa "o
 * usuário mudou de escala" de "o usuário está mexendo na roda".
 */
export function setPanelDisplaySize(key: StructureKey, cssPx: number) {
  const want = Math.max(0, Math.round(cssPx * (globalThis.devicePixelRatio || 1)));
  const had = displayedPx[key];
  displayedPx[key] = want;
  if (!want) return;
  const now = panels[key].canvas.width;
  if (now > 0 && want <= now * 1.5 && want >= now / 1.5) return;
  /* Sobe E desce: um painel que ficou pequeno segurando 4 096 px é 25 MB
     parados, e o caminho de volta tem de existir ou o pico vira o piso. */
  if (had !== want) void recompose(key);
}

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
  /**
   * O plano da FRENTE — a ferragem que passa POR CIMA da arte do cliente.
   *
   * Dois canvas e não um, e a razão é a mesma que a foto do painel já tinha: a
   * cantoneira, a fita, os montantes e (na traseira) os varões e a borracha
   * central ficam ENTRE o olho e o desenho. É isso que faz um texto atravessado
   * pela borracha aparecer cortado no editor do mesmo jeito que vai sair no baú
   * — e uma pilha desenhada só atrás não tem como mostrar isso.
   *
   * A tela do fabric fica no meio: `structure` atrás, fabric, `front` na
   * frente. Ver `mountStructureCanvas`/`mountFrontCanvas`.
   */
  front: HTMLCanvasElement;
  frontComposer: LiveryComposer;
  /** Recomposições em voo; a mais nova ganha (ver recompose). */
  token: number;
}

function makePanelState(face: StructureKey, length: number, height: number): PanelState {
  const canvas = document.createElement('canvas');
  canvas.className = 'ts-structure';
  canvas.width = 4; canvas.height = 4;
  const front = document.createElement('canvas');
  front.className = 'ts-structure ts-structure--front';
  front.width = 4; front.height = 4;
  return {
    spec: { face: face as Face, length, height, doors: [] },
    canvas, composer: new LiveryComposer(canvas),
    front, frontComposer: new LiveryComposer(front),
    token: 0,
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
   `rig.setDoors(face, doors)` EXISTE desde que `trailer-geometry.ts` ganhou o
   recorte de vão e `trailer-door.ts` a moldura, a folha e a ferragem. A detecção
   por `typeof` continua aqui de propósito: o desktop e o web compartilham este
   arquivo com builds da geometria que nem sempre andam juntas, e uma build sem
   o método tem de degradar para "só camada 2D" em vez de estourar.

   O SISTEMA DE COORDENADAS, que é onde isto dá errado CALADO — dois datums
   diferentes, e nenhum deles avisa quando é usado no lugar do outro:

     PAINEL (aqui)      `position` sai da borda esquerda do painel como o editor
                        a desenha. As duas laterais correm em sentidos opostos:
                        `addLiveryUV()` gera u = (z−minZ)/span na SIDE_L e
                        u = (maxZ−z)/span na SIDE_R, então x = 0 é a TRASEIRA na
                        esquerda e a DIANTEIRA na direita (ver os rótulos
                        ◄ TRASEIRA / ◄ FRENTE no palco).

     GEOMETRIA (lá)     `position` sai da DIANTEIRA e anda para trás, sempre. É
                        o único datum que não se mexe: o baú cresce para trás
                        (`mapZ()`, comportamento `front`), então uma porta
                        ancorada na dianteira fica onde está quando o
                        comprimento muda. Ancorada na traseira, ela andaria a
                        cada centímetro digitado.

   A conversão é a linha abaixo. Um comentário anterior deste arquivo a deixou
   escrita como `(face === 'right') ? length − (position + width) : position` —
   que é a distância até a TRASEIRA, não até a dianteira, e portanto a inversa
   da que a geometria pede. Ficou explícita como código, com nome, porque a
   versão errada dela é indistinguível da certa até alguém abrir a porta num baú
   assimétrico e ver que ela está do lado oposto ao do desenho. */
/* O rig cru só é consultado para saber se ESTA build da geometria tem portas.
   Quem aplica é `models.setTrailerDoors()`, e não `rig.setDoors()`: recortar um
   vão reescreve o corpo branco inteiro, e as chapas de livery são recortadas
   DELE — reconstruir sem redescascar devolve ao corpo os triângulos que já
   migraram para SIDE_L/SIDE_R e as duas cópias passam a disputar o z-buffer.
   `setTrailerDoors()` é o que corre a sequência completa. */
type DoorCapableRig = { stageDoors?: (face: StructureKey, doors: DoorSpec[]) => void };

let doorsUnsupportedWarned = false;

/** `position` do painel → distância da DIANTEIRA, que é o que a geometria usa. */
function toGeometryDoor(key: StructureKey, d: DoorSpec, length: number): DoorSpec {
  const fromFront = key === 'left' ? length - (d.position + d.width) : d.position;
  return { position: Math.max(0, fromFront), width: d.width, height: d.height };
}

function pushDoorsToGeometry(key: StructureKey, doors: DoorSpec[]) {
  const rig = state.trailerRig as unknown as DoorCapableRig | null;
  if (!rig) return;
  /* A TRASEIRA NÃO ENTRA. As portas de trás já existem como geometria de
     verdade no `trailer.glb` — quatro folhas, com batente, varão e dobradiça.
     Mandar recortar um vão ali abriria um buraco ATRÁS das portas que já estão
     lá. O que a traseira tem de portas continua sendo o que o bake trouxe; o
     cadastro dela vale para a camada 2D, que é o layout da arte. */
  if (key === 'rear') return;
  if (typeof rig.stageDoors !== 'function') {
    if (!doorsUnsupportedWarned && doors.length) {
      doorsUnsupportedWarned = true;
      console.info('[medidas] esta build da geometria não recorta vão de porta —'
        + ' as portas entram só como camada de livery.');
    }
    return;
  }
  try {
    const length = panels[key].spec.length;
    setTrailerDoors(key, doors.map((d) => toGeometryDoor(key, d, length)));
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

/**
 * Pixels por metro deste painel, agora.
 *
 * Sem tamanho exibido declarado é a conta de antes: 128 px/m com teto de
 * 2 048 px. Com ele, a resolução ACOMPANHA a tela — nunca abaixo dos 128 px/m
 * (o piso é o que a miniatura do card precisa, e ela não declara tamanho) e
 * nunca acima do teto de canvas. Ver o bloco RESOLUÇÃO SOB DEMANDA.
 */
function canvasSize(spec: PanelSpec, key?: StructureKey) {
  const len = Math.max(spec.length, 0.01);
  const base = Math.min(PIXELS_PER_METRE, MAX_CANVAS_PX / len);
  const shown = key ? displayedPx[key] : 0;
  if (!shown) return Math.max(24, base);
  /* `shown` é a largura do painel em pixels de dispositivo; dividida pelo
     comprimento em metros, é exatamente a densidade que a tela está pedindo. */
  const wanted = Math.min(shown / len, MAX_CANVAS_PX_ZOOMED / len);
  return Math.max(24, base, wanted);
}

/* ---------------- a GRADE 3x3, do manifesto para retângulos ----------------
   Aqui é onde "acompanhar o tamanho definido" acontece, e é uma função pura: o
   manifesto diz o que cada peça NÃO pode deformar, e esta função resolve o
   retângulo dela contra a medida do painel AGORA.

   As quatro regras, e o que cada uma preserva:

     anchorY 'roof'   altura fixa, colada no teto      → a cantoneira nunca
                                                          engorda quando o baú
                                                          fica mais alto
     anchorY 'floor'  altura fixa, colada no piso      → idem para o rodapé, e é
                                                          onde a fita 3M mora
     anchorX 'start'  largura fixa, colada numa ponta  → o montante de canto
     anchorX 'end'    largura fixa, colada na outra
     (nenhuma)        o miolo: estica nos dois eixos

   `tile` liga a REPETIÇÃO no lugar do esticamento. Ele vem preenchido só nas
   laterais, com o passo medido da fita (1,1584 m). O compositor já sabe
   ladrilhar — é o mesmo `repeat` que a pilha de placeholders usava —, e a
   ponta presa (`anchor`) é a mesma do 3D, senão a sobra da divisão cairia na
   dianteira num lado e na traseira no outro. */
function frontLayers(key: StructureKey, spec: PanelSpec): LiveryLayer[] {
  const face = getLiveryArt()?.[key];
  if (!face) return [];
  const { length, height } = spec;

  /* As bandas e os montantes que a face declarou, para o miolo saber onde
     começa. Lidos das próprias peças em vez de repetidos no manifesto: um
     número escrito duas vezes é um número que diverge. */
  const sizeOf = (fn: (p: ArtPiece) => boolean, get: (p: ArtPiece) => number | null) => {
    const p = face.pieces.find(fn);
    return (p && get(p)) || 0;
  };
  const bandTop = sizeOf((p) => p.anchorY === 'roof', (p) => p.h);
  const bandBottom = sizeOf((p) => p.anchorY === 'floor', (p) => p.h);
  const postStart = sizeOf((p) => p.anchorX === 'start', (p) => p.w);
  const postEnd = sizeOf((p) => p.anchorX === 'end', (p) => p.w);

  const out: LiveryLayer[] = [];
  for (const p of face.pieces) {
    if (p.plane !== 'front' || !p.markup) continue;

    let rect: { x: number; y: number; w: number; h: number };
    if (p.anchorY === 'roof') {
      rect = { x: 0, y: Math.max(0, height - (p.h || 0)), w: length, h: p.h || 0 };
    } else if (p.anchorY === 'floor') {
      rect = { x: 0, y: 0, w: length, h: p.h || 0 };
    } else if (p.anchorX === 'start') {
      rect = { x: 0, y: 0, w: p.w || 0, h: height };
    } else if (p.anchorX === 'end') {
      rect = { x: Math.max(0, length - (p.w || 0)), y: 0, w: p.w || 0, h: height };
    } else {
      /* O miolo: o que sobra depois das bandas e dos montantes. Na traseira é
         onde os varões, as dobradiças e a borracha central são desenhados. */
      rect = {
        x: postStart,
        y: bandBottom,
        w: Math.max(0, length - postStart - postEnd),
        h: Math.max(0, height - bandTop - bandBottom),
      };
    }
    if (rect.w <= 0 || rect.h <= 0) continue;

    out.push({
      id: `art-${key}-${p.id}`,
      /* `custom` é o topo de LAYER_ORDER, e é o certo: estas peças são a
         ferragem que fica SOBRE tudo. Elas são compostas num canvas próprio, e
         portanto a ordem só as ordena entre si — mas mantê-la coerente evita
         que uma futura fusão dos dois planos inverta a pilha. */
      kind: 'custom',
      source: { kind: 'svg', markup: p.markup },
      rect,
      ...(p.tile && p.tile > 0.01
        ? { repeat: { pitch: p.tile, span: p.tile, anchor: face.anchor } }
        : {}),
    });
  }
  return out;
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
  const ppm = canvasSize(st.spec, key);
  st.composer
    .setPanel(st.spec)
    .setLayers(structuralLayers(st.spec))
    .resize(ppm);
  /* `'preview'` EXPLÍCITO, apesar de ser o padrão. É a única chamada de render
     deste módulo e o único lugar onde a decisão "isto não vai para o 3D"
     aparece como código em vez de comentário — escrevê-la por extenso é o que
     faz uma futura troca para `'model'` ser uma edição visível num diff. */
  await st.composer.render({ scope: 'preview' });
  if (mine !== st.token) return;

  /* O PLANO DA FRENTE, na MESMA resolução do de trás. Os dois são esticados
     sobre exatamente o mesmo retângulo de tela, e uma diferença de densidade
     entre eles apareceria como a ferragem levemente fora de registro com a
     chapa — o tipo de desalinhamento de um pixel que se lê como borrão. */
  st.frontComposer
    .setPanel(st.spec)
    .setLayers(frontLayers(key, st.spec))
    .resize(ppm);
  await st.frontComposer.render({ scope: 'preview' });
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
    /* O BATENTE, MEDIDO — não um número escrito aqui. `measureSill()` acha o
       topo do perfil galvanizado da saia em CADA bake, e é sobre ele que o pé
       da porta assenta no 3D. Lido a cada refresh porque o perfil não é do
       painel: é do implemento carregado, e trocar de implemento troca a
       medida. Ver `PanelSpec.doorSill`. */
    const prof = (state.trailerRig as { profile?: { sillY: number; floorY: number } } | null)?.profile;
    const sill = prof ? Math.max(0, prof.sillY - prof.floorY) : undefined;
    for (const k of STRUCTURE_KEYS) panels[k].spec.doorSill = sill;
    clampDoors();
  }
  void recomposeAll();
  emitMeasures();
}

/**
 * Uma porta não pode passar da borda, nem do teto, nem ser menor do que a
 * geometria aceita.
 *
 * O TETO AQUI É O MESMO DO 3D, e é isso que a versão anterior não fazia: ela
 * limitava a `height`, o painel inteiro, enquanto `doorsOf()` limita a folha à
 * cantoneira (`HEAD_DROP`) descontando ainda a faixa do vão (`DOOR_REVEAL`) e o
 * batente (`sill`). Uma porta digitada com a altura do painel era desenhada
 * inteira no editor e chegava ao baú 44 cm mais baixa, calada — o clamp
 * acontecia lá, longe de quem estava olhando.
 */
function clampDoors() {
  for (const k of STRUCTURE_KEYS) {
    const spec = panels[k].spec;
    const { length, height } = spec;
    const sill = k === 'rear' ? 0 : (spec.doorSill ?? 0);
    const maxH = Math.max(MIN_DOOR_HEIGHT, height - HEAD_DROP - DOOR_REVEAL - sill);
    for (const d of spec.doors) {
      d.width = Math.max(MIN_DOOR_WIDTH, Math.min(d.width, length));
      d.position = Math.max(0, Math.min(d.position, length - d.width));
      d.height = Math.max(MIN_DOOR_HEIGHT, Math.min(d.height, maxH));
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

/** Medida padrão de uma porta de serviço: 1,20 × 2,10 m. */
export const DEFAULT_DOOR_WIDTH = 1.20;
export const DEFAULT_DOOR_HEIGHT = 2.10;

/** Uma porta nova, na medida padrão, no maior vão livre. */
export function addDoor(key: StructureKey): DoorSpec[] {
  const { length, doors } = panels[key].spec;
  const w = Math.min(DEFAULT_DOOR_WIDTH, length);
  const h = Math.min(DEFAULT_DOOR_HEIGHT, panels[key].spec.height);
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

/* O PLANO DA FRENTE, no palco.
   A pilha dentro do wrapper do fabric, de trás para a frente:

       .ts-structure         a chapa (este módulo, canvas de trás)
       lowerCanvasEl         a arte do cliente (fabric)
       upperCanvasEl         os controles do fabric
       .ts-structure--front  a ferragem (este módulo, canvas da frente)
       .guide-svg            a silhueta tracejada

   Entra ANTES da `.guide-svg` e depois dos dois canvas do fabric — ordem de
   documento, que é o que o fabric respeita (ele não usa z-index nos seus dois).
   `pointer-events: none` no CSS: a ferragem é desenho, não alvo; sem isso ela
   comeria todo clique do editor.
   Idempotente — `showSurface()` e o resize passam por aqui várias vezes. */
export function mountFrontCanvas(key: StructureKey, wrapper: HTMLElement) {
  const front = panels[key].front;
  const guide = wrapper.querySelector('.guide-svg');
  if (front.parentElement === wrapper && front.nextElementSibling === guide) return;
  if (guide) wrapper.insertBefore(front, guide);
  else wrapper.appendChild(front);
}

/** Diagnóstico: a grade resolvida de um painel, com os retângulos em metros. */
export const describeFront = (key: StructureKey) =>
  frontLayers(key, panels[key].spec).map((l) => ({
    id: l.id, rect: l.rect, repeat: l.repeat,
  }));

/* NA MINIATURA DO CARD.
   Desenhada ANTES da arte, pelo mesmo motivo do renderOrder no 3D. */
export function drawStructureInto(
  ctx: CanvasRenderingContext2D, key: StructureKey, w: number, h: number,
) {
  const c = panels[key].canvas;
  if (!c.width || !c.height) return;
  try { ctx.drawImage(c, 0, 0, w, h); } catch { /* canvas ainda sem conteúdo */ }
}

/** A ferragem, DEPOIS da arte — o par de `drawStructureInto` na miniatura. */
export function drawFrontInto(
  ctx: CanvasRenderingContext2D, key: StructureKey, w: number, h: number,
) {
  const c = panels[key].front;
  if (!c.width || !c.height) return;
  try { ctx.drawImage(c, 0, 0, w, h); } catch { /* canvas ainda sem conteúdo */ }
}

/** Diagnóstico para o console: a pilha efetiva de um painel, já resolvida. */
export const describeStructure = (key: StructureKey) =>
  structuralLayers(panels[key].spec).map((l) => ({
    id: l.id, kind: l.kind, rect: l.rect, repeat: l.repeat,
    art: l.source.kind === 'svg' && !l.source.markup ? 'placeholder' : l.source.kind,
  }));

/* A grade chega DEPOIS do boot (é um `fetch`), e quando chega os três painéis já
   foram compostos — sem esta linha a ferragem só apareceria na próxima mudança
   de medida. `recomposeAll()` é idempotente e custa três composições. */
onLiveryArtReady(() => { void recomposeAll(); });
