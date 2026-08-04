/* Floating lighting HUD — the studio's ONLY lighting UI.
   ---------------------------------------------------------------------------
   This panel replaces the sidebar's "Iluminação" block (ui/sidebar.ts's bindLights /
   syncLightUI / buildLightPresets, core/template.ts's panel). Two live surfaces
   writing the same scene state is a bug farm: the sidebar version is deleted and
   everything it did lives here, brightness included.

   It is built imperatively into the studio's own DOM (core/dom.ts) and mounted inside
   #canvas-holder — the same host the two selector badges use — so "top-left"
   means the corner OF THE 3D CANVAS, not of the page. Like the rest of the
   engine this subtree OUTLIVES the React route, so it never touches React and
   never leaves a listener on document/window behind (there are none: the dial's
   drag uses pointer capture on the dial itself, which is self-releasing).

   Two rules carried over from ui/sidebar.ts, both load-bearing:

   1. SLIDERS DO NOT ANIMATE THE RIG. setLightParams/setHourOfDay default to no
      tween, and a tween would lag behind the pointer — the thumb would arrive
      somewhere the light has not reached yet. The discrete switches (the weather
      tiles) DO animate: a crossfade is exactly what a preset change wants.
   2. Everything reads back out of the scene. syncHud() re-derives every control
      from `sceneState` + getHourOfDay() instead of trusting what it last wrote,
      because applyEnvironment() reapplies a preset and resets el/az behind our
      back and the orchestrator only promises to call syncHud() afterwards.

   The hour slider and the two manual controls share the key light, so they also
   share state: setHourOfDay() re-derives el/az (scene/scene.ts owns that policy), which
   is why the hour handler repaints the elevation slider and the azimuth dial.

   All styling lives in hud.css. The only inline styles written here are the
   --ts-hud-fill custom property (the filled portion of a range track, which CSS
   cannot compute on its own) and the dial's `touch-action: none`, without which
   a touch drag scrolls the page instead of turning the light. */
import { root, $opt, el, num } from '../core/dom';
import {
  sceneState, LIGHT_PRESETS, applyPreset, setLightParams,
  setHourOfDay, getHourOfDay, HOUR_MIN, HOUR_MAX, beginLightScrub,
} from '../scene/scene';

/* Same ranges the sidebar shipped, so nothing about the light's reachable set
   changes with the move: elevation 2..85°, brightness 15..250 % of the preset's
   own keyIntensity. Azimuth is a full circle by definition. */
const EL_MIN = 2, EL_MAX = 85;
const BRIGHT_MIN = 15, BRIGHT_MAX = 250;

/* Collapsed state only. The lighting itself is already persisted by scene/scene.ts
   under truckstudio.scene.v3 — duplicating it here would give us two sources of
   truth for the same thing and a boot order that decides which one wins. */
const HUD_KEY = 'truckstudio.hud.v1';

/* Dial geometry, in the dial SVG's own 100x100 viewBox. */
const DIAL_C = 50, DIAL_R = 36;

/* ---------------- icons ----------------
   Authored inline SVG, never emoji and never an icon font: emoji are rendered by
   the platform's own font, so the same "sun" is a flat glyph on one machine and a
   full-colour bitmap on the next — it could not be made to match this UI or to
   follow `currentColor`. Single-path where the shape allows, 24x24 box, stroked
   with currentColor so a hover/selected colour change is free. */
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7"'
  + ' stroke-linecap="round" stroke-linejoin="round"';

function svgTag(size: number, body: string) {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" '
    + STROKE + ' focusable="false" aria-hidden="true">' + body + '</svg>';
}

/* The cloud outline is shared by three weather icons. Traversed counter-clockwise
   on screen (bottom edge left→right, then up the right side, over the top and
   back down the left), so every arc takes sweep-flag 0 to bulge outward. */
const CLOUD = 'M7 17.4h9a3.7 3.7 0 0 0 .4-7.4 5.4 5.4 0 0 0-10.3-1A3.7 3.7 0 0 0 7 17.4Z';

