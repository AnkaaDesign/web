/* Card selector (cenário → fabricante → modelo → COR) + the three badge cards
   that stay on the viewport afterwards: the SCENE badge top-left, and the TRUCK
   and COLOUR badges bottom-left.

   O passo da cor entrou quando a sidebar de pintura saiu. Ele não é um seletor
   de hex: cada card é o CAVALO ESCOLHIDO renderizado naquela cor (ui/preview.ts
   desenha as miniaturas fora da tela), porque a mesma tinta fica diferente em
   cada lataria e escolher cor em quadradinho é escolher no escuro. A paleta vem
   de catalog/colors.ts — hoje embutida, amanhã a tabela `Paint` da API.
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
import { root, $opt, isMounted } from '../core/dom';
import {
  catalog, getEnvironment, getManufacturer, getModel, defaultChoice, assetUrl,
  saveChoice, loadChoice,
} from '../catalog/catalog';
import type { Choice, ResolvedChoice } from '../catalog/catalog';
import {
  colors, getColor, defaultColor, defaultColorId, FINISH_LABEL,
} from '../catalog/colors';
import type { PaintColorDef } from '../catalog/colors';
import { cabPreview, peekCabPreview, hasCabPreview, warmCabPreview } from './preview';
import type { PaintFinish } from '../vehicle/paint';

/** Which steps a flow walks; see FLOWS. */
export type FlowId = 'full' | 'map' | 'truck' | 'color';
/** The four steps, by the id STEPS uses. */
export type StepId = 'map' | 'manufacturer' | 'model' | 'color';

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

/** O que um card precisa para pedir a miniatura 3D dele a ui/preview.ts. */
interface CardPreview {
  cabId: string;
  hex: string;
  finish: PaintFinish;
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
   * Render 3D desta cabine nesta cor, no lugar da foto do manifesto. É o que
   * faz o passo da cor existir — não há doze fotos de estúdio para doze cores —
   * e o que faz o card do MODELO já mostrar a cor escolhida. Chega assíncrono e
   * substitui o que estiver no lugar; null = card com foto, como antes.
   */
  preview?: CardPreview | null;
  /** hex da cor que este card representa; pinta a moldura antes de o render chegar */
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
  manufacturerName?: string | null;
  logo?: string | null;
}

/** What setMapBadge() paints onto the top-left scene card. */
export interface MapBadgeInfo {
  envName?: string | null;
  envSubtitle?: string | null;
  envThumb?: string | null;
}

/** What setColorBadge() paints onto the bottom-left colour card. */
export interface ColorBadgeInfo {
  colorName?: string | null;
  /** hex sRGB da amostra */
  hex?: string | null;
  /** 'Metálica', 'Sólida'… — só o rótulo, o card não decide nada sobre tinta */
  finishLabel?: string | null;
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
    id: 'color',
    label: 'Cor',
    title: 'Escolha a cor',
    sub: 'A pintura do cavalo mecânico — cada card é o modelo escolhido, renderizado naquela cor.',
    grid: 'ts-cards--colors',
    aria: 'Cores disponíveis',
  },
];

const STEP_INDEX: Record<StepId, number> = { map: 0, manufacturer: 1, model: 2, color: 3 };

/* Tag de canto de tudo que ainda não tem geometria 3D. Uma constante porque o
   card do fabricante e o do modelo têm de dizer exatamente a mesma coisa. */
const EM_BREVE = 'Em breve';

/* A flow is just the SUBSEQUENCE of STEPS it walks, in order. Everything that
   used to hardcode "step 0/1/2" now asks the sequence instead, which is what
   makes the partial flows fall out for free: the last entry finishes, position 0
   has no "Voltar", and the breadcrumb numbers are positions in the sequence
   rather than absolute step ids (a 'truck' flow shows "1 Fabricante /
   2 Modelo" — showing "2, 3" would be lying about a flow the user is not in). */
const FLOWS: Record<FlowId, number[]> = {
  full: [0, 1, 2, 3],
  map: [0],
  /* Trocar de caminhão passa PELA cor de novo, e isso é de propósito: a mesma
     cor em outra cabine é outra imagem, e o passo custa um clique. Quem quer só
     a cor tem o fluxo 'color', que é o badge da cor. */
  truck: [1, 2, 3],
  color: [3],
};

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

/* Scene badge nodes (top-left). */
let mapBadge!: HTMLElement;
let mapBadgeMedia!: HTMLElement;
let mapBadgeName!: HTMLElement;
let mapBadgeFilled = false;

