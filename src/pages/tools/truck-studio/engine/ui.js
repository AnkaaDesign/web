/* Sidebar / topbar wiring: cab switcher, car-paint controls, weather + time of
   day lighting controls, view controls. */
import {
  renderer, frameAll, controls, sceneState,
  LIGHT_PRESETS, PRESET_ORDER, applyPreset, setTimeOfDay, setLightParams,
} from './scene.js';
import { state, loadCab, setPaintTarget } from './models.js';
import { setPaint, getPaintParams, resetPaint } from './paint.js';
import { setBackgroundsForPaint } from './livery.js';
import { $, $$ } from './dom.js';
export const setStatus = t => { $('status').textContent = t; };

/* ---------------- cab switcher ---------------- */
function populateCabSelect() {
  const sel = $('cab-select');
  sel.innerHTML = '';
  for (const c of state.cabs) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + (c.available ? '' : ' (indisponível)');
    opt.disabled = !c.available;
    sel.appendChild(opt);
  }
  const avail = state.cabs.filter(c => c.available);
  if (avail.length <= 1) {
    sel.disabled = true;
    sel.title = state.manifestFallback
      ? 'cabs.json ainda não gerado — somente Scania'
      : 'Somente uma cabine disponível no momento';
  } else {
    sel.disabled = false;
    sel.title = '';
  }
}

async function onCabChange(e) {
  const id = e.target.value;
  if (id === state.cabId) return;
  const prev = state.cabId;
  const sw = $('cab-switching');
  $('cab-switching-text').textContent = 'Trocando cabine…';
  sw.classList.remove('hidden');
  e.target.disabled = true;
  try {
    const def = await loadCab(id);
    syncPaintUI();
    $('brand-sub').textContent = def.name + ' · Frigorífico Paleteiro';
    setStatus('Cabine: ' + def.name);
    frameAll([state.cabGroup, state.trailerGroup]);
  } catch (err) {
    console.error(err);
    setStatus('Erro ao trocar cabine: ' + err.message);
    e.target.value = prev;                    // graceful revert
  } finally {
    sw.classList.add('hidden');
    e.target.disabled = state.cabs.filter(c => c.available).length <= 1;
  }
}

/* ---------------- paint ----------------
   Every control funnels through paint.setPaint(); nothing here knows how a
   parameter maps onto a material or a uniform. */

/* range id → { param, val, map, unmap } — map turns 0..100 into the parameter */
const PAINT_RANGES = [
  ['paint-cc-gloss', 'ccGloss', 'cc-gloss-val'],
  ['paint-peel', 'peel', 'peel-val'],
  ['paint-metallic', 'metallic', 'metallic-val'],
  ['paint-flop', 'flop', 'flop-val'],
  ['paint-pearl', 'pearl', 'pearl-val'],
  ['paint-pearl-sharp', 'pearlSharp', 'pearl-sharp-val'],
  ['paint-flake-size', 'flakeSize', 'flake-size-val'],
  ['paint-flake-glint', 'flakeGlint', 'flake-glint-val'],
];
const FINISH_LABELS = { solid: 'Sólida', metallic: 'Metálica', pearl: 'Perolizada' };

export function syncPaintUI() {
  const p = getPaintParams();
  $('paint-color').value = p.color;
  $('paint-pearl-color').value = p.pearlColor;
  $('paint-flake-color').value = p.flakeColor;
  for (const [id, keyName, valId] of PAINT_RANGES) {
    const v = Math.round((p[keyName] ?? 0) * 100);
    $(id).value = v;
    $(valId).textContent = v + '%';
  }
  /* finish selector + conditional groups. `data-finish` may list more than one
     finish ("metallic pearl") because flakes are shared: real 3-coat pearls do
     sparkle, they just do it at about a third of the density. */
  for (const b of $('paint-finish').querySelectorAll('.seg-btn')) {
    b.classList.toggle('on', b.dataset.finish === p.finish);
  }
  for (const g of $$('.paint-group')) {
    g.classList.toggle('on', g.dataset.finish.split(' ').includes(p.finish));
  }
  $('paint-finish-label').textContent = FINISH_LABELS[p.finish] || '';
}

