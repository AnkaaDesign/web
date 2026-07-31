/* Swappable photoreal environments: HDRI sky + image-based lighting, a
   ground-projected dome that replaces the CG near field, PBR ground for the
   procedural fallback, and the light preset toggled to match.
   ---------------------------------------------------------------------------
   This module owns the POLICY (which asset, when to load it, what to cache,
   when to dispose). scene.js owns the mechanism and exposes exactly the hooks
   needed: setExternalEnvironment / setExposureBase / setGroundMaps /
   setNearGround / setMacroVariation / setSkyDomeVisible / setRoadVisible /
   setShadowCatcher / setLamps, plus its PMREMGenerator, its render-loop hook
   and its rig hook.

   WHY THE PMREM IS USED FOR scene.background TOO (and not the raw equirect)

   1. No VRAM duplication. Assign a raw equirect to scene.background and three
      builds its OWN copy behind your back: WebGLCubeMaps renders it into a
      cube render target sized image.height, or — the moment
      backgroundBlurriness > 0 — WebGLCubeUVMaps builds a SECOND PMREM with its
      own generator. Hand it a texture that is already CubeUV and
      WebGLCubeUVMaps.get() returns it untouched.
   2. envDef.backgroundBlur would otherwise be silently ignored: blurriness is
      only sampled in the ENVMAP_TYPE_CUBE_UV branch of three's backgroundCube
      shader, which a plain cube texture never reaches.
   3. It lets us dispose the source .hdr immediately — a 2k HDR is ~16 MB of
      half-float that nothing would ever sample again. (buildSkyEnv() in
      scene.js does the same with its canvas.)
   4. Sharpness is fine: PMREM mip 0 is image.width / 4 per cube face, so a 2k
      HDRI gives 512 px faces — and a hero render wants a slightly soft sky
      behind the truck anyway.

   VRAM: the PMREM render target is 3·cubeSize x 4·cubeSize half-float RGBA
   ≈ 25 MB for a 2k source, ≈ 100 MB for a 4k one. The engine is a singleton
   that outlives the React page (see main.js), so the cache is capped and every
   eviction disposes the render target, not just its texture.

   ---------------------------------------------------------------------------
   GROUND-PROJECTED SKYBOX  (envDef.grounded)

   The distant HDRI always read as a photograph; what never did was the strip
   between the camera and the horizon — a procedural road, gravel shoulders and
   canvas grass, perfectly tiled and lit by a different sun than the photo behind
   them. GroundedSkybox replaces all of it: the panorama is projected onto a dome
   whose lower half is FLAT at y = 0, so the photograph's own asphalt/gravel/
   concrete continues, correctly foreshortened, right up to the tyres.
   `grounded.radius` is therefore literally the "how close is the world" knob.

   Three consequences drive the code below:

   a) THE DOME IS A MESH, NOT A BACKGROUND. Its map is sampled through the
      sphere's UVs (`texture2D(map, vMapUv)` in map_fragment), NOT as a
      direction. A PMREM texture is a packed CubeUV ATLAS, so handing one to
      GroundedSkybox paints a mosaic of cube faces on the sky. The dome needs a
      real equirect image; the PMREM stays bound to scene.environment for the
      lighting. That is why loadHdr()'s equirect is kept alive (instead of
      disposed after toPmrem()) exactly when a dome will sample it.

   b) ROTATION SIGN.  `mesh.rotation.y = +envRotation`, the SAME sign as
      scene.environmentRotation / scene.backgroundRotation. Verified rather than
      assumed: three's shaders sample the environment at
      `makeRotationFromEuler(-rotation) * worldDir` = Ry(-r)·d, so the texel that
      equirectUv() places at direction e is seen at d = Ry(+r)·e — and a mesh
      shows the texel painted at object direction p at Ry(+theta)·p. The two
      coincide iff the sphere's UV layout equals equirectUv(), which it does:
      after GroundedSkybox's `geometry.scale(1,1,-1)` the sphere maps u=0.5→+X,
      u=0.75→+Z, u=0.25→−Z, v=1→zenith, exactly like
      `u = atan2(z,x)/2pi + 0.5, v = asin(y)/pi + 0.5`. Checked numerically over
      every non-pole vertex (max error 2e-8, i.e. float32 noise).

      RE-VERIFIED independently after the asset agent flagged that
      `geometry.scale(1,1,-1)` is exactly the kind of thing that flips a sign.
      It is — and it is the flip that makes the two AGREE rather than a missing
      one: SphereGeometry puts u=0.25 at +Z, the scale sends it to −Z, and
      equirectUv(−Z) = 0.25. Method: build the ACTUAL GroundedSkybox geometry,
      rotate each undeformed vertex by Ry(+r), push that world direction through
      the matrix WebGLMaterials/WebGLBackground really build from
      environmentRotation (the Euler negated on all three axes; the extra
      cube-only y/z negation does not apply to a PMREM, whose isCubeTexture is
      false), and compare the resulting equirectUv() with the vertex's own uv
      attribute. 588 vertices, max error 3.0e-8. The control run with Ry(−r) is
      off by exactly 2r/2pi of a turn — the doubled-rotation signature.

      Get this wrong and the truck's paint reflects a world rotated by 2·r from
      the one behind it: the single most obvious artefact in the whole feature,
      and one that is invisible until you look at the paint.

   c) THE CAMERA MUST STAY INSIDE. Reach the dome wall and you see the horizon
      from outside and the floor funnels away. See the containment block.

   ---------------------------------------------------------------------------
   TWO BANDS: CG NEAR FIELD, PHOTOGRAPHIC FAR FIELD  (envDef.nearGround)

   Projecting the panorama all the way down to the tyres traded one artefact for
   another: the floor stopped TILING and started BLURRING. That is a resolution
   ceiling, not a bug. A texel row of an equirect shot at height h covers

       Δd = Δθ · (h² + d²) / h ,      Δθ = π / (vertical texels)

   of ground at distance d — for h = 1.7 m and a 4096x2048 background that is
   ~1.1 cm/texel at 3 m, ~9 cm at 10 m and ~35 cm at 20 m. The rig is 16 m long,
   so nearly everything the user looks at sits in the mush, and going 8k only
   halves it. Worse, the projection flattens EVERYTHING below the horizon onto
   y = 0, so an embankment or a wall smears radially.

   So the bands are split by what each medium is actually good at:

     near field   real CG geometry with 2k PBR ground sets (`nearGround`). At
                  ~3 m per tile that is ~470 000 texels on a 3 m patch — orders
                  of magnitude more detail per metre than any panorama, and it
                  is lit by the same rig as the truck.
     far field    the projected photograph, pushed back out to
                  `grounded.radius` ≈ 150 m, where its angular resolution is
                  genuinely adequate and where no CG tiling could match it.
     the seam     a radial alpha fade from one into the other, owned by
                  scene.js's setNearGround(); `nearGround.tint` (sampled by the
                  asset agent from the photo's own ground) is what keeps the two
                  bands agreeing in hue, which matters more than the fade.

   Three consequences for this module:

     * the ground maps are downloaded AGAIN for grounded scenes. The previous
       round skipped them because the photo supplied the floor; with the CG band
       back, they are the pixels the eye lands on. They carry real weight in the
       progress bar now (see W_MAP).
     * `showRoad` goes back to meaning what it says. The lane markings and
       shoulders are CG road furniture that a highway wants and a freight yard
       does not, so it is manifest data again instead of "off, because grounded".
     * the camera clamp can no longer come from the dome alone: 0.61·150 m would
       park the camera 90 m from a 16 m truck. See the containment block.

   ---------------------------------------------------------------------------
   THE PLATE AND THE CG SHARE ONE TRANSFER FUNCTION  (preparePlateMaterial)

   The two bands only compose if they are measured in the same space, and for
   three rounds they were not. `sky.jpg` is DISPLAY-REFERRED — it has already
   been through a tone curve — and it was drawn with `toneMapped = false`, i.e.
   straight to the screen, while every CG surface went through
   ACESFilmicToneMapping. Identical albedo under identical light therefore
   produced different pixels, and no tint could fix it because the tints were
   being solved as `plate_pixel / texture_albedo`: a ratio between a
   display-referred number and a scene-referred one, which is not a quantity.

   ensureDome() now decodes the plate back to scene-referred with the analytic
   inverse of three's own ACES fit and hands the single tone map back to the
   renderer. What that buys, measured on the shipped assets:

     * the decode is verifiable, not assumed. Pushing `sky.jpg` through the
       inverse at exposure 1 and dividing by `sky.hdr` gives a median 0.98
       (`rodovia`) and 1.03 (`urbano`) over ~2 M mid-tone pixels — the
       backgrounds ARE ACES tone maps of the HDRIs, so the reconstructed plate
       is in the same radiometric units as the IBL that lights the CG.
     * the near-ground correction becomes solvable, and the answer is large.
       Against the reconstructed plate the untinted CG road on `rodovia` sits
       3.0x / 3.4x / 4.7x too bright, on `urbano` 3.6x / 3.9x / 4.4x, on
       `patio-logistico` 5.0x / 4.0x / 2.8x, and the verge 7.6x / 5.3x / 28x.
       Those are the numbers `nearGround.tintRgb` now carries.
     * the exposure slider moves the photograph with the truck, and the
       day/night dome gain stops hard-clipping the sky.

   ---------------------------------------------------------------------------
   ORGANIC NEAR FIELD: SCATTERED GEOMETRY + 4k GROUND  (envDef.scatter, .roadside)

   A flat plane with a tiled texture and a dead-straight road edge reads as CG
   however good the texture is. Three things fix that, and this module is the
   wiring for all three:

     surface      `nearGround.edgeNoise` / `.wear` / `.undulation` pass straight
                  through to scene.js — an irregular asphalt/verge boundary,
                  dirt creeping off the verge and into the wheel tracks, and a
                  few centimetres of low-frequency displacement so the disc is
                  not a perfect plane.
     geometry     `scatter` (tufts, rocks, weeds, debris) and `roadside`
                  (poles, barriers, hydrants in a line) name PROP IDS. We
                  download one self-contained .glb per id and hand the loaded
                  scenes to scatter.js, which builds one InstancedMesh per
                  prop x material. `lamps.model` is the same mechanism for the
                  street lamp, whose geometry goes to scene.js's setLampModel()
                  — the fixed 8-spot light POOL is untouched, only what stands
                  under each spot.
     resolution   the near band asks for the 4k variant of the maps whose extra
                  texels are actually visible. See HIRES_MAPS.

   WHY PROPS ARE CACHED BY PROP ID AND NOT BY ENVIRONMENT. `grass_medium_01`
   appears in more than one scene, and a per-environment cache would download,
   decode and hold it twice. So both prop caches are keyed by id and sit BESIDE
   the per-environment LRU, exactly like `sharedTex` does for the ground sets —
   and for the same second reason: an environment falling out of the LRU can
   then never tear a mesh out from under a scene that is still standing on it.

   BOTH caches, because the work splits: scatter.js prepares each scatter prop
   into per-material instancing variants and caches THAT, so this module only
   folds its downloads into the progress bar (`preloadProps`) instead of
   keeping a second copy; the lamp model, whose consumer is scene.js and not
   the instancing pipeline, is downloaded and cached here. See the props
   section for the full argument.

   The consequence either way is that the prop phase runs on the CACHE-HIT path
   too: `entry` says nothing about whether the props are still resident, so
   applyEnvironment() re-resolves them every time (a hit is synchronous and
   weighs 0 in the bar).

   ---------------------------------------------------------------------------
   4k WHERE IT IS SEEN, 2k WHERE IT IS NOT  (HIRES_MAPS)

   The near band is the surface the camera sits 3 m from; the 340 m procedural
   road strip is only ever the fallback for a scene with no band, and is seen
   from tens of metres. So the band prefers `<map>_4k.<ext>` and the strip keeps
   the 2k files the manifest's `ground` block names, verbatim.

   NOT EVERY MAP, THOUGH — this is a VRAM decision, not a laziness one. A 4k
   RGBA texture with its mip chain is 4096²·4·(4/3) ≈ 90 MB resident against
   ≈ 22 MB for the 2k one, and a scene wants two full sets (road + verge):

     all five maps at 4k     ~358 MB per set   (disp is never uploaded)
     diffuse + normal at 4k  ~224 MB per set
     everything at 2k         ~90 MB per set

   Across the three shipped scenes that is the difference between ~1.1 GB and
   ~670 MB of ground textures alone, on top of three PMREMs and three 4k
   background JPGs. So only the two maps whose detail is SPATIAL get the extra
   texels: albedo (what the user is looking at) and normal (relief at the
   grazing angles the ground is always seen at). Roughness and AO are
   low-frequency modulators multiplied over those two — at 4 m per tile a 2k map
   is already past their perceptual bandwidth — and `disp` is fetched but not
   bound by scene.js at all, so a 4k one would be pure download.

   THE VARIANT IS PROBED, NOT ASSUMED. `_4k` is a convention, and the asset
   agent may equally have swapped the 4k files in under the existing names. So
   the hi-res URL is requested as OPTIONAL and a 404 falls back to the base
   path, which is then whatever is actually on disk. The negative result is
   memoised in `missingHiRes` so the 404 is paid once per session and not once
   per environment switch.
*/
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import {
  scene, camera, controls, renderer, onFrame, onRig,
  pmrem, applyPreset, setTimeOfDay,
  setExternalEnvironment, setExposureBase, setGroundMaps,
  setSkyDomeVisible, setRoadVisible, setShadowCatcher, setLamps,
  setNearGround, setMacroVariation, setLampModel, preparePlateMaterial,
} from './scene';
import {
  loadPropCatalog, getPropDef, preloadProps,
  applyScatter, clearScatter, disposeProps,
} from './scatter';
import { loadGLB } from '../vehicle/models';
import { assetUrl } from '../catalog/catalog';
import { TEXTURES_DIR, PROPS_DIR as PROPS_DIR_ABS } from '../core/paths';
import type { ScatterOpts, SpecInput } from './scatter';
import type { Rig } from './presets';
import type { EnvironmentDef, RawBlock } from '../catalog/catalog';

