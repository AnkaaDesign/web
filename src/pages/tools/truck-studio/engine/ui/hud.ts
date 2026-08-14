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
import { root, $opt, el, num, isMounted } from '../core/dom';
import {
  sceneState, LIGHT_PRESETS, applyPreset, setLightParams,
  setHourOfDay, getHourOfDay, HOUR_MIN, HOUR_MAX, beginLightScrub,
  warmLightPrograms,
  BACKDROPS, STUDIO_RANGE, isStudioPreset, setStudioParams, getStudioParams,
  TEMP_NEUTRAL, onRig,
  /* Contadores do `renderer.info`, que o three mantém quer alguém leia ou não —
     ver o cabeçalho de `getRenderStats()`. É a matéria-prima do bloco de
     diagnóstico, e ela é GRATUITA: nada é ligado para produzi-la. */
  getRenderStats,
} from '../scene/scene';
import { claimPill, paintFrame } from './loader';
/* O perfil de qualidade. Módulo FOLHA — ver o cabeçalho de `core/quality.ts`. */
import {
  qualityMode, qualityLevel, setQualityMode, onQualityChange, onScaleChange,
  renderScale, setRenderScale, scaleBand, getProfile,
  coldProfile, appliedColdProfile, coldPending,
  frameTimeEma, submitTimeEma, probeHardware, suggestLevel,
  LEVEL_LABEL, type QualityMode, type ColdProfile,
} from '../core/quality';

/* ---------------- trocar de preset SEM engasgo ----------------
   Um clique de preset abre um tween de 0,8 s ≈ 48 quadros, e CADA UM redesenha
   o mapa de sombra inteiro. Pior: o primeiro quadro do preset novo é onde o
   three compila todo programa que ele ainda não viu, e essa compilação é
   síncrona — o tween começa travando exatamente onde ele deveria ser mais
   suave.

   A correção não é esconder o travamento: é PAGÁ-LO ANTES, anunciado.
   `warmLightPrograms()` já existe e já é aguardado dentro da cortina de
   carregamento (studio.ts) justamente para isto; aqui ele ganha o mesmo uso com
   a pílula no lugar da cortina, porque isto dura menos de um segundo e tomar a
   tela inteira por isso seria trocar um engasgo por um susto.

   Ordem: pílula → um quadro cedido (senão a pílula só apareceria DEPOIS do
   trabalho que ela anuncia) → compilar → só então o tween. O travamento vira
   uma espera anunciada de duração conhecida. */
let presetBusy = false;

async function applyPresetWithFeedback(id: string, name: string) {
  /* Um de cada vez: dois tweens sobrepostos disputariam o mesmo rig, e o
     segundo clique já não teria como saber de onde a luz está saindo. */
  if (presetBusy) return;
  presetBusy = true;
  const pill = claimPill(`Ajustando a luz · ${name}…`);
  try {
    await paintFrame();
    /* Aguardado: sem isto a compilação aconteceria no primeiro quadro do tween,
       que é o quadro que o usuário está olhando. */
    await warmLightPrograms();
    beginLightScrub();
    applyPreset(id);
    syncHud();                              // applyPreset resets az/el/brightness
    /* A pílula fica de pé enquanto o tween corre. Ela descreve o que está
       acontecendo, e o que está acontecendo dura 0,8 s. */
    await new Promise<void>((r) => setTimeout(r, PRESET_TWEEN_MS));
  } finally {
    pill.release();
    presetBusy = false;
  }
}

/* O tween de applyPreset() em scene/scene.ts. Duplicado como número aqui de
   propósito: ele não é exportado, e importar a constante obrigaria a mexer num
   módulo de cena para um detalhe de UI. Errar para MAIS seria uma pílula
   pendurada depois de a luz assentar; este valor é o do tween. */
const PRESET_TWEEN_MS = 800;

/* Same ranges the sidebar shipped, so nothing about the light's reachable set
   changes with the move: elevation 2..85°, brightness 15..250 % of the preset's
   own keyIntensity. Azimuth is a full circle by definition. */
const EL_MIN = 2, EL_MAX = 85;
const BRIGHT_MIN = 15, BRIGHT_MAX = 250;
/** Teto da chave na face de ESTÚDIO — ver applyFace(). */
const BRIGHT_MAX_STUDIO = 600;

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

  /* --- configurações ---
     A ENGRENAGEM, e não um trio de faders. O painel de configurações é feito de
     controles deslizantes e pastilhas — as mesmas formas da face de iluminação —,
     então um glifo de "faders" descreveria o CONTEÚDO dos dois cabeçalhos
     igualmente e não distinguiria um do outro. A engrenagem é o único desenho que
     diz "ajuste de máquina" em oposição à lâmpada, que diz "decisão de foto". Essa
     oposição é justamente a razão de as duas faces terem se separado. */
  gear: '<circle cx="12" cy="12" r="3"/>'
    + '<path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3'
    + ' 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1'
    + 'a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1'
    + 'a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3'
    + 'H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1'
    + 'a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1'
    + 'a1.6 1.6 0 0 0-1.5 1Z"/>',
  /* Pontas da régua de ESCALA DE RENDER: quatro células grandes contra uma malha
     fina. Não é "escuro→claro" nem "pequeno→grande": o que a escala move é a
     DENSIDADE DE AMOSTRAGEM, e uma grade é a única figura honesta disso — é a
     mesma coisa que `renderScale` faz com os fragmentos. */
  pixelLow: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/>'
    + '<rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2"/>'
    + '<rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2"/>'
    + '<rect x="13" y="13" width="7.5" height="7.5" rx="1.2"/>',
  pixelHigh: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>'
    + '<path d="M8 3.5v17M13 3.5v17M18 3.5v17M3.5 8h17M3.5 13h17M3.5 18h17"/>',

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
/* ---- a face de CONFIGURAÇÕES ----
   Sem `!` em NENHUM destes, e a razão é a mesma que já valia para a fileira de
   qualidade: `paintQuality()` é chamado por `onQualityChange`, e `paintScale()`
   por `onScaleChange` — dois ganchos registrados no escopo do módulo que o
   adaptador automático pode disparar ANTES de o painel existir (o medidor roda no
   laço, o HUD é construído sob demanda). A guarda de nulo em cada pintor é o que
   cobre essa janela; um `!` aqui seria mentira de tipo. */
let cfgHint: HTMLElement | null = null;

let qualityVal: HTMLElement | null = null;
let qualityTiles: HTMLElement | null = null;

let coldRow: HTMLElement | null = null;
let coldNote: HTMLElement | null = null;
let coldBtn: HTMLButtonElement | null = null;

let scaleInput: HTMLInputElement | null = null;
let scaleVal: HTMLElement | null = null;
let scaleNote: HTMLElement | null = null;
let scalePx: HTMLElement | null = null;

let floorVal: HTMLElement | null = null;

let diagStats: HTMLElement | null = null;
let diagNote: HTMLElement | null = null;

let hwStats: HTMLElement | null = null;

/* ---- face de estúdio ----
   As LINHAS inteiras, e não só os controles: a troca de face é feita
   escondendo/mostrando a linha (rótulo + leitura + controle juntos), que é a
   unidade que o painel desenha. */
let hourRow!: HTMLElement;
let weatherRow!: HTMLElement;
let backdropRow!: HTMLElement;
let backdropTiles!: HTMLElement;
let backdropVal!: HTMLElement;
let fillRow!: HTMLElement;
let fillInput!: HTMLInputElement;
let fillVal!: HTMLElement;
let rimRow!: HTMLElement;
let rimInput!: HTMLInputElement;
let rimVal!: HTMLElement;
let softRow!: HTMLElement;
let softInput!: HTMLInputElement;
let softVal!: HTMLElement;
let tempRow!: HTMLElement;
let tempInput!: HTMLInputElement;
let tempVal!: HTMLElement;

let collapsed = false;
/* CONFIGURAÇÕES ABRE FECHADA, e isso não é timidez de interface: é a mesma
   distinção que separou as duas faces. Iluminação é decisão AUTORAL e se mexe o
   tempo todo; qualidade é decisão de MÁQUINA e se consulta quando alguma coisa
   está errada. Um bloco de diagnóstico permanentemente aberto num painel de
   200 px empurraria os controles de luz para dentro de uma barra de rolagem em
   troca de números que ninguém está lendo. */
let dragPointer: number | null = null;   // pointerId while the dial is turning

/* ---------------- persistence ---------------- */

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(HUD_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;
    collapsed = !!data.collapsed;
    /* `v: 1` no disco não tem o campo, e a AUSÊNCIA tem de resolver para
       "fechada" — que é o padrão acima. `!!undefined` já faria isso; o teste
       explícito existe para que um `false` gravado seja respeitado em vez de
       cair no padrão junto com o ausente. */
  } catch { /* storage bloqueado: os padrões valem */ }
}

