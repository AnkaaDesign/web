/* Instanced scatter: the real geometry that stands on the CG near ground.
   ---------------------------------------------------------------------------
   WHY THIS MODULE EXISTS

   The near band (scene/scene.ts `setNearGround()`) is a photoreal but perfectly flat
   surface with a perfectly straight road edge and nothing standing on it. That
   is the "too static" the user reported: a tiled albedo, however good, has no
   silhouettes, no self-shadowing verticals and no parallax. Grass tufts, rocks,
   weeds, roadside barriers and yard debris are what break it, and they have to
   be real geometry — a decal or a billboard reads as CG from the first frame
   the camera moves.

   ---------------------------------------------------------------------------
   FOUR THINGS THAT ARE NOT NEGOTIABLE

   1. ONE DRAW CALL PER (PROP x MATERIAL). 260 tufts as 260 Meshes is 260 draw
      calls plus 260 shadow-pass draws, on top of whatever the truck already
      costs. As one InstancedMesh it is one of each. Every placement therefore
      lands in a per-prop bucket first and geometry is built once, at the end.

   2. DETERMINISTIC PLACEMENT. `Math.random()` would rearrange the whole verge
      every time the user switched environments and came back, which is a WORSE
      artefact than the static ground we are fixing: a scene the user recognises
      is part of what makes it read as a place. Everything random here comes out
      of mulberry32 seeded from (environment id, spec index, prop id), so the
      same manifest always produces the same field, and editing spec #3 does not
      reshuffle spec #1.

   3. THE FADE BAND IS OFF LIMITS. The near ground dissolves into the projected
      photograph between `radius` and `radius + fade`. A tuft standing in that
      band is a CG object hovering over a photo of a road — exactly the artefact
      the two-band architecture exists to avoid. Nothing is placed beyond
      `radius − seamMargin − (the instance's own footprint radius)`, so even the
      widest instance is fully inside the opaque disc.

   4. THE RIG'S FOOTPRINT STAYS CLEAR, or a bollard grows through the trailer.
      The cab and trailer groups are measured live (vehicle/models.ts `state`), unioned
      and inflated by a margin; the boxes are read from the GROUPS rather than
      `state.cabBox`/`state.trailerBox` because those are captured at load time
      and the trailer moves afterwards (`placeTrailer()` runs on every coupling
      change and cab swap).

   ---------------------------------------------------------------------------
   TWO THREE.JS TRAPS THIS MODULE HAD TO WORK AROUND

   * `InstancedMesh.setColorAt()` IS A SILENT NO-OP ON A STOCK MATERIAL. three
     declares the `vColor` varying and multiplies `instanceColor` into it in the
     VERTEX shader under USE_INSTANCING_COLOR, but `color_pars_fragment` /
     `color_fragment` only declare and apply it under USE_COLOR — i.e. when
     `material.vertexColors === true`. And USE_INSTANCING_COLOR is emitted into
     the vertex prefix ONLY (WebGLProgram builds the fragment prefix from a
     different list), so the fragment side cannot even test for it. Setting
     `vertexColors = true` is the documented fix but needs a COLOR attribute on
     every geometry — a missing one leaves the generic vertex attribute at
     (0,0,0,1) and every instance renders BLACK — i.e. 12 bytes per vertex of
     constant white. We inject the two missing fragment lines instead, guarded
     by our own define so it also reaches the fragment prefix. See
     patchInstanceColor().

   * FRUSTUM CULLING an InstancedMesh uses `object.boundingSphere` (r155+), NOT
     the geometry's — and it is null until something computes it. Left null it
     is computed lazily and correctly, but we compute it explicitly after
     filling the matrices so the very first frame is right and raycasts work.

   ---------------------------------------------------------------------------
   ALPHA-TESTED FOLIAGE

   Poly Haven's grass/weed GLBs are cut-out cards: glTF alphaMode MASK, which
   GLTFLoader turns into `alphaTest = <cutoff>, transparent = false`. That is
   the right choice and we keep it — the alternative (alpha blending) needs
   per-triangle sorting that no instanced draw can provide, and a blended tuft
   would flicker against its own leaves. What plain alpha testing DOES do is
   crawl: the test is a hard per-pixel threshold, so every sub-pixel leaf edge
   pops between covered and not as the camera moves.

   The fix is coverage blending, and three implements it: with
   `material.alphaToCoverage = true` the ALPHA_TO_COVERAGE branch of
   `alphatest_fragment` replaces the `discard` with
   `smoothstep(alphaTest, alphaTest + fwidth(a), a)` and the MSAA resolve turns
   that into real partial coverage. It costs nothing and needs no sorting, but
   it is only meaningful on a multisampled target — so it is enabled only when
   the WebGL context actually granted `antialias`.

   Cut-out cards are also forced DoubleSide: a grass card seen from behind with
   backface culling on simply vanishes, and roughly half of any tuft is seen
   from behind.

   ---------------------------------------------------------------------------
   DISPOSAL

   The engine is a singleton that outlives the React page (see core/dom.ts), so
   anything leaked here leaks for the whole browser session. Two levels:

     clearScatter()   drops the InstancedMeshes. `InstancedMesh.dispose()` is
                      what frees the instanceMatrix/instanceColor GPU buffers
                      (WebGLObjects listens for its 'dispose' event and calls
                      attributes.remove on both), so it is called on every mesh
                      — geometry and materials are NOT touched, they belong to
                      the prop cache and are shared across environments.
     disposeProps()   frees the prop cache itself: our cloned materials, and —
                      only for props this module downloaded — the source
                      geometries and textures. A prop handed in by
                      scene/environment.ts is cached by IT and is never freed here.

   The cache is bounded (MAX_CACHED_PROPS, least-recently-used first) so a
   session that visits every environment cannot grow without limit. */