/* Colour badge nodes (bottom-left, right above the truck badge). */
let colorBadge!: HTMLElement;
let colorBadgeSwatch!: HTMLElement;
let colorBadgeName!: HTMLElement;
let colorBadgeFilled = false;

/* The single in-flight open() call, or null when the selector is closed:
   { resolve, cancellable, flow, seq, step, choice, prevFocus }. */
let session: Session | null = null;

/* Last choice the user actually completed — the starting point for both badges. */
let lastChoice: ResolvedChoice | null = null;

const listeners: ((choice: ResolvedChoice) => void)[] = [];

/* ---------------- tiny DOM helpers (house style: build it in JS) ---------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/* Initials are the graceful degradation for a missing photo: "Volvo FH16" → "VF".
   Better than a broken-image icon, and it still identifies the card. */
function initials(name: string | null | undefined) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '🚛';
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

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
   Clicking it re-opens fabricante → modelo. */
function buildBadge() {
  badge = el('div', 'ts-badge hidden');
  badge.id = 'ts-badge';

  badgeMedia = el('div', 'ts-badge__media');
  badge.appendChild(badgeMedia);

  const body = el('div', 'ts-badge__body');
  badgeName = el('div', 'ts-badge__name');
  badgeSub = el('div', 'ts-badge__sub');
  body.appendChild(badgeName);
  body.appendChild(badgeSub);
  badge.appendChild(body);

  /* Both of these are DIRECT children of .ts-badge, never of __media/__body:
     selector.css positions them absolutely against the card itself (logo at the
     bottom-right corner, "Trocar" in its own slot).

     .ts-badge__change is now a <span>, not a <button>: the whole card is the
     click target, so a nested control would be a second tab stop that does
     exactly what its own container does — and nesting an interactive element
     inside role="button" is an outright a11y bug. It stays as the visible
     affordance hint that says "this card is clickable", hidden from the
     accessibility tree because the card's aria-label already says it. */
  const change = el('span', 'ts-badge__change', 'Trocar');
  change.setAttribute('aria-hidden', 'true');
  badge.appendChild(change);

  badgeLogo = el('img', 'ts-badge__logo hidden');
  badgeLogo.loading = 'lazy';
  badgeLogo.decoding = 'async';
  badgeLogo.alt = '';
  badgeLogo.addEventListener('error', () => badgeLogo.classList.add('hidden'));
  badge.appendChild(badgeLogo);

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

     No __change node either: selector.css draws this card's "Trocar" pill as a
     ::after on the card, which cannot be clicked, selected or tabbed to. */
  body.appendChild(el('div', 'ts-mapbadge__label', 'Cenário'));
  mapBadgeName = el('div', 'ts-mapbadge__name');
  body.appendChild(mapBadgeName);
  mapBadge.appendChild(body);

  bindBadgeTrigger(mapBadge, 'map', 'Trocar cenário');
}

/* Bottom-left, imediatamente acima do badge do caminhão: a cor que está no
   cavalo. Clicar reabre SÓ o passo da cor.
   Existe pelo mesmo motivo dos outros dois — cada badge é a porta de entrada da
   PARTE do assistente que ele representa. Sem ele, trocar de cor custaria o
   fluxo do caminhão inteiro (fabricante → modelo → cor), e a cor é justamente o
   que se mexe mais vezes.
   Não tem miniatura 3D: o card é pequeno, o caminhão colorido já está NA TELA
   atrás dele, e a amostra chapada é o que se lê de relance. */
function buildColorBadge() {
  colorBadge = el('div', 'ts-colorbadge hidden');
  colorBadge.id = 'ts-colorbadge';

  colorBadgeSwatch = el('span', 'ts-colorbadge__swatch');
  colorBadgeSwatch.setAttribute('aria-hidden', 'true');
  colorBadge.appendChild(colorBadgeSwatch);

  const body = el('div', 'ts-colorbadge__body');
  body.appendChild(el('div', 'ts-colorbadge__label', 'Cor'));
  colorBadgeName = el('div', 'ts-colorbadge__name');
  body.appendChild(colorBadgeName);
  colorBadge.appendChild(body);

  bindBadgeTrigger(colorBadge, 'color', 'Trocar cor');
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
  buildColorBadge();

  /* Every badge lives inside #canvas-holder (position: relative) so they hug the
     3D viewport's corners instead of the page's. */
  const host = $opt('canvas-holder') || root;   // template changed under us — degrade
  host.appendChild(mapBadge);
  /* Cor e caminhão dividem o canto inferior esquerdo, e por isso dividem um
     ancoradouro: a pilha é posicionada uma vez e o flex resolve a altura. Com
     dois `bottom:` independentes, a altura do card do caminhão viraria um
     número mágico a recalcular em cada media query. Ordem no DOM = ordem na
     tela: cor em cima, caminhão embaixo. */
  const corner = el('div', 'ts-corner');
  corner.appendChild(colorBadge);
  corner.appendChild(badge);
  host.appendChild(corner);
}