const ICON_BODY: Record<string, string> = {
  /* full sun: disc + eight rays */
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6'
    + 'M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  /* crescent: one disc bitten out of another */
  moon: '<path d="M20.8 13.1A8.5 8.5 0 1 1 10.9 3.2 6.7 6.7 0 0 0 20.8 13.1Z"/>',
  /* elevation, low end: sun resting on the horizon */
  sunLow: '<path d="M3 18h18"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0"/>'
    + '<path d="M12 6.4V4.6M5.4 9.2 4.2 8M18.6 9.2 19.8 8"/>',
  /* elevation, high end: sun at the zenith over the same horizon */
  sunHigh: '<circle cx="12" cy="8" r="3.2"/>'
    + '<path d="M12 1.8v1.4M12 12.8v1.4M4.4 8h1.4M18.2 8h1.4M6.6 2.6 7.6 3.6M17.4 2.6l-1 1"/>'
    + '<path d="M3 20h18"/>',
  /* intensity, low end: small disc, four short rays */
  dim: '<circle cx="12" cy="12" r="3.4"/><path d="M12 4.6v1.4M12 18v1.4M4.6 12H6M18 12h1.4"/>',
  /* intensity, high end: same disc, eight long rays */
  bright: '<circle cx="12" cy="12" r="3.4"/>'
    + '<path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6'
    + 'M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M5.3 18.7l1.9-1.9M16.8 7.2l1.9-1.9"/>',
  chevron: '<path d="M6 9.5 12 15.5 18 9.5"/>',
  /* header: a lamp, the one glyph that means "lighting" rather than "daytime" */
  bulb: '<path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1.1.9 1.8v.3h5.2v-.3c0-.7.3-1.4.9-1.8'
    + 'A6 6 0 0 0 12 3Z"/><path d="M9.6 19h4.8M10.4 21.6h3.2"/>',

  /* --- weather --- */
  cloud: '<path d="' + CLOUD + '"/>',
  rain: '<path d="' + CLOUD + '"/><path d="M8.6 19.8 7.6 22M12.5 19.8l-1 2.2M16.4 19.8l-1 2.2"/>',
  /* fog: a smaller cloud sitting on drifting mist bands */
  fog: '<path d="M7.5 12.6h7.6a3 3 0 0 0 .3-6 4.4 4.4 0 0 0-8.4-.8A3 3 0 0 0 7.5 12.6Z"/>'
    + '<path d="M4 16.5h16M7 20h12"/>',
};

/* Which presets the picker OFFERS. Deliberately a subset of scene/scene.ts's
   PRESET_ORDER, not a copy of it: `dourado` is a time of day, which the hour
   slider now owns, and `estudio` is the assetless fallback cenário's own preset.
   Both must stay in scene/scene.ts — environments still apply them by name — they just
   have no business being weather buttons. A preset applied from outside this list
   still names itself in the row's readout; it simply lights no tile. */
const HUD_PRESETS = ['ensolarado', 'nublado', 'chuvoso', 'neblina'];

/* Weather id → icon. One entry per HUD_PRESETS id and no more: `dourado` and
   `estudio` used to be mapped here too, and since neither is ever OFFERED as a
   tile, their glyphs were two shapes nothing could reach. Anything unmapped
   falls back to the sun and still renders as a usable tile, which is what makes
   adding a preset a one-line change here rather than a requirement. */
const PRESET_ICON: Record<string, string> = {
  ensolarado: 'sun',
  nublado: 'cloud',
  chuvoso: 'rain',
  neblina: 'fog',
};

/* ---------------- tiny DOM helpers (house style: build it in JS) ----------------
   `el` and `num` live in core/dom.ts — ui/selector.ts and ui/loader.ts build
   their DOM exactly the same way, and scene/environment.ts wants the same
   number coercion. */

/* The markup is a module constant, never user input, so innerHTML is the cheap
   way to get the HTML parser to build foreign (SVG) content for us. */