import * as THREE from 'three';
import { scene, renderer } from './scene';
import { loadGLB, state } from '../vehicle/models';
import { PROPS_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';

/* ---------------- types ---------------- */

/** One entry of /models/props/props.json. */
export interface PropDef {
  id: string;
  /** absolute path; defaults to `/models/props/<id>.glb` */
  file?: string;
  /** keys KIND_DEFAULTS: tuft | weed | rock | debris | barrier | pole | lamp */
  kind?: string;
  /** authored height in metres — the unit-sanity check */
  height?: number;
  /** force the set/single-prop decision instead of measuring it */
  variants?: boolean;
}

/** One placeable piece of a prop, normalised and flattened. */
interface PropVariant {
  /** (geometry x material) pairs with their prop-space transform baked in */
  parts: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[];
  height: number;
  /** half the largest horizontal extent — the footprint used by the min-distance grid */
  radius: number;
}

/** A prepared prop in the cache. */
interface PropEntry {
  id: string;
  def: PropDef | null;
  /** the loaded glTF scene, or null when it failed */
  source: THREE.Object3D | null;
  /** did WE download it? decides who may dispose it */
  owned: boolean;
  variants: PropVariant[];
  kind: string;
  cast?: boolean;
  receive?: boolean;
  /** monotonic stamp for the LRU */
  used: number;
}

/** A scatter or roadside entry, after normalizeSpec(). */
interface Spec {
  prop: string;
  index: number;
  mode: 'scatter' | 'roadside';
  zone: string;
  count: number;
  scaleMin: number;
  scaleMax: number;
  tiltDeg: number | null;
  jitter: number;
  gap: number | null;
  sink: number | null;
  vary: number | null;
  falloff: number;
  spacing: number;
  offset: number;
  phase: number;
  yawDeg: number | null;
  sides: number[];
}

/** The disc the instances live on, resolved from the near-ground block. */
interface DiscGeom {
  radius: number;
  fade: number;
  halfW: number;
  hasVerge: boolean;
  edgeAmp: number;
  /** metres of FULLY opaque CG ground — nothing is placed beyond it */
  discR: number;
}

/** The rig's inflated XZ footprint. */
interface RigBox { x0: number; x1: number; z0: number; z1: number }

/** One placed instance, before it is baked into an InstancedMesh. */
interface Placement { matrix: THREE.Matrix4; color: THREE.Color }

/** Placements grouped by (prop x variant). */
interface Bucket { entry: PropEntry; variant: PropVariant; list: Placement[] }

/** Options accepted by applyScatter(); see its JSDoc. */
export interface ScatterOpts {
  envId?: string;
  seed?: string;
  id?: string;
  /** null is a real value here: a scene with no near ground sends it. */
  nearGround?: Record<string, unknown> | null;
  near?: Record<string, unknown>;
  props?: Record<string, THREE.Object3D>;
  keepClear?: { x: number; z: number; r: number }[];
  margin?: number;
  onProgress?: (t: number) => void;
  [k: string]: unknown;
}

/** What a manifest hands over: a flat array, or the two named lists. */
export type SpecInput =
  | Record<string, unknown>[]
  | { scatter?: Record<string, unknown>[]; roadside?: Record<string, unknown>[] }
  | null
  | undefined;

/* Mensagem legível de um valor lançado — `catch (e)` é `unknown` sob strict. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
/* Same test, but "absent" is a real answer the spec carries as null — the
   per-kind default then fills it in at placement time. */
const nullableNum = (v: unknown): number | null =>
  (Number.isFinite(+(v as number)) ? +(v as number) : null);

/* Sanity ceilings. A manifest typo ("count": 26000) must degrade into a dense
   verge, never into a tab that has to be killed. */
const MAX_PER_SPEC = 1500;
const MAX_INSTANCES = 6000;
const MAX_CACHED_PROPS = 20;
/* Rejection sampling: how many candidate points one instance may burn before we
   accept that its zone is full. Every rejection is a handful of float ops, and
   the acceptance rate of the tightest zone ('edge', ~4 m of x out of a 46 m
   box) is around 40 %, so 48 is generous by an order of magnitude. */
const PLACE_TRIES = 48;
/* Instances may interpenetrate a little — tufts that never touch read as a grid
   of ornaments. This is the fraction of the summed footprint radii below which
   two instances are considered the same clump and one is rejected. */
const OVERLAP_OK = 0.72;
/* Metres of fully-opaque CG ground kept between the outermost instance and the
   start of the dissolve. See the header, point 3. */
const SEAM_MARGIN = 1.5;
/* Rig bounding box inflation. 1.2 m clears the mirrors and keeps a tuft from
   appearing to grow out of a tyre. */
const RIG_MARGIN = 1.2;

/* Per-kind behaviour, keyed by props.json `kind`. `tilt` is degrees of random
   lean, `sink` a fraction of the instance's height buried in the ground (a rock
   resting exactly tangent to the plane looks like it is floating; a pole must
   not), `vary` the per-instance colour amplitude, `gap` a multiplier on the
   footprint radius for the min-distance test, and the two shadow flags.

   receiveShadow is OFF for small scatter on purpose: a 40 cm tuft sampling a
   shadow map that covers +-24 m gets about two texels, which is noise, and it
   costs a full shadow lookup per fragment on the densest geometry in the scene.
   Anything tall enough for the result to be legible (barriers, poles) keeps
   it. */
const KIND_DEFAULTS: Record<string, {
  tilt: number; sink: number; vary: number; gap: number; cast: boolean; receive: boolean;
}> = {
  tuft: { tilt: 8, sink: 0.03, vary: 0.15, gap: 1.15, cast: true, receive: false },
  weed: { tilt: 10, sink: 0.02, vary: 0.15, gap: 1.20, cast: true, receive: false },
  rock: { tilt: 22, sink: 0.14, vary: 0.10, gap: 1.05, cast: true, receive: false },
  debris: { tilt: 12, sink: 0.05, vary: 0.09, gap: 1.25, cast: true, receive: true },
  barrier: { tilt: 0.6, sink: 0.02, vary: 0.05, gap: 1.02, cast: true, receive: true },
  pole: { tilt: 0.4, sink: 0.02, vary: 0.04, gap: 1.02, cast: true, receive: true },
  lamp: { tilt: 0.3, sink: 0.02, vary: 0.03, gap: 1.02, cast: true, receive: true },
  prop: { tilt: 6, sink: 0.03, vary: 0.08, gap: 1.15, cast: true, receive: true },
};
const kindDefaults = (k: string) => KIND_DEFAULTS[k] || KIND_DEFAULTS.prop;

/* Multisampling is what makes alphaToCoverage mean anything — see the header.
   The renderer asks for antialias:true but the context may refuse it. */
const MSAA = (() => {
  try {
    const a = renderer.getContext().getContextAttributes();
    return !!(a && a.antialias);
  } catch { return false; }
})();

/* ---------------- deterministic randomness ----------------
   FNV-1a over the seed string into mulberry32. Both are two lines, have no
   dependencies and are stable across engines — which is the whole requirement:
   the same environment must produce the same field on every visit, on every
   machine, forever. */
function hashSeed(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeRng = (...parts: (string | number)[]) => mulberry32(hashSeed(parts.join('|')));

/* ---------------- prop catalog ---------------- */
const propCatalog: {
  props: PropDef[]; byId: Record<string, PropDef>; loaded: boolean; fallback: boolean;
} = { props: [], byId: {}, loaded: false, fallback: false };
let catalogPromise: Promise<typeof propCatalog> | null = null;

/**
 * Fetch `/models/props/props.json` once. Memoised on the PROMISE, not the result, so
 * concurrent callers (scene/environment.ts preloading while applyScatter() resolves
 * ids) share one request.
 *
 * A missing manifest is not fatal: scatter is decoration and the studio must
 * still boot with zero network (the assetless "Estúdio" path). The catalog then
 * stays empty and every prop falls back to the conventional path
 * `/models/props/<id>.glb`, which is also what lets a scene reference a prop the
 * manifest forgot.
 *
 * @returns {Promise<{props: Array, byId: Object, loaded: boolean,
 *                    fallback: boolean}>}
 */
export async function loadPropCatalog() {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      const r = await fetch(PROPS_DIR + 'props.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('props.json → ' + r.status);
      const j = await r.json();
      const list: unknown[] = Array.isArray(j?.props) ? j.props : [];
      propCatalog.props = list.filter((p): p is PropDef =>
        !!p && typeof (p as PropDef).id === 'string' && !!(p as PropDef).id);
      propCatalog.byId = Object.fromEntries(propCatalog.props.map((p) => [p.id, p]));
      propCatalog.fallback = false;
    } catch (e: unknown) {
      console.debug('[truck-studio] props.json indisponível — cenário sem geometria '
        + 'espalhada (ou usando o caminho convencional /models/props/<id>.glb).',
      errText(e));
      propCatalog.props = [];
      propCatalog.byId = {};
      propCatalog.fallback = true;
    }
    propCatalog.loaded = true;
    return propCatalog;
  })();
  return catalogPromise;
}