function saveCollapsed() {
  try {
    localStorage.setItem(HUD_KEY, JSON.stringify({ v: 2, collapsed }));
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

/* ---------------- a face de ESTÚDIO ----------------
   O MESMO PAINEL, DUAS FACES — e não um segundo painel. O cabeçalho deste
   arquivo diz por quê com todas as letras: duas superfícies vivas escrevendo o
   mesmo estado de cena são uma fábrica de bugs, e foi isso que matou a sidebar.
   Um "painel de estúdio" separado teria de repetir altura, intensidade e posição
   da chave — que são as MESMAS três coisas — e a primeira divergência entre eles
   seria um relato de bug que ninguém consegue reproduzir.

   O QUE MUDA ENTRE AS FACES é só o que não tem significado do outro lado:

     cena externa   hora do dia  +  clima
     estúdio        fundo  +  preenchimento  +  recorte  +  difusão

   e o que fica NAS DUAS é o trio da chave (altura, intensidade, posição), porque
   uma softbox e um sol são a mesma luz principal vista de dois vocabulários.

   Por isso as linhas são construídas UMA VEZ, na ordem abaixo, e a troca de face
   é só visibilidade. Reordenar o DOM a cada `syncHud()` faria o painel piscar a
   cada troca de cenário, e um painel que se remonta perde o foco do teclado no
   meio de um arrasto.

       hora        ·  só cena externa
       fundo       ·  só estúdio
       altura      ·  as duas
       intensidade ·  as duas
       posição     ·  as duas
       preench.    ·  só estúdio
       recorte     ·  só estúdio
       difusão     ·  só estúdio
       clima       ·  só cena externa

   POR QUE A HORA SOME NO ESTÚDIO, e não fica desabilitada: o preset `ciclorama`
   é `solar: false`, ou seja o relógio JÁ não move a luz dele (ver
   syncSunToHour em scene/scene.ts). Um controle deslizante que anda e não muda
   nada é pior do que a ausência dele. */

/* O RÓTULO DA PASTILHA, curto — e o nome inteiro fica no `title`/`aria-label`.
   ---------------------------------------------------------------------------
   As pastilhas de clima são todas de UMA palavra ("Ensolarado", "Nublado",
   "Chuvoso", "Neblina"), e é por isso que `.ts-hud-tile__name` trunca com
   reticências sem nunca truncar nada. "Cinza escuro" e "Cinza claro" não cabem:
   medido, saíam como "Cinza es…" e "Cinza cla…", ou seja as DUAS opções de cinza
   com o mesmo rótulo visível.

   A saída anterior era deixar o nome quebrar em duas linhas só nesta fileira —
   o que resolvia a leitura e custava a PARIDADE, que é justamente o que o dono
   do produto pediu ("com o mesmo design"): a fileira de fundos ficava mais alta
   que a de clima e as duas não se substituíam, uma trocava de lugar com a outra.

   Encurtar resolve as duas coisas de uma vez, e não perde informação porque a
   informação não está no texto: o DISCO ao lado já é a cor. "Escuro" com um
   disco cinza-escuro não é ambíguo com "Claro" com um disco cinza-claro. */
const BACKDROP_TILE_NAME: Record<string, string> = {
  preto: 'Preto',
  'cinza-escuro': 'Escuro',
  'cinza-claro': 'Claro',
  branco: 'Branco',
};

/* O ícone de um fundo: uma BADGE QUADRADA na cor, levemente arredondada.
   ---------------------------------------------------------------------------
   Mesma caixa de 24, mesma espessura de traço e mesmo tamanho de render (20)
   das pastilhas de clima — é literalmente o mesmo slot `.ts-hud-tile__ico`, e é
   isso que faz as duas fileiras serem a MESMA pastilha com desenhos diferentes.

   QUADRADA, E NÃO UM DISCO. Pedido do dono do produto, e a razão está na tela:
   um fundo de estúdio é uma SUPERFÍCIE, e um disco lê como "cor de tinta" — que
   é justamente o vocabulário das pastilhas de cor do veículo e da tira de
   acabamentos. O raio de 4,5 sobre uma caixa de 15,2 é a mesma proporção dos
   9 px sobre 34 px de `.ts-vbtn`, os botões do topo direito: a badge fica na
   mesma família de forma dos controles, que é o que o pedido nomeou.

   O `fill` é a única coisa que foge da convenção "traço em currentColor", e tem
   de fugir: aqui o conteúdo do ícone É a cor. O contorno resolve o mesmo caso
   que a borda da amostra antiga resolvia — `Preto` (#000) sobre o vidro escuro
   do painel some sem contorno, e uma pastilha cujo ícone some parece uma
   pastilha vazia. */
function backdropIcon(bg: number) {
  const hex = '#' + bg.toString(16).padStart(6, '0');
  /* MAIOR que o ícone de clima, e o modificador existe só para isso. Pedido do
     dono do produto, e ele bate com o que as duas coisas são: um glifo de linha
     é legível a 18 px porque o que informa é a FORMA, e uma amostra de cor
     precisa de ÁREA — a diferença entre "Cinza escuro" e "Cinza claro" é de
     luminância, e num quadrado de 18 px com 1,7 px de contorno sobra pouca cor
     para comparar. 26 px é o maior que cabe sem a pastilha crescer (o nome e o
     respiro ocupam o resto da altura). */
  const span = el('span', 'ts-hud-tile__ico ts-hud-tile__ico--badge');
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="' + hex + '"'
    + ' stroke="currentColor" stroke-width="1.4" focusable="false" aria-hidden="true">'
    + '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5"/></svg>';
  return span;
}

function buildBackdropRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--backdrop');

  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Fundo'));
  backdropVal = el('span', 'ts-hud-row__val');
  top.appendChild(backdropVal);
  row.appendChild(top);

  /* SEM o modificador `--swatch`. A fileira de fundos é a fileira de clima: as
     duas se substituem no mesmo lugar do painel conforme o cenário, e um
     modificador que mudasse tamanho ou altura faria a troca ler como o painel
     inteiro se remontando. Ver o cabeçalho de BACKDROP_TILE_NAME. */
  backdropTiles = el('div', 'ts-hud-tiles');
  backdropTiles.setAttribute('role', 'radiogroup');
  backdropTiles.setAttribute('aria-label', 'Cor de fundo do estúdio');
  for (const b of BACKDROPS) {
    const tile = el('button', 'ts-hud-tile');
    tile.type = 'button';
    tile.dataset.backdrop = b.id;
    tile.setAttribute('role', 'radio');
    tile.setAttribute('aria-checked', 'false');
    /* O nome INTEIRO aqui: é o que o mouse lê no hover e o que o leitor de tela
       anuncia — o encurtamento é só do texto desenhado. */
    tile.title = b.name;
    tile.setAttribute('aria-label', b.name);
    tile.appendChild(backdropIcon(b.bg));
    tile.appendChild(el('span', 'ts-hud-tile__name', BACKDROP_TILE_NAME[b.id] || b.name));
    /* Chave discreta → ANIMA, igual às pastilhas de clima. O crossfade entre
       dois fundos é meio segundo de rampa de albedo, e é o que separa "trocou o
       fundo" de "a tela piscou". */
    tile.addEventListener('click', () => {
      setStudioParams({ backdrop: b.id });
      paintStudio();
    });
    backdropTiles.appendChild(tile);
  }
  row.appendChild(backdropTiles);
  return row;
}

/* Os três multiplicadores. Um só construtor porque são a MESMA coisa três
   vezes: um deslizante 0..N cujo 1 é o que o preset autorou. O `centro` do
   controle é o valor calibrado — mexer é sempre um desvio consciente dele. */
function buildStudioRange(
  mod: string, label: string, capA: string, capB: string,
  range: readonly [number, number],
  apply: (v: number) => void,
) {
  const built = buildRangeRow(mod, label, capA, capB,
    Math.round(range[0] * 100), Math.round(range[1] * 100), 5, 'low', 'high');
  built.input.setAttribute('aria-label', label);
  built.input.addEventListener('input', () => {
    beginLightScrub();
    const v = num(built.input.value, 100);
    apply(v / 100);
    built.val.textContent = pctText(v);
    setFill(built.input, v, Math.round(range[0] * 100), Math.round(range[1] * 100));
  });
  return built;
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
    tile.addEventListener('click', () => { void applyPresetWithFeedback(id, preset.name); });
    tilesEl.appendChild(tile);
  }
  row.appendChild(tilesEl);

  return row;
}

