/* Renderer, scene, camera, controls, the procedural sky, the weather/time-of-day
   light rig, and the render loop.
   ---------------------------------------------------------------------------
   THIS MODULE IS THE ROOT OF THE ENGINE'S IMPORT GRAPH. KEEP IT ACYCLIC.

   Everything below module scope here RUNS AT IMPORT TIME: `new WebGLRenderer()`,
   the `$('canvas-holder')` DOM lookup, the mountSky() IIFE, the restore() IIFE
   and a resize(). So this module cannot tolerate a cycle — with one, a partially
   initialised binding is not a lint warning, it is a `ReferenceError` on boot,
   before a single pixel exists.

   The graph is acyclic today for exactly one reason: `vehicle/paint.ts` is a
   DEPENDENCY SINK. It imports `three` and nothing else — no `scene`, no
   `onFrame`, no `onRig` — and receives the only thing it needs from this module,
   the key light, BY INJECTION: we import `setKeyLight` FROM it and push. Adding
   `import { renderer } from '../scene/scene'` to paint.ts inverts that edge and
   closes the loop. Do not. The same rule already has a second instance:
   `weather.ts` needs `scene`, `camera` and the frame loop, so it registers
   through onFrame()/onRig() rather than being imported here (see the hooks
   section). If a module ever needs to be CALLED from here, give it a
   registration hook; do not import it.

   ---------------------------------------------------------------------------
   LIGHT RIG DESIGN

   One `key` DirectionalLight stands in for both sun and moon. It is NOT two
   lights that swap: `castShadow` is a shader program parameter
   (NUM_DIR_LIGHT_SHADOWS), so flipping it recompiles every material in the
   scene — the old sun/moon swap at night did exactly that. With a single key
   light, NUM_DIR_LIGHTS and NUM_DIR_LIGHT_SHADOWS are constant for the page's
   lifetime and "sun vs moon" becomes pure data (colour + intensity + angle).
   Shadow darkness is still fully controllable because r171 plumbs
   LightShadow.intensity through to the `shadowIntensity` uniform
   (getShadow() ends in `mix( 1.0, shadow, shadowIntensity )`), so "shadows
   almost off" under overcast is a tweenable float, never a boolean.

   Everything else about a preset is data too: light colours, sky gradient
   stops, fog, exposure, star/lamp state, ground wetness, rain. Presets
   crossfade over ~0.8 s through a generic snapshot lerp, so no preset needs
   hand-written transition code.

   The sky dome is a ShaderMaterial with three colour uniforms rather than
   baked vertex colours. The old version re-uploaded a ~2 000-float buffer
   attribute on every slider event and could only ever interpolate between two
   hard-coded gradients.

   Note on overcast: a CIE overcast sky is BRIGHTER AT THE ZENITH
   (L(θ) = L_zenith·(1+2cosθ)/3, so horizon ≈ 1/3 of zenith) — the opposite of
   a clear sky, where the zenith is deep blue and the horizon pale. The
   presets encode that flip; it is a large part of why each one reads
   differently. The near-horizon brightening people associate with overcast is
   aerosol haze, which is scene.fog's job, not the dome's.

   ---------------------------------------------------------------------------
   TIME OF DAY IS A CLOCK, NOT A SWITCH

   `sceneState.hour` runs 06:00 → 24:00 and is the authority; `timeOfDay` is
   DERIVED from it and kept only because the presets' two faces, envKey() and
   every caller that predates the clock still speak it. The hour produces three
   continuous numbers, all closed-form (see "the clock"):

     alt(h)  solar altitude, EL_MAX·sin(π·f) with f = (h − sunrise)/day length.
             SIGNED: it keeps going negative after sunset, which is what makes
             the night keep deepening instead of parking at the horizon.
     az(h)   a linear sweep of the key light's bearing, sunrise → sunset. The
             bearing convention is applyRig()'s; it is spelled out at AZ_RISE.
     n(h)    "nightness", a smoothstep of alt across the twilight band. It is
             the blend weight between a preset's `dia` and `noite` faces, so
             dusk is a crossfade of exactly the data the two-state version
             already had — no second lighting system, and everything derived
             (stars, lamp intensity, fog, exposure, wetness, the paint's
             glintBoost) crossfades with it for free.

   Nothing snaps at a threshold. The only discrete thing left in the day/night
   transition is SpotLight.visible on the lamp pool, which is a shader define;
   setLampsEnabled() gives it hysteresis so an hour slider parked on the edge
   cannot flip it back and forth.

   ---------------------------------------------------------------------------
   EXTERNAL ENVIRONMENTS (environment.ts)

   environment.ts can hand this module a photoreal HDRI. When it does, ONE
   module-level flag (`externalEnv`) flips and the procedural path stops writing
   `scene.background` / `scene.environment` — and ONLY those two. Everything
   else the rig drives (lights, fog, exposure, wetness, lamps, stars, the paint
   uniforms) keeps working exactly as before, so the preset buttons and the
   light sliders remain live over an HDRI. Every guarded assignment carries a
   `GUARD:` comment saying why. The flag is cleared by
   `setExternalEnvironment(null)`, which also rebuilds the procedural PMREM.

   ---------------------------------------------------------------------------
   WHAT THE 2026-08-03 CONTENT CUT TOOK OUT OF THIS FILE

   Three photo-backed environments (`rodovia`, `patio-logistico`, `urbano`) left
   the catalogue. Both survivors — `distrito-industrial` and `armazem` — stand on
   REAL MODELLED GEOMETRY (`set.glb`, owned by scene/set.ts), and that geometry
   IS the ground. Everything this module used to build in order to fake a floor
   under a photograph went with them: the ground-projected dome, the CG near-field
   band, the two-band radial dissolve, the macro variation, the shadow catcher
   and the 340 m procedural road strip. `setNearGround()`, `setGroundMaps()`,
   `setMacroVariation()`, `setShadowCatcher()` and `setRoadVisible()` DO NOT
   EXIST — if a comment elsewhere still names one, it is the comment that is
   wrong.

   Two things they left behind are still load-bearing, and both are documented at
   their own declaration rather than here:

   * the key light's shadow camera stays at ±24 m (SHADOW_HALF). It grew for a
     photographed floor and it is still right for a modelled one — a set's ground
     receives the truck's shadow across the whole yard, and a frustum that stops
     14 m from the origin cuts a dead-straight line across it.
   * the wetness bookkeeping (dryColors / dryRough / dryEnv / puddleSpec) is now
     fed by set.ts through registerGroundMaterials(), instead of being seeded
     with the procedural materials it was written for. See that function for why
     the old seeding left `Chuvoso` raining on a road that never darkened.

   ---------------------------------------------------------------------------
   THE LAMPS: A MODEL WHERE ONE FITS, A MAST WHERE NONE DOES

   `setLampModel()` swaps the fixture under each spot for a loaded GLB. The pool
   itself is untouched — same eight SpotLights, same single writer of their
   `visible` flag — and a missing or unreadable GLB keeps the built-in fixture,
   which is also what the assetless path shows.

   The built-in fixture is a properly modelled MOTORWAY MAST: a tapered lathe
   column on a door compartment, a cubic-Bezier outreach arm that leaves the
   column vertically and reaches the lantern horizontally, and a flat-glass
   cutoff luminaire with the lens on its underside. It is not a fallback of last
   resort — it is the DEFAULT fixture, and it was modelled because the only CC0
   street lamp available is a 3.87 m ornate cast-iron park lantern and
   stretching it to a 9 m motorway mounting height is exactly the artefact the
   user reported. Height is per-scene data with an inverse-square intensity
   compensation; see the street-lamp section for all of it.

   Neither shipped scenario currently draws it: both set `lamps.enabled: false`,
   because the industrial estate models its own poles and the warehouse lights
   itself with emissive strips on the shell. The pool and the mast stay because
   `lamps: null` means "the built-in row", not "none" — the next scene that wants
   street lighting and has no modelled poles gets it for free.
*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setKeyLight } from '../vehicle/paint';
import { $ } from '../core/dom';
import {
  canvasTex, ctx2d, makePuddleCanvas,
} from './textures';
import { skyU, makeSkyDome, makeStars } from './sky';
import {
  lampUnits, lampModelEmissive, makeLamps, applyLampLayout, setLampRigRefresh,
  getLampLensMat, getLampIntensityScale,
} from './lamps';
import {
  VIEW_DIR as CARD_VIEW_DIR, FOV as CARD_FOV, TARGET_H as CARD_TARGET_H,
} from './view';
import { LIGHT_PRESETS, RIG_BASE, COLOR_FIELDS, NUM_FIELDS, makeRig } from './presets';
import type { Rig } from './presets';

/* Re-exported so the engine's public surface is unchanged by the split:
   environment.ts and ui/hud.ts import all of these from this module. */
export { LIGHT_PRESETS, PRESET_ORDER } from './presets';
export { setLamps, setLampModel } from './lamps';

export const holder = $('canvas-holder');

/* DEPTH PRECISION — why this is NOT a logarithmic buffer.
   ---------------------------------------------------------------------------
   The implement is a rip whose surfaces are stacked in MILLIMETRES: the
   conspicuity tape lies on the perimeter rail, the rail on the body skin, the
   rear tape on the bumper. Its viewer separates every coincident pair it can
   find (defight.js) by only ~1.5 mm, and validated that number with
   `logarithmicDepthBuffer: true` — which is what all eight rip viewers use.

   Turning it on here looks like the obvious fix and is a TRAP: a logarithmic
   buffer makes the fragment shader write gl_FragDepth, and a shader-written
   depth **silently disables the GPU's polygon offset**. This studio leans on
   polygonOffset for every decal it owns — the livery overlay, the front-wall
   paint overlay, the painted road markings — so the trade is: stop the model's
   own 1.5 mm pairs from fighting, and start the app's own decals fighting
   instead. Measured before reverting: log depth on, the flank overlay flickers.

   The linear buffer is kept and the RANGE is what got fixed instead. 24-bit
   depth resolves roughly z²·(far−near)/(near·far·2²⁴): at the old unbounded
   orbit that is millimetres at 100 m, which is what made whole components wink
   in and out. With setVehicleFocus() capping the orbit at ~25 m and `near` no
   longer allowed under 0.08, the same expression gives well under 0.1 mm — an
   order of magnitude finer than anything defight.js left coincident. */
export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  /* THE DISCRETE GPU, EXPLICITLY. Unset, this is `'default'`, and on a dual-GPU
     laptop `'default'` is where the browser is free to hand back the integrated
     adapter — which for a 9–10 M triangle scene with a 3072² shadow pass is the
     difference between 60 fps and a slideshow, for free. ui/preview.ts asks for
     `'low-power'` for exactly the symmetric reason: its thumbnails are twelve
     512² offscreen frames and do not deserve to spin up the dGPU. Only ever a
     HINT — a single-GPU machine ignores it, which is why nothing downstream may
     assume it took. */
  powerPreference: 'high-performance',
  /* NOT preserveDrawingBuffer. It was here for the screenshot, and it is not
     needed for one: scene/capture.ts calls `renderer.render()` and then
     `canvas.toBlob()` in the SAME task (encodePng's promise executor runs
     synchronously), so the buffer has not been composited and cleared yet and
     the readback is well defined without the flag. Keeping it costs an extra
     full-size buffer allocation plus a copy on every single present, forever,
     to serve a button pressed a handful of times a session. If capture ever
     grows an `await` between the render and the readback, this has to come
     back. */
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // shadow.radius only works with PCFSoft

/* THE SHADOW MAP IS NOT REDRAWN EVERY FRAME.
   ---------------------------------------------------------------------------
   The key light is DIRECTIONAL and its shadow camera is a fixed ortho box about
   the RIG (see placeKeyLight — it used to be about the origin, which is what cut
   the implement out of the map), so the depth map depends only on the light's
   angle, on the geometry and on where the rig sits — NOT on where the viewer is.
   Moving the box is itself an invalidation, and setVehicleFocus() pays it.
   Left on autoUpdate, three re-rendered
   every caster into a 3072² map on every single frame, which on this rig means
   drawing the whole vehicle TWICE per frame: the corrected implement alone is
   8.6 M triangles, so orbiting the camera — a thing that cannot change a single
   shadow texel — was costing a second full geometry pass. That is what made the
   scene feel like it "loads stuck and then works", and what made the time-of-day
   slider freeze under the thumb.

   The map is now marked dirty explicitly: applyRig() does it whenever the light
   pose changes (which covers the clock, the presets and every tween frame), and
   invalidateShadows() is for everything else that moves a caster — a model or
   set finishing its load, the Cabine/Implemento toggles, the coupling moving.
   Miss one and the symptom is a stale shadow, so the callers are deliberately
   few and all of them are load/visibility edges. */
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