/** @returns {Object|null} the props.json entry for `id`, or null. */
export function getPropDef(id: string | null | undefined): PropDef | null {
  return (id && propCatalog.byId[id]) || null;
}

/* ---------------- prop cache ----------------
   id → {
     id, def, source,          the loaded glTF scene (null when it failed)
     owned,                    did WE download it? decides who may dispose it
     variants: [ { parts, height, radius } ],
     kind, cast, receive,
     used                      monotonic stamp for the LRU
   }
   `parts` is [{ geometry, material, matrix }] — one entry per (geometry x
   material) pair, with `matrix` the prop-space transform baked at prepare time
   so a per-instance matrix is a single multiply. */
const propCache = new Map<string, PropEntry>();
const propPending = new Map<string, Promise<PropEntry | null>>();
let useStamp = 0;

const ICOLOR_DEFINE = 'TS_SCATTER_INSTANCE_COLOR';

/**
 * Make `setColorAt()` actually reach the fragment shader. See the module header
 * for the full chunk-level reason; in short, three wires instanceColor into
 * vColor in the vertex shader but only declares/applies vColor in the fragment
 * shader under USE_COLOR, and USE_INSTANCING_COLOR never reaches the fragment
 * prefix at all.
 *
 * Our own define does reach both prefixes (material.defines feeds
 * `customDefines` in each), and it is part of three's program cache key, so a
 * patched material can never share a compiled program with an unpatched one.
 *
 * A material that already declares vertexColors is left alone: three then emits
 * USE_COLOR, wires the whole path end to end itself, and our injection would be
 * a duplicate `varying` declaration, i.e. a compile error.
 */
function patchInstanceColor(m: THREE.Material) {
  if ((m as THREE.MeshStandardMaterial).vertexColors === true) return false;
  /* Idempotent. The replaces below KEEP the `#include` they match, so running
     this twice on one material injects the varying twice and the fragment
     shader dies with `'vColor' : redefinition`. That is not hypothetical — it
     is what shipped, because a material can reach here once per instancing
     variant. */
  if (m.userData?.tsInstanceColorPatched) return true;
  m.userData = Object.assign({}, m.userData, { tsInstanceColorPatched: true });

  const withDefines = m as THREE.Material & { defines?: Record<string, unknown> };
  withDefines.defines = Object.assign({}, withDefines.defines, { [ICOLOR_DEFINE]: 1 });
  const prev = typeof m.onBeforeCompile === 'function' ? m.onBeforeCompile : null;
  m.onBeforeCompile = function (shader: THREE.WebGLProgramParametersWithUniforms, rndr: THREE.WebGLRenderer) {
    if (prev) prev.call(this, shader, rndr);
    /* Second guard, at the GLSL level: three declares vColor itself under
       USE_COLOR / USE_COLOR_ALPHA. `vertexColors` is checked above, but a
       material can acquire it after we patch (a later glTF re-bind, a caller
       flipping it), and by then this closure is already installed. Declaring
       ours only when three has NOT is free and cannot go stale. */
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_pars_fragment>',
        '#include <color_pars_fragment>\n'
        + '#if defined(' + ICOLOR_DEFINE + ') && !defined(USE_COLOR) && !defined(USE_COLOR_ALPHA)\n'
        + '  varying vec3 vColor;\n#endif')
      /* after the (empty) stock include and BEFORE alphatest_fragment, which is
         the next thing to read diffuseColor — the tint must not change the
         alpha the cut-out test looks at, and it does not: rgb only. */
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n'
        + '#ifdef ' + ICOLOR_DEFINE + '\n  diffuseColor.rgb *= vColor;\n#endif');
  };
  return true;
}

/**
 * Clone a prop material so the scatter owns it (three-way sharing with the
 * cached glTF root would make every tweak below leak into whatever else uses
 * that root), then set the flags an instanced scatter prop needs.
 */
function prepMaterial(src: THREE.Material, kind: string) {
  const m = src.clone() as THREE.MeshStandardMaterial;
  m.name = (src.name || kind || 'prop') + '__scatter';

  /* Foliage that arrived as BLEND rather than MASK. Blending needs a per-
     triangle sort that an instanced draw cannot do, so the leaves of one tuft
     would pop through each other as the camera swings. Cut it out instead: for
     a leaf card an alpha test at ~0.35 is visually identical and order
     independent. Restricted to the two kinds that are actually cards — a
     genuinely translucent prop (a bottle) must keep its blending. */
  if (m.transparent && !(m.alphaTest > 0) && (kind === 'tuft' || kind === 'weed')) {
    m.alphaTest = 0.35;
    m.transparent = false;
    m.depthWrite = true;
  }

  if (m.alphaTest > 0) {
    /* alphaTest + transparent is the worst of both: a hard cut AND a sorted
       blend. GLTFLoader does not produce it, but a hand-edited GLB might. */
    m.transparent = false;
    m.depthWrite = true;
    /* A card seen from behind with backface culling on is simply not there. */
    m.side = THREE.DoubleSide;
    /* Coverage blending — the crawl fix. Only meaningful with MSAA; see the
       module header. */
    m.alphaToCoverage = MSAA;
  }

  patchInstanceColor(m);
  m.needsUpdate = true;
  return m;
}

/* Collect the (geometry x material) pairs under `node` and bake each one's
   fixed transform: `pre` (the variant's normalisation) times the mesh's own
   world matrix. Both the bounding boxes and this walk read matrixWorld, so
   they are in the same space and the two compose. */
function collectParts(
  node: THREE.Object3D, pre: THREE.Matrix4, kind: string,
  matCache: Map<THREE.Material, THREE.Material>, out: PropVariant['parts'],
) {
  node.traverse((child) => {
    const o = child as THREE.Mesh;
    if (!o.isMesh || o.visible === false) return;
    const geo = o.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    /* A multi-material mesh draws its groups from ONE geometry; three's
       InstancedMesh takes a single material, so each group would need its own
       instanced mesh over the same geometry. Poly Haven scatter props are
       single-material, so rather than carry that machinery we take material[0]
       and say so — a multi-material prop still renders, just with one of its
       materials. */
    const src = mats[0];
    if (!src) return;
    if (mats.length > 1) {
      console.debug('[truck-studio] prop com múltiplos materiais em uma malha ('
        + (o.name || '?') + '): usando apenas o primeiro.');
    }
    if (!matCache.has(src)) matCache.set(src, prepMaterial(src, kind));
    const matrix = new THREE.Matrix4().multiplyMatrices(pre, o.matrixWorld);
    out.push({ geometry: geo, material: matCache.get(src) as THREE.Material, matrix });
  });
}

/* Descend through single-child wrapper nodes (glTF scenes are usually one
   empty root holding the real content) so variant detection looks at the
   objects an author would call "the pieces". */
function meaningfulChildren(root: THREE.Object3D): THREE.Object3D[] {
  let n = root;
  while (n.children.length === 1 && !(n as THREE.Mesh).isMesh) n = n.children[0];
  return (n as THREE.Mesh).isMesh ? [n] : n.children.slice();
}