/* ===========================================================================
   A FACE DE CONFIGURAÇÕES — e por que ela é uma SEÇÃO IRMÃ, não um segundo painel
   ===========================================================================
   O PEDIDO, literal: *"essas configurações devem estar em configurações, não
   junto com iluminação, não faz sentido"*. Ele está certo, e a razão é mais forte
   que arrumação — está escrita em `core/quality.ts`, na regra que governa aquele
   arquivo inteiro:

       O perfil só mexe em AMOSTRAGEM. Nunca em decisão visual autorada.

   Iluminação é decisão AUTORAL: hora, clima, fundo, preenchimento, recorte e
   temperatura MUDAM A FOTO, e a foto é o produto. Qualidade é decisão de MÁQUINA:
   por construção ela não pode mudar a foto — *"uma captura tirada no Baixo sai com
   o mesmo enquadramento e a mesma luz da tirada no Alto, só mais serrilhada"*.
   Deixar as duas na mesma superfície CONTRADIZ a regra na interface: quem vê a
   fileira de qualidade entre o recorte e o clima conclui, corretamente para o que
   está olhando, que ela é mais um botão de foto.

   POR QUE NÃO UM PAINEL FLUTUANTE SEPARADO. Medido nos arquivos que definem os
   cantos: a coluna esquerda de `#canvas-holder` já é `.ts-mapbadge` (topo),
   `#ts-hud` (meio) e `.ts-corner` (base) — é exatamente para isso que existem
   `--ts-hud-top` e `--ts-hud-reserve` —, e a direita é `#view-controls` (topo) e
   `#ts-panels` (base). Não sobra canto. Um quinto painel teria de se sobrepor a
   um dos quatro, e os quatro moram em arquivos que este trabalho não pode tocar.

   Então a separação é feita onde ela custa zero pixel: DUAS SEÇÕES no mesmo
   vidro, cada uma com seu cabeçalho, seu ícone, seu estado de recolhimento e seu
   `role=group` rotulado. A lâmpada continua dizendo "foto"; a engrenagem diz
   "máquina". E `Configurações` abre FECHADA, então o painel de luz não perde uma
   linha de altura por causa dela.

   ⚠️ O RECOLHIMENTO PASSOU A SER DIRIGIDO POR `aria-expanded`, e não mais pela
   classe `is-collapsed` na raiz. Com dois cabeçalhos, uma classe na raiz giraria
   as DUAS setas e mostraria os DOIS resumos. `aria-expanded` já era escrito por
   `applyCollapsed()`, é por seção por definição, e usá-lo como gancho de CSS
   torna impossível a seta dessincronizar do estado acessível — é o mesmo
   argumento que fez `aria-checked` entrar ao lado de `.is-on` nas pastilhas. */

/* ---------------- QUALIDADE ----------------
   QUATRO POSIÇÕES: Automático · Alta · Média · Baixa.

   POR QUE ISTO EXISTE NA INTERFACE, E NÃO SÓ NO CONSOLE. Adaptação silenciosa é
   um defeito, e este arquivo já rejeitou essa forma uma vez: a nota de
   `warnIfUnpaintable()` diz que *"um usuário informado é um bug relatado, um
   usuário calado é um bug perdido"*. Vale igual aqui — alguém cuja imagem
   piorou sozinha e que não sabe por quê vai relatar "o estúdio está borrado",
   que é um defeito impossível de diagnosticar. Com o controle visível, a mesma
   pessoa relata "ele caiu para Baixo sozinho", que é uma frase acionável.

   EM AUTOMÁTICO O RÓTULO MOSTRA ONDE ELE ESTÁ (`Automático · média`), porque
   "automático" sozinho não responde a pergunta que a pessoa tem.

   ESCOLHER UM NOME CONGELA O ADAPTADOR, e isso é um direito: quem escolheu Alta
   num PC fraco escolheu ver 20 quadros por segundo. O medidor nem é consultado
   depois — ver `setQualityMode()`. */

/* ⚠️ OS `title` DESTAS PASTILHAS ERAM MENTIRA, E A MENTIRA CUSTOU UMA AUDITORIA.
   ---------------------------------------------------------------------------
   O texto anterior de Baixa era *"Resolução 1×, sombra 1024², sem reflexo nem
   casca de laranja"*, e ele errava em duas frentes ao mesmo tempo:

     · "Resolução 1×" descrevia `pixelRatioCap`, que é um TETO — `min(dpr, 1)`.
       Num monitor a `devicePixelRatio` 1, que é o caso da esmagadora maioria dos
       desktops, `min(1,2)` e `min(1,1)` são o mesmo número. A pastilha prometia
       um corte de resolução que não acontecia.
     · "sombra 1024²" deixou de ser verdade nesta revisão: o Baixo fica em 2048²
       DE PROPÓSITO (o passe de sombra é limitado por geometria, não por
       resolução, e a leitura já cai de 17 taps para 1 pelo filtro `basic`).

   Foi essa distância entre o rótulo e a tabela que produziu o relato *"no modo de
   qualidade baixa não vejo diferença nenhuma"*. Os textos abaixo são lidos, valor
   por valor, de `PROFILES` e `COLD` em `core/quality.ts`. Se um dia divergirem,
   é ESTE arquivo que está errado. */
const QUALITY_OPTS: { id: QualityMode; name: string; title: string }[] = [
  {
    id: 'auto', name: 'Auto',
    title: 'Ajusta sozinho pelo tempo de quadro medido. Mexe primeiro na escala de'
      + ' render, que é barata e reversível, e só troca de nível quando a escala'
      + ' satura no fim da faixa.',
  },
  {
    id: 'alta', name: 'Alta',
    title: 'Escala de render 100 %. Sombra 3072² com filtro PCF de 17 amostras.'
      + ' Anisotropia 8 (veículo) e 16 (chão). Reflexo do piso completo. Casca de'
      + ' laranja e 2 oitavas de floco na tinta. Sem corte de LOD. 14 refletores à'
      + ' noite. É o que o estúdio sempre fez — nenhum degrau ligado.',
  },
  {
    id: 'media', name: 'Média',
    title: 'Escala de render 80 %, ou seja 64 % dos fragmentos. Sombra 2048², ainda'
      + ' PCF. Anisotropia 4 e 8. Reflexo do piso só com as silhuetas que sobrevivem'
      + ' a mip 4 (sai parafusaria, ferragem e pneu). Sem casca de laranja — o maior'
      + ' ganho barato do shader de tinta. LOD abaixo de 1,5 px. 6 refletores à'
      + ' noite: saem os 8 postes, o vidro aceso deles continua.',
  },
  {
    id: 'baixa', name: 'Baixa',
    title: 'Escala de render 65 %, ou seja 42 % dos fragmentos. Sombra 2048² com'
      + ' filtro de 1 amostra (a borda vira escada de um texel e a penumbra larga do'
      + ' preset chuvoso deixa de existir). Anisotropia 2. Sem reflexo do piso, sem'
      + ' casca de laranja, 1 oitava de floco. LOD abaixo de 3 px. Nenhum refletor'
      + ' de rua à noite. Persegue 45 fps, não 60.',
  },
];

function buildQualityRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--quality');
  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Qualidade'));
  qualityVal = el('span', 'ts-hud-row__val');
  top.appendChild(qualityVal);
  row.appendChild(top);

  /* CONSTRUÍDO NUM LOCAL E SÓ DEPOIS PUBLICADO NA VARIÁVEL DE MÓDULO — é o padrão
     em todos os construtores desta seção. Uma `let` de módulo que qualquer função
     pode reatribuir nunca é estreitada pelo TypeScript, então usá-la direto aqui
     exigiria um `!` por linha; e este arquivo já registrou que `!` num valor que
     PODE ser nulo é mentira de tipo. O local é não-nulo por construção. */
  const tiles = el('div', 'ts-hud-tiles');
  tiles.setAttribute('role', 'radiogroup');
  tiles.setAttribute('aria-label', 'Qualidade da imagem');
  for (const o of QUALITY_OPTS) {
    const tile = el('button', 'ts-hud-tile ts-hud-tile--text');
    tile.type = 'button';
    tile.dataset.quality = o.id;
    tile.setAttribute('role', 'radio');
    tile.setAttribute('aria-checked', 'false');
    tile.title = o.title;
    tile.setAttribute('aria-label', o.name + ' — ' + o.title);
    tile.appendChild(el('span', 'ts-hud-tile__name', o.name));
    /* Trocar de nível mexe na faixa da escala, na assinatura fria e no reflexo do
       piso de uma vez — repinta a seção inteira, não só esta fileira. */
    tile.addEventListener('click', () => { setQualityMode(o.id); paintCfg(); });
    tiles.appendChild(tile);
  }
  row.appendChild(tiles);
  qualityTiles = tiles;
  return row;
}

/* O ADAPTADOR MUDA O NÍVEL SOZINHO, e o rótulo tem de ir junto — senão o painel
   diria "Automático · alta" com a cena rodando em Baixo, que é pior do que não
   ter o controle. Registrado no escopo do módulo, uma vez: o gancho sobrevive ao
   painel ser construído depois, porque todo pintor sai cedo enquanto ele não
   existe. */
onQualityChange(() => paintCfg());

function paintQuality() {
  if (!qualityVal || !qualityTiles) return;
  const mode = qualityMode();
  const level = qualityLevel();
  /* Em automático o nível EFETIVO vai junto; num nível fixo ele seria a mesma
     palavra duas vezes. */
  qualityVal.textContent = mode === 'auto'
    ? 'Automático · ' + LEVEL_LABEL[level].toLowerCase()
    : LEVEL_LABEL[level];
  for (const tile of qualityTiles.querySelectorAll<HTMLElement>('.ts-hud-tile')) {
    const on = tile.dataset.quality === mode;
    tile.classList.toggle('is-on', on);
    tile.setAttribute('aria-checked', on ? 'true' : 'false');
  }
}