function iconSpan(name: string, cls?: string, size?: number) {
  const span = el('span', cls);
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svgTag(size || 16, ICON_BODY[name] || ICON_BODY.sun);
  return span;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/* 7.25 → "07:15". The top of the range stays "24:00" rather than wrapping to
   "00:00", which at the RIGHT end of the slider would read as the left one. */
function formatHour(h: number) {
  const v = clamp(num(h, HOUR_MIN), HOUR_MIN, HOUR_MAX);
  let hh = Math.floor(v);
  let mm = Math.round((v - hh) * 60);
  if (mm >= 60) { hh += 1; mm -= 60; }
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

const degText = (v: number) => Math.round(v) + '°';
/* NBSP before the sign: pt-BR sets a space there, and a breaking one would let
   the readout wrap in half inside a 200px panel. */
const pctText = (v: number) => Math.round(v) + ' %';

/* The filled portion of a range track. CSS cannot read an input's value, so the
   handlers publish it as a percentage string hud.css can drop straight into a
   gradient stop. */
function setFill(input: HTMLInputElement, value: number, min: number, max: number) {
  const t = max > min ? (clamp(value, min, max) - min) / (max - min) : 0;
  input.style.setProperty('--ts-hud-fill', (t * 100).toFixed(2) + '%');
}

/* ---------------- module state ---------------- */

let built = false;

/* Definite-assignment (`!`) rather than `| null`: build() creates all of these,
   and every public entry point calls initHud() before touching one. Typing them
   nullable would put ~90 null checks on values that cannot be null by the time
   any reader runs. */
let hudRoot!: HTMLElement;
let headBtn!: HTMLButtonElement;
let hintEl!: HTMLElement;
let bodyEl!: HTMLElement;

let hourInput!: HTMLInputElement;
let hourVal!: HTMLElement;
let hourSunCap!: HTMLElement;
let hourMoonCap!: HTMLElement;
let elInput!: HTMLInputElement;
let elVal!: HTMLElement;
let brightInput!: HTMLInputElement;
let brightVal!: HTMLElement;
let azVal!: HTMLElement;
let dialEl!: HTMLElement;
let dialRay!: SVGLineElement;
let dialHandle!: SVGCircleElement;
let tilesEl!: HTMLElement;
let weatherVal!: HTMLElement;

let collapsed = false;
let dragPointer: number | null = null;   // pointerId while the dial is turning

/* ---------------- persistence ---------------- */

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(HUD_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data && data.collapsed);
  } catch { return false; }
}

function saveCollapsed() {
  try {
    localStorage.setItem(HUD_KEY, JSON.stringify({ v: 1, collapsed }));
  } catch { /* private mode / quota — the panel still works, just forgets */ }
}

/* ---------------- construction ---------------- */

/**
 * One labelled slider row. The row IS the <label>, so the text, the readout and
 * both end-cap icons all focus/act on the input without needing an id to point
 * at — and this panel is allowed exactly one id (#ts-hud).
 */
function buildRangeRow(
  mod: string, labelText: string, capA: string, capB: string,
  min: number, max: number, step: number, capAMod: string, capBMod: string,
) {
  const row = el('label', 'ts-hud-row ts-hud-row--' + mod);

  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', labelText));
  const val = el('span', 'ts-hud-row__val');
  top.appendChild(val);
  row.appendChild(top);

  const ctl = el('div', 'ts-hud-row__ctl');
  const capLo = iconSpan(capA, 'ts-hud-cap ts-hud-cap--' + capAMod);
  const input = el('input', 'ts-hud-range');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const capHi = iconSpan(capB, 'ts-hud-cap ts-hud-cap--' + capBMod);
  ctl.appendChild(capLo);
  ctl.appendChild(input);
  ctl.appendChild(capHi);
  row.appendChild(ctl);

  return { row, input, val, capLo, capHi };
}

/**
 * Azimuth is a DIAL, not a slider, and that is a deliberate trade.
 *
 * A 360° value on a linear track lies twice over: it invents an end where the
 * scale is continuous (0° and 360° are the same sun), so dragging past either
 * edge dead-stops instead of carrying on round, and it asks the user to convert
 * "38" into a direction in their head. The dial is a plan view of the scene —
 * the truck glyph at the centre points down the road (-Z), the marker sits where
 * the light actually is — so the control shows the answer instead of encoding it,
 * and a full turn is one continuous gesture.
 *
 * The mapping is applyRig()'s, read off the source rather than guessed:
 *   x = r·cos(el)·sin(az),  z = r·cos(el)·cos(az)
 * Drawing the dial as a top-down plan (+X to the right, +Z DOWN the screen, which
 * is what puts the road on the vertical axis) makes that exactly
 *   sx = C + R·sin(az),  sy = C + R·cos(az)
 * and its inverse az = atan2(dx, dy). So az 0° is the bottom of the dial, 90° the
 * right, 180° the top: the marker is literally where the sun is standing.
 */
function buildDialRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--az');

  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Posição da luz'));
  azVal = el('span', 'ts-hud-row__val');
  top.appendChild(azVal);
  row.appendChild(top);

  const ctl = el('div', 'ts-hud-row__ctl ts-hud-row__ctl--dial');
  dialEl = el('div', 'ts-hud-dial');
  /* role=slider + the aria-value* trio is what makes a non-<input> control
     announce and behave like the range rows beside it; the arrow keys below
     complete the contract. */
  dialEl.setAttribute('role', 'slider');
  dialEl.setAttribute('aria-label', 'Posição da luz');
  dialEl.setAttribute('aria-valuemin', '0');
  dialEl.setAttribute('aria-valuemax', '360');
  dialEl.tabIndex = 0;
  /* Inline because it is behaviour, not decoration: without it the browser
     claims a touch drag for scrolling and the pointermove stream stops. */
  dialEl.style.touchAction = 'none';
  dialEl.innerHTML = [
    '<svg class="ts-hud-dial__svg" viewBox="0 0 100 100" width="84" height="84"',
    ' focusable="false" aria-hidden="true">',
    '<circle class="ts-hud-dial__ring" cx="50" cy="50" r="36" fill="none"',
    ' stroke="currentColor" stroke-opacity=".22" stroke-width="2"/>',
    '<path class="ts-hud-dial__ticks" d="M50 8v6M92 50h-6M50 92v-6M8 50h6" fill="none"',
    ' stroke="currentColor" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>',
    '<g class="ts-hud-dial__truck" fill="none" stroke="currentColor" stroke-opacity=".5"',
    ' stroke-width="2.4" stroke-linejoin="round">',
    '<rect x="43" y="34" width="14" height="10" rx="2.5"/>',
    '<rect x="41.5" y="45.5" width="17" height="20" rx="2.5"/></g>',
    '<line class="ts-hud-dial__ray" x1="50" y1="50" x2="50" y2="86" stroke="currentColor"',
    ' stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/>',
    '<circle class="ts-hud-dial__handle" cx="50" cy="86" r="7" fill="currentColor"/>',
    '</svg>',
  ].join('');
  dialRay = dialEl.querySelector('.ts-hud-dial__ray') as SVGLineElement;
  dialHandle = dialEl.querySelector('.ts-hud-dial__handle') as SVGCircleElement;
  ctl.appendChild(dialEl);
  row.appendChild(ctl);

  return row;
}

function buildWeatherRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--weather');

  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Clima'));
  weatherVal = el('span', 'ts-hud-row__val');
  top.appendChild(weatherVal);
  row.appendChild(top);

  tilesEl = el('div', 'ts-hud-tiles');
  tilesEl.setAttribute('role', 'group');
  tilesEl.setAttribute('aria-label', 'Clima');
  for (const id of HUD_PRESETS) {
    const preset = LIGHT_PRESETS[id];
    if (!preset) continue;                 // preset order and table out of step
    const tile = el('button', 'ts-hud-tile');
    tile.type = 'button';
    tile.dataset.preset = id;
    tile.setAttribute('aria-pressed', 'false');
    tile.title = preset.name;
    tile.appendChild(iconSpan(PRESET_ICON[id], 'ts-hud-tile__ico', 20));
    tile.appendChild(el('span', 'ts-hud-tile__name', preset.name));
    /* Discrete switch, so this one DOES animate — the crossfade between two
       preset faces is the whole point of the control. */
    tile.addEventListener('click', () => {
      /* Um clique de preset abre um tween de 0,8 s ≈ 48 quadros, cada um
         redesenhando o mapa de sombra inteiro. */
      beginLightScrub();
      applyPreset(id);
      syncHud();                            // applyPreset resets az/el/brightness
    });
    tilesEl.appendChild(tile);
  }
  row.appendChild(tilesEl);

  return row;
}

