/* Orchestrator: mount/unmount lifecycle + boot sequence + debug handle.
   ---------------------------------------------------------------------------
   Ankaa integration: the engine is a singleton that OUTLIVES the React page.
   mountStudio() attaches the studio's DOM (built in core/dom.ts) to the host element
   and starts the render loop; unmountStudio() stops the loop and detaches it,
   keeping the WebGL context, the loaded models and the livery canvases alive so
   a return to the route is instant instead of another ~30 MB download.

   boot() therefore runs at most once per page load.

   Since the "Configurador" feature the studio no longer opens straight into a
   default truck: boot() loads the catalog, then a 3-step selector (cenário →
   fabricante → modelo) decides what to build, and a loading curtain covers the
   download before flying the chosen truck's photo into the bottom-left badge.
   Everything downstream of that decision funnels through ONE function,
   applyChoice(), so the selector, the badge's "Trocar" button and the sidebar
   select cannot drift apart — and so a choice arriving twice loads once. */
import * as THREE from 'three';
import * as sceneMod from './scene/scene';
import { scene, camera, controls, renderer, frameAll, startLoop, stopLoop, resize } from './scene/scene';
import * as models from './vehicle/models';
import * as paint from './vehicle/paint';
import * as livery from './vehicle/livery';
import * as catalogMod from './catalog/catalog';
import * as selector from './ui/selector';
import * as environment from './scene/environment';
import * as loader from './ui/loader';
import {
  loadCatalog, loadChoice, saveChoice, defaultChoice,
  getEnvironment, getModel, assetUrl,
} from './catalog/catalog';
import {
  initSelector, openSelector, setBadge, showBadge, setMapBadge, showMapBadge,
} from './ui/selector';
import { applyEnvironment, getCurrentEnvironment } from './scene/environment';
import {
  initLoader, showLoader, setLoaderProgress, finishLoader, hideLoader,
} from './ui/loader';
import { initHud, syncHud } from './ui/hud';
import * as scatter from './scene/scatter';
import { initWeather } from './scene/weather';
import {
  initUI, afterManifests, afterLoad, setStatus, syncPaintUI, setChoiceApplier,
} from './ui/sidebar';
import { root, $ } from './core/dom';
import type { Choice, EnvironmentDef, ManufacturerDef, ModelDef } from './catalog/catalog';
import type { CabDef } from './vehicle/models';

/** A choice resolved against the catalog: the concrete entries it names. */
interface ResolvedPick {
  choice: Choice;
  env: EnvironmentDef;
  model: ModelDef;
  manufacturer: ManufacturerDef;
}

/** Which downloads this apply will run, and their relative weights. */
type TaskWeights = Partial<Record<'env' | 'cab' | 'trailer', number>>;

/* The console tuning handle boot() installs. Declared so `window.__studio` is a
   known property rather than an `any` hole punched through the global type. */
declare global {
  interface Window {
    __studio?: Record<string, unknown>;
  }
}

/* Mensagem legível de um valor lançado — `catch (e)` é `unknown` sob strict. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const fmt = (b: THREE.Box3 | null) =>
  (b ? `${(b.max.x - b.min.x).toFixed(1)}×${(b.max.z - b.min.z).toFixed(1)}m` : '—');

let booted: Promise<void> | null = null;   // boot() runs once per page load
let observer: ResizeObserver | null = null;

/* The choice the scene is currently showing, plus the one being loaded right
   now. Both are needed: the selector resolves openSelector() AND fires
   onChange() for the same pick, so the same choice arrives twice within a tick
   and `pendingChoice` is what stops it from being loaded twice. */
let currentChoice: Choice | null = null;
let pendingChoice: Choice | null = null;
/* Serialises applies. Never rejects — runApply() swallows its own errors. */
let applyQueue: Promise<Choice | null> = Promise.resolve(null);

const sameChoice = (a: Choice | null, b: Choice | null) =>
  !!a && !!b && a.envId === b.envId && a.modelId === b.modelId;

/* pt-BR label for whichever download last reported, shown under the bar. */
const TASK_LABELS: Record<string, string> = {
  env: 'Carregando cenário…',
  cab: 'Carregando cabine…',
  trailer: 'Carregando implemento…',
};

/* Weighted progress. Which tasks run changes per apply (a later change has no
   trailer, and skips the HDRI when the scenery is unchanged), so the weights
   arrive as a map and this maths never needs rewriting when a task is added or
   dropped. The sink is injected because the destination changes too: the
   loading curtain for a selector-driven load, the plain #load-fill bar for a
   quiet sidebar swap. */
