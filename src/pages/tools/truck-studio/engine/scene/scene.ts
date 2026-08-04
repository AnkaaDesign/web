/* Renderer, scene, camera, controls, the procedural road environment, the
   weather/time-of-day light rig, and the render loop.
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
   EXTERNAL ENVIRONMENTS (environment.js)

   environment.js can hand this module a photoreal HDRI. When it does, ONE
   module-level flag (`externalEnv`) flips and the procedural path stops writing
   `scene.background` / `scene.environment` — and ONLY those two. Everything
   else the rig drives (lights, fog, exposure, wetness, lamps, stars, the paint
   uniforms) keeps working exactly as before, so the preset buttons and the
   light sliders remain live over an HDRI. Every guarded assignment carries a
   `GUARD:` comment saying why. The flag is cleared by
   `setExternalEnvironment(null)`, which also rebuilds the procedural PMREM.

   ---------------------------------------------------------------------------
   NEAR FIELD OVER A PHOTOGRAPH

   Once environment.js ground-projects the HDRI, the ground under the truck is
   a photograph, and three things follow that this module has to provide:

   * `setShadowCatcher()` — a ShadowMaterial plane at y = 0, because a photo
     cannot receive a shadow and a truck without one is a cut-out.
   * the key light's shadow camera had to grow from ±14 m to ±24 m to cover
     that plane; the resolution note is at the declaration.
   * `setLamps()` — poles are the one bit of CG furniture every scene still
     wants, so they are no longer road furniture that `setRoadVisible(false)`
     takes away. The SpotLight pool is a FIXED size; see that section for why
     the count can never become per-environment data.

   ---------------------------------------------------------------------------
   TWO GROUND BANDS, AND THE SEAM BETWEEN THEM

   Projecting a panorama onto a floor has a hard resolution ceiling. A texel
   row covers Δd = Δθ·(h² + d²)/h metres of ground at distance d, so for a
   1.7 m camera height and a 4k background that is 1.1 cm/texel at 3 m but
   35 cm/texel at 20 m — and the rig is 16 m long. Pushed close enough to be
   sharp, the projection also smears every vertical surface radially. Pushed
   far enough not to smear, everything near the truck is mush. There is no
   radius that solves both, which is why the first attempt at "closer" came
   back as "now the scenes are blurred close".

   The standard split is therefore two bands:

     far field   the projected photograph, at a radius where its angular
                 resolution is genuinely adequate (environment.js owns it)
     near field  REAL CG GROUND — `setNearGround()` below — tiled 2k PBR,
                 which at a 3 m tile carries far more detail per metre than
                 any panorama can
     the seam    a radial alpha dissolve from the CG band into the projected
                 floor

   The seam is the whole trick, and its blend state is not negotiable:

     * the near ground is `transparent: true`, so it lands in the TRANSPARENT
       queue and is therefore drawn after every opaque object — including the
       dome, which environment.js parks at renderOrder −1.
     * `depthWrite: false`, so the faded band cannot punch a hole in the photo
       behind it. This costs nothing that was not already lost: GroundedSkybox
       is itself `depthWrite: false`, so a grounded scene's ground has never
       written depth.
     * no fragment is ever blended twice. The bands used to guarantee that by
       being disjoint in x, with one deliberate 45 cm strip of overlap where
       the asphalt dissolves laterally into the verge. `edgeNoise` widened that
       overlap to metres, so the guarantee is now an identity in the shader
       instead: the verge carries the exact complement of the road's coverage,
       and the two composite to precisely the radial alpha at every fragment.
       See the near-field section for the algebra.
     * `fog: false`, for the same reason the dome sets it: the CG band ends
       55–80 m out, where Neblina's fog would be 40–60 % of the way to a flat
       preset grey while the unfogged photo two millimetres beyond it is not.
       Any fog at all IS the visible ring.

   `setMacroVariation()` used to be an assetless-fallback nicety. It is now
   load-bearing: a 3 m tile across a 55 m disc is 18 repeats, which the eye
   locks onto as a checkerboard long before the fade hides it.

   There are no instanced "grass blade" quads any more; see makeGrassCanvas()
   for what replaced them and why.

   ---------------------------------------------------------------------------
   ORGANIC, NOT STATIC

   A perfectly flat plane with a perfectly straight material boundary reads as
   CG however good the texture on it is, because the giveaway is the SHAPE, not
   the pixels. Three things answer that, and setNearGround() takes all three as
   manifest data:

     edgeNoise   the asphalt/verge boundary wanders with a 1-D fbm in z instead
                 of being a line. It is the highest-impact of the three, and it
                 forced the band overlap to grow — see the near-field section
                 for the complement alpha that repays the double blend.
     wear        verge grit creeping onto the asphalt, and darkened, polished
                 wheel tracks on the same RUTS lanes the puddle mask uses.
     undulation  a few centimetres of low-frequency height, baked into a
                 subdivided grid. Zero under the rig's footprint, because
                 models.js grounds the truck at y = 0 and knows nothing about
                 this surface, and zero across the dissolve, because the
                 photographed floor it hands over to is flat.

   Real geometry standing on the ground (grass tufts, rocks, debris) is the
   fourth and biggest answer, and it is scatter.js's, not this module's.

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
   resort — it is what `rodovia` and `patio-logistico` ship, because the only
   CC0 street lamp available is a 3.87 m ornate cast-iron park lantern and
   stretching it to a 9 m motorway mounting height is exactly the artefact the
   user reported. Height is per-scene data with an inverse-square intensity
   compensation; see the street-lamp section for all of it.
*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setKeyLight } from '../vehicle/paint';
import { $ } from '../core/dom';
import {
  canvasTex, ctx2d, makeAsphaltCanvas, makePuddleCanvas, makeGrassCanvas,
  makeGravelCanvas, makeMacroCanvas,
} from './textures';
import { skyU, makeSkyDome, makeStars } from './sky';
import {
  lampUnits, lampModelEmissive, makeLamps, applyLampLayout, setLampRigRefresh,
  getLampLensMat, getLampIntensityScale, getLampInfo,
} from './lamps';
import { LIGHT_PRESETS, RIG_BASE, COLOR_FIELDS, NUM_FIELDS, makeRig } from './presets';
import type { Rig } from './presets';
import { getPlateExposure } from './plate';

/* Re-exported so the engine's public surface is unchanged by the split:
   environment.ts and ui/hud.ts import all of these from this module. */
export { LIGHT_PRESETS, PRESET_ORDER } from './presets';
export { setLamps, setLampModel } from './lamps';
export { preparePlateMaterial } from './plate';

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
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // shadow.radius only works with PCFSoft

/* THE SHADOW MAP IS NOT REDRAWN EVERY FRAME.
   ---------------------------------------------------------------------------
   The key light is DIRECTIONAL and its shadow camera is a fixed ortho box about
   the origin, so the depth map depends only on the light's angle and on the
   geometry — NOT on where the viewer is. Left on autoUpdate, three re-rendered
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
export function invalidateShadows() { renderer.shadowMap.needsUpdate = true; }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
holder.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
/* Held as a module-level instance rather than an anonymous literal: applyRig()
   mutates it in place, and setExternalEnvironment(null) has to be able to hand
   `scene.background` back to it after an HDRI (a Texture) has been released. */
const bgColor = new THREE.Color(0xb8d8f5);
scene.background = bgColor;
/* FogExp2 for every preset: switching fog TYPE would flip #define FOG_EXP2 and
   recompile everything, and exponential falloff is what sells near-field mist.
   density ≈ 1.978 / visibility_metres (98 % opaque at that distance). */
scene.fog = new THREE.FogExp2(0xb8d8f5, 0.0028);

export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camera.position.set(14, 6, 18);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02;      // never orbit below the horizon

const CAM_MIN_Y = 0.15;                            // pan guard: camera stays above ground

/* ---------------- frame / rig hooks ----------------
   weather.js registers here instead of scene.js importing it, which would be a
   cycle (weather needs `scene`, `camera` and the render loop). */
const frameHooks: ((dt: number) => void)[] = [];
const rigHooks: ((rig: Rig) => void)[] = [];
export function onFrame(fn: (dt: number) => void) { frameHooks.push(fn); }
export function onRig(fn: (rig: Rig) => void) { rigHooks.push(fn); if (rigCur) fn(rigCur); }

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

/* cool counter-light from behind: separates the bodywork from the sky and
   gives the metallic flanks something to catch */
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
scene.add(rim);

/* sky/ground bounce + a floor of ambient so nothing is ever pure black */
const hemi = new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.35);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x6f7d90, 0.10);
scene.add(ambient);




/* ---------------- road environment ---------------- */
/* The manifest authors ground `repeat` for the road strip and nothing else, so
   these are the numbers setGroundMaps() re-derives every other tiling from. */
const ROAD_W = 12, ROAD_L = 340;
const PLANE_W = 700;

/* `blades` is kept as a permanently-null slot rather than deleted: it is part
   of getRoadMaterials()'s published shape and callers destructure it. */
/* `asphalt` and `grass` are seeded null but written by buildRoad() — the IIFE
   immediately below — before anything can read them, so they are typed non-null
   rather than `| null`; the alternative is a guard on every ground-material
   loop in the module for a state no reader can observe. */
const road = {
  asphalt: null! as THREE.MeshStandardMaterial,
  shoulders: [] as THREE.MeshStandardMaterial[],
  grass: null! as THREE.MeshStandardMaterial,
  blades: null,
};
/* Object handles kept for the visibility toggles environment.js drives. They
   used to be anonymous locals inside buildRoad(). */
/* Same argument as `road` above: every one of these is written by buildRoad()
   at module load, so they carry definite assignment instead of `| null`. */
let roadGroup!: THREE.Group, skyDome!: THREE.Mesh, starsMesh!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>, lampGroup!: THREE.Group;
let roadStrip!: THREE.Mesh, groundPlane!: THREE.Mesh;
const shoulderMeshes: THREE.Mesh[] = [];
/* [width, length] in metres of each retexturable ground surface, keyed by its
   material — setGroundMaps() re-derives tiling from these */
const groundSize = new Map<THREE.MeshStandardMaterial, [number, number]>();
/* built once, on the first wet preset; see puddleSpec */
let puddleCanvas: HTMLCanvasElement | null = null;

(function buildRoad() {
  const g = new THREE.Group();

  /* 700 m instead of 400: the old plane's 283 m corners were only ~86 % fogged
     and the diagonal edge could be spotted; at 700 the corners (495 m) sit well
     behind the 340 m dome, which occludes them. It is still two triangles. */
  const grassMat = new THREE.MeshStandardMaterial({
    map: canvasTex(makeGrassCanvas(), 88, 88), roughness: 1, metalness: 0,
  });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_W), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.03;
  grass.receiveShadow = true;
  g.add(grass);
  road.grass = grassMat;
  groundPlane = grass;
  groundSize.set(grassMat, [PLANE_W, PLANE_W]);

  for (const side of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({
      map: canvasTex(makeGravelCanvas(), 2, 160), roughness: 1, metalness: 0,
    });
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 340), mat);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * 7.0, -0.02, 0);
    shoulder.receiveShadow = true;
    g.add(shoulder);
    road.shoulders.push(mat);
    shoulderMeshes.push(shoulder);
    groundSize.set(mat, [2.2, ROAD_L]);
  }

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: canvasTex(makeAsphaltCanvas(true), 1, 28), roughness: 0.95, metalness: 0,
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L), asphaltMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = -0.01;
  strip.receiveShadow = true;
  g.add(strip);
  road.asphalt = asphaltMat;
  roadStrip = strip;
  groundSize.set(asphaltMat, [ROAD_W, ROAD_L]);

  skyDome = makeSkyDome();
  g.add(skyDome);
  starsMesh = makeStars();
  g.add(starsMesh);
  scene.add(g);
  roadGroup = g;

  /* Lamps hang off the SCENE, not the road group. They stopped being road
     furniture the moment the yard scene needed poles without a road, and the
     structural split is what guarantees setRoadVisible() can never reach
     them again by accident. */
  lampGroup = makeLamps();
  scene.add(lampGroup);
  applyLampLayout();
})();