/**
 * Split a prop into placement VARIANTS.
 *
 * Poly Haven ships several of the assets we want as SETS — `coast_rocks_03`,
 * `rock_moss_set_01`, `dry_branches_medium_01` are five or six separate pieces
 * laid out side by side in one file. Instancing such a file as a unit would
 * stamp the whole clump down at every placement, which is the opposite of
 * scatter. So: if the top-level pieces all sit on the ground and their XZ
 * footprints are pairwise disjoint, each becomes a variant and every instance
 * picks one.
 *
 * The two conditions together are what keeps a genuinely multi-part prop
 * (a lamp: pole + arm + luminaire; a barrier with a separate base) in one
 * piece — its parts overlap in XZ, or they do not touch the ground.
 * `props.json` may force the answer either way with `"variants": true|false`.
 */
function splitVariants(root: THREE.Object3D, def: PropDef | null): THREE.Object3D[] {
  const kids = meaningfulChildren(root);
  if (def?.variants === false) return [root];
  if (kids.length < 2) return [root];
  if (!(def?.variants === true)) {
    const boxes = kids.map(k => new THREE.Box3().setFromObject(k));
    if (boxes.some((b) => b.isEmpty())) return [root];
    const whole = boxes.reduce((a, b) => a.union(b), new THREE.Box3().copy(boxes[0]));
    const h = Math.max(1e-3, whole.max.y - whole.min.y);
    const grounded = boxes.every((b) => b.min.y - whole.min.y < 0.25 * h);
    if (!grounded) return [root];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const gapX = Math.max(a.min.x - b.max.x, b.min.x - a.max.x);
        const gapZ = Math.max(a.min.z - b.max.z, b.min.z - a.max.z);
        if (gapX < 0 && gapZ < 0) return [root];      // they overlap → one prop
      }
    }
  }
  return kids;
}

/**
 * Turn a loaded glTF scene into cache-ready variants: normalised (centred on
 * XZ, standing on y = 0, unit-corrected against props.json `height`) and
 * flattened into (geometry x material) parts with their transforms baked.
 */
function prepareProp(
  id: string, root: THREE.Object3D, def: PropDef | null, owned: boolean,
): PropEntry {
  root.updateWorldMatrix(true, true);
  const kind = (def && typeof def.kind === 'string' && def.kind) || 'prop';
  const kd = kindDefaults(kind);
  const matCache = new Map<THREE.Material, THREE.Material>();
  const variants: PropVariant[] = [];

  /* Unit sanity, measured on the WHOLE prop and applied to every variant so a
     set keeps its relative sizes. props.json's `height` exists for exactly this
     check; we only act on a gross mismatch, because a 20 % difference is the
     asset being what it is and a 100x difference is centimetres vs metres. */
  const whole = new THREE.Box3().setFromObject(root);
  const measured = whole.isEmpty() ? 0 : whole.max.y - whole.min.y;
  const declared = num(def?.height, 0);
  let unitFix = 1;
  if (declared > 0 && measured > 1e-6) {
    const ratio = measured / declared;
    if (ratio > 2 || ratio < 0.5) {
      unitFix = declared / measured;
      console.warn('[truck-studio] prop "' + id + '" mede ' + measured.toFixed(2)
        + ' m mas props.json declara ' + declared.toFixed(2) + ' m — corrigindo a escala em '
        + unitFix.toFixed(4) + 'x.');
    }
  }

  for (const node of splitVariants(root, def)) {
    const box = new THREE.Box3().setFromObject(node);
    if (box.isEmpty()) continue;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    /* p' = S(unitFix) * T(-cx, -minY, -cz): ground it and centre it on XZ, so a
       per-instance yaw turns the prop about its own axis instead of swinging it
       around the file's origin. */
    const basis = new THREE.Matrix4()
      .makeScale(unitFix, unitFix, unitFix)
      .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    const parts: PropVariant['parts'] = [];
    collectParts(node, basis, kind, matCache, parts);
    if (!parts.length) continue;
    variants.push({
      parts,
      height: size.y * unitFix,
      radius: 0.5 * Math.max(size.x, size.z) * unitFix,
    });
  }

  return {
    id, def: def || null, source: root, owned, kind,
    cast: kd.cast, receive: kd.receive,
    variants, used: ++useStamp,
  };
}

/** Free one cache entry. Only a prop THIS module downloaded owns its source. */
function disposePropEntry(entry: PropEntry | undefined) {
  if (!entry) return;
  const mats = new Set<THREE.Material>();
  for (const v of entry.variants || []) {
    for (const p of v.parts) mats.add(p.material);
  }
  for (const m of mats) m.dispose();          // clones — textures are the source's
  if (entry.owned && entry.source) {
    const seen = new Set<THREE.Material>();
    entry.source.traverse((child) => {
      const o = child as THREE.Mesh;
      if (o.geometry) o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of list) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const v of Object.values(m as unknown as Record<string, unknown>)) {
          if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
        }
        m.dispose();
      }
    });
  }
  entry.variants = [];
  entry.source = null;
}

/* Keep the cache bounded. Props are shared across environments (grass appears
   in two scenes) so they deliberately survive a switch, but a session that
   visits everything must not grow forever. `keep` is the current scene's set —
   never evict what is on screen. */
function pruneProps(keep: Set<string> | null) {
  if (propCache.size <= MAX_CACHED_PROPS) return;
  const victims = [...propCache.values()]
    .filter(e => !keep || !keep.has(e.id))
    .sort((a, b) => a.used - b.used);
  while (propCache.size > MAX_CACHED_PROPS && victims.length) {
    const v = victims.shift() as PropEntry;
    propCache.delete(v.id);
    propPending.delete(v.id);
    disposePropEntry(v);
  }
}

/**
 * Load (or take) one prop and prepare it. Memoised per id.
 *
 * @param {string} id
 * @param {THREE.Object3D} [provided] an already-loaded glTF scene, e.g. from
 *        scene/environment.ts's own per-prop cache. It is NEVER disposed by this
 *        module — whoever loaded it owns it.
 * @returns {Promise<Object|null>} cache entry, or null when it could not load.
 */
export async function loadProp(id: string, provided?: THREE.Object3D | null): Promise<PropEntry | null> {
  if (!id || typeof id !== 'string') return null;
  const cached = propCache.get(id);
  if (cached && (!provided || cached.source === provided)) {
    cached.used = ++useStamp;
    return cached.variants.length ? cached : null;
  }
  if (cached) {                       // same id, different object → re-prepare
    propCache.delete(id);
    disposePropEntry(cached);
  }
  if (!provided && propPending.has(id)) return propPending.get(id) as Promise<PropEntry | null>;

  const def = getPropDef(id);
  const work = (async () => {
    let root: THREE.Object3D | null = provided || null;
    if (!root) {
      const file = (def && typeof def.file === 'string' && def.file) || (PROPS_DIR + id + '.glb');
      try {
        root = await loadGLB(assetUrl(file));
      } catch (e: unknown) {
        console.warn('[truck-studio] prop "' + id + '" não carregou —', errText(e));
        /* Negative result cached as an entry with no variants: a 404 must not
           be retried on every environment switch. */
        const dead: PropEntry = { id, def, source: null, owned: true, kind: 'prop', variants: [], used: ++useStamp };
        propCache.set(id, dead);
        return null;
      }
    }
    const entry = prepareProp(id, root, def, !provided);
    propCache.set(id, entry);
    return entry.variants.length ? entry : null;
  })();

  if (!provided) propPending.set(id, work);
  try { return await work; } finally { propPending.delete(id); }
}