/* ---------------- MUDANÇA FRIA PENDENTE ----------------
   `core/quality.ts` separa botões QUENTES de FRIOS, e a separação é o que torna a
   adaptação automática segura por construção: *"o medidor NUNCA toca aqui"*. Um
   botão frio muda um `#define`, uma chave de cache de programa ou um parâmetro de
   construtor — trocá-lo exige cortina, e um engasgo de recompilação disparado
   sozinho no meio de um arrasto é exatamente o defeito que a adaptação existe
   para evitar.

   Consequência para a interface: escolher "Baixa" pode NÃO entregar tudo que a
   pastilha promete até a cena ser reconstruída. Sem esta fileira, o usuário leria
   o rótulo, não veria o ganho e concluiria de novo que o controle não faz nada —
   o mesmo relato que originou toda esta revisão. Ela existe para que a distância
   entre o PEDIDO e o APLICADO seja visível em vez de ser um mistério.

   ⚠️ POR QUE O CAMINHO DE APLICAÇÃO É PROCURADO, E NÃO IMPORTADO.
   Quem sabe subir a cortina é `studio.ts` — ele já tem `releasedChoice` +
   `RELEASE_MS`, é o dono do laço e do ciclo de carga. Mas `ui/hud.ts` é importado
   POR `studio.ts` (`initHud()` roda no boot dele), então um `import` daqui para lá
   fecharia um ciclo de módulos. Sobram duas portas, e as duas estão abertas:

     1. `setColdApplyHandler(fn)`, exportado abaixo. É a porta PREFERIDA — é
        explícita, é tipada e não depende de um objeto global existir. `studio.ts`
        chama uma vez, logo depois de `initHud()`.
     2. `window.__studio`, que `studio.ts` já publica e já contém `quality`. É a
        rede de segurança para o caso de a integração ainda não ter ligado (1),
        e é acessada com `typeof === 'function'` em vez de `any`.

   CONFERIDO NO CÓDIGO VIVO: `studio.ts` exporta `applyColdQuality()` e o publica
   como `window.__studio.quality.applyCold` — ou seja, a porta (2) já responde e o
   botão funciona sem integração nenhuma. A porta (1) continua sendo a preferida
   por uma razão de TEMPO: o handle só é instalado no FIM do `boot()`, depois do
   primeiro `applyChoice`, enquanto `initHud()` roda bem antes. Entre os dois
   momentos o botão se declara indisponível — e se declara com honestidade, mas um
   `setColdApplyHandler()` logo após `initHud()` fecharia essa janela. Como o
   painel repinta a cada tique de diagnóstico e a cada mudança de nível, ele se
   conserta sozinho assim que o handle aparece.

   Se nenhuma das duas responder, o botão fica DESABILITADO com texto honesto —
   e o texto é honesto porque a mudança realmente vai acontecer sozinha: o próprio
   `coldPending()` documenta que ela *"é aplicada na próxima borda natural de carga
   (troca de cenário/veículo)"*. Prometer um botão que não recarrega nada seria
   pior do que não ter botão. */

type ColdApply = () => void | Promise<void>;
let coldApplyHook: ColdApply | null = null;

/**
 * Registra quem sabe reconstruir a cena para aplicar a assinatura fria.
 *
 * Chamado por `studio.ts` depois de `initHud()`. Idempotente e reversível
 * (`null` desregistra), porque o engine sobrevive à rota do React e um handle
 * pendurado num escopo morto seria pior que nenhum.
 */
export function setColdApplyHandler(fn: ColdApply | null) {
  coldApplyHook = fn;
  paintCold();
}

function coldApply(): ColdApply | null {
  if (coldApplyHook) return coldApplyHook;
  /* Cast local em vez de confiar no `declare global` de `studio.ts`: ele existe,
     mas depender dele daqui amarraria este módulo à ordem de compilação de um
     arquivo que não importamos. */
  const handle = (window as Window & { __studio?: Record<string, unknown> }).__studio;
  if (!handle) return null;
  const direct = handle.applyColdQuality;
  /* `.call(dono)` e nunca a referência solta: um método publicado num objeto
     literal pode legitimamente usar `this`, e desmontá-lo aqui seria um
     `undefined` no meio de uma cortina de carregamento. */
  if (typeof direct === 'function') return () => (direct as ColdApply).call(handle);
  const q = handle.quality as Record<string, unknown> | undefined;
  if (q) {
    const nested = q.applyCold ?? q.applyColdQuality;
    if (typeof nested === 'function') return () => (nested as ColdApply).call(q);
  }
  return null;
}

const SHADOW_LABEL: Record<ColdProfile['shadowType'], string> = {
  pcf: 'PCF (17 amostras)', basic: '1 amostra',
};
/* `''` é "os arquivos de sempre" — ver `groundVariant`/`hdrVariant`. O rótulo diz
   o que o arquivo É, não o sufixo, porque o sufixo não quer dizer nada para quem
   está lendo o painel. */
const VARIANT_LABEL: Record<string, string> = {
  '': 'originais', '@1k': '1024²', '@ktx2': 'KTX2/BC7',
};

function buildColdRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--cold hidden');
  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Mudança pendente'));
  row.appendChild(top);

  const note = el('span', 'ts-hud-note ts-hud-note--warn');
  /* `polite`, nunca `assertive`: isto aparece como CONSEQUÊNCIA de um clique que
     o usuário acabou de dar, então interromper a leitura dele para anunciar o
     efeito do próprio clique seria ruído. */
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  row.appendChild(note);

  const btn = el('button', 'ts-hud-btn');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    const fn = coldApply();
    if (fn) void fn();
  });
  row.appendChild(btn);

  coldRow = row;
  coldNote = note;
  coldBtn = btn;
  return row;
}

function paintCold() {
  if (!coldRow || !coldNote || !coldBtn) return;
  const pending = coldPending();
  coldRow.classList.toggle('hidden', !pending);
  if (!pending) return;

  const want = coldProfile();
  const got = appliedColdProfile();
  const diffs: string[] = [];
  if (want.spotPool !== got.spotPool) {
    diffs.push('refletores à noite ' + got.spotPool + ' → ' + want.spotPool);
  }
  if (want.shadowType !== got.shadowType) {
    diffs.push('filtro de sombra ' + SHADOW_LABEL[got.shadowType]
      + ' → ' + SHADOW_LABEL[want.shadowType]);
  }
  if (want.antialias !== got.antialias) {
    diffs.push('MSAA ' + (got.antialias ? 'ligado' : 'desligado')
      + ' → ' + (want.antialias ? 'ligado' : 'desligado'));
  }
  if (want.groundVariant !== got.groundVariant) {
    diffs.push('texturas de chão ' + (VARIANT_LABEL[got.groundVariant] || got.groundVariant)
      + ' → ' + (VARIANT_LABEL[want.groundVariant] || want.groundVariant));
  }
  if (want.hdrVariant !== got.hdrVariant) {
    diffs.push('HDR de ambiente ' + (VARIANT_LABEL[got.hdrVariant] || got.hdrVariant)
      + ' → ' + (VARIANT_LABEL[want.hdrVariant] || want.hdrVariant));
  }

  const fn = coldApply();
  coldNote.textContent = diffs.join(' · ')
    + (fn
      ? '. Recompila os shaders da cena — leva uma cortina de alguns segundos.'
      : '. Aplica sozinho na próxima troca de cenário ou de veículo.');
  coldBtn.disabled = !fn;
  coldBtn.textContent = fn ? 'Aplicar agora' : 'Aplica na próxima carga';
  coldBtn.title = fn
    ? 'Solta a cena e a reconstrói com a assinatura fria do nível escolhido.'
    : 'Nenhum caminho de recarga registrado nesta compilação. A mudança entra na'
      + ' próxima borda natural de carga, ou ao recarregar a página — o nível'
      + ' escolhido fica salvo.';
}

/* ---------------- ESCALA DE RENDER ----------------
   O BOTÃO DOMINANTE, e o que faltava. `core/quality.ts` é explícito: o custo de
   preenchimento escala com o QUADRADO disto, e — ao contrário do teto de
   `devicePixelRatio` — ele funciona em qualquer monitor.

   ⚠️ A LEITURA É EM PIXELS, e não só em fator. `0,78` não é acionável; `1920×1080
   · 78 % → 1498×842` é: dá para comparar com a resolução do monitor, dá para
   colar num relato de bug e dá para ver que o número mudou. E os dois pares saem
   do CANVAS — `clientWidth/clientHeight` é o tamanho lógico, `width/height` é o
   drawing buffer que o three alocou. Nenhum dos quatro é calculado aqui.

   Isso é deliberado e é a parte que torna o controle AUDITÁVEL: se um dia a
   escala parar de ser aplicada no `setSize()`, o segundo par não vai acompanhar o
   primeiro e a divergência aparece na tela em vez de virar mais um "não vejo
   diferença nenhuma".

   ⚠️ EM AUTOMÁTICO O CONTROLE FICA DESABILITADO, e isso não é uma amputação: em
   `auto` o controlador anda dentro da faixa a cada 900 ms para segurar o alvo de
   tempo de quadro, então um arrasto do usuário duraria menos de um segundo. Este
   arquivo já decidiu esse caso uma vez, sobre a hora do dia no ciclorama: *"um
   controle deslizante que anda e não muda nada é pior do que a ausência dele"*.
   Aqui ele fica visível e vivo (o valor se move sozinho, é o que se quer ver),
   mas não aceita a mão — e a nota diz como pegar o volante. */