function makeProgress(weights: TaskWeights, sink: (p: number, key: string) => void) {
  const keys = Object.keys(weights) as (keyof TaskWeights)[];
  const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0) || 1;
  const done = {} as Record<keyof TaskWeights, number>;
  for (const k of keys) done[k] = 0;
  let last = keys[0];
  const draw = () => {
    let sum = 0;
    for (const k of keys) sum += done[k] * (weights[k] ?? 0);
    sink(sum / total, last);
  };
  return {
    /** onProgress callback for one task: makeProgress(w, sink).track('cab') */
    track: (k: keyof TaskWeights) => (v: number) => {
      done[k] = Math.max(0, Math.min(1, Number(v) || 0));
      last = k;
      draw();
    },
    complete: () => { for (const k of keys) done[k] = 1; draw(); },
  };
}

/**
 * Turn a possibly partial / stale choice into the concrete catalog entries it
 * names. The catalog is the only authority on what exists, so anything it does
 * not know is replaced rather than trusted: a saved id from before an asset
 * rename must degrade into the default, never into a broken boot.
 * @returns {{ choice: object, env: object, model: object, manufacturer: object }|null}
 */
function resolveChoice(choice: Choice | null): ResolvedPick | null {
  const fallback = defaultChoice();
  const found = (choice && getModel(choice.modelId)) || getModel(fallback.modelId);
  if (!found) return null;                 // catalog with zero models — nothing to build
  const env = (choice && getEnvironment(choice.envId))
    || getEnvironment(currentChoice?.envId)
    || getEnvironment(fallback.envId)
    || catalogMod.catalog.environments[0];
  if (!env) return null;
  return {
    choice: { envId: env.id, manufacturerId: found.manufacturer.id, modelId: found.model.id },
    env,
    model: found.model,
    manufacturer: found.manufacturer,
  };
}

/* brands.json and cabs.json are separate manifests, so the catalog may offer a
   model whose 3D cab was never exported. Standing in an available cab keeps the
   studio usable — a dead viewport on first boot is far worse than a stand-in
   geometry, and the status line says so. */
function resolveCabId(model: ModelDef): { id: string; exact: boolean } {
  const wanted = models.state.byId[model.cab];
  if (wanted && wanted.available) return { id: wanted.id, exact: true };
  const alt: CabDef | undefined = models.state.cabs.find((c) => c.available) || models.state.cabs[0];
  return alt ? { id: alt.id, exact: false } : { id: model.cab, exact: true };
}