/* ---------------- near-field CG ground ----------------
   The band between the truck and the projected photograph. See the module
   header for why it exists and what the blend state has to be; this section is
   the geometry and the material set.

   SHAPE. It is not a disc. Three axis-aligned quads —

       verge-left | road | verge-right          (or ONE quad when verge is null)

   — spanning a square of side 2·(radius + fade), and the radial alpha term
   `1 − smoothstep(radius, radius + fade, |xz|)` carves the disc out of them at
   shading time. Three reasons that beats a CircleGeometry + RingGeometry pair:

     * the bands are DISJOINT in x, so no fragment is blended twice. Stacking a
       fading grass ring under a fading asphalt strip would tint the road's
       dissolve green at a(1−a) — peaking at 25 % right in the middle of the
       seam, which is exactly where nothing may be wrong.
     * a quad's varyings interpolate exactly, so the radial fade is per-fragment
       correct with FOUR vertices per band. Tessellating a ring buys nothing.
     * the square's corners (|xz| = 1.41·R) are outside the fade, so they cost
       one alpha-zero fragment each and draw nothing. 21 % overdraw at the very
       edge of the frame is cheaper than the vertex count and the UV seam a
       circle+ring would need.

   UVs ARE WORLD METRES, written straight from the position attribute. The
   tiling is then a plain texture.repeat of 1/metresPerTile, identical on every
   band, so the grain runs continuously from the road across the verge instead
   of stepping at the boundary — which is what PlaneGeometry's 0..1 UVs would
   have done. It also means the geometry has to be rebuilt when the radius
   changes (baked UVs cannot be scaled), which is fine: it is one grid, once per
   environment switch.

   ---------------------------------------------------------------------------
   THE BOUNDARY WANDERS, AND THE DISJOINTNESS ARGUMENT ABOVE HAD TO BE REPAID

   A dead-straight asphalt/verge line is the most CG thing left in the near
   field, so `edgeNoise` moves the boundary back and forth with a 1-D fbm in z.
   The consequence is structural: the road band's geometry has to reach
   `amplitude + blend` PAST the nominal edge to cover the outward excursions,
   and the verge has to start the same distance INSIDE it to cover the inward
   ones, so the deliberate 45 cm overlap becomes a 2·(amplitude + blend) one.

   That is exactly the double-blend the shape note above rules out — two
   partially transparent layers stacked inside the dissolve ring composite to
   f + f·s·(1 − f) of CG coverage instead of f, i.e. a denser arc where the road
   edge crosses the seam. So the verge does not simply fade: it carries the
   EXACT COMPLEMENT. With the road at alpha f·s, the only verge alpha that makes
   src-over land on exactly f is

       a_verge = f·(1 − s) / (1 − f·s)

   which is 1 wherever the band is opaque (f = 1, any s), 0 where the road fully
   covers it, and reduces to f where there is no road strip at all. The
   invariant the disjoint bands used to give for free is now an identity in the
   shader, and it holds for ANY overlap width — which is what buys the wander.

   ---------------------------------------------------------------------------
   UNDULATION, AND THE TWO PLACES IT MUST BE EXACTLY ZERO

   The band is displaced by a low-frequency value fbm, baked into the vertices
   at build time (not a vertex-shader displacement: normals have to follow, and
   computeVertexNormals() on a 7 k-vertex grid once per environment switch is
   cheaper and more correct than deriving them per frame). Two masks:

     * THE RIG FOOTPRINT. Displacement is forced to 0 inside a box around the
       origin big enough for the whole tractor-trailer, ramping in over
       RIG_FLAT_RAMP metres. The truck is grounded at y = 0 by models.js and
       knows nothing about this surface — lift the ground under it and the
       wheels float, which is worse than a flat plane by any measure.
     * THE SEAM. It also goes to 0 across the dissolve band, so where the CG
       ground hands over to the projected photograph the two floors are the same
       flat y = 0 plane. The shadow catcher is flat too, and this is what keeps
       all three in agreement. */
const NEAR_Y = 0.002;                 // 2 mm: see setNearGround()
const NEAR_TILE_DEFAULT = 3;          // metres per texture tile
const NEAR_EDGE_BLEND = 0.45;         // metres of asphalt → verge lateral dissolve
const NEAR_ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 8);

/* THE FLAT ZONE. models.js parks the cab at z ∈ [0, ~6] and hangs the trailer
   back toward −Z from a kingpin at z ≈ 2.65, so the rig lives inside roughly
   x ∈ ±1.4, z ∈ [−12, 6]. These are those numbers rounded outward — a metre of
   margin on the widest tyre and a symmetric z so nothing depends on which way
   the trailer was hitched — and they are deliberately generous: a few extra
   square metres of flat ground costs nothing, a floating wheel costs the shot.
   The ramp is long (7 m) because the eye reads a crease far more easily than it
   reads a slope. */
const RIG_FLAT_X = 2.6, RIG_FLAT_Z = 12.5, RIG_FLAT_RAMP = 7;

/* Shared by every patched near-ground material. Parked so the fade is a no-op
   and there is NO road strip until setNearGround() writes real numbers — the
   edge sits at −1e4, i.e. every fragment is verge (see tsRoadDist). */
const nearU = {
  uNearIn: { value: 1e6 },
  uNearOut: { value: 1e6 + 1 },
  /* x = half the carriageway width in metres, y = the lateral blend. A
     NEGATIVE x means "there is no road strip", which is how tsRoadDist() is
     switched off; −1e4 rather than −1e6 because the far edge of the biggest
     legal disc is ~570 m out and a driver forced to mediump would overflow on
     the larger sentinel. */
  uNearEdge: { value: new THREE.Vector2(-1e4, NEAR_EDGE_BLEND) },
  /* x = metres the boundary wanders (0 disables), y = 1/period in metres */
  uEdgeNoise: { value: new THREE.Vector2(0, 1 / 7) },
  /* x = wear strength 0..1, y = metres of verge grime creeping onto the road */
  uWear: { value: new THREE.Vector2(0, 2.2) },
};

/* The baked-undulation manifest displaceNear()/nearBand() take: `amp` metres of
   height, `inv` 1/period, `cell` the grid step, `inner`/`outer` the dissolve. */
interface NearUndul {
  amp: number; inv: number; cell: number; inner: number; outer: number;
}

/* Written by buildNearGround() below, an IIFE at module load — definite
   assignment for the same reason the road handles carry it. */
let nearGroup!: THREE.Group;
let nearBaseMat!: THREE.MeshStandardMaterial, nearRoadMat!: THREE.MeshStandardMaterial;
const nearMeshes: THREE.Mesh[] = [];  // every mesh currently in nearGroup
let nearOn = false;                   // is the band on screen?
let setGroundOn = false;              // is a 3D set supplying the floor? (setSetGround)
let nearOpaqueR = 0;                  // metres of FULLY opaque CG ground
let nearGeoKey = '';                  // rebuild guard
let nearUndulation: { amplitude: number; scale: number } | null = null;            // { amplitude, scale } | null, for the debug handle

function makeNearMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0,
    /* THE SEAM, in four flags. transparent ⇒ the transparent queue, i.e. after
       every opaque object including the dome. depthWrite:false ⇒ the faded band
       cannot punch a hole in the photograph behind it (and matches
       GroundedSkybox, which is depthWrite:false too, so nothing regresses).
       depthTest stays ON so the truck still occludes the ground. fog:false
       because a fogged CG band meeting an unfogged photo IS the visible ring —
       same call environment.js makes for the dome, for the same reason. */
    transparent: true, depthWrite: false, fog: false,
  });
}

(function buildNearGround() {
  nearGroup = new THREE.Group();
  nearGroup.position.y = NEAR_Y;
  nearGroup.visible = false;
  nearBaseMat = makeNearMaterial();
  nearRoadMat = makeNearMaterial();
  scene.add(nearGroup);
})();

/* Rewrite a flat geometry's UVs as WORLD METRES of x/z. Called after the
   rotate+translate, so position.xz already is world xz (the group only offsets
   y and is never scaled). */
function uvWorldMetres(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  uv.needsUpdate = true;
  return geo;
}

/* Deterministic value noise for the undulation. It is the CPU twin of the
   shader's tsNoise/tsFbm in spirit but NOT bit-identical to it, and nothing
   compares the two: this one shapes geometry, that one shapes a mask. What it
   does have to be is seedless-deterministic — the same environment must rebuild
   to the same hills, so `Math.random()` is not an option here any more than it
   is in the scatter module. */
function nHash(ix: number, iz: number) {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function nVal(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = nHash(ix, iz), b = nHash(ix + 1, iz);
  const c = nHash(ix, iz + 1), d = nHash(ix + 1, iz + 1);
  const lo = a + (b - a) * fx;
  return lo + ((c + (d - c) * fx) - lo) * fz;
}
function nFbm(x: number, z: number) {
  return nVal(x, z) * 0.58
    + nVal(x * 2.17 + 5.3, z * 2.17 - 1.7) * 0.28
    + nVal(x * 4.31 - 3.1, z * 4.31 + 7.9) * 0.14;
}
const smooth01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/* Bake the undulation into a band's vertices, then rebuild its normals.
   `u` is { amp, inv, inner, outer } — see the section header for the two masks
   and why each one has to reach exactly zero. */
function displaceNear(geo: THREE.BufferGeometry, u: NearUndul) {
  const p = geo.attributes.position;
  const span = Math.max(u.outer - u.inner, 0.001);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    /* flat under the rig, or the wheels float */
    let w = smooth01((Math.max(Math.abs(x) - RIG_FLAT_X, Math.abs(z) - RIG_FLAT_Z)) / RIG_FLAT_RAMP);
    if (w > 0) {
      /* flat again at the seam, so the CG floor and the photographed floor meet
         on exactly the same plane */
      w *= 1 - smooth01((Math.hypot(x, z) - u.inner) / span);
      if (w > 0) p.setY(i, u.amp * (nFbm(x * u.inv, z * u.inv) - 0.5) * 2 * w);
    }
  }
  p.needsUpdate = true;
  /* The bands are separate meshes, so their vertex normals are averaged within
     a band only. The displacement is a pure function of world xz and every band
     shares the same z lattice, so the worst disagreement across the overlap is
     the interpolation error of the fbm over one cell — sub-centimetre at these
     amplitudes, inside a cross-fade, at 10 m+. */
  geo.computeVertexNormals();
}

function nearBand(width: number, length: number, cx: number, u: NearUndul | null) {
  /* One quad unless the surface is actually being displaced. The radial and
     lateral dissolves are per-fragment and a quad's varyings interpolate
     exactly, so tessellation buys NOTHING for them — it is bought here only to
     carry the undulation, and its cell size follows the undulation's period so
     a short wavelength is not sampled into a faceted mess. */
  const segX = u ? THREE.MathUtils.clamp(Math.round(width / u.cell), 1, 200) : 1;
  const segZ = u ? THREE.MathUtils.clamp(Math.round(length / u.cell), 1, 200) : 1;
  const g = new THREE.PlaneGeometry(width, length, segX, segZ);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, 0, 0);
  uvWorldMetres(g);
  if (u) displaceNear(g, u);
  return g;
}

/** The shape argument of rebuildNearGeometry(), spelled out for the checker. */
interface NearShape {
  outer: number; hasVerge: boolean; roadW: number; overlap: number;
  undul: NearUndul | null;
}

/* Tear the bands down and rebuild them for a new shape.
 * @param {{outer, hasVerge, roadW, overlap, undul}} shape
 *        `overlap` is how far the road band reaches past its nominal edge and
 *        how far the verge reaches inside it — amplitude + blend, so the noisy
 *        boundary always has real geometry on both sides of every excursion.
 */
function rebuildNearGeometry(shape: NearShape) {
  for (const m of nearMeshes) {
    nearGroup.remove(m);
    m.geometry.dispose();               // the MATERIALS are module-owned; keep
  }
  nearMeshes.length = 0;

  const { outer, hasVerge, roadW, overlap, undul } = shape;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, order: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = order;           // road always over verge; both after the dome
    mesh.receiveShadow = true;          // re-decided by syncGroundReceivers()
    /* castShadow deliberately untouched (Mesh defaults to false): ground that
       casts onto itself is shadow acne, and the key light's castShadow is the
       one flag this module never flips. */
    mesh.frustumCulled = false;         // the camera is always standing on it
    nearGroup.add(mesh);
    nearMeshes.push(mesh);
  };

  if (!hasVerge) {
    add(nearBand(outer * 2, outer * 2, 0, undul), nearBaseMat, 1);
    return;
  }
  const halfW = roadW / 2;
  /* The verge reaches `overlap` under the road and the road reaches `overlap`
     over the verge, so wherever the noisy boundary lands there is opaque verge
     under it and road geometry over it. The double-coverage that creates is
     paid for exactly by the complement alpha — see the section header. */
  const inner = Math.max(0.05, halfW - overlap);
  const roadHalf = Math.min(outer, halfW + overlap);
  const vw = Math.max(0.1, outer - inner);
  add(nearBand(vw, outer * 2, inner + vw / 2, undul), nearBaseMat, 1);
  add(nearBand(vw, outer * 2, -(inner + vw / 2), undul), nearBaseMat, 1);
  add(nearBand(roadHalf * 2, outer * 2, 0, undul), nearRoadMat, 2);
}