function buildScaleRow() {
  const built = buildRangeRow('scale', 'Escala de render', 'pixelLow', 'pixelHigh',
    50, 100, 1, 'low', 'high');
  scaleInput = built.input;
  scaleVal = built.val;
  built.input.setAttribute('aria-label', 'Escala de render');
  built.input.addEventListener('input', () => {
    setRenderScale(num(built.input.value, 100) / 100);
    /* `setRenderScale` emite `onScaleChange`, que já repinta — mas só quando o
       valor MUDA de verdade (há uma banda morta de 1e-4 lá dentro). Repintar aqui
       também é o que garante que a leitura acompanhe o polegar mesmo num degrau
       que o módulo considerou nulo. */
    paintScale();
  });

  scalePx = el('span', 'ts-hud-note ts-hud-note--px');
  built.row.appendChild(scalePx);
  scaleNote = el('span', 'ts-hud-note');
  built.row.appendChild(scaleNote);
  return built.row;
}

/* O gancho de escala é registrado no módulo pela mesma razão do de qualidade: o
   controlador dinâmico pode mexer na escala antes de o painel existir. */
onScaleChange(() => { paintScale(); paintCfgHint(); });

/** Os dois pares de dimensões do canvas vivo, ou `null` antes de ele existir. */
function canvasPixels() {
  const c = $opt('canvas-holder')?.querySelector('canvas');
  if (!c) return null;
  return {
    cssW: Math.round(c.clientWidth), cssH: Math.round(c.clientHeight),
    bufW: c.width, bufH: c.height,
  };
}

function paintScale() {
  if (!scaleInput || !scaleVal || !scaleNote || !scalePx) return;
  const auto = qualityMode() === 'auto';
  const band = scaleBand();
  const lo = Math.round(band.min * 100);
  const hi = Math.round(band.max * 100);
  /* A FAIXA MUDA COM O NÍVEL (0,85–1 no Alto, 0,50–0,85 no Baixo), então os
     limites do input são reescritos a cada pintura em vez de fixados na
     construção. Escritos só quando mudam: atribuir `min`/`max` reavalia o valor
     do input, e fazer isso a cada quadro de arrasto brigaria com o polegar. */
  if (scaleInput.min !== String(lo)) scaleInput.min = String(lo);
  if (scaleInput.max !== String(hi)) scaleInput.max = String(hi);

  const pct = Math.round(renderScale() * 100);
  scaleInput.value = String(clamp(pct, lo, hi));
  /* A LEITURA MOSTRA O VALOR REAL, não o preso à faixa: `setRenderScale()` aceita
     0,35 a 2,0 por escolha explícita (o console e a bancada usam), e um número
     fora da faixa é justamente o que se precisa enxergar. */
  scaleVal.textContent = pctText(pct);
  setFill(scaleInput, clamp(pct, lo, hi), lo, hi);
  scaleInput.disabled = auto;

  const px = canvasPixels();
  scalePx.textContent = px
    ? px.cssW + '×' + px.cssH + ' → ' + px.bufW + '×' + px.bufH + ' desenhados'
    : 'canvas ainda não medido';

  const alvo = String(Math.round(band.targetMs * 10) / 10).replace('.', ',');
  scaleNote.textContent = auto
    ? 'O controlador move a escala sozinho entre ' + lo + ' e ' + hi
      + ' % para segurar ' + alvo + ' ms por quadro. Congele um nível para travá-la.'
    : 'Faixa do nível ' + LEVEL_LABEL[qualityLevel()] + ': ' + lo + '–' + hi
      + ' %. O custo de preenchimento cai com o quadrado.';
}

/* ---------------- REFLEXO DO PISO ----------------
   MOSTRADOR, NÃO CONTROLE — e a escolha é deliberada.

   Ele é o item mais caro do cenário Estúdio por duas contas independentes: 14,1
   fps medidos por `scene/floor-reflection.ts` e **96,7 MB de VRAM** (alvo
   1600×1080 `HalfFloatType` com mipmaps e `samples: 4`, dos quais ~79 MB são só o
   buffer multiamostrado). Isso o torna o segundo maior item isolado do orçamento
   de memória da cena, atrás apenas dos 341 MB de chão. Merece aparecer.

   ⚠️ MAS A ÚNICA PORTA DE ESCRITA QUE EXISTE HOJE É BINÁRIA. `cyclorama.ts`
   reexporta `setFloorReflection(on: boolean)`, e o perfil passou a ter TRÊS
   estados (`full` / `lod` / `off`). Um controle de três posições ligado a uma
   porta de duas ou perderia o estado do meio ou mentiria sobre ele; e a porta de
   três estados mora em arquivos de cena que este trabalho não pode editar.

   Entre um controle que não controla e um mostrador honesto, o mostrador. Ele diz
   o valor E diz quem decide, que é a informação de que alguém precisa para
   entender por que o piso do estúdio perdeu o brilho ao cair para Média. */
const FLOOR_LABEL: Record<string, string> = {
  full: 'Completo', lod: 'Só silhuetas', off: 'Desligado',
};

function buildFloorRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--floor');
  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Reflexo do piso'));
  floorVal = el('span', 'ts-hud-row__val');
  top.appendChild(floorVal);
  row.appendChild(top);

  const note = el('span', 'ts-hud-note',
    'Decidido pelo nível de qualidade, não por aqui. Só existe no cenário Estúdio.'
    + ' Custo medido: 14,1 fps e 96,7 MB de VRAM — o segundo maior item de memória'
    + ' da cena.');
  row.appendChild(note);
  return row;
}

function paintFloor() {
  if (!floorVal) return;
  const v = getProfile().floorReflection;
  floorVal.textContent = FLOOR_LABEL[v] || v;
}

/* ---------------- DIAGNÓSTICO ----------------
   ESTE BLOCO É A RAZÃO DE A SEÇÃO EXISTIR.

   O relato que originou a reescrita de `core/quality.ts` foi *"colocando no modo
   de qualidade baixa não vejo diferença nenhuma, nem visual, nem de performance"*
   — e ele estava certo. Custou uma auditoria botão por botão para provar. Com
   estes números na tela, a mesma descoberta leva dez segundos: escolhe Baixa,
   olha ms/quadro e chamadas de desenho, vê que não mexeram.

   O adaptador tem de ser AUDITÁVEL pela mesma razão que ele tem de ser visível.

   ⚠️ A COMPARAÇÃO PAREDE × SUBMISSÃO É O DIAGNÓSTICO, e não um segundo número
   decorativo. `core/quality.ts` explica por quê: `performance.now()` em volta do
   `render()` mede SUBMISSÃO, não execução — com `setAnimationLoop` preso ao
   vsync, uma GPU saturada deixa o bloqueio no swap, FORA do `render()`. Então:

     · os dois próximos  → o gargalo é GPU/submissão. Mexer na ESCALA devolve
       quadros.
     · parede muito maior → é CPU fora do `render()` (o teste de corredor de
       `seethrough.ts` roda 60×/s sobre ~650 objetos, inclusive em quadro pulado)
       ou espera de vsync. Baixar resolução não devolve nada.

   ⚠️ ARMADILHA DE LEITURA, e ela é real: `reportFrameTime()` sai na primeira linha
   quando o modo NÃO é `auto`. Ou seja, ao congelar um nível o medidor PARA, e
   `frameTimeEma()` continua devolvendo a última leitura feita em automático.
   Mostrar esse número sem marcação seria exatamente o tipo de mentira de painel
   que esta seção existe para acabar. Daí a nota.

   ⚠️ POR ISSO O `fps desenhado` VEM DO CONTADOR DE QUADROS, e não do EMA: ele é
   derivado de `renderStats.frame`, que o three incrementa sempre, então ele
   continua vivo com o nível congelado. Em compensação ele é 0 numa cena parada —
   o laço é SOB DEMANDA, e um 0 ali significa "nada mudou", não "travou". É a
   mesma leitura que o cabeçalho de `getRenderStats()` descreve. */

const DIAG_MS = 500;
/* Uma vez por meio segundo, e nunca por quadro. `getRenderStats()` é grátis, mas
   escrever nove nós de texto a 60 Hz não é — e um número que pisca 60×/s é
   ilegível de qualquer forma. Meio segundo é rápido o bastante para acompanhar um
   arrasto e lento o bastante para se conseguir ler. */
let diagTimer = 0;
let lastFrame = -1;
let lastFrameAt = 0;

/* Os pares do <dl>, na ordem em que são pintados. Guardados como nós para não
   reconstruir a lista a cada tique — `textContent` num <dd> existente é o barato;
   recriar nove elementos duas vezes por segundo é lixo para o coletor. */
const diagCells: Record<string, HTMLElement> = {};