async function runApply(resolved: ResolvedPick, first: boolean, curtain: boolean) {
  const { choice, env, model, manufacturer } = resolved;
  const current = getCurrentEnvironment();
  /* Re-applying the SAME environment would download nothing but would still
     reset the light preset, time of day and exposure — throwing away whatever
     the user tuned in the sidebar just because they swapped the cab. */
  const needEnv = first || !current || current.id !== env.id;
  const cab = resolveCabId(model);

  const weights: TaskWeights = { cab: 2 };
  if (needEnv) weights.env = 3;
  if (first) weights.trailer = 2;
  const progress = makeProgress(weights, curtain
    ? (p, key) => setLoaderProgress(p, TASK_LABELS[key])
    : (p: number) => {
      /* The pill has no bar of its own, so the percentage goes in its text;
         #load-fill is kept in step anyway for the console/debug case. */
      const pct = Math.round(p * 100);
      $('load-fill').style.width = pct + '%';
      $('cab-switching-text').textContent = `Carregando ${model.name}… ${pct}%`;
    });

  /* Two very different waits, two very different treatments:
     - a selector-driven load (boot, "Trocar") gets the full curtain — it shows
       the truck the user just picked and flies its photo into the badge;
     - a sidebar model swap stays quiet behind the #cab-switching pill, because
       that select exists precisely for fast A/B comparison and a full-screen
       transition on every toggle would ruin it. */
  if (curtain) {
    /* Which card the curtain is about. The outro flies its hero image into the
       matching badge, so this has to be whatever ACTUALLY changed: on a
       scenery-only change (the top-left card's partial flow) showing the truck
       photo shrink into the truck card would animate something that did not
       happen. Model changes — and first boot, where the truck is the payoff —
       stay on the truck. */
    const modelChanged = !currentChoice || currentChoice.modelId !== choice.modelId;
    showLoader({
      subject: modelChanged ? 'truck' : 'map',
      modelName: model.name,
      modelSubtitle: model.subtitle,
      modelImage: assetUrl(model.image),
      logo: assetUrl(manufacturer.logo),
      manufacturerName: manufacturer.name,
      envName: env.name,
      envSubtitle: env.subtitle,
      envThumb: assetUrl(env.thumb),
    });
  } else {
    $('cab-switching-text').textContent = `Carregando ${model.name}…`;
    $('cab-switching').classList.remove('hidden');
  }

  try {
    /* Scenery and geometry are independent downloads — run them together. */
    const tasks: Promise<unknown>[] = [models.loadCab(cab.id, progress.track('cab'))];
    if (needEnv) tasks.push(applyEnvironment(env, progress.track('env')));
    if (first) tasks.push(models.loadTrailer(progress.track('trailer')));
    await Promise.all(tasks);
    progress.complete();

    if (first) {
      livery.attachOverlays(models.state.trailer as THREE.Object3D);
      livery.setOutlines(models.state.trailerMeta);
    }
    /* A cab swap moves the coupling point, so the trailer has to be re-placed
       and the camera re-framed on BOTH paths, not just the first one. */
    models.placeTrailer();
    frameAll([models.state.cabGroup, models.state.trailerGroup]);
    if (first) afterLoad();
    else syncPaintUI();                    // new materials, same parameters

    /* ui/selector.ts already fills both badges from the catalog before firing its
       listeners, but two paths never go through the selector — the sidebar model
       select, and a returning visitor whose saved choice skips the overlay
       entirely — so this is the one place guaranteed to run. It must also land
       BEFORE finishLoader(), which flies the curtain's photo into an
       already-visible badge. */
    setBadge({
      modelName: model.name,
      modelSubtitle: model.subtitle,
      modelImage: assetUrl(model.image),
      manufacturerName: manufacturer.name,
      logo: assetUrl(manufacturer.logo),
    });
    showBadge(true);
    setMapBadge({
      envName: env.name,
      envSubtitle: env.subtitle,
      envThumb: assetUrl(env.thumb),
    });
    showMapBadge(true);

    $('brand-sub').textContent = `${model.name} · Frigorífico Paleteiro`;
    const stand = cab.exact ? '' : ' · geometria provisória';
    setStatus(first
      ? `Pronto · ${env.name} · cabine ${fmt(models.state.cabBox)}`
        + ` · implemento ${fmt(models.state.trailerBox ?? null)}`
        + (models.state.trailerMeta ? '' : ' · engate padrão') + stand
      : `${manufacturer.name} ${model.name} · ${env.name}` + stand);

    currentChoice = choice;
    /* Persist only what actually rendered: a choice that failed to load must not
       become the one the next visit boots into. (The selector may also have
       saved it; saveChoice is idempotent.) */
    saveChoice(choice);
    /* applyEnvironment() reapplies the scene's own preset, hour and exposure, so
       every control in the lighting HUD is stale the moment the scenery changes.
       syncHud() re-reads the scene rather than trusting its last written values. */
    if (needEnv) syncHud();
    /* The outro is cosmetic: a hiccup in the flip animation must not turn a
       perfectly loaded scene into an error, but the curtain has to come down. */
    if (curtain) {
      try {
        await finishLoader({ flyToBadge: true });
      } catch (e) {
        console.warn('[truck-studio] transição de saída falhou', e);
        hideLoader();
      }
    }
    return choice;
  } catch (err: unknown) {
    console.error(err);
    /* Leave the previous scene standing — half-applied is worse than stale.
       The curtain goes away either way: keeping it up would hide the status
       line that carries the message. */
    setStatus('Erro ao aplicar seleção: ' + errText(err));
    if (curtain) hideLoader();
    if (first) {
      /* Nothing was built at all, so an empty viewport would just read as
         broken — bring the bootstrap panel back to carry the message. */
      $('load-text').textContent = 'Erro ao carregar: ' + errText(err);
      $('loading').classList.remove('hide');
    }
    return null;
  } finally {
    /* Only clear the marker if it is still OURS: with two picks queued back to
       back, the second one already owns `pendingChoice` and must keep it. */
    if (pendingChoice === choice) pendingChoice = null;
    if (!curtain) $('cab-switching').classList.add('hidden');
  }
}

/**
 * The one function that turns a choice into a scene: environment + cab (+ the
 * trailer on first boot), then badge, sidebar select, #brand-sub and #status.
 * Never throws and never runs two loads at once.
 * @param {{envId: string, manufacturerId: string, modelId: string}} choice
 * @param {{ first?: boolean, curtain?: boolean }} [opts]
 *   first   — boot: also loads the trailer and runs the one-time livery setup.
 *   curtain — show the full loading curtain (default true); false keeps the
 *             discreet #cab-switching pill, used by the sidebar model select.
 * @returns {Promise<{envId: string, manufacturerId: string, modelId: string}|null>}
 *   the applied choice, or null when it failed and the old scene was kept.
 */
