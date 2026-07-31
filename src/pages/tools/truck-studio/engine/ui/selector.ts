/* Card selector (cenário → fabricante → modelo) + the two badge cards that stay
   on the viewport afterwards: the SCENE badge top-left and the TRUCK badge
   bottom-left.
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
  catalog, getEnvironment, getManufacturer, defaultChoice, assetUrl,
  saveChoice, loadChoice,
} from '../catalog/catalog';
import type { Choice, ResolvedChoice } from '../catalog/catalog';

/** Which steps a flow walks; see FLOWS. */
export type FlowId = 'full' | 'map' | 'truck';
/** The three steps, by the id STEPS uses. */
export type StepId = 'map' | 'manufacturer' | 'model';

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
];

const STEP_INDEX: Record<StepId, number> = { map: 0, manufacturer: 1, model: 2 };

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
  full: [0, 1, 2],
  map: [0],
  truck: [1, 2],
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

  /* Both badges live inside #canvas-holder (position: relative) so they hug the
     3D viewport's corners instead of the page's. */
  const host = $opt('canvas-holder') || root;   // template changed under us — degrade
  host.appendChild(mapBadge);
  host.appendChild(badge);
}

/* ---------------- choice helpers ---------------- */

/* A saved/passed choice can reference ids the catalog no longer has (manifest
   edited, fallback catalog active). Drop whatever no longer resolves instead of
   rendering a step with a phantom selection. */
function sanitize(choice: Choice | null | undefined): Choice {
  const out: Choice = { envId: null, manufacturerId: null, modelId: null };
  if (!choice || typeof choice !== 'object') return out;
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
  return choice as ResolvedChoice;
}

/* Never open on a step whose prerequisite is missing — the model step with no
   manufacturer picked would render an empty grid with no way forward — and
   never on a step outside the flow the caller asked for. */
function clampStep(requested: number, choice: Choice, seq: number[]) {
  let i = requested;
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
  const man = getManufacturer(choice.manufacturerId);
  if (!man) return [];
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
  }));
}

/* ---------------- rendering ---------------- */

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
  if (item.logo) {
    /* Brand cards: the logo is centred in the media box and the name repeats it
       right below, so the image is decorative → empty alt. */
    appendImage(media, item.logo, '', 'ts-card__logo', 'ts-card__fallback', initials(item.name));
  } else {
    appendImage(media, item.image, item.name, 'ts-card__img', 'ts-card__fallback', initials(item.name));
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

function renderCards(stepIndex: number) {
  const step = STEPS[stepIndex];
  cardsEl.className = 'ts-cards ' + step.grid;
  cardsEl.setAttribute('aria-label', step.aria);
  cardsEl.textContent = '';
  const items = itemsFor(stepIndex, (session as Session).choice);
  for (const item of items) cardsEl.appendChild(buildCard(item, stepIndex));
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
  } else {
    choice.modelId = id;
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
 * `flow` picks WHICH steps run. All three resolve the same complete shape, so
 * callers never branch on it:
 *   'full'  (default) cenário → fabricante → modelo
 *   'map'   cenário only; the current truck is carried through unchanged
 *   'truck' fabricante → modelo; the current cenário is carried through
 *
 * `cancellable` defaults to false for 'full' (the first boot must produce a
 * choice) and true for the partial flows (the user already has a working
 * configuration on screen, so backing out has a sane meaning).
 *
 * @param {{ flow?: 'full'|'map'|'truck',
 *           step?: 'map'|'manufacturer'|'model',
 *           choice?: { envId: string, manufacturerId: string, modelId: string },
 *           cancellable?: boolean }} [opts]
 * @returns {Promise<{ envId: string, manufacturerId: string, modelId: string }|null>}
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

/* Keep the badges honest even if studio.ts forgets to refresh them: each badge is
   the trigger for its own flow, so a stale one would re-open the selector
   preselected with the wrong truck/scene. studio.ts may still call
   setBadge()/setMapBadge() to override. */
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