/* ---------------- tipos ----------------
   O manifesto chega tipado de catalog.ts, mas os blocos que ele repassa crus
   (`grounded`, `nearGround`, `scatter`, `roadside`, `shadowCatcher`, `lamps`)
   são RawBlock: é ESTE módulo que os valida, então tudo que sai deles entra
   como `unknown` e só vira número/string depois de passar por num()/path()/
   field(). Os tipos abaixo descrevem o que este módulo constrói a partir
   disso — nada aqui duplica o contrato do catálogo. */

/** As cinco chaves de um conjunto PBR, na ordem de SET_MAPS. */
type MapKey = 'diffuse' | 'rough' | 'normal' | 'ao' | 'disp';

/** Caminhos relativos ao manifesto de um conjunto PBR — ver setPaths(). */
type SetPaths = { name: string } & Partial<Record<MapKey, string | null>>;

/** URLs já resolvidas por assetUrl() — ver wantSet() em applyEnvironment(). */
type UrlSet = Partial<Record<MapKey, string | null>>;

/** Tudo que a faixa próxima baixa: os dois conjuntos e o ruído macro. */
interface NearUrlSet { main: UrlSet | null; verge: UrlSet | null; macro: string | null }

/** Uma linha da lista de downloads deduplicada por URL — ver want(). */
interface ReqEntry { weight: number; optional: boolean; fallback: string | null }

/** Os mapas de um conjunto depois de baixados; null = o arquivo não veio. */
type TexSet = Partial<Record<MapKey, THREE.Texture | null>>;

/** O conjunto do campo próximo, com o acostamento pendurado nele. */
type NearTexSet = TexSet & { verge: TexSet | null };

/** Um bloco `{ amplitude, scale }` já validado — ver pair(). */
interface Pair { amplitude: number; scale: number }

const rgbeLoader = new RGBELoader();
const texLoader = new THREE.TextureLoader();

/* The manifest has exactly 3 environments, so nothing is ever evicted in
   practice — the LRU exists so a hand-edited manifest with 20 scenes cannot
   quietly eat a gigabyte of VRAM for the rest of the session. */
const MAX_CACHE = 3;

/** @typedef {{rt: THREE.WebGLRenderTarget|null, sky: THREE.Texture|null,
 *             bg: THREE.Texture|null, dome: THREE.Mesh|null, ground: Object}} CacheEntry */
interface CacheEntry {
  rt: THREE.WebGLRenderTarget | null;
  sky: THREE.Texture | null;
  bg: THREE.Texture | null;
  dome: GroundedSkybox | null;
  ground: TexSet;
  near: NearTexSet | null;
  macro: THREE.Texture | null;
}
/** @type {Map<string, CacheEntry>} */
const cache = new Map<string, CacheEntry>();

let current: EnvironmentDef | null = null;        // the applied envDef
let hdriOn = false;        // is an HDRI currently bound?
let seq = 0;               // guards against an out-of-order double apply

const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const path = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/* Read a number out of an OPTIONAL block. `num(block && block.k, d)` is a trap:
   `+null` and `+''` are 0, not NaN, so a missing block silently reads as zero
   and then clamps to the bottom of its range instead of taking the default. */
const field = (o: unknown, k: string, d: number) => num(
  (o && typeof o === 'object' && (o as RawBlock)[k] !== null
    && (o as RawBlock)[k] !== undefined) ? (o as RawBlock)[k] : NaN, d);

/**
 * An `{ amplitude, scale }` block → itself, clamped, or null when unauthored.
 * Null means OMIT — see the note at resolveNearGround()'s return: handing
 * scene.js a zeroed block and handing it nothing are different instructions,
 * and only one of them lets its own default win.
 * A zero (or negative) amplitude is a deliberate "off" and is kept, not nulled:
 * an author writing `"wear": 0` is disabling the effect for this scene, not
 * asking for the built-in default.
 */
function pair(o: unknown, aLo: number, aHi: number, sLo: number, sHi: number): Pair | null {
  if (!o || typeof o !== 'object') return null;
  const a = field(o, 'amplitude', NaN);
  const s = field(o, 'scale', NaN);
  if (!Number.isFinite(a) && !Number.isFinite(s)) return null;
  return {
    amplitude: clamp(Number.isFinite(a) ? a : aLo, aLo, aHi),
    /* A period of zero would be a division by zero at the far end; the low
       clamp is what makes the block safe to pass through unvalidated. */
    scale: clamp(Number.isFinite(s) ? s : sLo, sLo, sHi),
  };
}

/* ---------------- progress ----------------
   Weighted, because the assets differ by an order of magnitude in size and an
   unweighted bar would sit at 20 % for the whole HDRI and then jump.

   ONE UNIT ≈ ONE MEGABYTE ON THE WIRE, measured from what is actually shipped
   in public/environments: a 2k .hdr is 5.8 MB, a 4k tonemapped background
   JPG 2.4 MB, a 2k PBR albedo/normal/roughness/AO ~1.2 MB on average (there can
   be ten of them across two sets, which is why the ground is no longer a
   rounding error), a displacement map ~0.1-0.6 MB, and the macro-noise tile
   ~8 kB. Keeping the ratios in bytes is what makes the
   bar move at a roughly constant rate instead of stalling on the biggest file.
   Anything already resident gets weight 0 at the call site — a request that
   never happens must not be able to hold the bar back.

   THE TWO NEW CLASSES:
     W_MAP_4K  a 4k variant of the two maps that get one. 4x the pixels is not
               4x the bytes at these codecs — the shipped 2k albedos are
               1.6-2.0 MB and the 2k normals 2.2-3.9 MB, and Poly Haven's own
               4k jpgs land around 3.5-8 MB — so 5 is the honest average, not
               4 x W_MAP.
     W_PROP    one self-contained .glb with its textures embedded, Draco'd.
               MEASURED, not guessed: the shipped props/ is 11.2 MB across 15
               assets — mean 0.75, median 0.69, spread 0.25 (a pebble with 512²
               maps) to 2.18 (a pole set with six 1k maps). 0.9 rather than 0.75
               because the scenes that pull the most props also pull the
               heaviest ones. An earlier 1.5 made the eight props on `rodovia`
               claim 27 % of that scene's bar for 16 % of its bytes.
               The scatter props share ONE slot weighing W_PROP per id, because
               scatter.js's preloadProps() reports a single fraction over the
               whole list rather than per file.
     W_PCAT    props.json, 10 kB. It is in the list at all only so the bar is
               not frozen at 0 during the round trip that has to happen before
               the first .glb URL is even known. */
const W_HDRI = 6, W_BG = 2.5, W_MAP = 1.2, W_DISP = 0.5, W_MACRO = 0.3;
const W_MAP_4K = 5, W_PROP = 0.9, W_PCAT = 0.1;

function makeTracker(weights: number[], onProgress: (p: number) => void) {
  const total = weights.reduce((a: number, b: number) => a + b, 0);
  const done = weights.map(() => 0);
  const emit = () => {
    if (!total) { onProgress(1); return; }
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += done[i] * weights[i];
    onProgress(Math.max(0, Math.min(1, s / total)));
  };
  return {
    /* monotonic: a loader that reports total=0 then completes must not make the
       bar go backwards */
    set(i: number, f: number) { done[i] = Math.max(done[i], Math.min(1, f)); emit(); },
    emit,
  };
}

/* Content-Length is missing whenever the response is gzip/br-encoded, which is
   the normal case for a .hdr served by Vite — then lengthComputable is false
   and we simply hold until the load callback fires. */
const fraction = (e: ProgressEvent) => (e && e.lengthComputable && e.total ? e.loaded / e.total : 0);

/* ---------------- loading ---------------- */

/* Every loader below RESOLVES with null on failure instead of rejecting: one
   missing roughness map must not take the whole studio down, and a missing HDRI
   has to degrade to the procedural sky, never to a black screen. */
function loadHdr(url: string, onProg: (e: ProgressEvent) => void): Promise<THREE.DataTexture | null> {
  return new Promise(resolve => {
    rgbeLoader.load(url, tex => resolve(tex), onProg, err => {
      console.warn('[truck-studio] HDRI não carregou, usando céu procedural: ' + url, err);
      resolve(null);
    });
  });
}

/**
 * @param {boolean} [optional] true ⇒ the asset is allowed not to exist (Poly
 *   Haven does not ship an AO or a displacement map for every surface), so a
 *   404 is expected data, not a fault. Logged at debug level so the console
 *   stays a place where a warning still means something.
 */
function loadTex(url: string, onProg: (e: ProgressEvent) => void,
  optional?: boolean): Promise<THREE.Texture | null> {
  return new Promise(resolve => {
    texLoader.load(url, tex => resolve(tex), onProg, err => {
      if (optional) console.debug('[truck-studio] mapa opcional ausente: ' + url);
      else console.warn('[truck-studio] textura de chão ignorada: ' + url, err);
      resolve(null);
    });
  });
}

/* ---------------- shared PBR ground sets ----------------
   `nearGround.material` names a SET ('asphalt'), not files, so the naming
   convention lives here — in one place — and a manifest cannot drift from
   what is on disk. `<set>_ao` is optional (see loadTex).

   These textures are keyed BY URL and outlive the per-environment LRU, on
   purpose. Two reasons:
     1. `rodovia` and `urbano` both stand on asphalt, and the road strip and the
        near-ground disc of a single scene ask for the same set again. Cached
        per environment that is the same 2k map downloaded twice, decoded twice
        and resident twice — a 2k RGBA map is ~22 MB of VRAM with its mips.
     2. It removes the hazard scene.js's restoreGround() was written for: a
        material can no longer be left pointing at a texture that an LRU
        eviction disposed, because nothing evicts these.
   `/textures` holds five ground sets by construction, so "no eviction" is bounded in
   practice; the guard below shouts if a hand-edited manifest makes it not. */
const SHARED_DIR = TEXTURES_DIR;
const GROUND_SETS = ['asphalt', 'grass', 'gravel', 'concrete', 'dirt'];
const MACRO_NOISE = SHARED_DIR + 'macro_noise.webp';
/* [key, filename suffix, extension, optional]. The extensions are not uniform
   and that is deliberate on the asset side: everything is webp except the
   NORMAL maps, which band visibly at q88 (a normal map is a direction, so a
   quantised gradient becomes a faceted surface) and ship as jpg. Displacement
   is fetched because scene.js accepts it, and is small — 120-630 kB against a
   1.7-3.9 MB albedo/normal. */
const SET_MAPS: [MapKey, string, string, boolean][] = [
  ['diffuse', 'diff', 'webp', false],
  ['rough', 'rough', 'webp', false],
  ['normal', 'nor', 'jpg', false],
  ['ao', 'ao', 'webp', true],
  ['disp', 'disp', 'webp', true],
];
/* Mirrors scene.js's own boot default; re-asserted here only so the strength is
   restored when we hand the built-in blob noise back at disposal. */
const MACRO_STRENGTH = 0.55;
/* /textures holds five ground sets by construction, and a set is now up to SEVEN
   entries, not five: the two maps in HIRES_MAPS may be resident at BOTH
   resolutions at once, because the near band wants the 4k one and the 340 m
   road strip wants the 2k one and they are different surfaces. 5 x 7 + the
   macro tile = 36 is therefore the legitimate ceiling; past 40 something is
   asking for files that are not in the shared directory at all. */
const MAX_SHARED = 40;

/* THE 4k VARIANT — see the header block for the VRAM arithmetic behind picking
   two maps out of five. `diffuse` is what the eye lands on and `normal` is the
   relief at the grazing angles ground is always seen at; `rough`/`ao` are
   low-frequency multiplies over both and `disp` is not even bound by scene.js.
   Nothing outside the near band ever asks for these.

   WHAT IS ACTUALLY ON DISK, and why `normal` is still listed. The asset build
   shipped `<set>_diff_4k.webp` for asphalt/grass/gravel and NO 4k normals — the
   same VRAM call, made independently. So the normal entry costs three
   debug-level 404s on first boot (one per set, then `missingHiRes` silences it
   for the session, and the 2k normal is used) and buys automatic pickup the day
   a `_nor_4k.jpg` appears, with no code change. If those 404s are ever worth
   removing, deleting 'normal' from this Set is the whole edit — and the day the
   maps land, adding it back is the whole edit in the other direction. */