/** Redraw the shadow map on the next frame. Call after moving/showing a caster. */
export function invalidateShadows() {
  renderer.shadowMap.needsUpdate = true;
  /* A caster moved, so by definition the picture changed. Folding the repaint in
     here rather than asking every caller to pair the two is what makes the whole
     class of "invalidated the shadow, forgot the frame" bug unrepresentable —
     and it is what lets studio.ts's warmUp() cover every asynchronous model,
     set and probe load in the engine without a line of new wiring. */
  invalidate();
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
holder.appendChild(renderer.domElement);

/* ---------------- FRAME SCHEDULING: A DIRTY-DRIVEN LOOP ----------------
   In both shipped scenarios the steady-state scene is bit-for-bit identical from
   one frame to the next. Neither manifest turns the procedural dome on, rain is
   off unless `chuvoso` is picked, and nothing else in the graph animates — yet
   the loop redraws ~2200-2900 draw calls and ~9-10 M triangles sixty times a
   second to produce the same image. That is a hot GPU, a loud fan and a flat
   battery bought with nothing.

   So the loop is dirty-driven: draw when something changed, and when nothing
   has, don't. `invalidate()` is the signal, and it is EXPORTED because most of
   the things that change the picture live in other modules.

   A MISSED INVALIDATION IS A FROZEN SCREEN, which is far worse than a warm GPU.
   Two defences, both deliberate:

     * `invalidate()` marks INVALIDATE_FRAMES frames dirty, not one. A texture
       upload that lands the frame after the call, an off-by-one in the damping
       settle, a `needsUpdate` three defers to the next render — none of them can
       leave a stale image on screen. Three frames out of the sixty a second this
       used to spend is still ~95 % of the saving.
     * anything CONTINUOUS pins the loop on for as long as it runs: a preset
       crossfade, rain, the animated dome, OrbitControls damping still settling,
       autoRotate. See wantsFrame(), which is the whole predicate in one place.

   ---------------------------------------------------------------------------
   IT SHIPS OFF, AND THIS IS EXACTLY WHY.

   Every mutation point inside THIS file is covered. The engine's other modules
   are not, and three of the gaps are shipped controls that would look BROKEN,
   not merely stale:

     1. vehicle/livery.ts — the fabric plotting editor. The three livery
        CanvasTextures are marked `needsUpdate` from ONE place, a fabric
        `after:render` handler, and fabric fires that from its own pointer
        handlers and its own rAF. Nothing in this repo calls it. With no
        invalidate there, drawing on the trailer never reaches the 3D view.
     2. vehicle/models.ts `setPaintTarget()`, reached from livery.ts's "pintar o
        implemento" checkbox. It swaps the trailer's materials and flips the
        front-wall overlays without passing through any scene.ts entry point.
     3. studio.ts `applyChoice()`'s colour-only fast path (`runColor`). It skips
        the load pipeline on purpose — and with it warmUp(), which is what
        invalidates on every other path — so picking a new colour would change
        the materials and not the picture.

   Wire those three to `invalidate()` and this can be flipped to `true`. Nothing
   else in the engine is unreachable: every other external mutation either ends
   in a scene.ts setter (environment.ts, hud.ts, chrome.ts, lamps.ts, set.ts) or
   is awaited by studio.ts's runApply(), which finishes on warmUp() →
   invalidateShadows() → invalidate(). `controls.autoRotate`, which chrome.ts
   writes directly with no wrapper, is read by wantsFrame() rather than pushed,
   so it needs no wiring at all. */
const ON_DEMAND_RENDERING = false;

/* Live override for A/B-ing the two loops from the console
   (`__studio.lighting.setOnDemandRendering(true)`) without a rebuild. The
   constant above is what SHIPS; this is what is running. */
let onDemand = ON_DEMAND_RENDERING;

/** How many frames one invalidate() buys. See the belt-and-braces note above. */
const INVALIDATE_FRAMES = 3;
/* Seeded dirty so the very first frame after module load always draws, whatever
   the flag says. */
let dirtyFrames = INVALIDATE_FRAMES;

/**
 * Mark the picture as changed: the loop will draw the next few frames.
 *
 * Call it from ANYWHERE that mutates something the camera can see — a material,
 * a uniform, a transform, a visibility flag, `scene.background`, an exposure.
 * It is idempotent, allocation-free and costs one comparison, so calling it too
 * often is free and calling it too rarely freezes the screen. When in doubt,
 * call it.
 */
export function invalidate(frames = INVALIDATE_FRAMES) {
  if (frames > dirtyFrames) dirtyFrames = frames;
}

/** Swap the frame policy at runtime. Always leaves the screen repainted. */
export function setOnDemandRendering(v: boolean) {
  onDemand = !!v;
  invalidate();
}
export const isOnDemandRendering = () => onDemand;

/* DRAW SUSPENSION — for the windows where the scene graph is deliberately WRONG.
   ---------------------------------------------------------------------------
   warmLightPrograms() mounts the light configuration we are NOT about to render
   (eight spotlights on, in daylight) so the driver compiles it now instead of
   under the user's thumb at dusk. That used to be safe for free: `renderer
   .compile()` is synchronous, so the flip and the restore lived in one task and
   no frame could ever be presented between them. `compileAsync` breaks exactly
   that guarantee — it yields, and the loop is running.

   A counter rather than a boolean so nested or overlapping suspensions cannot
   have one release re-enable drawing for the other. */
let drawSuspended = 0;

export const scene = new THREE.Scene();

/* THE SCENE ROOT DOES NOT DIRTY ITSELF, and this is the other half of
   models.ts's matrix freeze rather than a separate optimisation.
   ---------------------------------------------------------------------------
   `Object3D.updateMatrix()` sets `matrixWorldNeedsUpdate = true`
   UNCONDITIONALLY, and `updateMatrixWorld()` turns that into `force = true` for
   every descendant (three r179, Object3D.js:1126-1162). So a Scene left on the
   default `matrixAutoUpdate` recomposes its own identity matrix once per frame
   and then makes the renderer rebuild `matrixWorld` for EVERY node in the graph
   — ~5852 in the implement alone — however many of them have frozen their local
   matrix. Freezing the leaves without freezing the root removes the compose and
   leaves the whole multiply cascade standing.

   Safe because the Scene is never transformed: it sits at identity for the
   lifetime of the page, and nothing in the engine writes its position, rotation
   or scale (checked). `matrixWorldAutoUpdate` stays ON — that is the flag
   WebGLRenderer.render() tests before calling `scene.updateMatrixWorld()`, and
   turning it off would stop the traversal entirely instead of merely stopping it
   from forcing.

   THE INVARIANT THIS CREATES, and it is a graph-wide one, not a local one:

     a node's world matrix is refreshed only if IT or one of its ANCESTORS is
     dirty — so anything that moves must dirty itself.

   Everything already does, by two different routes, which is why this composes
   with the freeze instead of fighting it:

     * nodes that keep `matrixAutoUpdate` on — the lights, the sky dome, the
       stars, the haze shell, the lamp poles, the weather meshes, every overlay
       and prop added after a subtree was frozen — call `updateMatrix()` on
       themselves each traversal and dirty themselves for free.
     * frozen nodes are only ever moved through setRigPlacement(), placeTrailer()
       and groundAndCenter(), all of which pair the write with `updateMatrix()`
       (which dirties) or `updateWorldMatrix()` (which recomputes on the spot).

   The camera is not affected either way: it is not a child of the scene, and
   WebGLRenderer.render() updates it on its own line.

   The measurement paths are likewise independent — `Box3.expandByObject()` calls
   `updateWorldMatrix(false, false)` on every node it visits, so frameAll(),
   focusOnRig() and the probe read live numbers whether or not a frame has been
   drawn since the rig moved.

   WHAT BREAKS IT: reparenting a FROZEN node (`add()` does not dirty the child,
   so its world matrix would silently keep the old parent's transform), or
   writing `.position` on one from the console. Both are loud — the object
   renders in the wrong place — rather than subtle. */
scene.matrixAutoUpdate = false;

/* Held as a module-level instance rather than an anonymous literal: applyRig()
   mutates it in place, and setExternalEnvironment(null) has to be able to hand
   `scene.background` back to it after an HDRI (a Texture) has been released. */
const bgColor = new THREE.Color(0xb8d8f5);
scene.background = bgColor;
/* FogExp2 for every preset: switching fog TYPE would flip #define FOG_EXP2 and
   recompile everything, and exponential falloff is what sells near-field mist.
   density ≈ 1.978 / visibility_metres (98 % opaque at that distance). */
scene.fog = new THREE.FogExp2(0xb8d8f5, 0.0028);

/* A MESMA lente do card (30°, scene/view.ts) e não os 45° de antes: a distância
   que frameAll() calcula sai do meio-ângulo, então trocar a lente sem trocar a
   conta mudaria o enquadramento — as duas coisas andam juntas por construção.
   Uma grande-angular de 45° também incha a cabine de perto, que é o contrário do
   que uma foto de veículo faz. */
export const camera = new THREE.PerspectiveCamera(CARD_FOV, 1, 0.1, 600);
camera.position.set(14, 6, 18);   // semente; frameAll() reposiciona ao carregar

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02;      // never orbit below the horizon
/* Belt and braces over the `controls.update()` return value the loop already
   reads. In r179 the two are the same signal — 'change' is dispatched from
   exactly two places, inside update() and inside reset(), and reset() calls
   update() straight afterwards — so this is redundant TODAY. It is here because
   the loop's version is an implementation detail of a library that can add a
   third dispatch site in any minor release, and the failure mode of missing one
   is a frozen viewport rather than an exception.
   Wrapped, not passed by reference: the listener receives an Event, which would
   land in invalidate()'s `frames` parameter and make the comparison NaN-false —
   i.e. a listener that silently does nothing. */
controls.addEventListener('change', () => invalidate());

const CAM_MIN_Y = 0.15;                            // pan guard: camera stays above ground

/* ---------------- frame / rig hooks ----------------
   weather.ts registers here instead of scene.ts importing it, which would be a
   cycle (weather needs `scene`, `camera` and the render loop). */
const frameHooks: ((dt: number) => void)[] = [];
const rigHooks: ((rig: Rig) => void)[] = [];
export function onFrame(fn: (dt: number) => void) { frameHooks.push(fn); }
export function onRig(fn: (rig: Rig) => void) {
  rigHooks.push(fn);
  /* Fired immediately so a late subscriber is not one preset change behind —
     and that first call can change the picture (weather.ts sizes its rain field
     here, models.ts its wetness and probe gain), so it is an invalidation. */
  if (rigCur) { fn(rigCur); invalidate(); }
}

/* ---------------- light rig ---------------- */
const key = new THREE.DirectionalLight(0xffefe1, 3.1);
key.castShadow = true;                             // permanently — never toggled

/* SHADOW COVERAGE vs RESOLUTION — the one number that had to move for the
   ground-projected environments.
     before  2048² over ±14 m  →  2048 / 28 = 73.1 texels/m  (1.37 cm/texel)
     after   3072² over ±24 m  →  3072 / 48 = 64.0 texels/m  (1.56 cm/texel)
   ±14 was chosen when the only receiver was a procedural plane whose shadow
   nobody looked at past the truck. A photographed ground is different: the
   shadow IS the contact, and a frustum that stops 14 m from the origin cuts a
   dead-straight line across the photo. An 18 m tractor-trailer already spans
   ±9; at the `dourado` sun elevation (8°) a 4 m cab throws its shadow ~28 m,
   so only ±37 would clip nothing at all. ±24 holds the whole rig plus the near
   two thirds of the worst-case shadow — the part inside the frame — and the
   catcher below is clamped to match so the two never disagree.
   The density had to be bought back: 2048² over ±24 would be 42.7 texels/m,
   a 42 % loss on the one thing this pass exists to fix. 3072² costs 21 MB more
   depth target (16.8 → 37.7 MB) and gives away only 12 %, which PCF
   (shadow.radius runs 2–12 texels) blurs past anyway. Clamped to the device
   limit; three would clamp it too, but silently, and then these numbers would
   be a lie. */
const SHADOW_HALF = 24;
const SHADOW_MAP_SIZE = Math.min(3072, renderer.capabilities.maxTextureSize || 3072);
key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
key.shadow.camera.left = -SHADOW_HALF; key.shadow.camera.right = SHADOW_HALF;
key.shadow.camera.top = SHADOW_HALF; key.shadow.camera.bottom = -SHADOW_HALF;
/* near 4 → 1. The light orbits at r = 26 and the ortho box now reaches 24 m
   toward it, so ground directly under a low sun sits 26 − 24·cos(el) ≈ 2.2 m
   from the light — in front of a near plane of 4, which drops it out of the
   shadow test entirely. An ortho depth range is linear, so 1..90 instead of
   4..90 widens it by 3.5 % and the existing bias values keep their meaning. */
key.shadow.camera.near = 1; key.shadow.camera.far = 90;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 2;
scene.add(key, key.target);

/* ---- ONDE A CAIXA DE SOMBRA FICA CENTRADA, e por que ela não podia ficar na
   ORIGEM.
   ---------------------------------------------------------------------------
   O bloco acima raciocina inteiro em "distância da origem" — "a frustum that
   stops 14 m from the origin", "±24 holds the whole rig". Isso pressupõe que o
   conjunto MORA na origem, e ele não mora: `vehicle/models.ts` declara
   `RIG_PLACEMENT = { z: 22, yaw: π }` e `setRigPlacement(true)` põe o `rigGroup`
   a 22 m em Z, girado 180° (12 m da primeira posição + 10 de recuo). O solver de
   engate entrega a garganta da quinta roda na origem do rig, e com o giro o
   caminhão aponta para −Z: o cavalo ocupa mais ou menos z 16…22 e o implemento
   cresce de 22 para trás, até z ≈ 36 num baú de 14,7 m.

   Com a caixa de ±24 m centrada na origem, o corte cai em z = 24 — ou seja,
   dentro dos dois primeiros metros do baú. O cavalo está inteiro dentro do
   frustum e projeta; o implemento fica quase todo FORA e não projeta nada. É o
   relato, literal: "somente o cavalo faz sombra, o trailer não". E não é um
   defeito de `castShadow`, de material nem de receptor — nada disso é
   consultado para geometria que a câmera de sombra não enxerga.

   A correção é mover a caixa para o conjunto, não alargá-la: dobrar
   `SHADOW_HALF` para cobrir a origem E o rig custaria 4× a área do mapa (de
   64 para 32 texels/m no mesmo 3072², que é a densidade que o bloco acima
   comprou de volta de propósito) para iluminar 22 m de pátio vazio.

   Como uma luz DIRECIONAL só lê `position − target` para sombrear, transladar
   os dois juntos não muda um pixel de iluminação — muda apenas de onde a
   câmera ortográfica olha. Quem informa o centro é `setVehicleFocus()`, que já
   recebe a caixa do conjunto medida DEPOIS do engate (`focusOnRig()` em
   studio.ts) e já é seguida de `invalidateShadows()`. */
const KEY_ORBIT_R = 26;
/** Direção UNITÁRIA do alvo para a luz. É ela que sombreia, não `key.position`
 *  — que a partir daqui carrega o deslocamento do conjunto somado. */
const _keyDir = new THREE.Vector3(0, 1, 0);
/** Centro da caixa de sombra, em mundo. Origem enquanto não há conjunto. */
const _shadowFocus = new THREE.Vector3();

/** Repõe luz e alvo em torno de `_shadowFocus`, preservando `_keyDir`. */
function placeKeyLight() {
  key.position.copy(_keyDir).multiplyScalar(KEY_ORBIT_R).add(_shadowFocus);
  key.target.position.copy(_shadowFocus);
  /* A câmera de sombra lê `light.matrixWorld` e `light.target.matrixWorld`, não
     `position`. Os dois nós ficaram FORA do congelamento de `models.ts` e
     recompõem sozinhos no `updateMatrixWorld()` da cena — mas essa passagem só
     acontece no `render()`, e quem chama isto de fora do laço (setVehicleFocus)
     marca o mapa como sujo no mesmo instante. Escrever aqui é o que garante que
     o passe de sombra desse quadro já use a pose nova. */
  key.updateMatrixWorld(true);
  key.target.updateMatrixWorld(true);
}

/* cool counter-light from behind: separates the bodywork from the sky and
   gives the metallic flanks something to catch */
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
scene.add(rim);

/* sky/ground bounce + a floor of ambient so nothing is ever pure black */
const hemi = new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.35);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x6f7d90, 0.10);
scene.add(ambient);




/* ---------------- céu e postes ----------------
   O QUE ERA "road environment" ATÉ 2026-08-03. Este bloco construía, no load do
   módulo, um plano de grama de 700 m, duas orlas de brita e uma faixa de asfalto
   procedurais — o chão dos cenários que eram uma FOTO equirretangular com CG por
   baixo. Esses cenários saíram do catálogo, e todo cenário que restou traz
   geometria de verdade (`set.glb`), que É o chão: os planos procedurais ficaram
   permanentemente invisíveis (`setSetGround(true)` os desligava em todo apply) e
   foram removidos.

   O que sobrou aqui é o que nunca dependeu daquilo: o domo de céu procedural, as
   estrelas e a fileira de postes. */
/* Escritos por `mountSky()` no load do módulo, antes que qualquer leitor exista
   — daí a asserção de atribuição definida em vez de `| null`. */
let skyDome!: THREE.Mesh;
let starsMesh!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
let lampGroup!: THREE.Group;
/* construído uma vez, no primeiro preset molhado; ver puddleSpec */
let puddleCanvas: HTMLCanvasElement | null = null;

(function mountSky() {
  skyDome = makeSkyDome();
  scene.add(skyDome);
  starsMesh = makeStars();
  scene.add(starsMesh);

  /* Os postes penduram na CENA, não num grupo de estrada. Deixaram de ser
     mobiliário de via no momento em que o pátio precisou de poste sem via. */
  lampGroup = makeLamps();
  scene.add(lampGroup);
  applyLampLayout();
})();


/* O ALBEDO SECO de cada material de chão, para a molhagem ser reversível.
   ---------------------------------------------------------------------------
   VAZIO NO LOAD DO MÓDULO, e isso é a correção de 2026-08-03. Até aqui estes
   três mapas eram semeados com os materiais procedurais (asfalto, grama, orlas
   e as duas faixas do near ground) — que deixaram de ser desenhados quando os
   cenários viraram geometria de verdade. O resultado é que `Chuvoso` continuava
   soltando chuva e ondulação, mas sobre um chão que NUNCA escurecia: os únicos
   materiais registrados eram invisíveis, e o chão real do set jamais entrava
   aqui, porque o único caminho que registrava material novo — resnapshotGround()
   — só era chamado de setGroundMaps()/setNearGround(), as duas funções do
   caminho de foto que morreu junto.

   Agora quem registra é o próprio dono do chão: set.ts chama
   registerGroundMaterials() logo depois de bindMaterials(), com o material e a
   família de superfície de cada um. */
const dryColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();

/* Dry end of the roughness lerp, per material. applyWetness() used to hard-code
   0.95; it is a Map now for exactly one reason: setGroundMaps() has to raise it
   to 1.0 when a real roughnessMap takes over, because three MULTIPLIES the
   map's green channel by material.roughness and 0.95 would quietly shave 5 %
   off an authored map. Seeded with 0.95 everywhere so behaviour is unchanged
   until an environment overrides it. */
const dryRough = new Map<THREE.MeshStandardMaterial, number>();

/* O reflexo de ambiente do material COM TEMPO SECO. Existe pelo mesmo motivo de
   dryColors e dryRough: applyWetness() é chamada de novo a cada mudança de clima
   e a cada troca de cenário, então ela tem de partir de um estado guardado em
   vez de assumir um. Sem isto, o valor de fábrica (1) vencia o do manifesto do
   cenário. Materiais que entram depois (o chão do set) são registrados em
   resnapshotGround(), que roda DEPOIS de bindMaterials. */
const dryEnv = new Map<THREE.MeshStandardMaterial, number>();

/* Roughness map to fall back to when the road is DRY. null for the procedural
   asphalt (it has none); an environment's PBR roughness map otherwise. Without
   this the first dry preset after a wet one would throw the PBR map away —
   applyWetness() unconditionally assigned `null`. */
/* Value typed nullable only because prepGroundTex() returns `Texture | null`;
   nothing ever stores a null here (the caller has already tested the texture). */
const baseRoughMap = new Map<THREE.MeshStandardMaterial, THREE.Texture | null>();

/* Last wetness applied. Kept because applyRig() only runs during a tween: after
   setGroundMaps() swaps a material's albedo we must replay the wetness right
   away or a wet road sits there showing a dry albedo until the next preset
   change. */
let curWetness = 0;

/* Wet asphalt is NOT a Fresnel/F0 change — water's F0 is 0.020, LOWER than
   asphalt's 0.04. It is (a) a large albedo drop, because water fills the pores
   and light that enters no longer scatters back out, and (b) a roughness
   collapse. The dramatic grazing-angle brightening comes for free from the
   F0→F90 term three already computes. Practitioners ship a diffuse multiplier
   around 0.2–0.3; we use 0.25 on the road, less on grass and gravel.

   These were four hard-coded set() calls until the near ground arrived with two
   more materials whose SURFACE TYPE is manifest data (a yard is concrete, a
   verge is grass). Table + Map, seeded to exactly the numbers that were
   inlined, so nothing about the procedural road changed. `rough: null` means
   "this surface has no wet roughness collapse" — grass does not become a
   mirror. */
/* `rough: null` is a real member of the type, not an absent field — see above. */
interface WetProfile { mul: number; rough: number | null; }
const WET_PROFILE = {
  asphalt: { mul: 0.25, rough: 0.42 },
  concrete: { mul: 0.35, rough: 0.50 },
  gravel: { mul: 0.45, rough: 0.60 },
  dirt: { mul: 0.50, rough: 0.66 },
  grass: { mul: 0.72, rough: null },
} satisfies Record<string, WetProfile>;
/** The surface kinds a manifest may name; the keys of WET_PROFILE. */
type NearSurface = keyof typeof WET_PROFILE;
const wetProfile = new Map<THREE.MeshStandardMaterial, WetProfile>();

/* Materials that take the PUDDLE MASK while wet, and the tiling each one needs
   for it. The mask's rut positions are authored as fractions of one tile, so
   "one tile across the carriageway, one every 68 m along it" is what makes the
   puddles land in the wheel tracks on BOTH road surfaces — the procedural strip
   (0..1 UVs over 12 x 340 m) and the near band (UVs in world metres, hence the
   1/12 and the 0.5 offset that recentres x = −6..6 onto 0..1).
   These two materials are also the ONLY ones whose `.roughnessMap` applyWetness
   writes; everything else is bound by setGroundMaps()/setNearGround(). Two
   writers on one slot would race. */
interface PuddleSpec { u: number; v: number; ox: number; tex: THREE.CanvasTexture | null; }
const puddleSpec = new Map<THREE.MeshStandardMaterial, PuddleSpec>();

function applyWetness(w: number) {
  curWetness = w;
  for (const [m, prof] of wetProfile) {
    const dry = dryColors.get(m);
    if (!dry) continue;
    /* NOTE m.color is a DERIVED value: it is recomputed from dryColors on every
       call, never read back. Anything that wants to change a ground albedo has
       to write dryColors — see resnapshotGround(). */
    m.color.copy(dry).multiplyScalar(1 - w * (1 - prof.mul));
    if (prof.rough !== null && prof.rough !== undefined) {
      m.roughness = THREE.MathUtils.lerp(dryRough.get(m) ?? 0.95, prof.rough, w);
    }
    /* RELATIVO ao valor seco do material, nunca absoluto.
       `= 1 + w*0.35` era a linha, e com tempo seco (w = 0) ela escrevia
       EXATAMENTE 1 em cima de qualquer coisa que o cenário tivesse pedido —
       incluindo o `envIntensity` do chão do set (0.20 no concreto, 0.28 no
       asfalto do Distrito Industrial). Era um segundo dono do mesmo slot, e é a
       explicação de "o chão está muito reflexivo" ter sobrevivido a duas
       reduções no manifesto: o manifesto aplicava, e a chuva — mesmo a zero —
       apagava logo em seguida. A molhagem continua fazendo o que fazia (+35% no
       encharcado); ela só não decide mais o valor seco. */
    m.envMapIntensity = (dryEnv.get(m) ?? 1) * (1 + w * 0.35);
  }

  /* The puddle roughnessMap is attached only while wet. Adding/removing a map
     flips USE_ROUGHNESSMAP and compiles one extra program for these ground
     materials — a few milliseconds, once, on an explicit preset change, and
     cached from then on. Worth it: without a mask the whole road becomes
     uniformly mirror-smooth, which reads as ice, not rain. */
  const wantMap = w > 0.02;
  if (wantMap && !puddleCanvas) puddleCanvas = makePuddleCanvas();
  for (const [m, spec] of puddleSpec) {
    if (wantMap && !spec.tex) {
      /* One canvas, one THREE.CanvasTexture per consumer: the two surfaces need
         different repeat/offset transforms and a Texture owns exactly one. */
      /* non-null: the `wantMap` gate three lines up is what builds it. */
      spec.tex = canvasTex(puddleCanvas!, spec.u, spec.v, THREE.NoColorSpace);
      spec.tex.offset.set(spec.ox, 0);
    }
    /* Dry falls back to the ENVIRONMENT's roughness map when there is one, not
       to null. Water filling the pores is exactly why it is correct for the
       puddle mask to win while wet. */
    const target = wantMap ? spec.tex : (baseRoughMap.get(m) || null);
    if (m.roughnessMap !== target) {
      m.roughnessMap = target;
      m.needsUpdate = true;
    }
  }
  /* Ground albedo/roughness/envMapIntensity just moved. Covers the two callers
     that do NOT come through applyRig(): resnapshotGround() and, through it,
     registerGroundMaterials() when set.ts finishes binding a scenario's floor. */
  invalidate();
}

/* Re-baseline the dry albedo of materials whose maps were just swapped, then
   replay the current wetness so the visual state is consistent immediately.
   Callers MUST have written the intended DRY colour first: snapshotting a
   currently-wet m.color would bake the wet multiplier into dryColors forever
   and every later wet preset would multiply against it again. */
function resnapshotGround(mats: THREE.MeshStandardMaterial[]) {
  for (const m of mats) {
    dryColors.set(m, m.color.clone());
    /* O reflexo seco entra JUNTO com a cor seca. Um material que chega aqui
       acabou de ser configurado pelo cenário (set.ts→bindMaterials), então o que
       ele tem agora É o valor seco — e é o que a molhagem tem de modular em vez
       de substituir. */
    dryEnv.set(m, m.envMapIntensity);
    dryRough.set(m, m.roughness);
  }
  applyWetness(curWetness);
}