function build() {
  hudRoot = el('aside', 'ts-hud');
  hudRoot.id = 'ts-hud';
  hudRoot.setAttribute('aria-label', 'Iluminação');

  /* #canvas-holder holds the WebGL canvas and the badges as SIBLINGS, and
     scene/scene.ts binds OrbitControls to `renderer.domElement` — the canvas itself,
     not the holder — so a press in here has no bubbling path to the controls
     today. This is the guard against that changing: the day the controls move
     onto the holder, an unguarded slider drag would orbit the camera underneath
     the panel, which is the single most maddening thing this UI could do.
     `wheel` is passive: we only need to stop it travelling, never to cancel it. */
  const swallow = (e: Event) => e.stopPropagation();
  hudRoot.addEventListener('pointerdown', swallow);
  hudRoot.addEventListener('pointerup', swallow);
  hudRoot.addEventListener('wheel', swallow, { passive: true });
  /* Same reason, keyboard edition: the arrow keys drive the focused slider or
     dial, and must not also reach anything listening higher up. */
  hudRoot.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End'
      || e.key === 'PageUp' || e.key === 'PageDown') e.stopPropagation();
  });

  /* ---- header (collapse toggle) ---- */
  headBtn = el('button', 'ts-hud__head');
  headBtn.type = 'button';
  headBtn.appendChild(iconSpan('bulb', 'ts-hud__head-ico'));
  headBtn.appendChild(el('span', 'ts-hud__title', 'Iluminação'));
  hintEl = el('span', 'ts-hud__hint');
  headBtn.appendChild(hintEl);
  headBtn.appendChild(iconSpan('chevron', 'ts-hud__chev'));
  headBtn.addEventListener('click', () => setCollapsed(!collapsed));
  hudRoot.appendChild(headBtn);

  /* ---- body ---- */
  bodyEl = el('div', 'ts-hud__body');

  const hour = buildRangeRow(
    'hour', 'Hora do dia', 'sun', 'moon',
    HOUR_MIN, HOUR_MAX, 0.25, 'sun', 'moon',
  );
  hourInput = hour.input;
  hourVal = hour.val;
  hourSunCap = hour.capLo;
  hourMoonCap = hour.capHi;
  hourInput.setAttribute('aria-label', 'Hora do dia');
  hourInput.addEventListener('input', () => {
    /* Arrastar a luz redesenha o mapa de sombra 3072² a cada evento; ver
       beginLightScrub() em scene/scene.ts. */
    beginLightScrub();
    const h = num(hourInput.value, HOUR_MIN);
    setHourOfDay(h);                        // no tween: must track the thumb
    paintHour(h);
    /* The hour owns the sun's geometry, so it moves elevation and azimuth out
       from under the two manual controls — repaint them or they would sit there
       claiming a value the light no longer has. */
    paintElevation(sceneState.el);
    paintAzimuth(sceneState.az);
  });
  bodyEl.appendChild(hour.row);

  const elev = buildRangeRow(
    'el', 'Altura da luz', 'sunLow', 'sunHigh',
    EL_MIN, EL_MAX, 1, 'low', 'high',
  );
  elInput = elev.input;
  elVal = elev.val;
  elInput.setAttribute('aria-label', 'Altura da luz');
  elInput.addEventListener('input', () => {
    /* Arrastar a luz redesenha o mapa de sombra 3072² a cada evento; ver
       beginLightScrub() em scene/scene.ts. */
    beginLightScrub();
    const v = num(elInput.value, EL_MIN);
    setLightParams({ el: v });
    paintElevation(v);
  });
  bodyEl.appendChild(elev.row);

  const bright = buildRangeRow(
    'bright', 'Intensidade', 'dim', 'bright',
    BRIGHT_MIN, BRIGHT_MAX, 1, 'dim', 'bright',
  );
  brightInput = bright.input;
  brightVal = bright.val;
  brightInput.setAttribute('aria-label', 'Intensidade da luz');
  brightInput.addEventListener('input', () => {
    /* Arrastar a luz redesenha o mapa de sombra 3072² a cada evento; ver
       beginLightScrub() em scene/scene.ts. */
    beginLightScrub();
    const v = num(brightInput.value, 100);
    setLightParams({ brightness: v / 100 });
    paintBrightness(v);
  });
  bodyEl.appendChild(bright.row);

  /* The dial comes after the two sliders: elevation and intensity are the pair a
     user tweaks together, so they belong adjacent, and the dial is a different
     kind of instrument that reads better as its own block. */
  bodyEl.appendChild(buildDialRow());
  bindDial();

  bodyEl.appendChild(buildWeatherRow());

  hudRoot.appendChild(bodyEl);

  collapsed = loadCollapsed();
  applyCollapsed();
}

