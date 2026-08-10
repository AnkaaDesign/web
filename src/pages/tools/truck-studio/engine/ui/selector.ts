/* Card selector (cenário → fabricante → modelo → CHASSI → COR) + the two badge
   cards that stay on the viewport afterwards: the SCENE badge top-left and the
   TRUCK badge bottom-left.

   O passo da cor entrou quando a sidebar de pintura saiu. Ele não é um seletor
   de hex: cada card é o CAVALO ESCOLHIDO naquela cor, porque a mesma tinta fica
   diferente em cada lataria e escolher cor em quadradinho é escolher no escuro.
   A paleta vem de catalog/colors.ts — hoje embutida, amanhã a tabela `Paint` da
   API. As imagens vêm de catalog/renders.ts: renders PRÉ-PRODUZIDOS, não mais
   um segundo contexto WebGL renderizando 26 miniaturas dentro da cortina.

   O PASSO DO CHASSI é o quarto, e é dirigido por dado: o motor não sabe quantos
   `6x2`/`6x4`/`4x2` existem nem se "modelo" é um nome comercial (S730) ou uma
   geração (Scania S 2016) — ele lê `ModelDef.chassis`, que o normalizador
   garante não-vazio. Um modelo com UM chassi só não custa clique nenhum: o
   passo sai da sequência e a escolha é feita sozinha (ver `seqFor`).

   NÃO EXISTE MAIS CARD DE COR, E NÃO EXISTE MAIS NENHUM "TROCAR".
   O card de cor era o terceiro crachá, empilhado sobre o do caminhão, e saiu.
   Depois saíram também as três afordâncias de texto que sobraram — a pílula
   "Trocar cor" sobre o card do caminhão, o botão "Trocar caminhão" abaixo dele e
   a pílula "Trocar" sobre o card do cenário. Decisão do dono do produto, na
   revisão de 2026-08-08: *"nao deve haver botao trocar caminhao, o card do
   caminhao deve levar para o seletor completo de caminhao, desde marca ate a
   cor"* e *"doesnt need the trocar buttons / text here"*.

   O QUE ISSO DEIXA: **o card É o controle**. O card do caminhão abre o fluxo
   'truck' COMPLETO (marca → modelo → chassi → cor) e o card do cenário abre o
   passo do cenário. Nenhum rótulo faz esse trabalho; quem o faz é o material —
   `cursor: pointer`, borda de acento no hover, anel de foco visível — e o
   teclado, que continua vindo de `role="button"` + tabindex + Enter/Espaço em
   `bindBadgeTrigger()`. Ver a seção 7 de selector.css.

   Consequência de rota: o cenário NÃO ficou órfão com o sumiço do botão. Ele
   nunca dependeu dele — o crachá do cenário sempre foi a entrada dele, e
   continua sendo.
   ---------------------------------------------------------------------------
   Everything here is built imperatively into the studio's own DOM (core/dom.ts), for
   the same reason the rest of the engine is: this subtree OUTLIVES the React
   route, so it must never depend on React and must never leave listeners on
   document/window behind when it closes.

   Layering:
   - #ts-selector goes on `root`, so it covers the whole studio (viewport AND
     sidebar) and blocks every pointer event while a choice is pending.
   - #ts-mapbadge and #ts-badge go inside #canvas-holder, which is
     `position: relative`, so "top-left"/"bottom-left" mean the corners OF THE 3D
     CANVAS, not of the page.

   Flows: the overlay is not always a 3-step wizard. Each badge is the entry
   point to the PART of the wizard it represents — the scene badge opens the
   cenário step alone, the truck badge opens fabricante → modelo — and the
   promise still resolves the same complete {envId, manufacturerId, modelId}
   whichever flow ran, so studio.ts never has to know which one it was.

   All styling lives in selector.css. The only inline styles we ever write are
   the per-brand `--ts-accent` custom property and image `src`. */
import { root, $opt, isMounted, el, initials } from '../core/dom';
import {
  catalog, getEnvironment, getManufacturer, getModel, defaultChoice, assetUrl,
  saveChoice, loadChoice, defaultChassis, fileOf,
} from '../catalog/catalog';
/* O aquecimento de BYTES, ao lado do de imagens que já existia (prefetchRenders).
   A seta ui/ → core/ já existe (core/dom.ts), e a ui/ → scene/ também
   (ui/hud.ts, ui/chrome.ts) — nenhuma das duas fecha ciclo, e é aqui, no lugar
   em que a escolha acontece, que se sabe o que vai ser preciso a seguir. */
import { prefetch, cancelPrefetch } from '../core/prefetch';
import { prefetchEnvironment } from '../scene/environment';
import type { Choice, ResolvedChoice, ChassisDef } from '../catalog/catalog';
import {
  colorsFor, getColor, defaultColorId, FINISH_LABEL,
} from '../catalog/colors';
import { renderUrl, renderPlaceholder, prefetchRenders } from '../catalog/renders';
/* Só o helper de ceder-um-quadro. ui/loader.ts não importa este módulo (ele
   alcança `#ts-badge` por id, de propósito — ver badgeMediaRect lá), então esta
   seta não fecha ciclo nenhum. */
import { paintFrame } from './loader';

/** Which steps a flow walks; see FLOWS.
    O fluxo 'color' SAIU: ele existia para o card do caminhão abrir só o passo da
    cor, e o card passou a abrir o fluxo do caminhão inteiro. Um FlowId que nada
    pode pedir é um ramo morto em `seqFor`, `clampStep` e na trilha. */
export type FlowId = 'full' | 'map' | 'truck';
/** The five steps, by the id STEPS uses. Module-private: a caller names a FLOW,
    never a step — see openSelector. */
type StepId = 'map' | 'manufacturer' | 'model' | 'chassis' | 'color';

/** One step's static description — everything but the cards it renders. */
interface StepDef {
  id: StepId;
  label: string;
  title: string;
  sub: string;
  /** modifier class telling selector.css how big this step's cards are */
  grid: string;
  aria: string;
}

/** O que um card precisa para achar (ou desenhar) a imagem dele. */
interface CardRender {
  /** URL de um render pré-produzido, ou null → cai na foto/placeholder */
  url: string | null;
  /** id do chassi, só para a silhueta do placeholder ter o nº de eixos certo */
  chassisId: string | null;
}

/** One card, flattened out of whatever the step is listing. */
interface CardItem {
  id: string;
  name: string;
  sub: string;
  image: string | null;
  logo: string | null;
  accent: string | null;
  tag: string | null;
  selected: boolean;
  /** false → card visível, marcado "Em breve", e NÃO clicável. */
  available: boolean;
  /**
   * Render pré-produzido deste modelo+chassi nesta cor, no lugar da foto do
   * manifesto. É o que faz o passo da cor existir — não há doze fotos de
   * estúdio para doze cores — e o que faz o card do MODELO já mostrar a cor
   * escolhida. `url: null` cai na foto do manifesto e, na falta dela, no
   * placeholder de silhueta: NUNCA uma moldura vazia.
   */
  render?: CardRender | null;
  /** hex da cor que este card representa; pinta a amostra do canto */
  swatch?: string | null;
}

/** The single in-flight open() call. */
interface Session {
  resolve: (value: ResolvedChoice | null) => void;
  flow: FlowId;
  /** the subsequence of STEPS this flow walks, in order */
  seq: number[];
  cancellable: boolean;
  step: number;
  choice: Choice;
  prevFocus: HTMLElement | null;
}

/** What setBadge() paints onto the bottom-left truck card. */
export interface BadgeInfo {
  modelName?: string | null;
  modelSubtitle?: string | null;
  modelImage?: string | null;
  /**
   * O MESMO render pré-produzido dos cards do seletor: este modelo+chassi nesta
   * cor. `modelImage` (a foto do manifesto) é o degrau seguinte, e o
   * placeholder de silhueta é o último — ver setBadge().
   */
  render?: CardRender | null;
  manufacturerName?: string | null;
  logo?: string | null;
  /**
   * A cor que está no cavalo. O card do caminhão é o gatilho da COR agora, então
   * ele tem de dizer qual é: a amostra vai num chip no canto da moldura e o
   * nome entra no `aria-label`. Foi o que substituiu o card de cor.
   */
  colorName?: string | null;
  colorHex?: string | null;
  /** 'Metálica', 'Sólida'… — só o rótulo, o crachá não decide nada sobre tinta */
  finishLabel?: string | null;
}

/** What setMapBadge() paints onto the top-left scene card. */
export interface MapBadgeInfo {
  envName?: string | null;
  envSubtitle?: string | null;
  envThumb?: string | null;
}

/* ---------------- step definitions ---------------- */

/* One entry per step, in order. `grid` is the modifier class that tells
   selector.css how big the cards are — that is the ONLY difference between the
   three steps as far as rendering goes, everything else is data. */
const STEPS: StepDef[] = [
  {
    id: 'map',
    label: 'Cenário',
    title: 'Escolha o cenário',
    sub: 'O ambiente onde o caminhão vai ser apresentado.',
    grid: 'ts-cards--maps',
    aria: 'Cenários disponíveis',
  },
  {
    id: 'manufacturer',
    label: 'Fabricante',
    title: 'Escolha o fabricante',
    sub: 'A marca do cavalo mecânico.',
    grid: 'ts-cards--brands',
    aria: 'Fabricantes disponíveis',
  },
  {
    id: 'model',
    label: 'Modelo',
    title: 'Escolha o modelo',
    sub: 'O modelo que será carregado em 3D.',
    grid: 'ts-cards--models',
    aria: 'Modelos disponíveis',
  },
  {
    id: 'chassis',
    label: 'Chassi',
    title: 'Escolha o chassi',
    sub: 'A configuração de eixos do cavalo mecânico.',
    grid: 'ts-cards--models',
    aria: 'Chassis disponíveis',
  },
  {
    id: 'color',
    label: 'Cor',
    title: 'Escolha a cor',
    sub: 'A pintura do cavalo mecânico — cada card é o modelo escolhido, naquela cor.',
    grid: 'ts-cards--colors',
    aria: 'Cores disponíveis',
  },
];

/* NOME → POSIÇÃO. Esta constante é o que tira as bombas-relógio do arquivo.
   ---------------------------------------------------------------------------
   Até aqui `itemsFor`, `choose` e `clampStep` comparavam `stepIndex === 3`
   enquanto `CAROUSEL_STEPS` comparava `step.id` — duas linguagens para a mesma
   coisa, no mesmo arquivo. Inserir o passo do CHASSI entre `model` e `color`
   deslocou todo índice literal em um, e cada um deles teria falhado em
   silêncio: o ramo da cor passaria a listar chassis, o pré-requisito do
   `clampStep` guardaria o passo errado, e a edição especial removeria o chassi
   em vez da cor.
   Derivado de STEPS, nunca escrito à mão — um mapa manual seria a MESMA lista
   de índices literais, só que num lugar mais fácil de esquecer. */
const STEP_INDEX = STEPS.reduce((acc, s, i) => {
  acc[s.id] = i;
  return acc;
}, {} as Record<StepId, number>);

/* Tag de canto de tudo que ainda não tem geometria 3D. Uma constante porque o
   card do fabricante e o do modelo têm de dizer exatamente a mesma coisa. */
const EM_BREVE = 'Em breve';
/* Tag de canto de quem vem com a pintura de fábrica. Mesma razão de ser uma
   constante: é ela que explica, no card, por que o passo da Cor não aparece. */
const EDICAO_ESPECIAL = 'Edição especial';