function applyChoice(
  choice: Choice,
  opts: { first?: boolean; curtain?: boolean } = {},
): Promise<Choice | null> {
  const first = !!opts.first;
  const curtain = opts.curtain !== false;
  const resolved = resolveChoice(choice);
  if (!resolved) {
    setStatus('Catálogo vazio — nada a carregar');
    return Promise.resolve(null);
  }
  /* Idempotence, and it is load-bearing: ui/selector.ts fires onChange() for EVERY
     completed selection — including the boot one that openSelector() resolves —
     so the same choice reaches here twice, and re-picking the same truck in the
     "Trocar" flow must not reload ~30 MB either. `pendingChoice` is assigned
     synchronously below, so a second caller in the same tick always sees it
     even though the first load has not finished. */
  if (!first && sameChoice(resolved.choice, pendingChoice || currentChoice)) return applyQueue;
  pendingChoice = resolved.choice;
  /* Same handler on both branches: a rejected queue must not poison every
     later apply (runApply itself never throws, but the queue is shared). */
  const run = () => runApply(resolved, first, curtain);
  applyQueue = applyQueue.then(run, run);
  return applyQueue;
}

async function boot() {
  try {
    livery.initLivery();
    initWeather();
    initUI();
    setChoiceApplier(applyChoice);         // sidebar select routes through applyChoice

    $('load-text').textContent = 'Carregando catálogo…';
    /* Two independent manifests: the catalog says what the user may pick,
       cabs.json says what the 3D loader can build. Neither blocks the other. */
    await Promise.all([loadCatalog(), models.loadManifests()]);
    afterManifests();

    initSelector();
    initLoader();
    initHud();
    /* The catalog phase is over, and from here on the screen belongs to the
       selector or to the loading curtain — retire the bootstrap spinner so it
       never sits under either of them. */
    $('loading').classList.add('hide');

    /* The page is meant to "start with a selector", and it does — on a first
       visit. A returning user whose saved choice is still valid goes straight
       into the studio instead: re-picking the same three cards on every visit is
       pure friction, and the badge's "Trocar" button is one click away. That is
       the deliberate trade-off. loadChoice() revalidates the saved ids against
       the catalog loaded just now, so a stale choice comes back null and lands
       the user on the selector rather than on a broken scene. */
    let choice: Choice | null = loadChoice();
    if (!choice) {
      choice = await openSelector({ cancellable: false });
      /* cancellable:false will not resolve null on a user cancel, but it DOES
         if something else opens the selector first and steals the overlay.
         Never boot on a maybe. */
      if (!choice) choice = defaultChoice();
    }

    await applyChoice(choice, { first: true });

    // debug handle for tuning from the console — keep!
    window.__studio = {
      scene, camera, controls, renderer, THREE,
      models, livery, paint,
      lighting: sceneMod,
      catalog: catalogMod,
      selector,
      environment,
      loader,
      scatter,
      applyChoice,
      uniforms: paint._sharedPaint,
      cabGroup: models.state.cabGroup,
      trailerGroup: models.state.trailerGroup,
      get cab() { return models.state.cab; },
      get trailer() { return models.state.trailer; },
      get choice() { return currentChoice; },
      state: models.state,
    };

    /* Every LATER pick lands here — the topbar "Trocar", the badge's own button,
       or anything else ui/selector.ts grows. Registered only NOW on purpose:
       onChange fires for every completed selection, including the boot one that
       openSelector() just resolved, so hooking it earlier would run the boot
       choice through both this listener and the {first:true} apply above.
       applyChoice's dedupe would catch it anyway — this is belt and braces.
       (onChange returns an unsubscribe; the engine lives for the whole page, so
       there is nothing to unsubscribe from.) */
    selector.onChange((next: Choice) => { void applyChoice(next); });
  } catch (err: unknown) {
    console.error(err);
    $('load-text').textContent = 'Erro ao carregar: ' + errText(err);
    $('loading').classList.remove('hide');   // the message needs to be visible
  }
}

/**
 * Attach the studio to `host` and start rendering. Safe to call again after
 * unmountStudio() — the models are already in memory by then.
 * @param {HTMLElement} host
 */
export function mountStudio(host: HTMLElement): Promise<void> {
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

/** Stop rendering and detach the studio, keeping all GPU/model state alive.
 *  Deliberately does NOT hideLoader()/closeSelector(): both live inside `root`,
 *  which is detached whole, and the download keeps running across the route
 *  change — tearing the curtain down here would just reveal a half-built scene
 *  when the user comes back mid-load. */
export function unmountStudio() {
  stopLoop();
  observer?.disconnect();
  observer = null;
  sceneMod.flushSave();
  root.remove();
}