/* ---------------- dial interaction ---------------- */

/* Screen offset from the dial's centre → azimuth, the inverse of the mapping
   documented on buildDialRow(). */
function azFromEvent(e: PointerEvent) {
  const box = dialEl.getBoundingClientRect();
  const dx = e.clientX - (box.left + box.width / 2);
  const dy = e.clientY - (box.top + box.height / 2);
  if (dx === 0 && dy === 0) return null;              // dead centre has no angle
  let a = Math.atan2(dx, dy) * 180 / Math.PI;
  if (a < 0) a += 360;
  /* Shift snaps to the eight principal directions — the useful precision for a
     key light, and it makes "put the sun directly behind the truck" a gesture
     rather than a fight. */
  if (e.shiftKey) a = Math.round(a / 15) * 15;
  return a % 360;
}

function commitAz(a: number | null) {
  beginLightScrub();
  if (a == null) return;
  setLightParams({ az: a });                 // no tween: must track the pointer
  paintAzimuth(a);
}

function bindDial() {
  dialEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragPointer = e.pointerId;
    /* Pointer capture instead of document-level move/up listeners: the drag can
       leave the dial (it will — the user overshoots the ring) and still be
       delivered here, and the browser releases the capture for us on pointerup
       or cancel. The engine's DOM outlives the React page, so a listener parked
       on `document` would be a leak with no owner left to remove it. */
    try { dialEl.setPointerCapture(e.pointerId); } catch { /* no capture: fall back to plain events */ }
    dialEl.classList.add('is-dragging');
    dialEl.focus();
    e.preventDefault();                      // no text selection while turning
    commitAz(azFromEvent(e));
  });

  dialEl.addEventListener('pointermove', (e: PointerEvent) => {
    if (dragPointer !== e.pointerId) return;
    commitAz(azFromEvent(e));
  });

  const end = (e: PointerEvent) => {
    if (dragPointer !== e.pointerId) return;
    dragPointer = null;
    dialEl.classList.remove('is-dragging');
    if (dialEl.hasPointerCapture && dialEl.hasPointerCapture(e.pointerId)) {
      dialEl.releasePointerCapture(e.pointerId);
    }
  };
  dialEl.addEventListener('pointerup', end);
  dialEl.addEventListener('pointercancel', end);
  /* Capture can also be lost without a pointerup (element hidden, another
     element grabs it) — without this the dial would stay stuck in is-dragging. */
  dialEl.addEventListener('lostpointercapture', () => {
    dragPointer = null;
    dialEl.classList.remove('is-dragging');
  });

  dialEl.addEventListener('keydown', (e: KeyboardEvent) => {
    let step = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step = -1;
    else if (e.key === 'PageUp') step = 15;
    else if (e.key === 'PageDown') step = -15;
    else if (e.key === 'Home') { e.preventDefault(); commitAz(0); return; }
    else return;
    e.preventDefault();                      // arrows would scroll the page
    commitAz(((Math.round(num(sceneState.az, 0)) + step) % 360 + 360) % 360);
  });
}

/* ---------------- painting (DOM ← value) ----------------
   Each painter takes the value rather than reading the scene, so a drag handler
   can repaint from the raw input without waiting for scene/scene.ts to round-trip it,
   and syncHud() can feed all of them from `sceneState` in one pass. */

function paintHour(h: number) {
  const v = clamp(num(h, HOUR_MIN), HOUR_MIN, HOUR_MAX);
  hourVal.textContent = formatHour(v);
  setFill(hourInput, v, HOUR_MIN, HOUR_MAX);
  /* scene/scene.ts derives 'dia'/'noite' from the hour; light up the end the scene is
     actually at, so the icons report state instead of just labelling the ends. */
  const night = sceneState.timeOfDay === 'noite';
  hourSunCap.classList.toggle('is-on', !night);
  hourMoonCap.classList.toggle('is-on', night);
  hudRoot.dataset.tod = night ? 'noite' : 'dia';
  paintHint();
}

