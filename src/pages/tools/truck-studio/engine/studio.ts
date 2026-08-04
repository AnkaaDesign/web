/* Orchestrator: mount/unmount lifecycle + boot sequence + debug handle.
   ---------------------------------------------------------------------------
   Ankaa integration: the engine is a singleton that OUTLIVES the React page.
   mountStudio() attaches the studio's DOM (built in core/dom.ts) to the host element
   and starts the render loop; unmountStudio() stops the loop and detaches it,
   keeping the WebGL context, the loaded models and the livery canvases alive so
   a return to the route is instant instead of another ~30 MB download.

   boot() therefore runs at most once per page load.

   Since the "Configurador" feature the studio no longer opens straight into a
   default truck: boot() loads the catalog, then a 4-step selector (cenário →
   fabricante → modelo → cor) decides what to build, and a loading curtain covers
   the download before flying the chosen truck's photo into the bottom-left badge.
   Everything downstream of that decision funnels through ONE function,
   applyChoice(), so the selector and the badges cannot drift apart — and so a
   choice arriving twice loads once.

   A COR é o único campo da escolha que não custa download, e applyChoice tem um
   atalho para isso: trocar só a cor não remonta a cabine. */
import * as THREE from 'three';
import * as sceneMod from './scene/scene';
import { scene, camera, controls, renderer, frameAll, startLoop, stopLoop, resize,
         setVehicleFocus, invalidateShadows, warmLightPrograms } from './scene/scene';
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
  setColorBadge, showColorBadge,
} from './ui/selector';
import { disposePreviews, prewarmCabPreviews } from './ui/preview';
import { loadColors, getColor, defaultColor, FINISH_LABEL, colors } from './catalog/colors';
import type { PaintColorDef } from './catalog/colors';
import { applyEnvironment, getCurrentEnvironment } from './scene/environment';
import {
  initLoader, showLoader, setLoaderProgress, finishLoader, hideLoader,
} from './ui/loader';
import { initHud, syncHud } from './ui/hud';
import * as scatter from './scene/scatter';
import { initWeather } from './scene/weather';
import { initUI, setStatus } from './ui/chrome';
import { root, $ } from './core/dom';
import type { Choice, EnvironmentDef, ManufacturerDef, ModelDef } from './catalog/catalog';
import type { CabDef } from './vehicle/models';

/** A choice resolved against the catalog: the concrete entries it names. */
interface ResolvedPick {
  choice: Choice;
  env: EnvironmentDef;
  model: ModelDef;
  manufacturer: ManufacturerDef;
  color: PaintColorDef;
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

/* "É o mesmo VEÍCULO na mesma cena?" — a pergunta que decide se algo precisa ser
   BAIXADO. A cor de propósito não entra: ela não custa um byte de rede. */
const sameRig = (a: Choice | null, b: Choice | null) =>
  !!a && !!b && a.envId === b.envId && a.modelId === b.modelId;

/* "É a mesma escolha, ponto?" — a pergunta do dedupe. A cor ENTRA aqui: sem
   ela, escolher outra cor para o mesmo caminhão seria descartado como repetido
   e o clique não faria nada. */
const sameChoice = (a: Choice | null, b: Choice | null) =>
  sameRig(a, b) && a!.colorId === b!.colorId;

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
  /* Mesma escada do cenário: o que veio, senão o que já está na tela, senão o
     padrão da paleta. Uma cor que saiu do catálogo vira a padrão em vez de
     virar um boot sem tinta. */
  const color = getColor(choice?.colorId) || getColor(currentChoice?.colorId) || defaultColor();
  return {
    choice: {
      envId: env.id,
      manufacturerId: found.manufacturer.id,
      modelId: found.model.id,
      colorId: color.id,
    },
    env,
    model: found.model,
    manufacturer: found.manufacturer,
    color,
  };
}