/**
 * Warm the cache for a list of prop ids. Exposed so scene/environment.ts can fold the
 * downloads into its weighted progress bar before calling applyScatter().
 * @param {string[]} ids
 * @param {(t: number) => void} [onProgress] 0..1 over the whole list
 */
export async function preloadProps(ids: string[], onProgress?: (t: number) => void) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) { if (onProgress) onProgress(1); return []; }
  await loadPropCatalog();
  let done = 0;
  return Promise.all(list.map(async id => {
    const e = await loadProp(id);
    done++;
    if (onProgress) onProgress(done / list.length);
    return e;
  }));
}

/** Free every cached prop. `keep` (a Set/array of ids) is left in place. */
export function disposeProps(keep?: Set<string> | string[]) {
  const keepSet = keep instanceof Set ? keep : new Set(keep || []);
  for (const [id, entry] of [...propCache]) {
    if (keepSet.has(id)) continue;
    propCache.delete(id);
    propPending.delete(id);
    disposePropEntry(entry);
  }
}

/* ---------------- the scatter group ---------------- */
const group = new THREE.Group();
group.name = 'ts-scatter';
scene.add(group);

let wantVisible = true;
let applyGen = 0;
const stats: {
  instances: number; draws: number; shadowDraws: number; props: number; specs: number;
  requested: number; missing: number; envId: string | null; radius: number; fade: number;
} = {
  instances: 0, draws: 0, shadowDraws: 0, props: 0, specs: 0,
  requested: 0, missing: 0, envId: null, radius: 0, fade: 0,
};

/* ---------------- zones ----------------
   The near band is three quads disjoint in x — verge | road | verge — inside a
   square of side 2*(radius + fade), with a radial alpha dissolve carving the
   disc out of them (scene/scene.ts, "near-field CG ground"). The zones map onto that
   layout:

     road    the carriageway, inset so nothing straddles the lane edge
     edge    the road/verge boundary, which is where weeds actually grow
     verge   the shoulder either side of the road strip
     all     anywhere in the opaque disc

   With no verge the band is ONE material over the whole disc (a hardstanding
   has no shoulder and no centre line), so every zone collapses to 'all' —
   inventing a "verge" on a yard would put debris in a stripe for no reason. */
function edgeBand(geom: DiscGeom) {
  /* scene/scene.ts modulates the asphalt/verge boundary with its own noise so it
     wanders instead of being a ruled line. We do NOT try to reproduce its phase
     — that would couple this module to a shader implementation detail owned by
     another file, and being 180° out of phase would put every weed on the wrong
     side. Instead the 'edge' zone is WIDENED by the wander amplitude, so a weed
     lands somewhere in the band the boundary actually sweeps through, whatever
     the phase. */
  const amp = geom.edgeAmp;
  return { lo: Math.max(0.2, geom.halfW - 0.6 - amp), hi: geom.halfW + 1.4 + amp };
}

function zoneTest(zone: string, geom: DiscGeom): { xHi: number; test: (x: number, z?: number) => boolean } {
  if (!geom.hasVerge) return { xHi: geom.discR, test: () => true };
  const half = geom.halfW;
  if (zone === 'road') {
    const hi = Math.max(0.4, half - 0.3);
    return { xHi: hi, test: (x: number) => Math.abs(x) <= hi };
  }
  if (zone === 'edge') {
    const b = edgeBand(geom);
    return { xHi: b.hi, test: (x: number) => { const a = Math.abs(x); return a >= b.lo && a <= b.hi; } };
  }
  if (zone === 'verge') {
    /* Starts OUTSIDE the wander, so a tuft can never end up standing on
       asphalt after scene/scene.ts pushes the boundary out. */
    const lo = half + 0.5 + geom.edgeAmp;
    return { xHi: geom.discR, test: (x: number) => Math.abs(x) >= lo };
  }
  return { xHi: geom.discR, test: () => true };
}

/* ---------------- keep-out ---------------- */
/**
 * The rig's XZ footprint, measured live and inflated.
 *
 * Read from the GROUPS rather than state.cabBox/state.trailerBox: those are
 * captured once at load time, and placeTrailer() moves the trailer afterwards
 * on every coupling change and cab swap. Box3.expandByObject() ignores
 * `visible`, which is what we want — a trailer hidden by the Implemento toggle
 * must still keep its ground clear, or turning it back on plants it in a bush.
 */
function rigFootprint(margin: number): RigBox {
  const box = new THREE.Box3();
  for (const g of [state.cabGroup, state.trailerGroup]) {
    if (!g) continue;
    g.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(g);
    if (!b.isEmpty()) box.union(b);
  }
  if (box.isEmpty()) {
    /* Nothing loaded yet (scatter can be applied before the cab arrives). The
       convention from vehicle/models.ts: the cab occupies z ∈ [0, length] and the
       trailer extends toward −Z, both centred on x = 0. Deliberately generous —
       a bare patch where the truck will be is invisible, a bollard through the
       trailer is not. */
    box.set(new THREE.Vector3(-1.6, 0, -16), new THREE.Vector3(1.6, 4.2, 8));
  }
  return {
    x0: box.min.x - margin, x1: box.max.x + margin,
    z0: box.min.z - margin, z1: box.max.z + margin,
  };
}

/* ---------------- min-distance grid ----------------
   A plain O(n²) sweep would be fine at these counts, but placement runs inside
   a rejection loop (up to 48 candidates per instance), so it is really O(48n²)
   — 600 k distance tests for one dense verge. A uniform hash keeps it linear.
   Radii are per instance, so the search range grows with the largest thing
   placed so far. */
function makeGrid(cell: number) {
  const map = new Map<string, { x: number; z: number; r: number }[]>();
  let maxR = 0;
  const key = (i: number, j: number) => i + ':' + j;
  return {
    fits(x: number, z: number, r: number) {
      const range = Math.ceil((r + maxR) / cell);
      const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
      for (let i = -range; i <= range; i++) {
        for (let j = -range; j <= range; j++) {
          const bucket = map.get(key(ci + i, cj + j));
          if (!bucket) continue;
          for (const p of bucket) {
            const dx = p.x - x, dz = p.z - z;
            const lim = (p.r + r) * OVERLAP_OK;
            if (dx * dx + dz * dz < lim * lim) return false;
          }
        }
      }
      return true;
    },
    add(x: number, z: number, r: number) {
      const k = key(Math.floor(x / cell), Math.floor(z / cell));
      let bucket = map.get(k);
      if (!bucket) { bucket = []; map.set(k, bucket); }
      bucket.push({ x, z, r });
      if (r > maxR) maxR = r;
    },
  };
}

/* ---------------- spec normalisation ----------------
   Accepts the manifest's two arrays in any of the shapes scene/environment.ts might
   hand over: a single flat array, or { scatter, roadside }. A flat-array entry
   that carries both `spacing` and `offset` is a roadside line — that pair has
   no meaning for a scattered field. */