/** Uma família de superfície conhecida por WET_PROFILE. */
export type GroundSurface = NearSurface;

/** O que set.ts entrega por material de chão do cenário. */
export interface GroundMatEntry {
  mat: THREE.MeshStandardMaterial;
  /** família de molhagem; `road: true` marca quem recebe a máscara de poça */
  surface: GroundSurface;
  road?: boolean;
  /** metros cobertos por [u, v] do material, para casar a poça com o ladrilho */
  tile?: [number, number];
}

/**
 * REGISTRA O CHÃO DO CENÁRIO NO SISTEMA DE MOLHAGEM.
 *
 * Chamado por set.ts DEPOIS de bindMaterials(), quando cada material já está com
 * os valores do manifesto — que é exatamente o estado "seco" que a chuva tem de
 * modular. Chamar antes gravaria os padrões do three como valor seco e o
 * cenário perderia o próprio `envIntensity`/`roughness` na primeira chuva.
 *
 * Substitui o registro anterior por completo: os materiais do cenário que saiu
 * já foram descartados, e mantê-los aqui vazaria material morto para dentro de
 * `applyWetness`, que percorre este mapa todo quadro de tween.
 */
export function registerGroundMaterials(entries: GroundMatEntry[]) {
  /* Solta a máscara de poça do cenário anterior antes de perder a referência —
     é uma CanvasTexture por consumidor, e ninguém mais a alcança depois daqui. */
  for (const spec of puddleSpec.values()) if (spec.tex) spec.tex.dispose();
  wetProfile.clear();
  puddleSpec.clear();
  dryColors.clear();
  dryRough.clear();
  dryEnv.clear();
  baseRoughMap.clear();

  const mats: THREE.MeshStandardMaterial[] = [];
  for (const e of entries) {
    if (!e || !e.mat) continue;
    wetProfile.set(e.mat, WET_PROFILE[e.surface] || WET_PROFILE.concrete);
    /* O mapa de rugosidade do cenário é o estado SECO ao qual a poça volta.
       Sem isto, o primeiro preset seco depois de um molhado jogaria fora o mapa
       autorado — applyWetness() atribuiria `null`. */
    if (e.mat.roughnessMap) baseRoughMap.set(e.mat, e.mat.roughnessMap);
    if (e.road) {
      /* As calhas da máscara são autoradas como fração de UM ladrilho, então a
         poça só cai na trilha do pneu se o `repeat` do material entrar aqui. */
      const [u, v] = e.tile || [1, 1];
      puddleSpec.set(e.mat, { u, v, ox: 0, tex: null });
    }
    mats.push(e.mat);
  }
  /* Fotografa o seco e reproduz a molhagem corrente na hora: trocar de cenário
     no meio de `Chuvoso` tem de entregar o chão já molhado, não seco até o
     próximo tween. */
  resnapshotGround(mats);
}



/* ---------------- the clock ----------------
   A continuous 06:00 → 24:00 time of day. Everything here is closed-form: no
   state, no per-frame integration, so any hour can be asked for in any order (a
   slider drag, a restored blob, an environment switch) and always gives the
   same answer.

   The sun is a plain circular arc, not an ephemeris. A real solar position
   wants a date, a latitude and the equation of time, and would then be accurate
   about something nobody can check from inside a truck configurator. What has
   to be true is the READ: the sun comes up low in the east, climbs, crosses,
   drops back to the horizon in the west and keeps going down — and the light's
   colour, height and the whole scene follow it without a seam. */
export const HOUR_MIN = 6, HOUR_MAX = 24;

/* Sunrise and sunset are the horizon crossings; their midpoint is solar noon,
   which lands on exactly 12:00 — what a user expects the middle of the slider
   to be. A 12.8 h day is a low-latitude, barely-seasonal one (Brazil). */
const SUNRISE_H = 5.6, SUNSET_H = 18.4;
const DAY_SPAN = SUNSET_H - SUNRISE_H;

/* Altitude at solar noon. Deliberately above every preset's authored keyEl (the
   highest is chuvoso's 68) so the top of the clock is the top of the range
   rather than a value some preset already sits at. */
const EL_MAX = 72;

/* THE AZIMUTH CONVENTION, read off applyRig() rather than assumed. There the
   key light is placed at
       ( r·cos(el)·sin(az), r·sin(el), r·cos(el)·cos(az) )
   and aims at the origin, so keyAz is a COMPASS BEARING with +Z as north:
       0° → +Z      90° → +X      180° → −Z      270° → −X
   increasing clockwise seen from above. Calling +X east makes 80 → 280 a
   monotonic ENE → due south → WNW sweep, i.e. east to west, which is the one
   this module wants.
   Cross-checked against the authored data rather than trusting the arithmetic:
   `dourado` — the golden-hour preset — puts its sun at 285°, and NIGHT_CLEAR
   puts the moon at 300°. This sweep reaches both just after sunset, which is
   when those presets are meant to be looking. Sweeping the other way (80 → 0 →
   280) would hit 285/300 at DAWN and put the sun due north at midday, i.e. it
   would be a sun that rises in the west. */
const AZ_RISE = 80, AZ_SET = 280;

/* Below the horizon the key light becomes the moon. It is the same light — that
   is this module's central decision — so it stays on the same bearing track and
   only its height is re-floated, from the horizon back up to roughly
   NIGHT_CLEAR's authored 48°. The crossover is a smoothstep on the sun's
   altitude that does not open until the sun is properly gone (−2°), so the low
   warm rake at sunset is not cut short by the moon lifting early. */
const EL_FLOOR = 3, EL_NIGHT = 46;
const MOON_LO = -26, MOON_HI = -2;

/* Twilight band, in degrees of solar altitude. Wider than the real civil and
   nautical bands (−6° / −12°) on purpose: the sun here sweeps 5.6°/h, and the
   brief is a dusk that visibly takes from ~17:00 to ~19:30, not an accurate
   one. Puts n = 0.04 at 17:30, 0.38 at 18:00, 0.66 at 18:24 and 1 by 19:20. */
const NIGHT_ALT = -14, DAY_ALT = 22;

/* Low-sun reddening band: full strength with the sun just above the horizon,
   gone by the time it is a third of the way up. */
const GOLD_LO = -10, GOLD_HI = 2, GOLD_FADE_LO = 3, GOLD_FADE_HI = 26;

/* Canonical hours for the two legacy faces. Chosen so setTimeOfDay() still
   produces EXACTLY the old rigs: n(12:00) is 0 (alt 72, past DAY_ALT) and
   n(21:30) is 1 (alt −49.6, past NIGHT_ALT), so 'dia' is the undiluted `dia`
   face and 'noite' the undiluted `noite` face, to the bit. */
/** The two legacy faces, and the only values `sceneState.timeOfDay` ever holds. */
type TimeOfDay = 'dia' | 'noite';
const TOD_HOUR = { dia: 12, noite: 21.5 };

const smooth = THREE.MathUtils.smoothstep;
const dayFraction = (h: number) => (h - SUNRISE_H) / DAY_SPAN;

/** Solar altitude in degrees. SIGNED — negative once the sun is down. */
function sunAltitude(h: number) { return EL_MAX * Math.sin(Math.PI * dayFraction(h)); }

/** Day↔night blend weight: 0 = undiluted `dia` face, 1 = undiluted `noite`. */
function nightnessAt(h: number) { return 1 - smooth(sunAltitude(h), NIGHT_ALT, DAY_ALT); }

/** Low-sun reddening weight, before the nightness/cloud damping in resolveRig. */
function goldenAt(h: number) {
  const alt = sunAltitude(h);
  return smooth(alt, GOLD_LO, GOLD_HI) * (1 - smooth(alt, GOLD_FADE_LO, GOLD_FADE_HI));
}

/** Key-light geometry for an hour: az wrapped into [0, 360), el clamped into
 *  the same 2..85 the manual "altura" control offers, so the clock can never
 *  hand the sliders a value they cannot express. */
function sunAngles(h: number) {
  const alt = sunAltitude(h);
  const el = THREE.MathUtils.lerp(
    Math.max(alt, EL_FLOOR), EL_NIGHT, 1 - smooth(alt, MOON_LO, MOON_HI));
  const az = AZ_RISE + (AZ_SET - AZ_RISE) * dayFraction(h);
  return { az: ((az % 360) + 360) % 360, el: THREE.MathUtils.clamp(el, 2, 85) };
}

/* Both faces of a preset, merged over RIG_BASE and converted to Colors once.
   resolveRig() runs on every slider event and the hour slider fires ~60x/s;
   rebuilding these from object spreads each time would allocate two rigs (26
   THREE.Colors) per event for data that only ever changes when a preset is
   EDITED, which it never is at runtime. Entries are read-only: lerpRig() writes
   only its destination. */
const faceCache = new Map<string, { day: Rig; night: Rig }>();
function presetFaces(id: string) {
  let f = faceCache.get(id);
  if (!f) {
    const p = LIGHT_PRESETS[id] || LIGHT_PRESETS.ensolarado;
    f = {
      day: makeRig({ ...RIG_BASE, ...(p.dia || {}) }),
      night: makeRig({ ...RIG_BASE, ...(p.noite || p.dia || {}) }),
    };
    faceCache.set(id, f);
  }
  return f;
}

/* A low sun goes orange because a long atmospheric path scatters the blue end
   out of it. That is geometry, not weather, so it belongs to the clock and
   applies to every outdoor preset — which is exactly what makes 18:00 under
   `ensolarado` a warm low sun instead of a straight fade from white to moon
   blue. Without it "warm low sun → blue hour → night" would just be
   "white → blue". */
const GOLDEN = new THREE.Color(0xff9a4e);

/* The only value ever handed to resolveRig()/envKey() is `sceneState` itself,
   so its shape is exactly LIGHT_DEFAULTS' — declared here rather than duplicated
   because the defaults object IS the schema. */
type SceneState = typeof LIGHT_DEFAULTS;

/* preset[dia] and preset[noite] crossfaded by the clock, the low-sun tint on
   top of that, then the user's own az/el/brightness. */
function resolveRig(st: SceneState) {
  const id = LIGHT_PRESETS[st.preset] ? st.preset : 'ensolarado';
  const faces = presetFaces(id);
  const n = nightnessAt(st.hour);
  /* Allocated for its shape only — lerpRig() covers every NUM_FIELD and every
     COLOR_FIELD, which together are all of RIG_BASE. */
  const rig = makeRig(RIG_BASE);
  lerpRig(rig, faces.day, faces.night, n);

  if (LIGHT_PRESETS[id].solar !== false) {
    /* Damped by nightness (past sunset there is no sun left to redden, and
       tinting an already-blue rig orange would just make it muddy) and by
       cloudiness (a deck thick enough to kill the sun's disc kills its colour
       with it — `nublado` and `chuvoso` stay grey at dusk, as they should). */
    const g = goldenAt(st.hour) * (1 - n)
      * (1 - 0.65 * THREE.MathUtils.clamp(rig.cloudiness, 0, 1));
    if (g > 0.002) {
      rig.keyColor.lerp(GOLDEN, 0.85 * g);
      rig.skyHaloColor.lerp(GOLDEN, 0.70 * g);
      rig.skyHorizon.lerp(GOLDEN, 0.75 * g);
      rig.skyMid.lerp(GOLDEN, 0.25 * g);
      /* fog and bg together: they are the same haze seen at two distances, and
         letting them drift apart is what makes a horizon seam. */
      rig.fogColor.lerp(GOLDEN, 0.50 * g);
      rig.bgColor.lerp(GOLDEN, 0.50 * g);
    }
  }

  rig.keyAz = st.az;
  rig.keyEl = st.el;
  rig.keyIntensity *= st.brightness;
  return rig;
}

/* The geometry a preset authors for a face. Only reachable now through the
   `solar: false` branch of syncSunToHour() — for every other preset the clock
   owns az/el and resolveRig() overwrites both. */
function presetDefaults(id: string, tod: TimeOfDay) {
  const preset = LIGHT_PRESETS[id] || LIGHT_PRESETS.ensolarado;
  const face = { ...RIG_BASE, ...(preset[tod] || preset.dia || {}) };
  return { az: face.keyAz, el: face.keyEl };
}

/* MANUAL OVERRIDE POLICY — the HUD has a time slider AND separate "altura" and
   "posição" controls, and all three drive the same two numbers, so one side has
   to yield. The rule, in full:

     * Moving the CLOCK owns the sun. setHourOfDay() re-derives az and el and
       clears both flags. The time slider always wins, because it is the
       headline control and a clock that cannot move the sun is broken.
     * Touching altura or posição PINS THAT AXIS. setLightParams({ el }) marks
       el user-owned and nothing re-derives it until the clock next moves (or
       the preset changes). Per-axis, so pinning the height still lets the hour
       sweep the bearing.
     * A preset change clears both, because it re-derives from the clock too.

   The alternative — the hour permanently respecting a pinned angle — was
   rejected: the flags would become invisible sticky state, and the first user
   who nudged "altura" and forgot would find the time slider dead from then on.
   The cost of this choice is that the HUD must repaint those two controls after
   an hour change; hud.ts does. */
function syncSunToHour() {
  const preset = LIGHT_PRESETS[sceneState.preset] || LIGHT_PRESETS.ensolarado;
  const a = preset.solar === false
    ? presetDefaults(sceneState.preset, sceneState.timeOfDay)
    : sunAngles(sceneState.hour);
  if (!sceneState.azManual) sceneState.az = a.az;
  if (!sceneState.elManual) sceneState.el = a.el;
}

/* Write the clock and re-derive the binary face from it. `timeOfDay` is never
   set directly any more: resolveRig() has stopped reading it, but envKey(),
   presetDefaults() and every pre-clock caller still do, and hud.ts lights its
   sun/moon end-caps from it. The flip lands where the crossfade is half done
   (altitude 4°, i.e. 05:50 and 18:10). */
function setHourInternal(h: number) {
  const n = +h;
  sceneState.hour = Number.isFinite(n)
    ? THREE.MathUtils.clamp(n, HOUR_MIN, HOUR_MAX)
    : TOD_HOUR.dia;
  sceneState.timeOfDay = nightnessAt(sceneState.hour) >= 0.5 ? 'noite' : 'dia';
}

/* ---------------- state ----------------
   The clock added three fields (`hour`, `azManual`, `elManual`) and the key did
   NOT move with them. That is a deliberate call, not an oversight: the schema
   change is purely additive and restore() already validates and clamps every
   field independently, so a v3 blob written before the clock existed still
   boots — it simply has no `hour`, and its `timeOfDay` picks the canonical one
   (see restore(), which also explains why its az/el are not trusted). Bumping
   to a v4 would have thrown away everyone's saved preset and brightness to
   solve a problem the validating reader already solves. v1 and v2 predate that
   discipline and stay purged. */
/* v4 porque o preset de abertura mudou para `dourado`: um estado v3 gravado
   traz `preset: 'ensolarado'` e sobrescreveria o novo padrão em silêncio: quem
   já abriu o estúdio uma vez nunca veria a mudança. Aposentar a chave é o que
   faz o padrão novo valer para todo mundo, e é o mesmo movimento que v1→v2. */
/* v5 porque a hora de abertura mudou de 12:00 para 17:45 (ver OPEN_HOUR): um
   estado v4 gravado traz `hour: 12` e sobrescreveria o novo padrão em silêncio —
   quem já abriu o estúdio uma vez nunca veria a luz nova. É o mesmo motivo que
   aposentou v3 quando o preset de abertura virou `dourado`. */
const SCENE_KEY = 'truckstudio.scene.v5';
for (const old of ['truckstudio.scene.v1', 'truckstudio.scene.v2', 'truckstudio.scene.v3',
  'truckstudio.scene.v4']) {
  try { localStorage.removeItem(old); } catch (_) { /* ignore */ }
}

/* `dourado` e não `ensolarado` como padrão: sol a 8° de elevação, chave
   0xffbb81 contra um recorte frio (rim 0x9fb7e8) e halo forte no horizonte — é
   luz RASANTE, e é ela que faz a lataria mostrar o que a tinta tem. Sol a pino
   bate quase perpendicular à chapa: a casca de laranja some, o floco não
   cintila e o flop do perolizado não tem raspagem para aparecer. O preset
   continua trocável no HUD; o que muda aqui é só com o que a página ABRE. */

/* A HORA DE ABERTURA É 17:45, e não mais o meio-dia.
   Antes o `dourado` sozinho dava a cara rasante enquanto o relógio ficava em
   12:00 — o preset pintava a luz de dourada, mas a GEOMETRIA continuava de sol a
   pino. Sombra curta debaixo do veículo, nada de rastro comprido no chão, e a
   mistura dia/noite (nightnessAt) em zero: dourado no tom, meio-dia na forma.
   Com o relógio em 17:45 as duas coisas passam a concordar. Nesta latitude
   (SUNRISE_H 5.6 / SUNSET_H 18.4) a conta dá:
       sunAltitude(17.75) ≈ 11.4°   → sol baixo, sombra longa e rasante
       sunAngles(17.75).az ≈ 269.8° → oeste, contra os ~285° que o `dourado` já
                                      trazia autorado, então o preset e o relógio
                                      apontam para o mesmo lado
       nightnessAt(17.75) ≈ 0.21    → um fio de anoitecer no céu, ainda dia
       goldenAt(17.75)    ≈ 0.70    → avermelhamento de sol baixo quase cheio
   `az`/`el` seguem DERIVADOS de `hour` (os flags manuais continuam falsos), e é
   por isso que basta mudar a hora: sunAngles() reposiciona a chave sozinha. */
export const OPEN_HOUR = 17.75;

export const LIGHT_DEFAULTS = {
  preset: 'dourado', timeOfDay: 'dia' as TimeOfDay, hour: OPEN_HOUR,
  /* az/el are DERIVED from `hour`; these are just what the clock says at 17:45.
     They stop being derived the moment one of the flags below goes true — see
     syncSunToHour() for the full override policy. */
  az: sunAngles(OPEN_HOUR).az, el: sunAngles(OPEN_HOUR).el, brightness: 1,
  azManual: false, elManual: false,
};
export const sceneState = { ...LIGHT_DEFAULTS };

/* `| 0` because 0 is the "no timer pending" sentinel the two readers below test
   for; a handle is whatever setTimeout returns in this build. */
let saveTimer: ReturnType<typeof setTimeout> | 0 = 0;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, 400);          // sliders must not hammer localStorage
}
export function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify({ v: 4, ...sceneState }));
  } catch (_) { /* ignore */ }
}
addEventListener('pagehide', flushSave);
addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

/* ---------------- environment maps ----------------
   A gradient-sky IBL, one per preset+time. This matters far beyond looks: the
   moment puddle roughness drops to 0.05 the road becomes a mirror, and with
   the old RoomEnvironment it would mirror a white studio box. The canvas is
   equirectangular and deliberately CLOUDLESS — the PMREM mip chain destroys
   high-frequency detail for irradiance anyway, and a blurry reflection cannot
   be told from a gradient. */
/* Exported so environment.ts can PMREM its HDRIs through the SAME generator: a
   second PMREMGenerator on one renderer duplicates the whole blur/lod-plane
   scratch setup for nothing. */
export const pmrem = new THREE.PMREMGenerator(renderer);

/* THE CACHE HOLDS RENDER TARGETS, NOT TEXTURES, and that is the difference
   between this being disposable and not. `pmrem.fromEquirectangular()` returns a
   WebGLRenderTarget; keeping only its `.texture` — which is what this did —
   leaves the framebuffer and its colour attachment allocated with no handle left
   to free them. environment.ts's disposeEntry() makes the same point about its
   own HDRI targets, and for the same reason.

   BOUNDED, because the engine is a singleton that outlives the React page: with
   six presets x (ENV_NIGHT_STEPS + 1) keys plus 'room' the ceiling is ~25 live
   PMREM chains, and a 512x256 equirect bakes to a 128 cube at ~1.5 MB, so a user
   who explores the presets across the clock accumulates tens of megabytes that
   are never released for the rest of the browser session. Eight entries is the
   working set of one exploration session — a preset and its dusk band, plus the
   one before it — and a miss is a canvas draw plus one PMREM bake, i.e. the
   10-40 ms this module already schedules behind a 380 ms debounce. */