/* A flow is just the SUBSEQUENCE of STEPS it walks, in order. Everything that
   used to hardcode "step 0/1/2" now asks the sequence instead, which is what
   makes the partial flows fall out for free: the last entry finishes, position 0
   has no "Voltar", and the breadcrumb numbers are positions in the sequence
   rather than absolute step ids (a 'truck' flow shows "1 Fabricante /
   2 Modelo" — showing "2, 3" would be lying about a flow the user is not in). */
const FLOWS: Record<FlowId, number[]> = {
  full: [STEP_INDEX.map, STEP_INDEX.manufacturer, STEP_INDEX.model, STEP_INDEX.chassis, STEP_INDEX.color],
  map: [STEP_INDEX.map],
  /* O FLUXO DO CARD DO CAMINHÃO — "desde marca até a cor", nas palavras do dono
     do produto. Ele passa PELO chassi e PELA cor de propósito: a mesma cor em
     outra cabine é outra imagem, e cada passo custa um clique.
     O cenário não entra: ele é escolhido pelo card dele, no canto de cima. */
  truck: [STEP_INDEX.manufacturer, STEP_INDEX.model, STEP_INDEX.chassis, STEP_INDEX.color],
};

/**
 * A sequência REAL de um fluxo, dada a escolha atual — a subsequência de FLOWS
 * menos os passos que não têm decisão a tomar.
 *
 * Duas remoções, as duas dirigidas por dado e as duas reversíveis:
 *
 * - **CHASSI com uma configuração só.** Um grid de um card é um clique
 *   obrigatório sem alternativa: a decisão já está tomada, e pedi-la mesmo
 *   assim é atrito puro. O passo sai e `choose()` escreve o chassi sozinho.
 *   Se a única configuração NÃO estiver disponível ("Em breve"), o passo FICA:
 *   aí o card tem o que dizer, e auto-selecionar um chassi sem geometria
 *   levaria o estúdio a carregar algo que o catálogo disse que não existe.
 *
 * - **COR de uma edição especial.** A película É o produto; ver ModelDef.
 *
 * Reconstruída a cada escolha a partir do FLUXO, nunca mutada no lugar: o
 * seletor não fecha entre um clique e outro, e quem vier de um modelo de chassi
 * único de volta para um de três precisa do passo de novo.
 */
function seqFor(flow: FlowId, choice: Choice): number[] {
  const base = FLOWS[flow];
  const found = getModel(choice.modelId);
  const chassis = found ? found.model.chassis : [];
  const skipChassis = chassis.length === 1 && chassis[0].available;
  const skipColor = !!found?.model.specialEdition;
  if (!skipChassis && !skipColor) return base.slice();
  return base.filter((s) =>
    !(skipChassis && s === STEP_INDEX.chassis) && !(skipColor && s === STEP_INDEX.color));
}

/* Anything focusable we might put inside the overlay. Used by the focus trap. */
const FOCUS_SEL = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* ---------------- module state ---------------- */

let built = false;

/* Overlay nodes, assigned by build(). Definite-assignment (`!`) rather than
   `| null`: initSelector() builds every one of them and EVERY public entry
   point below calls it first, so a null here is impossible by the time any
   reader runs — and typing them nullable would put ~120 null checks on it. */
let overlay!: HTMLElement;
let stepsRow!: HTMLElement;
let titleEl!: HTMLElement;
let subEl!: HTMLElement;
let cardsEl!: HTMLElement;
let footEl!: HTMLElement;
let backBtn!: HTMLButtonElement;
let cancelBtn!: HTMLButtonElement;

/* Truck badge nodes (bottom-left). */
let badge!: HTMLElement;
let badgeMedia!: HTMLElement;
let badgeName!: HTMLElement;
let badgeSub!: HTMLElement;
let badgeLogo!: HTMLImageElement;
/* A amostra da cor atual, no canto da moldura — o que sobrou do card de cor. */
let badgeSwatch!: HTMLElement;

/* Verdadeiro enquanto o cavalo em cena for uma edição especial. Não muda mais o
   FLUXO que o card abre (ele sempre abre o do caminhão inteiro, e `seqFor`
   remove o passo da cor sozinho quando o modelo é película) — muda só o que o
   card DIZ: sem amostra de tinta e sem cor no nome acessível, porque ali não há
   tinta escolhível para anunciar. Escrito só por setBadgeSpecialEdition(). */
let badgeSpecial = false;

/* O último BadgeInfo pintado. setBadgeColor() precisa dele para trocar SÓ a
   amostra sem apagar modelo, foto e logo — applyColor() roda por caminhos que
   não sabem qual caminhão está na tela. */
let lastBadgeInfo: BadgeInfo | null = null;

/* Scene badge nodes (top-left). */
let mapBadge!: HTMLElement;
let mapBadgeMedia!: HTMLElement;
let mapBadgeName!: HTMLElement;
let mapBadgeFilled = false;

/* The single in-flight open() call, or null when the selector is closed:
   { resolve, cancellable, flow, seq, step, choice, prevFocus }. */
let session: Session | null = null;

/* Last choice the user actually completed — the starting point for both badges. */
let lastChoice: ResolvedChoice | null = null;

const listeners: ((choice: ResolvedChoice) => void)[] = [];

/* ---------------- tiny DOM helpers (house style: build it in JS) ----------------
   `el` and `initials` live in core/dom.ts: ui/hud.ts and ui/loader.ts build
   their DOM the same way, and loader.ts's placeholder tile has to spell the
   truck with exactly the same two letters this file's badge does, or the
   outro's FLIP reads as a swap between two objects instead of one moving. */

/**
 * Append an <img> to `box`, swapping in a text placeholder if the path is null
 * or the request fails.
 *
 * This path WILL be hit: catalog/catalog.ts's built-in fallback catalog has
 * `image: null`, and the public assets are generated separately, so during
 * integration half the thumbnails simply do not exist yet. Showing the browser's
 * broken-image glyph would read as a bug; a lettered tile reads as deliberate.
 */
function appendImage(
  box: HTMLElement, path: string | null | undefined, alt: string,
  imgClass: string, fallbackClass: string, fallbackText: string,
) {
  const showFallback = () => {
    img.remove();
    if (box.querySelector('.' + fallbackClass)) return;
    const fb = el('span', fallbackClass, fallbackText);
    fb.setAttribute('aria-hidden', 'true');
    box.appendChild(fb);
  };

  const img = el('img', imgClass);
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = alt || '';

  if (!path) {
    showFallback();
    return null;
  }
  /* `once` matters: a src reassignment must not stack handlers. */
  img.addEventListener('error', showFallback, { once: true });
  img.src = assetUrl(path);
  box.appendChild(img);
  return img;
}

/* ---------------- DOM construction (once) ---------------- */

function buildOverlay() {
  overlay = el('div', 'ts-selector hidden');
  overlay.id = 'ts-selector';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ts-sel-title');
  overlay.tabIndex = -1;                     // last-resort focus target

  const scrim = el('div', 'ts-selector__scrim');
  /* pointerdown, not click: a click that STARTED on a card and ended on the
     scrim (drag) must not be read as "dismiss". */
  scrim.addEventListener('pointerdown', () => {
    if (session && session.cancellable) settle(null);
  });
  overlay.appendChild(scrim);

  const inner = el('div', 'ts-selector__inner');

  stepsRow = el('div', 'ts-steps');
  stepsRow.setAttribute('role', 'group');
  stepsRow.setAttribute('aria-label', 'Etapas');
  inner.appendChild(stepsRow);

  const head = el('div', 'ts-sel-head');
  titleEl = el('h2', 'ts-sel-title');
  titleEl.id = 'ts-sel-title';
  subEl = el('p', 'ts-sel-sub');
  head.appendChild(titleEl);
  head.appendChild(subEl);
  inner.appendChild(head);

  cardsEl = el('div', 'ts-cards');
  cardsEl.setAttribute('role', 'group');
  inner.appendChild(cardsEl);

  footEl = el('div', 'ts-sel-foot');
  backBtn = el('button', 'ts-btn ts-btn--ghost', 'Voltar');
  backBtn.type = 'button';
  backBtn.addEventListener('click', goBack);
  cancelBtn = el('button', 'ts-btn ts-btn--ghost', 'Cancelar');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => { if (session) settle(null); });
  footEl.appendChild(backBtn);
  footEl.appendChild(cancelBtn);
  inner.appendChild(footEl);

  overlay.appendChild(inner);
  root.appendChild(overlay);
}

/**
 * Make a badge card the trigger for one of the partial flows.
 *
 * role="button" + tabindex + Enter/Space rather than a real <button>, on
 * purpose: the badges' inner boxes are block <div>s that selector.css sizes with
 * `width:100%` + `aspect-ratio`, and ui/loader.ts's outro measures
 * `.ts-badge__media`'s layout box to fly the loading photo into it. Re-rooting
 * them under a <button> would make those children inline-by-default phrasing
 * content and drag the UA's button padding/font/text-align resets in with them —
 * a lot of collateral for keyboard behaviour that is six lines to write.
 */
function bindBadgeTrigger(node: HTMLElement, flow: FlowId, label: string) {
  node.setAttribute('role', 'button');
  node.tabIndex = 0;
  node.setAttribute('aria-label', label);
  node.title = label;
  /* O fluxo de cada crachá é FIXO desde que o card do caminhão passou a abrir o
     fluxo inteiro: o `() => FlowId` que existia aqui era o que alternava entre
     'color' e 'truck' na edição especial, e não há mais 'color'. */

  /* #canvas-holder holds the WebGL canvas and both badges as SIBLINGS, and
     scene/scene.ts binds OrbitControls to `renderer.domElement` — the canvas itself,
     not the holder — so a press on a badge has no bubbling path to the controls
     today. These three lines are the guard against that changing: the day the
     controls move onto the holder (or the badges move inside the canvas's
     wrapper), an unguarded press would start a camera drag underneath the card
     and the user would see the scene swing while the overlay opens. */
  const swallow = (e: Event) => e.stopPropagation();
  node.addEventListener('pointerdown', swallow);
  node.addEventListener('pointerup', swallow);
  node.addEventListener('wheel', swallow, { passive: true });

  node.addEventListener('click', () => openFlow(flow));
  node.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();                      // Space would scroll the page
    openFlow(flow);
  });
}

/* Bottom-left: the chosen truck, with the manufacturer logo in its corner.
   ---------------------------------------------------------------------------
   CLICAR NELE ABRE O SELETOR DE CAMINHÃO INTEIRO — marca → modelo → chassi →
   cor. Foi para cá que foi parar tanto o card de cor (que ficava empilhado logo
   acima e saiu) quanto o botão "Trocar caminhão" (que era irmão logo abaixo e
   também saiu): três controles para uma decisão viraram um card.

   O CARD NÃO TEM MAIS NENHUM FILHO INTERATIVO NEM NENHUM RÓTULO DE AÇÃO. A
   pílula "Trocar cor" que morava dentro dele foi embora com o resto; o que diz
   que ele é clicável é o material (selector.css §7: cursor, borda de acento no
   hover, anel de foco) e o nome acessível abaixo. Duas consequências que valem
   ser ditas em voz alta, porque as duas já foram bug aqui:

   1. A11Y: não há mais nenhum <button> dentro de um `role="button"` — o controle
      aninhado que o botão irmão existia para evitar deixou de ser possível, e o
      alvo de clique voltou a ser um só.
   2. MEDIÇÃO: `ui/loader.ts:badgeMediaRect()` mede a caixa de layout de
      `#ts-badge .ts-badge__media` para VOAR a foto da cortina até ela (o FLIP
      de saída). Nada aqui mexe em __media: ela continua sendo o primeiro filho
      em bloco do card, com `width:100%` + `aspect-ratio`, e a amostra de cor
      continua posicionada em absoluto dentro dela (o que não altera a caixa de
      layout). O que saiu eram IRMÃOS dela. */
