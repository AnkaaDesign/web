/* Orchestrator: mount/unmount lifecycle + boot sequence + debug handle.
   ---------------------------------------------------------------------------
   Ankaa integration: the engine is a singleton that OUTLIVES the React page.
   mountStudio() attaches the studio's DOM (built in dom.js) to the host element
   and starts the render loop; unmountStudio() stops the loop and detaches it,
   keeping the WebGL context, the loaded models and the livery canvases alive so
   a return to the route is instant instead of another ~30 MB download.

   boot() therefore runs at most once per page load. */
import * as THREE from 'three';
import * as sceneMod from './scene.js';
import { scene, camera, controls, renderer, frameAll, startLoop, stopLoop, resize } from './scene.js';
import * as models from './models.js';
import * as paint from './paint.js';
import * as livery from './livery.js';
import { initWeather } from './weather.js';
import { initUI, afterManifests, afterLoad, setStatus } from './ui.js';
import { root, $ } from './dom.js';

const progress = { cab: 0, trailer: 0 };
const updateProgress = () => {
  $('load-fill').style.width = Math.round((progress.cab + progress.trailer) / 2 * 100) + '%';
};

const fmt = b => `${(b.max.x - b.min.x).toFixed(1)}×${(b.max.z - b.min.z).toFixed(1)}m`;

let booted = null;                       // Promise — boot() runs once per page load
let observer = null;

async function boot() {
  try {
    livery.initLivery();
    initWeather();
    initUI();

    await models.loadManifests();
    afterManifests();

    const firstCab = (models.state.cabs.find(c => c.available) || models.state.cabs[0]).id;
    const [cabDef] = await Promise.all([
      models.loadCab(firstCab, p => { progress.cab = p; updateProgress(); }),
      models.loadTrailer(p => { progress.trailer = p; updateProgress(); }),
    ]);
    progress.cab = progress.trailer = 1;
    updateProgress();

    livery.attachOverlays(models.state.trailer);
    livery.setOutlines(models.state.trailerMeta);
    models.placeTrailer();

    frameAll([models.state.cabGroup, models.state.trailerGroup]);
    afterLoad(cabDef);
    $('loading').classList.add('hide');
    setStatus(`Pronto · cabine ${fmt(models.state.cabBox)} · implemento ${fmt(models.state.trailerBox)}`
      + (models.state.trailerMeta ? '' : ' · engate padrão'));

    // debug handle for tuning from the console — keep!
    window.__studio = {
      scene, camera, controls, renderer, THREE,
      models, livery, paint,
      lighting: sceneMod,
      uniforms: paint._sharedPaint,
      cabGroup: models.state.cabGroup,
      trailerGroup: models.state.trailerGroup,
      get cab() { return models.state.cab; },
      get trailer() { return models.state.trailer; },
      state: models.state,
    };
  } catch (err) {
    console.error(err);
    $('load-text').textContent = 'Erro ao carregar: ' + err.message;
  }
}

/**
 * Attach the studio to `host` and start rendering. Safe to call again after
 * unmountStudio() — the models are already in memory by then.
 * @param {HTMLElement} host
 */
export function mountStudio(host) {
  host.appendChild(root);

  // The viewport also changes size without a window resize (Ankaa's sidebar
  // collapsing, the page chrome settling on first paint).
  observer = new ResizeObserver(resize);
  observer.observe(sceneMod.holder);
  resize();

  startLoop();
  if (!booted) booted = boot();
  return booted;
}

/** Stop rendering and detach the studio, keeping all GPU/model state alive. */
export function unmountStudio() {
  stopLoop();
  observer?.disconnect();
  observer = null;
  sceneMod.flushSave();
  root.remove();
}