const HIRES_MAPS = new Set(['diffuse', 'normal']);
const HIRES_SUFFIX = '_4k';

/** '/textures/asphalt_diff.webp' → '/textures/asphalt_diff_4k.webp' */
function hiResPath(p: string) {
  const s = String(p);
  const dot = s.lastIndexOf('.');
  /* A dot in a DIRECTORY name is not an extension. Compare against the last
     separator or './foo/bar' would come out as './foo_4k/bar'. */
  return dot > s.lastIndexOf('/') ? s.slice(0, dot) + HIRES_SUFFIX + s.slice(dot)
    : s + HIRES_SUFFIX;
}

/* Hi-res URLs that came back 404 — the asset agent may have swapped the 4k
   files in under the base names instead of adding `_4k` siblings, and either
   layout has to work. Unlike loadShared(), this one IS memoised: it is not
   recording "the network failed", it is recording "this optional variant does
   not exist in this build", which cannot change without a reload. Paying the
   404 once per session instead of once per environment switch is the whole
   point of the set. */
const missingHiRes = new Set<string>();

/** @type {Map<string, THREE.Texture>} */
const sharedTex = new Map<string, THREE.Texture>();
/** @type {Map<string, Promise<THREE.Texture|null>>} in flight, so a double
 *  apply cannot start the same download twice */
const sharedPending = new Map<string, Promise<THREE.Texture | null>>();

function loadShared(url: string, onProg: (e: ProgressEvent) => void,
  optional?: boolean): Promise<THREE.Texture | null> {
  const hit = sharedTex.get(url);
  if (hit) return Promise.resolve(hit);
  let p = sharedPending.get(url);
  if (p) return p;
  p = loadTex(url, onProg, optional).then(tex => {
    sharedPending.delete(url);
    /* A failure is NOT memoised: the next environment switch may well be on a
       working connection, and a permanently-missing map would be indis-
       tinguishable from one dropped packet. The retry costs one request per
       environment id, because the entry cache above skips this whole path. */
    if (tex) {
      sharedTex.set(url, tex);
      if (sharedTex.size > MAX_SHARED) {
        console.warn('[truck-studio] ' + sharedTex.size + ' texturas de chão residentes: '
          + 'os cenários deveriam compartilhar os conjuntos de /textures.');
      }
    }
    return tex;
  });
  sharedPending.set(url, p);
  return p;
}

/**
 * Load `url`, falling back to `fallback` if it is not there.
 *
 * The hi-res request is made OPTIONAL whatever the caller asked for — a missing
 * `_4k` sibling is expected data in the swap layout, not a fault, and the
 * warning that matters is the one the fallback emits if the base map is missing
 * too. The tracker slot is shared by both attempts: makeTracker's `set` is a
 * running MAX, so the fallback's fractions climb from wherever the failed probe
 * left the slot instead of rewinding the bar.
 */
function loadSharedPreferred(url: string, fallback: string | null,
  onProg: (e: ProgressEvent) => void, optional?: boolean): Promise<THREE.Texture | null> {
  if (!fallback) return loadShared(url, onProg, optional);
  return loadShared(url, onProg, true).then(tex => {
    if (tex) return tex;
    missingHiRes.add(url);
    return loadShared(fallback, onProg, optional);
  });
}

/* A private VIEW of a shared texture. The near-ground disc and the road strip
   sample the same FILES but tile them differently, and `texture.repeat` lives
   on the TEXTURE, not on the material: scene.js's setGroundMaps() writing
   [4, 113] for the 12 x 340 m strip would silently re-tile the disc, and
   setNearGround() writing its own metres-per-tile would flatten the strip's
   340 m of asphalt into one stretched copy. Whoever ran last would win.

   clone() copies the parameters and SHARES `.source`, and three keys its GL
   textures by (source, parameter cache key) with a use count — so the bytes are
   uploaded once for both views and only the JS object is duplicated. */
function cloneTex(t: THREE.Texture | null | undefined) { return t ? t.clone() : null; }

/**
 * Manifest-relative paths of one PBR set, or null for an unknown name.
 * `override` (a `nearGround.maps` block, or the environment's own `ground`
 * block when it happens to describe the same surface) names files directly and
 * wins per key — the convention is a fallback, not a straitjacket, so renaming
 * an asset does not silently 404 every scene that uses it.
 */
function setPaths(name: unknown, override: unknown): SetPaths | null {
  const n = typeof name === 'string' ? name.trim().toLowerCase() : '';
  const o = override && typeof override === 'object' ? override as RawBlock : null;
  const base = GROUND_SETS.includes(n) ? n : null;
  if (!base && !o) return null;
  const out: SetPaths = { name: base || 'custom' };
  for (const [key, suffix, ext] of SET_MAPS) {
    out[key] = path(o && o[key])
      || (base ? SHARED_DIR + base + '_' + suffix + '.' + ext : null);
  }
  /* No albedo, no surface: an untinted grey disc in the middle of a photograph
     is worse than the soft projected floor it would replace. */
  return out.diffuse ? out : null;
}

const warnedNoNear = new Set<string>();

/* Exactly scene.js's TINT_HEX. Deliberately the same grammar in both places: a
   form this accepted and tintColor() did not would be silently dropped at the
   far end and the band would render untinted with nothing in the console. */
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const tint = (v: unknown): string | null =>
  (typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : null);

/* THE MEASURED FORM OF THE SAME THING, and the reason it had to exist.
   scene.js's tintColor() reads a hex as a COLOUR SAMPLE: it discards the
   sample's luminance, damps its chroma toward white and clamps a level derived
   from a power of that luminance. Those defences are right for an eyeballed hex
   and destroy a solved one — the manifest's measured grass correction #b3e8e7
   came out of it as 0.87/1.35/1.34, i.e. it BRIGHTENED the verge, which is why
   the shipped grass rendered as washed-out khaki.
   `tintRgb`/`vergeTintRgb` are three LINEAR MULTIPLIERS that reach
   material.color untouched, and they WIN over the hex. Validated here as well
   as in scene.js — same grammar in both places, so a form this accepts and
   scene.js drops cannot exist. Clamped there, not here: one owner for the
   range. */
const tintArr = (v: unknown): number[] | null => {
  if (!Array.isArray(v) || v.length < 3) return null;
  const n = [+v[0], +v[1], +v[2]];
  return n.every(Number.isFinite) ? n : null;
};

/* One place derives the dome radius, because the dome geometry, the near-ground
   extent and the camera clamp all have to agree on the SAME number.
   Capped at 250 m so the dome always fits inside camera.far (600, or
   max(size*10, 700) after frameAll) with the camera at the far side of it. */
function domeRadiusOf(g: unknown) { return clamp(field(g, 'radius', 60), 12, 250); }

/**
 * The CG near-ground band: which PBR sets it needs and how far it reaches.
 * Only ever active UNDER a dome — with no photograph behind it there is nothing
 * to blend into and the procedural road is already the whole scene.
 *
 * @returns {null|{material: string, verge: string|null, radius: number,
 *                 fade: number, repeat: number, tint: string|null,
 *                 macro: string, paths: {main: Object, verge: Object|null}}}
 */
interface NearGround {
  material: string;
  verge: string | null;
  /** null = não autorado; nearGroundOpts() OMITE a chave (ver o comentário lá) */
  width: number | null;
  radius: number;
  fade: number;
  /** metros por tile, NÃO a contagem [u, v] de `ground.repeat` */
  repeat: number;
  vergeRepeat: number | null;
  tint: string | null;
  vergeTint: string | null;
  tintRgb: number[] | null;
  vergeTintRgb: number[] | null;
  edgeNoise: Pair | null;
  wear: number | null;
  undulation: Pair | null;
  macro: string;
  paths: { main: SetPaths; verge: SetPaths | null };
}
function resolveNearGround(envDef: EnvironmentDef): NearGround | null {
  const g = envDef.grounded;
  if (!g || typeof g !== 'object' || g.enabled !== true) return null;

  const raw = (envDef.nearGround && typeof envDef.nearGround === 'object')
    ? envDef.nearGround : null;
  if (raw && raw.enabled === false) return null;

  /* WHY THERE IS A DEFAULT AT ALL. catalog.js's normalizeEnvironment() is a
     WHITELIST — a manifest field it does not name is dropped before it ever
     reaches us (its own comment says so, right above `grounded:`). If
     `nearGround` has not been added there yet, every scene would silently fall
     back to a projected floor at radius 150, i.e. the blurry near field this
     whole round exists to remove. So a grounded scene gets a sane CG band
     derived from `ground.type` either way, and the manifest block refines it.
     Deliberately conservative where guessing would be worse than nothing:
       * no `verge` is invented — grass sprouting along a city street is a more
         obvious error than a uniform surface;
       * no `tint` is invented — it has to be sampled from the panorama, and a
         wrong one is exactly the "carpet dropped into a photo" look. */
  const gr = envDef.ground || null;
  const material = (raw && typeof raw.material === 'string' && raw.material)
    || (gr && gr.type)
    || 'asphalt';
  /* resolveNearGround() is pure and gets called a few times per apply (the
     request list, the camera clamp, the scene call), so the hint is once per
     environment id, not once per call. */
  if (!raw && !warnedNoNear.has(envDef.id)) {
    warnedNoNear.add(envDef.id);
    console.debug('[truck-studio] "' + envDef.id + '" sem bloco nearGround: usando o padrão'
      + ' derivado de ground.type ("' + material + '"). Se o manifesto TEM o bloco, ele está'
      + ' sendo filtrado por normalizeEnvironment() em catalog.js.');
  }
  /* When the disc and the road strip are the same surface, the environment has
     ALREADY named its files — inherit them instead of re-deriving paths that
     may differ in extension (the normals are jpg, everything else webp) or
     point at a per-scene variant. The convention still fills the gaps. */
  const sameAsGround = !!(gr && typeof gr.type === 'string'
    && gr.type.trim().toLowerCase() === String(material).trim().toLowerCase());
  const main = setPaths(material, (raw && raw.maps) || (sameAsGround ? gr : null));
  if (!main) {
    console.warn('[truck-studio] nearGround.material desconhecido em "' + envDef.id
      + '": ' + material);
    return null;
  }
  const verge = raw ? setPaths(raw.verge, raw.vergeMaps) : null;

  /* The CG band has to end well inside the dome: past ~0.75·radius the
     GroundedSkybox floor is already curving up into the sky, and a fade that
     lands on the curve reads as a ring. */
  const dome = domeRadiusOf(g);
  const radius = clamp(field(raw, 'radius', 55), 8, dome * 0.75);
  const fade = clamp(field(raw, 'fade', 25), 0, Math.max(0, dome - radius));

  /* Omitted rather than nulled when unauthored. scene.js reads it with the same
     `num(v, d)` idiom this file uses, and `+null` is 0, not NaN — a null here
     would clamp the road strip's width to its 2 m minimum instead of taking the
     12 m default. Absent keys are the only safe way to say "use your default". */
  const rawWidth = field(raw, 'width', NaN);
  const width = rawWidth > 0 ? clamp(rawWidth, 2, radius * 2) : null;

  return {
    material: main.name,
    verge: verge ? verge.name : null,
    width,
    radius,
    fade,
    /* metres per texture tile — NOT the [u, v] tile COUNT that `ground.repeat`
       uses. Two different units on two different surfaces; scene.js documents
       both. */
    repeat: clamp(field(raw, 'repeat', 3), 0.05, 100),
    /* The verge is a DIFFERENT texture set with a different physical tile size —
       leafy_grass is 2.00 m, asphalt_04 is 4.04 m. Driving both off one number
       makes whichever one loses twice as coarse as it should be. Falls back to
       the primary's when unauthored, which is right for a same-surface verge. */
    vergeRepeat: raw && Number.isFinite(raw.vergeRepeat)
      ? clamp(raw.vergeRepeat as number, 0.05, 100) : null,
    tint: tint(raw && raw.tint),
    /* The verge is a different surface, so it gets its own sample or none —
       tinting grass with a sample of asphalt is worse than not tinting it. */
    vergeTint: tint(raw && raw.vergeTint),
    /* The SOLVED multipliers, which beat the hex sample when present. Every
       shipped scene authors these; the hex fields are kept live for a manifest
       that only has an eyedropper. */
    tintRgb: tintArr(raw && raw.tintRgb),
    vergeTintRgb: tintArr(raw && raw.vergeTintRgb),
    /* --- the three "not too static" knobs, resolved to `null` when unauthored
       so nearGroundOpts() can OMIT the key rather than pass a zero. scene.js
       reads them with the same `num(v, d)` idiom this file uses and `+null` is
       0, so an explicit null would read as "amplitude 0", i.e. the feature
       silently off with nothing in the console. --- */
    /* Metres of boundary wander, metres per period. The amplitude is capped at
       the road's half-width: a wander wider than that does not make an
       irregular edge, it makes the verge cross the centreline. */
    edgeNoise: pair(raw && raw.edgeNoise, 0, (width || 12) / 2, 0.5, 200),
    /* 0 disables. Dirt creeping off the verge onto the carriageway plus
       darkened wheel tracks — a fraction, so the range is the whole range. */
    wear: field(raw, 'wear', NaN) >= 0 ? clamp(field(raw, 'wear', 0), 0, 1) : null,
    /* Vertical displacement of the disc. Capped hard at 25 cm: the truck sits
       on this surface with its wheels grounded at y = 0, so anything the eye
       reads as a HILL puts the tyres in the air. The authored values are
       ~6 cm. */
    undulation: pair(raw && raw.undulation, 0, 0.25, 0.5, 400),
    macro: MACRO_NOISE,
    paths: { main, verge },
  };
}