function buildBadge() {
  badge = el('div', 'ts-badge hidden');
  badge.id = 'ts-badge';

  badgeMedia = el('div', 'ts-badge__media');
  badge.appendChild(badgeMedia);

  /* A amostra da cor, no canto da moldura — mesma marcação e mesma variável
     (`--ts-swatch`) do chip dos cards de cor, para os dois lerem como a mesma
     coisa. É ela que diz QUE cor o card está mostrando agora que não há mais um
     card de cor para dizê-lo. Dentro de __media de propósito: o FLIP mede a
     caixa de layout do elemento, e um filho posicionado absolutamente não a
     altera. */
  badgeSwatch = el('span', 'ts-badge__swatch hidden');
  badgeSwatch.setAttribute('aria-hidden', 'true');
  badgeMedia.appendChild(badgeSwatch);

  const body = el('div', 'ts-badge__body');
  badgeName = el('div', 'ts-badge__name');
  badgeSub = el('div', 'ts-badge__sub');
  body.appendChild(badgeName);
  body.appendChild(badgeSub);
  badge.appendChild(body);

  badgeLogo = el('img', 'ts-badge__logo hidden');
  badgeLogo.loading = 'lazy';
  badgeLogo.decoding = 'async';
  badgeLogo.alt = '';
  badgeLogo.addEventListener('error', () => badgeLogo.classList.add('hidden'));
  badge.appendChild(badgeLogo);

  /* Sem nó de rótulo. O `aria-label` que bindBadgeTrigger põe no card é o que
     anuncia a ação, e paintBadgeLabels() o mantém dizendo qual caminhão e qual
     tinta estão na tela — um texto visível repetindo isso seria a terceira cópia
     da mesma frase no mesmo canto. */
  bindBadgeTrigger(badge, 'truck', 'Trocar caminhão');
}

/* Top-left: the chosen scene. Same conventions as the truck badge so the two
   style as a pair; clicking it re-opens the cenário step alone. */
function buildMapBadge() {
  mapBadge = el('div', 'ts-mapbadge hidden');
  mapBadge.id = 'ts-mapbadge';

  mapBadgeMedia = el('div', 'ts-mapbadge__media');
  mapBadge.appendChild(mapBadgeMedia);

  const body = el('div', 'ts-mapbadge__body');
  /* A static "Cenário" eyebrow, because unlike the truck badge the name alone
     ("Rodovia") does not say what kind of thing it names.

     Two lines only — no __sub twin of .ts-badge__sub. This card carries a name,
     not a caption, and a third line would give it the same visual weight as the
     truck badge, turning the viewport into two competing cards. The environment
     subtitle goes into the tooltip instead of being dropped (see setMapBadge).

     Nenhum rótulo de ação: a pílula "Trocar" que selector.css desenhava como um
     ::after neste card saiu junto com as duas do card do caminhão. */
  body.appendChild(el('div', 'ts-mapbadge__label', 'Cenário'));
  mapBadgeName = el('div', 'ts-mapbadge__name');
  body.appendChild(mapBadgeName);
  mapBadge.appendChild(body);

  bindBadgeTrigger(mapBadge, 'map', 'Trocar cenário');
}

/**
 * Build the overlay + badge DOM into the studio root. Call once, after
 * loadCatalog(). Safe to call twice (no-op the second time).
 */
export function initSelector() {
  if (built) return;
  built = true;
  buildOverlay();
  buildMapBadge();
  buildBadge();

  /* Every badge lives inside #canvas-holder (position: relative) so they hug the
     3D viewport's corners instead of the page's. */
  const host = $opt('canvas-holder') || root;   // template changed under us — degrade
  host.appendChild(mapBadge);
  /* A pilha do canto inferior esquerdo, hoje com UM inquilino só — o card. Ela
     não foi removida junto com o botão que a justificava por dois motivos
     concretos, nenhum estético: `core/studio.css` ancora `.ts-corner` (posição,
     e a lista do modo limpo que a faz deslizar para fora) e `ui/hud.css` reserva
     a faixa de baixo por ela. Trocar o ancoramento para `#ts-badge` moveria
     essas três regras de arquivo por nada.
     `position: static` no card vem de selector.css: quem posiciona é a pilha. */
  const corner = el('div', 'ts-corner');
  corner.appendChild(badge);
  host.appendChild(corner);
}

/* Prefixo do id de um ACABAMENTO no passo da cor. Ver `choose()`: um passo
   lista duas famílias de card (películas de fábrica e tintas de catálogo) e os
   ids delas vêm de manifestos diferentes, que não têm como se coordenar. */
const FINISH_PREFIX = 'acabamento:';

/* NOME DE CHASSI: `6x2 (eixo de apoio elevatorio)` é DUAS informações num campo
   só, e o card tem dois campos. A configuração de eixos é o título — é por ela
   que se escolhe — e o que estiver entre parênteses vira o qualificador.
   Sem parênteses, não há qualificador: `4x2` não precisa de segunda linha. */
const CHASSIS_QUALIFIER_RE = /^(.*?)\s*\(([^)]*)\)\s*$/;
const chassisTitle = (name: string) => CHASSIS_QUALIFIER_RE.exec(name)?.[1]?.trim() || name;
const chassisQualifier = (name: string) => CHASSIS_QUALIFIER_RE.exec(name)?.[2]?.trim() || '';

/* A LISTA DE EIXOS NÃO É SUBTÍTULO DE MODELO. `4x2 · 6x2-tl · 6x4` é a
   pergunta do passo seguinte; deixá-la no card do modelo é gastar a segunda
   linha com o que o usuário ainda vai escolher. O teste é sobre a FORMA do
   texto (só configurações de eixo separadas por ·), não uma lista de exceções:
   assim um subtítulo de verdade — `AS Highway` — passa, e um manifesto novo que
   repita o vício é filtrado sem ninguém precisar lembrar. */
const AXLE_LIST_RE = /^\s*\d+x\d+[a-z-]*(\s*·\s*\d+x\d+[a-z-]*)*\s*$/i;
/** O subtítulo de modelo com a lista de eixos filtrada. Exportado por dentro
 *  para `chassisSubtitle()` usar a MESMA régua — a cortina de carregamento e a
 *  linha de estado mostravam `4x2 · 6x2a-tl · 6x2 (eixo de apoio elevatorio)`,
 *  a lista inteira mais o escolhido, que é o mesmo vício visto de outro lugar. */
function cleanModelSubtitle(sub: string | null | undefined): string {
  const t = (sub || '').trim();
  return !t || AXLE_LIST_RE.test(t) ? '' : t;
}

function modelSubtitle(m: { subtitle: string; available: boolean }): string {
  const sub = cleanModelSubtitle(m.subtitle);
  if (!sub) return '';
  /* "Em breve" já é a TAG do card (`available: false`), e repeti-la embaixo do
     nome era a mesma frase duas vezes no mesmo card. */
  if (!m.available && /^em breve$/i.test(sub)) return '';
  return sub;
}

/* ---------------- choice helpers ---------------- */

/* A saved/passed choice can reference ids the catalog no longer has (manifest
   edited, fallback catalog active). Drop whatever no longer resolves instead of
   rendering a step with a phantom selection. */
function sanitize(choice: Choice | null | undefined): Choice {
  const out: Choice = {
    envId: null, manufacturerId: null, modelId: null, chassisId: null, colorId: null,
    finishId: null,
  };
  if (!choice || typeof choice !== 'object') return out;
  const color = getColor(choice.colorId);
  if (color) out.colorId = color.id;
  /* O acabamento é resolvido depois do modelo, mais abaixo — aqui só se anota o
     pedido. Um id órfão (modelo trocado desde a última sessão) morre lá. */
  out.finishId = choice.finishId ?? null;
  const env = getEnvironment(choice.envId);
  if (env) out.envId = env.id;
  const man = getManufacturer(choice.manufacturerId);
  if (man) {
    out.manufacturerId = man.id;
    /* Só um modelo COM geometria sobrevive: preselecionar um "Em breve" deixaria
       o passo do modelo abrir com um card destacado que não pode ser clicado. */
    const model = man.models.find((m) => m.id === choice!.modelId && m.available);
    if (model) {
      out.modelId = model.id;
      /* Mesma regra um nível abaixo: um chassi que não pertence a ESTE modelo
         (ou que perdeu a geometria) não pode chegar ao passo como selecionado. */
      const hit = model.chassis.find((c) => c.id === choice!.chassisId && c.available);
      if (hit) out.chassisId = hit.id;
      /* E AQUI o acabamento morre se não for deste modelo. Sem isto, trocar de
         caminhão levaria junto uma película que o novo não tem, e o passo da
         cor abriria com nenhum card marcado. */
      if (!model.finishes.some((f) => f.id === out.finishId)) out.finishId = null;
    } else out.finishId = null;
  } else out.finishId = null;
  return out;
}

/* The steps a partial flow never SHOWS still have to come out of the promise
   filled in: studio.ts gets the same complete {envId, manufacturerId, modelId}
   whichever flow ran. Normally the carried-through ids survive sanitize()
   untouched and this is a no-op; it only bites when the current choice went
   stale (manifest edited under a live page), where a first-of-catalog default
   beats resolving `modelId: null` into studio.ts. */
function backfill(choice: Choice): ResolvedChoice {
  const def = defaultChoice();
  if (!choice.envId) choice.envId = def.envId;
  if (!choice.manufacturerId) {
    choice.manufacturerId = def.manufacturerId;
    choice.modelId = def.modelId;
  }
  if (!choice.modelId) {
    const man = getManufacturer(choice.manufacturerId);
    /* O primeiro modelo COM geometria, não o primeiro da lista: agora que o
       disponível de cada fabricante fica NO MEIO, `models[0]` é justamente um
       "Em breve". */
    const usable = man?.models.find((m) => m.available);
    choice.modelId = usable ? usable.id : def.modelId;
    /* O chassi PERTENCE ao modelo: trocar o modelo aqui obriga a reeleger o
       chassi, senão a escolha sai com um par que nunca existiu. */
    choice.chassisId = null;
  }
  /* O chassi nunca sai nulo, mesmo num fluxo que não mostra o passo dele — e
     `chassis` é garantidamente não-vazio (ver ModelDef.chassis), então isto
     sempre encontra alguém. */
  const model = getModel(choice.modelId)?.model;
  if (model && !model.chassis.some((c) => c.id === choice.chassisId)) {
    choice.chassisId = defaultChassis(model)?.id ?? null;
  }
  /* A cor nunca sai daqui nula, mesmo num fluxo que não mostra o passo dela:
     studio.ts recebe uma escolha COMPLETA seja qual for o fluxo, e é dela que
     sai a tinta aplicada — sem isto, um fluxo 'map' devolveria o caminhão sem
     dizer de que cor ele é. */
  if (!getColor(choice.colorId)) choice.colorId = def.colorId || defaultColorId();
  return choice as ResolvedChoice;
}

/* Never open on a step whose prerequisite is missing — the model step with no
   manufacturer picked would render an empty grid with no way forward — and
   never on a step outside the flow the caller asked for.

   Today it is only ever asked for `seq[0]`, so with the backfill above it is an
   identity: kept because it is what makes the OPENING step depend on the choice
   rather than on the flow table, which is the invariant a fifth flow (or a
   stale saved choice that outlives a manifest edit) would otherwise break. */