/* remember the dry albedo of every ground material so wetness is reversible */
const GROUND_MATS = [
  road.asphalt, road.grass, ...road.shoulders, nearBaseMat, nearRoadMat,
];
const dryColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
for (const m of GROUND_MATS) dryColors.set(m, m.color.clone());

/* Dry end of the roughness lerp, per material. applyWetness() used to hard-code
   0.95; it is a Map now for exactly one reason: setGroundMaps() has to raise it
   to 1.0 when a real roughnessMap takes over, because three MULTIPLIES the
   map's green channel by material.roughness and 0.95 would quietly shave 5 %
   off an authored map. Seeded with 0.95 everywhere so behaviour is unchanged
   until an environment overrides it. */
const dryRough = new Map<THREE.MeshStandardMaterial, number>();
for (const m of GROUND_MATS) dryRough.set(m, 0.95);

/* O reflexo de ambiente do material COM TEMPO SECO. Existe pelo mesmo motivo de
   dryColors e dryRough: applyWetness() é chamada de novo a cada mudança de clima
   e a cada troca de cenário, então ela tem de partir de um estado guardado em
   vez de assumir um. Sem isto, o valor de fábrica (1) vencia o do manifesto do
   cenário. Materiais que entram depois (o chão do set) são registrados em
   resnapshotGround(), que roda DEPOIS de bindMaterials. */
const dryEnv = new Map<THREE.MeshStandardMaterial, number>();
for (const m of GROUND_MATS) dryEnv.set(m, m.envMapIntensity);

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
wetProfile.set(road.asphalt, WET_PROFILE.asphalt);
for (const s of road.shoulders) wetProfile.set(s, WET_PROFILE.gravel);
wetProfile.set(road.grass, WET_PROFILE.grass);
/* Overwritten by setNearGround() from the manifest's material keys; these are
   the neutral defaults for a band that never gets one. */
wetProfile.set(nearBaseMat, WET_PROFILE.gravel);
wetProfile.set(nearRoadMat, WET_PROFILE.asphalt);

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
puddleSpec.set(road.asphalt, { u: 1, v: 5, ox: 0, tex: null });
puddleSpec.set(nearRoadMat, { u: 1 / ROAD_W, v: 1 / 68, ox: 0.5, tex: null });

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

/* ---------------- macro variation + the near-ground dissolve ----------------
   A tiled texture is uniform BY CONSTRUCTION: the asphalt repeats every ~12 m
   and the grass every ~8 m, which the eye locks onto long before the fog hides
   it. That is the "chão consistente demais" complaint, and no amount of
   retexturing fixes it, because the problem is the period, not the pixels.
   The cheap professional answer is a second lookup at a very low frequency in
   WORLD space that MULTIPLIES the albedo: the same 12 m tile is now darker
   here and lighter thirty metres on, and the repeat stops resolving.

   It is no longer a fallback-only nicety. The near ground tiles at 3 m across a
   55 m radius — 18 repeats edge to edge, every one of them inside the frame at
   the distance the user is actually looking. Without this the CG band reads as
   a checkerboard and earns the same verdict the canvas ground did.

   Gated by a uniform, not a #define, so the strength can go to 0 and back
   without a recompile. Each material is patched exactly once.

   ON THE SCALE. "1/40th the detail frequency" is the rule of thumb, but taken
   literally against a 4 m ground tile it gives a 160 m macro tile, and the near
   band is only ~44 m in radius — less than half a cycle across the whole thing,
   i.e. a gradient, not variation. The criterion that actually works is that
   SEVERAL FEATURES must fit inside the visible patch while each stays several
   times the detail tile. The shipped macro_noise is three band-limited octaves
   at 2/4/8 cycles per tile, so a 70 m tile puts features at 35 / 17.5 / 8.75 m:
   against a 4 m detail tile that is 2–9x, and across the near band's ~88 m span
   you see 1.3 cycles of the coarsest and ten of the finest. The 340 m
   procedural road gets 4.9 cycles of the coarsest, which is if anything better
   than the 2.8 it had at 120 m.

   ON THE STRENGTH. The shader is exactly `1 + strength · 0.76 · (n − 0.5)`.
   The built-in canvas noise is near-binary (blobs at 22 and 232 of 255), so
   0.55 there is already a strong modulation. The shipped macro_noise.webp is
   band-limited Gaussian-ish with σ = 0.115, which at the same strength would be
   ±4.8 % at 1σ — invisible. Hence two different numbers: the module-load call
   passes 0.55 explicitly for the canvas, and MACRO_DEFAULT (the value used when
   a caller supplies a texture and omits the strength) is tuned for the real
   asset at ±7.9 % at 1σ and ±20 % at its clipped extremes.

   THE SAME PATCH CARRIES THE SEAM. A material has exactly one onBeforeCompile,
   so the near-ground dissolve cannot be a second, independent patch — it is a
   variant of this one, selected by `kind` and separated in the program cache by
   customProgramCacheKey. */
const MACRO_METRES = 70;                  // world metres per macro tile
const MACRO_CANVAS_STRENGTH = 0.55;       // for the high-contrast built-in noise
const MACRO_DEFAULT = 0.90;               // for a supplied σ≈0.115 macro_noise
const macroU = {
  uMacroMap: { value: null as THREE.Texture | null },
  uMacroStr: { value: 0 },
  uMacroScale: { value: 1 / MACRO_METRES },
};
/* Patch variants. 0 is the procedural ground (macro only); 1 and 2 are the two
   near-ground bands — 1 is the base/verge band, which carries the radial
   dissolve, the COMPLEMENT of the road strip's lateral coverage and the dust
   blown off the carriageway; 2 is the road strip, which carries the radial
   dissolve, the noisy lateral edge and the wear.
   These are the only two consumers, they are always used in that pairing, and
   each material is patched once and forever — so the variant is a property of
   the band, not a per-call option. */
const PATCH_MACRO = 0, PATCH_NEAR = 1, PATCH_NEAR_ROAD = 2;
const patchedGround = new Set<THREE.Material>();
let macroTex: THREE.Texture | null = null;

/* Shared GLSL for both near variants: the uniforms, a value-noise fbm in the
   same shape the sky dome already uses, and the two functions that define where
   the carriageway is. Everything downstream — the edge, the grime, the wheel
   tracks, the complement alpha — is derived from tsRoadDist(), so there is
   exactly ONE definition of "where the road ends" and the two bands cannot
   disagree about it. */
const NEAR_FRAG_HEAD = /* glsl */`
uniform float uNearIn;
uniform float uNearOut;
uniform vec2 uNearEdge;
uniform vec2 uEdgeNoise;
uniform vec2 uWear;
varying vec2 vNearXZ;
vec2 tsWear = vec2( 0.0 );

float tsHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}
float tsNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( tsHash( i ), tsHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( tsHash( i + vec2( 0.0, 1.0 ) ), tsHash( i + vec2( 1.0 ) ), f.x ), f.y );
}
float tsFbm( vec2 p ) {
  return tsNoise( p ) * 0.60 + tsNoise( p * 2.13 ) * 0.26 + tsNoise( p * 4.31 ) * 0.14;
}

/* Metres INTO the carriageway from its edge: positive on the road, negative on
   the verge. The edge is uNearEdge.x displaced by a 1-D fbm in z — a road edge
   is a curve x(z), not a 2-D blob — sampled on a DIFFERENT LANE of the noise
   per side, because one shared lookup would slide the whole strip sideways and
   leave it exactly as constant-width as it was before.
   The fbm's practical spread is about ±0.19 around 0.5, so the 2.6 scale plus
   the clamp is what makes the manifest's amplitude mean PEAK metres rather than
   roughly a third of them. */
float tsRoadDist( vec2 xz ) {
  float e = uNearEdge.x;
  if ( uEdgeNoise.x > 0.001 ) {
    float lane = xz.x < 0.0 ? 41.7 : 7.3;
    float n = clamp( ( tsFbm( vec2( xz.y * uEdgeNoise.y, lane ) ) - 0.5 ) * 2.6, -1.0, 1.0 );
    e += uEdgeNoise.x * n;
  }
  return e - abs( xz.x );
}
/* 1 on the carriageway, 0 on the verge, crossing over uNearEdge.y metres. With
   the edge parked negative (no verge authored ⇒ no road strip) this is 0
   everywhere, which is what makes the base band cover the whole disc. */
float tsRoadMask( vec2 xz ) {
  return smoothstep( 0.0, uNearEdge.y, tsRoadDist( xz ) );
}
`;

/* Road-strip wear. Two mechanisms, both anchored to real road behaviour:
     GRIME — dust and grit thrown off the verge by traffic, which lands within a
       metre or two of the edge, is LIGHTER and warmer than asphalt (it is dry
       soil, not oil) and is blotchy rather than a clean band.
     WHEEL TRACKS — the RUTS positions the puddle mask already uses, mirrored
       about the centreline so two gaussians cover all four. Tyres both darken
       (rubber, oil) and POLISH (lower roughness), which is why the tracks are
       the first thing to shine when the road is wet — and why the puddle mask
       pins its blobs to these same lanes. */
const NEAR_FRAG_WEAR_ROAD = /* glsl */`
  {
    float tsD = tsRoadDist( vNearXZ );
    float tsGrime = uWear.x * ( 1.0 - smoothstep( 0.0, max( uWear.y, 0.05 ), tsD ) );
    tsGrime *= clamp( 0.35 + 1.05 * tsFbm( vNearXZ * 0.42 ), 0.0, 1.0 );
    tsGrime = clamp( tsGrime, 0.0, 0.85 );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.46, 1.34, 1.10 ), tsGrime );

    float tsA = clamp( abs( vNearXZ.x ) / max( 2.0 * uNearEdge.x, 0.5 ), 0.0, 1.0 );
    float tsTrk = max( exp( -pow2( ( tsA - 0.13 ) / 0.045 ) ),
                       exp( -pow2( ( tsA - 0.34 ) / 0.045 ) ) );
    tsTrk *= smoothstep( 0.0, 1.2, tsD );                 // tracks stop at the edge
    tsTrk *= 0.55 + 0.60 * tsFbm( vec2( vNearXZ.x * 0.11, vNearXZ.y * 0.042 ) );
    tsTrk = clamp( tsTrk, 0.0, 1.0 ) * uWear.x;
    diffuseColor.rgb *= 1.0 - 0.30 * tsTrk;
    tsWear = vec2( tsGrime, tsTrk );
  }`;

/* The verge's half of the same story: road dust settles on the first metre or
   so of the shoulder. TWO gates, and both are load-bearing: the outer one fades
   the dust out with distance from the edge (and, on a band with no road strip,
   kills it outright — there tsOut is ~+1e4 and the term is 0), the inner one
   kills it under the road, where the band is covered anyway and dusting it
   would only tint what the road strip is dissolving into. */
const NEAR_FRAG_WEAR_VERGE = /* glsl */`
  {
    float tsOut = -tsRoadDist( vNearXZ );
    float tsDust = uWear.x * smoothstep( -0.4, 0.0, tsOut )
      * ( 1.0 - smoothstep( 0.0, 1.4, max( tsOut, 0.0 ) ) );
    tsDust *= clamp( 0.30 + 1.10 * tsFbm( vNearXZ * 0.5 + 19.0 ), 0.0, 1.0 );
    tsDust = clamp( tsDust, 0.0, 0.7 );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.30, 1.24, 1.08 ), tsDust );
    tsWear = vec2( tsDust, 0.0 );
  }`;

/* Wear moves roughness as well as albedo, or it reads as a decal. Dust is matte
   (toward 1), a polished wheel track is not (down 20 %). Injected after
   <roughnessmap_fragment> so it composes with both the authored roughness map
   and the puddle mask applyWetness() swaps in — a wet rut ends up smoother
   still, which is exactly what a wet rut is. */
const NEAR_FRAG_ROUGH = /* glsl */`#include <roughnessmap_fragment>
  roughnessFactor = clamp( mix( roughnessFactor, 1.0, tsWear.x * 0.75 ) * ( 1.0 - 0.20 * tsWear.y ), 0.04, 1.0 );`;