function bindPaint() {
  for (const [id, keyName, valId] of PAINT_RANGES) {
    $(id).addEventListener('input', e => {
      setPaint({ [keyName]: +e.target.value / 100 });
      $(valId).textContent = e.target.value + '%';
    });
  }
  /* The base colour also re-derives the flake and flop tints, so the whole
     panel has to resync — picking a red must not leave a blue flake tint. */
  $('paint-color').addEventListener('input', e => {
    setPaint({ color: e.target.value });
    syncPaintUI();
  });
  $('paint-flake-color').addEventListener('input', e => setPaint({ flakeColor: e.target.value }));
  $('paint-pearl-color').addEventListener('input', e => setPaint({ pearlColor: e.target.value }));
  for (const b of $('paint-finish').querySelectorAll('.seg-btn')) {
    b.addEventListener('click', () => {
      /* Switching finish resets the finish-specific parameters to that
         family's defaults — carrying a metallic's flake density into a solid
         paint would produce a finish that does not exist. */
      setPaint({ finish: b.dataset.finish });
      syncPaintUI();
    });
  }

  $('paint-trailer').addEventListener('change', e => {
    setPaintTarget(e.target.checked ? 'both' : 'cab');
    setBackgroundsForPaint(e.target.checked);   // white canvas bg would hide the paint
    setStatus(e.target.checked
      ? 'Pintura aplicada à cabine e ao implemento (incluindo a frente)'
      : 'Pintura somente na cabine');
  });
}

/* ---------------- lighting ---------------- */
function buildLightPresets() {
  const row = $('light-presets');
  row.innerHTML = '';
  for (const id of PRESET_ORDER) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.preset = id;
    b.textContent = LIGHT_PRESETS[id].name;
    b.addEventListener('click', () => {
      applyPreset(id);
      syncLightUI();
    });
    row.appendChild(b);
  }
}

function syncLightUI() {
  const bright = Math.round(sceneState.brightness * 100);
  $('light-bright').value = bright;
  $('light-az').value = Math.round(sceneState.az);
  $('light-el').value = Math.round(sceneState.el);
  $('bright-val').textContent = bright + '%';
  $('az-val').textContent = Math.round(sceneState.az) + '°';
  $('el-val').textContent = Math.round(sceneState.el) + '°';
  $('key-label').textContent = sceneState.timeOfDay === 'noite' ? 'luz da lua' : 'luz do sol';
  for (const b of $('light-presets').querySelectorAll('.chip')) {
    b.classList.toggle('on', b.dataset.preset === sceneState.preset);
  }
  for (const b of $('light-tod').querySelectorAll('.seg-btn')) {
    b.classList.toggle('on', b.dataset.tod === sceneState.timeOfDay);
  }
  const preset = LIGHT_PRESETS[sceneState.preset];
  $('light-preset-label').textContent =
    (preset ? preset.name : '') + ' · ' + (sceneState.timeOfDay === 'noite' ? 'noite' : 'dia');
}

function bindLights() {
  buildLightPresets();
  for (const b of $('light-tod').querySelectorAll('.seg-btn')) {
    b.addEventListener('click', () => {
      setTimeOfDay(b.dataset.tod);
      syncLightUI();
    });
  }
  /* Sliders do not animate: a tween would lag behind the pointer. Preset and
     day/night switches DO animate — that is where the crossfade belongs. */
  $('light-bright').addEventListener('input', e => {
    setLightParams({ brightness: +e.target.value / 100 });
    $('bright-val').textContent = e.target.value + '%';
  });
  $('light-az').addEventListener('input', e => {
    setLightParams({ az: +e.target.value });
    $('az-val').textContent = e.target.value + '°';
  });
  $('light-el').addEventListener('input', e => {
    setLightParams({ el: +e.target.value });
    $('el-val').textContent = e.target.value + '°';
  });
  syncLightUI();
}

/* ---------------- topbar ---------------- */
function bindTopbar() {
  $('show-cab').addEventListener('change', e => { state.cabGroup.visible = e.target.checked; });
  $('show-trailer').addEventListener('change', e => { state.trailerGroup.visible = e.target.checked; });
  $('btn-reset').addEventListener('click', () => frameAll([state.cabGroup, state.trailerGroup]));
  $('btn-turn').addEventListener('click', e => {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.2;
    e.currentTarget.classList.toggle('on', controls.autoRotate);
  });
  $('btn-shot').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'truck-studio.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  });
}

export function initUI() {
  bindTopbar();
  bindPaint();
  bindLights();
  $('cab-select').addEventListener('change', onCabChange);
}

export function afterManifests() {
  populateCabSelect();
}

export function afterLoad(cabDef) {
  if (cabDef) {
    $('cab-select').value = cabDef.id;
    $('brand-sub').textContent = cabDef.name + ' · Frigorífico Paleteiro';
  }
  resetPaint();          // ship the default metallic silver on every boot
  syncPaintUI();
}