function clampStep(requested: number, choice: Choice, seq: number[]) {
  let i = requested;
  /* Pré-requisitos POR NOME, nunca por índice absoluto — ver STEP_INDEX. Em
     cascata e nesta ordem, para um estado que perdeu dois níveis cair os dois.
     O passo da cor mostra o MODELO+CHASSI escolhido em cada card; sem eles não
     há o que mostrar. (No fluxo 'color' o backfill de openSelector já garantiu
     os dois, então isto só morde num estado que não deveria existir.) */
  if (i === STEP_INDEX.color && !choice.chassisId) i = STEP_INDEX.chassis;
  if (i === STEP_INDEX.chassis && !choice.modelId) i = STEP_INDEX.model;
  if (i === STEP_INDEX.model && !choice.manufacturerId) i = STEP_INDEX.manufacturer;
  if (i === STEP_INDEX.manufacturer && !choice.envId && seq.includes(STEP_INDEX.map)) {
    i = STEP_INDEX.map;
  }
  return seq.includes(i) ? i : seq[0];
}

function itemsFor(stepIndex: number, choice: Choice): CardItem[] {
  if (stepIndex === STEP_INDEX.map) {
    return catalog.environments.map(env => ({
      id: env.id,
      name: env.name,
      sub: env.subtitle,
      image: env.thumb,
      logo: null,
      accent: null,
      tag: null,
      selected: env.id === choice.envId,
      /* `env.available` é DEGRADADO (HDRI ausente → céu procedural), não
         inutilizável: o passo 1 continua escolhível. Ver catalog.ts. */
      available: true,
    }));
  }
  if (stepIndex === STEP_INDEX.manufacturer) {
    return catalog.manufacturers.map(man => ({
      id: man.id,
      name: man.name,
      sub: man.models.length === 1 ? '1 modelo' : man.models.length + ' modelos',
      image: null,
      logo: man.logo,
      accent: man.accent,
      tag: null,
      selected: man.id === choice.manufacturerId,
      /* O fabricante é SEMPRE clicável, mesmo sem nenhum modelo pronto: quem
         diz "em breve" é o caminhão, no passo 3. Entrar numa marca que ainda
         não saiu não é um beco — o passo 3 mostra o que vem por aí e o
         "Voltar" continua ali. */
      available: true,
    }));
  }
  if (stepIndex === STEP_INDEX.model) {
    const man = getManufacturer(choice.manufacturerId);
    if (!man) return [];
    return man.models.map(m => ({
      id: m.id,
      name: m.name,
      /* SÓ O NOME DO MODELO. O subtítulo autorado é, em 19 dos 21 modelos, a
         LISTA DE CHASSIS (`4x2 · 6x2-tl · 6x4`) — ou seja, a pergunta do passo
         SEGUINTE, adiantada e sem poder ser respondida aqui. O que sobra de
         útil (`AS Highway`) é a versão de cabine, e ela pertence ao nome
         comercial, não a uma segunda linha. Onde houver algo que não seja a
         lista de eixos, ele continua aparecendo. */
      sub: modelSubtitle(m),
      image: m.image,
      logo: null,
      accent: man.accent,
      /* A tag do indisponível é do motor, não do manifesto: um `note` autoral não
         pode divergir do que o card realmente faz. Vale o mesmo para a edição
         especial — quem decide o rótulo é quem decide o comportamento, e o
         comportamento (pular a cor) sai de `specialEdition`, não do `note`. */
      tag: !m.available ? EM_BREVE : (m.specialEdition ? EDICAO_ESPECIAL : m.note),
      selected: m.id === choice.modelId,
      available: m.available,
      /* O card mostra o modelo NA COR que está escolhida — é a mesma imagem que
         o passo da cor usa, então trocar de modelo já mostra como a cor atual
         fica nele. O chassi é o que ESTE modelo tem de mais parecido com o
         escolhido: um modelo que não conhece o chassi atual cai no default
         dele, e a cadeia de fallback de renderUrl() resolve o resto. */
      render: renderFor(man.id, m.id, chassisIdWithin(m.id, choice.chassisId), choice.colorId),
    }));
  }

  if (stepIndex === STEP_INDEX.chassis) {
    /* O PASSO DIRIGIDO POR DADO. O motor não sabe quais configurações existem —
       ele lê `ModelDef.chassis`, que o normalizador garante não-vazio. Qualquer
       taxonomia válida (`6x2`/`6x4`/`4x2`, ou `padrao` sozinho) popula isto sem
       uma linha de código nova. */
    const found = getModel(choice.modelId);
    if (!found) return [];
    const { model, manufacturer } = found;
    return model.chassis.map((c) => ({
      id: c.id,
      /* NOME E QUALIFICADOR SEPARADOS. Os nomes autorados vêm na forma
         `6x2 (eixo de apoio elevatorio)`, e o card tem exatamente dois campos
         para isso — usar o primeiro inteiro deixava o título com nove palavras
         e o segundo com a lista de chassis do MODELO. Ver `splitChassisName()`. */
      name: chassisTitle(c.name),
      /* O QUALIFICADOR DESTE CHASSI, e nada mais.
         Era `c.subtitle || model.subtitle`, e como nenhum chassi do manifesto
         declara `subtitle`, o fallback disparava SEMPRE: o card do 4x2 saía com
         o subtexto `4x2 · 6x2a-tl`, que é a lista de irmãos dele. O passo já é
         "escolha o chassi" e o card já se chama pelo nome do chassi — repetir a
         lista aqui era dizer duas vezes o que o passo inteiro está perguntando.
         Sem qualificador, o card fica só com o nome, que basta. */
      sub: c.subtitle || chassisQualifier(c.name),
      image: c.image || model.image,
      logo: null,
      accent: manufacturer.accent,
      tag: !c.available ? EM_BREVE : c.note,
      selected: c.id === choice.chassisId,
      /* Mesmo tratamento do modelo "Em breve": card visível, marcado, e NÃO
         clicável. Uma configuração sem geometria não pode virar uma escolha que
         o estúdio depois não consegue montar. */
      available: c.available,
      render: renderFor(manufacturer.id, model.id, c.id, choice.colorId),
    }));
  }

  /* Passo da cor. Um card por cor da paleta (catalog/colors.ts), cada um com o
     cavalo JÁ ESCOLHIDO naquela cor — que é a única forma honesta de escolher
     tinta: a mesma cor fica diferente em cada lataria.
     Enquanto o render daquela combinação não existe, o card continua existindo
     com a silhueta e a amostra: escolher a cor não pode depender de uma imagem
     que ainda não foi produzida. */
  const picked = getModel(choice.modelId);
  const manId = picked?.manufacturer.id || null;
  const modelId = picked?.model.id || null;
  /* AS TINTAS DA MONTADORA ESCOLHIDA, não o catálogo inteiro. A tabela `Paint`
     amarra cada cor a uma montadora, e é essa a pergunta deste passo: de que cor
     ESTE caminhão. Mostrar as 522 do catálogo geral seria mostrar tinta de
     concorrente — e, pior, colocar as linhas de teste na frente, porque quase
     todas têm `colorOrder` 0. Montadora sem tinta cadastrada cai na paleta
     inteira; ver colorsFor(). */
  /* OS ACABAMENTOS DE FÁBRICA VÊM PRIMEIRO. Uma película não é uma tinta que
     alguém aplica — é como o caminhão sai da fábrica —, e ela responde a mesma
     pergunta deste passo. Enfileirá-la aqui é o que tira o S-Way Metallica da
     lista de MODELOS, onde ele aparecia como um segundo caminhão ao lado do
     S-Way 480 sendo o mesmo. Ver `ModelDef.finishes`.
     Antes das tintas porque são poucas e são o diferencial do modelo; depois
     delas vêm as 26 cores da montadora, na ordem do catálogo de tinta. */
  const finishCards = (picked?.model.finishes ?? []).map((f) => ({
    id: FINISH_PREFIX + f.id,
    name: f.name,
    sub: f.subtitle,
    image: f.image,
    logo: null,
    /* Sem amostra e com o anel na cor da marca: uma película não tem UM hex, e
       inventar um (o amarelo do Metallica? o preto?) mentiria sobre o produto.
       O card mostra a FOTO, que é a única descrição honesta dela. */
    accent: picked?.manufacturer.accent ?? null,
    tag: null,
    selected: choice.finishId === f.id,
    available: true,
    render: renderFor(manId, modelId, choice.chassisId, f.id),
  }));

  return finishCards.concat(colorsFor(choice.manufacturerId).map((c) => ({
    id: c.id,
    name: c.name,
    sub: FINISH_LABEL[c.finish] + (c.code ? ' · ' + c.code : ''),
    image: null,
    logo: null,
    /* O anel de seleção sai NA PRÓPRIA COR. É o único passo em que o accent não
       é da marca — aqui a marca do card é a cor. */
    accent: c.hex,
    tag: null,
    /* Com um acabamento escolhido, NENHUMA tinta fica marcada: o `colorId`
       continua guardado (é a cor do implemento, e é para onde se volta ao sair
       da película), mas marcá-lo aqui mostraria dois cards selecionados no
       mesmo passo. */
    selected: !choice.finishId && c.id === choice.colorId,
    available: true,
    render: renderFor(manId, modelId, choice.chassisId, c.id),
    swatch: c.hex,
  })));
}

/* O chassi de OUTRO modelo que mais se parece com o escolhido: o mesmo id se
   ele existir lá, senão o default daquele modelo. É o que faz o card do passo
   MODELO mostrar uma imagem plausível antes de o chassi ser reescolhido. */
function chassisIdWithin(modelId: string, wanted: string | null): string | null {
  const model = getModel(modelId)?.model;
  if (!model) return wanted;
  if (model.chassis.some((c) => c.id === wanted)) return wanted;
  return defaultChassis(model)?.id ?? null;
}

function renderFor(
  manufacturerId: string | null, modelId: string | null,
  chassisId: string | null, colorId: string | null,
): CardRender {
  return { url: renderUrl(manufacturerId, modelId, chassisId, colorId), chassisId };
}

/* ---------------- rendering ---------------- */

/* Troca o conteúdo da moldura pela miniatura 3D. O que estava lá (foto do
   manifesto ou a placa de iniciais) SAI: são a mesma informação dita pior, e
   empilhá-las deixaria a foto aparecendo por baixo do fundo transparente do
   render. */
/**
 * Troca o conteúdo de uma moldura pela miniatura 3D.
 *
 * `ns` é o PREFIXO das classes ('ts-card' ou 'ts-badge') e existe porque as duas
 * molduras são estilizadas por regras diferentes: `.ts-card__img` é
 * `object-fit: contain` numa caixa 16:10, `.ts-badge__img` é `cover` numa 16:9.
 * Emitir a classe do card dentro do crachá deixaria o render sem estilo E não
 * removeria a foto que já está lá — as duas ficariam empilhadas.
 */
function setRender(
  media: HTMLElement, url: string, alt: string, ns = 'ts-card', onFail?: () => void,
) {
  const img = el('img', ns + '__img ' + ns + '__img--render');
  img.decoding = 'async';
  img.alt = alt || '';
  clearMedia(media, ns);
  /* O ESQUELETO ENQUANTO A IMAGEM NÃO DECODIFICA. `.is-rendering` (a varredura
     de 2 px na base) não cobre este caso: ela nasceu quando o card já mostrava
     a cor e só o render 3D faltava. Com uma imagem REMOTA a moldura fica vazia
     até o `load`, e uma barrinha de 2 px sobre o vazio lê como card quebrado.
     A classe sai no load E no error — um esqueleto que gira para sempre é o
     mesmo defeito com outra animação. */
  media.classList.add('is-skeleton');
  const done = () => media.classList.remove('is-skeleton');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', () => {
    done();
    /* O manifesto disse que existe e o servidor discordou. Não insistir: cair
       direto no degrau seguinte é o que garante o "nunca uma moldura vazia". */
    img.remove();
    if (onFail) onFail();
    else if (!media.querySelector('.ts-ph')) media.appendChild(renderPlaceholder(alt, null));
  }, { once: true });
  img.src = url;
  media.insertBefore(img, media.firstChild);
}