function paintElevation(v: number) {
  const n = clamp(num(v, EL_MIN), EL_MIN, EL_MAX);
  elInput.value = String(Math.round(n));
  elVal.textContent = degText(n);
  setFill(elInput, n, EL_MIN, EL_MAX);
}

function paintAzimuth(v: number) {
  const a = ((num(v, 0) % 360) + 360) % 360;
  const rad = a * Math.PI / 180;
  const x = DIAL_C + DIAL_R * Math.sin(rad);
  const y = DIAL_C + DIAL_R * Math.cos(rad);
  dialRay.setAttribute('x2', x.toFixed(2));
  dialRay.setAttribute('y2', y.toFixed(2));
  dialHandle.setAttribute('cx', x.toFixed(2));
  dialHandle.setAttribute('cy', y.toFixed(2));
  const text = degText(a);
  azVal.textContent = text;
  dialEl.setAttribute('aria-valuenow', String(Math.round(a)));
  dialEl.setAttribute('aria-valuetext', text);
}

function paintBrightness(v: number) {
  const n = clamp(num(v, 100), BRIGHT_MIN, BRIGHT_MAX);
  brightInput.value = String(Math.round(n));
  brightVal.textContent = pctText(n);
  setFill(brightInput, n, BRIGHT_MIN, BRIGHT_MAX);
}

function paintPresets() {
  const id = sceneState.preset;
  const preset = LIGHT_PRESETS[id];
  hudRoot.dataset.preset = id || '';
  weatherVal.textContent = preset ? preset.name : '';
  for (const tile of tilesEl.querySelectorAll<HTMLElement>('.ts-hud-tile')) {
    const on = tile.dataset.preset === id;
    tile.classList.toggle('is-on', on);
    tile.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  paintHint();
}

/* The header line is the whole panel's summary — the only thing left on screen
   while it is collapsed, so it carries the two values that answer "what am I
   looking at": the time and the weather. */
function paintHint() {
  if (!hintEl) return;
  const preset = LIGHT_PRESETS[sceneState.preset];
  hintEl.textContent = formatHour(getHourOfDay())
    + (preset ? ' · ' + preset.name : '');
}

/* ---------------- collapse ---------------- */

function applyCollapsed() {
  hudRoot.classList.toggle('is-collapsed', collapsed);
  /* The global `.hidden` rule does the hiding, so the panel still collapses
     correctly even before hud.css has an opinion about it. */
  bodyEl.classList.toggle('hidden', collapsed);
  headBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  headBtn.title = collapsed ? 'Mostrar controles de iluminação' : 'Ocultar controles de iluminação';
}

function setCollapsed(v: boolean) {
  collapsed = !!v;
  applyCollapsed();
  saveCollapsed();
}

/* ---------------- public API ---------------- */

/** Build the panel into #canvas-holder and wire it. Idempotent. */
export function initHud() {
  if (built) return;
  built = true;
  build();
  /* Inside #canvas-holder (position: relative) alongside the two selector
     badges, so hud.css can hang it off the same corner as #ts-mapbadge. */
  const host = $opt('canvas-holder') || root;   // template changed under us — degrade
  host.appendChild(hudRoot);
  syncHud();
}

/**
 * Re-read the scene into every control. Called by the orchestrator after an
 * environment change (applyEnvironment reapplies a preset and resets el/az) and
 * after anything else that writes the rig from outside this panel.
 */
export function syncHud() {
  initHud();
  const h = clamp(num(getHourOfDay(), HOUR_MIN), HOUR_MIN, HOUR_MAX);
  /* Only place that writes the hour input's own value: the input handler must
     never fight the thumb the user is dragging. */
  hourInput.value = String(h);
  paintHour(h);
  paintElevation(sceneState.el);
  paintAzimuth(sceneState.az);
  paintBrightness(num(sceneState.brightness, 1) * 100);
  paintPresets();
}