function statLine(list: HTMLElement, key: string, label: string, title?: string) {
  const dt = el('dt', 'ts-hud-stat__k', label);
  if (title) dt.title = title;
  const dd = el('dd', 'ts-hud-stat__v', '—');
  list.appendChild(dt);
  list.appendChild(dd);
  return (diagCells[key] = dd);
}

function buildDiagRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--diag');
  const top = el('div', 'ts-hud-row__top');
  const label = el('span', 'ts-hud-row__label', 'Diagnóstico');
  label.title = 'Compare PAREDE com SUBMISSÃO: próximos, o gargalo é GPU e a escala'
    + ' de render devolve quadros; parede muito maior, é CPU fora do render() ou'
    + ' espera de vsync, e baixar resolução não devolve nada.';
  top.appendChild(label);
  row.appendChild(top);

  const list = el('dl', 'ts-hud-stats');
  statLine(list, 'wall', 'parede', 'Tempo de PAREDE entre dois quadros'
    + ' desenhados — inclui CPU, GPU, compositor e swap. É o que o usuário sente.');
  statLine(list, 'submit', 'submissão', 'Tempo dentro de renderer.render().'
    + ' Mede SUBMISSÃO, não execução.');
  statLine(list, 'fps', 'quadros/s', 'Derivado do contador do renderer, não do'
    + ' medidor — continua vivo com o nível congelado. O laço é sob demanda: 0'
    + ' significa cena parada, não travada.');
  statLine(list, 'calls', 'chamadas');
  statLine(list, 'tris', 'triângulos');
  statLine(list, 'programs', 'programas', 'Shaders compilados. Um salto aqui é'
    + ' um engasgo de compilação — a razão de os botões frios exigirem cortina.');
  statLine(list, 'tex', 'texturas');
  statLine(list, 'geo', 'geometrias');
  statLine(list, 'env', 'cache de ambiente');
  row.appendChild(list);

  const note = el('span', 'ts-hud-note');
  row.appendChild(note);
  diagStats = list;
  diagNote = note;
  return row;
}

/* "12,4 ms" com vírgula: o painel inteiro é pt-BR, e um ponto decimal no meio de
   uma coluna de números lidos em português lê como separador de milhar. */
const msText = (v: number) => (v > 0 ? v.toFixed(1).replace('.', ',') + ' ms' : '—');
const intText = (v: number) => Math.round(v).toLocaleString('pt-BR');

function paintDiag() {
  if (!diagStats || !diagNote) return;
  /* A árvore do engine SOBREVIVE à rota do React (ver o cabeçalho de
     `core/dom.ts`), então este intervalo pode ficar de pé com o estúdio fora da
     página. Sair aqui é o que impede duas escritas de DOM por segundo em nós que
     ninguém está vendo — o próprio tique fica, porque religá-lo exigiria um
     gancho de montagem que este módulo não tem. */
  /* ⚠️ E ZERA A ÂNCORA AO SAIR, senão o primeiro tique depois de voltar à página
     dividiria os quadros de uma sessão inteira pelo intervalo de meio segundo e
     imprimiria um fps absurdo. `-1` faz esse tique mostrar "—" e o seguinte já
     sair certo. */
  if (!isMounted()) { lastFrame = -1; lastFrameAt = 0; return; }

  const st = getRenderStats();
  const now = performance.now();
  let drawn = -1;
  if (lastFrame >= 0 && now > lastFrameAt) {
    drawn = (st.frame - lastFrame) * 1000 / (now - lastFrameAt);
  }
  lastFrame = st.frame;
  lastFrameAt = now;

  const wall = frameTimeEma();
  const submit = submitTimeEma();
  diagCells.wall.textContent = msText(wall);
  diagCells.submit.textContent = msText(submit);
  diagCells.fps.textContent = drawn >= 0 ? intText(drawn) : '—';
  diagCells.calls.textContent = intText(st.calls);
  diagCells.tris.textContent = intText(st.triangles);
  diagCells.programs.textContent = intText(st.programs);
  diagCells.tex.textContent = intText(st.textures);
  diagCells.geo.textContent = intText(st.geometries);
  diagCells.env.textContent = intText(st.envCacheSize);

  const notes: string[] = [];
  if (qualityMode() !== 'auto') {
    /* Ver a armadilha documentada acima: com o nível congelado o medidor nem é
       consultado, e os dois primeiros números param no tempo. */
    notes.push('Medidor pausado com o nível congelado — parede e submissão são a'
      + ' última leitura feita em automático.');
  }
  if (wall > 0 && submit > 0) {
    /* ⚠️ OS DOIS LIMIARES SÃO AUXÍLIO DE LEITURA, NÃO MEDIÇÃO. Eles apenas
       nomeiam as duas pontas que `core/quality.ts` descreve em palavras
       ("próximos" e "muito maior"); a fronteira exata entre elas não foi medida e
       não pretende ser. Por isso existe a faixa do meio, e por isso ela se
       declara indefinida em vez de chutar um culpado. */
    const r = submit / wall;
    if (r >= 0.7) notes.push('Submissão perto da parede: o gargalo é GPU — a escala de render é o botão.');
    else if (r <= 0.4) notes.push('Parede bem acima da submissão: CPU fora do render() ou espera de vsync.');
    else notes.push('Parede e submissão em faixa intermediária: sem veredito.');
  }
  diagNote.textContent = notes.join(' ');
}

function startDiag() {
  if (diagTimer) return;
  lastFrame = -1;
  lastFrameAt = 0;
  paintDiag();
  diagTimer = window.setInterval(() => { paintDiag(); paintCold(); }, DIAG_MS);
}

function stopDiag() {
  if (!diagTimer) return;
  clearInterval(diagTimer);
  diagTimer = 0;
}

/* ---------------- HARDWARE DETECTADO ----------------
   Uma linha discreta, e ela tem uma justificativa registrada: *"um usuário
   informado é um bug relatado, um usuário calado é um bug perdido"*. Um relato
   que traz a string do adaptador é um relato que se reproduz; um que diz "meu PC"
   não é.

   ⚠️ E ELA MOSTRA O `null` COMO `null`. O Firefox mascara
   `UNMASKED_RENDERER_WEBGL` por privacidade, e a política de `core/quality.ts` é
   literal: *"ausência de informação nunca significa fraco"* — um adaptador não
   identificado abre no nível Alto. Escrever "desconhecido" aqui, em vez de
   esconder a linha, é o que explica por que uma máquina modesta no Firefox pode
   abrir pesada. */
function buildHardwareRow() {
  const row = el('div', 'ts-hud-row ts-hud-row--hw');
  const top = el('div', 'ts-hud-row__top');
  top.appendChild(el('span', 'ts-hud-row__label', 'Hardware'));
  row.appendChild(top);

  hwStats = el('dl', 'ts-hud-stats ts-hud-stats--hw');
  row.appendChild(hwStats);
  return row;
}

function paintHardware() {
  if (!hwStats) return;
  /* UMA VEZ SÓ. `probeHardware()` é memoizada e o hardware não muda no meio da
     sessão, mas `paintCfg()` roda em toda troca de cenário (via `syncHud()`) —
     reconstruir catorze nós a cada uma seria lixo puro para o coletor. */
  if (hwStats.childElementCount) return;
  const hw = probeHardware();
  /* Capturado numa const em vez de `hwStats!` dentro do fecho: a estreitagem de
     tipo não atravessa a fronteira da função, e um `!` aqui seria afirmar de novo
     o que a guarda acima já provou — o mesmo motivo pelo qual os pintores desta
     seção não usam `!` nas suas variáveis de módulo. */
  const list = hwStats;
  const add = (k: string, v: string, title?: string) => {
    const dt = el('dt', 'ts-hud-stat__k', k);
    const dd = el('dd', 'ts-hud-stat__v', v);
    /* O `title` vai nos DOIS nós: a string do adaptador é longa e trunca no <dd>,
       e o rótulo é onde o ponteiro cai primeiro. */
    if (title) { dt.title = title; dd.title = title; }
    list.appendChild(dt);
    list.appendChild(dd);
  };
  add('adaptador', hw.renderer || 'não informado',
    hw.renderer || 'O navegador mascara a string do adaptador (o Firefox faz isso'
      + ' por privacidade). Sem ela o veredito é DESCONHECIDO, e desconhecido abre'
      + ' no nível Alto por política: só o medidor pode rebaixar quem não se'
      + ' identificou.');
  add('núcleos', hw.cores ? String(hw.cores) : '—');
  add('memória', hw.memoryGB ? hw.memoryGB + ' GB' : 'não informada',
    'Só o Chromium expõe navigator.deviceMemory.');
  add('pixels da tela', hw.pixels ? intText(hw.pixels) : '—',
    'Quantos pixels a tela pede, já com o DPR. Numa placa integrada isto pesa mais'
    + ' que o modelo da placa.');
  add('textura máx.', hw.maxTextureSize ? hw.maxTextureSize + '²' : '—');
  add('anisotropia máx.', hw.maxAnisotropy ? hw.maxAnisotropy + '×' : '—');
  add('sonda sugere', LEVEL_LABEL[suggestLevel(hw)],
    'O que a sonda ESTÁTICA sugeriria antes do primeiro quadro. Ela acerta o caso'
    + ' extremo e chuta o meio — quem manda depois é o medidor, e acima dos dois'
    + ' manda a escolha do usuário.');
}