/* Tira o que estiver na moldura ANTES de pôr a imagem nova. São a mesma
   informação dita pior, e empilhá-las deixaria a foto aparecendo por baixo do
   fundo transparente do render. A amostra do canto e a tag NÃO saem: elas não
   são conteúdo da moldura, são anotações sobre ela. */
function clearMedia(media: HTMLElement, ns: string) {
  for (const old of media.querySelectorAll(
    '.' + ns + '__img, .' + ns + '__fallback, .' + ns + '__logo, .ts-ph')) {
    old.remove();
  }
}

/**
 * Põe a imagem do card na moldura, descendo a CADEIA DE FALLBACK até algo
 * aparecer. A ordem é a de DECISIONS §4, e o último degrau nunca falha:
 *
 *   1. render pré-produzido `modelo/chassi/cor` (ou o vizinho que renderUrl()
 *      escolheu — a cadeia interna dele já correu);
 *   2. a foto do manifesto (`ModelDef.image` / `ChassisDef.image`);
 *   3. **o placeholder de silhueta**, com o nome do modelo no verde do projeto.
 *
 * NUNCA uma moldura vazia, e nunca o glifo de imagem quebrada do navegador.
 * Síncrono: `renderUrl()` responde do manifesto já carregado, então não há mais
 * fila, token de corrida nem cache de data URL para administrar — isso tudo
 * morreu junto com ui/preview.ts.
 */
function attachMedia(media: HTMLElement, item: CardItem) {
  const chassisId = item.render?.chassisId ?? null;
  const fallback = () => {
    if (!media.querySelector('.ts-ph')) media.appendChild(renderPlaceholder(item.name, chassisId));
  };
  const url = item.render?.url || null;
  if (url) { setRender(media, url, item.name, 'ts-card', fallback); return; }
  if (!item.image) { fallback(); return; }
  /* A foto do manifesto — degrau 2. Montada aqui e não por appendImage()
     justamente por causa do erro: a placa de iniciais daquela função é o
     fallback certo para um LOGO ou uma miniatura de cenário, e o errado para
     um caminhão, que tem uma silhueta para mostrar. */
  const img = el('img', 'ts-card__img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = item.name || '';
  img.addEventListener('error', () => { img.remove(); fallback(); }, { once: true });
  img.src = assetUrl(item.image);
  media.insertBefore(img, media.firstChild);
}

function buildCard(item: CardItem, stepIndex: number) {
  /* <button> so Enter/Space, focus rings and the tab order all come for free —
     a clickable <div> would need every one of those re-implemented. */
  const btn = el('button', 'ts-card');
  btn.type = 'button';
  btn.dataset.id = item.id;
  btn.setAttribute('aria-pressed', item.selected ? 'true' : 'false');
  if (item.selected) btn.classList.add('is-selected');
  if (!item.available) {
    btn.classList.add('is-disabled');
    /* aria-disabled + tabindex="-1", NÃO o atributo `disabled` — mesmo motivo
       das etapas do breadcrumb: `disabled` deixa o UA pintar seu próprio
       cinza por cima do que selector.css desenha. focusables() já filtra
       tabindex="-1", então o card sai do trap de foco junto.
       O nome acessível diz por que não dá para clicar; a tag "Em breve" é
       aria-hidden porque repetiria isso. */
    btn.setAttribute('aria-disabled', 'true');
    btn.tabIndex = -1;
    btn.setAttribute('aria-label', item.name + ' — em breve, ainda sem modelo 3D');
    btn.title = item.name + ' · em breve';
  }
  /* Per-brand tint for hover/selected rings: var(--ts-accent, var(--accent)). */
  if (item.accent) btn.style.setProperty('--ts-accent', item.accent);

  const media = el('span', 'ts-card__media');
  /* Card de cor. A moldura NÃO é pintada da cor: doze placas chapadas competindo
     entre si é o que faz o grid parecer uma cartela de tinta, e a cor que
     interessa é a que está no CAMINHÃO. O fundo é um estúdio neutro — o mesmo
     para os doze — e a identificação fica na amostra do canto e no nome.
     A variável ainda vai no elemento porque é dela que a amostra se pinta. */
  if (item.swatch) {
    media.classList.add('ts-card__media--color');
    media.style.setProperty('--ts-swatch', item.swatch);
  }
  if (item.logo) {
    /* Brand cards: the logo is centred in the media box and the name repeats it
       right below, so the image is decorative → empty alt. */
    appendImage(media, item.logo, '', 'ts-card__logo', 'ts-card__fallback', initials(item.name));
  } else if (item.render) {
    /* Modelo / chassi / cor: render pré-produzido → foto do manifesto →
       silhueta. Ver attachMedia(). */
    attachMedia(media, item);
  } else {
    appendImage(media, item.image, item.name, 'ts-card__img', 'ts-card__fallback', initials(item.name));
  }
  /* A amostra: um chip da cor pura no canto da moldura. É o que garante que a
     cor está dita mesmo quando o render ainda não chegou — e o que diz a cor de
     fábrica sem depender de como a luz do estúdio a devolveu no render. */
  if (item.swatch) {
    const chip = el('span', 'ts-card__swatch');
    chip.style.setProperty('--ts-swatch', item.swatch);
    chip.setAttribute('aria-hidden', 'true');
    media.appendChild(chip);
  }
  if (item.tag) {
    const tag = el('span', 'ts-card__tag', item.tag);
    if (!item.available) tag.setAttribute('aria-hidden', 'true');
    media.appendChild(tag);
  }
  btn.appendChild(media);

  const body = el('span', 'ts-card__body');
  body.appendChild(el('span', 'ts-card__name', item.name));
  if (item.sub) body.appendChild(el('span', 'ts-card__sub', item.sub));
  btn.appendChild(body);

  /* O listener só existe no card clicável. Com aria-disabled (e não `disabled`)
     o clique AINDA seria entregue, então não registrar é o que de fato impede a
     escolha — e deixa `choose()` sem um caminho para um id indisponível. */
  if (item.available) btn.addEventListener('click', () => choose(stepIndex, item.id));
  return btn;
}

/* No separator nodes between the steps: selector.css draws the connectors with
   `.ts-step + .ts-step::before`, and any node in between would break that
   adjacent-sibling match.

   Numbers and "done" are POSITIONS IN THE FLOW, not absolute step ids: the
   'truck' flow reads "1 Fabricante / 2 Modelo". */
function renderSteps() {
  /* Only ever called from renderStep(), i.e. with a live session. Taking it as
     a local is what says so — and what stops the null check being repeated on
     every read below. Same pattern in renderCards/renderStep/advance/finish. */
  const sess = session as Session;
  const seq = sess.seq;

  /* A single step is not a breadcrumb — one lone "1 Cenário" pill is pure noise
     above a grid the user is already looking at. Empty the row AND hide it, so
     its gap/padding does not leave a dead band either. */
  stepsRow.textContent = '';
  if (seq.length < 2) {
    stepsRow.classList.add('hidden');
    return;
  }
  stepsRow.classList.remove('hidden');

  const here = seq.indexOf(sess.step);
  seq.forEach((stepIndex: number, pos: number) => {
    /* Done = strictly before the current position. Those are the only ones the
       user may jump to; the later picks survive the jump (see goTo), so changing
       only the fabricante does not cost you the modelo. */
    const done = pos < here;
    const b = el('button', 'ts-step');
    b.type = 'button';
    if (done) {
      b.classList.add('is-done', 'is-clickable');
      b.addEventListener('click', () => goTo(stepIndex));
    } else {
      /* aria-disabled + tabindex="-1" instead of the `disabled` attribute: the
         ACTIVE step is also non-clickable, and a real `disabled` would let the
         UA's greyed-out button styling fight selector.css's `.is-active` look.
         This keeps the tab order just as tight with zero UA interference. */
      b.setAttribute('aria-disabled', 'true');
      b.tabIndex = -1;
    }
    if (pos === here) {
      b.classList.add('is-active');
      b.setAttribute('aria-current', 'step');
    }
    b.appendChild(el('span', 'ts-step__num', String(pos + 1)));
    b.appendChild(el('span', 'ts-step__label', STEPS[stepIndex].label));
    stepsRow.appendChild(b);
  });
}

/* ---------------- carrossel (fabricante e cor) ----------------
   Doze cores — ou seis marcas — num grid viram uma parede: o olho não compara
   doze coisas, compara duas ou três. Esses dois passos mostram TRÊS por vez e
   andam de três em três; cenário e modelo continuam grid, porque têm poucos
   cards e cabem inteiros.
   Os cards ficam TODOS no DOM — a janela é só recorte e translate, que é o que
   permite a troca deslizar em vez de piscar. O preço disso é que os cards fora
   da janela continuam focáveis, e é por isso que setPage() mexe no tabIndex: um
   Tab não pode levar o foco para um card que ninguém está vendo. */
const PER_PAGE = 3;
/** Passos que rolam em vez de empilhar. Só o cenário fica grid: tem 3 cards fixos.
    MODELO entrou aqui quando a IVECO passou a ter 4 S-Way (o 480, o 440, a edição
    Metallica e o 540). O grid é `repeat(3, 1fr)`, então o quarto card caía sozinho
    numa segunda linha — e a regra é `items.length > PER_PAGE`, logo uma marca com
    3 modelos ou menos continua exatamente como era, em grid.
    CHASSI entrou junto: três configurações é o caso comum, mas um 8x4 ou um
    tanque-tanque leva o modelo a quatro ou cinco, e a regra acima já cobre. */
const CAROUSEL_STEPS = new Set<StepId>(['manufacturer', 'model', 'chassis', 'color']);

let track: HTMLElement | null = null;
let navPrev: HTMLButtonElement | null = null;
let navNext: HTMLButtonElement | null = null;
let pageStart = 0;
let pageTotal = 0;

/* Seta em SVG, no traço de currentColor — mesma convenção dos view controls e do
   HUD. Nunca "‹": a plataforma escolheria a fonte, e o glifo não acompanharia
   nem a cor nem o peso do resto. */
function navIcon(dir: -1 | 1) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', dir < 0 ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5');
  svg.appendChild(path);
  return svg;
}

function setPage(start: number, animate: boolean) {
  if (!track) return;
  const max = Math.max(0, pageTotal - PER_PAGE);
  pageStart = Math.min(Math.max(0, start), max);

  /* Sem animação na primeira pintura: o grid acabou de aparecer com a cortina do
     overlay, e deslizá-lo de saída leria como se algo tivesse escorregado. */
  track.classList.toggle('is-instant', !animate);
  track.style.setProperty('--ts-page', String(pageStart));
  if (!animate) {
    /* Força o layout antes de devolver a transição, senão ela pega o valor novo
       na mesma recalculação e anima assim mesmo. */
    void track.offsetWidth;
    track.classList.remove('is-instant');
  }

  const cards = Array.from(track.children) as HTMLElement[];
  cards.forEach((card, i) => {
    const visible = i >= pageStart && i < pageStart + PER_PAGE;
    /* Já pode ser -1 por estar indisponível; nunca devolver o foco a um desses. */
    const disabled = card.classList.contains('is-disabled');
    card.tabIndex = visible && !disabled ? 0 : -1;
    card.classList.toggle('is-offscreen', !visible);
  });

  if (navPrev) navPrev.disabled = pageStart <= 0;
  if (navNext) navNext.disabled = pageStart >= max;
}