/**
 * Inject the macro multiply — and, for the near-ground variants, the alpha
 * dissolve — into a MeshStandardMaterial. Idempotent: a material is patched at
 * most once, so setMacroVariation() cannot clobber the near ground's variant.
 *
 * @param {THREE.Material} m
 * @param {number} kind PATCH_MACRO | PATCH_NEAR | PATCH_NEAR_ROAD
 */
function patchGround(m: THREE.MeshStandardMaterial, kind: number) {
  if (!m || patchedGround.has(m)) return;
  const near = kind !== PATCH_MACRO;
  m.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMacroMap = macroU.uMacroMap;
    shader.uniforms.uMacroStr = macroU.uMacroStr;
    shader.uniforms.uMacroScale = macroU.uMacroScale;

    let vHead = '#include <common>\nuniform float uMacroScale;\nvarying vec2 vMacroUv;';
    /* After <project_vertex> so `transformed` is final. The instance matrix has
       to be applied by hand — three only folds it in inside that chunk — and
       the branch is kept even though no ground material is instanced today,
       because it costs nothing and the alternative is a silent wrong answer. */
    let vBody = `#include <project_vertex>
  vec4 tsMacroWorld = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    tsMacroWorld = instanceMatrix * tsMacroWorld;
  #endif
  tsMacroWorld = modelMatrix * tsMacroWorld;
  vMacroUv = tsMacroWorld.xz * uMacroScale;`;
    let fHead = '#include <common>\nuniform sampler2D uMacroMap;\nuniform float uMacroStr;\nvarying vec2 vMacroUv;';
    /* rgb only: alpha is the seam's, and it is written further down the chain.
       The wear block is appended for the near variants, so albedo goes
       texture → macro → wear in one replacement of one chunk. */
    let fMacro = `#include <map_fragment>
  {
    float tsMacro = texture2D( uMacroMap, vMacroUv ).g;
    diffuseColor.rgb *= mix( 1.0, 0.62 + 0.76 * tsMacro, uMacroStr );
  }`;

    if (near) {
      shader.uniforms.uNearIn = nearU.uNearIn;
      shader.uniforms.uNearOut = nearU.uNearOut;
      shader.uniforms.uNearEdge = nearU.uNearEdge;
      shader.uniforms.uEdgeNoise = nearU.uEdgeNoise;
      shader.uniforms.uWear = nearU.uWear;
      vHead += '\nvarying vec2 vNearXZ;';
      /* World xz in METRES, unscaled — the radial distance has to be a real
         distance for `radius`/`fade` to mean what the manifest says. */
      vBody += '\n  vNearXZ = tsMacroWorld.xz;';
      fHead += NEAR_FRAG_HEAD;
      fMacro += kind === PATCH_NEAR_ROAD ? NEAR_FRAG_WEAR_ROAD : NEAR_FRAG_WEAR_VERGE;
    }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', vHead)
      .replace('#include <project_vertex>', vBody);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', fHead)
      .replace('#include <map_fragment>', fMacro);

    if (near) {
      /* AFTER <alphatest_fragment>, so a cutout threshold (there is none on the
         ground, but a future one) still tests the material's own alpha rather
         than the seam's, and BEFORE <opaque_fragment>, which is where
         diffuseColor.a becomes gl_FragColor.a. The material is transparent, so
         three does not #define OPAQUE and the alpha survives.
         smoothstep's edges are written low-to-high in both terms: GLSL leaves
         smoothstep(hi, lo, x) undefined, and it silently works on desktop and
         returns garbage on some mobile drivers. */
      const fFade = kind === PATCH_NEAR_ROAD
        ? `#include <alphatest_fragment>
  diffuseColor.a *= ( 1.0 - smoothstep( uNearIn, uNearOut, length( vNearXZ ) ) )
    * tsRoadMask( vNearXZ );`
        /* THE COMPLEMENT. The road strip is drawn over this band at alpha f·s,
           so src-over leaves the photograph a weight of (1 − f·s)(1 − a). The
           only `a` that makes the total CG coverage exactly f — no denser arc
           where the road edge crosses the dissolve, no gap — is
           f(1 − s)/(1 − f·s). It is 1 wherever the band is opaque, 0 where the
           road covers it completely, and collapses to plain f when there is no
           road strip (s ≡ 0). Degenerate only at f = s = 1, where the numerator
           vanishes with the denominator; the max() resolves it to 0, which is
           the right answer there. */
        : `#include <alphatest_fragment>
  {
    float tsF = 1.0 - smoothstep( uNearIn, uNearOut, length( vNearXZ ) );
    float tsS = tsRoadMask( vNearXZ );
    diffuseColor.a *= tsF * ( 1.0 - tsS ) / max( 1.0 - tsF * tsS, 1e-3 );
  }`;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <alphatest_fragment>', fFade)
        .replace('#include <roughnessmap_fragment>', NEAR_FRAG_ROUGH);
    }
  };
  /* Programs are shared by cache key, and the default key knows nothing about
     onBeforeCompile — without this an unpatched MeshStandardMaterial with the
     same parameters could be handed the patched program, or the reverse. The
     three variants must not share either. */
  m.customProgramCacheKey = () => 'ts-ground-' + kind;
  m.needsUpdate = true;
  patchedGround.add(m);
}

/* The near-ground bands need their dissolve whether or not macro variation is
   ever switched on, so they are patched eagerly and setMacroVariation()'s lazy
   pass then skips them (patchGround is idempotent). */
patchGround(nearBaseMat, PATCH_NEAR);
patchGround(nearRoadMat, PATCH_NEAR_ROAD);

/**
 * Large-scale albedo break-up for every ground material: the procedural road,
 * shoulders and 700 m plane, AND both near-ground bands including the verge.
 * Has no effect on a ground-projected photograph, whose ground is not this
 * geometry.
 *
 * @param {THREE.Texture|null} texture  greyscale, tileable; null uses the
 *        built-in blob noise
 * @param {number} [strength] 0..1. OMITTED ⇒ MACRO_DEFAULT, i.e. supplying a
 *        texture turns it ON — a 4 m tile repeated 13 times across a 26 m
 *        radius is not an opt-in problem. Pass 0 explicitly to disable. See the
 *        section header for why the right number depends on the texture's
 *        contrast.
 * @param {number} [metresPerTile] world metres per macro tile; defaults to
 *        MACRO_METRES. Exposed because the right value follows the SIZE OF THE
 *        VISIBLE PATCH, which is manifest data (`nearGround.radius` has already
 *        moved from 55 to 26 once).
 */
export function setMacroVariation(
  texture: THREE.Texture | null, strength?: number, metresPerTile?: number,
) {
  const s = THREE.MathUtils.clamp(
    strength === undefined ? MACRO_DEFAULT : (Number.isFinite(+strength) ? +strength : 0), 0, 1);
  const mpt = Number.isFinite(+metresPerTile!) && +metresPerTile! > 0
    ? THREE.MathUtils.clamp(+metresPerTile!, 4, 2000) : MACRO_METRES;
  macroU.uMacroScale.value = 1 / mpt;
  let tex = (texture && texture.isTexture) ? texture : null;
  if (!tex && s > 0) {
    if (!macroTex) macroTex = canvasTex(makeMacroCanvas(), 1, 1, THREE.NoColorSpace);
    tex = macroTex;
  }
  if (s > 0) for (const m of GROUND_MATS) patchGround(m, PATCH_MACRO);
  if (tex) {
    /* We sample with our own world-space UV, so texture.repeat/offset are
       bypassed entirely — only the wrap mode matters. */
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    macroU.uMacroMap.value = tex;
  }
  macroU.uMacroStr.value = macroU.uMacroMap.value ? s : 0;
}

/* ON BY DEFAULT, at module load, with the built-in blob noise — so it is
   already running before any environment is applied and there is no first-frame
   state where the ground tiles visibly. environment.js may hand over the real
   macro_noise.webp later; that is a texture swap, not an enable, and it should
   omit the strength so MACRO_DEFAULT (tuned for that asset's contrast, which is
   much lower than this canvas's) applies. */
setMacroVariation(null, MACRO_CANVAS_STRENGTH);


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
   an hour change; hud.js does. */
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
   presetDefaults() and every pre-clock caller still do, and hud.js lights its
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
const SCENE_KEY = 'truckstudio.scene.v3';
for (const old of ['truckstudio.scene.v1', 'truckstudio.scene.v2']) {
  try { localStorage.removeItem(old); } catch (_) { /* ignore */ }
}

export const LIGHT_DEFAULTS = {
  preset: 'ensolarado', timeOfDay: 'dia' as TimeOfDay, hour: TOD_HOUR.dia,
  /* az/el are DERIVED from `hour`; these are just what the clock says at noon.
     They stop being derived the moment one of the flags below goes true — see
     syncSunToHour() for the full override policy. */
  az: sunAngles(TOD_HOUR.dia).az, el: sunAngles(TOD_HOUR.dia).el, brightness: 1,
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
    localStorage.setItem(SCENE_KEY, JSON.stringify({ v: 3, ...sceneState }));
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
/* Exported so environment.js can PMREM its HDRIs through the SAME generator: a
   second PMREMGenerator on one renderer duplicates the whole blur/lod-plane
   scratch setup for nothing. */
export const pmrem = new THREE.PMREMGenerator(renderer);
const envCache = new Map<string, THREE.Texture>();
let roomEnv: THREE.Texture | null = null;

/* ---------------- external environment (environment.js) ----------------
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
let roadOn = true;               // procedural asphalt strip + shoulders

/* Cache granularity for the procedural IBL along the clock. buildSkyEnv() reads
   the rig, and the rig is now a continuous crossfade, so keying the cache on
   `dia`/`noite` as before would snap every reflection at one instant halfway
   through dusk — the single place in the transition where a snap is visible,
   since the road is a mirror the moment it is wet. Four steps of nightness is
   the compromise. It cannot be per-frame: each entry is a canvas plus a full
   PMREM mip chain. The cost is bounded — a 512x256 equirect lands on a 128 cube
   (~2 MB), so all six presets fully explored is ~48 MB against the previous
   ~24 MB, and only the dusk band ever builds more than one entry per preset. */
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
  return rt.texture;
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
    if (envCache.has(k)) { scene.environment = envCache.get(k)!; return; }
    let tex: THREE.Texture;
    if (k === 'room') {
      if (!roomEnv) roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      tex = roomEnv;
    } else {
      tex = buildSkyEnv(rig);
    }
    envCache.set(k, tex);
    scene.environment = tex;
  };
  if (immediate) { if (envTimer) { clearTimeout(envTimer); envTimer = 0; } run(); return; }
  if (envTimer) clearTimeout(envTimer);
  envTimer = setTimeout(run, 120);
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