/* ---------------- a seção inteira ---------------- */

/**
 * As fileiras de qualidade, prontas para montar — SEM cabeçalho e SEM painel.
 *
 * Quem monta é `ui/trim-panel.ts`, dentro do card que já carrega "Cores" e
 * "Em cena". Elas continuam definidas aqui porque é aqui que moram os
 * componentes (`ts-hud-row`, `ts-hud-tile`) e o estado que `onQualityChange` e
 * `onScaleChange` repintam; mover o código junto com o lugar teria duplicado
 * tudo isso por uma questão de endereço.
 *
 * ⚠️ **O DIAGNÓSTICO SÓ EXISTE EM DESENVOLVIMENTO**, e isso é um pedido
 * explícito: *"não deveria ter tudo isso de diagnóstico na produção, deve ficar
 * apenas em desenvolvimento"*. Ele está certo — ms por quadro, chamadas de
 * desenho, contagem de programas e a string do adaptador são ferramenta de
 * quem desenvolve, não informação de quem compõe uma foto de caminhão. Em
 * produção o painel fica com o que o usuário pode DECIDIR: o nível, a escala e
 * o aviso de recarga.
 *
 * `DEV` sai de `import.meta.env.DEV`, que o Vite substitui por um literal no
 * build — então o Rollup remove as duas fileiras da árvore em produção. Não é
 * esconder com CSS: elas não existem no bundle.
 *
 * ⚠️ O ACESSO É OPCIONAL (`?.`) E ISSO NÃO É ZELO — é o conserto de um crash
 * que a bancada pegou. O engine é um port autocontido, e `tools/studio-bench`
 * o empacota com esbuild, que só substitui os `define` que recebe: ele recebe
 * `VITE_STUDIO_ASSETS_BASE` e mais nada, então `import.meta.env` chega
 * **undefined** e um acesso direto lança `Cannot read properties of undefined`
 * no meio do boot. O `tsc` não vê isso — o tipo de `import.meta.env` diz que
 * ele existe. Só rodar viu.
 */
const DEV = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function buildQualitySection(): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.appendChild(buildQualityRow());
  frag.appendChild(buildColdRow());
  frag.appendChild(buildScaleRow());
  frag.appendChild(buildFloorRow());
  if (DEV) {
    frag.appendChild(buildDiagRow());
    frag.appendChild(buildHardwareRow());
    /* O TIQUE COMEÇA COM A SEÇÃO, e o dono dele é esta função porque é ela que
       constrói as fileiras que ele pinta. `startDiag()` é idempotente (sai cedo
       se já há temporizador), o que importa porque `trim-panel.ts` reconstrói o
       card inteiro a cada `paint()` — uma troca de veículo, por exemplo.

       O tique se encerra sozinho: `paintDiag()` sai cedo quando os nós saíram do
       documento, e em produção nada disto existe no bundle. */
    startDiag();
  } else {
    /* Sem diagnóstico não há o que pintar em intervalo. Chamado por segurança:
       um build que trocasse de modo em tempo de execução (não existe hoje) não
       pode deixar um temporizador de dev vivo. */
    stopDiag();
  }
  return frag;
}

/* O resumo do cabeçalho recolhido — as duas coisas que respondem "em que a
   máquina está": o modo/nível e a escala corrente. Mais o aviso de pendência,
   que é o único estado desta seção que alguém precisaria descobrir sem ter aberto
   nada. */
function paintCfgHint() {
  /* O cabeçalho que este resumo alimentava era o da seção de Configurações
     dentro do painel de luz, e ele não existe mais. A função fica porque
     `paintCfg()` a chama e porque o card de `trim-panel.ts` pode querer o mesmo
     resumo um dia; enquanto `cfgHint` for nulo ela é uma comparação. */
  if (!cfgHint) return;
  const mode = qualityMode();
  const parts = [
    mode === 'auto'
      ? 'Auto · ' + LEVEL_LABEL[qualityLevel()].toLowerCase()
      : LEVEL_LABEL[qualityLevel()],
    pctText(Math.round(renderScale() * 100)),
  ];
  if (coldPending()) parts.push('pendente');
  cfgHint.textContent = parts.join(' · ');
}

/** Repinta a seção inteira. Barato: nenhum pintor aqui toca a cena. */
function paintCfg() {
  paintQuality();
  paintCold();
  paintScale();
  paintFloor();
  paintHardware();
  paintCfgHint();
}

/* ⚠️ O RECOLHIMENTO DA SEÇÃO SAIU DAQUI, e com ele `cfgHead`/`cfgBody`.
   As fileiras de qualidade moram agora em `ui/trim-panel.ts`, dentro de um card
   que tem o próprio recolhimento — manter um segundo mecanismo aqui era guardar
   estado para uma superfície que este arquivo não desenha mais.

   O que ficou: `paintCfg()`, chamado por `syncHud()` e pelos ganchos de
   qualidade, porque os PINTORES continuam sendo daqui (é aqui que mora o estado
   que `onQualityChange`/`onScaleChange` repintam). E `startDiag()`/`stopDiag()`,
   que o `trim-panel` aciona ao abrir e fechar o card. */