/* A tinta do cavalo, a partir da cor escolhida. UMA chamada e não duas: dentro
   de setPaint() a troca de acabamento reescreve os parâmetros específicos da
   família (flocos, flop, mica) para os defaults dela, e a cor base tem de ser
   aplicada DEPOIS disso, senão a segunda chamada apagaria a primeira.
   Roda em toda aplicação, inclusive quando a cor não mudou: uma troca de cabine
   cria materiais NOVOS, e eles precisam ser dirigidos outra vez. */
function applyColor(color: PaintColorDef) {
  paint.setPaint({ finish: color.finish, color: color.hex });
  /* O editor de arte mostra a chapa do painel ATRÁS do desenho, e ela é branca
     ou é esta tinta, conforme o "pintar o implemento". Quem sabe qual é a tinta
     é aqui; quem sabe se ela vale para o baú é o livery. */
  livery.setCabPaintColor(color.hex);
  setColorBadge({
    colorName: color.name,
    hex: color.hex,
    finishLabel: FINISH_LABEL[color.finish],
  });
  showColorBadge(true);
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

/* Compile every program and upload every texture the scene will need, then let
   two real frames go by, BEFORE anything claims to be loaded.
   `compileAsync` uses KHR_parallel_shader_compile where the driver has it, so
   this yields instead of blocking the main thread the way `compile()` does. */
/* EVERY WAIT IN HERE IS BOUNDED.
   A backgrounded tab does not fire requestAnimationFrame at all, and three's
   parallel-shader-compile polling can stall with it — so a plain `await` on
   either one hangs boot() forever if the user switches tab while the studio
   loads, and the curtain never comes down. Warming up is an OPTIMISATION; it is
   never allowed to be the reason the app fails to start. */
function bounded<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((res) => setTimeout(res, ms))]);
}

async function warmUp() {
  scene.updateMatrixWorld(true);
  try {
    const r = renderer as THREE.WebGLRenderer & {
      compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
    };
    if (typeof r.compileAsync === 'function') await bounded(r.compileAsync(scene, camera), 8000);
    else renderer.compile(scene, camera);
  } catch (e) {
    console.warn('[truck-studio] warm-up de shaders falhou', e);
  }
  invalidateShadows();      // the first real shadow pass belongs in here too
  /* Two presented frames if the tab is visible; a short timer if it is not.
     setTimeout still fires when backgrounded, rAF does not. */
  await bounded(
    new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))),
    500,
  );
}

/* Hand the orbit its subject: the rig's own box, measured after the trailer has
   been coupled so it is the real silhouette and not the two groups' load poses.
   Also the moment every caster has finished moving, so it is where the shadow
   map gets marked. */
function focusOnRig() {
  const box = new THREE.Box3();
  for (const g of [models.state.cabGroup, models.state.trailerGroup]) {
    if (g.visible) box.expandByObject(g);
  }
  setVehicleFocus(box.isEmpty() ? null : box);
  invalidateShadows();
}