function applyRig(rig: Rig) {
  /* The light is about to move, so the depth map is stale. This is the hot path
     for it — every tween frame lands here — and marking it is one boolean; the
     redraw itself only happens on frames where the pose actually changed. */
  renderer.shadowMap.needsUpdate = true;
  const azr = rig.keyAz * Math.PI / 180;
  const elr = rig.keyEl * Math.PI / 180;
  const r = 26;
  key.position.set(
    r * Math.cos(elr) * Math.sin(azr),
    Math.max(1.0, r * Math.sin(elr)),
    r * Math.cos(elr) * Math.cos(azr)
  );
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
  _dirW.copy(key.position).normalize();
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
 */
export function warmLightPrograms() {
  const was = lampsOn;
  try {
    setLampsEnabled(!was);
    renderer.compile(scene, camera);
  } catch (err) {
    console.warn('[truck-studio] pré-compilação da configuração de luz alternativa falhou'
      + ' — a primeira passagem por 18:00 pode engasgar.', err);
  } finally {
    setLampsEnabled(was);
  }
  /* And the configuration we are actually about to render, so the first frame
     after the loader is not a compile either. */
  try { renderer.compile(scene, camera); } catch (_) { /* ignore */ }
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
    _dirW.copy(key.position).normalize();
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
 * it (environment.js applies `envDef.timeOfDay` through it). It is now a
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

/* ---------------- environment hooks (environment.js only) ----------------
   Deliberately thin: environment.js owns the *policy* (which HDRI, which
   textures, caching, disposal); everything here is the minimum mechanism to
   let it drive objects and materials that are private to this module. */

/** Debug/inspection handle for the procedural environment objects + state. */
export function getEnvironmentObjects() {
  return {
    group: roadGroup, skyDome, stars: starsMesh, lamps: lampGroup,
    roadStrip, groundPlane, shadowCatcher, nearGround: nearGroup,
    skyDomeVisible: skyDomeOn, roadVisible: roadOn, external: !!externalEnv,
    nearGroundVisible: nearOn, nearGroundRadius: nearOpaqueR,
    nearGroundFade: Math.max(0, nearU.uNearOut.value - nearU.uNearIn.value),
    nearGroundBands: nearMeshes.length,
    nearGroundVerts: nearMeshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0),
    nearEdgeWander: nearU.uEdgeNoise.value.x,
    nearWear: nearU.uWear.value.x,
    nearUndulation: nearUndulation,
    rigFlatZone: { x: RIG_FLAT_X, z: RIG_FLAT_Z, ramp: RIG_FLAT_RAMP },
    ...getLampInfo(),
    plateExposure: getPlateExposure(),
    shadowHalfExtent: SHADOW_HALF, shadowMapSize: SHADOW_MAP_SIZE,
    macroStrength: macroU.uMacroStr.value,
  };
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
}

/**
 * Show/hide the procedural ROAD. The split, deliberately:
 *   hidden  — asphalt strip (the lane markings are painted into its albedo, so
 *             they go with it) and both gravel shoulders.
 *   kept    — the 700 m ground plane, unless setShadowCatcher() or
 *             setNearGround() has taken the floor over: `showRoad:false` on the
 *             procedural path still needs a shadow receiver or the truck
 *             floats. Retexture it with setGroundMaps({ target:'grass' }).
 *   kept    — the LAMPS, entirely. They used to be hidden here as road
 *             furniture, which is exactly why the yard scene had no poles: a
 *             hardstanding has no road and still has lighting. Poles are
 *             setLamps()'s business now, spotlights are setLampsEnabled()'s,
 *             and neither belongs to the road.
 *
 * NOTE this is the PROCEDURAL road, not the near-ground band. The two are
 * mutually exclusive surfaces: a grounded scene wants setRoadVisible(false)
 * plus setNearGround({...}), because the near band's own road strip is the road
 * and the procedural strip would show through its dissolve. setNearGround()
 * warns if both end up on.
 * @param {boolean} v
 */
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
let interiorBox: { hx: number; hz: number; minY: number; maxY: number } | null = null;
let interiorHooked = false;

/**
 * Confine the camera (and its orbit target) to a box, in world metres.
 * @param {null | {halfX:number, halfZ:number, minY:number, maxY:number}} b
 */
export function setInteriorBounds(
  b: null | { halfX: number; halfZ: number; minY: number; maxY: number },
) {
  interiorBox = b ? {
    hx: Math.max(1, b.halfX), hz: Math.max(1, b.halfZ),
    minY: b.minY, maxY: Math.max(b.minY + 0.5, b.maxY),
  } : null;
  if (!interiorBox || interiorHooked) return;
  interiorHooked = true;
  frameHooks.push(() => {
    const k = interiorBox;
    if (!k) return;
    const c = THREE.MathUtils.clamp;
    camera.position.set(
      c(camera.position.x, -k.hx, k.hx),
      c(camera.position.y, k.minY, k.maxY),
      c(camera.position.z, -k.hz, k.hz));
    /* The target too, or a clamped camera orbiting a target outside the box
       would swing along the wall instead of around the truck. */
    controls.target.set(
      c(controls.target.x, -k.hx, k.hx),
      c(controls.target.y, k.minY, k.maxY),
      c(controls.target.z, -k.hz, k.hz));
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
const FOCUS_MAX_F = 2.60;   // maxDistance, same
const FOCUS_PAN_F = 0.28;   // how far the target may be panned off centre
const FOCUS_SKIN = 0.45;    // metres of clearance kept outside the bodywork
const _fv = new THREE.Vector3();

/** Lock the orbit to a rig. Pass null to release it (no limits). */
export function setVehicleFocus(box: THREE.Box3 | null) {
  if (!box || box.isEmpty()) {
    vehicleFocus = null;
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    return;
  }
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);
  vehicleFocus = { c, box: box.clone().expandByScalar(FOCUS_SKIN), r };
  controls.minDistance = r * FOCUS_MIN_F;
  controls.maxDistance = r * FOCUS_MAX_F;
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
      if (outX <= outZ) p.x = (p.x - b.min.x < b.max.x - p.x) ? b.min.x : b.max.x;
      else p.z = (p.z - b.min.z < b.max.z - p.z) ? b.min.z : b.max.z;
    }
  });
}

export function setRoadVisible(v: boolean) {
  roadOn = !!v;
  if (roadStrip) roadStrip.visible = roadOn;
  for (const m of shoulderMeshes) m.visible = roadOn;
  warnRoadOverlap();
}


/* ---------------- shadow catcher ----------------
   A ground-projected HDRI puts a PHOTOGRAPH under the truck, and a photograph
   cannot receive a shadow — the tyres end up hovering on someone else's
   asphalt. This plane can: ShadowMaterial emits only the shadow term, so where
   nothing occludes the key light it is fully transparent and the photo shows
   through untouched. Built lazily; the procedural fallback never needs it.

   IT IS NOT EXCLUSIVE WITH THE NEAR GROUND ANY MORE, and the manifest is why.
   `nearGround.radius` is 26 / 18 / 22 m in the three shipped scenes while the
   key light's shadow frustum is ±24 m and a 4 m cab at Dourado's 8° elevation
   throws its shadow ~28 m. So a shadow REACHES PAST the CG band's opaque core
   in two scenes out of three: hand the whole job to the band and the shadow
   stops dead at a circle; hand it to the catcher and the band gets a flat black
   overlay instead of a real shaded PBR surface.

   Both, complementary. The band receives for real inside its own alpha, and the
   catcher's opacity is multiplied by EXACTLY the band's inverse —
   `smoothstep(uCatchIn, uCatchOut, r)` against the band's
   `1 − smoothstep(uNearIn, uNearOut, r)` — so the two sum to one everywhere:
   zero catcher inside the opaque core, zero band outside the fade, a crossfade
   between. That is a stronger invariant than "only one receiver": the shadow is
   applied exactly ONCE at every point, and it is continuous across the seam,
   which a hard handover could never be.
   With the ramp deciding WHERE the catcher applies, its `size` only has to
   cover where shadows can exist at all — see setShadowCatcher(). */
/* Genuinely nullable: built lazily by the first setShadowCatcher() that wants
   one, and the procedural fallback never asks. */
let shadowCatcher: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | null = null;
let catcherWanted = false;      // resolved by syncGroundReceivers(), below
let catcherSize = SHADOW_HALF * 2;

/* Parked so that smoothstep(-2, -1, r) is 1 for every r >= 0, i.e. a uniform
   full-strength catcher — bit-for-bit the behaviour before the near ground
   existed, and what the procedural path still gets. */
const catchU = {
  uCatchIn: { value: -2 },
  uCatchOut: { value: -1 },
};

/* ShadowMaterial's shader is tiny and has no chunk to hook the way
   meshphysical does, so the anchor is the single line that writes the output.
   Verified against three 0.179.1 ShaderLib.shadow: the fragment ends in
   `gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );`. */
function patchShadowCatcher(mat: THREE.ShadowMaterial) {
  mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uCatchIn = catchU.uCatchIn;
    shader.uniforms.uCatchOut = catchU.uCatchOut;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCatchXZ;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vCatchXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform float uCatchIn;\nuniform float uCatchOut;\nvarying vec2 vCatchXZ;')
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * smoothstep( uCatchIn, uCatchOut, length( vCatchXZ ) ) );');
  };
  mat.customProgramCacheKey = () => 'ts-catcher';
  mat.needsUpdate = true;
}

function makeShadowCatcher() {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);                     // baked, so scale.xz is metres
  const mat = new THREE.ShadowMaterial({
    color: 0x000000, opacity: 0.42, transparent: true,
    /* An overlay on someone else's floor: it must never occlude anything. */
    depthWrite: false,
    /* Kept at exactly y = 0 and nudged in DEPTH-BUFFER units instead of world
       units. A fixed 1 mm lift is ~8 depth units at 3 m and under one at 40 m —
       precisely where the grazing angles that cause fighting are — whereas
       polygonOffset is applied after projection and stays one "just in front"
       step at every distance. Staying at y = 0 also keeps the shadow on the
       true contact point rather than sliding it lift/tan(elevation) sideways
       under a low sun. In practice GroundedSkybox draws with depthWrite:false
       so the dome cannot fight anyone; this earns its keep against the
       procedural strip at y = −0.01 if both are ever up at once. */
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  });
  patchShadowCatcher(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.visible = false;
  /* AFTER the near ground's bands (renderOrder 1 and 2). It is a multiply over
     whatever is already there, so drawing it first would let the band paint
     over its own contact shadow. */
  mesh.renderOrder = 4;
  scene.add(mesh);
  return mesh;
}

/**
 * Catch the truck's shadow on a ground-projected photograph. `null` disables it
 * and hands the job back to the 700 m procedural plane.
 *
 * The plane is invisible except where the key light is occluded, and it obeys
 * the preset through the same `shadowIntensity` uniform every other receiver
 * uses — so an overcast preset softens the contact shadow for free.
 *
 * @param {null|{size?: number, opacity?: number}} opts
 *        `size` in metres square, `opacity` 0..1 (match the photo's own shadow
 *        density: hard midday sun wants more than an overcast sky).
 */
export function setShadowCatcher(opts: null | { size?: number; opacity?: number }) {
  if (!opts) {
    catcherWanted = false;
    syncGroundReceivers();
    return;
  }
  if (!shadowCatcher) shadowCatcher = makeShadowCatcher();
  /* `+v!` is a type-only assertion: `+undefined` is NaN, Number.isFinite says
     no and the default wins, which is the whole point of the helper. */
  const num = (v: number | undefined, d: number) => (Number.isFinite(+v!) ? +v! : d);
  /* Clamped to the shadow camera. Ground past ±SHADOW_HALF is outside the
     shadow frustum and can never darken, so a wider plane buys nothing but
     transparent fragments that each still pay a shadow-map lookup. A manifest
     asking for 60 m is not wrong — it is describing a frustum we deliberately
     did not buy (see the SHADOW_HALF note in the light rig). */
  catcherSize = THREE.MathUtils.clamp(num(opts.size, SHADOW_HALF * 2), 4, SHADOW_HALF * 2);
  shadowCatcher.material.opacity = THREE.MathUtils.clamp(num(opts.opacity, 0.42), 0, 1);
  catcherWanted = true;
  syncGroundReceivers();
}

/* WHO CATCHES THE SHADOW — the single writer of groundPlane.visible,
   shadowCatcher.visible, the catcher's ramp/scale and the near band's
   receiveShadow.

   There used to be two candidate receivers (the 700 m procedural plane and the
   ShadowMaterial catcher) and setShadowCatcher() arbitrated between them
   directly. There are three now, and they no longer arbitrate — the near band
   and the catcher SPLIT the job by the complementary radial ramp documented at
   makeShadowCatcher(), which keeps the shadow continuous across the seam
   instead of handing it over at a hard circle. The invariant is stronger than
   before: the shadow is applied exactly once at every point.

   setShadowCatcher() is still the only thing that decides whether a catcher is
   WANTED and how dense it is; this resolves the geometry of who applies it
   where, and it is the only place any of these flags is written.

   The 700 m plane is the exception that stays exclusive: it is opaque and
   drawn in the opaque queue, so it would paint straight over the projected dome
   and must be off whenever anything else owns the floor. */
function syncGroundReceivers() {
  for (const m of nearMeshes) m.receiveShadow = nearOn;
  if (shadowCatcher) {
    shadowCatcher.visible = catcherWanted;
    /* EXACTLY the band's inverse. Off (-2, -1) the smoothstep is 1 for every
       r >= 0, which is the uniform catcher the procedural path has always had. */
    catchU.uCatchIn.value = nearOn ? nearU.uNearIn.value : -2;
    catchU.uCatchOut.value = nearOn ? nearU.uNearOut.value : -1;
    /* With the ramp deciding where it applies, the plane only has to cover
       where a shadow can exist at all — the key light's frustum. Growing it to
       that is free (the ramp zeroes it inside the band) and stops a manifest
       `size` smaller than the frustum from cutting the outer part of a long
       low-sun shadow off the photograph. */
    const s = nearOn ? SHADOW_HALF * 2 : catcherSize;
    shadowCatcher.scale.set(s, 1, s);
  }
  if (groundPlane) groundPlane.visible = !nearOn && !catcherWanted && !setGroundOn;
}