/* ---------------- props ----------------
   THE SPLIT WITH scatter.js. Both modules can load a prop .glb, and which one
   does it is not arbitrary:

     scatter.js owns the SCATTER props. It does not just download them, it
       PREPARES them — flattening each glTF into per-material instancing
       variants with baked transforms — and it holds that prepared form in its
       own id-keyed LRU. Loading them here as well would mean two caches of two
       different things over the same geometry, with two disposal owners. So
       this module only WEIGHS them: preloadProps(ids, onProgress) exists
       precisely so the downloads can be folded into the bar below before
       applyScatter() is called, and by then every id is a cache hit.
     this module owns the LAMP MODEL, because its consumer is scene.js, not
       scatter.js: setLampModel() takes a plain glTF scene, clones it per unit
       and measures it. Running it through the instancing pipeline would be
       wrong, so it is downloaded and cached here.

   KEYED BY PROP ID, NOT BY ENVIRONMENT, on both sides. A lamp model is shared
   by two of the three shipped scenes and `grass_medium_01` could be on any of
   them; a per-environment cache would download, decode and hold each of them
   once per scene that names it. So propCache sits BESIDE the per-environment
   LRU exactly like sharedTex does — and for the same second reason: an
   environment falling out of the LRU can then never tear geometry out from
   under a scene that is still standing on it.

   The consequence is that the prop phase runs on the CACHE-HIT path too: a
   resident `entry` says nothing about whether the props are still resident, so
   applyEnvironment() re-resolves them every time (a hit is synchronous and
   weighs 0 in the bar).

   OWNERSHIP OF THE LAMP OBJECT. scene.js's prepareLampModel() does
   `src.clone(true)`, which SHARES geometry and materials — and it takes over
   the lens material's emissive, handing it back on setLampModel(null). So the
   object handed over stays live for as long as it is mounted. The pin below
   (activeProps) is what guarantees the LRU cannot free it underneath. */
const PROPS_DIR = PROPS_DIR_ABS;
const MAX_PROPS = 8;

/** @type {Map<string, THREE.Object3D>} id → the loaded gltf.scene (LRU order) */
const propCache = new Map<string, THREE.Object3D>();
/** @type {Map<string, Promise<THREE.Object3D|null>>} in flight */
const propPending = new Map<string, Promise<THREE.Object3D | null>>();

/* NEVER EVICTED: everything the applied scene is standing on, PLUS everything
   an in-flight apply has already asked for. Both halves are load-bearing.
   Without the first, an eviction pulls the geometry out from under a mounted
   lamp fixture. Without the second, a scene asking for more props than the cap
   evicts its OWN earlier ones while the later ones are still downloading.
   applyEnvironment() adds its ids here before the first request; applyToScene()
   REPLACES the whole set with what it actually mounted, which is also what
   releases a superseded apply's pins. */
const activeProps = new Set<string>();

/* Failed downloads, counted. This is the ONE place a failure is memoised at
   all, and the reason it differs from loadShared()'s deliberate no-memo policy
   is the shape of the path, not a change of mind: the ground maps hang off the
   per-environment entry, so an un-memoised failure there costs one retry per
   environment ID and then stops. The prop phase runs on EVERY apply (the prop
   cache is keyed by id, so a resident entry proves nothing about it), which
   would make a prop that is genuinely absent from the build cost one request
   and one console line on every single scene switch, for the whole session.
   One retry is the balance: a single dropped packet still recovers, and a
   missing asset stops asking. Cleared by disposeEnvironments(). */
const propFails = new Map<string, number>();          // id → consecutive failures
const PROP_RETRIES = 1;
const propGaveUp = (id: string) => (propFails.get(id) || 0) > PROP_RETRIES;

/* scatter.js memoises loadPropCatalog() on the PROMISE, so calling it from here
   as well shares the one request rather than racing it. This flag only exists
   so the catalog can be weighed at 0 once it is resident — that is not
   something a memoised call on the other side of the boundary can tell us. */
let propCatalogReady = false;
function ensurePropCatalog() {
  return loadPropCatalog().then(c => { propCatalogReady = true; return c; },
    /* loadPropCatalog() already degrades internally (empty catalog, everything
       falls back to the conventional path) and never rejects — this is only
       here so a future change to it cannot take an environment switch down. */
    err => { console.debug('[truck-studio] catálogo de props indisponível', err); return null; });
}

/** Manifest-relative path of a prop's .glb. */
function propFile(id: string) {
  const def = getPropDef(id);
  return path(def && def.file) || (PROPS_DIR + id + '.glb');
}