const ENV_CACHE_MAX = 8;
const envCache = new Map<string, THREE.WebGLRenderTarget>();

/* ---------------- external environment (environment.ts) ----------------
   `externalEnv` is THE flag. Non-null ⇒ a photoreal HDRI owns scene.background
   and scene.environment and the procedural path must not write either one.
   Nothing else changes: lights, fog, exposure, wetness, lamps and the paint
   uniforms stay under the rig's control so the presets and sliders keep
   working over the photo. */
let externalEnv: THREE.Texture | null = null;          // PMREM texture bound to scene.environment
let externalBg: THREE.Texture | null = null;           // texture bound to scene.background
let extEnvIntensity = 1;         // envDef.envIntensity
let exposureBase = 1;            // envDef.exposure, composed with rig.exposure
let skyDomeOn = true;            // procedural dome (and therefore the stars)

/* Cache granularity for the procedural IBL along the clock. buildSkyEnv() reads
   the rig, and the rig is now a continuous crossfade, so keying the cache on
   `dia`/`noite` as before would snap every reflection at one instant halfway
   through dusk — the single place in the transition where a snap is visible,
   since the road is a mirror the moment it is wet. Four steps of nightness is
   the compromise. It cannot be per-frame: each entry is a canvas plus a full
   PMREM mip chain (~1.5 MB for a 512x256 equirect on a 128 cube), and only the
   dusk band ever builds more than one entry per preset.

   DO NOT LOWER THIS TO SAVE MEMORY. Coarser steps put the snap back, which is
   the artefact the whole scheme exists to remove; the number of entries is
   ENV_CACHE_MAX's problem and it is solved there, by eviction. */
const ENV_NIGHT_STEPS = 3;

function envKey(st: SceneState) {
  const p = LIGHT_PRESETS[st.preset];
  if (p && p.env === 'room') return 'room';
  return st.preset + ':n' + Math.round(nightnessAt(st.hour) * ENV_NIGHT_STEPS);
}

/* A smooth gradient reflects as nothing, which is exactly why a clearcoat over
   one reads as dull plastic rather than paint: gloss is perceived from the
   SHARPNESS OF WHAT IT REFLECTS, not from a roughness number. So this env
   deliberately carries hard structure — a crisp horizon line (the strongest
   single cue in any real car photograph), a bright near-horizon band, a tight
   sun core, and a few soft cloud bands to break up the sky. */