/* A 3D SET BRINGS ITS OWN FLOOR — see scene/set.ts.
   This flag exists because the line above is the SINGLE WRITER of
   groundPlane.visible and must stay that way: a set that reached in and set
   `.visible = false` itself would be silently undone by the next
   setShadowCatcher() call, which runs on every environment swap. So the set
   declares its floor here and the existing rule absorbs it.

   Without this the 700 m procedural grass plane sits at y=0, coplanar with the
   set's own yard, and the pair z-fight across the entire view.
   (The `let` itself lives up with `nearOn` — declaring it here would leave
   syncGroundReceivers() reading it from the temporal dead zone.) */

/**
 * Declare that a 3D set is supplying the ground plane.
 * @param {boolean} v
 */
export function setSetGround(v: boolean) {
  const next = !!v;
  if (next === setGroundOn) return;
  setGroundOn = next;
  if (groundPlane) groundPlane.visible = !nearOn && !catcherWanted && !setGroundOn;
}

/** The ground materials, for anything that needs to read their state.
 *  `blades` is permanently null — the instanced grass quads were removed; see
 *  makeGrassCanvas(). The key stays so destructuring callers do not break. */
export function getRoadMaterials() {
  return {
    asphalt: road.asphalt,
    shoulders: road.shoulders.slice(),
    grass: road.grass,
    blades: null,
    near: { base: nearBaseMat, road: nearRoadMat },
  };
}

/**
 * Hand scene.background / scene.environment over to a photoreal HDRI (or take
 * them back). This is the ONLY writer of the `externalEnv` flag; every place
 * that would otherwise assign those two properties checks it.
 *
 * @param {THREE.Texture|null} tex  PMREM'd equirect for scene.environment
 * @param {{background?: THREE.Texture, rotation?: number,
 *          blurriness?: number, intensity?: number}} [opts]
 *        `background` defaults to `tex` (see environment.js for why binding the
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
}


/* Original procedural maps of every material setGroundMaps() has overridden,
   so switching to an environment without ground textures can put them back.
   The PBR textures themselves belong to environment.js (it caches them per
   environment id) — this module never disposes them. */
/** What restoreGround() puts back: every slot setGroundMaps() may overwrite. */
interface GroundOverride {
  map: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  dryColor: THREE.Color;
  dryRough: number;
}
const groundOverride = new Map<THREE.MeshStandardMaterial, GroundOverride>();

function groundTargets(target: string | undefined) {
  if (target === 'grass' || target === 'plane') return [road.grass];
  if (target === 'shoulders') return road.shoulders.slice();
  return [road.asphalt];
}

/* Put the listed materials back on their procedural canvas maps. The saved
   colour is the DRY one (never the live, possibly wet-multiplied value) and the
   replay of the current wetness happens in resnapshotGround(). */
function restoreGround(list: THREE.MeshStandardMaterial[]) {
  const restored: THREE.MeshStandardMaterial[] = [];
  for (const m of list) {
    const o = groundOverride.get(m);
    if (!o) continue;
    m.map = o.map;
    m.roughnessMap = o.roughnessMap;
    m.normalMap = o.normalMap;
    m.aoMap = o.aoMap;
    m.color.copy(o.dryColor);
    dryRough.set(m, o.dryRough);
    baseRoughMap.delete(m);
    m.needsUpdate = true;
    groundOverride.delete(m);
    restored.push(m);
  }
  if (restored.length) resnapshotGround(restored);
}

/* colorSpace / wrap / anisotropy are GL-level parameters: changing one forces a
   re-upload of the whole texture. These textures are cached per environment and
   re-applied on every switch back, so only flag it when something really
   changed. `repeat` is a uniform (texture.matrix) and is always free.

   `aniso` is a parameter because the two consumers want different answers. The
   procedural road is background dressing and 8 is plenty; the near-ground band
   is the surface the camera sits three metres above and looks along at a
   grazing angle — the one case where 16x anisotropy buys real sharpness rather
   than bandwidth. */
function prepGroundTex(
  t: THREE.Texture | null | undefined, colorSpace: THREE.ColorSpace,
  ru: number, rv: number, aniso?: number,
) {
  if (!t) return null;
  const a = aniso || 8;
  if (t.colorSpace !== colorSpace
    || t.wrapS !== THREE.RepeatWrapping || t.wrapT !== THREE.RepeatWrapping
    || t.anisotropy !== a) {
    t.colorSpace = colorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = a;
    t.needsUpdate = true;
  }
  t.repeat.set(ru, rv);
  return t;
}

/* ---------------- ground tint ----------------
   G1 samples the panorama's own ground in the band where the CG patch meets it
   and puts the hex in the manifest. It is a COLOUR SAMPLE, not a multiplier,
   and treating it as one is how you get a black road: an sRGB #8d8b84 is 0.27
   in linear, and 0.27 x an albedo map that already averages ~0.30 is 0.08.

   So it is decomposed:

     chroma  the sample divided by its own luminance, i.e. pure hue/saturation
             at unit brightness, then pulled 20 % back toward white. A neutral
             grey sample is EXACTLY white and the tint is a no-op, which is the
             property that makes this safe to apply unconditionally.
             THE HUE IS THE LOAD-BEARING HALF, and not only for the seam. Poly
             Haven has no tileable green lawn — the shipped `grass` set
             (leafy_grass) is khaki, and the tint is the only thing that makes
             it read as meadow. So the damping is deliberately light: at 0.20 a
             #5a7a3a sample still asks for roughly 0.58 / 0.99 / 0.35, an
             unmistakable green pull. It is not zero because the CG albedo
             already carries the surface's own colour, and a full match on an
             already-coloured texture multiplies hue by hue.
             Luminance is preserved exactly by the damping, because both ends
             of the mix have unit luminance, so `level` below stays honest.
     level   how far the sample sits from a neutral reference (sRGB 50 %),
             applied through a 0.6 power so it pulls toward the photograph
             without ever landing on it, and clamped. A dark asphalt sample
             would otherwise ask for a 0.19x multiply on an albedo that is
             already asphalt-dark.

   THE UPPER LEVEL CLAMP IS THE GUARD THAT MATTERS. `tint` is authored by
   sampling the panorama in the band where the blend happens, and that band is
   near the horizon, where an equirect's rows contain as much sky as ground —
   it is very easy to sample haze instead of asphalt. A haze sample is both far
   too bright and far too blue: rodovia currently ships #b3e8e7, which raw would
   ask for a 1.16 / 1.66 / 1.65 multiply and turn the road cyan. 1.25 bounds
   that to something recoverable rather than letting a mis-sample destroy the
   scene; a real ground sample brighter than +25 % essentially does not exist.

   Channels are clamped to 2 as a last resort against a wildly saturated hand-
   edited hex; a real ground sample never gets near it. */
const TINT_REF_LUM = 0.2159;        // linear luminance of sRGB 50 % grey
const TINT_CHROMA = 0.80;           // 1 = match the sample's hue exactly
const TINT_LEVEL_POW = 0.6;
const TINT_LEVEL_MIN = 0.62, TINT_LEVEL_MAX = 1.25;
const TINT_WHITE = new THREE.Color(1, 1, 1);

const TINT_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A `tint` as a manifest may author it: a hex string, a packed number, or a
 *  ready-made Color. Anything else is rejected below. */
type TintSource = string | number | THREE.Color | null | undefined;

function tintColor(v: TintSource) {
  const c = new THREE.Color(1, 1, 1);
  if (v === null || v === undefined || v === '') return c;
  /* Manifests are external data. THREE.Color.set() does NOT throw on a bad
     string — it console.warns and leaves the colour untouched, which here would
     be white and would then ask for the maximum brighten. Validate instead. */
  if (typeof v === 'string' && !TINT_HEX.test(v.trim())) return c;
  try { c.set(typeof v === 'string' ? v.trim() : v); } catch (_) { return new THREE.Color(1, 1, 1); }
  /* '#ffffff' is what an author writes to mean "no tint". Taken literally it is
     a legitimate sample of a blown-out white ground and would brighten the CG
     band by the full clamp; the sentinel reading is overwhelmingly more likely
     and is the safe one. */
  if (c.r >= 1 && c.g >= 1 && c.b >= 1) return new THREE.Color(1, 1, 1);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (!(lum > 1e-4)) return new THREE.Color(1, 1, 1);
  const level = THREE.MathUtils.clamp(
    Math.pow(lum / TINT_REF_LUM, TINT_LEVEL_POW), TINT_LEVEL_MIN, TINT_LEVEL_MAX);
  c.multiplyScalar(1 / lum);                  // unit-luminance chroma
  c.lerp(TINT_WHITE, 1 - TINT_CHROMA);        // damped, luminance-preserving
  c.multiplyScalar(level);
  c.r = Math.min(c.r, 2); c.g = Math.min(c.g, 2); c.b = Math.min(c.b, 2);
  return c;
}

/* ---------------- the tint as a MEASURED MULTIPLIER ----------------
   tintColor() above takes a COLOUR SAMPLE and defends itself against it: it
   throws the sample's luminance away, damps its chroma 20 % toward white and
   clamps a level derived from a power of that luminance. Every one of those
   steps is right for a hand-picked hex and WRONG for a number that was solved
   rather than eyeballed — it cannot express one. Demonstrated on the shipped
   manifest: a measured grass correction of #b3e8e7 comes out of tintColor() as
   0.867 / 1.354 / 1.344, i.e. it BRIGHTENS the verge, which is why it renders
   as washed-out khaki instead of grass.

   So there is a second, unambiguous form. `tintRgb` / `vergeTintRgb` are three
   LINEAR MULTIPLIERS applied straight to material.color with nothing in
   between, and when present they win over the hex. Both forms stay live: the
   hex is still the right thing for an author eyeballing a sample, the array is
   the right thing for a solved number.

   THE RANGE. 0.02 rather than the 0.05 a first pass would pick, because the
   floor genuinely binds: solving `rodovia`'s verge against its own panorama
   asks for 0.090 in blue, and the same solve on a scene whose plate is greener
   would ask for less — chlorophyll absorbs blue, so a real grass diffuse albedo
   in blue is a couple of per cent and the shipped `leafy_grass` carries 0.111.
   A floor that clips a correct measurement is worse than no floor. The ceiling
   is 4 rather than 2 for the mirror reason: a correction that has to BRIGHTEN a
   dark texture toward a bright plate is legitimate, and nothing here divides by
   it. Both ends exist only so a hand-edited manifest cannot produce a black or
   a blown ground; a solved value never approaches either. */
const TINT_RGB_MIN = 0.02, TINT_RGB_MAX = 4.0;

/** @returns {THREE.Color|null} null ⇒ not a usable triple, fall back to the hex */
function tintRgb(v: number[] | null | undefined) {
  if (!Array.isArray(v) || v.length < 3) return null;
  const n = [+v[0], +v[1], +v[2]];
  /* Manifests are external data: one NaN would reach material.color and render
     the band black, so the whole triple is rejected rather than half-used. */
  if (!n.every(Number.isFinite)) return null;
  return new THREE.Color(
    THREE.MathUtils.clamp(n[0], TINT_RGB_MIN, TINT_RGB_MAX),
    THREE.MathUtils.clamp(n[1], TINT_RGB_MIN, TINT_RGB_MAX),
    THREE.MathUtils.clamp(n[2], TINT_RGB_MIN, TINT_RGB_MAX));
}

/** The measured triple if there is one, the decoded sample otherwise, white if
 *  there is neither. */
function resolveTint(rgb: number[] | null | undefined, hex: TintSource) {
  return tintRgb(rgb) || tintColor(hex);
}

/** setGroundMaps()'s argument, exactly as the JSDoc below spells it out. */
interface GroundMapsOpts {
  diffuse?: THREE.Texture | null;
  rough?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  ao?: THREE.Texture | null;
  disp?: THREE.Texture | null;
  tint?: TintSource;
  tintRgb?: number[] | null;
  repeat?: [number, number] | number[];
  target?: 'asphalt' | 'shoulders' | 'grass';
}