function normalizeSpec(
  raw: Record<string, unknown>, mode: string | null, index: number,
): Spec | null {
  if (!raw || typeof raw !== 'object') return null;
  const prop = typeof raw.prop === 'string' ? raw.prop
    : (typeof raw.id === 'string' ? raw.id : null);
  if (!prop) return null;

  const isLine = mode === 'roadside'
    || raw.mode === 'roadside'
    || (mode !== 'scatter' && Number.isFinite(+(raw.spacing as number)) && Number.isFinite(+(raw.offset as number)));

  const sc = raw.scale;
  let sMin = 1, sMax = 1;
  if (Array.isArray(sc) && sc.length) {
    sMin = num(sc[0], 1);
    sMax = num(sc.length > 1 ? sc[1] : sc[0], sMin);
  } else if (Number.isFinite(+(sc as number))) {
    sMin = sMax = +(sc as number);
  } else {
    sMin = num(raw.scaleMin, 1);
    sMax = num(raw.scaleMax, sMin);
  }
  if (sMax < sMin) { const t = sMin; sMin = sMax; sMax = t; }

  const sides = Array.isArray(raw.sides) && raw.sides.length
    ? raw.sides.map((s: unknown) => (+(s as number) < 0 ? -1 : 1))
    : [1, -1];

  return {
    prop, index,
    mode: isLine ? 'roadside' : 'scatter',
    zone: typeof raw.zone === 'string' ? raw.zone.toLowerCase() : 'all',
    count: clamp(Math.round(num(raw.count, isLine ? 0 : 40)), 0, MAX_PER_SPEC),
    scaleMin: clamp(sMin, 0.05, 20),
    scaleMax: clamp(sMax, 0.05, 20),
    tiltDeg: nullableNum(raw.tiltDeg),
    /* `jitter` is the manifest's word for positional noise on a ROADSIDE line;
       a scattered field is already noise. */
    jitter: Math.max(0, num(raw.jitter, isLine ? 0.25 : 0)),
    gap: nullableNum(raw.gap),
    sink: nullableNum(raw.sink),
    vary: nullableNum(raw.vary),
    falloff: clamp(num(raw.falloff, 0.55), 0, 0.95),
    spacing: Math.max(0.5, num(raw.spacing, 30)),
    offset: num(raw.offset, 11.5),
    phase: num(raw.phase, 0),
    yawDeg: nullableNum(raw.yawDeg),
    sides,
  };
}

function normalizeSpecs(specs: SpecInput): Spec[] {
  const out: Spec[] = [];
  const take = (arr: unknown, mode: string | null) => {
    if (!Array.isArray(arr)) return;
    for (const raw of arr) {
      const s = normalizeSpec(raw, mode, out.length);
      if (s) out.push(s);
    }
  };
  if (Array.isArray(specs)) take(specs, null);
  else if (specs && typeof specs === 'object') {
    take(specs.scatter, 'scatter');
    take(specs.roadside, 'roadside');
  }
  return out;
}

/**
 * The disc the instances live on. Accepts the resolved near-ground block
 * scene/environment.ts already builds ({ radius, fade, width, verge, edgeNoise }),
 * the raw manifest block, or those fields flat on `opts` — whichever is handed
 * over, the numbers mean the same thing.
 */
function resolveGeometry(opts: ScatterOpts): DiscGeom {
  const ng = (opts.nearGround && typeof opts.nearGround === 'object') ? opts.nearGround
    : (opts.near && typeof opts.near === 'object') ? opts.near : opts;
  const radius = clamp(num(ng.radius, num(opts.radius, 55)), 6, 400);
  const fade = clamp(num(ng.fade, num(opts.fade, 0)), 0, 400);
  const roadW = clamp(num(ng.width, num(opts.width, 12)), 2, radius * 2);
  /* `verge` is a set NAME in the manifest, a texture object in scene/scene.ts's opts
     and null in both when there is none — truthiness is the one test that reads
     all three correctly.
     ABSENT is not the same as null, and it defaults to TRUE on purpose. The two
     failure modes are not symmetric: assuming no verge when there is one puts
     grass tufts on the carriageway, while assuming a verge when there is none
     only leaves a 12 m lane down the middle of a yard clear — where the truck
     is parked anyway. */
  const hasVerge = ng.verge !== undefined ? !!ng.verge
    : (opts.hasVerge !== undefined ? !!opts.hasVerge : true);
  const en = (ng.edgeNoise && typeof ng.edgeNoise === 'object')
    ? ng.edgeNoise as Record<string, unknown> : null;
  return {
    radius, fade, halfW: roadW / 2, hasVerge,
    /* Only the AMPLITUDE is read: `edgeNoise.scale` is the wavelength of
       scene/scene.ts's boundary wander and matters only to something trying to follow
       its phase, which edgeBand() explains we deliberately do not do. */
    edgeAmp: en ? clamp(num(en.amplitude, 0), 0, 8) : 0,
    /* Every instance must sit fully inside the OPAQUE disc — see header #3. */
    discR: Math.max(2, radius - SEAM_MARGIN),
  };
}

/* ---------------- per-instance transform ---------------- */
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _tilt = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _col = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function pushInstance(
  bucket: Placement[], x: number, z: number, yaw: number, tiltRad: number,
  scale: number, height: number, sink: number, vary: number, rng: () => number,
) {
  _quat.setFromAxisAngle(UP, yaw);
  if (tiltRad > 1e-4) {
    /* Uniform over the disc of lean directions: sqrt() on the magnitude, or the
       props all lean about the same small amount. */
    const dir = rng() * TAU;
    _axis.set(Math.cos(dir), 0, Math.sin(dir));
    _tilt.setFromAxisAngle(_axis, tiltRad * Math.sqrt(rng()));
    _quat.premultiply(_tilt);
  }
  _pos.set(x, -sink * height * scale, z);
  _scl.setScalar(scale);
  const matrix = new THREE.Matrix4().compose(_pos, _quat, _scl);

  /* Per-instance colour MULTIPLY. Values live in the working (linear) colour
     space — Color.setRGB() defaults to it — because this is a multiplier, not
     a colour: converting it from sRGB would bend a 0.9 into a 0.78. `v` is
     value, `t` a small warm/cool tilt, so a field of tufts gets both lighter
     and drier patches instead of one uniform green. */
  const v = clamp(1 + (rng() * 2 - 1) * vary, 0.55, 1.35);
  const t = (rng() * 2 - 1) * vary * 0.5;
  _col.setRGB(clamp(v * (1 + t), 0.4, 1.5), v, clamp(v * (1 - t * 0.6), 0.4, 1.5));

  bucket.push({ matrix, color: _col.clone() });
}