function buildCarousel(items: CardItem[], stepIndex: number) {
  track = el('div', 'ts-carousel__track');
  pageTotal = items.length;
  for (const item of items) track.appendChild(buildCard(item, stepIndex));

  /* O nome do passo entra no rótulo: "Anteriores" sozinho não diz anteriores do
     quê para quem chega pelo leitor de tela. */
  const what = STEPS[stepIndex].label.toLowerCase();
  navPrev = el('button', 'ts-carousel__nav');
  navPrev.type = 'button';
  navPrev.setAttribute('aria-label', 'Ver ' + what + ' anteriores');
  navPrev.title = 'Anteriores';
  navPrev.appendChild(navIcon(-1));
  navPrev.addEventListener('click', () => setPage(pageStart - PER_PAGE, true));

  navNext = el('button', 'ts-carousel__nav');
  navNext.type = 'button';
  navNext.setAttribute('aria-label', 'Ver mais ' + what);
  navNext.title = 'Próximos';
  navNext.appendChild(navIcon(1));
  navNext.addEventListener('click', () => setPage(pageStart + PER_PAGE, true));

  const win = el('div', 'ts-carousel__win');
  win.appendChild(track);

  cardsEl.appendChild(navPrev);
  cardsEl.appendChild(win);
  cardsEl.appendChild(navNext);

  /* Abre na página da cor que já está no caminhão: reabrir o passo e não ver a
     seleção seria o mesmo que abrir na página errada. */
  const sel = items.findIndex((i) => i.selected);
  setPage(Math.floor(Math.max(0, sel) / PER_PAGE) * PER_PAGE, false);
}

function renderCards(stepIndex: number) {
  const step = STEPS[stepIndex];
  cardsEl.className = 'ts-cards ' + step.grid;
  cardsEl.setAttribute('aria-label', step.aria);
  cardsEl.textContent = '';
  /* O carrossel anterior foi embora junto com o textContent; largar as
     referências é o que impede setPage() de escrever num nó já descartado
     (as setas do teclado continuam ligadas ao documento). */
  track = null;
  navPrev = null;
  navNext = null;
  pageStart = 0;
  pageTotal = 0;

  const items = itemsFor(stepIndex, (session as Session).choice);
  /* Carrossel só onde a lista é longa o bastante para virar parede — e só se ela
     REALMENTE passou de uma página: três marcas num carrossel seriam três cards
     com duas setas mortas do lado. */
  if (CAROUSEL_STEPS.has(step.id) && items.length > PER_PAGE) {
    cardsEl.classList.add('ts-cards--carousel');
    buildCarousel(items, stepIndex);
  } else {
    for (const item of items) cardsEl.appendChild(buildCard(item, stepIndex));
  }
  return items;
}

function renderStep(focus: boolean) {
  const s = session as Session;
  const stepIndex = s.step;
  const step = STEPS[stepIndex];
  const here = s.seq.indexOf(stepIndex);

  overlay.dataset.flow = s.flow;
  overlay.dataset.step = step.id;
  titleEl.textContent = step.title;
  subEl.textContent = step.sub;

  const items = renderCards(stepIndex);
  /* Dead end: a manufacturer with no models should be impossible (catalog/catalog.ts
     drops those), but if it happens, fall back one step IN THIS FLOW instead of
     stranding the user on an empty grid with no "Próximo" button to escape
     through. At position 0 there is nowhere to fall back to, so the empty grid
     stands and "Cancelar" is the way out (which is why partial flows default to
     cancellable). */
  if (!items.length && here > 0) {
    s.step = s.seq[here - 1];
    renderStep(focus);
    return;
  }

  renderSteps();
  const showBack = here > 0;
  backBtn.classList.toggle('hidden', !showBack);
  cancelBtn.classList.toggle('hidden', !s.cancellable);
  /* First step of a non-cancellable flow has no actions at all — hide the whole
     row so its padding/gap does not leave a dead band under the cards. */
  footEl.classList.toggle('hidden', !showBack && !s.cancellable);

  if (focus) focusCards();
}

function focusCards() {
  /* Nunca aterrissa num card "Em breve": ele é tabindex="-1", então focá-lo
     tiraria o teclado do trap e o próximo Tab recomeçaria do topo. */
  const target = cardsEl.querySelector<HTMLElement>('.ts-card.is-selected:not(.is-disabled)')
    || cardsEl.querySelector<HTMLElement>('.ts-card:not(.is-disabled)')
    || (backBtn.classList.contains('hidden') ? null : backBtn)
    || overlay;
  target.focus();
}

/* ---------------- navigation ---------------- */

function goTo(stepIndex: number) {
  if (!session) return;
  /* Only ever land on a step this flow actually contains — a 'truck' flow that
     fell through to the cenário grid would be exactly the surprise the partial
     flows exist to avoid. */
  if (!session.seq.includes(stepIndex)) return;
  session.step = stepIndex;
  renderStep(true);
}

function goBack() {
  if (!session) return;
  const here = session.seq.indexOf(session.step);
  if (here > 0) goTo(session.seq[here - 1]);
}

/* Last step of the flow resolves; anything else moves on. This is the only
   place that decides "are we done", which is why 'map' finishing after one card
   needs no special case. */
function advance() {
  const sess = session as Session;
  const here = sess.seq.indexOf(sess.step);
  if (here < 0 || here === sess.seq.length - 1) finish();
  else goTo(sess.seq[here + 1]);
}

function choose(stepIndex: number, id: string) {
  if (!session) return;
  const choice = session.choice;

  if (stepIndex === STEP_INDEX.map) {
    choice.envId = id;
    /* O CENÁRIO É O PRIMEIRO PASSO E O ÚLTIMO A SER PRECISO — a janela mais
       larga que este assistente oferece. Daqui até `finish()` faltam quatro
       cliques (fabricante, modelo, chassi e cor), e o da cor é justamente o que
       o usuário demora olhando. `set.glb` + HDRI descem nesse tempo.
       CANCELA O ANTERIOR: repicar o cenário é comum (a trilha de migalhas
       convida a isso), e um `distrito-industrial` de 7 MB em voo não pode ficar
       roubando vaga do `armazem` que o usuário acabou de escolher. */
    cancelPrefetch('env');
    prefetchEnvironment(getEnvironment(id));
  } else if (stepIndex === STEP_INDEX.manufacturer) {
    /* Switching brands invalidates the model: keeping "S730" highlighted under
       Volvo would be a lie. Re-picking the SAME brand keeps it, which is the
       whole point of the clickable breadcrumb. */
    if (choice.manufacturerId !== id) { choice.modelId = null; choice.chassisId = null; }
    choice.manufacturerId = id;
  } else if (stepIndex === STEP_INDEX.model) {
    /* Mesma lógica um nível abaixo: um chassi pertence a UM modelo, e manter
       "6x4" marcado ao trocar de modelo seria uma mentira do mesmo tipo. */
    if (choice.modelId !== id) choice.chassisId = null;
    choice.modelId = id;
    /* A SEQUÊNCIA É RECALCULADA A CADA ESCOLHA DE MODELO.
       ---------------------------------------------------------------------
       `seq` é dado de SESSÃO, não constante — foi feita para ser a
       subsequência que ESTE fluxo caminha —, então recalculá-la aqui é usar o
       mecanismo como ele foi desenhado, e não um caso especial colado por
       cima. Tudo que lê a posição (a trilha de migalhas, "Voltar", advance(),
       clampStep) já pergunta à sequência, então nada mais precisa saber disto.

       RECALCULAR É O PONTO, não "remover": o seletor não fecha entre um clique
       e outro, e quem vier de um modelo de chassi único (ou de uma edição
       especial) de volta para um modelo de três configurações precisa dos
       passos de volta. Ver seqFor(). */
    session.seq = seqFor(session.flow, choice);
    /* Os passos que a sequência acabou de tirar não vão ser mostrados, então
       ninguém vai escolhê-los — e a escolha resolvida tem de sair COMPLETA de
       qualquer jeito: é ela que o estúdio aplica e que vai para o localStorage.
       Numa edição especial a cor simplesmente não é do usuário (a película já é
       a pintura); num modelo de chassi único, a configuração é a que existe. */
    if (!session.seq.includes(STEP_INDEX.chassis)) {
      choice.chassisId = defaultChassis(getModel(id)?.model)?.id ?? null;
    }
    if (!session.seq.includes(STEP_INDEX.color) && !choice.colorId) {
      choice.colorId = defaultChoice().colorId;
    }
    /* O passo seguinte vai pedir uma imagem por card. Começar a baixar as deste
       modelo agora sobrepõe a rede ao clique que o usuário ainda vai dar, em
       vez de deixá-lo esperando na frente de esqueletos. É o que sobrou do
       antigo warmCabPreview(), e custa 1/1000 do que ele custava — nenhuma
       geometria, nenhum contexto WebGL, só o cache HTTP. */
    warmRenders(choice);
    warmCab(choice);
  } else if (stepIndex === STEP_INDEX.chassis) {
    choice.chassisId = id;
    warmRenders(choice);
    warmCab(choice);
  } else {
    /* UM PASSO, DOIS TIPOS DE CARD. O passo da cor lista os ACABAMENTOS de
       fábrica antes das tintas (ver `itemsFor`), e o id deles chega prefixado
       para os dois nunca colidirem: `metallica` é um acabamento do S-Way e
       poderia, um dia, ser também o nome de uma tinta de catálogo.

       Escolher tinta LIMPA o acabamento, e vice-versa — são a mesma pergunta
       ("de que cor este caminhão"), respondida de duas formas. O `colorId`
       sobrevive por baixo de um acabamento de propósito: ele continua sendo a
       cor do IMPLEMENTO, e é o que faz voltar do Metallica para a paleta cair
       na tinta que já estava escolhida em vez de num padrão. */
    if (id.startsWith(FINISH_PREFIX)) choice.finishId = id.slice(FINISH_PREFIX.length);
    else { choice.colorId = id; choice.finishId = null; }
  }

  advance();
}

/* Pré-carrega as imagens da PRIMEIRA página do passo de cor deste caminhão.
   Só a primeira: o carrossel mostra três por vez, e baixar 26 renders para
   mostrar 3 é trocar um problema de latência por um de banda. */
function warmRenders(choice: Choice) {
  const found = getModel(choice.modelId);
  if (!found) return;
  const urls = colorsFor(choice.manufacturerId).slice(0, PER_PAGE * 2).map((c) =>
    renderUrl(found.manufacturer.id, found.model.id, choice.chassisId, c.id));
  prefetchRenders(urls);
}

/* Começa a baixar a GEOMETRIA do cavalo — o irmão pesado de warmRenders(), que
   só aquece miniaturas.
   ---------------------------------------------------------------------------
   CHAMADO NOS DOIS PASSOS, e a aposta é diferente em cada um:

   - no passo do MODELO ainda não há chassi escolhido, então `defaultChassis()`
     decide. É uma aposta de verdade — e vale a pena porque a maioria dos
     modelos tem UM chassi só (aí `seqFor` nem mostra o passo e a aposta é
     certeza), e porque quando há vários, dois deles costumam apontar para o
     MESMO `.glb` (os pares byte-idênticos que `resolveChassisFile` documenta);
   - no passo do CHASSI a aposta acabou: o arquivo é o que vai ser montado.

   `cancelPrefetch('cab')` antes de cada um porque errar a aposta é o caso
   NORMAL, não a exceção: passear por seis modelos são seis apostas, e sem o
   cancelamento seriam seis cabines em voo disputando as duas vagas de
   `MAX_IN_FLIGHT` com o cenário e com o implemento — ou seja, o prefetch
   atrapalhando a carga que ele existe para adiantar. O que já BAIXOU não é
   esquecido (ver `cancelPrefetch`), então voltar um passo é grátis. */