/**
 * Replace a ground material's procedural canvas maps with an environment's PBR
 * set. Call with `null` to restore every material this has ever overridden.
 *
 * colorSpace is not negotiable: albedo is sRGB, roughness, normal and AO are
 * raw data (NoColorSpace). Tagging a normal map sRGB bends every normal.
 *
 * `repeat` is always authored for the 12 x 340 m road strip — that is what the
 * environments manifest documents. Applied to any other surface we keep the *u*
 * density (metres per tile) and use it on BOTH axes: the v stretch is an
 * artistic choice for asphalt grain along the road and reads as a smear on a
 * 700 m field. (setNearGround() takes metres-per-tile directly instead; a
 * near-field disc has no long axis to stretch along.)
 *
 * Adding or removing a normalMap/roughnessMap/aoMap flips USE_NORMALMAP /
 * USE_ROUGHNESSMAP / USE_AOMAP and recompiles that material's program — same
 * trade-off applyWetness() already makes for the puddle mask, and for the same
 * reason: once, on an explicit change, never per frame.
 *
 * `disp` IS ACCEPTED AND DELIBERATELY NOT BOUND. three's displacementMap moves
 * VERTICES, and every ground surface here is two triangles (the near band is
 * four); making a 3 m-tiled height field read would need ~10 cm tessellation,
 * i.e. of the order of a million vertices over the near disc, for mesostructure
 * the normal map already delivers at zero cost. Binding it as a bumpMap instead
 * would double-count that same detail against the normal map rather than add
 * to it. It stays in the signature so a manifest may carry it and a future
 * parallax-occlusion path can pick it up without another API change.
 *
 * @param {null|{diffuse?: THREE.Texture|null, rough?: THREE.Texture|null,
 *               normal?: THREE.Texture|null, ao?: THREE.Texture|null,
 *               disp?: THREE.Texture|null, tint?: string|number|THREE.Color,
 *               tintRgb?: number[], repeat?: [number, number],
 *               target?: 'asphalt'|'shoulders'|'grass'}} opts
 *        `tintRgb` is three LINEAR multipliers and wins over `tint`; see the
 *        tint section for why a solved number cannot go through the hex path.
 */
export function setGroundMaps(opts: GroundMapsOpts | null) {
  const mats = opts ? groundTargets(opts.target).filter(Boolean) : [];
  const diffuse = (opts && opts.diffuse) || null;
  const rough = (opts && opts.rough) || null;
  const normal = (opts && opts.normal) || null;
  const ao = (opts && opts.ao) || null;
  const wanted = mats.length && (diffuse || rough || normal || ao) ? mats : [];

  /* Whatever the PREVIOUS environment overrode and this one does not cover goes
     back to its procedural maps FIRST. environment.js disposes cached textures
     when an environment falls out of its LRU, and a material still pointing at
     a disposed texture renders black — this is the only place that link is
     broken. */
  restoreGround([...groundOverride.keys()].filter(m => !wanted.includes(m)));
  if (!wanted.length) return;

  /* `opts!`: `wanted` is non-empty only when `mats` was, which only happens on
     the `opts ? …` branch above — a chain the checker cannot follow. */
  const rep = Array.isArray(opts!.repeat) ? opts!.repeat : [1, 28];
  const ru = Math.max(0.001, +rep[0] || 1);
  const rv = Math.max(0.001, +rep[1] || 1);
  const metresPerTile = ROAD_W / ru;
  const tint = resolveTint(opts!.tintRgb, opts!.tint);

  for (const m of wanted) {
    if (!groundOverride.has(m)) {
      groundOverride.set(m, {
        map: m.map, roughnessMap: m.roughnessMap, normalMap: m.normalMap,
        aoMap: m.aoMap,
        /* dryColors, NOT m.color: the live colour may be wet-multiplied right
           now, and restoring that would bake the multiplier in permanently. */
        dryColor: (dryColors.get(m) || m.color).clone(),
        dryRough: dryRough.get(m) ?? 0.95,
      });
    }
    const o = groundOverride.get(m)!;    // set() above, on the miss
    /* The puddle-mask materials own their .roughnessMap through applyWetness();
       see puddleSpec. */
    const wetOwned = puddleSpec.has(m);
    const [sw, sl] = groundSize.get(m) || [ROAD_W, ROAD_L];
    /* The road strip gets the authored numbers verbatim; anything else is
       re-tiled at the same metres-per-tile so the grain size matches across
       surfaces instead of jumping at the shoulder line. */
    const isRoad = m === road.asphalt;
    const u = isRoad ? ru : sw / metresPerTile;
    const v = isRoad ? rv : sl / metresPerTile;

    /* Every slot is written on EVERY call — never "only if supplied". Switching
       from an environment with a normal map to one without would otherwise
       leave the old (soon-disposed) texture bound. */
    if (diffuse) {
      m.map = prepGroundTex(diffuse, THREE.SRGBColorSpace, u, v);
      /* A real albedo map must not be tinted by whatever the wet multiplier
         left in m.color, so the DRY colour is the manifest tint — white when
         there is none. */
      m.color.copy(tint);
    } else {
      m.map = o.map;
      m.color.copy(o.dryColor);
    }

    m.normalMap = normal ? prepGroundTex(normal, THREE.NoColorSpace, u, v) : o.normalMap;
    /* aoMap reads UV channel 0 by default (three r151+ made the second UV set
       opt-in via texture.channel), which is the only set these planes have. */
    m.aoMap = ao ? prepGroundTex(ao, THREE.NoColorSpace, u, v) : o.aoMap;

    if (rough) {
      baseRoughMap.set(m, prepGroundTex(rough, THREE.NoColorSpace, u, v));
      /* the map now carries the roughness detail — stop scaling it by 0.95 */
      dryRough.set(m, 1.0);
    } else {
      baseRoughMap.delete(m);
      dryRough.set(m, o.dryRough);
    }
    /* .roughnessMap on the road is written by applyWetness() alone (puddle mask
       while wet, baseRoughMap while dry) — two writers would race. Everywhere
       else nothing else touches it, so bind it here. */
    if (!wetOwned) m.roughnessMap = baseRoughMap.get(m) || o.roughnessMap;

    m.needsUpdate = true;
  }
  /* m.color now holds the intended DRY albedo for every material in `wanted`,
     which is the precondition resnapshotGround() documents. It replays the
     current wetness for the whole ground set, which the dryRough/baseRoughMap
     changes above also need. */
  resnapshotGround(wanted);
}

/* ---------------- near ground ----------------
   The CG band that covers the near field over a projected photograph. Geometry
   and blend state are up in the "near-field CG ground" section; this is the
   public control surface.

   Zero-asset safety net: a band with no diffuse falls back to the SAME canvas
   generators the procedural road uses, so setNearGround() is never the thing
   that puts a flat grey slab under the truck. It is not the intended path —
   environment.js should pass 2k PBR — but it is the difference between a
   degraded scene and a broken one. */
const nearFallbackTex = new Map<NearSurface, THREE.Texture>();

function nearFallbackAlbedo(type: NearSurface) {
  if (!nearFallbackTex.has(type)) {
    const c = type === 'grass' ? makeGrassCanvas()
      : (type === 'asphalt' || type === 'concrete') ? makeAsphaltCanvas(false)
        : makeGravelCanvas();
    /* repeat is overwritten by prepGroundTex on every apply */
    nearFallbackTex.set(type, canvasTex(c, 1, 1));
  }
  return nearFallbackTex.get(type)!;   // just built above if it was missing
}

/** One band's PBR set, shared by the primary manifest and its `verge`. */
interface NearBandSet {
  diffuse?: THREE.Texture | null;
  rough?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  ao?: THREE.Texture | null;
  disp?: THREE.Texture | null;
  /* A NearSurface in practice, but manifest data reaches here as a plain
     string — the lookup below treats an unknown one as it treats an absent one. */
  type?: string | null;
  tint?: TintSource;
  tintRgb?: number[] | null;
  repeat?: number;
}

/** Bind one band's PBR set. `set` is { diffuse, rough, normal, ao, tint, type,
 *  repeat }. `repeat` is METRES PER TILE and is PER BAND — see setNearGround(). */
function applyNearBand(m: THREE.MeshStandardMaterial, set: NearBandSet, metresPerTile: number) {
  /* The cast is the lookup asking "is this one of the five kinds?"; anything
     that misses — absent, null, misspelt — falls to 'gravel' as it always did. */
  const type: NearSurface = WET_PROFILE[set.type as NearSurface]
    ? set.type as NearSurface : 'gravel';
  const r = 1 / metresPerTile;
  const diffuse = set.diffuse || nearFallbackAlbedo(type);

  m.map = prepGroundTex(diffuse, THREE.SRGBColorSpace, r, r, NEAR_ANISO);
  m.normalMap = set.normal ? prepGroundTex(set.normal, THREE.NoColorSpace, r, r, NEAR_ANISO) : null;
  m.aoMap = set.ao ? prepGroundTex(set.ao, THREE.NoColorSpace, r, r, NEAR_ANISO) : null;

  if (set.rough) {
    baseRoughMap.set(m, prepGroundTex(set.rough, THREE.NoColorSpace, r, r, NEAR_ANISO));
    dryRough.set(m, 1.0);          // the map carries the detail; do not scale it
  } else {
    baseRoughMap.delete(m);
    dryRough.set(m, 0.95);
  }
  /* Same rule as setGroundMaps(): applyWetness() owns .roughnessMap for the
     puddle materials and nothing else may write it. */
  if (!puddleSpec.has(m)) m.roughnessMap = baseRoughMap.get(m) || null;

  /* THE TRAP. m.color is the DRY albedo and applyWetness() recomputes the live
     colour from dryColors on every call, so writing a tint without
     re-snapshotting would leave a stale dry value that every later wet preset
     multiplies against. resnapshotGround() at the end of setNearGround() is the
     re-baseline; this only has to leave the intended DRY colour in m.color. */
  m.color.copy(resolveTint(set.tintRgb, set.tint));
  wetProfile.set(m, WET_PROFILE[type]);
  m.needsUpdate = true;
}

/* A band that this environment does not use must not keep pointing at the
   previous environment's textures: environment.js disposes them when an entry
   falls out of its LRU, and a material holding a disposed texture renders black
   the moment the band comes back. Its colour is deliberately NOT re-snapshotted
   — see setNearGround() — because an unrendered material's live colour may be
   wet-multiplied, and baking that into dryColors is the exact bug
   resnapshotGround() exists to prevent. applyNearBand() rewrites every slot on
   the way back in. */
function clearNearBand(m: THREE.MeshStandardMaterial) {
  m.map = null;
  m.normalMap = null;
  m.aoMap = null;
  baseRoughMap.delete(m);
  if (!puddleSpec.has(m)) m.roughnessMap = null;
  m.needsUpdate = true;
}

/* One warning, not one per call: environment.js drives both flags on every
   environment switch and a per-switch console line would be noise. */
let roadOverlapWarned = false;
function warnRoadOverlap() {
  if (!nearOn || !roadOn || roadOverlapWarned) return;
  roadOverlapWarned = true;
  console.warn('[truck-studio] chão próximo e estrada procedural visíveis juntos: '
    + 'a estrada aparece através da dissolução do chão próximo. Chame setRoadVisible(false).');
}

/** setNearGround()'s argument: one band set, plus the shape and the three
 *  "organic, not static" fields, plus the verge's own band set. */
interface NearGroundOpts extends NearBandSet {
  radius?: number;
  fade?: number;
  width?: number;
  wear?: number;
  edgeNoise?: null | { amplitude?: number; scale?: number };
  undulation?: null | { amplitude?: number; scale?: number };
  verge?: null | NearBandSet;
}