async function runApply(resolved: ResolvedPick, first: boolean, curtain: boolean) {
  const { choice, env, model, manufacturer, color } = resolved;
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
    /* AFTER the implement is in its final pose and the scenario's set is up: the
       probe captures the world from the middle of the rig, so both have to be
       where they will stay. Once per choice, never per frame — see scene/probe.ts. */
    models.refreshVehicleReflection();
    frameAll([models.state.cabGroup, models.state.trailerGroup]);
    /* Re-derived on every path, not just the first: a cab swap changes the
       rig's length, and the orbit limits are a function of it. */
    focusOnRig();
    /* A tinta vem da ESCOLHA agora, não de um reset para o prata de fábrica: a
       cor é um passo do seletor, e chegar aqui com ela já decidida é o ponto.
       Nos dois caminhos, porque uma troca de cabine traz materiais novos. */
    applyColor(color);

    /* LAST, because it compiles whatever is in the scene and everything above
       adds to it — the set, the cab, the implement, and the paint materials
       applyColor() has just swapped in. Still inside the loader, which is the
       whole point: this is the day↔night shader recompile, moved off the time
       slider and onto the progress bar. See warmLightPrograms(). */
    warmLightPrograms();

    /* E as miniaturas do passo de cor, pelo mesmo motivo e no mesmo lugar: elas
       renderizavam ao abrir o seletor, que é onde o usuário NÃO está esperando.
       Aguardado de propósito — o custo vai para a barra de progresso. */
    await prewarmCabPreviews(cab.id, colors);

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

    /* #brand-sub morreu com a topbar. O que ele dizia — qual caminhão, qual
       implemento — está no badge do caminhão e na linha de estado, e nenhum dos
       dois precisava de uma terceira cópia. */
    const stand = cab.exact ? '' : ' · geometria provisória';
    setStatus(first
      ? `Pronto · ${env.name} · ${color.name} · cabine ${fmt(models.state.cabBox)}`
        + ` · implemento ${fmt(models.state.trailerBox ?? null)}`
        + (models.state.trailerMeta ? '' : ' · engate padrão') + stand
      : `${manufacturer.name} ${model.name} · ${color.name} · ${env.name}` + stand);

    currentChoice = choice;
    /* Persist only what actually rendered: a choice that failed to load must not
       become the one the next visit boots into. (The selector may also have
       saved it; saveChoice is idempotent.) */
    saveChoice(choice);
    /* applyEnvironment() reapplies the scene's own preset, hour and exposure, so
       every control in the lighting HUD is stale the moment the scenery changes.
       syncHud() re-reads the scene rather than trusting its last written values. */
    if (needEnv) syncHud();
    /* Downloaded and parsed is NOT ready to draw. The first frame after the
       curtain lifts is where three compiles every program it has not seen and
       uploads every texture, and on this scene that is hundreds of milliseconds
       of a frozen picture — which is exactly the "carrega meio travado e depois
       funciona" that gets reported as a loading bug. Do it while the curtain is
       still up, where a pause is what the user is already being shown. */
    await warmUp();
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
  const reference = pendingChoice || currentChoice;
  if (!first && sameChoice(resolved.choice, reference)) return applyQueue;

  /* SÓ A COR MUDOU. Não há um único byte para baixar: a tinta é um parâmetro de
     material, e o caminho normal daqui para baixo chamaria models.loadCab() —
     ou seja, remontaria a cabine inteira para trocar um hex. Este é o atalho.
     Ele ainda passa pela FILA em vez de rodar na hora: se houver um load em
     voo, aquele load termina aplicando a cor que ELE resolveu, e uma cor
     aplicada antes dele seria desfeita alguns segundos depois, sozinha. */
  if (!first && sameRig(resolved.choice, reference)) {
    const runColor = () => {
      applyColor(resolved.color);
      currentChoice = resolved.choice;
      saveChoice(resolved.choice);
      setStatus(`${resolved.manufacturer.name} ${resolved.model.name} · ${resolved.color.name}`);
      return resolved.choice;
    };
    applyQueue = applyQueue.then(runColor, runColor);
    return applyQueue;
  }

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

    $('load-text').textContent = 'Carregando catálogo…';
    /* Three independent listas: o catálogo diz o que o usuário PODE escolher,
       cabs.json diz o que o carregador 3D consegue montar, e a paleta diz de
       que cores. Nenhuma bloqueia a outra, e nenhuma delas lança. */
    await Promise.all([loadCatalog(), models.loadManifests(), loadColors()]);

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
  /* O contexto WebGL das miniaturas é a única coisa aqui que NÃO vale a pena
     manter viva fora da rota: as imagens já geradas ficam em cache no módulo, e
     é isso que faz o seletor reabrir instantâneo — o contexto em si se refaz em
     um quadro. */
  disposePreviews();
  root.remove();
}