/* ---------------- choice helpers ---------------- */

/* A saved/passed choice can reference ids the catalog no longer has (manifest
   edited, fallback catalog active). Drop whatever no longer resolves instead of
   rendering a step with a phantom selection. */
function sanitize(choice: Choice | null | undefined): Choice {
  const out: Choice = { envId: null, manufacturerId: null, modelId: null, colorId: null };
  if (!choice || typeof choice !== 'object') return out;
  const color = getColor(choice.colorId);
  if (color) out.colorId = color.id;
  const env = getEnvironment(choice.envId);
  if (env) out.envId = env.id;
  const man = getManufacturer(choice.manufacturerId);
  if (man) {
    out.manufacturerId = man.id;
    /* Só um modelo COM geometria sobrevive: preselecionar um "Em breve" deixaria
       o passo 3 abrir com um card destacado que não pode ser clicado. */
    if (man.models.some((m) => m.id === choice!.modelId && m.available)) {
      out.modelId = choice!.modelId;
    }
  }
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
   never on a step outside the flow the caller asked for. */
function clampStep(requested: number, choice: Choice, seq: number[]) {
  let i = requested;
  /* O passo da cor renderiza o MODELO escolhido em cada card; sem modelo não há
     o que renderizar. (No fluxo 'color' o backfill de openSelector já garantiu
     um, então isto só morde num estado que não deveria existir.) */
  if (i === 3 && !choice.modelId) i = 2;
  if (i === 2 && !choice.manufacturerId) i = 1;
  if (i === 1 && !choice.envId && seq.includes(0)) i = 0;
  return seq.includes(i) ? i : seq[0];
}

function itemsFor(stepIndex: number, choice: Choice): CardItem[] {
  if (stepIndex === 0) {
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
  if (stepIndex === 1) {
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
  if (stepIndex === 2) {
    const man = getManufacturer(choice.manufacturerId);
    if (!man) return [];
    const color = colorOf(choice);
    return man.models.map(m => ({
      id: m.id,
      name: m.name,
      sub: m.subtitle,
      image: m.image,
      logo: null,
      accent: man.accent,
      /* A tag do indisponível é do motor, não do manifesto: um `note` autoral não
         pode divergir do que o card realmente faz. */
      tag: m.available ? m.note : EM_BREVE,
      selected: m.id === choice.modelId,
      available: m.available,
      /* O card mostra o modelo NA COR que está escolhida — é o mesmo render que
         o passo seguinte usa, então trocar de modelo já mostra como a cor atual
         fica nele. Só quem tem geometria: um "Em breve" não tem o que renderizar
         e continua com a foto do manifesto. */
      preview: m.available && hasCabPreview(m.cab)
        ? { cabId: m.cab, hex: color.hex, finish: color.finish }
        : null,
    }));
  }

  /* Passo da cor. Um card por cor da paleta (catalog/colors.ts), cada um com o
     cavalo JÁ ESCOLHIDO renderizado naquela cor — que é a única forma honesta de
     escolher tinta: a mesma cor fica diferente em cada lataria.
     Se a cabine não tem geometria leve para miniatura, os cards continuam
     existindo com a amostra chapada: escolher a cor não pode depender de um
     render. */
  const picked = getModel(choice.modelId);
  const cabId = picked?.model.cab || null;
  const renderable = !!cabId && hasCabPreview(cabId);
  return colors.map((c) => ({
    id: c.id,
    name: c.name,
    sub: FINISH_LABEL[c.finish] + (c.code ? ' · ' + c.code : ''),
    image: null,
    logo: null,
    /* O anel de seleção sai NA PRÓPRIA COR. É o único passo em que o accent não
       é da marca — aqui a marca do card é a cor. */
    accent: c.hex,
    tag: null,
    selected: c.id === choice.colorId,
    available: true,
    preview: renderable ? { cabId: cabId as string, hex: c.hex, finish: c.finish } : null,
    swatch: c.hex,
  }));
}

/** A cor da escolha, ou a padrão — nunca undefined, para o card sempre ter tinta. */
function colorOf(choice: Choice): PaintColorDef {
  return getColor(choice.colorId) || defaultColor();
}

/* ---------------- rendering ---------------- */

/* Troca o conteúdo da moldura pela miniatura 3D. O que estava lá (foto do
   manifesto ou a placa de iniciais) SAI: são a mesma informação dita pior, e
   empilhá-las deixaria a foto aparecendo por baixo do fundo transparente do
   render. */
function setRender(media: HTMLElement, url: string, alt: string) {
  const img = el('img', 'ts-card__img ts-card__img--render');
  img.decoding = 'async';
  img.alt = alt || '';
  img.src = url;
  for (const old of media.querySelectorAll('.ts-card__img, .ts-card__fallback, .ts-card__logo')) {
    old.remove();
  }
  media.insertBefore(img, media.firstChild);
}

/* Pede a miniatura e a encaixa quando ela chegar. Nunca bloqueia a montagem do
   card: o grid tem de aparecer inteiro na hora, e as imagens vão pingando. */
function attachPreview(btn: HTMLElement, media: HTMLElement, item: CardItem) {
  const p = item.preview as CardPreview;
  /* Já renderizada numa passada anterior: entra sem piscar. Reabrir o seletor
     tem de ser instantâneo. */
  const ready = peekCabPreview(p.cabId, p.hex, p.finish);
  if (ready) { setRender(media, ready, item.name); return; }

  media.classList.add('is-rendering');
  void cabPreview(p.cabId, p.hex, p.finish).then((url) => {
    media.classList.remove('is-rendering');
    /* O grid é REFEITO a cada mudança de passo, e uma cor pode levar alguns
       quadros: quando o render chega, ESTE card pode já ter sido descartado. */
    if (!url || !btn.isConnected) return;
    setRender(media, url, item.name);
  });
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
  } else {
    appendImage(media, item.image, item.name, 'ts-card__img', 'ts-card__fallback', initials(item.name));
  }
  if (item.preview) attachPreview(btn, media, item);
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
/** Passos que rolam em vez de empilhar. Cenário e modelo têm 3 cards e ficam grid. */
const CAROUSEL_STEPS = new Set<StepId>(['manufacturer', 'color']);

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

  if (stepIndex === 0) {
    choice.envId = id;
  } else if (stepIndex === 1) {
    /* Switching brands invalidates the model: keeping "S730" highlighted under
       Volvo would be a lie. Re-picking the SAME brand keeps it, which is the
       whole point of the clickable breadcrumb. */
    if (choice.manufacturerId !== id) choice.modelId = null;
    choice.manufacturerId = id;
  } else if (stepIndex === 2) {
    choice.modelId = id;
    /* O próximo passo vai renderizar ESTA cabine doze vezes. Começar a baixar a
       geometria agora sobrepõe o download ao clique que o usuário ainda vai
       dar, em vez de deixá-lo esperando na frente de um grid vazio. */
    warmCabPreview(getModel(id)?.model.cab);
  } else {
    choice.colorId = id;
  }

  advance();
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
  syncColorBadgeFromChoice(choice);
  settle(choice);

  /* Fire listeners on the NEXT frame, after the browser has painted the closed
     overlay: studio.ts reacts by loading a cab/HDRI, and the #loading spinner it
     shows must be visible, not hidden behind a still-painted selector.

     NOTE for studio.ts: listeners fire on EVERY completed selection, including the
     one whose promise openSelector() just resolved. Make the handler idempotent
     (bail when the incoming choice equals what is already loaded) — you want
     that anyway, so that re-confirming the same truck does not re-download it,
     and the 'map' flow in particular resolves a choice whose truck half is
     byte-for-byte what is already on screen. */
  requestAnimationFrame(() => emit(choice));
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
 * @param {{ flow?: 'full'|'map'|'truck'|'color',
 *           step?: 'map'|'manufacturer'|'model'|'color',
 *           choice?: { envId, manufacturerId, modelId, colorId },
 *           cancellable?: boolean }} [opts]
 * @returns {Promise<{ envId, manufacturerId, modelId, colorId }|null>}
 */
export function openSelector(opts: {
  flow?: FlowId;
  step?: StepId;
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
  const seq = FLOWS[flow];

  const choice = sanitize(opts.choice || lastChoice || loadChoice() || defaultChoice());
  /* A partial flow can never repair a stale id it does not show, so repair it
     up front — then every step it DOES show renders with a real selection. */
  if (flow !== 'full') backfill(choice);

  const asked = opts.step ? STEP_INDEX[opts.step] : undefined;
  const requested = asked != null ? asked : seq[0];

  return new Promise<ResolvedChoice | null>((resolve) => {
    session = {
      resolve,
      flow,
      seq,
      cancellable: opts.cancellable == null ? flow !== 'full' : !!opts.cancellable,
      step: clampStep(requested, choice, seq),
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

/** @returns {boolean} */
export function isSelectorOpen(): boolean {
  return !!session;
}

/** Force-close; resolves the pending promise with null. */
export function closeSelector() {
  settle(null);
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

/**
 * Fill the bottom-left truck card. Pass null to hide it.
 * @param {{ modelName?: string, modelSubtitle?: string, modelImage?: string,
 *           manufacturerName?: string, logo?: string }|null} info
 */
export function setBadge(info: BadgeInfo | null) {
  initSelector();
  if (!info) {
    badge.classList.add('hidden');
    return;
  }

  badgeMedia.textContent = '';
  appendImage(
    badgeMedia, info.modelImage, info.modelName || '',
    'ts-badge__img', 'ts-badge__fallback', initials(info.modelName),
  );

  badgeName.textContent = info.modelName || '';
  badgeSub.textContent = info.modelSubtitle || '';
  badgeSub.classList.toggle('hidden', !info.modelSubtitle);

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

  /* The card is a button now, so its accessible name has to say what pressing it
     does AND what it currently shows — the photo alone announces neither. */
  const what = [info.manufacturerName, info.modelName].filter(Boolean).join(' ');
  badge.setAttribute('aria-label', what ? 'Trocar caminhão (atual: ' + what + ')' : 'Trocar caminhão');
  badge.title = what ? 'Trocar caminhão · ' + what : 'Trocar caminhão';

  badge.classList.remove('hidden');
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

/**
 * Fill the bottom-left colour card. Pass null to hide it.
 * @param {{ colorName?: string, hex?: string, finishLabel?: string }|null} info
 */
export function setColorBadge(info: ColorBadgeInfo | null) {
  initSelector();
  if (!info) {
    colorBadge.classList.add('hidden');
    return;
  }

  const hex = info.hex || '#b9bec6';
  colorBadgeSwatch.style.setProperty('--ts-swatch', hex);
  colorBadgeName.textContent = info.colorName || '';

  const desc = [info.colorName, info.finishLabel].filter(Boolean).join(' · ');
  colorBadge.setAttribute(
    'aria-label',
    info.colorName ? 'Trocar cor (atual: ' + info.colorName + ')' : 'Trocar cor',
  );
  colorBadge.title = desc ? 'Trocar cor · ' + desc : 'Trocar cor';

  colorBadgeFilled = true;
  colorBadge.classList.remove('hidden');
}

/** @param {boolean} visible */
export function showColorBadge(visible: boolean) {
  initSelector();
  /* Mesmo motivo de showMapBadge: um card que ninguém preencheu seria uma placa
     vazia sobre a cena. O caminho do visitante que volta não passa pelo
     seletor, então a paleta é quem responde. */
  if (visible && !colorBadgeFilled) {
    syncColorBadgeFromChoice(sanitize(lastChoice || loadChoice() || defaultChoice()));
  }
  colorBadge.classList.toggle('hidden', !visible);
}

/* Keep the badges honest even if studio.ts forgets to refresh them: each badge is
   the trigger for its own flow, so a stale one would re-open the selector
   preselected with the wrong truck/scene/colour. studio.ts may still call
   setBadge()/setMapBadge()/setColorBadge() to override. */
function syncBadgeFromChoice(choice: Choice) {
  const man = getManufacturer(choice.manufacturerId);
  const model = man ? man.models.find((m) => m.id === choice.modelId) : null;
  if (!man || !model) return;
  setBadge({
    modelName: model.name,
    modelSubtitle: model.subtitle,
    modelImage: model.image,
    manufacturerName: man.name,
    logo: man.logo,
  });
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

function syncColorBadgeFromChoice(choice: Choice) {
  const color = getColor(choice.colorId);
  if (!color) return;
  setColorBadge({
    colorName: color.name,
    hex: color.hex,
    finishLabel: FINISH_LABEL[color.finish],
  });
}

/* A badge press opens ONLY the part of the wizard that badge stands for, with
   the current choice preselected, and IS cancellable — the user already has a
   truck on screen, so backing out has a sane meaning here (unlike the first
   boot). The completed selection reaches studio.ts through the onChange
   listeners, so there is nothing to await. */
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