function disposeProp(obj: THREE.Object3D | null | undefined) {
  if (!obj) return;
  obj.traverse(node => {
    const o = node as THREE.Mesh;
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      /* A prop's textures are EMBEDDED in its .glb, so unlike the shared ground
         sets nothing else can be pointing at them — walking the material for
         anything that is a texture is safe here and is the only way to catch
         the alpha/emissive slots a luminaire material uses. */
      for (const k in m) {
        /* O laço é DUCK-TYPED de propósito (é o comentário acima): varre TODOS
           os slots e deixa `.isTexture` decidir. Só o tipo do índice é
           afirmado; o guard continua sendo o que separa textura de número. */
        const v = (m as unknown as Record<string, THREE.Texture | undefined>)[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    }
  });
}

/** Mark `id` most-recently-used and evict down to MAX_PROPS. */
function touchProp(id: string): THREE.Object3D | null {
  const obj = propCache.get(id);
  if (!obj) return null;
  propCache.delete(id);
  propCache.set(id, obj);                     // Map keeps insertion order = LRU
  while (propCache.size > MAX_PROPS) {
    let victim: string | null = null;
    for (const k of propCache.keys()) { if (!activeProps.has(k)) { victim = k; break; } }
    /* Everything resident is pinned: refuse. A visible hole in the scene is
       worse than being over budget, and the budget is advisory — MAX_PROPS is
       a guard against a pathological manifest, not a hard VRAM ceiling. */
    if (victim === null) break;
    disposeProp(propCache.get(victim));
    propCache.delete(victim);
  }
  return obj;
}

/**
 * One prop .glb, loaded and cached by THIS module. Resolves null on any
 * failure — a missing lamp model costs the upgrade, not the scene.
 * @param {Promise<*>} catP resolved BEFORE the request goes out, because
 *   props.json is what names the file. On a cache hit it is not awaited at all,
 *   which is what keeps a re-visit synchronous.
 * @param {(f:number)=>void} onProg NOTE: loadGLB() reports a FRACTION, not a
 *   ProgressEvent — do not run it through fraction().
 */
function loadProp(id: string, catP: Promise<unknown>,
  onProg: (f: number) => void): Promise<THREE.Object3D | null> {
  const hit = propCache.get(id);
  if (hit) return Promise.resolve(touchProp(id));
  /* Asked for, tried, gone. Silent — it warned when it gave up. */
  if (propGaveUp(id)) return Promise.resolve(null);
  const inflight = propPending.get(id);
  if (inflight) return inflight;

  const p = catP
    .then(() => loadGLB(assetUrl(propFile(id)), onProg))
    .then(obj => {
      propPending.delete(id);
      if (!obj) return null;
      obj.name = 'prop:' + id;
      propFails.delete(id);
      propCache.set(id, obj);
      return touchProp(id);
    })
    .catch(err => {
      propPending.delete(id);
      const n = (propFails.get(id) || 0) + 1;
      propFails.set(id, n);
      console.warn('[truck-studio] prop não carregou: ' + id
        + (n > PROP_RETRIES ? ' (desistindo)' : ''), err);
      return null;
    });
  propPending.set(id, p);
  return p;
}

/* Which scatter ids have been through preloadProps() successfully. Only used to
   weigh them at 0 on a re-visit — scatter.js's cache is the real authority and
   it has its own LRU, so this can be optimistic: over-reporting residency makes
   the bar finish a shade early, never late. */
const preloaded = new Set<string>();

/* One warning per environment id, not one per apply — resolveNearGround()'s
   pattern, and for the same reason: catalog.js's normalizeEnvironment() is a
   WHITELIST, so `scatter`/`roadside` disappear silently if they have not been
   added to it and the scene just comes out bare with nothing in the console. */
const warnedNoScatter = new Set<string>();

/** Entries of a manifest scatter/roadside array that actually name a prop. */
function specList(v: unknown): RawBlock[] {
  return Array.isArray(v)
    ? v.filter(s => s && typeof s === 'object' && path(s.prop)) : [];
}

/**
 * What this environment needs, split by who loads it.
 *
 * The LAMP is collected whether or not there is a near band: lamps stand on
 * every scene including the procedural fallback (setLamps(null) is documented
 * as "the built-in roadside row"), so a manifest that names a lamp model wants
 * it even with no dome up. The SCATTER is not: its zones ('verge', 'edge',
 * 'road') are defined against the near band's geometry, so with no band there
 * is nothing to place things on and the download would buy nothing.
 *
 * @param {boolean} wantScatter true ⇒ this scene can have a near band
 * @returns {{lampModel: string|null, scatterIds: string[]}}
 */
function collectPropIds(envDef: EnvironmentDef,
  wantScatter: boolean): { lampModel: string | null; scatterIds: string[] } {
  const lamps = (envDef.lamps && typeof envDef.lamps === 'object') ? envDef.lamps : null;
  const lampModel = lamps ? path(lamps.model) : null;
  const scatterIds: string[] = [];
  if (wantScatter) {
    const specs = specList(envDef.scatter).concat(specList(envDef.roadside));
    for (const s of specs) {
      const pid = path(s.prop);
      if (pid && !scatterIds.includes(pid)) scatterIds.push(pid);
    }
    /* Counted on the SPECS, not on the ids — a scene that names a lamp model
       and nothing else would otherwise look like it had props and the
       whitelist trap would go unreported. */
    if (!specs.length && !warnedNoScatter.has(envDef.id)) {
      warnedNoScatter.add(envDef.id);
      console.debug('[truck-studio] "' + envDef.id + '" sem scatter/roadside: o campo próximo'
        + ' fica sem geometria. Se o manifesto TEM os blocos, eles estão sendo filtrados por'
        + ' normalizeEnvironment() em catalog.js.');
    }
  }
  return { lampModel, scatterIds };
}

/**
 * The manifest's `scatter` and `roadside` arrays as ONE list for scatter.js.
 *
 * Flat rather than `{scatter, roadside}` because normalizeSpecs() reads a flat
 * array too, and every original field is passed through untouched: scatter.js
 * owns the placement semantics, this module only owns which specs are LIVE.
 * `mode` is set explicitly rather than left to be inferred from which fields an
 * entry happens to carry — a roadside line that takes the default `spacing`
 * would otherwise be indistinguishable from a scattered field.
 */
function scatterSpecs(envDef: EnvironmentDef): RawBlock[] {
  const out: RawBlock[] = [];
  for (const s of specList(envDef.scatter)) out.push({ ...s, mode: 'scatter', prop: path(s.prop) });
  for (const s of specList(envDef.roadside)) out.push({ ...s, mode: 'roadside', prop: path(s.prop) });
  return out;
}

/* applyScatter() clears the previous scene itself and carries its own
   generation counter (a stale call bails instead of dropping the old scene's
   furniture into the new one), so no serialising wrapper is needed here. This
   only has to stop a broken prop from rejecting the environment switch. */
function driveScatter(specs: SpecInput, opts: ScatterOpts) {
  return applyScatter(specs, opts).catch(err => {
    console.warn('[truck-studio] espalhamento de props falhou', err);
    try { clearScatter(); } catch (_) { /* ignore */ }
  });
}
/**
 * Equirect DataTexture → PMREM render target.
 * @param {THREE.Texture} tex
 * @param {boolean} keep  true ⇒ the caller still needs the equirect (a grounded
 *   dome will sample it directly) and takes over its disposal.
 */
function toPmrem(tex: THREE.Texture, keep: boolean): THREE.WebGLRenderTarget | null {
  try {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const w = (tex.image && tex.image.width) || 0;
    if (w > 2048) {
      /* cubeSize = width/4, and the target is 3·cubeSize x 4·cubeSize
         half-float RGBA — 4k in means ~100 MB out, per cached environment. */
      console.warn('[truck-studio] HDRI de ' + w + 'px: considere 2k para o web (VRAM do PMREM cresce com o quadrado).');
    }
    const rt = pmrem.fromEquirectangular(tex);
    if (!keep) tex.dispose();    // nothing samples the equirect after this
    return rt;
  } catch (err) {
    console.warn('[truck-studio] falha ao gerar o PMREM do HDRI', err);
    if (!keep) { try { tex.dispose(); } catch (_) { /* ignore */ } }
    return null;
  }
}

/* The LDR background image is drawn by a MESH, so none of the equirect-specific
   sampler setup three does for scene.background applies — we do it here. */
function prepBackgroundTex(t: THREE.Texture | null): THREE.Texture | null {
  if (!t) return null;
  /* Inert for a mesh `.map` (that path samples the geometry's UVs, not a
     direction) but it costs nothing and keeps the texture legal to hand to
     scene.background if this ever needs a non-grounded LDR sky. */
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  /* The equirect seam is at u = 0/1 and the sphere's last UV column lands
     exactly on it — ClampToEdge leaves a visible hairline there once the mip
     chain kicks in. v must NOT wrap: that would fold the poles into each other. */
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  /* Higher than the engine's usual 8 on purpose: the entire point of this
     texture is the ground UNDER the truck, which is seen at a grazing angle —
     the one situation where anisotropic filtering is worth real money. */
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  return t;
}

/* ---------------- camera containment ----------------
   The illusion dies the instant the camera reaches the dome wall: you look at
   the photograph's horizon from OUTSIDE it and the floor funnels away. Two
   independent escape routes have to be closed —
     zoom out → controls.maxDistance, which OrbitControls clamps the orbit
                radius against on every update();
     pan      → nothing in OrbitControls bounds `target`, and panning drags the
                camera with it, so we bound it ourselves.
   The two budgets ADD (|camera| ≤ |target| + orbit radius), so ORBIT + PAN is
   the number that has to stay small, not either one alone.

   The budget is NOT `grounded.radius`. GroundedSkybox only flattens the
   vertices below y = −1.5·height, and it scales their xz by height/|y| on the
   way — so the truly FLAT floor stops at (2/3)·radius·sqrt(1 − (1.5h/r)²), i.e.
   ~0.61·radius at the tessellation we ship, and everything from there out to
   `radius` is the smooth floor→dome blend. Measured against the real class at
   several h/r: 0.60–0.65·radius. Standing past that is not fatal (the surface
   curves gently, it is not a wall) but the ground starts to bowl, so
   ORBIT + PAN targets the flat disc and CAM_F is the hard "never near the wall"
   backstop.

   THE DOME IS NO LONGER THE BINDING CONSTRAINT. It was, at radius 46-55 m:
   0.48*55 = 26 m of orbit is a perfectly reasonable wide shot of a truck. Now
   that the photograph has been pushed back to ~150 m so its far field holds up,
   the same fractions would allow 72 m of orbit and 21 m of pan — geometrically
   safe and visually useless. At the camera's 45 deg vertical FOV a 16:9 frame
   is 1.47*d metres wide, so an 18 m rig covers

       26 m -> 47 % of the frame width       (what shipped, and it read well)
       34 m -> 36 %                          a wide establishing shot
       50 m -> 24 %
       72 m -> 17 %                          a toy in the middle of a field

   so the clamp is now MIN(what the subject can stand, what the dome allows,
   what the CG ground covers):

     SUBJECT_ORBIT 34 m — the widest framing that still reads as a photograph OF
       A TRUCK. Also ~2.3x the ~15 m distance frameAll() picks for the rig,
       which is the zoom range people actually use.
     SUBJECT_PAN 10 m — a little over the rig's half-length, so the target can
       sit at either end of the trailer for a three-quarter composition and no
       further. (The dome fraction gave 7.7 m at radius 55; this keeps that feel
       instead of scaling to 21 m for free.)
     nearGround.radius + fade — the camera should stay roughly over the CG band
       rather than out on the projected photo, whose whole problem is that it is
       soft up close. The FULL extent, not the opaque part: the shipped discs
       are 26 + 18, 18 + 14 and 22 + 16 m, so clamping to the opaque radius
       would cap the orbit at 26 m — a permanent close-up.

   The three shipped scenes come out at 34 m (rodovia, 44 m of CG), 32 m (patio,
   32 m of CG) and 34 m (urbano, 38 m of CG), with 10 m of pan each. Worst case
   is 44 m from the origin, less than a third of the way to a 150 m dome wall —
   so DOME_CAM_F is a pure backstop that never bites any more. */
const DOME_ORBIT_F = 0.48;   // controls.maxDistance, as a fraction of the radius
const DOME_PAN_F = 0.14;     // how far the orbit target may leave the origin
const DOME_CAM_F = 0.75;     // hard ceiling on |camera| — never the wall itself
const MIN_ORBIT = 12;        // metres: a 16 m rig still has to fit on screen
const SUBJECT_ORBIT = 34;    // metres: framing ceiling, whatever the dome allows
const SUBJECT_PAN = 10;      // metres: the target stays on the rig

/* Whatever OrbitControls was configured with before any dome existed. Restored
   verbatim when a non-grounded environment is applied — this module must not
   become the de-facto owner of a control it only borrows. */
const BASE_MAX_DISTANCE = controls.maxDistance;

let camLimit = 0;            // 0 ⇒ no dome; the frame guard is a no-op
let panLimit = 0;

/* Registered ONCE, at module eval: onFrame() has no deregister and the engine is
   a singleton that outlives the React page.

   Why this is safe to do from outside scene.js: the hook runs after
   controls.update() and before renderer.render() in the same frame, and
   OrbitControls re-derives its spherical from the LIVE camera position at the
   top of every update() — so a write here sticks instead of being undone on the
   next tick. scene.js's own loop has already applied the CAM_MIN_Y floor by
   then; we only add the ceiling, so the two guards cannot fight.

   CAM_MIN_Y (0.15 m) still makes sense, and matters MORE than it used to: the
   projected floor is a hard visual plane at exactly y = 0, so dipping below it
   would put the camera under the photograph. Together with
   maxPolarAngle = π/2 − 0.02 the camera stays in the upper half of the dome. */
onFrame(() => {
  if (!camLimit) return;
  const t = controls.target;
  const p = camera.position;
  let moved = false;

  const td = Math.hypot(t.x, t.z);
  if (td > panLimit) {
    /* Undo the excess as a PAN — move target and camera by the same delta — so
       the orbit radius, and therefore the framing, does not jump. Correcting
       only the target would change the distance and make maxDistance yank the
       camera in. */
    const k = panLimit / td - 1;
    const dx = t.x * k, dz = t.z * k;
    t.x += dx; t.z += dz;
    p.x += dx; p.z += dz;
    moved = true;
  }
  const pd = Math.hypot(p.x, p.z);
  if (pd > camLimit) { const k = camLimit / pd; p.x *= k; p.z *= k; moved = true; }
  if (p.y > camLimit) { p.y = camLimit; moved = true; }

  /* controls.update() already aimed the camera from its PRE-clamp position, so
     re-aim it — exactly what OrbitControls itself ends update() with. The
     renderer refreshes matrixWorld for a parentless camera at the top of
     render(), which runs after every frame hook, so this lands this frame. */
  if (moved) camera.lookAt(t);
});

/* ---------------- grounded skybox ---------------- */

let activeDome: GroundedSkybox | null = null;       // the mesh currently in the scene, if any
let domeMat: THREE.MeshBasicMaterial | null = null;          // its material, or null — the rig hook's on/off switch
let domeIntensity = 1;       // envDef.envIntensity for the mounted dome

/* The dome is a mesh, so scene.backgroundIntensity — which is how a plain HDRI
   background gets dimmed — does not reach it. Mirror that clamp by hand or a
   "noite" preset over a daylight panorama darkens the truck, the lamps and the
   fog while leaving the sky blazing midday.
   Same formula as the GUARD in scene.js applyRig(): the env def sets the level,
   the preset only MODULATES it, and min(1, k) stops a bright preset from
   over-driving a photograph the way it may over-drive a synthetic gradient. */
onRig((rig: Rig) => {
  if (!domeMat) return;
  /* DAY-FOR-NIGHT. A photographic plate has ONE baked time of day: a noon
     panorama cannot become a night photograph, and `envIntensity` alone barely
     moves between the day and night faces of a preset — which left the sky
     blazing midday behind a truck lit by street lamps. So the plate is folded
     down hard and cooled as `nightness` rises, exactly the way a matte painter
     grades a day plate for a night shot.

     The 6 % floor is STYLISED, not physical. Moonlit ground is ~1e-5 of sunlit;
     taking that literally would give a black rectangle with a lit truck pasted
     on it, which reads as a bug rather than as night. 6 % keeps the horizon and
     the treeline legible as silhouettes, which is what sells it. */
  const night = Math.min(1, Math.max(0, rig.nightness || 0));
  const dim = 1 - 0.94 * night;
  const k = domeIntensity * Math.min(1, Math.max(0, rig.envIntensity)) * dim;
  /* setScalar writes working-space (linear) components directly, which is
     exactly what a radiometric multiplier should be — do NOT use set()/setHex(),
     those would run an sRGB decode on the number.
     Since preparePlateMaterial() this multiplies SCENE-REFERRED radiance, i.e.
     it is a real exposure change and the ACES shoulder rolls the highlights off
     instead of the framebuffer clipping them. The min(1, …) clamp is kept even
     so: it was there to stop a bright preset blowing out the photograph, and
     while the clip it guarded against is gone, the intent — the preset
     MODULATES an environment-authored level rather than setting it — has not
     changed. */
  /* Cool the plate as it darkens — the Purkinje shift means night reads blue,
     and a merely dimmer daylight plate reads as underexposed daylight instead.
     Written as linear components for the same reason setScalar() was. */
  domeMat.color.setRGB(k * (1 - 0.18 * night), k * (1 - 0.10 * night), k);
});

/**
 * Build (or reuse) this environment's ground-projected dome.
 * @returns {THREE.Mesh|null} null ⇒ take the procedural route
 */
function ensureDome(envDef: EnvironmentDef, entry: CacheEntry): GroundedSkybox | null {
  const g = envDef.grounded;
  if (!g || typeof g !== 'object' || g.enabled !== true) return null;
  if (entry.dome) return entry.dome;

  /* LDR background first. At 2k equirect the nadir — the ground directly under
     the camera, i.e. the pixels the eye actually lands on — is only a few
     hundred texels across, so a ground-projected 2k HDRI is soft exactly where
     it must not be. envDef.backgroundImage is a much larger tonemapped JPG that
     costs a fraction of a 4k .hdr to download; the HDRI keeps doing the
     lighting and the reflections either way. */
  const map = entry.bg || entry.sky;
  if (!map) return null;

  const height = clamp(num(g.height, 2), 0.2, 40);
  const radius = domeRadiusOf(g);
  const resolution = Math.round(clamp(num(g.resolution, 128), 8, 512));
  if (radius <= height * 3) {
    /* GroundedSkybox blends floor into dome across y = −1.5·height; below that
       ratio the "floor" is all blend and the projection is meaningless. */
    console.warn('[truck-studio] grounded.radius pequeno demais para grounded.height em "'
      + envDef.id + '" — usando o cenário procedural.');
    return null;
  }

  try {
    const dome = new GroundedSkybox(map, height, radius, resolution);
    /* The constructor centres the projection on the camera that shot the photo;
       lifting it by `height` is what puts the floor at y = 0, where the truck
       and the shadow catcher are. */
    dome.position.y = height;
    /* FOG: OFF. MeshBasicMaterial defaults to fog:true, so this is a decision,
       not an oversight. Three reasons, in order of weight:

       1. THE DOME'S DISTANCE IS FICTIONAL. Fog is a function of depth, and the
          dome has none: `radius` is a projection parameter chosen to place the
          horizon pleasantly, not the distance to anything in the picture. The
          treeline in `estrada-rural` may be 800 m away and the crane in
          `patio-logistico` 120 m, and both land on the same 60-70 m shell.
          Attenuating them by that shell's radius is not aerial perspective, it
          is arithmetic on a number that means nothing. The photograph already
          carries the real thing, baked in at the real distances.
       2. fogColor IS AUTHORED FOR THE PROCEDURAL SKY. It is preset data — a
          flat 0xcfd5d6 for Neblina — with no relationship to a given
          panorama's horizon. At Neblina's density (0.0165) a 70 m dome comes
          out ~62 % fogged, i.e. a golden-hour patio washed toward cold grey.
          That is not "foggy", it is broken.
       3. Every other background in this engine is unfogged: three's own
          background pass and scene.js's sky dome both set fog:false. The
          projected photo has taken over that role, so this is consistency.

       What still gets fogged is everything with a REAL distance: the truck, the
       lamp poles, and the shadow catcher — which is exactly where the presets
       were tuned. The catcher cannot disagree with the dome at the horizon
       because it never reaches it: scene.js clamps it to 48 m to match the key
       light's ±24 m shadow frustum, and the shadow itself lives within ~15 m of
       the truck, where even Neblina is under 6 %.

       The alternative N3 raised — fog:true plus a reduced fog.density while a
       dome is up — is not implementable from this module in any case: applyRig()
       writes scene.fog.density unguarded on every tween frame and every slider
       event, so a second writer here would simply be overwritten. It would have
       to be a scene.js change. */
    dome.material.fog = false;
    /* ONE TONE MAP FOR THE PHOTO AND THE CG ALIKE — the plate transfer
       function. scene.js owns the maths and the reasoning
       (preparePlateMaterial); this is the one place that has to know WHICH KIND
       of source the dome is sampling:

         entry.bg   the tonemapped `sky.jpg`. DISPLAY-REFERRED, so it is decoded
                    back to scene-referred with the analytic inverse of three's
                    own ACES fit before the renderer re-applies it.
         entry.sky  the raw `.hdr`. Already scene-referred; it must NOT be
                    decoded, only tone mapped like everything else.

       This replaces `toneMapped = false` on the JPG branch, which put the photo
       and every CG surface through DIFFERENT transfer functions and made the
       near-ground band unmatchable by construction (measured: the CG road on
       `rodovia` landed 3.0-4.7x brighter than the photographed road it sits
       against). Two consequences beyond the match: the exposure slider now
       moves the photo with the truck instead of only the truck, and the
       envIntensity/day-night gain below becomes a real exposure change with an
       ACES shoulder instead of a display-space multiply that hard-clips
       (`patio-logistico`, dome gain 1.1875: clipped pixels 0.59 % → 0.14 %).

       Written as "is this the LDR image?" rather than "is this the .hdr?"
       because that is the question being asked, and because all three shipped
       scenes now ship a `backgroundImage` — the JPG branch is the LIVE one and
       the .hdr branch is the fallback for a scene without one. (The two forms
       agree: `entry.sky` is only non-null when no background image loaded, and
       `map` is `entry.bg || entry.sky`, so exactly one of them is `map`.) */
    preparePlateMaterial(dome.material, { inverse: map === entry.bg });
    /* depthWrite is already false from the constructor. Draw first so the dome
       never paints over geometry: with depthWrite off and depthTest on either
       order is correct, but first is deterministic and matches what the
       background pass used to do. */
    dome.renderOrder = -1;
    /* The camera is always inside it and the geometry is deformed after
       construction — skip the bounding-sphere round trip entirely. */
    dome.frustumCulled = false;
    dome.name = 'grounded-skybox:' + envDef.id;
    dome.userData.radius = radius;
    entry.dome = dome;
    return dome;
  } catch (err) {
    /* GroundedSkybox throws on non-positive dimensions; the clamps above make
       that unreachable, but a manifest is external data and this must never be
       the thing that takes the studio down. */
    console.warn('[truck-studio] domo projetado não pôde ser criado: ' + envDef.id, err);
    return null;
  }
}

/** Swap the mounted dome (null ⇒ back to a normal background) and re-arm or
 *  release the camera containment that goes with it. */
function mountDome(dome: GroundedSkybox | null, envDef: EnvironmentDef | null) {
  if (activeDome && activeDome !== dome) scene.remove(activeDome);
  activeDome = dome || null;
  domeMat = null;

  if (!dome) {
    controls.maxDistance = BASE_MAX_DISTANCE;
    camLimit = 0;
    panLimit = 0;
    return;
  }

  /* SAME SIGN as the rotation handed to setExternalEnvironment — see the header.
     These two must never drift: a reflection that disagrees with the visible
     background is instantly readable as fake. */
  /* `envDef!` daqui para baixo: os dois parâmetros andam juntos por contrato —
     só disposeEnvironments() chama com (null, null), e essa chamada já voltou
     no `if (!dome)` acima. O tipo não consegue amarrar os dois. */
  dome.rotation.y = num(envDef!.envRotation, 0);
  if (dome.parent !== scene) scene.add(dome);
  domeMat = dome.material;
  domeIntensity = Math.max(0, num(envDef!.envIntensity, 1));

  /* The dome IS the background now. Leaving scene.background bound would draw
     the whole sky a second time, full-screen, immediately before painting over
     it. applyRig()'s `if (!externalEnv)` guard means nothing puts it back while
     the HDRI is up, and setExternalEnvironment(null) restores it. */
  scene.background = null;

  const radius: number = dome.userData.radius;
  const near = resolveNearGround(envDef!);

  /* Every ceiling in one place — see the containment block for where each
     number comes from. MIN_ORBIT wins over all of them: a viewer that cannot
     back far enough away to see the truck is a worse failure than any of the
     artefacts these guard against. */
  const pan = Math.min(radius * DOME_PAN_F, SUBJECT_PAN);
  let orbit = clamp(radius * DOME_ORBIT_F, MIN_ORBIT, SUBJECT_ORBIT);
  /* Stay roughly over the CG band. `radius + fade`, not `radius`: the fade is
     where the CG dissolves INTO the photo, so the ground under the camera there
     is still mostly CG, and the shipped discs are small (26 + 18 m on
     `rodovia`) — clamping to the opaque part alone would cap the orbit at 26 m
     and turn every scene into a close-up. */
  if (near) orbit = Math.min(orbit, Math.max(MIN_ORBIT, near.radius + near.fade));
  /* and keep ORBIT + PAN inside the hard "never near the wall" ceiling */
  orbit = Math.min(orbit, Math.max(MIN_ORBIT, radius * DOME_CAM_F - pan));

  controls.maxDistance = orbit;
  camLimit = radius * DOME_CAM_F;
  panLimit = pan;
}

/* ---------------- cache ---------------- */

function disposeEntry(entry: CacheEntry | null | undefined) {
  if (!entry) return;
  /* dispose the RENDER TARGET, not just rt.texture — the texture alone leaves
     the framebuffer and its attachment allocated */
  if (entry.rt) entry.rt.dispose();
  if (entry.sky) entry.sky.dispose();
  if (entry.bg) entry.bg.dispose();
  if (entry.dome) {
    entry.dome.geometry.dispose();
    /* material.map is entry.sky or entry.bg, disposed just above */
    entry.dome.material.dispose();
  }
  /* entry.ground and entry.macro hold references INTO sharedTex, which outlives
     the LRU on purpose (see the shared-set section). Disposing them here would
     tear a texture out from under whichever other environment shares it — the
     asphalt set is used by two of the three shipped scenes.
     disposeEnvironments() is the only thing that may free those.
     entry.near is different: those are this entry's own clones (private
     `repeat`), so they ARE its to release. Releasing a clone only decrements
     three's use count for the shared GL texture; the original view keeps it
     alive. Safe to do here because touch() never evicts the entry on screen and
     runs synchronously before applyToScene() re-points the disc. */
  const n: Partial<NearTexSet> = entry.near || {};
  for (const s of [n, n.verge]) {
    if (!s) continue;
    for (const [key] of SET_MAPS) if (s[key]) s[key].dispose();
  }
}

function touch(id: string, entry: CacheEntry) {
  cache.delete(id);
  cache.set(id, entry);                       // Map keeps insertion order = LRU
  while (cache.size > MAX_CACHE) {
    /* `!`: o laço só roda com size > MAX_CACHE ≥ 1, então há sempre uma chave. */
    const oldest = cache.keys().next().value!;
    /* never evict what is on screen */
    if (oldest === id || (current && oldest === current.id)) break;
    disposeEntry(cache.get(oldest));
    cache.delete(oldest);
  }
}

/** Release every cached HDRI/dome/ground texture and return the scene to
 *  procedural. */
export function disposeEnvironments() {
  mountDome(null, null);              // detach + hand the camera limits back
  setExternalEnvironment(null);
  setGroundMaps(null);
  setNearGround(null);
  setShadowCatcher(null);
  /* PROPS OUT OF THE SCENE BEFORE THEIR GEOMETRY IS FREED. scatter.js's
     InstancedMeshes are built from its cached prop geometry, and scene.js's
     lamp fixtures are clones that SHARE the cached lamp's geometry and
     materials — disposing either while it is still mounted renders as garbage.
     Order: unmount (clearScatter / setLampModel(null)), then free. */
  try { clearScatter(); } catch (_) { /* ignore */ }
  setLampModel(null);                 // null ⇒ the procedural pole primitives
  setLamps(null);                     // null ⇒ the built-in roadside row
  /* Hand the built-in blob noise back BEFORE the downloaded tile is freed:
     scene.js keeps whatever texture it was given in a live uniform, and a
     disposed one renders as undefined sampler state on the next frame. */
  setMacroVariation(null, MACRO_STRENGTH);
  for (const entry of cache.values()) disposeEntry(entry);
  cache.clear();
  /* Safe here and nowhere else: every material that could still be pointing at
     one of these has just been handed its procedural map back by the calls
     above. In-flight loads are NOT cancelled — they resolve into an empty
     sharedTex, which is exactly a cold cache. */
  for (const t of sharedTex.values()) t.dispose();
  sharedTex.clear();
  /* Safe for the same reason: clearScatter() and setLampModel(null) above have
     already taken every prop out of the scene. In-flight loads resolve into an
     empty propCache, which is exactly a cold cache. */
  activeProps.clear();
  for (const o of propCache.values()) disposeProp(o);
  propCache.clear();
  propPending.clear();
  propFails.clear();
  /* scatter.js's own prepared-prop cache. Called with no argument ⇒ keep
     nothing. It only frees what it downloaded itself, which is exactly the
     scatter props — the lamp is this module's and is freed just above. */
  disposeProps();
  preloaded.clear();
  /* The catalog is scatter.js's and memoised on its promise, so it stays; the
     flag only drives the progress weight and re-deriving it costs nothing. */
  propCatalogReady = false;
  current = null;
  hdriOn = false;
}

/* ---------------- apply ---------------- */

/**
 * Merge the resolved near-ground block with the textures that actually arrived.
 * The albedo is the one map with no fallback: without it the band would be a
 * flat grey ring, which is worse than the soft photo it replaces. The verge is
 * optional by design and is dropped the same way if its own albedo is missing —
 * and dropping it means something in scene.js: WITH a verge the primary set is
 * the road strip and the verge covers the rest of the band; WITHOUT one the
 * primary set covers the whole band and there is no strip at all, which is
 * exactly right for a hardstanding.
 * @returns {Object|null} opts for scene.js's setNearGround()
 */
/* As chaves OPCIONAIS aqui são exatamente as que este módulo OMITE quando não
   autoradas — ver a nota logo abaixo e em resolveNearGround(): passar null e
   não passar nada são instruções diferentes para scene.js. */
interface VergeOpts extends TexSet {
  type: string | null;
  tint: string | null;
  tintRgb?: number[];
  repeat?: number;
}
interface NearGroundOpts extends TexSet {
  type: string;
  radius: number;
  fade: number;
  repeat: number;
  tint: string | null;
  tintRgb?: number[];
  verge: VergeOpts | null;
  width?: number;
  edgeNoise?: Pair;
  wear?: number;
  undulation?: Pair;
}
function nearGroundOpts(ng: NearGround | null, entry: CacheEntry): NearGroundOpts | null {
  const tex = (entry && entry.near) || null;
  if (!ng || !tex || !tex.diffuse) return null;
  const v = (tex.verge && tex.verge.diffuse) ? tex.verge : null;
  const out: NearGroundOpts = {
    /* `type` only drives how the surface behaves when wet — the maps are what
       it looks like. */
    type: ng.material,
    diffuse: tex.diffuse,
    rough: tex.rough,
    normal: tex.normal,
    ao: tex.ao,
    disp: tex.disp,
    radius: ng.radius,
    fade: ng.fade,
    /* METRES PER TILE here, tile COUNTS in setGroundMaps().repeat — two
       different units, one word, so it passes through unconverted. */
    repeat: ng.repeat,
    /* Solved against the panorama's own ground in the band the CG disc
       replaces. This, not the fade width, is what decides whether the ring is
       visible — and after the plate transfer function it is a real measurement
       rather than an eyedropper, so `tintRgb` is the live field and `tint` is
       the legacy sample it overrides. */
    tint: ng.tint,
    ...(ng.tintRgb ? { tintRgb: ng.tintRgb } : {}),
    verge: v ? {
      type: ng.verge,
      tint: ng.vergeTint,
      ...(ng.vergeTintRgb ? { tintRgb: ng.vergeTintRgb } : {}),
      /* Omitted, not nulled, when unauthored — scene.js falls back to the
         primary's tile, and an explicit null would read as 0. */
      ...(ng.vergeRepeat !== null ? { repeat: ng.vergeRepeat } : {}),
      diffuse: v.diffuse, rough: v.rough, normal: v.normal, ao: v.ao, disp: v.disp,
    } : null,
  };
  /* OMITTED, NOT NULLED, when unauthored — see the note in resolveNearGround().
     `+null` is 0, so passing a null through would read at the far end as
     "amplitude 0 / no wear" and quietly beat scene.js's own default instead of
     deferring to it. */
  if (ng.width !== null) out.width = ng.width;
  /* The three organic knobs. Irregular material boundary, dirt/gravel creeping
     off the verge plus darkened wheel tracks, and a few centimetres of
     low-frequency displacement so the disc is not a perfect plane. */
  if (ng.edgeNoise) out.edgeNoise = ng.edgeNoise;
  if (ng.wear !== null) out.wear = ng.wear;
  if (ng.undulation) out.undulation = ng.undulation;
  return out;
}

/**
 * Bind everything to the scene. Synchronous except for the scatter, which is
 * returned as a promise so applyEnvironment() can keep its "resolves when the
 * scene is visually ready" contract.
 *
 * @param {{ids: string[], lampModel: string|null}} props resolved by
 *   applyEnvironment(); the ids are looked up in propCache HERE rather than
 *   carried on `entry`, because the prop cache is keyed by id and has its own
 *   LRU — an id that was resident when the entry was built may not be now.
 * @returns {Promise|null}
 */
function applyToScene(envDef: EnvironmentDef, entry: CacheEntry,
  props: { lampModel: string | null }) {
  const hasHdri = !!(entry && entry.rt);
  /* A projected floor needs the HDRI's IBL to make any sense — a photographed
     ground lit by the procedural gradient sky looks worse than no photo at all —
     so a failed HDRI drops the whole grounded path, not just the lighting. */
  const dome = hasHdri ? ensureDome(envDef, entry) : null;
  const grounded = !!dome;

  /* THE CG NEAR FIELD. Only under a dome: with no photograph behind it there is
     nothing to blend into, the procedural road already IS the whole scene, and a
     band fading to alpha 0 over a visible ground plane would just be a stain.
     `ng` survives a failed download (it is manifest data) while `near` does not,
     which is what lets the fallback below still borrow the photo-matched tint. */
  const ng = grounded ? resolveNearGround(envDef) : null;
  const near = ng ? nearGroundOpts(ng, entry) : null;

  const g = envDef.ground || null;
  const maps: TexSet = (entry && entry.ground) || {};
  /* THE TWO CG GROUNDS ARE MUTUALLY EXCLUSIVE. The near band contains its own
     road strip (its primary set, with the verge either side), and the
     procedural strip underneath would show through the band's dissolve — so
     when the band is up, the strip is hidden and retexturing it would only pay
     for a program recompile per material per environment switch. */
  const hasMaps = !near && !!(maps.diffuse || maps.rough || maps.normal);

  /* Ground first: setGroundMaps() re-baselines the dry albedo and replays the
     current wetness, so doing it before the preset change means the tween
     starts from the right colour instead of correcting a frame later. */
  if (hasMaps) {
    setGroundMaps({
      diffuse: maps.diffuse,
      rough: maps.rough,
      normal: maps.normal,
      ao: maps.ao || null,
      disp: maps.disp || null,
      /* Only reachable when the band could not be built while the dome still
         stands, and then the photo-matched correction is exactly as right for
         the procedural strip as it would have been for the band — same
         surface, same rig, same plate. */
      tint: ng ? ng.tint : null,
      ...(ng && ng.tintRgb ? { tintRgb: ng.tintRgb } : {}),
      /* TILE COUNTS [u, v] here — setNearGround() takes metres per tile. */
      /* `g!`: o Array.isArray() acima já testou `g && g.repeat`, então o ramo
         verdadeiro só é alcançado com `g` preenchido — o tsc não propaga a
         narrowing de dentro da chamada. */
      repeat: Array.isArray(g && g.repeat) ? g!.repeat : [4, 60],
      /* With showRoad:false the asphalt strip is hidden, so the surface the
         truck actually stands on is the big ground plane — texture that one. */
      target: envDef.showRoad === false ? 'grass' : 'asphalt',
    });
  } else {
    setGroundMaps(null);
  }

  /* Unconditional, including with null: a scene without a band must not inherit
     the previous scene's. */
  setNearGround(near);
  /* Only worth a call when it changes something: the band tiles at 2.5-4 m over
     a 32-44 m disc, so without the low-frequency multiply there are ~10 visible
     repeats across it. A failed download leaves scene.js's own blob noise in
     place, which is why the texture argument may safely be null. */
  if (near) {
    const macroTex = (entry && entry.macro) || null;
    /* The strength is calibrated PER SOURCE, so a supplied texture must let
       scene.js pick its own default rather than inherit ours. The built-in blob
       canvas is near-binary and 0.55 suits it; macro_noise.webp is σ≈0.115, where
       0.55 works out to ±4.8 % — invisible, i.e. the repetition this exists to
       break would still be there. Omitting the argument is how scene.js is told
       "you know what this texture needs". */
    if (macroTex) setMacroVariation(macroTex);
    else setMacroVariation(null, MACRO_STRENGTH);
  }

  /* `showSkyDome` and `showRoad` describe what the PHOTO is expected to supply.
     The sky, always, whenever a dome is up — the CG dome would be drawn over it.

     THE ROAD IS THE BAND'S JOB NOW, WHEN THERE IS A BAND. setNearGround()'s
     primary set IS the road strip (the verge covers the rest), so the
     procedural strip has to go: it sits at y = -0.01 under a band at y = +0.002
     and would show through the dissolve. scene.js warns once if both are left
     visible; this is the driver that keeps that warning silent.

     Without a band, `showRoad` means exactly what it always meant and the
     manifest decides per scene — `rodovia`/`urbano` true, `patio-logistico`
     false, because a freight yard has no lane markings and gravel shoulders
     across a hardstanding would be nonsense. And with no photo at all (a dead
     HDRI, or a grounded scene whose dome could not be built) the CG sky and CG
     road are the only content left, so they come back whatever the manifest
     asked for: honouring `showRoad:false` there leaves the truck on a bare
     grass plane under a gradient, which reads as a bug.

     The one thing lost either way is the painted lane markings: they live in
     the procedural strip's canvas albedo, and neither a PBR set on that strip
     nor the near band carries them. That is a deliberate trade — photographed
     asphalt under the tyres beats a painted line seen from 30 m.

     Note the ROAD is not the LAMPS: setRoadVisible() stopped taking the poles
     with it last round, which is what let the yard keep its lighting. */
  setSkyDomeVisible(grounded ? false : (hasHdri ? envDef.showSkyDome === true : true));
  setRoadVisible(near ? false : (hasHdri ? envDef.showRoad !== false : true));

  /* The truck has to keep dropping a real shadow onto the photographed ground —
     it is the single strongest cue that the CG object is standing on the plate.
     Off again the moment the procedural plane (which receives shadows itself)
     comes back, or the scene would show two.
     `{}` rather than a default object: setShadowCatcher() falls back to its own
     numbers (48 m, matching the key light's ±24 m shadow frustum, and 0.42) for
     any field we leave out, and duplicating them here would let the two drift.
     Grounded ALWAYS gets a catcher, authored block or not — a photographed floor
     is the one surface that cannot receive a shadow by itself.
     A copy either way: these calls cross an ownership boundary and scene.js
     normalising the manifest object in place would mutate the catalog. */
  setShadowCatcher(grounded ? { ...(envDef.shadowCatcher || null) } : null);

  /* ---- REAL GEOMETRY: the lamp model, then the scatter ----
     REPLACING `activeProps` here is what releases the previous scene's pins and
     any left by a superseded apply — and it happens BEFORE anything is touched,
     because touchProp() picks its LRU victim from whatever is NOT pinned. */
  const lampId = (props && props.lampModel) || null;
  activeProps.clear();
  if (lampId && propCache.has(lampId)) activeProps.add(lampId);

  /* BEFORE setLamps(), which lays the pool out: scene.js scales and orients the
     luminaire from the model's own height, so the layout has to run against the
     geometry it will actually be moving. `null` (no `lamps.model`, or the .glb
     failed) is documented as "keep the procedural primitives" — which is what
     the assetless path gets, and what a broken download degrades to. */
  setLampModel((lampId && touchProp(lampId)) || null);

  /* Every scene gets poles, including the yard and including the assetless
     fallback: `null` is documented as "the built-in roadside row", not "none",
     and an author who wants none writes `"lamps": { "enabled": false }`. The
     lamp SPOTLIGHTS are a fixed pool of 8 that setLampsEnabled() gates on
     day/night — this only moves the geometry, so it is free to call per swap. */
  setLamps(envDef.lamps ? { ...envDef.lamps } : null);

  /* THE SCATTER FOLLOWS THE BAND, NOT THE DOME. Its zones ('verge', 'edge',
     'road') are defined against the near-ground disc's geometry, so with no
     band there is no coordinate system to place anything in — a tuft would end
     up floating over the projected photograph, which is precisely the artefact
     the fade band exists to avoid. A dead HDRI therefore drops the scatter with
     the band, and the empty call still runs so the previous scene's props are
     cleared (applyScatter([]) clears and returns without touching the network).

     The prop objects are NOT passed: they are in scatter.js's own prepared
     cache, warmed by preloadProps() during the load phase above, so every id
     here is a hit. Handing over the raw glTF scenes as well would make it
     re-prepare geometry it has already prepared. */
  const scatterP = driveScatter(near ? scatterSpecs(envDef) : [], {
    /* SEEDS THE PRNG. The same scene must lay out identically every time it is
       applied, or switching away and back rearranges the yard. */
    envId: String(envDef.id || 'env'),
    /* The band's geometry, so the zone masks and the density falloff agree with
       what is actually drawn. Purpose-built rather than passing `ng` itself:
       `width` and `edgeNoise` are OMITTED when unauthored, and scatter.js reads
       them with `num(v, d)` — where `+null` is 0, not NaN, so a null `width`
       would clamp the carriageway to its 2 m minimum and put the verge zone
       right under the truck. */
    /* O `as`: scatter.js LÊ este campo como opcional
       (`opts.nearGround && typeof opts.nearGround === 'object'`), mas o tipo
       que ele exporta declara só `Record<string, unknown> | undefined` — o
       `null` daqui, que é o "cena sem faixa", fica de fora. O cast cobre esse
       buraco de assinatura, não o valor. */
    nearGround: (ng ? {
      radius: ng.radius,
      fade: ng.fade,
      /* string set-name or null; scatter.js tests it for truthiness, and ABSENT
         would default it to true. */
      verge: ng.verge,
      ...(ng.width !== null ? { width: ng.width } : {}),
      ...(ng.edgeNoise ? { edgeNoise: ng.edgeNoise } : {}),
    } : null),
  });

  const rot = num(envDef.envRotation, 0);

  if (hasHdri) {
    /* `!`: `hasHdri` É `!!(entry && entry.rt)` — o tsc não propaga a narrowing
       através do booleano intermediário. */
    const tex = entry.rt!.texture;
    setExternalEnvironment(tex, {
      background: tex,
      rotation: rot,
      /* A grounded dome IS the background, so blurring it would only pay for a
         second PMREM of a texture nothing ever draws. */
      blurriness: grounded ? 0 : num(envDef.backgroundBlur, 0),
      intensity: num(envDef.envIntensity, 1),
    });
  } else {
    setExternalEnvironment(null);
  }

  /* AFTER setExternalEnvironment, which binds scene.background — mountDome()
     clears it, and nothing rebinds it while externalEnv is non-null. */
  mountDome(dome, envDef);

  setExposureBase(num(envDef.exposure, 1));

  /* timeOfDay BEFORE preset: applyPreset() derives its default sun az/el from
     the CURRENT sceneState.timeOfDay, so the other order would hand a night
     preset the daytime sun angles.
     animate:false for both — an environment switch happens behind the selector
     overlay, and a 0.8 s crossfade between two unrelated rigs (plus a second
     beginTween cancelling the first mid-flight) reads as a glitch, not a
     transition. Note this also resets az/el/brightness to the preset defaults:
     the environment dictates the light rig, so the sidebar sliders must be
     re-read from sceneState afterwards.
     It is also what drives the rig hook that colours the dome, so the dome
     picks up its envIntensity on this call, not a frame later. */
  setTimeOfDay(envDef.timeOfDay === 'noite' ? 'noite' : 'dia', { animate: false });
  applyPreset(envDef.preset, { animate: false });

  current = envDef;
  hdriOn = hasHdri;
  return scatterP;
}

/**
 * Apply a map/environment definition: load + cache its HDRI, its ground-
 * projection background, its PBR ground sets (4k for the near band, 2k for the
 * road strip), its macro noise and its prop .glbs; bind scene.background /
 * scene.environment; mount or drop the ground-projected dome; lay the CG
 * near-ground band under it; scatter the props onto that band; retexture the
 * road; toggle the procedural sky dome and road; place the shadow catcher, the
 * street lamps and their model; and apply the light preset + time of day +
 * exposure.
 *
 * Never rejects: a 404 or a decode error degrades to the procedural
 * environment (which needs zero downloaded assets) and resolves. Every
 * downgrade is independent — a dead AO map costs an AO map, a dead prop costs
 * that prop's specs, a dead lamp model falls back to the procedural pole, and a
 * dead HDRI costs the whole photographic path (and with it the band and the
 * scatter) but still leaves a lit, textured scene.
 *
 * @param {Object} envDef            an entry from catalog.js's `environments`
 * @param {(p:number)=>void} [onProgress]  0..1
 * @returns {Promise<Object|null>}   the applied envDef
 */
export async function applyEnvironment(envDef: EnvironmentDef | null | undefined,
  onProgress?: (p: number) => void): Promise<EnvironmentDef | null> {
  if (!envDef || typeof envDef !== 'object') return current;

  const token = ++seq;
  const report = typeof onProgress === 'function' ? onProgress : () => { };
  report(0);

  const id = String(envDef.id || 'env');
  const hdriPath = path(envDef.hdri);
  const wantGrounded = !!(envDef.grounded && envDef.grounded.enabled === true && hdriPath);
  const bgPath = wantGrounded ? path(envDef.backgroundImage) : null;
  const ng = wantGrounded ? resolveNearGround(envDef) : null;
  /* GROUND MAPS ARE BACK FOR GROUNDED SCENES. The previous round skipped these
     three requests because the projected photo supplied the floor; now a 2k PBR
     set is the whole near field, and `nearGround.material` resolves to the same
     files this block names — so for every shipped scene they are FREE (the
     request list below deduplicates by URL) and they are what the procedural
     strip falls back to if the band cannot be built.
     Skipped only for a grounded scene with showRoad:false: there the strip
     stays hidden whatever happens, and the 700 m plane is hidden by the shadow
     catcher, so nothing would ever sample them. */
  const ground = (wantGrounded && envDef.showRoad === false) ? null : (envDef.ground || null);

  let entry = cache.get(id) || null;
  let cacheable = true;               // false only for a freshly FAILED HDRI

  /* WHICH PROPS, AND WHY THIS IS OUTSIDE THE `!entry` BLOCK. Props are cached
     by prop id in a cache of their own (see the props section), so a resident
     ENVIRONMENT entry says nothing about whether its props are still resident —
     an id may have been evicted by another scene since. Re-resolving is free on
     a hit (propCache lookup, no await) and correct on a miss. */
  const { lampModel, scatterIds } = collectPropIds(envDef, !!ng);
  const needCatalog = (lampModel || scatterIds.length) && !propCatalogReady;
  /* PIN BEFORE THE FIRST REQUEST — see activeProps. loadProp() touches the LRU
     as the .glb lands, and the scene currently ON SCREEN keeps its own pins
     until applyToScene() replaces the set. */
  if (lampModel) activeProps.add(lampModel);

  /* ONE request list, deduplicated by URL. `rodovia` names the same asphalt
     set twice (the road strip via `ground`, the near-ground disc via
     `nearGround.material`) and `urbano` names a set `rodovia` already
     downloaded — without the dedup that is the same 2k map fetched, decoded
     and uploaded twice. Empty on the cache-hit path: the textures are already
     on `entry` and only the props still have to be resolved. */
  const req = new Map<string, ReqEntry>();              // url → { weight, optional, fallback }
  let gUrl: UrlSet | null = null, nUrl: NearUrlSet | null = null;
  if (!entry) {
    /**
     * @param {boolean} [hires] this URL is for the NEAR BAND, so prefer the 4k
     *   variant of the maps in HIRES_MAPS. The base path becomes the fallback,
     *   because `_4k` is a convention the asset build may not have used (it may
     *   have swapped the 4k files in under the base names instead).
     */
    const want = (rel: unknown, weight: number, optional: boolean,
      hires?: boolean): string | null => {
      const p = path(rel);
      if (!p) return null;
      const base = assetUrl(p);
      let url = base, w = weight, fallback = null;
      if (hires) {
        const alt = assetUrl(hiResPath(p));
        /* Known missing from an earlier scene: go straight to the base path,
           and weigh it as the 2k download it will actually be. */
        if (!missingHiRes.has(alt)) { url = alt; w = W_MAP_4K; fallback = base; }
      }
      const prev = req.get(url);
      /* asked for twice ⇒ required wins, so a 404 is still reported once */
      if (prev) { if (!optional) prev.optional = false; return url; }
      /* Already resident: weight 0, or the bar would hold back a fraction of
         itself for a request that never happens. */
      req.set(url, {
        weight: sharedTex.has(url) ? 0 : w, optional: !!optional, fallback,
      });
      return url;
    };
    const wantSet = (s: UrlSet | null, hires: boolean): UrlSet | null => {
      if (!s) return null;
      const out: UrlSet = {};
      for (const [key, , , optional] of SET_MAPS) {
        out[key] = want(s[key], key === 'disp' ? W_DISP : W_MAP, optional,
          hires && HIRES_MAPS.has(key));
      }
      return out;
    };

    /* The road strip's own set — 2k, VERBATIM. It is the fallback surface for a
       scene whose band could not be built, it is 340 m long and it is never
       seen from closer than tens of metres; 4k there is VRAM spent on texels
       that never reach a pixel. `ao`/`disp` are read the same way as the near
       ground's, so a manifest that names them gets them on both surfaces — but
       nothing is invented here: unlike a PBR set, `ground` is a list of files,
       and a path that is not in it is not requested. */
    gUrl = wantSet(ground && {
      diffuse: ground.diffuse, rough: ground.rough, normal: ground.normal,
      ao: ground.ao, disp: ground.disp,
    }, false);
    /* The near band — 4k where it counts. This is the surface the camera sits
       3 m from and the whole reason the round exists. */
    nUrl = ng ? {
      main: wantSet(ng.paths.main, true),
      verge: wantSet(ng.paths.verge, true),
      /* Optional: scene.js falls back to its own canvas blob noise, which is
         the same idea at a lower quality. Never hi-res — it is deliberately a
         very low frequency tile and 4k of it would be 4k of nothing. */
      macro: want(ng.macro, W_MACRO, true, false),
    } : null;
  }

  const urls = [...req.keys()];
  /* Slot layout: 0 HDRI, 1 background, 2..N ground maps, then props.json, then
     the lamp model, then the whole scatter-prop list as ONE slot (scatter.js's
     preloadProps reports a single fraction over it, not per file). Anything
     already resident weighs 0 — a request that never happens must not be able
     to hold the bar back. */
  const CAT_SLOT = 2 + urls.length;
  const LAMP_SLOT = CAT_SLOT + 1;
  const SCAT_SLOT = LAMP_SLOT + 1;
  const coldScatter = scatterIds.filter(pid => !preloaded.has(pid)).length;
  const weights = [
    (!entry && hdriPath) ? W_HDRI : 0,
    (!entry && bgPath) ? W_BG : 0,
    /* `!`: `urls` são as próprias chaves de `req`. */
    ...urls.map(u => req.get(u)!.weight),
    needCatalog ? W_PCAT : 0,
    (lampModel && !propCache.has(lampModel) && !propGaveUp(lampModel)) ? W_PROP : 0,
    coldScatter * W_PROP,
  ];
  const track = makeTracker(weights, report);

  /* Compile the equirect→cubeUV shader while the bytes are still in flight;
     it is a few ms of stall otherwise, right when the first frame lands. */
  if (!entry && hdriPath) { try { pmrem.compileEquirectangularShader(); } catch (_) { /* ignore */ } }

  /* props.json has to land before the first .glb URL is known, so it is the one
     thing that cannot be fully parallel. It is a couple of kB and it is
     memoised on the promise inside scatter.js, so the serialisation costs one
     round trip on first boot and nothing after — and it does NOT delay the
     HDRI, the background or the ground maps, which all start on the same tick
     as this. */
  const catP = (lampModel || scatterIds.length)
    ? ensurePropCatalog().then(c => { track.set(CAT_SLOT, 1); return c; })
    : Promise.resolve(null);

  /* HDRI, background image, every ground map and every prop download in
     PARALLEL — they are independent, and the small ones ride along for free. */
  const all = await Promise.all([
    (!entry && hdriPath)
      ? loadHdr(assetUrl(hdriPath), e => track.set(0, fraction(e))).then(t => { track.set(0, 1); return t; })
      : Promise.resolve(null),
    (!entry && bgPath)
      ? loadTex(assetUrl(bgPath), e => track.set(1, fraction(e))).then(t => { track.set(1, 1); return t; })
      : Promise.resolve(null),
    ...urls.map((u, i) => {
      const r = req.get(u)!;
      return loadSharedPreferred(u, r.fallback, e => track.set(i + 2, fraction(e)), r.optional)
        .then(t => { track.set(i + 2, 1); return t; });
    }),
    catP,
    /* loadGLB() reports a FRACTION, not a ProgressEvent — no fraction() here. */
    lampModel
      ? loadProp(lampModel, catP, f => track.set(LAMP_SLOT, f))
        .then(o => { track.set(LAMP_SLOT, 1); return o; })
      : Promise.resolve(null),
    /* Warms scatter.js's own prepared-prop cache so applyScatter() below is all
       cache hits — this is the whole reason preloadProps() is exported. It
       never rejects (each prop degrades to a dead cache entry), but the catch
       is here because a scenery download must never fail an environment
       switch. */
    scatterIds.length
      ? preloadProps(scatterIds, f => track.set(SCAT_SLOT, f))
        .then(() => { for (const pid of scatterIds) preloaded.add(pid); track.set(SCAT_SLOT, 1); })
        .catch(err => { console.warn('[truck-studio] props do cenário não carregaram', err); })
      : Promise.resolve(null),
  ]);

  if (!entry) {
    const hdr = all[0];
    const bgTex = all[1];
    /* O `as`: o Promise.all é uma tupla variádica, e os slots 0/1 saem tipados
       sozinhos — mas slice() sobre uma tupla devolve a UNIÃO de todos os slots
       (catálogo, lâmpada, void). O recorte 2..N é o layout documentado logo
       acima e é sempre textura de chão. */
    const groundTex = all.slice(2, 2 + urls.length) as (THREE.Texture | null)[];
    const byUrl = new Map(urls.map((u, i) => [u, groundTex[i] || null]));
    const tex = (u: string | null | undefined) => (u ? byUrl.get(u) || null : null);
    /* cloneTex, not the shared texture itself — see the note at its definition:
       the disc and the road strip need independent `repeat`. */
    const texSet = (s: UrlSet | null): TexSet | null => {
      if (!s) return null;
      const out: TexSet = {};
      for (const [key] of SET_MAPS) out[key] = cloneTex(tex(s[key]));
      return out.diffuse ? out : null;
    };

    /* Keep the raw equirect alive ONLY when a dome will sample it directly:
       GroundedSkybox reads its map through the sphere's UVs, so the CubeUV
       atlas that is the PMREM cannot stand in for it (see the header). With a
       backgroundImage the dome has a sharper, cheaper source and the ~16 MB of
       half-float goes back to the driver as it always did. */
    const keepEquirect = wantGrounded && !bgTex;
    const rt = hdr ? toPmrem(hdr, keepEquirect) : null;

    entry = {
      rt,
      sky: (rt && keepEquirect) ? hdr : null,
      /* No IBL ⇒ the whole grounded path is off (see applyToScene), so a
         background image that arrived anyway has no consumer. Drop it now
         rather than hold megabytes for a code path that cannot run. */
      bg: rt ? prepBackgroundTex(bgTex) : null,
      dome: null,
      /* References INTO sharedTex — see disposeEntry() for why they are not
         this entry's to free. */
      ground: gUrl ? {
        diffuse: tex(gUrl.diffuse), rough: tex(gUrl.rough), normal: tex(gUrl.normal),
        ao: tex(gUrl.ao), disp: tex(gUrl.disp),
      } : {},
      /* Gated on `rt` for the same reason `bg` is: without the IBL there is no
         dome, without a dome there is no near-ground band, and the clones would
         be built for a code path that cannot run. */
      near: (nUrl && rt) ? {
        ...texSet(nUrl.main),
        verge: texSet(nUrl.verge),
      } : null,
      macro: (nUrl && rt) ? tex(nUrl.macro) : null,
    };
    if (!rt && bgTex) bgTex.dispose();
    /* toPmrem() failed after we asked it to keep the source: nothing will ever
       sample it. */
    if (!rt && keepEquirect && hdr) hdr.dispose();

    /* Do NOT cache a FAILED HDRI: caching it would make one dropped packet
       permanent for the whole session (the engine outlives the React page), and
       the user's only recourse would be a full reload. A successful load, or an
       environment that never wanted an HDRI, is cached even if a newer apply
       has already overtaken us — the bytes are decoded either way. */
    cacheable = !hdriPath || !!entry.rt;
    if (cacheable) touch(id, entry);
  }

  report(1);

  /* A second applyEnvironment() started while we were awaiting — it owns the
     scene now. Bailing here is what keeps a fast double-click from binding the
     older HDRI on top of the newer one. */
  if (token !== seq) {
    /* uncached + superseded ⇒ nothing will ever reference these again */
    if (!cacheable) disposeEntry(entry);
    return current;
  }

  /* AWAITED, so applyEnvironment() keeps meaning "the scene is visually ready".
     Everything it needs is already decoded and cached by now, so on the happy
     path this is a microtask; on a slow one it is still better than resolving
     into a scene whose verge pops in half a second later, behind a curtain that
     has already come down. It never rejects (driveScatter catches). */
  const scatterP = applyToScene(envDef, entry, { lampModel });
  if (scatterP) await scatterP;
  return current;
}

/** @returns {Object|null} the envDef last applied */
export function getCurrentEnvironment() {
  return current;
}

/** @returns {boolean} true while a photoreal HDRI owns the sky and the IBL */
export function isHdriActive() {
  return hdriOn;
}

/** @returns {boolean} true while the near ground is the panorama's own, i.e.
 *  the procedural road/plane/lamp-lit asphalt is NOT what is on screen. */
export function isGroundProjected() {
  return !!activeDome;
}