function build() {
  hudRoot = el('aside', 'ts-hud');
  hudRoot.id = 'ts-hud';
  /* NÃO mais "Iluminação": o painel passou a hospedar duas seções, e cada uma
     carrega o próprio rótulo no seu `role=group`. Um `aria-label` de "Iluminação"
     na raiz anunciaria o bloco de diagnóstico como parte da luz — que é
     precisamente a confusão que esta separação existe para desfazer. */
  hudRoot.setAttribute('aria-label', 'Controles do estúdio');

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
  /* O modificador `--light` existe para o CSS poder falar de UM cabeçalho: desde
     que há dois, um seletor sem ele alcança os dois. */
  headBtn = el('button', 'ts-hud__head ts-hud__head--light');
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
  bodyEl.setAttribute('role', 'group');
  bodyEl.setAttribute('aria-label', 'Iluminação');

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
  hourRow = hour.row;
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

  /* Os três multiplicadores do estúdio, DEPOIS do trio da chave: a leitura é
     "esta é a luz principal; agora quanto de preenchimento, recorte e difusão
     em volta dela", que é a ordem em que um fotógrafo monta o set. */
  const fill = buildStudioRange('fill', 'Preenchimento', 'dim', 'bright',
    STUDIO_RANGE.fill, (v) => setStudioParams({ fill: v }));
  fillRow = fill.row; fillInput = fill.input; fillVal = fill.val;
  bodyEl.appendChild(fillRow);

  const rim = buildStudioRange('rim', 'Recorte', 'dim', 'bright',
    STUDIO_RANGE.rim, (v) => setStudioParams({ rim: v }));
  rimRow = rim.row; rimInput = rim.input; rimVal = rim.val;
  bodyEl.appendChild(rimRow);

  const soft = buildStudioRange('soft', 'Difusão da sombra', 'sunHigh', 'cloud',
    STUDIO_RANGE.softness, (v) => setStudioParams({ softness: v }));
  softRow = soft.row; softInput = soft.input; softVal = soft.val;
  bodyEl.appendChild(softRow);

  /* TEMPERATURA — em KELVIN, e não em porcentagem como os três acima.
     É a única linha desta face cuja unidade é do mundo e não do preset: "3200 K"
     quer dizer alguma coisa para quem fotografa, "35 %" não quereria nada. Por
     isso ela não passa por buildStudioRange() (que fala em fração do autorado) e
     tem construtor próprio. */
  const temp = buildRangeRow('temp', 'Temperatura', 'bulb', 'moon',
    STUDIO_RANGE.temp[0], STUDIO_RANGE.temp[1], 100, 'warm', 'cool');
  tempRow = temp.row; tempInput = temp.input; tempVal = temp.val;
  tempInput.setAttribute('aria-label', 'Temperatura de cor da luz');
  tempInput.addEventListener('input', () => {
    beginLightScrub();
    const v = num(tempInput.value, TEMP_NEUTRAL);
    setStudioParams({ temp: v });
    paintTemp(v);
  });
  bodyEl.appendChild(tempRow);

  /* AS DUAS FILEIRAS DE PASTILHAS, NO MESMO LUGAR — no fim do painel, uma
     escondida pela outra conforme o cenário (ver syncFaces).

     ESTA ADJACÊNCIA É A FUNCIONALIDADE, não uma arrumação. O `backdropRow`
     ficava logo abaixo da hora, no TOPO do corpo, e o `weatherRow` no fim: a
     troca de cenário não substituía uma fileira pela outra, ela tirava um bloco
     do fim e punha outro no começo — e todos os controles entre os dois
     saltavam de posição. O pedido do dono do produto foi literal: os cards de
     fundo do estúdio *"devem substituir os ícones de chuva, ensolarado etc. das
     outras cenas, com o mesmo design"*. Substituir quer dizer no MESMO lugar e
     com a MESMA forma; a forma está em `backdropIcon()`, e o lugar é aqui.

     A ordem entre as duas no DOM não importa — nunca estão visíveis juntas. */
  weatherRow = buildWeatherRow();
  bodyEl.appendChild(weatherRow);
  backdropRow = buildBackdropRow();
  bodyEl.appendChild(backdropRow);

  hudRoot.appendChild(bodyEl);

  /* A QUALIDADE SAIU DAQUI. Ela era a última fileira deste corpo, entre o clima e
     o fim do painel; agora é a primeira da seção de Configurações, logo abaixo.
     Nada mais do painel de luz mudou de lugar — fundo, preenchimento, recorte,
     hora, clima e temperatura são decisão autoral e ficam onde estavam. */
  /* ⚠️ A SEÇÃO DE CONFIGURAÇÕES SAIU DAQUI (2026-08-14), por pedido do dono do
     produto: *"a seleção de qualidade deveria estar onde já tem configurações,
     onde está a seleção de somente implemento, somente cavalo"*.

     Ele está certo, e a razão é a mesma que motivou tirá-la do painel de luz em
     primeiro lugar — só levada um passo adiante. Iluminação é decisão AUTORAL;
     qualidade é decisão de MÁQUINA. Mas "Em cena" (cavalo/implemento/conjunto) e
     as cores do card também não são luz: `ui/trim-panel.ts` JÁ É o painel de
     configurações do estúdio, e criar um segundo dentro do vidro da luz era
     inventar uma terceira casa para o que já tinha uma.

     `buildQualitySection()` continua morando aqui — o código é o mesmo, testado
     e tipado — e `trim-panel.ts` o monta. Ver a nota daquele export. */

  loadCollapsed();
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

/* O TETO VEM DO PRÓPRIO INPUT, e não da constante: ele muda com a face (250 %
   fora, 600 % no estúdio — ver applyFace), e ler a constante aqui prenderia a
   leitura e o preenchimento da trilha no valor da cena externa enquanto o
   controle já aceita mais. */
function paintBrightness(v: number) {
  const hi = num(brightInput.max, BRIGHT_MAX);
  const n = clamp(num(v, 100), BRIGHT_MIN, hi);
  brightInput.value = String(Math.round(n));
  brightVal.textContent = pctText(n);
  setFill(brightInput, n, BRIGHT_MIN, hi);
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
   looking at": the time and the weather.
   No estúdio a hora não quer dizer nada (o preset é `solar: false`), então as
   duas respostas passam a ser outras: qual sala e qual fundo. */
function paintHint() {
  if (!hintEl) return;
  const preset = LIGHT_PRESETS[sceneState.preset];
  if (isStudioPreset()) {
    hintEl.textContent = (preset ? preset.name : 'Estúdio')
      + ' · ' + getStudioParams().def.name;
    return;
  }
  hintEl.textContent = formatHour(getHourOfDay())
    + (preset ? ' · ' + preset.name : '');
}

/* ---------------- face de estúdio: pintura e troca ---------------- */

/* "5600 K" e, no meio da faixa, "6500 K · neutro" — porque o neutro é a única
   posição desta régua que tem CONSEQUÊNCIA: é a única em que a cor na tela é a
   cor que o cliente vai receber. Sem o rótulo, o valor exato em que isso vale
   seria um número escondido no meio de um controle deslizante. */
function paintTemp(v: number) {
  const n = clamp(Math.round(num(v, TEMP_NEUTRAL) / 100) * 100,
    STUDIO_RANGE.temp[0], STUDIO_RANGE.temp[1]);
  tempInput.value = String(n);
  tempVal.textContent = n + ' K' + (n === TEMP_NEUTRAL ? ' · neutro' : '');
  setFill(tempInput, n, STUDIO_RANGE.temp[0], STUDIO_RANGE.temp[1]);
  tempRow.classList.toggle('is-neutral', n === TEMP_NEUTRAL);
}

function paintStudio() {
  const s = getStudioParams();
  backdropVal.textContent = s.def.name;
  for (const tile of backdropTiles.querySelectorAll<HTMLElement>('.ts-hud-tile')) {
    const on = tile.dataset.backdrop === s.backdrop;
    tile.classList.toggle('is-on', on);
    tile.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  const paint = (
    input: HTMLInputElement, val: HTMLElement,
    v: number, range: readonly [number, number],
  ) => {
    const lo = Math.round(range[0] * 100), hi = Math.round(range[1] * 100);
    const n = clamp(Math.round(num(v, 1) * 100), lo, hi);
    input.value = String(n);
    val.textContent = pctText(n);
    setFill(input, n, lo, hi);
  };
  paint(fillInput, fillVal, s.fill, STUDIO_RANGE.fill);
  paint(rimInput, rimVal, s.rim, STUDIO_RANGE.rim);
  paint(softInput, softVal, s.softness, STUDIO_RANGE.softness);
  paintTemp(s.temp);
  paintHint();
}

/**
 * Mostra a face certa. Chamada por syncHud(), que é o que o orquestrador já roda
 * depois de toda troca de cenário — e uma troca de cenário é exatamente o que
 * troca de face.
 *
 * `.hidden` é `display:none !important` (core/studio.css), então isto funciona
 * sem que hud.css precise ter opinião nenhuma sobre as linhas novas.
 */
function applyFace() {
  const studio = isStudioPreset();
  hudRoot.classList.toggle('is-studio', studio);
  hourRow.classList.toggle('hidden', studio);
  weatherRow.classList.toggle('hidden', studio);
  backdropRow.classList.toggle('hidden', !studio);
  fillRow.classList.toggle('hidden', !studio);
  rimRow.classList.toggle('hidden', !studio);
  softRow.classList.toggle('hidden', !studio);
  tempRow.classList.toggle('hidden', !studio);
  /* A INTENSIDADE DA CHAVE GANHA CURSO NO ESTÚDIO. 250 % é o teto certo para uma
     cena externa — acima disso o sol estoura o céu inteiro —, e é apertado
     demais para uma softbox, onde subir a chave é uma escolha de contraste e não
     de hora do dia. Mesmo argumento do relato que abriu as outras três faixas:
     um controle cujo ideal é o batente não é um controle.
     O input é reescrito em vez de haver dois: são a MESMA grandeza, e um segundo
     controle deslizante para ela seria a segunda superfície que este arquivo
     existe para não ter. */
  const hi = studio ? BRIGHT_MAX_STUDIO : BRIGHT_MAX;
  if (brightInput.max !== String(hi)) {
    brightInput.max = String(hi);
    paintBrightness(num(sceneState.brightness, 1) * 100);
  }
}

/* ---------------- collapse ---------------- */

/* ⚠️ `is-collapsed` NA RAIZ passou a significar só "o corpo de ILUMINAÇÃO está
   fechado", e sobrou para uma coisa só: combinada com `is-cfg-collapsed`, ela é
   como o CSS sabe que o painel INTEIRO encolheu e pode soltar o `max-height`. A
   seta e o resumo deixaram de depender dela — ver o cabeçalho da seção de
   Configurações. */
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

  /* ---- A FACE NÃO PODE DEPENDER DE ALGUÉM LEMBRAR DE syncHud() ----
     O cabeçalho deste arquivo já estabelece a regra: tudo é relido DA CENA,
     porque `applyEnvironment()` reaplica um preset por baixo e o orquestrador só
     PROMETE chamar syncHud() depois. Enquanto o painel tinha uma face só, uma
     promessa quebrada custava um controle desatualizado. Com duas faces ela
     passa a custar o painel INTEIRO errado — hora do dia e clima num ciclorama,
     que são controles que não fazem nada ali.

     Foi medido: `applyPreset('ciclorama')` chamado de fora do HUD (o console, um
     preset novo, qualquer caminho que ainda não exista) trocava a luz e deixava
     a face antiga na tela.

     `onRig` é o sinal certo porque ele dispara em TODA mudança de rig, inclusive
     nos quadros de crossfade. A guarda de preset é o que o torna barato: no
     regime, isto é uma comparação de string por quadro e mais nada. */
  onRig(() => {
    if (sceneState.preset === lastFacePreset) return;
    lastFacePreset = sceneState.preset;
    applyFace();
    paintPresets();
    paintStudio();
  });
}

/* O preset da última vez que a face foi decidida. `null` força a primeira
   passagem do gancho acima a rodar, seja qual for o preset de abertura. */
let lastFacePreset: string | null = null;

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
  /* DEPOIS de paintPresets(): a face é função do preset em cena, e paintPresets()
     é quem acabou de lê-lo. paintStudio() por último porque ele repinta o
     resumo do cabeçalho, que depende das duas coisas. */
  applyFace();
  paintStudio();
  /* A seção de Configurações não lê nada da cena, mas `syncHud()` é o único ponto
     que o orquestrador promete chamar depois de uma troca de cenário — e uma
     troca de cenário realoca o buffer de reflexo e mexe nos contadores do
     renderer. Repintar aqui é o que mantém o mostrador do piso e a leitura em
     pixels honestos sem precisar de um segundo gancho. */
  paintCfg();
}