function warmCab(choice: Choice) {
  const found = getModel(choice.modelId);
  if (!found) return;
  const chassis = found.model.chassis.find((c) => c.id === choice.chassisId)
    || defaultChassis(found.model);
  if (!chassis) return;
  const file = fileOf(found.model, chassis);
  if (!file) return;                    // chassi "Em breve": não há o que baixar
  cancelPrefetch('cab');
  prefetch([file], 'cab');
}

/* ---------------- open / close lifecycle ---------------- */

function settle(value: ResolvedChoice | null) {
  if (!session) return;
  const { resolve, prevFocus } = session;
  session = null;

  detachGlobalListeners();
  overlay.classList.remove('is-open');
  overlay.classList.add('hidden');

  /* Give focus back to whatever had it before we stole it — otherwise focus
     lands on <body> and the next Tab restarts from the top of Ankaa's page.
     For a badge-triggered flow that is the badge itself, which is focusable
     precisely because it is the trigger. */
  if (prevFocus && typeof prevFocus.focus === 'function' && prevFocus.isConnected) {
    prevFocus.focus();
  }
  resolve(value);
}

function finish() {
  /* backfill, not just spread: in a partial flow the steps that never rendered
     contribute their carried-through ids here, and the promise has to resolve
     complete. */
  const choice = backfill({ ...(session as Session).choice });
  lastChoice = choice;
  saveChoice(choice);
  /* Both badges are filled and un-hidden BEFORE settle() hides the overlay:
     ui/loader.ts's outro measures `#ts-badge .ts-badge__media`'s layout box to fly
     the loading photo into it, and a hidden node has no box. Do not reorder. */
  syncMapBadgeFromChoice(choice);
  syncBadgeFromChoice(choice);
  settle(choice);

  /* Fire listeners on the NEXT frame, after the browser has painted the closed
     overlay: studio.ts reacts by loading a cab/HDRI, and the #loading spinner it
     shows must be visible, not hidden behind a still-painted selector.

     `paintFrame()` e não `requestAnimationFrame` cru — MEDIDO: rAF não dispara
     numa aba escondida, e um `emit()` pendurado nele significa que a escolha
     concluída NUNCA chega ao studio.ts. O seletor fecha, o crachá já mostra a
     cor nova, e o caminhão continua com a antiga. Ver a nota em ui/loader.ts.

     NOTE for studio.ts: listeners fire on EVERY completed selection, including the
     one whose promise openSelector() just resolved. Make the handler idempotent
     (bail when the incoming choice equals what is already loaded) — you want
     that anyway, so that re-confirming the same truck does not re-download it,
     and the 'map' flow in particular resolves a choice whose truck half is
     byte-for-byte what is already on screen. */
  void paintFrame().then(() => emit(choice));
}

/**
 * Open the selector.
 *
 * `flow` picks WHICH steps run. All four resolve the same complete shape, so
 * callers never branch on it:
 *   'full'  (default) cenário → fabricante → modelo → cor
 *   'map'   cenário only; the current truck and colour are carried through
 *   'truck' fabricante → modelo → cor; the current cenário is carried through
 *   'color' cor only; everything else is carried through
 *
 * `cancellable` defaults to false for 'full' (the first boot must produce a
 * choice) and true for the partial flows (the user already has a working
 * configuration on screen, so backing out has a sane meaning).
 *
 * There is no "start on step N" option: a flow always opens on its own first
 * step. The badges are what made one unnecessary — each of them opens the flow
 * that IS the part of the wizard it stands for, which is the same request said
 * in terms callers already have to know about.
 *
 * @param {{ flow?: 'full'|'map'|'truck'|'color',
 *           choice?: { envId, manufacturerId, modelId, colorId },
 *           cancellable?: boolean }} [opts]
 * @returns {Promise<{ envId, manufacturerId, modelId, colorId }|null>}
 */
export function openSelector(opts: {
  flow?: FlowId;
  choice?: Choice | null;
  cancellable?: boolean;
} = {}): Promise<ResolvedChoice | null> {
  initSelector();

  /* Exactly one pending promise, ever. A second open while one is pending means
     the first request is stale (e.g. React remounted the page, or a badge was
     hit before boot's selector resolved). We resolve the stale one with null and
     hand the overlay to the new caller — the alternative, dropping the old
     resolve on the floor, would hang whoever awaited it forever. */
  let prevFocus: HTMLElement | null = null;
  if (session) {
    prevFocus = session.prevFocus;           // focus was already inside the overlay
    const stale = session;
    session = null;
    detachGlobalListeners();
    stale.resolve(null);
  } else {
    const active = document.activeElement;
    prevFocus = active instanceof HTMLElement ? active : null;
  }

  const flow: FlowId = opts.flow && FLOWS[opts.flow] ? opts.flow : 'full';

  const choice = sanitize(opts.choice || lastChoice || loadChoice() || defaultChoice());
  /* A partial flow can never repair a stale id it does not show, so repair it
     up front — then every step it DOES show renders with a real selection. */
  if (flow !== 'full') backfill(choice);
  /* DEPOIS do backfill: seqFor() pergunta ao MODELO quantos chassis ele tem, e
     num fluxo parcial o modelo só existe depois de o backfill o repor. */
  const seq = seqFor(flow, choice);

  return new Promise<ResolvedChoice | null>((resolve) => {
    session = {
      resolve,
      flow,
      seq,
      cancellable: opts.cancellable == null ? flow !== 'full' : !!opts.cancellable,
      step: clampStep(seq[0], choice, seq),
      choice,
      prevFocus,
    };

    attachGlobalListeners();
    overlay.classList.remove('hidden');
    /* Force a reflow between `display:none` coming off and `.is-open` going on,
       so selector.css's entrance transition actually runs instead of being
       collapsed into the same style recalculation. */
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    renderStep(true);
  });
}

/* ---------------- keyboard: focus trap + Esc ---------------- */

function focusables(): HTMLElement[] {
  return Array.from(overlay.querySelectorAll<HTMLElement>(FOCUS_SEL)).filter((node) =>
    node.getAttribute('tabindex') !== '-1'      // the inert breadcrumb steps
    && !node.classList.contains('hidden')
    && node.offsetParent !== null);             // also excludes the hidden .ts-steps row
}