/* ---------------- placement ---------------- */
function placeScattered(
  spec: Spec, entry: PropEntry, geom: DiscGeom, rig: RigBox,
  grid: ReturnType<typeof makeGrid>, keepOut: { x: number; z: number; r: number }[],
  buckets: Map<string, Bucket>, rng: () => number,
) {
  const kd = kindDefaults(entry.kind);
  const tiltRad = THREE.MathUtils.degToRad(spec.tiltDeg === null ? kd.tilt : spec.tiltDeg);
  const sink = spec.sink === null ? kd.sink : spec.sink;
  const vary = spec.vary === null ? kd.vary : spec.vary;
  const gapMul = spec.gap === null ? kd.gap : spec.gap;
  const zone = zoneTest(spec.zone, geom);
  const nv = entry.variants.length;
  let placed = 0;

  for (let i = 0; i < spec.count; i++) {
    let ok = false;
    for (let t = 0; t < PLACE_TRIES && !ok; t++) {
      const vi = nv === 1 ? 0 : Math.min(nv - 1, Math.floor(rng() * nv));
      const variant = entry.variants[vi];
      const scale = spec.scaleMin + (spec.scaleMax - spec.scaleMin) * rng();
      const footR = Math.max(0.05, variant.radius * scale);
      /* THE FADE BAND, per instance: the centre must be far enough in that the
         instance's own footprint still ends before the dissolve starts. */
      const maxR = geom.discR - footR;
      if (maxR <= 0.5) break;

      const bx = Math.min(zone.xHi, maxR);
      const x = (rng() * 2 - 1) * bx;
      const z = (rng() * 2 - 1) * maxR;
      if (x * x + z * z > maxR * maxR) continue;
      if (!zone.test(x, z)) continue;
      /* Density falls off with distance so the near field is rich and the far
         edge thins out into the photograph instead of ending in a hedge. */
      const rr = Math.sqrt(x * x + z * z) / maxR;
      if (rng() > 1 - spec.falloff * rr * rr) continue;
      if (x > rig.x0 && x < rig.x1 && z > rig.z0 && z < rig.z1) continue;
      let blocked = false;
      for (const c of keepOut) {
        const dx = c.x - x, dz = c.z - z, lim = c.r + footR;
        if (dx * dx + dz * dz < lim * lim) { blocked = true; break; }
      }
      if (blocked) continue;
      if (!grid.fits(x, z, footR * gapMul)) continue;

      grid.add(x, z, footR * gapMul);
      const key = spec.prop + '#' + vi;
      let bucket = buckets.get(key);
      if (!bucket) { bucket = { entry, variant, list: [] }; buckets.set(key, bucket); }
      pushInstance(bucket.list, x, z, rng() * TAU, tiltRad, scale,
        variant.height, sink, vary, rng);
      placed++;
      ok = true;
    }
  }
  return placed;
}

function placeRoadside(
  spec: Spec, entry: PropEntry, geom: DiscGeom, rig: RigBox,
  grid: ReturnType<typeof makeGrid>, keepOut: { x: number; z: number; r: number }[],
  buckets: Map<string, Bucket>, rng: () => number,
) {
  const kd = kindDefaults(entry.kind);
  const tiltRad = THREE.MathUtils.degToRad(spec.tiltDeg === null ? kd.tilt : spec.tiltDeg);
  const sink = spec.sink === null ? kd.sink : spec.sink;
  const vary = spec.vary === null ? kd.vary : spec.vary;
  const gapMul = spec.gap === null ? kd.gap : spec.gap;
  const nv = entry.variants.length;
  let placed = 0;

  /* The chord the line may occupy is measured against the LARGEST instance the
     spec can produce, so the whole row is inside the opaque disc whatever the
     per-instance scale rolls. */
  const maxFoot = entry.variants.reduce((m, v) => Math.max(m, v.radius), 0) * spec.scaleMax;
  const lim = geom.discR - maxFoot;

  for (const side of spec.sides) {
    const x0 = side * Math.abs(spec.offset);
    /* A line further out than the opaque disc would stand in the dissolve, or
       beyond it, over the photograph. Nothing is drawn rather than something
       floating. */
    if (lim <= Math.abs(x0)) {
      console.debug('[truck-studio] linha "' + spec.prop + '" com offset ' + x0.toFixed(1)
        + ' m fica fora do disco opaco (' + geom.discR.toFixed(1) + ' m) — ignorada.');
      continue;
    }
    const half = Math.sqrt(lim * lim - x0 * x0);
    const n = Math.floor((half * 2) / spec.spacing) + 1;
    const cap = spec.count > 0 ? Math.min(n, spec.count) : n;
    /* CENTRED on z = 0, not started at the chord's end. Marching from −half
       puts the first and last poles exactly on the disc's edge, where the
       radial test then rejects them — a 38 m pitch across a 43 m chord came out
       as ONE pole instead of two. Centring also keeps the row symmetric about
       the truck, which is what a camera orbiting the rig actually sees. */
    const zStart = -((cap - 1) / 2) * spec.spacing + spec.phase;
    for (let i = 0; i < cap; i++) {
      const vi = nv === 1 ? 0 : Math.min(nv - 1, Math.floor(rng() * nv));
      const variant = entry.variants[vi];
      const scale = spec.scaleMin + (spec.scaleMax - spec.scaleMin) * rng();
      const footR = Math.max(0.05, variant.radius * scale);
      const z = zStart + i * spec.spacing
        + (spec.jitter ? (rng() * 2 - 1) * spec.jitter : 0);
      const x = x0 + (spec.jitter ? (rng() * 2 - 1) * spec.jitter * 0.4 : 0);
      if (x * x + z * z > (geom.discR - footR) * (geom.discR - footR)) continue;
      if (x > rig.x0 && x < rig.x1 && z > rig.z0 && z < rig.z1) continue;
      let blocked = false;
      for (const c of keepOut) {
        const dx = c.x - x, dz = c.z - z, lim = c.r + footR;
        if (dx * dx + dz * dz < lim * lim) { blocked = true; break; }
      }
      if (blocked) continue;

      /* Added to the grid but never tested against it: the line is authored and
         wins. What this buys is the SCATTER placed afterwards, which does test
         and therefore grows around the bases instead of through them. */
      grid.add(x, z, footR * gapMul);
      /* An asymmetric prop (a fence panel, a barrier with a batter) has a front;
         mirroring the two sides is what makes both face the road. `yawDeg`
         overrides when the author knows the prop's axis. */
      const yaw = spec.yawDeg !== null
        ? THREE.MathUtils.degToRad(spec.yawDeg)
        : (side > 0 ? Math.PI : 0);
      const key = spec.prop + '#' + vi;
      let bucket = buckets.get(key);
      if (!bucket) { bucket = { entry, variant, list: [] }; buckets.set(key, bucket); }
      pushInstance(bucket.list, x, z, yaw, tiltRad, scale,
        variant.height, sink, vary, rng);
      placed++;
    }
  }
  return placed;
}

/* ---------------- build ---------------- */
function buildMeshes(buckets: Map<string, Bucket>) {
  let instances = 0, draws = 0, shadowDraws = 0;
  for (const [key, bucket] of buckets) {
    const list = bucket.list;
    if (!list.length) continue;
    for (let pi = 0; pi < bucket.variant.parts.length; pi++) {
      const part = bucket.variant.parts[pi];
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      im.name = 'ts-scatter:' + key + ':' + pi;
      /* Render-list flags, set ONCE at construction — see KIND_DEFAULTS for why
         small scatter does not receive. */
      im.castShadow = !!bucket.entry.cast;
      im.receiveShadow = !!bucket.entry.receive || bucket.variant.height > 1.5;
      im.matrixAutoUpdate = false;        // the group and the mesh never move
      for (let i = 0; i < list.length; i++) {
        _mat.multiplyMatrices(list[i].matrix, part.matrix);
        im.setMatrixAt(i, _mat);
        im.setColorAt(i, list[i].color);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      /* Frustum culling reads InstancedMesh.boundingSphere, which is null until
         computed; do it now so the first frame is right. */
      im.computeBoundingSphere();
      group.add(im);
      draws++;
      if (im.castShadow) shadowDraws++;
    }
    instances += list.length;
  }
  return { instances, draws, shadowDraws };
}

/**
 * Remove and free every scattered instance. The prop CACHE survives — its
 * geometries and materials are shared across environments and re-downloading
 * grass because the user toggled a scene is exactly the cost this cache exists
 * to avoid. Use disposeProps() for that half.
 */
export function clearScatter() {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const o = group.children[i];
    group.remove(o);
    /* THIS is what frees the instanceMatrix/instanceColor GPU buffers:
       WebGLObjects listens for the 'dispose' event and calls attributes.remove
       on both. Geometry and material are the prop cache's. */
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  }
  stats.instances = 0;
  stats.draws = 0;
  stats.shadowDraws = 0;
  stats.props = 0;
  stats.specs = 0;
  stats.requested = 0;
  stats.missing = 0;
}

