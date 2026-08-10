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
  warmLightPrograms,
  BACKDROPS, STUDIO_RANGE, isStudioPreset, setStudioParams, getStudioParams,
  TEMP_NEUTRAL, onRig,
} from '../scene/scene';
import { claimPill, paintFrame } from './loader';

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
}