/**
 * The near-field CG ground: real PBR geometry between the truck and the
 * projected photograph, dissolving radially into it.
 *
 * `null` removes it and hands the floor back to the procedural plane / shadow
 * catcher. Call it for every environment, including with `null`, so a scene
 * without one cannot inherit the previous scene's band.
 *
 * THE SEAM, which is the only thing here that has to be perfect:
 *   - alpha is `1 − smoothstep(radius, radius + fade, |xz|)`, evaluated per
 *     fragment from an exactly-interpolated world position;
 *   - the material is `transparent` (⇒ drawn after the dome, which sits in the
 *     opaque queue at renderOrder −1) and `depthWrite: false`, so the faded
 *     band cannot punch a hole in the photograph;
 *   - the bands are disjoint in x, so nothing is blended twice;
 *   - `fog: false`, because a fogged CG band against an unfogged photo IS the
 *     visible ring;
 *   - `tint` pulls the CG albedo onto the photograph's own hue — see
 *     tintColor(), and note that a wrong hue makes the ring visible however
 *     good the fade is.
 *
 * y = 2 mm, not 0. GroundedSkybox writes no depth so there is nothing to fight,
 * but the lift also wins the depth test against the procedural strip at
 * y = −0.01 if an integration leaves both on, and 2 mm at the tyre contact is
 * sub-pixel (it shifts the shadow by 2 mm / tan(8°) ≈ 14 mm at the lowest sun
 * any preset uses).
 *
 * ORGANIC, NOT STATIC — the three fields that stop it reading as a slab, in
 * descending order of how much they matter:
 *
 *   `edgeNoise` { amplitude, scale } — metres the asphalt/verge boundary
 *     wanders and the metres per period it wanders over. A dead-straight
 *     material boundary is the single most CG thing a near field can have.
 *     Requires a `verge`: with no boundary there is nothing to displace, and
 *     the field is ignored rather than half-applied.
 *   `wear` 0..1 — dust and grit thrown off the verge onto the first metres of
 *     asphalt, plus darkened and polished wheel tracks on the RUTS lanes the
 *     puddle mask already uses. 0 disables. Needs a road strip for the same
 *     reason `edgeNoise` does.
 *   `undulation` { amplitude, scale } — metres of low-frequency height and its
 *     period. Baked into the vertices, which are subdivided to suit; forced to
 *     zero under the rig's footprint (or the wheels float) and across the
 *     dissolve (or the CG floor and the photographed floor stop agreeing).
 *
 * @param {null|{diffuse?: THREE.Texture|null, rough?: THREE.Texture|null,
 *               normal?: THREE.Texture|null, ao?: THREE.Texture|null,
 *               disp?: THREE.Texture|null,
 *               type?: 'asphalt'|'grass'|'gravel'|'concrete'|'dirt',
 *               tint?: string|number|THREE.Color, tintRgb?: number[],
 *               radius?: number, fade?: number, repeat?: number,
 *               width?: number, wear?: number,
 *               edgeNoise?: null|{amplitude?: number, scale?: number},
 *               undulation?: null|{amplitude?: number, scale?: number},
 *               verge?: null|{diffuse?, rough?, normal?, ao?, disp?, type?,
 *                             tint?, tintRgb?}}} opts
 *        `radius` metres of fully opaque CG ground, `fade` metres of dissolve,
 *        `repeat` METRES PER TEXTURE TILE (not tiles — setGroundMaps() takes
 *        the other convention and they must not be confused), `width` the road
 *        strip's width in metres, `type` the surface kind, which only drives
 *        how the material behaves when wet. `verge` is the shoulder material
 *        either side of the road strip; omit it (or pass null) for a yard, and
 *        the primary set covers the whole band with no strip at all.
 *        `verge.repeat` IS ITS OWN NUMBER and should be that set's real-world
 *        tile size — the shipped sets are asphalt 4.04 m, grass 2.00 m,
 *        gravel 2.48 m, dirt 1.30 m, concrete 2.00 m, so a scene with an
 *        asphalt road and a grass verge needs two different values or the
 *        grass comes out at twice its true scale. It falls back to the
 *        primary's `repeat` only because one number is better than none.
 *        `verge.tint` is likewise its own: on the shipped grass set the tint is
 *        LOAD-BEARING (Poly Haven has no tileable green lawn; the chosen
 *        `leafy_grass` is khaki and the tint is what makes it meadow green),
 *        so a scene-level tint sampled from the road cannot serve both bands.
 *        `tintRgb` (and `verge.tintRgb`) is the MEASURED form of the same
 *        thing — three linear multipliers written straight onto material.color
 *        — and WINS over the hex when present. Use it for anything solved
 *        rather than eyeballed; tintColor()'s chroma damping and level clamp
 *        cannot express a solved number. See the tint section.
 *        `disp` is accepted and not bound — see setGroundMaps().
 */
export function setNearGround(opts: NearGroundOpts | null) {
  if (!opts) {
    nearOn = false;
    nearOpaqueR = 0;
    if (nearGroup) nearGroup.visible = false;
    /* Drop the texture references on the way out. A hidden material is never
       uploaded, so this is belt-and-braces against environment.js disposing a
       cached set while we still point at it — but it is the cheap half of the
       pair and the expensive half is a black ground. */
    clearNearBand(nearBaseMat);
    clearNearBand(nearRoadMat);
    /* Park the surface modifiers too, so nothing an environment authored can
       survive into a scene that has no band at all. */
    nearU.uNearEdge.value.set(-1e4, NEAR_EDGE_BLEND);
    nearU.uEdgeNoise.value.set(0, 1 / 7);
    nearU.uWear.value.set(0, 2.2);
    nearUndulation = null;
    syncGroundReceivers();
    return;
  }
  /* `+v!` is a type-only assertion — see setShadowCatcher()'s copy. Takes null
     as well because the callers below pass `en && en.amplitude`. */
  const num = (v: number | null | undefined, d: number) => (Number.isFinite(+v!) ? +v! : d);
  const radius = THREE.MathUtils.clamp(num(opts.radius, 55), 8, 400);
  const fade = THREE.MathUtils.clamp(num(opts.fade, 25), 1, 400);
  const tile = THREE.MathUtils.clamp(num(opts.repeat, NEAR_TILE_DEFAULT), 0.25, 60);
  const roadW = THREE.MathUtils.clamp(num(opts.width, ROAD_W), 2, radius * 2);
  const verge = (opts.verge && typeof opts.verge === 'object') ? opts.verge : null;
  const hasVerge = !!(verge && (verge.diffuse || verge.rough || verge.normal
    || verge.ao || verge.type));
  /* PER-BAND TILE. The two bands are usually different PBR sets with different
     REAL-WORLD tile sizes — `asphalt` is 4.04 m and `grass` is 2.00 m in the
     shipped set — so a single scene-level number cannot be right for both.
     Driving the grass verge off the asphalt's 4 m makes it exactly 2x too
     coarse, which at a 26 m radius is very visible. Falls back to the primary's
     value so an author who genuinely wants one number can still write one. */
  const vergeTile = verge
    ? THREE.MathUtils.clamp(num(verge.repeat, tile), 0.25, 60) : tile;
  const outer = radius + fade;
  const blend = Math.min(NEAR_EDGE_BLEND, roadW * 0.25);

  /* EDGE WANDER. Meaningless without a boundary to wander, so it is forced off
     for a verge-less band — there the base material covers everything and
     `uNearEdge.x` is parked negative so tsRoadMask() is identically 0.
     Amplitude is capped at 35 % of the half-width as well as at 3 m: a 12 m
     road whose edge swings ±4 m is not an irregular verge, it is a different
     road every 20 metres. */
  const en = (opts.edgeNoise && typeof opts.edgeNoise === 'object') ? opts.edgeNoise : null;
  const edgeAmp = hasVerge
    ? THREE.MathUtils.clamp(num(en && en.amplitude, 0), 0, Math.min(3, roadW * 0.175))
    : 0;
  const edgeScale = THREE.MathUtils.clamp(num(en && en.scale, 7), 1.5, 80);
  const wear = THREE.MathUtils.clamp(num(opts.wear, 0), 0, 1);

  /* UNDULATION. `scale` is the period in metres and the cell size follows it —
     ~9 samples per period, which is smooth without being a vertex budget. The
     amplitude is capped at 25 cm: past that the flat rectangle under the rig
     stops being able to hide, and the truck sits in a visible bowl. */
  const un = (opts.undulation && typeof opts.undulation === 'object') ? opts.undulation : null;
  const undAmp = THREE.MathUtils.clamp(num(un && un.amplitude, 0), 0, 0.25);
  const undScale = THREE.MathUtils.clamp(num(un && un.scale, 14), 3, 120);
  const undul = undAmp > 0.001 ? {
    amp: undAmp,
    inv: 1 / undScale,
    cell: THREE.MathUtils.clamp(undScale / 9, 0.6, 2.5),
    inner: radius, outer,
  } : null;

  /* Geometry is only rebuilt when the SHAPE changes: the maps and the tiling
     are material/uniform state and cost nothing to re-apply. The wander
     amplitude is part of the shape because it decides how far the two bands
     have to reach past each other, and so is the whole undulation, because it
     is baked into the vertices. */
  const overlap = edgeAmp + blend;
  const key = [
    outer.toFixed(3), hasVerge ? roadW.toFixed(3) : 'solid', overlap.toFixed(3),
    undul ? undAmp.toFixed(4) + ':' + undScale.toFixed(2) + ':' + radius.toFixed(2) : 'flat',
  ].join('|');
  if (key !== nearGeoKey) {
    rebuildNearGeometry({ outer, hasVerge, roadW, overlap, undul });
    nearGeoKey = key;
  }
  nearUndulation = undul ? { amplitude: undAmp, scale: undScale } : null;

  /* With a verge the primary set IS the road strip and the verge covers the
     rest; without one the primary set covers the whole band and there is no
     strip (a hardstanding has no centre line and no shoulder). */
  if (hasVerge) {
    applyNearBand(nearRoadMat, opts, tile);
    applyNearBand(nearBaseMat, verge, vergeTile);
  } else {
    applyNearBand(nearBaseMat, opts, tile);
    clearNearBand(nearRoadMat);
  }

  nearU.uNearIn.value = radius;
  nearU.uNearOut.value = outer;
  /* NO VERGE ⇒ NO ROAD. A negative edge makes tsRoadDist() negative for every
     x, so the mask is 0, the base band keeps the whole disc and both wear terms
     switch themselves off. It is the same uniform doing both jobs because the
     two bands must never be able to disagree about where the road is. */
  nearU.uNearEdge.value.set(hasVerge ? roadW / 2 : -1e4, blend);
  nearU.uEdgeNoise.value.set(edgeAmp, 1 / edgeScale);
  nearU.uWear.value.set(wear, THREE.MathUtils.clamp(roadW * 0.18, 0.6, 3.5));
  /* Keep the puddle mask's lanes on the wheel tracks. Its rut positions are
     authored as fractions of ONE tile, so the tile has to be the carriageway —
     hard-coded to ROAD_W when it was written, which silently misaligned the
     puddles from the tracks for any other width. Cheap to fix here, and this is
     the only place `width` is known. applyWetness() still owns the texture
     itself; this only re-derives the transform it was built with. */
  const pud = puddleSpec.get(nearRoadMat);
  if (pud) {
    pud.u = 1 / roadW;
    if (pud.tex) pud.tex.repeat.set(pud.u, pud.v);
  }

  nearGroup.visible = true;
  nearOn = true;
  nearOpaqueR = radius;
  syncGroundReceivers();
  warnRoadOverlap();
  /* THE RE-BASELINE. Every band applyNearBand() just touched holds its intended
     DRY albedo, which is resnapshotGround()'s documented precondition; it
     rewrites dryColors from it and replays the current wetness immediately, so
     a wet preset never multiplies against a stale dry value and the band does
     not sit showing a dry albedo until the next tween.
     Only the bands that were re-bound: an untouched nearRoadMat may still be
     carrying a wet-multiplied colour, and snapshotting THAT is exactly the bug
     this call exists to prevent. */
  resnapshotGround(hasVerge ? [nearBaseMat, nearRoadMat] : [nearBaseMat]);
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
export function frameAll(groups: THREE.Object3D[]) {
  const box = new THREE.Box3();
  for (const g of groups) if (g.visible) box.expandByObject(g);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const k = Math.max(1, 1.35 / camera.aspect);   // narrow viewports need more distance
  controls.target.copy(c);
  camera.position.set(
    c.x + size * 0.55 * k,
    Math.max(CAM_MIN_Y, c.y + size * 0.28 * k),
    c.z + size * 0.62 * k
  );
  camera.far = Math.max(size * 10, 700);         // keep the sky dome inside the frustum
  camera.updateProjectionMatrix();               // near is managed per-frame in the loop
}

/* Ankaa: the studio can be detached from the page (route change) or resized by
   the app chrome (sidebar collapse), so a zero-sized holder is a normal state —
   resizing to 0×0 would drop the drawing buffer and divide the aspect by zero.
   mountStudio() re-runs this and keeps a ResizeObserver on the holder. */
export function resize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();

export function stopLoop() {
  renderer.setAnimationLoop(null);
}

export function startLoop() {
  renderer.setAnimationLoop(() => {
    /* A backgrounded tab returns one huge dt, which would complete every tween
       in a single frame (a visible jump) and teleport the rain field. */
    const dt = Math.min(clock.getDelta(), 0.1);
    controls.update();
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
    }
    updateLighting(dt);
    for (const fn of frameHooks) fn(dt);
    renderer.render(scene, camera);
  });
}