function buildSkyEnv(rig: Rig) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const hex = (col: THREE.Color) => '#' + col.getHexString(THREE.SRGBColorSpace);
  const horizonY = H * 0.5;

  /* sky: zenith → mid → horizon */
  const grad = g.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, hex(rig.skyTop));
  grad.addColorStop(THREE.MathUtils.clamp(1 - rig.skyMidPos, 0.05, 0.95), hex(rig.skyMid));
  grad.addColorStop(1, hex(rig.skyHorizon));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, horizonY);

  /* cloud banding: horizontal streaks, brightest near the horizon. Low
     frequency on purpose — PMREM's mip chain would erase fine detail, but
     broad bands survive into the blurrier mips and give a moving reflection. */
  if (rig.cloudiness > 0.05) {
    g.globalAlpha = 0.10 + 0.16 * rig.cloudiness;
    for (let i = 0; i < 7; i++) {
      const y = horizonY * (0.16 + 0.80 * Math.pow(i / 7, 0.7));
      const h = horizonY * (0.02 + 0.05 * (1 - i / 7));
      g.fillStyle = i % 2 ? hex(rig.skyTop) : hex(rig.skyHorizon);
      g.fillRect(0, y, W, h);
    }
    g.globalAlpha = 1;
  }

  /* bright band hugging the horizon */
  const band = g.createLinearGradient(0, horizonY * 0.80, 0, horizonY);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(1, `rgba(255,255,255,${(0.16 + 0.22 * (1 - rig.cloudiness)).toFixed(3)})`);
  g.fillStyle = band;
  g.fillRect(0, horizonY * 0.80, W, horizonY * 0.20);

  /* ground half, darker — the sky/ground step at horizonY stays a HARD edge */
  const gg = g.createLinearGradient(0, horizonY, 0, H);
  gg.addColorStop(0, hex(rig.skyHorizon));
  gg.addColorStop(0.10, hex(rig.hemiGround));
  gg.addColorStop(1, hex(rig.hemiGround));
  g.fillStyle = gg;
  g.fillRect(0, horizonY, W, H - horizonY);

  /* key light: a tight core inside a broad halo. Under overcast (skyDisc 0) it
     collapses to just the broad patch, which is what a cloudy sky actually
     shows where the sun is. */
  const az = rig.keyAz * Math.PI / 180, el = rig.keyEl * Math.PI / 180;
  const sx = ((((az / (Math.PI * 2)) % 1) + 1) % 1) * W;
  const sy = (0.5 - el / Math.PI) * H;
  const halo = rig.skyDisc > 0.2 ? 70 : 130;
  const core = rig.skyDisc > 0.2 ? 13 : 0;
  g.save();
  for (const dx of [-W, 0, W]) {                   // wrap across the seam
    g.setTransform(1, 0, 0, 1, dx, 0);
    const hg = g.createRadialGradient(sx, sy, 0, sx, sy, halo);
    hg.addColorStop(0, `rgba(255,255,255,${Math.min(0.75, 0.20 + rig.keyIntensity * 0.14).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(0, 0, W, H);
    if (core > 0) {
      const cg = g.createRadialGradient(sx, sy, 0, sx, sy, core);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.55, 'rgba(255,255,255,0.92)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      g.fillRect(0, 0, W, H);
    }
  }
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  /* The TARGET, not `rt.texture` — see the note at envCache. */
  return rt;
}

/* Insert-or-touch, then evict from the front. A Map iterates in insertion order,
   so delete-then-set is the whole LRU. Never frees the one currently bound to
   `scene.environment`: that would leave the renderer sampling a released target,
   which is a black scene rather than a stale one. */
function cacheEnv(k: string, rt: THREE.WebGLRenderTarget) {
  envCache.delete(k);
  envCache.set(k, rt);
  while (envCache.size > ENV_CACHE_MAX) {
    const oldest = envCache.keys().next().value!;
    const victim = envCache.get(oldest)!;
    envCache.delete(oldest);
    if (victim !== rt && victim.texture !== scene.environment) victim.dispose();
  }
}

/**
 * Free every cached procedural IBL except the one on screen.
 *
 * Not called from the render path — this is deferred-teardown material (see
 * scheduleIdleRelease). Safe at any time: a later refreshEnvironment() simply
 * misses and rebakes, which is the same 10-40 ms a first visit to that preset
 * already pays.
 */
export function releaseProceduralEnvCache() {
  for (const [k, rt] of [...envCache]) {
    if (rt.texture === scene.environment) continue;
    rt.dispose();
    envCache.delete(k);
  }
}

let envTimer: ReturnType<typeof setTimeout> | 0 = 0;   // 0 = nothing pending
function refreshEnvironment(rig: Rig, immediate: boolean) {
  /* GUARD: an external HDRI owns scene.environment. Returning here does two
     things — it stops the assignment below from stealing it back on every
     preset/slider change, and it skips building a procedural PMREM (a canvas +
     a full mip-chain blur) that would never be bound. setExternalEnvironment
     (null) calls this again with immediate=true to rebuild whatever the rig
     needs at the moment the HDRI is released. */
  if (externalEnv) return;
  const k = envKey(sceneState);
  const run = () => {
    envTimer = 0;
    const hit = envCache.get(k);
    if (hit) {
      scene.environment = hit.texture;
      cacheEnv(k, hit);                              // a hit is a use: refresh the LRU
      invalidate();
      return;
    }
    let rt: THREE.WebGLRenderTarget;
    if (k === 'room') {
      /* RoomEnvironment is a whole Scene — a lathe of BoxGeometries, two
         MeshStandardMaterials and a PointLight — built for one purpose: to be
         PHOTOGRAPHED by the PMREM. Nothing samples it afterwards, and dropping it
         on the floor leaked every one of those buffers for the tab's lifetime.
         The addon ships its own dispose() (it walks the tree and frees each
         geometry and material once); call it the moment the bake is done. */
      const room = new RoomEnvironment();
      try {
        rt = pmrem.fromScene(room, 0.04);
      } finally {
        room.dispose();
      }
    } else {
      rt = buildSkyEnv(rig);
    }
    /* Bind BEFORE caching: cacheEnv() refuses to evict whatever `scene
       .environment` currently points at, and the thing it must never evict is
       the one we just built. */
    scene.environment = rt.texture;
    cacheEnv(k, rt);
    invalidate();
  };
  if (immediate) { if (envTimer) { clearTimeout(envTimer); envTimer = 0; } run(); return; }
  if (envTimer) clearTimeout(envTimer);
  /* 380 ms, não 120, E um quadro cedido antes de assar.
     ---------------------------------------------------------------------------
     `run()` faz `pmrem.fromEquirectangular()` — 10 a 40 ms de thread principal
     travada — e este caminho só é alcançado quando NÃO há HDRI externo, que é
     precisamente o caso do `armazem` (`hdri: null`). Com 120 ms, arrastar o
     controle de hora disparava e cancelava o timer sem parar e, ao soltar,
     entregava a travada 120 ms DEPOIS: tarde demais para o usuário associar ao
     que fez, o que faz parecer defeito e não trabalho.

     380 ms é longo o bastante para nunca disparar durante um arrasto contínuo.
     O rAF extra garante que o quadro com a luz nova seja APRESENTADO antes de a
     thread travar — sem ele, o assado e a atualização visual competem pelo
     mesmo quadro e o usuário vê a travada antes de ver o resultado. */
  envTimer = setTimeout(() => { requestAnimationFrame(() => run()); }, 380);
}

/* ---------------- tween ---------------- */
/* All three are written by beginTween(), and the restore() IIFE at the foot of
   this module calls it once at module load — before any exported entry point,
   any hook and the first frame. Definite assignment rather than `| null` keeps
   updateLighting()'s hot path free of guards for a state no reader can reach;
   the one place the pre-assignment value is observed is beginTween()'s own
   `if (!rigCur)`, which reads `undefined` there exactly as it read `null`. */
let rigCur!: Rig, rigFrom!: Rig, rigTo!: Rig;
let tweenT = 1, tweenDur = 0.8;

const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* shortest-arc degree lerp, so 350° → 10° goes through 0, not backwards */
function lerpDeg(a: number, b: number, t: number) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function lerpRig(dst: Rig, a: Rig, b: Rig, t: number) {
  for (const k of NUM_FIELDS) {
    dst[k] = k === 'keyAz' ? lerpDeg(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  }
  /* Colours lerp in linear-sRGB (THREE.Color already stores linear when colour
     management is on) because these are radiometric quantities. Never lerpHSL:
     blue-grey → orange would swing the hue through green. */
  for (const k of COLOR_FIELDS) dst[k].copy(a[k]).lerp(b[k], t);
}

const _dirW = new THREE.Vector3();
const _dirV = new THREE.Vector3();
const _keyCol = new THREE.Color();
const _tintGraded = new THREE.Color();

/* DAY-FOR-NIGHT FOR A MEASURED PLATE COLOUR.
   `set.horizonColor` is the HDRI's own horizon band, measured off the plate in
   LINEAR LIGHT AT MIDDAY — see the horizonNote in environments.json, which
   documents the measurement and is right about it. What it could not know is
   that the value was then treated as a constant: setHorizonTint() pinned fog and
   the haze shell to it at every hour, while the sky behind them was being folded
   down by the backgroundIntensity guard below.

   That is the whole "o HDR no modo escuro não está bom". At 21:00 over
   `distrito-industrial` the plate renders at min(1, 0.35) * 0.06 ≈ 0.021 of its
   daylight radiance and the haze went on painting linear 0.102/0.124/0.050 at
   0.7 alpha — roughly FIVE TIMES brighter than the photograph it is supposed to
   be dissolving into, in a midday olive. The night sky was not the HDRI at all;
   it was the haze shell, and the fog was washing the far end of the set the same
   colour.

   So the tint gets the same grade as the plate, which is also exactly the grade
   environment.ts applies to a projected dome — one formula, three consumers, and
   they can no longer drift:
     * min(1, envIntensity) — the environment sets the level and the preset only
       MODULATES it; a bright preset must not over-drive a photograph.
     * a 6 % floor at full night. Stylised, not physical (moonlit is ~1e-5 of
       sunlit); it keeps the horizon legible as a silhouette instead of a hole.
     * the Purkinje cooling, so a dimmed day plate reads as night rather than as
       underexposed day.
   At noon n = 0 and envIntensity = 1, so k = 1 and this is the identity — the
   daylight look is untouched, by construction. */
function gradePlateColor(out: THREE.Color, src: THREE.Color, rig: Rig) {
  const n = THREE.MathUtils.clamp(rig.nightness, 0, 1);
  const k = Math.min(1, Math.max(0, rig.envIntensity)) * (1 - 0.94 * n);
  return out.setRGB(
    src.r * k * (1 - 0.18 * n),
    src.g * k * (1 - 0.10 * n),
    src.b * k,
  );
}

/* ---- MODO ARRASTO DO MAPA DE SOMBRA ----
   `shadowMap.autoUpdate = false` (linha 251) já resolveu METADE do problema: o
   mapa parou de ser redesenhado quando só a CÂMERA se move. O que ficou de fora
   é o caso em que a LUZ se move — que é exatamente "aplicar uma configuração de
   iluminação", e é onde o travamento aparece.

   A conta: applyRig() roda a cada quadro de tween (0,8 s ≈ 48 quadros) e a cada
   evento `input` do controle de hora (~60/s). Cada quadro sujo redesenha TODO
   caster dentro de ±24 m num alvo de profundidade de 3072² — o set, mais as
   2151 malhas do implemento, mais a cabine. É a geometria inteira desenhada
   DUAS vezes por quadro, ~18 M de triângulos.

   A correção NÃO baixa a qualidade do resultado: enquanto o usuário arrasta,
   redesenha a cada 4º quadro; assim que ele solta, o quadro seguinte redesenha
   em cheio, na resolução cheia. O que se perde é sombra defasada em ~50 ms
   DURANTE o arrasto, e o que se ganha é o arrasto responder. */
let scrubUntil = 0;
let shadowFrame = 0;
/* "Um applyRig() pulou o redesenho e ninguém o repôs ainda."
   O bloco acima promete que "assim que ele solta, o quadro seguinte redesenha em
   cheio" — e não redesenhava. applyRig() só roda por evento do controle ou por
   quadro de tween, então o ÚLTIMO applyRig de um arrasto é quase sempre um dos
   pulados: o mapa fica até três quadros de luz atrasado, e fica assim para
   sempre, porque nada chama applyRig depois que o dedo sai. Um bool paga a
   promessa; o laço o cobra quando a janela do arrasto expira. */
let shadowStale = false;

/** Sinaliza que a luz está sendo arrastada AGORA. Ver o bloco acima. */
export function beginLightScrub() {
  scrubUntil = performance.now() + 220;
  /* Deliberately WIDER than one invalidation, and it is the shadow settle that
     needs it: the drag's last applyRig() is almost always one of the skipped
     ones, so the frame that repays it (see shadowStale, in the loop) can only
     happen AFTER this 220 ms window expires. 30 frames is half a second at
     60 Hz — comfortably past it — and it costs nothing on a control the user
     has their finger on. */
  invalidate(30);
}

function applyRig(rig: Rig) {
  /* A luz vai se mexer, então o mapa de profundidade está velho. Este é o
     caminho quente — todo quadro de tween cai aqui. */
  shadowFrame++;
  if (performance.now() > scrubUntil || (shadowFrame & 3) === 0) {
    renderer.shadowMap.needsUpdate = true;
    shadowStale = false;
  } else {
    shadowStale = true;
  }
  const azr = rig.keyAz * Math.PI / 180;
  const elr = rig.keyEl * Math.PI / 180;
  const r = KEY_ORBIT_R;
  /* O piso de 1,0 m em Y é o mesmo de sempre — ele impede o sol rasante de
     entrar por baixo do chão —, só que agora aplicado à direção antes de ela ser
     escalada e deslocada. Em r = 26 os dois são o mesmo número. */
  _keyDir.set(
    r * Math.cos(elr) * Math.sin(azr),
    Math.max(1.0, r * Math.sin(elr)),
    r * Math.cos(elr) * Math.cos(azr)
  ).normalize();
  placeKeyLight();
  key.color.copy(rig.keyColor);
  key.intensity = Math.max(0, rig.keyIntensity);
  key.shadow.intensity = THREE.MathUtils.clamp(rig.shadowIntensity, 0, 1);
  key.shadow.radius = Math.max(0.5, rig.shadowRadius);

  /* rim sits opposite the key and a little higher */
  const rimAz = azr + Math.PI * 0.78;
  rim.position.set(
    22 * Math.cos(0.6) * Math.sin(rimAz), 14, 22 * Math.cos(0.6) * Math.cos(rimAz)
  );
  rim.color.copy(rig.rimColor);
  rim.intensity = Math.max(0, rig.rimIntensity);

  hemi.color.copy(rig.hemiSky);
  hemi.groundColor.copy(rig.hemiGround);
  hemi.intensity = Math.max(0, rig.hemiIntensity);
  ambient.color.copy(rig.ambientColor);
  ambient.intensity = Math.max(0, rig.ambientIntensity);

  /* Fog is deliberately NOT guarded: it has to keep tweening toward the rig's
     colour even under an HDRI, or the ground plane fading out meets the photo's
     horizon in a hard seam. Matching the haze is the whole trick. */
  /* `scene.fog` is typed `Fog | FogExp2 | null`; it is assigned one FogExp2 at
     module load (see the note there) and never replaced. */
  const fog = scene.fog as THREE.FogExp2;
  /* The measured tint is a DAYLIGHT sample and has to be graded to the hour —
     see gradePlateColor(). rig.fogColor needs no such treatment: it is preset
     data with a `noite` face and the clock already crossfaded it. */
  const tint = horizonTint ? gradePlateColor(_tintGraded, horizonTint, rig) : null;
  fog.color.copy(tint || rig.fogColor);
  fog.density = Math.max(0, rig.fogDensity);

  /* The haze IS the fog, continued into the sky — so it tracks the same tweened
     colour, every frame, or the two would diverge mid-crossfade and put the
     seam back exactly where it was removed. */
  if (hazeMesh) {
    (hazeMesh.material as THREE.MeshBasicMaterial).color.copy(tint || rig.fogColor);
  }

  /* GUARD: the colour is kept current either way (so releasing the HDRI
     restores the right sky instantly), but while one is up we must not bind it
     — every frame of a tween would repaint the photo as a flat colour. */
  bgColor.copy(rig.bgColor);
  if (!externalEnv) scene.background = bgColor;

  /* GUARD: with an HDRI the env def sets the absolute level and the preset only
     MODULATES it, so a "noite" rig over a daylight HDRI still darkens the
     reflections. The visible background is clamped to at most the env def's
     level: a bright preset (chuvoso, envIntensity 1.45) must not blow out a
     photograph the way it may over-drive a synthetic gradient. */
  if (externalEnv) {
    const k = Math.max(0, rig.envIntensity);
    /* NIGHT OVER A DAYLIGHT PHOTOGRAPH.
       Every HDRI in the acervo was shot in daylight, and the preset system has
       no way to make a photograph set. Before this, midnight left
       backgroundIntensity at the rig's 0.35 while exposure ROSE to 1.45 — net
       ~0.53 against noon's ~1.10, i.e. the "night" sky was rendering at half
       the brightness of noon, with lit cumulus in it. That is the "24:00 não
       fica noite" bug: the lights went out, the sky did not.

       So `nightness` (already tweened 0→1 by the clock, orthogonal to weather)
       drives the photo down on its own axis. Two different floors because the
       two do different jobs:

       BG 0.06 — the visible sky. 0.35 * 0.06 * 1.52 exposure ≈ 0.03 scene-
       referred, which ACES renders as a dark blue-grey that still holds the
       cloud structure. Scaling is UNIFORM, so bright cumulus stay brighter than
       the sky behind them and read as moonlit cloud rather than as a flat wash.
       A real night sky is ~1e-4 of day; 0.03 is the film-convention version,
       and going lower just makes an unreadable black hole.

       ENV 0.40 — the reflections. Deliberately far milder: this term is also
       doing half the LIGHTING of the truck, and taking it to the background's
       floor leaves black paint with no form. 0.35 * 0.40 = 0.14 keeps a dim sky
       in the clearcoat while the lamps (240-295 cd) take over as the key. */
    const nf = THREE.MathUtils.clamp(rig.nightness, 0, 1);
    scene.environmentIntensity = extEnvIntensity * k * THREE.MathUtils.lerp(1, 0.40, nf);
    scene.backgroundIntensity = extEnvIntensity * Math.min(1, k) * THREE.MathUtils.lerp(1, 0.06, nf);
  } else {
    scene.environmentIntensity = Math.max(0, rig.envIntensity);
  }

  /* exposureBase is the ENVIRONMENT's exposure. It composes with the preset's
     instead of replacing it, so the presets keep their relative spread and the
     brightness slider keeps its full range on top of any photo. */
  renderer.toneMappingExposure = Math.max(0.05, rig.exposure * exposureBase);

  skyU.uTop.value.copy(rig.skyTop);
  skyU.uMid.value.copy(rig.skyMid);
  skyU.uHor.value.copy(rig.skyHorizon);
  skyU.uMidPos.value = rig.skyMidPos;
  skyU.uBias.value = Math.max(0.05, rig.skyBias);
  skyU.uHaloColor.value.copy(rig.skyHaloColor);
  skyU.uHalo.value = Math.max(0, rig.skyHalo);
  skyU.uDisc.value = Math.max(0, rig.skyDisc);
  skyU.uCloud.value = THREE.MathUtils.clamp(rig.cloudiness, 0, 1);
  /* `_keyDir`, não `key.position.normalize()`: desde que a caixa de sombra
     acompanha o conjunto, a POSIÇÃO da luz carrega o deslocamento do rig e
     normalizá-la daria uma direção de sol errada (e dependente de onde o
     caminhão está). Ver placeKeyLight(). */
  _dirW.copy(_keyDir);
  skyU.uKeyDir.value.copy(_dirW);

  if (starsMesh) {
    starsMesh.material.opacity = THREE.MathUtils.clamp(rig.starOpacity, 0, 1);
    /* no dome ⇒ no procedural stars: they sit at r=332 and would float in front
       of an HDRI sky that already has its own (or a daylit sky that has none) */
    starsMesh.visible = skyDomeOn && rig.starOpacity > 0.01;
  }
  /* THE LENS READS AS THE SOURCE. Both halves are driven, not just the level:
     the emissive COLOUR follows `lampColor`, so `estudio`'s cold LED shows a
     cold lens and every other preset a sodium-warm one, instead of one fixed
     amber that contradicts the pool of light on the ground. */
  const lampE = Math.max(0, rig.lampEmissive);
  const lampLensMat = getLampLensMat();
  if (lampLensMat) {
    lampLensMat.emissive.copy(rig.lampColor);
    lampLensMat.emissiveIntensity = lampE;
  }
  /* Emissives a loaded fixture brought with it, taken over by
     prepareLampModel() so a lens authored "always on" does not glow at noon.
     Their own colour is left alone — that is the model author's choice — and
     only the level follows the clock, at half strength because a textured lens
     is already carrying its own brightness. */
  for (const mat of lampModelEmissive.keys()) mat.emissiveIntensity = lampE * 0.5;
  for (const u of lampUnits) {
    u.spot.color.copy(rig.lampColor);
    /* Units the layout parked (manifest `count` below the fixed pool, or lamps
       off for this environment) are darkened HERE, through intensity — a plain
       uniform. Doing it by flipping SpotLight.visible would be a shader define
       and a full recompile on every environment change. setLamps() only ever
       sets the flag; this stays the single writer of the value.
       lampIntensityScale is the (h/LAMP_HEIGHT)² inverse-square compensation
       for a per-scene mounting height; it is 1 at the authored height. */
    u.spot.intensity = u.active ? Math.max(0, rig.lampIntensity) * getLampIntensityScale() : 0;
  }

  applyWetness(THREE.MathUtils.clamp(rig.wetness, 0, 1));

  /* the paint shader reads the key light from these uniforms rather than
     directionalLights[0] — that index depends on three's internal
     shadow-casters-first sort and would silently follow the wrong light */
  _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
  _keyCol.copy(key.color).multiplyScalar(key.intensity);
  setKeyLight(_dirV, _keyCol, rig.glintBoost);

  for (const fn of rigHooks) fn(rig);

  /* THE broadest invalidation in the module: everything the rig owns — key/rim/
     hemi/ambient, fog, background, exposure, the sky uniforms, the lamps, the
     wetness, the paint's view-space key — was just written. Every public setter
     in this file reaches here through beginTween(), so covering applyRig()
     covers the whole lighting API in one place. */
  invalidate();
}

/* Discrete state cannot be interpolated, so: grow early, shrink late. The lamp
   SpotLights come on the instant a transition to night starts, and only switch
   off once a transition away from night has fully finished — a mid-tween flip
   would be a visible pop AND a shader recompile at the worst moment.

   HYSTERESIS, and the clock is why it is needed. `lampIntensity` used to take
   one of two authored values; it is now a continuous function of the hour, so a
   slider parked on a single threshold would flip NUM_SPOT_LIGHTS on every
   pointer event — a recompile of every material in the scene, per event, for as
   long as the user jiggles. Two levels a factor of four apart turn that into
   one crossing. The ON level is low deliberately: at 6 of a night preset's ~95
   the lamps are still too dim to see, so the flag is always thrown while the
   result is invisible and the ramp the user actually watches is `intensity`,
   which applyRig() writes as a plain uniform.

   This remains the SINGLE writer of SpotLight.visible. */
const LAMP_ON_LEVEL = 6, LAMP_OFF_LEVEL = 1.5;
/* Seeded true to match SpotLight's own construction default, or the first call
   would short-circuit as a no-op and leave eight lit spots in a daylit scene. */
let lampsOn = true;

/** Does this rig want the pool live, given where the pool already is? */
function lampsWanted(intensity: number) {
  return lampsOn ? intensity > LAMP_OFF_LEVEL : intensity > LAMP_ON_LEVEL;
}

function setLampsEnabled(on: boolean) {
  if (on === lampsOn) return;
  lampsOn = on;
  for (const u of lampUnits) {
    if (u.spot.visible !== on) u.spot.visible = on;
  }
  invalidate();
}

/**
 * Compile BOTH light configurations now, so the hour slider never has to.
 *
 * THE STALL ON THE TIME SLIDER IS A SHADER RECOMPILE, and this is where it comes
 * from. setLampsEnabled() flips SpotLight.visible on the whole pole pool at the
 * day↔night crossing; WebGLRenderer gathers lights with traverseVisible(), so
 * that moves NUM_SPOT_LIGHTS 0↔8 — which is part of the program CACHE KEY of
 * every material in the scene. Crossing dusk therefore recompiles the set (a
 * 176k-triangle industrial estate), the implement's ~50 materials and the cab,
 * synchronously, in the middle of a pointer drag. It is a once-per-session cost
 * because three then caches the programs by that key: the second crossing is
 * free. So the fix is not to make it cheaper, it is to pay for it where a wait
 * is expected.
 *
 * Kennedy's call, and it is the right one for a configurator: "prefiro ter um
 * pouco mais de tempo de carregamento no início do que ter esse travamento na
 * mudança do slider."
 *
 * Must run with every material already in the scene — studio.ts calls it after
 * the set, the cab, the implement and the paint are all mounted. Restoring the
 * flag afterwards matters: this is a warm-up, not a state change, and
 * setLampsEnabled() remains the single writer of SpotLight.visible.
 *
 * AWAITABLE, and callers should await it. It used to be two synchronous
 * `renderer.compile()` calls, each of which blocks the main thread for the
 * whole compile AND the whole driver link with the full scene mounted; r179's
 * `compileAsync` hands the link back to the driver's parallel compiler
 * (KHR_parallel_shader_compile) and polls, so the curtain's progress bar can
 * still animate through it. The synchronous call stays as the fallback for a
 * driver without the extension. The returned promise is what keeps the loading
 * curtain over the work — resolve it before lifting the curtain or the stall
 * simply moves to the first visible frame, which is the bug this exists to fix.
 */
export async function warmLightPrograms(): Promise<void> {
  const was = lampsOn;
  /* The scene is about to be deliberately wrong for as long as the compile
     takes, and unlike the old synchronous compile() that window now contains
     real frames. See drawSuspended. */
  drawSuspended++;
  try {
    setLampsEnabled(!was);
    await compilePrograms();
  } catch (err) {
    console.warn('[truck-studio] pré-compilação da configuração de luz alternativa falhou'
      + ' — a primeira passagem por 18:00 pode engasgar.', err);
  } finally {
    /* Restored only after the await settles, which is the point: three gathers
       lights with traverseVisible() inside compile(), so the alternative pool
       has to be MOUNTED for the duration of that call. */
    setLampsEnabled(was);
    drawSuspended--;
    invalidate();
  }
  /* And the configuration we are actually about to render, so the first frame
     after the loader is not a compile either. */
  try { await compilePrograms(); } catch (_) { /* ignore */ }
  invalidate();
}

/* EVERY WAIT HERE IS BOUNDED — the same discipline, and the same 8 s, as
   studio.ts's warmUp(). A backgrounded tab does not fire requestAnimationFrame,
   and three's parallel-compile polling stalls with it, so a bare `await` would
   hang the loading curtain forever if the user switched tab mid-load. Warming up
   is an optimisation; it is never allowed to be why the studio fails to open. */
const COMPILE_TIMEOUT_MS = 8000;

function compilePrograms(): Promise<unknown> {
  /* Feature-detected rather than assumed: `compileAsync` is r152+, and this is
     the one place a three downgrade would turn into a silent hang instead of a
     type error. */
  const r = renderer as THREE.WebGLRenderer & {
    compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
  };
  if (typeof r.compileAsync !== 'function') {
    renderer.compile(scene, camera);
    return Promise.resolve();
  }
  return Promise.race([
    r.compileAsync(scene, camera),
    new Promise<void>((res) => setTimeout(res, COMPILE_TIMEOUT_MS)),
  ]);
}

function beginTween(animate: boolean) {
  const next = resolveRig(sceneState);
  if (!rigCur) {
    rigCur = next;
    rigFrom = makeRig(RIG_BASE);
    rigTo = next;
    tweenT = 1;
    setLampsEnabled(lampsWanted(next.lampIntensity));
    applyRig(rigCur);
    refreshEnvironment(rigCur, true);
    return;
  }
  rigTo = next;
  if (!animate) {
    lerpRig(rigCur, next, next, 1);
    tweenT = 1;
    setLampsEnabled(lampsWanted(next.lampIntensity));
    applyRig(rigCur);
  } else {
    rigFrom = makeRig(RIG_BASE);
    lerpRig(rigFrom, rigCur, rigCur, 1);        // snapshot the current pose
    tweenT = 0;
    if (lampsWanted(next.lampIntensity)) setLampsEnabled(true);   // grow early
  }
  refreshEnvironment(next, false);
  /* Redundant on every branch — applyRig() already invalidated, and the animated
     branch will be held open by isTransitioning() — but this is the funnel every
     public lighting entry point passes through, so it is the cheapest place to
     be sure. */
  invalidate();
}

export const isTransitioning = () => tweenT < 1;
export const getRig = () => rigCur;
export const getKeyLight = () => key;

/* Called once per frame from the render loop; the ONLY writer to three objects. */
export function updateLighting(dt: number) {
  skyU.uTime.value += dt;
  if (tweenT < 1) {
    tweenT = Math.min(1, tweenT + dt / tweenDur);
    lerpRig(rigCur, rigFrom, rigTo, easeInOutCubic(tweenT));
    applyRig(rigCur);
    if (tweenT >= 1) setLampsEnabled(lampsWanted(rigTo.lampIntensity));   // shrink late
  } else if (rigCur) {
    /* the paint uniforms are VIEW space, so they must refresh as the camera
       orbits even when the rig itself is static */
    _dirW.copy(_keyDir);          // ver a nota em applyRig(): NÃO é key.position
    _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
    _keyCol.copy(key.color).multiplyScalar(key.intensity);
    setKeyLight(_dirV, _keyCol, rigCur.glintBoost);
  }
}

/* ---------------- public API ---------------- */

/**
 * Move the clock. 6 = 06:00, 24 = midnight; fractional hours are fine (the HUD
 * uses quarters) and out-of-range values are clamped rather than rejected.
 *
 * This re-derives the key light's az/el from the new hour and CLEARS both
 * manual overrides — see syncSunToHour() for the full policy — and re-derives
 * `sceneState.timeOfDay`, so every pre-clock consumer stays coherent.
 *
 * Defaults to NOT animating, for the same reason setLightParams() does: this is
 * a slider, and a 0.8 s crossfade would trail the thumb.
 *
 * @param {number} h
 * @param {{animate?: boolean}} [opts]
 */
export function setHourOfDay(h: number, opts?: { animate?: boolean }) {
  setHourInternal(h);
  sceneState.azManual = false;
  sceneState.elManual = false;
  syncSunToHour();
  beginTween(!!(opts && opts.animate));
  save();
  return sceneState;
}

/** @returns {number} the current hour, HOUR_MIN..HOUR_MAX */
export function getHourOfDay() { return sceneState.hour; }

/** 0 = full day, 1 = full night: the weight the two preset faces crossfade on
 *  and, through the rig, the weight behind the stars, the lamps and the fog. */
export function getNightness() { return nightnessAt(sceneState.hour); }

/**
 * Weather. NIGHT IS A WEATHER-ORTHOGONAL AXIS — that is what lets "overcast at
 * night" and "raining at dawn" both exist and look right — so a preset change
 * does NOT move the clock. It keeps the hour, re-derives the sun from it, and
 * therefore also drops any az/el the user had pinned (a new preset is a new
 * look; carrying a hand-aimed light into it is not what anyone means by picking
 * "Chuvoso"). `estudio` opts out with `solar: false` and gets its authored
 * studio geometry back instead.
 *
 * The consequence worth stating: picking "Dourado" at 12:00 gives golden
 * COLOURS with a midday sun, not a sunset. If you want the sunset, move the
 * clock — that is what it is for. Having the preset yank the time slider would
 * make the headline control feel like it was fighting the user.
 */
export function applyPreset(id: string, opts?: { animate?: boolean }) {
  if (!LIGHT_PRESETS[id]) id = 'ensolarado';
  sceneState.preset = id;
  sceneState.azManual = false;
  sceneState.elManual = false;
  sceneState.brightness = 1;
  syncSunToHour();
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

/**
 * The pre-clock binary control, kept working for every caller that still speaks
 * it (environment.ts applies `envDef.timeOfDay` through it). It is now a
 * shortcut for two canonical hours, chosen so the resulting rig is EXACTLY the
 * one this function produced before the clock existed: n(12:00) = 0 and
 * n(21:30) = 1, so 'dia' is the undiluted `dia` face and 'noite' the undiluted
 * `noite` face. Like the hour slider it re-derives az/el and clears the manual
 * overrides, which is what it did before too.
 */
export function setTimeOfDay(tod: TimeOfDay, opts?: { animate?: boolean }) {
  setHourInternal(tod === 'noite' ? TOD_HOUR.noite : TOD_HOUR.dia);
  sceneState.azManual = false;
  sceneState.elManual = false;
  syncSunToHour();
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

/* az / el / brightness. Defaults to NOT animating: a slider drag has to track
   the thumb, and tweening would lag behind the pointer.
   az and el are the clock's outputs, so writing one PINS THAT AXIS against the
   clock until the hour next moves (or the preset changes) — syncSunToHour()
   documents why the pin is deliberately not permanent. Non-finite input is
   dropped rather than propagated: a NaN here reaches key.position and takes the
   whole render with it. */
export function setLightParams(
  p: { az?: number; el?: number; brightness?: number }, opts?: { animate?: boolean },
) {
  if (p.az !== undefined && Number.isFinite(+p.az)) {
    sceneState.az = +p.az;
    sceneState.azManual = true;
  }
  if (p.el !== undefined && Number.isFinite(+p.el)) {
    sceneState.el = +p.el;
    sceneState.elManual = true;
  }
  if (p.brightness !== undefined && Number.isFinite(+p.brightness)) {
    sceneState.brightness = +p.brightness;
  }
  beginTween(!!(opts && opts.animate));
  save();
  return sceneState;
}


/**
 * Show/hide the procedural gradient dome. An HDRI background is drawn by
 * WebGLBackground with depthTest off, so the dome (a BackSide sphere at r=340
 * that DOES write depth) would hide it completely — this is what makes an HDRI
 * visible at all. The stars follow the dome, see the guard in applyRig().
 * @param {boolean} v
 */
export function setSkyDomeVisible(v: boolean) {
  skyDomeOn = !!v;
  if (skyDome) skyDome.visible = skyDomeOn;
  if (starsMesh && !skyDomeOn) starsMesh.visible = false;
  if (starsMesh && skyDomeOn && rigCur) starsMesh.visible = rigCur.starOpacity > 0.01;
  invalidate();
}

/* ---------------- horizon haze ----------------
   THE SEAM BETWEEN 3D AND PHOTOGRAPH, AND WHY FOG ALONE CANNOT CLOSE IT.

   three.js does not fog `scene.background`. Geometry recedes into `fogColor`;
   the HDRI behind it stays at full contrast whatever the fog is doing. So a 3D
   set always ends in a visible line: fogged ground on one side, crisp
   photograph on the other. Raising fogDensity does not help — it fogs the only
   half that was already fogged.

   This is the missing half: a shell that fogs the SKY. An inverted sphere just
   inside the far plane, painted `fogColor`, opaque at the horizon and fading to
   nothing by ~24° elevation. It is transparent, so it draws after the opaque
   pass and over the background; it is at 570 m with depthWrite off, so every
   piece of real geometry occludes it correctly.

   The two halves then MEET at the same colour: ground fades to fogColor going
   out, sky fades to fogColor coming down, and the horizon stops being an edge.

   It pays for the night as well. `fogColor` at night is 0x141d2e, so the lower
   sky darkens with the scene instead of staying a lit daytime photograph —
   which is the other half of the "24:00 não fica noite" fix in applyRig(). */
const HAZE_R = 570;                    // camera.far is 600 — must sit inside it
let hazeMesh: THREE.Mesh | null = null;

/* ---------------- horizon tint ----------------
   WHERE THE HAZE COLOUR COMES FROM WHEN A PHOTOGRAPH IS THE SKY.

   The haze above closes the seam by painting the lower sky in `fogColor`, so
   that fogged ground and fogged sky meet at one colour. That argument is only
   true if `fogColor` IS the colour the sky has at the horizon — and under an
   HDRI it is not. `fogColor` is PRESET data, authored for the procedural dome:
   `ensolarado` inherits RIG_BASE's 0xb8d8f5, a pale sky blue.

   Measured against what it was actually being painted over — the horizon band
   of `rodovia/sky.hdr`, the panorama `distrito-industrial` uses — the two are
   not close:

     preset fogColor 0xb8d8f5    linear 0.487 0.708 0.947   pale blue
     HDRI horizon    0x5a633f    linear 0.102 0.124 0.050   olive green

   Five times too bright and the opposite hue. At `haze: 0.8` that is a pale
   ribbon laid across a green field: the "faixa cinza que não faz sentido". No
   amount of retuning `strength`, `low` or `high` can fix a colour, and turning
   the haze down only trades the ribbon back for the hard seam it exists to
   remove.

   So an environment may declare the tone its own horizon actually has, and it
   overrides `fogColor` for the two surfaces that have to agree with the
   photograph — `scene.fog` and the haze shell. Everything else the preset
   drives is untouched: this is a match to a specific plate, not a lighting
   change, and `bgColor` in particular must keep tracking the preset because it
   is what shows when the HDRI is released.

   It is authored rather than sampled at load. Sampling is what the rip viewer
   does and it is the more self-maintaining answer, but `loadHdr()` hands the
   DataTexture straight to PMREM and drops it, so reading it back means keeping
   a 16 MB float buffer alive per environment for one colour. One measured hex
   in the manifest, with the measurement written down beside it, buys the same
   thing for nothing. */
let horizonTint: THREE.Color | null = null;

/**
 * Pin fog and horizon haze to a measured colour, or `null` to hand both back to
 * the preset. Takes effect on the next applyRig(), which is every frame of a
 * tween and at least once per environment change.
 * @param {number | string | null} c hex (0x5a633f) or css string, sRGB
 */
export function setHorizonTint(c: number | string | null) {
  invalidate();
  if (c === null || c === undefined || c === '') {
    horizonTint = null;
    return;
  }
  horizonTint = new THREE.Color(c as THREE.ColorRepresentation);
}
const hazeU = {
  uLow: { value: -0.10 },              // sin(elev) at which haze is full
  uHigh: { value: 0.40 },              // sin(elev) at which haze is gone (~24°)
  uStrength: { value: 0 },             // 0 = off; set by setHorizonHaze()
};

function makeHaze(): THREE.Mesh {
  /* MeshBasicMaterial + onBeforeCompile rather than a ShaderMaterial: this way
     the haze keeps three's own tonemapping_fragment and colorspace_fragment, so
     it is graded by ACES exactly like the fogged geometry it has to match. A
     hand-written ShaderMaterial would have to reproduce both chunks and would
     drift from them on the next three upgrade. */
  const mat = new THREE.MeshBasicMaterial({
    color: 0xb8d8f5, side: THREE.BackSide,
    transparent: true, depthWrite: false, fog: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLow = hazeU.uLow;
    shader.uniforms.uHigh = hazeU.uHigh;
    shader.uniforms.uStrength = hazeU.uStrength;
    shader.vertexShader = 'varying vec3 vHazeDir;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHazeDir = position;');
    /* Injected after <map_fragment> on purpose: that chunk exists in every
       three version this project has seen, where the name of the final output
       chunk (output_fragment → opaque_fragment) has changed twice. */
    shader.fragmentShader =
      'varying vec3 vHazeDir;\nuniform float uLow;\nuniform float uHigh;\nuniform float uStrength;\n'
      + shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.a *= (1.0 - smoothstep(uLow, uHigh, normalize(vHazeDir).y)) * uStrength;');
  };
  const m = new THREE.Mesh(new THREE.SphereGeometry(HAZE_R, 32, 20), mat);
  m.name = 'ts-haze';
  m.frustumCulled = false;             // it is always around the camera
  m.renderOrder = 10;                  // after the set, before the HUD sprites
  return m;
}

/**
 * Turn the horizon haze on or off.
 * @param {null | {strength?: number, low?: number, high?: number}} opts
 *        `strength` 0..1 scales the whole effect (1 = fully opaque at the
 *        horizon). null removes it.
 */
export function setHorizonHaze(opts: null | { strength?: number; low?: number; high?: number }) {
  invalidate();
  if (!opts) {
    hazeU.uStrength.value = 0;
    if (hazeMesh) hazeMesh.visible = false;
    return;
  }
  if (!hazeMesh) {
    hazeMesh = makeHaze();
    scene.add(hazeMesh);
    /* Keeps the shell centred on the camera so the horizon stays at the
       horizon: at 570 m a 60 m dolly would otherwise tilt the fade by ~6°. */
    frameHooks.push(() => {
      if (hazeMesh) hazeMesh.position.set(camera.position.x, 0, camera.position.z);
    });
  }
  hazeMesh.visible = true;
  hazeU.uStrength.value = THREE.MathUtils.clamp(
    Number.isFinite(+opts.strength!) ? +opts.strength! : 1, 0, 1);
  if (Number.isFinite(+opts.low!)) hazeU.uLow.value = +opts.low!;
  if (Number.isFinite(+opts.high!)) hazeU.uHigh.value = +opts.high!;
  /* Same source of truth as applyRig(), which repaints this on the next frame
     anyway — but a scenery change can mount the shell while the rig is idle, and
     one frame of an ungraded midday olive over a night scene is exactly the
     artefact gradePlateColor() exists to remove. */
  if (rigCur) {
    (hazeMesh.material as THREE.MeshBasicMaterial).color.copy(
      horizonTint ? gradePlateColor(_tintGraded, horizonTint, rigCur) : rigCur.fogColor);
  }
}

/* ---------------- interior confinement ----------------
   Keep the camera inside a closed set.

   The cutaway (single-sided inward shell) means a camera OUTSIDE the warehouse
   sees straight in — useful, but it also means the orbit can drift out into a
   240 m grey apron and look back at a building with no far wall, which reads as
   broken. With the shed now 69 x 124 m there is no reason to ever leave: the
   truck can be framed from anywhere inside.

   Clamped in a frame hook rather than through OrbitControls' own limits because
   `maxDistance` is a radius about the target and this is a BOX — a radius large
   enough to see down the 124 m length would also let the camera through the
   69 m wall. */
let interiorBox: { hx: number; hz: number; cx: number; cz: number; minY: number; maxY: number } | null = null;
let interiorHooked = false;

/**
 * Confine the camera (and its orbit target) to a box, in world metres.
 * @param {null | {halfX:number, halfZ:number, minY:number, maxY:number}} b
 */
export function setInteriorBounds(
  b: null | {
    halfX: number; halfZ: number; minY: number; maxY: number;
    /* CENTRO DA CAIXA, opcional, padrão a origem do mundo.
       Existe porque o RIG não fica na origem: ele está em (0, 0, 22) e o
       conjunto ocupa z de 17,9 a 35,7. Para os dois cenários com `set` isso
       nunca importou — as caixas deles são grandes e folgadas o bastante
       (armazém: halfZ 62) para conter o rig deslocado —, mas uma sala gerada em
       código e centrada NO VEÍCULO (scene/cyclorama.ts) precisa de uma caixa
       centrada no mesmo lugar, senão a câmera é proibida de passar por trás do
       implemento. Omitir os dois campos reproduz exatamente o comportamento
       anterior, que é o que os cenários existentes fazem. */
    centerX?: number; centerZ?: number;
  },
) {
  interiorBox = b ? {
    hx: Math.max(1, b.halfX), hz: Math.max(1, b.halfZ),
    cx: b.centerX ?? 0, cz: b.centerZ ?? 0,
    minY: b.minY, maxY: Math.max(b.minY + 0.5, b.maxY),
  } : null;
  /* The clamp runs in a frame hook, so a new box only bites on the next drawn
     frame — which under the dirty loop is a frame that has to be asked for. */
  invalidate();
  if (!interiorBox || interiorHooked) return;
  interiorHooked = true;
  frameHooks.push(() => {
    const k = interiorBox;
    if (!k) return;
    const c = THREE.MathUtils.clamp;
    camera.position.set(
      c(camera.position.x, k.cx - k.hx, k.cx + k.hx),
      c(camera.position.y, k.minY, k.maxY),
      c(camera.position.z, k.cz - k.hz, k.cz + k.hz));
    /* The target too, or a clamped camera orbiting a target outside the box
       would swing along the wall instead of around the truck. */
    controls.target.set(
      c(controls.target.x, k.cx - k.hx, k.cx + k.hx),
      c(controls.target.y, k.minY, k.maxY),
      c(controls.target.z, k.cz - k.hz, k.cz + k.hz));
  });
}

/* ---------------- vehicle focus ----------------
   The subject of this studio is ONE object. Until now nothing said so: the
   orbit had no distance limits at all, and the only thing bounding a pan was
   the set's interior box — 60 x 58 m for the distrito — so the rig could be
   pushed to a speck in the corner of a yard, which is not a view of a truck.

   Three limits, all derived from the rig's own size so they follow a change of
   implement:

   * ORBIT RANGE. minDistance keeps the camera off the bodywork, maxDistance
     keeps the rig filling the frame. At 45° vertical FOV a 18 m rig needs
     ~12 m to fit its length, so 2.6 r (~25 m) is a wide establishing shot and
     anything beyond it is just a smaller truck.
   * TARGET LEASH. OrbitControls bounds the camera about the target but nothing
     bounds the TARGET, and panning drags it freely — that is the actual
     mechanism by which the truck leaves the frame. It is now tied to a sphere
     around the rig centre: enough to recompose, never enough to lose it.
   * BODY EJECTION. minDistance is a SPHERE about the target, which cannot
     express "outside a 15 m long box": a radius small enough to let you near
     the flank also lets you sit inside the van from the front. So the camera is
     pushed back out of the bodywork every frame, on whichever of X/Z is nearer.
     Never on Y — ejecting downwards would put the camera under the floor. */
let vehicleFocus: { c: THREE.Vector3; box: THREE.Box3; r: number } | null = null;
let vehicleFocusHooked = false;
/* minDistance, as a fraction of the rig radius. Estava em 0.30, que num rig de
   ~18 m deixava a câmera chegar a ~2.8 m do centro — perto o bastante para o
   enquadramento virar um close de painel de porta, sem veículo reconhecível na
   tela e com a distorção de perspectiva do FOV de 45° esticando a lataria. Em
   0.40 o limite fica em ~3.7 m, que ainda encosta o suficiente para inspecionar
   um detalhe da arte e ainda lê como caminhão.
   Não é o único limitador: FOCUS_SKIN empurra a câmera para fora da carroceria
   todo quadro, porque minDistance é uma ESFERA e não sabe dizer "fora de uma
   caixa de 15 m" (ver o cabeçalho acima). */
const FOCUS_MIN_F = 0.40;   // minDistance, as a fraction of the rig radius
/* maxDistance, idem — mas agora é um PISO, não a palavra final: ver o
   Math.max() em setVehicleFocus(). O 2.60 foi calculado para uma lente de 45°
   (é o que o cabeçalho acima ainda descreve); a câmera passou a abrir em
   CARD_FOV = 30, e uma teleobjetiva precisa de MAIS distância para enquadrar o
   mesmo conjunto. O resultado era frameAll() pousar a câmera em ~3.9 r e o
   clamp do OrbitControls puxá-la de volta para 2.6 r no primeiro quadro: a cena
   abria mais fechada do que a pose do card, e não havia como afastar. */
const FOCUS_MAX_F = 2.60;
/* Folga de afastamento ALÉM da pose de abertura. Sem ela o limite de órbita
   coincidiria com a distância de abertura e a roda do mouse não teria para onde
   ir no sentido de afastar.
   1.35 -> 1.15: a 1,35 o afastamento máximo passava de 48 m num conjunto de
   19 m, e lá o caminhão já era um detalhe no meio do pátio — o set foi autorado
   para uma órbita bem mais curta (ver setNote em environments.json). 1.15 ainda
   dá curso de roda para afastar além da abertura, que é a razão de este número
   existir, sem deixar a órbita sair do pátio útil. */
const OPEN_ZOOM_OUT = 1.15;
const FOCUS_PAN_F = 0.28;   // how far the target may be panned off centre
const FOCUS_SKIN = 0.45;    // metres of clearance kept outside the bodywork
const _fv = new THREE.Vector3();

/**
 * Lock the orbit to a rig. Pass null to release it (no limits).
 *
 * É TAMBÉM O DONO DO CENTRO DA CAIXA DE SOMBRA, e não por conveniência: esta é
 * a única função do engine que recebe a caixa do conjunto INTEIRO já engatado e
 * já colocado no cenário (`focusOnRig()` em studio.ts a chama depois do engate,
 * e emenda `invalidateShadows()` logo em seguida). Ver o bloco de
 * `placeKeyLight()` para o que a caixa centrada na origem estava cortando fora.
 */
export function setVehicleFocus(box: THREE.Box3 | null) {
  /* Same reason as setInteriorBounds(): the ejection runs in a frame hook. */
  invalidate();
  if (!box || box.isEmpty()) {
    vehicleFocus = null;
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    /* Sem conjunto, a caixa volta para a origem — é onde o cenário está. */
    _shadowFocus.set(0, 0, 0);
    placeKeyLight();
    renderer.shadowMap.needsUpdate = true;
    return;
  }
  const c = box.getCenter(new THREE.Vector3());
  /* Só X e Z. A altura fica no CHÃO de propósito: o alcance vertical do
     `near/far` foi dimensionado para uma luz a 26 m de um alvo no nível do
     solo, e subir o alvo para o meio da carroceria (~2 m) empurraria o plano
     próximo para dentro do próprio caminhão sob sol alto. */
  _shadowFocus.set(c.x, 0, c.z);
  placeKeyLight();
  renderer.shadowMap.needsUpdate = true;
  const r = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);
  vehicleFocus = { c, box: box.clone().expandByScalar(FOCUS_SKIN), r };
  controls.minDistance = r * FOCUS_MIN_F;
  /* O limite de afastamento nunca pode ficar aquém da própria pose de abertura,
     senão o clamp do OrbitControls desfaz frameAll() no primeiro quadro. Num
     viewport estreito o meio-ângulo apertado é o HORIZONTAL, e a distância de
     abertura passa de 6 r — por isso o piso sai de openingDistance() (que lê o
     aspecto corrente) e não de mais uma constante. */
  controls.maxDistance = Math.max(r * FOCUS_MAX_F, openingDistance(r) * OPEN_ZOOM_OUT);
  if (vehicleFocusHooked) return;
  vehicleFocusHooked = true;
  frameHooks.push(() => {
    const f = vehicleFocus;
    if (!f) return;
    _fv.subVectors(controls.target, f.c);
    const lim = f.r * FOCUS_PAN_F;
    if (_fv.lengthSq() > lim * lim) {
      _fv.setLength(lim);
      controls.target.copy(f.c).add(_fv);
    }
    const p = camera.position, b = f.box;
    if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y &&
        p.z > b.min.z && p.z < b.max.z) {
      const outX = Math.min(p.x - b.min.x, b.max.x - p.x);
      const outZ = Math.min(p.z - b.min.z, b.max.z - p.z);
      /* IMEDIATA, e não amortecida. Uma versão desta função empurrava a câmera
         uma fração do caminho por quadro, para a saída não ser um salto — e o
         resultado foi a câmera ENTRAR no caminhão, que é a única coisa que esta
         guarda existe para impedir. Duas razões, e as duas condenam qualquer
         suavização aqui:

         * ela é o ÚNICO obstáculo entre a órbita e o interior da carroceria.
           `minDistance` é 0,40 r — uns 3,8 m — medidos a partir da MIRA, que
           fica no meio de um conjunto de 19 m: dar zoom até o limite já põe o
           olho dentro da cabine, e é esta expulsão que o tira de lá. Amortecida,
           passam-se uns dez quadros lá dentro a cada vez;
         * ela DISPUTA com o OrbitControls. Cada quadro ele recompõe a órbita a
           partir da posição que encontrar, então um empurrão de 28% por quadro é
           simplesmente refeito pelo arrasto do usuário no quadro seguinte —
           arrastando contra a lataria dá para ficar dentro dela indefinidamente.

         O desvio das construções (setCameraObstacles, abaixo) pode ser suave
         porque é uma preferência de enquadramento; isto é uma parede. */
      if (outX <= outZ) p.x = (p.x - b.min.x < b.max.x - p.x) ? b.min.x : b.max.x;
      else p.z = (p.z - b.min.z < b.max.z - p.z) ? b.min.z : b.max.z;
    }
  });
}

/* ---------------- desvio das construções ----------------
   O PROBLEMA. Acima há três limites: a caixa do interior (setInteriorBounds), a
   coleira da mira e a expulsão da carroceria. NENHUM DELES SABE ONDE ESTÃO OS
   PRÉDIOS — a caixa do interior é o PERÍMETRO do pátio, e dentro dele há
   galpões, tanques e contêineres que a órbita atravessa como se fossem ar.

   Isso não incomodava enquanto a órbita era curta. O set foi autorado contra
   ela: "os galpões de doca vêm de x 32 para x 26 ... o limite é a órbita do
   estúdio, que com maxDistance 2,6 r chega a ~25 m do caminhão, então mais perto
   que isso é uma parede dentro da câmera" (environments.json, setNote). Com a
   lente de 30° a pose de abertura pousa em ~3,9 r e maxDistance virou
   openingDistance(r) * 1.35 — perto de 50 m num conjunto de 19 m. A órbita
   alcança o que o set supôs inalcançável.

   POR QUE O TESTE É DE TRIÂNGULO E NÃO DE CAIXA. Esta é a terceira versão, e as
   duas anteriores morreram na mesma pedra: usavam a caixa envolvente de cada
   malha. Neste set isso NÃO FUNCIONA, e a razão é a organização do .glb — as
   malhas são agrupadas por ATLAS DE MATERIAL, não por prédio (ver setNoteOld em
   environments.json: "Container = ferrugem", "MetalTrim = guarda-corpos,
   escadas, passarelas de tanques e vasos"). Uma malha é o conjunto de TODAS as
   peças daquele atlas espalhadas pelo pátio, e a caixa dela é o volume que as
   envolve, quase todo ar. Medido sobre a geometria de verdade, com célula de
   2 m:

       malha `Container` em x[22,6..51,8] z[9,7..44,2], 24 m de altura,
       a 22,6 m do caminhão — a caixa MAIS PRÓXIMA de todas —
       tem 0,115 de ocupação real. 88,5% dela é pátio vazio.

   O efeito na tela era exatamente a queixa: a câmera parada em pátio aberto,
   com o prédio à VISTA e não na frente, e a correção disparando. Medido em 2000
   direções: a caixa acusava obstrução em 38,8% delas, a geometria real em 14,0%
   — 34,2% de FALSO POSITIVO, mais de uma direção em três.

   Com raycast de triângulo o falso positivo deixa de existir por construção:
   quem responde é a superfície do tanque, não o ar em volta dele. O custo
   medido é 0,356 ms por raio contra os 201 mil triângulos do cenário inteiro,
   uma vez por quadro e só quando a câmera se move — cabe folgado no orçamento
   de um quadro.

   E A CORREÇÃO NÃO É A POSIÇÃO VERDADEIRA DA CÂMERA. O OrbitControls é o dono
   da órbita; escrever a posição corrigida de volta nele apagaria o afastamento
   que o usuário pediu e — pior — faria o arrasto DISPUTAR com a correção, que
   foi como a versão de expulsão travava a câmera. Então a posição verdadeira é
   guardada, a corrigida é escrita só para desenhar, e no topo do quadro seguinte
   a verdadeira volta ANTES de controls.update(), que assim nunca a vê.

   ---- QUARTA VERSÃO: O GATILHO SEMPRE ESTEVE CERTO. A RESPOSTA É QUE NÃO ----

   As três versões anteriores discutiram QUANDO desviar. Medido sobre o
   distrito-industrial de verdade — os 201.202 triângulos sólidos que
   collectSolids() entrega, 5.190 poses de órbita dentro da caixa do interior —
   o gatilho não é o problema:

     · a correção dispara em 7,7% da órbita alcançável;
     · nessas poses o caminhão está 100% tapado em 370 de 401, medido lançando
       60 raios da câmera para pontos espalhados na caixa do conjunto;
     · falso positivo de verdade (menos de 25% do caminhão tapado): 1 em 401.

   Ou seja: quando ela dispara, há mesmo um galpão na frente. O que estava errado
   é O QUE ELA FAZIA. Encolher a distância tirava 9,1 m na mediana e até 22 m de
   uma órbita de 36 a 49 m — quase metade do afastamento — e isso não é "desviar
   de um prédio", é reenquadrar o caminhão inteiro sem ninguém ter pedido. Era
   exatamente essa a queixa: "me dá um zoom in extremo".

   E A APROXIMAÇÃO NUNCA FOI NECESSÁRIA. Nas mesmas poses em que a correção
   dispara, SUBIR a câmera — mesmo azimute, MESMA DISTÂNCIA — limpa a linha de
   visada em 266 de 266, com 10° de subida na mediana, 22° no p90 e 30° no pior
   caso. Não existe uma só pose neste cenário em que encolher a órbita seja a
   única saída. (Girar também resolveria, com 12° na mediana, mas o azimute é o
   eixo que o usuário está arrastando: corrigir ali é disputar com a mão dele.
   A altura é o eixo livre.)

   Então a ordem inverteu. PRIMEIRO SOBE — ganha altura e olha por cima do
   telhado, que é o que uma câmera de cinema faz e o que preserva o
   enquadramento. Só se a subida bater no teto é que a distância encolhe, e agora
   limitada a CUT_MAX_F da órbita, para nunca mais virar um salto. */
const BLOCK_SKIN = 0.6;      // metros de folga entre a lente e a construção
const BLOCK_MIN_D = 1.0;     // metros — piso absoluto quando não há rig em foco

/* A SUBIDA, que agora é a resposta principal.
   RISE_STEP é o passo do rastreio quadro a quadro. RISE_MAX 32° cobre com folga
   o pior caso medido (30°); RISE_ELEV_MAX impede que a soma vire uma vista de
   cima — o enquadramento que VIEW_DIR (scene/view.ts) existe para evitar, e que
   não mostra a lataria. */
const RISE_STEP = 2.5;
const RISE_MAX = 32;
const RISE_ELEV_MAX = 62;
/* Quando a visada passa de livre para bloqueada, um passo por quadro levaria
   ~13 quadros só para DECIDIR a altura — 0,2 s raspando a parede. A transição é
   rara (só na quina do galpão), então ali vale pagar uma varredura grossa de uma
   vez; no regime permanente volta a ser um passo por quadro. */
const RISE_PROBE_STEPS = 6;
/* Assimétrico, e pelo mesmo motivo do recuo: a quina de um galpão é uma
   descontinuidade, então entrar tem de ser rápido; sair devagar, senão sair de
   trás do prédio devolve a câmera num pulo. */
const RISE_IN = 0.20;
const RISE_OUT = 0.45;
/* Ao APROXIMAR — que agora só acontece com a subida no teto. 0,12 s espalha a
   correção por ~7 quadros. */
const AVOID_IN = 0.12;
/* Ao DEVOLVER a distância: lento de propósito, mesma razão. */
const AVOID_OUT = 0.38;
/* TETO DA APROXIMAÇÃO, como fração da órbita. É o número que impede o "zoom in
   extremo" de voltar por qualquer caminho: acima de ~30% o usuário deixa de ler
   como ajuste e passa a ler como zoom. */
const CUT_MAX_F = 0.30;

let obstacles: THREE.Object3D[] = [];
const _rc = new THREE.Raycaster();

/**
 * Declara a geometria SÓLIDA do cenário — aquela que a câmera não pode
 * atravessar. Chamado por scene/set.ts a cada troca de cenário; `null` libera.
 *
 * São as malhas em si, e não caixas: ver o cabeçalho acima para por que a caixa
 * envolvente não serve neste set.
 */
export function setCameraObstacles(list: THREE.Object3D[] | null) {
  obstacles = list && list.length ? list.slice() : [];
  /* O recuo E a subida suavizados eram medidos contra o cenário que saiu. */
  avoidCut = NaN; cutTarget = 0;
  riseNow = NaN; riseTarget = 0; wasBlocked = false;
  releaseAvoidance();
  _rayFrom.set(NaN, NaN, NaN);
  _rayTo.set(NaN, NaN, NaN);
  invalidate();
}

/**
 * Distância em que o raio SAI da caixa do veículo, partindo da mira (que está
 * dentro dela). É o piso do recuo: abaixo disto a câmera está DENTRO da
 * carroceria.
 *
 * O piso não pode ser `controls.minDistance`: minDistance é o raio de uma
 * ESFERA em torno da mira — 0,40 r, uns 4 m num conjunto de 19 m — e a mira
 * fica no MEIO do veículo, então 4 m ao longo do comprimento ainda é a cabine
 * por dentro. Contra uma caixa a conta certa é a saída do raio.
 */
function bodyExitDistance(dx: number, dy: number, dz: number) {
  const f = vehicleFocus;
  if (!f) return 0;
  const b = f.box, o = controls.target;
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (b.max.x - o.x) / dx);
  else if (dx < -1e-6) t = Math.min(t, (b.min.x - o.x) / dx);
  if (dy > 1e-6) t = Math.min(t, (b.max.y - o.y) / dy);
  else if (dy < -1e-6) t = Math.min(t, (b.min.y - o.y) / dy);
  if (dz > 1e-6) t = Math.min(t, (b.max.z - o.z) / dz);
  else if (dz < -1e-6) t = Math.min(t, (b.min.z - o.z) / dz);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

let avoidApplied = false;
let avoidCut = NaN;                           // recuo suavizado, em metros
let cutTarget = 0;                            // recuo que o rastreio quer, em metros
let riseNow = NaN;                            // subida suavizada, em graus
let riseTarget = 0;                           // subida que o rastreio quer, em graus
let wasBlocked = false;                       // para detectar a TRANSIÇÃO livre→tapado
const _avoidTrue = new THREE.Vector3();       // onde o OrbitControls pôs a câmera
const _avoidShown = new THREE.Vector3();      // o que foi escrito para desenhar
const _avoidDir = new THREE.Vector3();
const _riseDir = new THREE.Vector3();         // _avoidDir girada para cima
const _riseAxis = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
/* O raycast é a única parte cara disto, e uma cena parada (ou girando só a
   chuva) não muda nem a mira nem a câmera. Guardar a POSE em vez do resultado de
   um raio só é o que permite lançar vários (a busca da altura) sem pagar por
   eles num quadro em que ninguém mexeu na câmera. */
const _rayFrom = new THREE.Vector3(NaN, NaN, NaN);
const _rayTo = new THREE.Vector3(NaN, NaN, NaN);

/** Devolve a posição verdadeira, se a correção deste quadro ainda estiver de pé. */
function releaseAvoidance() {
  if (!avoidApplied) return;
  avoidApplied = false;
  /* SÓ desfaz se a câmera continuar exatamente onde applyAvoidance() a deixou.
     No intervalo entre um quadro e outro qualquer um pode reposicioná-la —
     frameAll() no botão "enquadrar", capture.ts, o console — e restaurar por
     cima disso desfaria a pose de quem mandou, um quadro depois. */
  if (camera.position.distanceToSquared(_avoidShown) < 1e-8) {
    camera.position.copy(_avoidTrue);
  }
}

/**
 * `_avoidDir` girada `deg` para CIMA, em torno do eixo horizontal perpendicular
 * a ela. Resultado em `_riseDir`.
 *
 * @returns false quando a direção já está vertical demais para ter esse eixo —
 *   aí não existe "subir" e o chamador fica com a direção original.
 */
function raisedDir(deg: number) {
  _riseDir.copy(_avoidDir);
  if (deg <= 1e-4) return true;
  /* cross(dir, up) e não cross(up, dir): com dir = +Z o primeiro dá -X, e girar
     +Z em torno de -X por um ângulo positivo leva a direção para CIMA. Trocar a
     ordem desce a câmera para dentro do chão, silenciosamente. */
  _riseAxis.crossVectors(_avoidDir, _UP);
  const l = _riseAxis.length();
  if (l < 1e-4) return false;
  _riseAxis.divideScalar(l);
  _riseDir.applyAxisAngle(_riseAxis, deg * Math.PI / 180).normalize();
  return true;
}

/** Primeira superfície sólida entre a mira e `dist` na direção `dir`, ou Infinity. */
function hitAlong(dir: THREE.Vector3, dist: number) {
  if (!obstacles.length) return Infinity;
  _rc.set(controls.target, dir);
  _rc.near = 0;
  /* Além da câmera não interessa: encurtar o alcance descarta cedo toda malha
     mais distante que ela, que é a maior economia disponível aqui. */
  _rc.far = dist;
  const hits = _rc.intersectObjects(obstacles, false);
  return hits.length ? hits[0].distance : Infinity;
}

/**
 * Decide QUANTO subir e, só no que sobrar, quanto aproximar. Escreve
 * `riseTarget` / `cutTarget`; a suavização é de quem chama.
 *
 * Custo em raios: 2 no regime livre, ~3 no regime tapado, até 8 no quadro da
 * transição. A 0,356 ms por raio isso é 0,7 ms num quadro comum — a mesma ordem
 * do raio único da versão anterior, porque o caro aqui nunca foi a quantidade de
 * raios e sim rodá-los num quadro em que nada mexeu (ver o cache da pose).
 */
function trackAvoidance(trueDist: number, floor: number) {
  if (trueDist <= floor) { riseTarget = 0; cutTarget = 0; wasBlocked = false; return; }

  const elev = Math.asin(THREE.MathUtils.clamp(_avoidDir.y, -1, 1)) * 180 / Math.PI;
  /* TETO DA SUBIDA. Além de RISE_MAX e da vista-de-cima, a caixa do interior
     também limita: subir levanta a câmera, e passar de `maxY` faria o gancho de
     confinamento puxá-la de volta no quadro seguinte — a correção brigaria com o
     clamp e a câmera tremeria na altura. Resolver aqui, no ângulo, é exato: o
     raio horizontal só ENCOLHE ao subir, então x/z nunca podem ser violados. */
  let elevCeil = RISE_ELEV_MAX;
  if (interiorBox) {
    const room = (interiorBox.maxY - controls.target.y) / trueDist;
    elevCeil = Math.min(elevCeil,
      Math.asin(THREE.MathUtils.clamp(room, -1, 1)) * 180 / Math.PI);
  }
  const ceiling = Math.max(0, Math.min(RISE_MAX, elevCeil - elev));

  /** distância do primeiro sólido com a câmera subida `deg`; Infinity = livre */
  const probe = (deg: number) => (raisedDir(deg) ? hitAlong(_riseDir, trueDist) : 0);

  let want = Math.min(riseTarget, ceiling);
  let hit = probe(want);

  if (hit >= trueDist) {
    /* Livre onde estamos. Tenta DEVOLVER um passo de altura — é o que faz a
       câmera descer sozinha depois que o galpão sai da frente, em vez de ficar
       presa lá em cima pelo resto da sessão. */
    if (want > 0 && probe(Math.max(0, want - RISE_STEP)) >= trueDist) {
      want = Math.max(0, want - RISE_STEP);
    }
    riseTarget = want;
    cutTarget = 0;
    wasBlocked = false;
    return;
  }

  if (!wasBlocked) {
    /* TRANSIÇÃO: varredura grossa, uma vez, para achar a altura de uma tacada. */
    want = ceiling;
    for (let i = 1; i <= RISE_PROBE_STEPS; i++) {
      const deg = ceiling * i / RISE_PROBE_STEPS;
      if (probe(deg) >= trueDist) { want = deg; break; }
    }
  } else {
    want = Math.min(ceiling, want + RISE_STEP);
  }
  wasBlocked = true;
  riseTarget = want;

  /* O que a subida não resolveu — e só isso — vira aproximação, com teto. */
  hit = probe(want);
  if (hit >= trueDist) { cutTarget = 0; return; }
  const allowed = Math.min(trueDist, Math.max(floor, hit - BLOCK_SKIN));
  cutTarget = Math.min(trueDist - allowed, trueDist * CUT_MAX_F);
}

/**
 * Encolhe a distância da câmera até caber antes da primeira construção.
 * Roda DEPOIS dos frameHooks (que são os donos da posição verdadeira) e a
 * correção FICA APLICADA até o topo do quadro seguinte — é isso que faz um
 * `renderer.render()` de fora do laço, como o de capture.ts, sair igual ao que
 * estava na tela.
 */
function applyAvoidance(dt: number) {
  const trueDist = camera.position.distanceTo(controls.target);
  if (trueDist < 1e-3) return;
  _avoidDir.subVectors(camera.position, controls.target).divideScalar(trueDist);

  /* O PISO DO RECUO: nenhuma construção justifica pôr a câmera dentro da
     carroceria. Sai da saída do raio na caixa do veículo, com a mesma folga que
     a expulsão usa; minDistance entra como piso esférico de reserva. */
  const floor = Math.max(
    bodyExitDistance(_avoidDir.x, _avoidDir.y, _avoidDir.z) + BLOCK_SKIN,
    controls.minDistance, BLOCK_MIN_D);

  /* Nada se moveu ⇒ os ALVOS são os mesmos e nenhum raio precisa ser lançado; a
     suavização abaixo continua andando com o relógio. É o que torna o custo do
     raycast proporcional ao MOVIMENTO e não ao tempo: uma cena parada com a
     chuva ligada continua desenhando quadros e não paga nada por eles. */
  if (!_rayFrom.equals(controls.target) || !_rayTo.equals(camera.position)) {
    _rayFrom.copy(controls.target);
    _rayTo.copy(camera.position);
    trackAvoidance(trueDist, floor);
  }

  /* O QUE É SUAVIZADO SÃO AS CORREÇÕES, NÃO A POSE. Amortecer a distância em si
     faz a câmera PERSEGUIR o próprio zoom: com a órbita livre a distância
     desejada muda a cada volta da roda e a suavizada chega 0,38 s depois, então
     afastar viraria um elástico mesmo sem construção nenhuma por perto.
     Amortecendo o RECUO e a SUBIDA (ambos zero com o caminho livre) a órbita
     livre passa exatamente como se isto não existisse. */
  if (!Number.isFinite(riseNow)) riseNow = riseTarget;
  else {
    const tau = riseTarget > riseNow ? RISE_IN : RISE_OUT;
    riseNow += (riseTarget - riseNow) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
  }
  if (!Number.isFinite(avoidCut)) avoidCut = cutTarget;
  else {
    const tau = cutTarget > avoidCut ? AVOID_IN : AVOID_OUT;
    avoidCut += (cutTarget - avoidCut) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
  }
  if (avoidCut < 0) avoidCut = 0;
  const maxCut = trueDist - floor;
  if (avoidCut > maxCut) avoidCut = Math.max(0, maxCut);
  if (riseNow < 0) riseNow = 0;

  /* ANTES do retorno curto: enquanto a suavização não assentou há movimento na
     tela que nenhuma outra condição de wantsFrame() enxerga — a órbita não
     mudou, o rig não mudou. */
  if (Math.abs(cutTarget - avoidCut) > 0.01 || Math.abs(riseTarget - riseNow) > 0.05) {
    invalidate();
  }

  if (avoidCut < 0.01 && riseNow < 0.05) return;   // livre, ou a um triz disso
  _avoidTrue.copy(camera.position);
  raisedDir(riseNow);
  camera.position.copy(controls.target).addScaledVector(_riseDir, trueDist - avoidCut);
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  _avoidShown.copy(camera.position);
  avoidApplied = true;
}

/**
 * Hand scene.background / scene.environment over to a photoreal HDRI (or take
 * them back). This is the ONLY writer of the `externalEnv` flag; every place
 * that would otherwise assign those two properties checks it.
 *
 * @param {THREE.Texture|null} tex  PMREM'd equirect for scene.environment
 * @param {{background?: THREE.Texture, rotation?: number,
 *          blurriness?: number, intensity?: number}} [opts]
 *        `background` defaults to `tex` (see environment.ts for why binding the
 *        PMREM to both is the cheap option). `rotation` is radians about +Y and
 *        is applied to BOTH scene.backgroundRotation and
 *        scene.environmentRotation so what you see and what the paint reflects
 *        stay in register.
 *
 * The texture belongs to the caller: this module never disposes it.
 */
export function setExternalEnvironment(
  tex: THREE.Texture | null,
  opts?: {
    background?: THREE.Texture; rotation?: number;
    blurriness?: number; intensity?: number;
  },
) {
  const o = opts || {};
  const num = (v: number | undefined, d: number) => (Number.isFinite(+v!) ? +v! : d);

  externalEnv = tex || null;
  externalBg = externalEnv ? (o.background || externalEnv) : null;
  extEnvIntensity = externalEnv ? Math.max(0, num(o.intensity, 1)) : 1;

  if (externalEnv) {
    scene.environment = externalEnv;
    scene.background = externalBg;
    const rot = num(o.rotation, 0);
    /* r163+ rotates the map at sampling time — no texture re-encoding, no
       second copy, and it can be changed per frame if we ever want to. */
    scene.environmentRotation.set(0, rot, 0);
    scene.backgroundRotation.set(0, rot, 0);
    /* backgroundBlurriness only does anything for a CubeUV (PMREM) texture:
       the raw-equirect path never reaches the ENVMAP_TYPE_CUBE_UV branch of
       three's backgroundCube shader. */
    scene.backgroundBlurriness = THREE.MathUtils.clamp(num(o.blurriness, 0), 0, 1);
  } else {
    scene.environmentRotation.set(0, 0, 0);
    scene.backgroundRotation.set(0, 0, 0);
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    scene.background = bgColor;                  // hand the Color instance back
    if (rigCur) refreshEnvironment(rigCur, true);   // rebuild the procedural IBL
    else scene.environment = null;
  }
  /* Re-drive the guarded values (intensities, background) from the live rig
     right now — applyRig() is otherwise only called during a tween. */
  if (rigCur) applyRig(rigCur);
  else invalidate();          // no rig yet: applyRig() did not cover us
}

/**
 * Environment-level exposure multiplier. Composes with the preset's
 * `rig.exposure` rather than replacing it, so switching scene does not flatten
 * the difference between Ensolarado and Chuvoso.
 * @param {number} v
 */
export function setExposureBase(v: number) {
  const n = +v;
  exposureBase = THREE.MathUtils.clamp(Number.isFinite(n) ? n : 1, 0.05, 8);
  if (rigCur) renderer.toneMappingExposure = Math.max(0.05, rigCur.exposure * exposureBase);
  invalidate();
}




/* Close the lamp seam: lamps.ts calls this after setLamps()/setLampModel() so a
   unit it just parked or re-fitted picks up the current rig pose immediately
   instead of staying lit until the next preset change. */
setLampRigRefresh(() => { if (rigCur) applyRig(rigCur); });

/* The persisted blob, as WRITTEN — nothing here is trusted; restore() validates
   and clamps every field. Widened where a hand edit could plausibly land
   (`hour` as a string), which is what the validators already handle. */
interface SavedScene {
  preset?: string;
  timeOfDay?: string;
  hour?: number | string | null;
  az?: number | string | null;
  el?: number | string | null;
  brightness?: number | string | null;
  azManual?: boolean;
  elManual?: boolean;
}

(function restore() {
  let s: SavedScene | null = null;
  try { s = JSON.parse(localStorage.getItem(SCENE_KEY) as string); } catch (_) { /* ignore */ }
  if (!s || typeof s !== 'object') s = {};
  /* Stale or hand-edited state must never throw: validate and clamp every
     field, or fall back to the default. */
  const num = (v: number | string | null | undefined, d: number, lo: number, hi: number) => {
    if (v === null || v === undefined || v === '') return d;
    const n = +v;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  /* `s.preset!` only asserts the index is a string: an absent preset misses
     LIGHT_PRESETS exactly as an unknown one does, and both fall to the default. */
  sceneState.preset = LIGHT_PRESETS[s.preset!] ? s.preset! : LIGHT_DEFAULTS.preset;
  /* The clock is the authority and `timeOfDay` is derived from it, so a blob
     written before the clock existed migrates the only way round that works:
     its binary face picks the canonical hour, and setHourInternal() derives
     `timeOfDay` straight back out. */
  const legacy = s.hour === undefined || s.hour === null;
  setHourInternal(num(
    s.hour, s.timeOfDay === 'noite' ? TOD_HOUR.noite : TOD_HOUR.dia,
    HOUR_MIN, HOUR_MAX));
  /* A legacy blob's az/el carry no record of whether a user chose them or a
     preset default did, so they are not trusted and the clock re-derives both.
     Losing a hand-set sun angle once is the right trade against resurrecting a
     preset default under a model that no longer produces it — and az/el are one
     drag away in the HUD, whereas a light stuck at an angle nothing explains is
     the kind of state that gets reported as a rendering bug. */
  sceneState.azManual = !legacy && s.azManual === true;
  sceneState.elManual = !legacy && s.elManual === true;
  sceneState.brightness = num(s.brightness, 1, 0.15, 2.5);
  syncSunToHour();
  if (sceneState.azManual) sceneState.az = num(s.az, sceneState.az, 0, 360);
  if (sceneState.elManual) sceneState.el = num(s.el, sceneState.el, 2, 85);
  beginTween(false);
})();

/* ---------------- framing / resize / loop ---------------- */
/**
 * A pose da câmera AGORA, normalizada pelo tamanho do que está enquadrado.
 *
 * Existe para fechar o laço do enquadramento padrão. `frameAll()` posiciona a
 * câmera por três multiplicadores sobre a diagonal da caixa do conjunto, e
 * acertar esses três olhando uma captura de tela é adivinhação. Com isto o
 * caminho vira: gire até gostar, chame `__studio.lighting.getCameraPose()`, e
 * cole os números de volta em `frameAll()` — eles JÁ estão na unidade certa,
 * porque são divididos pela mesma diagonal que ele multiplica.
 *
 * `dist` e `elevationDeg` vão junto por serem o que se lê num print: a que
 * distância e de que altura. `azimuthDeg` é 0 no +Z (a frente da cabine).
 */
export function getCameraPose() {
  const box = new THREE.Box3();
  for (const g of scene.children) if (g.visible) box.expandByObject(g);
  const size = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length();
  const t = controls.target;
  const d = new THREE.Vector3().subVectors(camera.position, t);
  const flat = Math.hypot(d.x, d.z);
  return {
    /* Os três multiplicadores de frameAll(), prontos para colar. */
    fx: +(d.x / size).toFixed(4),
    fy: +(d.y / size).toFixed(4),
    fz: +(d.z / size).toFixed(4),
    dist: +d.length().toFixed(2),
    elevationDeg: +(Math.atan2(d.y, flat) * 180 / Math.PI).toFixed(1),
    azimuthDeg: +(Math.atan2(d.x, d.z) * 180 / Math.PI).toFixed(1),
    target: { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) },
    size: +size.toFixed(2),
    aspect: +camera.aspect.toFixed(3),
  };
}

/** Distância de abertura para uma esfera envolvente de raio `r`: `raio / sin` do
 *  meio-ângulo APERTADO — vertical num viewport deitado, horizontal num
 *  estreito. É a mesma conta de preview.ts, e existe como função porque dois
 *  lugares dependem do MESMO número: frameAll(), que pousa a câmera nele, e
 *  setVehicleFocus(), que precisa garantir que o limite de órbita comporta a
 *  pose — do contrário um desfaz o outro no primeiro quadro. */
function openingDistance(r: number) {
  const vHalf = camera.fov * Math.PI / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  return r / Math.sin(Math.min(vHalf, hHalf));
}

/* VIEW_DIR ESTÁ NO EIXO DO VEÍCULO, E A CENA GIRA O VEÍCULO.
   ---------------------------------------------------------------------------
   `VIEW_DIR` é escrito no referencial do MODELO — "+Z é a frente" (ver
   view.ts), então o +X dele é o lado do MOTORISTA e o três-quartos que ele
   descreve é dianteiro. O card (ui/preview.ts) renderiza o veículo na origem,
   sem giro nenhum, e por isso o vê exatamente assim.

   O estúdio não: `RIG_PLACEMENT` (vehicle/models.ts) põe o conjunto 22 m
   adiante e VIRADO 180°, para ele apontar para a saída do pátio em vez do fundo
   dele. Somar VIEW_DIR ao centro em MUNDO, como se fazia aqui, ignora esse
   giro — e com yaw = π o mundo +X/+Z cai no -X/-Z do veículo, ou seja no lado
   do PASSAGEIRO e por trás. A cena abria espelhada em relação ao card que o
   usuário tinha acabado de clicar.

   Então a direção é levada para o referencial do conjunto antes de ser usada.
   Só o YAW: uma inclinação qualquer que o nó viesse a ter é da CARROCERIA, e
   herdar isso rodaria o horizonte. Com o conjunto na origem (yaw 0) a conta é a
   identidade, que é o comportamento antigo — nada muda no card nem em cena
   sem cenário. */
const _poseUp = new THREE.Vector3(0, 1, 0);
const _poseQ = new THREE.Quaternion();
const _poseE = new THREE.Euler();
const _poseYaw = new THREE.Quaternion();
const _poseP = new THREE.Vector3();
const _poseS = new THREE.Vector3();
const _poseDir = new THREE.Vector3();

/** VIEW_DIR do card, girado para o referencial em que o conjunto está posto. */
function openingDir(groups: THREE.Object3D[]) {
  _poseYaw.identity();
  for (const g of groups) {
    if (!g.visible) continue;
    /* frameAll() já chamou expandByObject() nestes nós, que atualiza a matriz de
       mundo — mas openingDir() é chamada por quem quiser, e uma matriz velha aqui
       devolveria o lado errado sem qualquer sintoma. */
    g.updateWorldMatrix(true, false);
    g.matrixWorld.decompose(_poseP, _poseQ, _poseS);
    _poseE.setFromQuaternion(_poseQ, 'YXZ');
    _poseYaw.setFromAxisAngle(_poseUp, _poseE.y);
    break;
  }
  return _poseDir.copy(CARD_VIEW_DIR).applyQuaternion(_poseYaw);
}

/* A ABERTURA DO ESTÚDIO É A POSE DO CARD.
   VIEW_DIR, FOV e TARGET_H vêm de ui/preview.ts — o mesmo três-quartos pela
   frente, a mesma elevação de ~7° e a mesma mira a 48% da altura da caixa. O
   card é o que o usuário clicou; abrir noutro ângulo faz parecer que veio parar
   noutro veículo.
   A distância sai da ESFERA que envolve a caixa, e não de multiplicadores sobre
   a diagonal: é a mesma conta de preview.ts (`raio / sin(meio-fov)`), a única
   que garante enquadrar o conjunto inteiro venha ele cavalo sozinho ou com
   implemento. O que preview.ts tem a mais — calibrate(), que mede a silhueta em
   pixels e reaproxima — fica de fora de propósito: aqui a moldura é o viewport
   do usuário, que muda de forma, e uma folga em volta é o que deixa girar sem
   raspar o veículo na borda no primeiro arrasto.
   O AJUSTE PELO ASPECTO some junto com o `k` que existia aqui: a conta antiga
   corrigia a distância por um palpite (1.35/aspect); esta pergunta qual dos dois
   meios-ângulos — vertical ou horizontal — é o apertado, e usa ele. Num viewport
   deitado quem limita é a altura; num estreito, a largura. */
export function frameAll(groups: THREE.Object3D[]) {
  const box = new THREE.Box3();
  for (const g of groups) if (g.visible) box.expandByObject(g);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const target = box.getCenter(new THREE.Vector3());
  target.y = box.min.y + (box.max.y - box.min.y) * CARD_TARGET_H;
  controls.target.copy(target);

  const dist = openingDistance(sphere.radius);

  camera.position.copy(target).addScaledVector(openingDir(groups), dist);
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  /* A correção suavizada é sobre a órbita ANTERIOR. Sem zerá-la, uma pose de
     abertura ampla nasceria encolhida (e agora também LEVANTADA) e iria se
     assentando ao longo do AVOID_OUT/RISE_OUT — que são lentos de propósito, e
     aqui apareceriam como a cena "respirando" ao carregar ou a cada clique em
     enquadrar. */
  avoidCut = NaN; cutTarget = 0;
  riseNow = NaN; riseTarget = 0; wasBlocked = false;
  camera.far = Math.max(dist + sphere.radius * 4, 700);   // sky dome inside the frustum
  camera.updateProjectionMatrix();               // near is managed per-frame in the loop
  /* frameAll() does NOT call controls.update(), and damping is on, so the camera
     coasts into the new pose over several frames. One dirty frame would land it
     part of the way there and stop. The damping-settle term in wantsFrame()
     carries the rest, but seeding a handful here means the settle is never
     waiting on the first of them. */
  invalidate(8);
}

/* Ankaa: the studio can be detached from the page (route change) or resized by
   the app chrome (sidebar collapse), so a zero-sized holder is a normal state —
   resizing to 0×0 would drop the drawing buffer and divide the aspect by zero.
   mountStudio() re-runs this and keeps a ResizeObserver on the holder. */
export function resize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  /* RE-APPLIED, not just set once at module load. `devicePixelRatio` is a
     PER-DISPLAY property: drag the window from a 1x panel to a 2x one and the
     value changes under a renderer that sampled it exactly once, at import.
     The symptom is a canvas rendered at half resolution on the retina screen (or
     at double cost on the cheap one) with nothing in the console. setSize()
     multiplies by whatever the ratio currently is, so this has to come first.
     Cheap by construction: three's setPixelRatio() early-outs on an unchanged
     value, so the common case is one comparison. */
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  /* A resized drawing buffer is a BLANK drawing buffer. Under the dirty loop,
     skipping this is a white viewport that stays white. */
  invalidate();
}
window.addEventListener('resize', resize);
resize();

/* ---------------- DEFERRED TEARDOWN ----------------
   ~500 MB of GPU memory outlives the route, and that is on purpose — up to a
   point.

   The engine is a deliberate singleton (studio.ts's header says so): unmounting
   detaches the DOM and stops the loop but keeps the WebGL context, the hundreds
   of megabytes of downloaded geometry and every baked PMREM alive, so coming
   back to the route is instant instead of pulling the whole implement down
   again. That is why disposeEnvironments(), disposeReflectionProbe() and
   disposeSetTextures() exist and are called from nowhere: wiring them into
   unmountStudio() would throw exactly that away.

   The answer is neither "free it on unmount" nor "never free it" — it is a
   DEADLINE. Leaving the route starts a timer; coming back cancels it. A user
   flicking to another page and back pays nothing; a user who left for good stops
   pinning half a gigabyte of VRAM for the rest of the browser session.

   The mechanism lives here because scene.ts is the only module every other one
   can already reach without inverting an import edge (see the acyclicity note at
   the top of the file). The POLICY — which disposers, in what order — belongs to
   studio.ts, which is the module that knows what is mounted. */
const IDLE_RELEASE_MS = 60_000;
let idleReleaseTimer: ReturnType<typeof setTimeout> | 0 = 0;

/**
 * Run `fn` once, `ms` from now, unless cancelIdleRelease() gets there first.
 *
 * Call it from unmountStudio(); call cancelIdleRelease() from mountStudio().
 * Replaces any release already pending rather than queueing a second one, so
 * two unmounts in a row still schedule exactly one teardown.
 *
 * `fn` must be safe to run against a detached, non-rendering studio and must
 * leave the engine re-mountable — every disposer this is meant for already is
 * (they degrade the scene back to procedural rather than breaking it).
 */
export function scheduleIdleRelease(fn: () => void, ms: number = IDLE_RELEASE_MS) {
  cancelIdleRelease();
  idleReleaseTimer = setTimeout(() => {
    idleReleaseTimer = 0;
    /* A failed disposer must not take the timer's owner down with it: by
       definition nobody is awaiting this, so a throw here would surface as an
       unhandled rejection minutes after the user left the page. */
    try { fn(); } catch (err) {
      console.warn('[truck-studio] liberação diferida de memória falhou', err);
    }
  }, ms);
}

/** Call from mountStudio(). Idempotent. */
export function cancelIdleRelease() {
  if (idleReleaseTimer) { clearTimeout(idleReleaseTimer); idleReleaseTimer = 0; }
}

/** True while a deferred teardown is armed — i.e. the studio is off the page. */
export const isIdleReleasePending = () => idleReleaseTimer !== 0;

/* ---------------- instrumentation ----------------
   `renderer.info` is free (three keeps these counters whether or not anyone
   reads them) and, until now, read by nobody — so there was no way to answer
   "how many draw calls is this scene actually costing" without opening a
   profiler. It is the number every decision in this file is argued from.

   `frame` is in here for the dirty loop specifically: it is the only way to tell
   a correctly idle renderer from a frozen one. Watch it across a few seconds of
   an untouched viewport — flat is on-demand working, climbing at 60/s is the
   loop still running flat out. */
export function getRenderStats() {
  const { render, memory, programs } = renderer.info;
  return {
    frame: render.frame,
    calls: render.calls,
    triangles: render.triangles,
    lines: render.lines,
    points: render.points,
    geometries: memory.geometries,
    textures: memory.textures,
    programs: programs ? programs.length : 0,
    /* Not from renderer.info — this module's own procedural IBL cache, which is
       the one pool of VRAM here that grows with USE rather than with content. */
    envCacheSize: envCache.size,
  };
}

const clock = new THREE.Clock();

/**
 * Is something still MOVING, as opposed to merely having moved?
 *
 * The whole predicate in one place, so there is exactly one list to audit when a
 * new animated source appears. Every term is a continuous source: while any of
 * them is true the loop draws unconditionally, which is what keeps the dirty
 * loop from ever having to guess how long an animation lasts.
 *
 *   tweenT < 1        a preset/hour crossfade, ~0.8 s of lerped rig per change.
 *   rig.rain          weather.ts's rain and ripples advance their own uTime from
 *                     the frame hook. Read off the RIG rather than asking
 *                     weather.ts, which would invert an import edge (see the
 *                     acyclicity note at the top) — and `rig.rain` is the exact
 *                     value weather.ts clamps into its own `amount`, so the two
 *                     cannot drift. The 0.02 threshold is weather.ts's own.
 *   the dome          skyU.uTime scrolls the cloud fbm. The shader's cloud
 *                     branch is itself gated on `uCloud > 0.01`, so the same
 *                     test here is not a tolerance, it is the identical
 *                     condition: below it the dome is provably static and uTime
 *                     changes nothing. That is what makes BOTH shipped scenarios
 *                     idle — `armazem` has no HDRI and therefore does show the
 *                     procedural dome, but its `estudio` preset is cloudiness 0.
 *   autoRotate        ui/chrome.ts's "girar" button writes controls.autoRotate
 *                     directly, with no scene.ts wrapper to hook. Reading the
 *                     flag instead of being told about it means that button
 *                     needs no wiring at all and cannot be forgotten.
 */
function wantsFrame(): boolean {
  if (tweenT < 1) return true;
  if (rigCur && rigCur.rain > 0.02) return true;
  if (skyDome && skyDome.visible && skyU.uCloud.value > 0.01) return true;
  return controls.autoRotate;
}

export function stopLoop() {
  renderer.setAnimationLoop(null);
}

export function startLoop() {
  /* A mount must always paint, whatever the studio was doing when it was
     detached — and capture.ts restarts the loop after a screenshot, where the
     restored viewport is the frame that has to land. */
  invalidate();
  renderer.setAnimationLoop(() => {
    /* A backgrounded tab returns one huge dt, which would complete every tween
       in a single frame (a visible jump) and teleport the rain field. */
    const dt = Math.min(clock.getDelta(), 0.1);
    /* ANTES de controls.update(): o desvio das construções deixa a câmera numa
       posição ENCOLHIDA para desenhar, e o OrbitControls lê `camera.position`
       para saber onde a órbita está. Sem desfazer a correção aqui ele a leria
       como se fosse a que o usuário pediu e a incorporaria — a aproximação
       forçada por um galpão viraria permanente, e o arrasto passaria a disputar
       com ela (foi assim que a versão por expulsão travava a câmera). */
    releaseAvoidance();
    /* Returns true while the camera is still being transformed — a drag, inertia
       from `enableDamping`, a zoom, autoRotate. This is the ONLY signal that
       says "damping has not settled yet", and it is why the dirty loop does not
       need to know how long inertia takes. */
    if (controls.update()) invalidate();
    // hard floor guard — right-click panning can otherwise drag under the ground
    if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
    if (controls.target.y < 0.05) controls.target.y = 0.05;
    // dynamic near plane: close-ups must not slice geometry (near ~0.03 when
    // zoomed in), while far views keep depth precision (near grows with range)
    const dist = camera.position.distanceTo(controls.target);
    /* `near` is the dominant term in depth resolution — halving it halves the
       precision everywhere. The old floor of 0.03 was sized for a camera that
       could be anywhere; setVehicleFocus() now keeps it at least ~2.9 m from
       the rig centre, so nothing is ever within 0.08 m of the lens and the
       floor can rise. That alone is a 2.7x gain on every millimetre-scale
       clearance in the implement. */
    const near = THREE.MathUtils.clamp(dist / 40, 0.08, 0.5);
    if (Math.abs(near - camera.near) > near * 0.15) {
      camera.near = near;
      camera.updateProjectionMatrix();
      invalidate();
    }
    /* Decided BEFORE updateLighting(), which is what closes a finishing tween:
       the frame that takes tweenT from 0.98 to 1.0 is a frame that has to be
       drawn, and asking afterwards would skip it. */
    const draw = !onDemand || dirtyFrames > 0 || wantsFrame();

    updateLighting(dt);
    for (const fn of frameHooks) fn(dt);
    /* Hooks run even on a skipped frame: they are clamps (the interior box, the
       body ejection, the haze shell following the camera) and a state they were
       not allowed to correct would be a state the NEXT drawn frame renders wrong.
       They are a few vector ops, not a draw call. */

    /* DEPOIS dos hooks: eles são os donos da posição verdadeira (a caixa do
       interior, a expulsão da carroceria), e corrigir antes deles seria corrigir
       uma posição que ainda vai mudar. Roda também em quadro pulado — a
       suavização anda com o RELÓGIO, e pular a atualização faria a correção
       saltar de uma vez quando o desenho voltasse. */
    applyAvoidance(dt);

    /* Checked AFTER the hooks and BEFORE the dirty counter is spent: a frame
       skipped because the scene graph is deliberately wrong must not consume the
       invalidation that was asking for a correct one. */
    if (drawSuspended > 0) return;
    if (!draw) return;
    if (dirtyFrames > 0) dirtyFrames--;
    /* Pay the deferred shadow refresh a light scrub skipped — see shadowStale.
       Here rather than in applyRig() because "the drag is over" is a fact about
       the CLOCK, and applyRig() has stopped being called by the time it is
       true. */
    if (shadowStale && performance.now() > scrubUntil) {
      renderer.shadowMap.needsUpdate = true;
      shadowStale = false;
    }
    renderer.render(scene, camera);
  });
}