function onKeyDown(e: KeyboardEvent) {
  /* The engine's DOM survives route changes; if the studio is detached these
     listeners are still live (they are removed on close, not on unmount), so
     bail rather than fight for focus on a page that no longer shows us. */
  if (!session || !isMounted()) return;

  if (e.key === 'Escape') {
    /* Swallow it either way: a non-cancellable selector (the first-ever boot)
       must not close, and it must not let vehicle/livery.ts's document-level Esc run
       behind the overlay either. */
    e.preventDefault();
    e.stopPropagation();
    if (session.cancellable) settle(null);
    return;
  }

  /* Setas paginam o carrossel de cores. Só quando ele existe, e só quando o foco
     está DENTRO do overlay: um passo sem carrossel não pode engolir as setas de
     quem está navegando a página por trás. */
  if (track && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      && overlay.contains(document.activeElement)) {
    e.preventDefault();
    setPage(pageStart + (e.key === 'ArrowLeft' ? -PER_PAGE : PER_PAGE), true);
    return;
  }

  if (e.key !== 'Tab') return;

  /* Modal means modal: Tab cycles inside the overlay instead of walking off
     into Ankaa's chrome, which is still in the DOM behind the scrim. */
  const list = focusables();
  if (!list.length) {
    e.preventDefault();
    overlay.focus();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !overlay.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}

/* Belt and braces for the trap: Tab handling covers keyboards, this covers
   everything else that can move focus out (programmatic focus, screen-reader
   navigation, browser find-in-page) — including the two badges, which are now
   focusable and sit right behind the scrim. */
function onFocusIn(e: FocusEvent) {
  if (!session || !isMounted()) return;
  if (overlay.contains(e.target as Node)) return;
  focusCards();
}

function attachGlobalListeners() {
  /* Capture phase so we see Esc/Tab before vehicle/livery.ts's document listener. */
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('focusin', onFocusIn, true);
}

function detachGlobalListeners() {
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('focusin', onFocusIn, true);
}

/* ---------------- badges ---------------- */

/* O nome acessível do card do caminhão diz o que o clique FAZ e o que o card
   MOSTRA. Ele é a ÚNICA coisa que diz a primeira metade agora que não há rótulo
   visível nenhum no card — daí ele se montar em um lugar só, e daí carregar
   também a cor: para um leitor de tela o card é o resumo do veículo em cena. */
/**
 * 'Scania S 2016' — a marca mais o modelo, SEM repetir a marca.
 *
 * Com a taxonomia nova o `modelId` nomeia a GERAÇÃO, e o nome dela costuma já
 * trazer a montadora dentro ('Scania S 2016', 'Volvo FH 2020'), porque é assim
 * que a indústria a chama. Concatenar às cegas dava "Scania Scania S 2016" no
 * nome acessível do crachá e na linha de estado.
 *
 * Comparação por prefixo e sem diferenciar caixa: `'Mercedes-Benz Actros'` sob
 * a marca `'Mercedes-Benz'` é o mesmo caso. Um modelo que só COMEÇA parecido
 * ('Scania' vs 'Scanialight') é separado pelo teste de limite de palavra.
 */
export function truckLabel(
  manufacturerName: string | null | undefined, modelName: string | null | undefined,
): string {
  const man = (manufacturerName || '').trim();
  const model = (modelName || '').trim();
  if (!man) return model;
  if (!model) return man;
  const lower = model.toLowerCase();
  const manLower = man.toLowerCase();
  if (lower === manLower) return model;
  if (lower.startsWith(manLower) && /[\s-]/.test(model.charAt(man.length))) return model;
  return man + ' ' + model;
}

function paintBadgeLabels(info: BadgeInfo) {
  const truck = truckLabel(info.manufacturerName, info.modelName);
  const verb = 'Trocar caminhão';
  /* A cor entra no nome acessível SÓ quando ela é escolha do usuário. Numa
     edição especial a película é o produto, e anunciar uma tinta ao lado dela
     descreveria uma escolha que o seletor não vai oferecer. */
  const what = badgeSpecial
    ? truck
    : [truck, info.colorName].filter(Boolean).join(' · ');
  badge.setAttribute('aria-label', what ? verb + ' (atual: ' + what + ')' : verb);
  badge.title = what ? verb + ' · ' + what : verb;
}

/**
 * Fill the bottom-left truck card. Pass null to hide it.
 *
 * Ele é o gatilho do seletor de caminhão INTEIRO agora (o card de cor e o botão
 * "Trocar caminhão" saíram os dois), então além do caminhão ele carrega a
 * amostra da tinta no canto da moldura — é a única coisa na tela que diz que
 * cor está aplicada. Ver buildBadge().
 */
export function setBadge(info: BadgeInfo | null) {
  initSelector();
  if (!info) {
    badge.classList.add('hidden');
    return;
  }
  lastBadgeInfo = { ...info };

  /* A amostra é preservada: ela é filha de __media e não é conteúdo dela.
     `textContent = ''` levaria o chip junto e o crachá perderia a cor. */
  clearMedia(badgeMedia, 'ts-badge');
  /* CADEIA DE FALLBACK, a mesma dos cards: render → foto do manifesto →
     silhueta. Nunca uma moldura vazia, nem por um quadro — o crachá é desenhado
     no meio de applyChoice(), ANTES de a cortina subir, e é a caixa que
     ui/loader.ts mede para voar a foto até aqui. */
  const url = info.render?.url || null;
  const fallbackToPh = () => {
    if (!badgeMedia.querySelector('.ts-ph')) {
      badgeMedia.appendChild(renderPlaceholder(info.modelName || '', info.render?.chassisId ?? null));
    }
  };
  if (url) {
    setRender(badgeMedia, url, info.modelName || '', 'ts-badge', fallbackToPh);
  } else if (info.modelImage) {
    appendImage(
      badgeMedia, info.modelImage, info.modelName || '',
      'ts-badge__img', 'ts-badge__fallback', initials(info.modelName),
    );
  } else {
    fallbackToPh();
  }

  badgeName.textContent = info.modelName || '';
  badgeSub.textContent = info.modelSubtitle || '';
  badgeSub.classList.toggle('hidden', !info.modelSubtitle);

  /* `badgeSpecial` manda: setBadge() roda em toda aplicação e não sabe se o
     cavalo é película, então pintar a amostra sem consultá-lo devolveria à tela
     a cor que setBadgeSpecialEdition() acabou de tirar dela. */
  paintBadgeSwatch(badgeSpecial ? null : info.colorHex);

  if (info.logo) {
    badgeLogo.alt = info.manufacturerName || '';
    badgeLogo.classList.remove('hidden');
    badgeLogo.src = assetUrl(info.logo);
  } else {
    /* No text fallback here: the corner slot is logo-shaped, and the model name
       right beside it already says which truck this is. */
    badgeLogo.removeAttribute('src');
    badgeLogo.classList.add('hidden');
  }

  paintBadgeLabels(info);
  badge.classList.remove('hidden');
}

function paintBadgeSwatch(hex: string | null | undefined) {
  /* Escondido, não cinza: uma amostra "sem cor" seria uma cor a menos de
     distância de ser lida como a tinta do caminhão. */
  if (!hex) { badgeSwatch.classList.add('hidden'); return; }
  badgeSwatch.style.setProperty('--ts-swatch', hex);
  badgeSwatch.classList.remove('hidden');
}

/**
 * Troca SÓ a cor mostrada no card do caminhão — a amostra do canto e o nome
 * acessível — mantendo modelo, foto e logo.
 *
 * Existe porque `applyColor()` (studio.ts) roda por caminhos que não sabem qual
 * caminhão está na tela: o atalho de "só a cor mudou" não passa por
 * `resolveChoice`. Sem isto, cada troca de cor teria de repintar o crachá
 * inteiro — e repintar a moldura descartaria a imagem já decodificada para pôr
 * a mesma de volta, piscando.
 */
export function setBadgeColor(
  colorName: string | null, hex: string | null, finishLabel?: string | null,
) {
  initSelector();
  if (!lastBadgeInfo) return;
  lastBadgeInfo.colorName = colorName;
  lastBadgeInfo.colorHex = hex;
  lastBadgeInfo.finishLabel = finishLabel ?? null;
  paintBadgeSwatch(badgeSpecial ? null : hex);
  paintBadgeLabels(lastBadgeInfo);
}

/**
 * Liga/desliga o modo "edição especial" do card do caminhão.
 *
 * Substituiu `setBadgeFlow()`, que existia para trocar o fluxo do card entre
 * `'color'` e `'truck'`. O card abre o fluxo do caminhão INTEIRO agora, sempre,
 * e o passo da cor sai dele sozinho quando o modelo é película (`seqFor`) — não
 * há mais fluxo a escolher, só aparência a ajustar.
 *
 * O que muda: a amostra de tinta some. A película É a pintura, e mostrar uma
 * cor escolhível ao lado dela seria oferecer o que não existe.
 */
export function setBadgeSpecialEdition(on: boolean) {
  initSelector();
  badgeSpecial = on;
  if (on) paintBadgeSwatch(null);
  else if (lastBadgeInfo) paintBadgeSwatch(lastBadgeInfo.colorHex);
  if (lastBadgeInfo) paintBadgeLabels(lastBadgeInfo);
}

/** @param {boolean} visible */
export function showBadge(visible: boolean) {
  initSelector();
  badge.classList.toggle('hidden', !visible);
}

/**
 * Fill the top-left scene card. Pass null to hide it.
 * @param {{ envName?: string, envSubtitle?: string, envThumb?: string }|null} info
 */
export function setMapBadge(info: MapBadgeInfo | null) {
  initSelector();
  if (!info) {
    mapBadge.classList.add('hidden');
    return;
  }

  mapBadgeMedia.textContent = '';
  appendImage(
    mapBadgeMedia, info.envThumb, info.envName || '',
    'ts-mapbadge__img', 'ts-mapbadge__fallback', initials(info.envName),
  );

  mapBadgeName.textContent = info.envName || '';

  /* The card is a button now, so its accessible name has to say what pressing it
     does AND what it currently shows — the thumbnail alone announces neither.
     The subtitle has no line of its own on this two-line card, so it rides along
     in the tooltip rather than being thrown away. */
  const desc = [info.envName, info.envSubtitle].filter(Boolean).join(' · ');
  mapBadge.setAttribute(
    'aria-label',
    info.envName ? 'Trocar cenário (atual: ' + info.envName + ')' : 'Trocar cenário',
  );
  mapBadge.title = desc ? 'Trocar cenário · ' + desc : 'Trocar cenário';

  mapBadgeFilled = true;
  mapBadge.classList.remove('hidden');
}

/** @param {boolean} visible */
export function showMapBadge(visible: boolean) {
  initSelector();
  /* Un-hiding a card nobody ever filled would put an empty plate over the
     canvas. The catalog knows the answer, so fill it from the current choice
     rather than refuse — this is the returning-visitor path, where studio.ts goes
     straight into the studio without the selector ever running. */
  if (visible && !mapBadgeFilled) {
    syncMapBadgeFromChoice(sanitize(lastChoice || loadChoice() || defaultChoice()));
  }
  mapBadge.classList.toggle('hidden', !visible);
}

/* Keep the badges honest even if studio.ts forgets to refresh them: each badge is
   the trigger for its own flow, so a stale one would re-open the selector
   preselected with the wrong truck/scene/colour. studio.ts may still call
   setBadge()/setMapBadge() to override. */
function syncBadgeFromChoice(choice: Choice) {
  const man = getManufacturer(choice.manufacturerId);
  const model = man ? man.models.find((m) => m.id === choice.modelId) : null;
  if (!man || !model) return;
  const chassis: ChassisDef | null =
    model.chassis.find((c) => c.id === choice.chassisId) || defaultChassis(model);
  const color = getColor(choice.colorId);
  setBadge({
    modelName: model.name,
    /* O CHASSI ENTRA NO SUBTÍTULO. Ele é um passo do seletor agora, então o
       crachá tem de dizer qual configuração está na tela — senão a única
       diferença visível entre um 6x4 e um 4x2 seria a contagem de rodas no
       render, que nem sempre existe ainda. Só quando ele diz algo: um chassi
       sintético ('Padrão') repetiria o subtítulo do modelo. */
    modelSubtitle: chassisSubtitle(model.subtitle, chassis),
    modelImage: chassis?.image || model.image,
    manufacturerName: man.name,
    logo: man.logo,
    render: renderFor(man.id, model.id, chassis?.id ?? null, choice.colorId),
    colorName: color?.name ?? null,
    colorHex: color?.hex ?? null,
    finishLabel: color ? FINISH_LABEL[color.finish] : null,
  });
}

/**
 * 'Highline · 6x4 S730' — o subtítulo do modelo mais a configuração, SEM
 * repetir a configuração.
 *
 * A deduplicação não é preciosismo: durante a migração de taxonomia os dois
 * lados dizem a mesma coisa. O subtítulo antigo do modelo já terminava com a
 * rodagem ('Highline · 6x4'), porque era ali que o chassi se escondia; o nome
 * do chassi novo COMEÇA com ela ('6x4 S730'), porque agora é ali que ele mora.
 * Concatenar às cegas daria 'Highline · 6x4 · 6x4 S730'.
 * Então: se o subtítulo termina no primeiro TOKEN do nome do chassi, esse
 * pedaço sai do subtítulo — o nome do chassi é a fonte mais nova e mais
 * específica das duas, e é ele que fica inteiro.
 */
export function chassisSubtitle(
  modelSubtitle: string | null | undefined, chassis: ChassisDef | null | undefined,
): string {
  /* DUAS LIMPEZAS, e as duas pela mesma razão de sempre: o manifesto guarda a
     LISTA de configurações no subtítulo do modelo, e o nome do chassi carrega
     um qualificador entre parênteses. Sem filtrar, a cortina anunciava
     `4x2 · 6x2a-tl · 6x2 (eixo de apoio elevatorio)` — a lista inteira, mais o
     escolhido, mais a explicação dele. Aqui cabe uma linha: o que o modelo é
     ("AS Highway", quando existe) e qual configuração está na tela ("6x2").
     Toda a maquinaria de aparar sufixo repetido saiu junto: ela existia para
     desfazer a duplicação que a lista causava, e sem a lista não há o que
     desfazer. */
  const base = cleanModelSubtitle(modelSubtitle);
  const name = chassisTitle((chassis?.name || '').trim());
  /* 'Padrão' é o chassi SINTÉTICO de um modelo que não declara nenhum — ele não
     é uma configuração, é a ausência de uma, e anunciá-lo seria inventar uma
     escolha que o catálogo não oferece. */
  if (!name || name === 'Padrão' || base === name) return base;
  return base ? base + ' · ' + name : name;
}

function syncMapBadgeFromChoice(choice: Choice) {
  const env = getEnvironment(choice.envId);
  if (!env) return;
  setMapBadge({
    envName: env.name,
    envSubtitle: env.subtitle,
    envThumb: env.thumb,
  });
}

/* A badge press opens the part of the wizard that badge stands for — o card do
   cenário abre o passo do cenário, o card do caminhão abre marca → modelo →
   chassi → cor —, com a escolha atual preselecionada, e IS cancellable: o
   usuário já tem um caminhão na tela, então desistir tem um significado são aqui
   (ao contrário do primeiro boot). The completed selection reaches studio.ts
   through the onChange listeners, so there is nothing to await. */
function openFlow(flow: FlowId) {
  /* Never let a badge press steal an overlay that is already up: openSelector's
     stale-session rule would resolve the pending promise with null, and boot's
     `await openSelector()` would read that as a cancel the user never made. The
     overlay's scrim blocks the pointer anyway — this is the keyboard path. */
  if (session) return;
  openSelector({ flow, choice: lastChoice || loadChoice() || defaultChoice() });
}

/* ---------------- change notification ---------------- */

/**
 * Subscribe to completed selections. Fired with the final choice every time the
 * user finishes a flow, partial ones included.
 * @param {(choice: { envId: string, manufacturerId: string, modelId: string }) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onChange(fn: (choice: ResolvedChoice) => void): () => void {
  if (typeof fn !== 'function') return () => {};
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function emit(choice: ResolvedChoice) {
  /* One broken listener must not stop the others — and must not take down the
     badge click handler that called us. */
  for (const fn of listeners.slice()) {
    try {
      fn(choice);
    } catch (err) {
      console.error('[truck-studio] listener de onChange falhou', err);
    }
  }
}