/**
 * Place the manifest's scatter + roadside specs on the near ground.
 *
 * Idempotent per environment and safe to call again while a previous call is
 * still downloading: a generation counter makes the older call bail instead of
 * dropping a stale scene's furniture on top of the new one.
 *
 * @param {Array|{scatter?: Array, roadside?: Array}} specs the manifest blocks.
 *        A flat array may mix both; an entry carrying `spacing` AND `offset` is
 *        read as a roadside line.
 *        Scatter entry: { prop, count, zone: 'verge'|'edge'|'road'|'all',
 *          scale: [min,max], tiltDeg, falloff, gap, sink, vary }
 *        Roadside entry: { prop, spacing, offset, sides: [1,-1], count?, phase?,
 *          jitter?, yawDeg?, scale? }
 * @param {Object} [opts]
 * @param {string} [opts.envId] SEEDS THE PRNG. Same id ⇒ same field, always.
 * @param {Object} [opts.nearGround] { radius, fade, width, verge, edgeNoise } —
 *        the resolved near-ground block, the raw manifest block, or the same
 *        fields flat on `opts`.
 * @param {Object<string, THREE.Object3D>} [opts.props] already-loaded glTF
 *        scenes by prop id; anything missing is downloaded here. Objects passed
 *        this way are never disposed by this module.
 * @param {Array<{x: number, z: number, r: number}>} [opts.keepClear] extra
 *        no-go circles (lamp bases, a hydrant placed by another system).
 * @param {number} [opts.margin] metres added around the rig's bounding box.
 * @param {(t: number) => void} [opts.onProgress] 0..1 over the prop downloads.
 * @returns {Promise<Object>} the same shape as getScatterStats().
 */
export async function applyScatter(specs: SpecInput, opts?: ScatterOpts) {
  const o: ScatterOpts = opts || {};
  const gen = ++applyGen;
  const list = normalizeSpecs(specs);

  /* Cleared BEFORE the downloads, not after: the props of the scene we are
     leaving must not stand around in the new one for the second or two the
     GLBs take to arrive. */
  clearScatter();
  if (!list.length) {
    stats.envId = o.envId || null;
    if (o.onProgress) o.onProgress(1);
    return getScatterStats();
  }

  await loadPropCatalog();
  if (gen !== applyGen) return getScatterStats();

  const ids = [...new Set(list.map(s => s.prop))];
  const provided = (o.props && typeof o.props === 'object') ? o.props : {};
  let done = 0;
  const entries = new Map<string, PropEntry>();
  await Promise.all(ids.map(async id => {
    const e = await loadProp(id, provided[id] || null);
    if (e) entries.set(id, e);
    done++;
    if (o.onProgress) o.onProgress(done / ids.length);
  }));
  /* A newer environment took over while we were downloading. Its own
     clearScatter() has already run, so touching the scene here would plant this
     scene's props in the next one. */
  if (gen !== applyGen) return getScatterStats();

  const geom = resolveGeometry(o);
  const rig = rigFootprint(Math.max(0, num(o.margin, RIG_MARGIN)));
  const keepOut = Array.isArray(o.keepClear)
    ? o.keepClear
      .map((c) => ({ x: num(c?.x, 0), z: num(c?.z, 0), r: Math.max(0, num(c?.r, 0)) }))
      .filter((c) => c.r > 0)
    : [];
  const grid = makeGrid(2.5);
  const buckets = new Map<string, Bucket>();
  const seed = String(o.envId || o.seed || o.id || 'default');
  let requested = 0, placed = 0, missing = 0;

  /* ROADSIDE LINES GO DOWN FIRST. They are authored positions — a pole belongs
     at 11.5 m every 38 m and nothing may move it — whereas a scattered field is
     free to go somewhere else. Claiming the line's ground before the fields are
     sampled is what makes the tufts grow AROUND the pole bases instead of
     through them. It changes no seed: each spec keeps the stream keyed to its
     own index. */
  list.sort((a, b) => (a.mode === b.mode ? 0 : (a.mode === 'roadside' ? -1 : 1)));

  for (const spec of list) {
    const entry = entries.get(spec.prop);
    if (!entry) { missing++; continue; }
    entry.used = ++useStamp;
    /* One RNG stream PER SPEC, seeded from (environment, spec index, prop): a
       manifest edit to spec #3 leaves specs #1 and #2 pixel-identical, and the
       same scene always rebuilds the same field. */
    const rng = makeRng(seed, spec.index, spec.prop, spec.mode);
    if (placed >= MAX_INSTANCES) break;
    requested += spec.mode === 'roadside' ? 0 : spec.count;
    const n = spec.mode === 'roadside'
      ? placeRoadside(spec, entry, geom, rig, grid, keepOut, buckets, rng)
      : placeScattered(spec, entry, geom, rig, grid, keepOut, buckets, rng);
    /* A spec that asked for instances and got none is almost always an
       authoring mistake — a 'verge' zone on a disc narrower than the road
       strip, or a scale that makes every candidate overlap its neighbour — and
       it is otherwise completely silent. */
    if (!n && (spec.mode === 'roadside' || spec.count > 0)) {
      console.debug('[truck-studio] scatter "' + spec.prop + '" (zona ' + spec.zone
        + ') não coube em nenhum ponto: disco opaco ' + geom.discR.toFixed(1)
        + ' m, faixa de rodagem ' + (geom.halfW * 2).toFixed(1)
        + ' m, acostamento ' + (geom.hasVerge ? 'sim' : 'não') + '.');
    }
    placed += n;
  }

  const built = buildMeshes(buckets);
  group.visible = wantVisible;
  stats.instances = built.instances;
  stats.draws = built.draws;
  stats.shadowDraws = built.shadowDraws;
  stats.props = entries.size;
  stats.specs = list.length;
  stats.requested = requested;
  stats.missing = missing;
  stats.envId = o.envId || null;
  stats.radius = geom.radius;
  stats.fade = geom.fade;
  pruneProps(new Set(ids));
  if (o.onProgress) o.onProgress(1);
  return getScatterStats();
}

/** Show/hide every scattered instance. Survives an environment switch. */
export function setScatterVisible(v: boolean) {
  wantVisible = !!v;
  group.visible = wantVisible;
}

export function isScatterVisible() { return wantVisible; }

/**
 * Debug/inspection handle. `draws` is the MAIN-pass draw call count — one per
 * (prop variant x material) — and `shadowDraws` what the same set costs the
 * shadow map. `requested` vs `instances` shows how much a scene asked for that
 * its zones could not fit.
 */
export function getScatterStats() {
  return {
    instances: stats.instances,
    draws: stats.draws,
    shadowDraws: stats.shadowDraws,
    props: stats.props,
    specs: stats.specs,
    requested: stats.requested,
    missing: stats.missing,
    visible: wantVisible,
    envId: stats.envId,
    radius: stats.radius,
    fade: stats.fade,
    cached: propCache.size,
    alphaToCoverage: MSAA,
  };
}
