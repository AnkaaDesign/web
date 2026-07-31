/* Manifest loading, model loading (cabs declaring format 'fbx-scania' come from
   the ORIGINAL FBX via FBXLoader with runtime material treatment; trailer +
   volvo = curated GLBs), cab switching, grounding, coupling. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, onRig } from '../scene/scene';
import {
  makePaintMaterial, forgetPaintMaterial, setPaint, isPaintMaterial,
} from './paint';
import { VEHICLES_DIR, DRACO_DECODER_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';
import type { Rig } from '../scene/presets';

export { makePaintMaterial };

/* Mensagem legível de um valor lançado — `catch (e)` é `unknown` sob strict. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/* ---------------- types ---------------- */

/** One entry of models/cabs.json. */
export interface CabDef {
  id: string;
  name: string;
  /** absolute path under /models/vehicles/ */
  file: string;
  /** 'fbx-scania' routes through FBXLoader + convertScaniaMaterials() */
  format?: string;
  paintMaterials?: string[];
  wheelMeshRegex?: string;
  dims?: { height: number; length: number };
  /** kingpin plate: null → legacy trailer placement */
  fifthwheel?: { z?: number; topY?: number } | null;
  /** z of the cab's rearmost bodywork, for the no-overlap clamp */
  rearBodyZ?: number;
  /** filled by the HEAD probe: false = not exported yet */
  available?: boolean;
}

/** The subset of trailer_meta.json this module reads. */
export interface TrailerMeta {
  kingpin?: { zFromFront: number; plateBottomY?: number };
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/** Everything loaded into the scene about the vehicle itself. */
export interface VehicleState {
  cabs: CabDef[];
  byId: Record<string, CabDef>;
  manifestFallback: boolean;
  trailerMeta: TrailerMeta | null;
  cabGroup: THREE.Group;
  trailerGroup: THREE.Group;
  cab: THREE.Object3D | null;
  cabId: string | null;
  cabDef: CabDef | null;
  cabBox: THREE.Box3 | null;
  trailer: THREE.Object3D | null;
  /** captured after grounding, so placeTrailer() can re-derive from a fixed pose */
  trailerBase: { pos: THREE.Vector3; frontZ: number } | null;
  trailerBox?: THREE.Box3;
  /** Thermo King unit (protrudes toward the cab) */
  tk: THREE.Object3D | null;
  tkDepth: number;
  paintMats: THREE.Material[];
  /** 'both' paints the trailer panels too */
  paintTarget: 'cab' | 'both';
  trailerPaintMat: THREE.MeshPhysicalMaterial | null;
  /** front-wall paint overlays; `undefined` = not built yet, `[]` = none found */
  frontWalls?: THREE.Mesh[];
  frontWallMat?: THREE.MeshPhysicalMaterial;
  coupling: { z: number; y: number };
}

/** A mesh predicate, or a regex tested against the object's name. */
type MeshMatcher = RegExp | ((o: THREE.Mesh) => boolean);

/* The Blender-processed scania GLB was rejected by the user — the original FBX
   through three.js FBXLoader (like the old scania viewer) is the approved look.
   This stays the DEFAULT source for the 'fbx-scania' format; a cab may point at
   another .fbx of its own, which is what lets more cabs share this pipeline. */
const SCANIA_FBX = VEHICLES_DIR + 'scania.fbx';
const STEER_TIRE_OD = 1.015;   // m — real steer-tire outer diameter anchors the FBX scale

/* Legacy values used when manifests are not (yet) available. */
const LEGACY_TRAILER_FRONT_Z = 2.65;
const DEFAULT_CABS: { cabs: CabDef[] } = {
  cabs: [{
    id: 'scania', name: 'Scania S730', file: VEHICLES_DIR + 'scania.glb',
    paintMaterials: ['carpaint'],
    wheelMeshRegex: 'tire|rim|pneu',
    dims: { height: 3.85, length: 5.7 },
    fifthwheel: null,                    // null → legacy trailer placement
  }],
};

try { localStorage.removeItem('truckstudio.coupling.v1'); } catch { /* legacy key */ }

export const state: VehicleState = {
  cabs: [], byId: {}, manifestFallback: false,
  trailerMeta: null,
  cabGroup: new THREE.Group(),
  trailerGroup: new THREE.Group(),
  cab: null, cabId: null, cabDef: null, cabBox: null,
  trailer: null, trailerBase: null,     // { pos, frontZ } captured after grounding
  tk: null, tkDepth: 0,                 // Thermo King unit (protrudes toward the cab)
  paintMats: [],
  paintTarget: 'cab',                   // 'cab' | 'both' (trailer panels painted too)
  trailerPaintMat: null,
  coupling: { z: 0, y: 0 },             // fixed: coupling is fully computed now
};
scene.add(state.cabGroup, state.trailerGroup);

/* ---------------- loaders ---------------- */
const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_DIR);
const loader = new GLTFLoader().setDRACOLoader(draco);
const fbxLoader = new FBXLoader();

export function loadGLB(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url,
      g => resolve(g.scene),
      e => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
      () => reject(new Error('Falha ao carregar ' + url)));
  });
}

export function loadFBX(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    fbxLoader.load(url,
      root => resolve(root),
      e => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
      (err: unknown) => reject(new Error('Falha ao carregar ' + url +
        (err ? ' — ' + errText(err) : ''))));
  });
}

/* ---------------- manifests ---------------- */
async function fetchJSON(url: string) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

export async function loadManifests() {
  try {
    const j = await fetchJSON(VEHICLES_DIR + 'cabs.json');
    if (!Array.isArray(j.cabs) || !j.cabs.length) throw new Error('cabs.json vazio');
    state.cabs = j.cabs;
  } catch (e: unknown) {
    console.warn('[manifest] cabs.json indisponível — usando padrão Scania.', errText(e));
    state.cabs = DEFAULT_CABS.cabs;
    state.manifestFallback = true;
  }
  /* The FBX pipeline is now MANIFEST-DRIVEN: any cab may declare
     `format: "fbx-scania"` and get FBXLoader + convertScaniaMaterials() + the
     steer-tire scale anchor. That is how `daf` reuses the very same source mesh
     as `scania` without a second special case in here.
     Two guards remain:
     - a `scania` entry that declares NO format at all (an old cabs.json, or the
       built-in DEFAULT_CABS fallback) is still forced onto the FBX, so a stale
       manifest can never regress the cab back to the rejected GLB;
     - a cab that asks for 'fbx-scania' but points at something that is not an
       .fbx is a manifest typo — fall back to the default FBX rather than hand a
       GLB to FBXLoader. */
  for (const c of state.cabs) {
    if (!c.format && c.id === 'scania') c.format = 'fbx-scania';
    if (c.format === 'fbx-scania' && !/\.fbx(\?|$)/i.test(c.file || '')) c.file = SCANIA_FBX;
  }
  // availability probe (a listed model may not be exported yet). Cabs sharing a
  // file (scania + daf) simply probe the same URL twice — harmless, and it keeps
  // `available` a plain per-cab flag.
  await Promise.all(state.cabs.map(async c => {
    try { c.available = (await fetch(assetUrl(c.file), { method: 'HEAD' })).ok; }
    catch { c.available = false; }
  }));
  state.byId = Object.fromEntries(state.cabs.map(c => [c.id, c]));

  try { state.trailerMeta = await fetchJSON(VEHICLES_DIR + 'trailer_meta.json'); }
  catch (e: unknown) {
    console.warn('[manifest] trailer_meta.json indisponível — engate legado + painéis retangulares.', errText(e));
    state.trailerMeta = null;
  }
  return state;
}

/* ---------------- material / mesh setup ---------------- */
const GLASS_RE = /glass|vidro|windshield|window|winscreen|cristal|glazing/i;

export function setupCommon(root: THREE.Object3D) {
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      if (!raw) continue;
      /* The GLBs and the FBX rip both arrive as MeshStandard/MeshPhysical, so
         the PBR slots below always exist; `Material` is just the widest type
         `Mesh.material` can be declared as. */
      const m = raw as THREE.MeshStandardMaterial;
      m.envMapIntensity = 1.35;
      if (m.map) m.map.anisotropy = 8;
      const isGlass = GLASS_RE.test(m.name || '');
      if (isGlass) {
        m.transparent = true;
        m.depthWrite = false;
        m.roughness = Math.min(m.roughness ?? 1, 0.12);
        o.renderOrder = Math.max(o.renderOrder, 20);   // glass last, over the body
      } else if (m.transparent) {
        if ((m.opacity ?? 1) >= 0.99 && !m.alphaMap) {
          // Body panels / decals wrongly flagged transparent: keep texture alpha
          // (alphaTest) but WRITE depth — depthWrite=false here is what made the
          // cab look foggy/blurred (interior blending through the shell).
          m.depthWrite = true;
          m.alphaTest = Math.max(m.alphaTest || 0, 0.02);
        } else {
          m.depthWrite = false;
        }
      }
    }
  });
}

/* App-side transparency audit: ONLY real glass may be transparent. Anything
   else flagged transparent (rip artifacts, loader quirks) is forced opaque.
   Complements the model-side fixes; logs every decision for verification. */
const GLASS_OK_RE = /glass|vidro|lente|windshield|window|winscreen|cristal|glazing|acrilic/i;

function auditTransparency(root: THREE.Object3D, label: string) {
  const glassOk: string[] = [], forced: string[] = [];
  const seen = new Set<string>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.transparent || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      if (GLASS_OK_RE.test(m.name || '')) {
        glassOk.push(`${m.name} (op ${(m.opacity ?? 1).toFixed(2)})`);
      } else {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.needsUpdate = true;
        forced.push(m.name || '(sem nome)');
      }
    }
  });
  console.info(`[transparency:${label}] vidro ok:`,
    glassOk.length ? glassOk.join(', ') : 'nenhum',
    forced.length ? `· FORÇADO OPACO: ${forced.join(', ')}` : '· nada forçado');
}

function bboxOfMatching(root: THREE.Object3D, matcher: MeshMatcher) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  const test = typeof matcher === 'function' ? matcher : ((o: THREE.Mesh) => matcher.test(o.name));
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && test(o)) box.expandByObject(o);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}

function groundAndCenter(root: THREE.Object3D, bodyRe: MeshMatcher, wheelRe: MeshMatcher) {
  const body = bboxOfMatching(root, bodyRe);
  const wheels = bboxOfMatching(root, wheelRe);
  root.position.x -= (body.min.x + body.max.x) / 2;
  root.position.y -= wheels.min.y;
  root.updateWorldMatrix(true, true);
  return bboxOfMatching(root, bodyRe);
}

/* A cab built by cloning the cached original FBX (see loadFBXSource) SHARES its
   geometries and textures with the cache — and therefore with the other cab
   built from the same file. Freeing those here would blank both. Such a root is
   tagged `userData.tsSharedSource`, and for it disposal is narrowed to the
   materials, which convertScaniaMaterials() creates fresh per clone and which
   are nobody else's. Unregistering them from vehicle/paint.ts is the part that must
   never be skipped: a paint material left in that registry keeps receiving
   every setPaint() write for the rest of the session. */
function disposeTree(root: THREE.Object3D) {
  const shared = !!root.userData?.tsSharedSource;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.geometry && !shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      forgetPaintMaterial(m);          // drop it from the paint registry too
      if (!shared) {
        for (const v of Object.values(m as unknown as Record<string, unknown>)) {
          if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
        }
      }
      m.dispose();
    }
  });
}

/* The car-paint material itself lives in vehicle/paint.ts (three finish families,
   flakes, pearl colour travel, orange peel). This module only decides WHICH
   meshes get it. */
const CAB_FORWARD_GAP = 0.10;   // user request: cabs slightly forward of ideal kingpin

/* ---------------- wet vehicle ----------------
   In the rain the bodywork gets glossier, but its albedo must NOT be darkened:
   darkening is a POROSITY effect (water fills the pores of asphalt and soil so
   scattered light no longer escapes), and clearcoat, chrome and glass are not
   porous. Only roughness moves, and the shift is scaled by the material's own
   dry roughness — so tyres go 0.90 → 0.51 while chrome barely budges from
   0.12. That makes it safe to run blindly over any loaded GLB with no material
   tagging. Paint materials are skipped: they already sit at clearcoat 1.0. */
const dryRough = new WeakMap<THREE.Material, number>();

function applyVehicleWetness(w: number) {
  for (const root of [state.cab, state.trailer]) {
    if (!root) continue;
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const raw of mats) {
        const m = raw as THREE.MeshStandardMaterial;
        if (!m || isPaintMaterial(m) || typeof m.roughness !== 'number') continue;
        if (!dryRough.has(m)) dryRough.set(m, m.roughness);
        const dry = dryRough.get(m) as number;
        m.roughness = dry * (1 - w * 0.45 * dry);
      }
    });
  }
}

/* The rig hook fires once immediately on registration — which happens at module
   load, long before any GLB exists. So the target is remembered here and
   re-applied by loadCab()/loadTrailer() once there is geometry to apply it to;
   without that, booting straight into Chuvoso would leave the truck dry. */
let wetTarget = 0, wetApplied = -1;

export function reapplyVehicleWetness() {
  wetApplied = wetTarget;
  applyVehicleWetness(wetTarget);
}

onRig((rig: Rig) => {
  wetTarget = Math.min(1, Math.max(0, rig.wetness));
  /* A tween calls this every frame. Re-traversing the whole vehicle 50× for a
     change nobody can see is pure waste, so only move in visible steps — but
     always land exactly on a fully wet or fully dry endpoint. */
  const d = Math.abs(wetTarget - wetApplied);
  if (d === 0) return;
  if (d < 0.2 && wetTarget !== 0 && wetTarget !== 1) return;
  wetApplied = wetTarget;
  applyVehicleWetness(wetTarget);
});

/* ------- "Aplicar ao implemento": paint the trailer body too ------- */
const WHITE_BODY_SUB = 'cor_padrao_branco';   // trailer's white body material name

function isWhiteBodyMat(m: THREE.Material | null | undefined) {
  return !!m && (m.name || '').toLowerCase().includes(WHITE_BODY_SUB);
}

/* Paint set: the named livery panels only. The rest of the white body is ONE
   joined mesh (opt_Cor_padrao_branco…: front wall + roof + trim + frames all
   in a single geometry — verified by bbox enumeration), so the FRONT WALL is
   handled separately by extracting its triangles into a paint overlay; see
   buildFrontWallOverlay(). Frames/rails/posts stay on the original material. */
const TK_PAINT_SUB = 'tk-housing-white';   // Thermo King housing joins the paint set

function trailerPanelMeshes() {
  const out: THREE.Mesh[] = [];
  if (state.trailer) {
    state.trailer.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) { out.push(o); return; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m && (m.name || '').toLowerCase().includes(TK_PAINT_SUB))) out.push(o);
    });
  }
  return out;
}

/* Extract the front-wall surface from the joined white-body mesh and mirror it
   into a paint overlay (a child of the source, so it inherits every transform)
   with polygonOffset. The source mesh data is never modified.

   WHY IT USED TO MISS THE WALL — the old pass 2 kept only triangles whose FULL
   y-extent sat inside a band [bodyBottomY+0.05, wallTop-0.25]. But this wall is
   low-poly: its frontmost skin is essentially four big quads spanning
   y 1.452 → 4.172. Both cuts reject the same quads (1.452 < 1.482 below,
   4.172 > 3.958 above), so every triangle carrying visible area was thrown
   away. What survived was the INNER wall sheet 0.11 m further back, which meant
   the overlay was being drawn inside the trailer — a gap polygonOffset cannot
   bridge. Measured: 701 tris kept, covering 0.16 m² of a 4.23 m² wall = 3.8 %.

   THE FIX — the correct discriminator is DEPTH, not height. Take the frontmost
   z reached by any outward-facing candidate and keep only triangles that stay
   within a thin skin of it. Measured with SKIN = 0.05: 1630 tris, 10.32 m²,
   100 % coverage. (0.02 misses a second sheet 9 mm back; ≥0.12 starts pulling
   in the hidden inner sheet again.) The face-normal test also becomes abs(),
   since ~0.2 % of these ripped triangles are wound backwards. */
const FRONT_WALL_SKIN = 0.05;

function buildFrontWallOverlay() {
  if (state.frontWalls !== undefined || !state.trailer) return;
  state.frontWalls = [];
  const sideBox = bboxOfMatching(state.trailer, /^(SIDE_L|SIDE_R|REAR)$/);
  const zLim = sideBox.max.z - 0.5;                  // generous front slab
  const sources: THREE.Mesh[] = [];
  state.trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(isWhiteBodyMat)) sources.push(o);
  });
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (const src of sources) {
    src.updateWorldMatrix(true, false);
    const g = src.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!pos || !nor) {
      console.warn('[paint] front wall: source lacks position/normal —', src.name);
      continue;
    }
    const index = g.index ? g.index.array : null;
    const triCount = Math.floor((index ? index.length : pos.count) / 3);
    /* pass 1: candidates = inside the front slab AND lying in the wall plane
       (|n·z| ≥ 0.5). Track the frontmost z any candidate reaches. */
    const candidates: number[] = [];
    let srcFrontZ = -Infinity;
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index[t * 3] : t * 3;
      const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
      const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0); wa.copy(va).applyMatrix4(src.matrixWorld);
      if (wa.z < zLim) continue;
      vb.fromBufferAttribute(pos, i1); wb.copy(vb).applyMatrix4(src.matrixWorld);
      vc.fromBufferAttribute(pos, i2); wc.copy(vc).applyMatrix4(src.matrixWorld);
      if (wb.z < zLim || wc.z < zLim) continue;
      e1.subVectors(wb, wa); e2.subVectors(wc, wa);
      fn.crossVectors(e1, e2).normalize();
      if (Math.abs(fn.z) < 0.5) continue;
      candidates.push(i0, i1, i2);
      srcFrontZ = Math.max(srcFrontZ, wa.z, wb.z, wc.z);
    }
    /* pass 2: the OUTER skin only. Anything set back from srcFrontZ is either
       the wall's interior face or internal structure, and painting it would put
       colour inside the box. */
    const zKeep = srcFrontZ - FRONT_WALL_SKIN;
    const keepPos: number[] = [], keepNor: number[] = [];
    for (let c = 0; c < candidates.length; c += 3) {
      const i0 = candidates[c], i1 = candidates[c + 1], i2 = candidates[c + 2];
      va.fromBufferAttribute(pos, i0); wa.copy(va).applyMatrix4(src.matrixWorld);
      vb.fromBufferAttribute(pos, i1); wb.copy(vb).applyMatrix4(src.matrixWorld);
      vc.fromBufferAttribute(pos, i2); wc.copy(vc).applyMatrix4(src.matrixWorld);
      if (Math.min(wa.z, wb.z, wc.z) < zKeep) continue;
      keepPos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
      for (const i of [i0, i1, i2]) {
        keepNor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      }
    }
    if (!keepPos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keepPos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(keepNor), 3));
    if (!state.frontWallMat) {
      state.frontWallMat = makePaintMaterial();
      state.frontWallMat.name = 'carpaint';
      state.frontWallMat.polygonOffset = true;
      state.frontWallMat.polygonOffsetFactor = -1;
      state.frontWallMat.polygonOffsetUnits = -2;
    }
    const overlay = new THREE.Mesh(geo, state.frontWallMat);
    overlay.renderOrder = 1;
    overlay.visible = false;
    overlay.castShadow = false;                      // the source already does
    src.add(overlay);
    state.frontWalls.push(overlay);
    console.info('[paint] front wall overlay:', keepPos.length / 9, 'tris from', src.name,
      '(expect ~1630)');
  }
  if (!state.frontWalls.length) console.warn('[paint] front wall triangles not found');
}

/* Every paint material — cab, trailer body, front wall — is registered with
   vehicle/paint.ts and driven from the same parameter set, so a "sync" is just a
   re-apply of the current params. */
export function syncTrailerPaintFromCab() {
  setPaint({});
}

export function setPaintTarget(mode: 'cab' | 'both') {
  state.paintTarget = mode === 'both' ? 'both' : 'cab';
  const meshes = trailerPanelMeshes();
  buildFrontWallOverlay();
  if (state.paintTarget === 'both') {
    if (!state.trailerPaintMat) {
      state.trailerPaintMat = makePaintMaterial();
      state.trailerPaintMat.name = 'carpaint';
    }
    for (const mesh of meshes) {
      if (!mesh.userData.origMat) mesh.userData.origMat = mesh.material;
      mesh.material = state.trailerPaintMat;
    }
    for (const w of state.frontWalls || []) w.visible = true;
  } else {
    // restore via stored refs — matching by material would miss meshes whose
    // material was already swapped (e.g. the Thermo King housing)
    if (state.trailer) {
      state.trailer.traverse((node) => {
        const o = node as THREE.Mesh;
        if (o.isMesh && o.userData.origMat) o.material = o.userData.origMat;
      });
    }
    for (const w of state.frontWalls || []) w.visible = false;
  }
}

/* ---------------- Scania: original FBX + old-viewer material treatment ----- */
/* FINISH table from the proven old scania viewer: name substring → [metal, rough] */
const SCANIA_FINISH = [
  ['carpaint', 0.90, 0.32], ['chrome', 1.00, 0.06], ['mirror', 1.00, 0.02],
  ['rim', 1.00, 0.18], ['mattemetal', 0.75, 0.50], ['tire', 0.00, 0.90],
  ['black', 0.05, 0.55], ['interior', 0.00, 0.75],
  ['red', 0.00, 0.45], ['blue', 0.00, 0.45], ['yellow', 0.00, 0.45], ['pink', 0.00, 0.45],
];
const SCANIA_GLASS = { clearglass: 0.22, windowglass: 0.32, redglass: 0.55, orangeglass: 0.60 };
const SCANIA_DEFAULT_FINISH = [0.20, 0.60];

function firstMatName(o: THREE.Mesh) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return ((m && m.name) || '').toLowerCase();
}

function convertScaniaMaterials(root: THREE.Object3D) {
  const cache = new Map<string, THREE.Material>();
  const convert = (raw: THREE.Material): THREE.Material => {
    const src = raw as THREE.MeshStandardMaterial;
    if (!src) return src;
    const hit = cache.get(src.uuid);
    if (hit) return hit;
    const name = (src.name || '').toLowerCase();
    let out: THREE.Material;
    if (name.includes('carpaint')) {
      out = makePaintMaterial(src.color, src.map);   // automotive flake paint
      out.name = src.name;
      (out as THREE.MeshStandardMaterial).envMapIntensity = 1.3;
      cache.set(src.uuid, out);
      return out;
    }
    const glassKey = Object.keys(SCANIA_GLASS).find(k => name.includes(k));
    if (glassKey) {
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        metalness: 0, roughness: 0.08,
        transparent: true, opacity: SCANIA_GLASS[glassKey as keyof typeof SCANIA_GLASS],
      });
      out.depthWrite = false;
    } else {
      let found: [number, number] | null = null;
      for (const [sub, met, rou] of SCANIA_FINISH) {
        if (name.includes(sub as string)) { found = [met as number, rou as number]; break; }
      }
      const [met, rou] = found || SCANIA_DEFAULT_FINISH;
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        map: src.map || null, normalMap: src.normalMap || null,
        metalness: met, roughness: rou,
      });
      const om = (out as THREE.MeshStandardMaterial).map;
      if (om) { om.colorSpace = THREE.SRGBColorSpace; om.anisotropy = 8; }
    }
    (out as THREE.MeshStandardMaterial).envMapIntensity = 1.3;
    cache.set(src.uuid, out);
    return out;
  };
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

function meshesWhere(root: THREE.Object3D, pred: (o: THREE.Mesh) => boolean) {
  const out: THREE.Mesh[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && pred(o)) out.push(o);
  });
  return out;
}

/* ---------------- cached FBX source ----------------
   /models/vehicles/scania.fbx is 46 MB, and BOTH the `scania` and the `daf` cab are built
   from it: without a cache, every switch between them re-downloads and re-parses
   the whole file. So the parsed root is kept here, keyed by URL, and each load
   gets a clone(true).

   The ownership rules that make that clone safe — all four matter:

   1. The cached root is PRISTINE. It is never added to the scene, never
      material-converted, never scaled or grounded. Even the very first load
      hands out a clone, so there is ONE rule for every cab instead of a special
      first case that would later have to be remembered.
   2. Object3D.clone() shares GEOMETRY and TEXTURES by reference — exactly what
      we want, it is the whole saving — and it shares MATERIALS too, which we do
      NOT want. convertScaniaMaterials() fixes that on the spot: it rebuilds
      every material of the clone into a brand-new instance (its dedupe Map is
      per call), so each cab ends up with its own paint materials registered in
      state.paintMats. Painting the DAF therefore cannot repaint the Scania.
   3. Because geometry and textures are shared, a clone must NOT be disposed the
      normal way. It carries `userData.tsSharedSource`, which disposeTree()
      honours by dropping only the per-clone materials.
   4. The PROMISE is cached, not the resolved root, so kicking off scania and daf
      at the same time still downloads once.

   SkinnedMesh is the one thing Object3D.clone() genuinely cannot copy (the bones
   are cloned but the skeleton is not rebound — that is what SkeletonUtils.clone
   exists for). This rip is static bodywork, but if that ever changes the cache
   disables itself instead of rendering a collapsed mesh. */
const fbxSourceCache = new Map<string, Promise<THREE.Group>>();

async function loadFBXSource(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  let pending = fbxSourceCache.get(url);
  if (!pending) {
    pending = loadFBX(url, onProgress).then(root => {
      /* strip baked lights/cameras from the rip — done ONCE here, on the
         pristine root, so every clone comes out already clean */
      const kill: THREE.Object3D[] = [];
      root.traverse((o) => {
        if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) kill.push(o);
      });
      kill.forEach((o) => o.parent && o.parent.remove(o));
      let skinned = false;
      root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
      if (skinned) {
        console.warn('[fbx] ' + url + ' contém SkinnedMesh — cache desativado '
          + '(clone não reassocia o esqueleto).');
        fbxSourceCache.delete(url);
      }
      return root;
    });
    // a failed load must not be remembered, or the cab could never be retried
    pending.catch(() => fbxSourceCache.delete(url));
    fbxSourceCache.set(url, pending);
  }
  const source = await pending;
  /* Identity, not just presence: if the entry was dropped (skinned, or a failed
     load that has since been retried), THIS root is ours alone and must be
     handed over untagged so disposeTree() frees it normally. */
  if (fbxSourceCache.get(url) !== pending) return source;
  if (onProgress) onProgress(1);   // a cache hit downloads nothing: close the bar
  try {
    const clone = source.clone(true);
    clone.userData.tsSharedSource = true;
    return clone;
  } catch (e) {
    /* Never let the optimisation be the thing that stops the studio booting:
       give up the cache for this URL and fall back to the old behaviour of one
       fresh download per load. */
    console.warn('[fbx] clone falhou — cache desativado para ' + url, e);
    fbxSourceCache.delete(url);
    return source;
  }
}

/* `def` is the cab definition, so the file comes from the manifest and the logs
   name the cab that is actually loading (scania and daf share this pipeline). */
async function loadScaniaOriginal(def: CabDef, onProgress?: (t: number) => void) {
  const tag = def?.id || 'scania';
  const root = await loadFBXSource(assetUrl(def?.file || SCANIA_FBX), onProgress);

  convertScaniaMaterials(root);

  const rig = new THREE.Group();
  rig.add(root);
  /* the rig is what ends up in state.cab, so carry the "shares geometry with the
     FBX cache" flag up to it — that is the level disposeTree() inspects */
  rig.userData.tsSharedSource = !!root.userData?.tsSharedSource;
  rig.updateWorldMatrix(true, true);

  /* uniform scale anchored on the steer tires: median tire-mesh bounding
     diameter (vertical) → 1.015 m */
  const tires = meshesWhere(root, o => firstMatName(o).includes('tire'));
  if (tires.length) {
    const ds = tires
      .map((m) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y)
      .filter((d) => d > 1e-9)
      .sort((a, b) => a - b);
    const d = ds[Math.floor(ds.length / 2)];
    if (d) rig.scale.setScalar(STEER_TIRE_OD / d);
    console.info(`[${tag}] tire meshes:`, tires.length, 'median OD:', d, '→ scale', (STEER_TIRE_OD / d).toFixed(5));
  } else {
    console.warn(`[${tag}] no tire-material meshes found — FBX left unscaled!`);
  }
  rig.updateWorldMatrix(true, true);

  /* orient front to +Z: longest horizontal axis = length; front detected via
     the WHEEL_*F empties (front wheels sit at the grille end) */
  const box = new THREE.Box3().setFromObject(rig);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x > size.z ? 'x' : 'z';
  const fronts: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (/wheel[_ ]?[lr]f/i.test(o.name) || /wheel[_ ]?f[lr]/i.test(o.name)) {
      fronts.push(o.getWorldPosition(new THREE.Vector3()));
    }
  });
  let dir: number;
  if (fronts.length) {
    const avg = fronts.reduce((a, p) => a + p[axis as 'x' | 'z'], 0) / fronts.length;
    dir = Math.sign(avg - center[axis as 'x' | 'z']) || 1;
  } else {
    dir = -1;   // source vehicle faces -Y in Blender terms; verified empirically
    console.warn(`[${tag}] WHEEL_*F empties not found — fallback orientation`);
  }
  let yaw = 0;
  if (axis === 'z') yaw = dir > 0 ? 0 : Math.PI;
  else yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  if (yaw) rig.rotation.y = yaw;
  rig.updateWorldMatrix(true, true);
  console.info(`[${tag}] axis:`, axis, 'frontDir:', dir, 'yaw:', (yaw * 180 / Math.PI) + '°',
    'wheelF nodes:', fronts.length);
  return rig;
}

/* ---------------- cab ---------------- */
export async function loadCab(id: string, onProgress?: (t: number) => void) {
  const def = state.byId[id];
  if (!def) throw new Error('Cabine desconhecida: ' + id);
  const cab = def.format === 'fbx-scania'
    ? await loadScaniaOriginal(def, onProgress)
    : await loadGLB(assetUrl(def.file), onProgress);

  if (state.cab) {
    state.cabGroup.remove(state.cab);
    disposeTree(state.cab);
  }
  setupCommon(cab);
  auditTransparency(cab, def.id);            // only glass may be transparent
  state.cabGroup.add(cab);
  const wheelRe = new RegExp(def.wheelMeshRegex || 'tire|rim|pneu', 'i');
  // FBX mesh names may not carry wheel words — match material names too
  const wheelPred = (o: THREE.Mesh) => wheelRe.test(o.name) || wheelRe.test(firstMatName(o));
  const box = groundAndCenter(cab, /./, wheelPred);
  cab.position.z -= box.min.z;               // cab rear at z=0 → occupies [0, length]
  cab.position.z += CAB_FORWARD_GAP;         // slightly forward: more cab↔trailer gap
  cab.updateWorldMatrix(true, true);

  state.cab = cab;
  state.cabId = id;
  state.cabDef = def;
  state.cabBox = bboxOfMatching(cab, /./);

  const subs = (def.paintMaterials || ['carpaint']).map((s) => s.toLowerCase());
  // GLB cabs (volvo): upgrade the paint materials to automotive flake paint
  if (def.format !== 'fbx-scania') {
    const cache = new Map<string, THREE.Material>();
    cab.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const rep = mats.map((raw) => {
        const m = raw as THREE.MeshStandardMaterial;
        if (m && subs.some((sub) => (m.name || '').toLowerCase().includes(sub))) {
          const cached = cache.get(m.uuid);
          if (cached) return cached;
          const paint = makePaintMaterial(m.color, m.map);
          paint.name = m.name;
          cache.set(m.uuid, paint);
          return paint;
        }
        return m;
      });
      o.material = Array.isArray(o.material) ? rep : rep[0];
    });
  }
  state.paintMats = [];
  const seen = new Set<THREE.Material>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && !seen.has(m) && subs.some((sub) => (m.name || '').toLowerCase().includes(sub))) {
        seen.add(m);
        state.paintMats.push(m);
      }
    }
  });
  /* Newly created paint materials register themselves with vehicle/paint.ts, so a
     re-apply pushes the CURRENT parameters onto them — the imported colour is
     never used, and a cab swap keeps whatever the user had configured. */
  setPaint({});
  reapplyVehicleWetness();     // a freshly loaded cab starts dry otherwise
  placeTrailer();
  syncTrailerPaintFromCab();   // keep painted trailer in step after a cab switch
  return def;
}

/* ---------------- trailer ---------------- */
export async function loadTrailer(onProgress?: (t: number) => void) {
  const trailer = await loadGLB(VEHICLES_DIR + 'trailer.glb', onProgress);
  setupCommon(trailer);
  state.trailerGroup.add(trailer);
  const box = groundAndCenter(trailer, /^(SIDE_L|SIDE_R|REAR)$/, /pneu|tire/i);
  auditTransparency(trailer, 'trailer');     // only glass may be transparent
  state.trailer = trailer;
  state.trailerBase = { pos: trailer.position.clone(), frontZ: box.max.z };
  state.trailerBox = box;
  placeTrailer();
  await attachThermoKing();   // optional — skips gracefully if the GLB is absent
  reapplyVehicleWetness();
  return trailer;
}

/* ---------------- Thermo King refrigeration unit ----------------
   Attached as a child of the trailer root: follows coupling moves and hides
   with the Implemento toggle. Back mounting face sits flush on the front-wall
   plane, centered on X, top ~0.15 m below the trailer roof line. */
export async function attachThermoKing() {
  let meta: { dims?: unknown } | null = null;
  try { meta = await fetchJSON(VEHICLES_DIR + 'thermoking_meta.json'); } catch { /* optional */ }
  let tk: THREE.Group;
  try {
    tk = await loadGLB(VEHICLES_DIR + 'thermoking.glb');
  } catch (e: unknown) {
    console.warn('[tk] thermoking.glb indisponível —', errText(e));
    return;
  }
  setupCommon(tk);
  auditTransparency(tk, 'thermoking');       // only glass may be transparent
  // Real SLXi housings are slimmer than the rip: squash the depth (local Z,
  // the mount axis) to 0.53 m. The back mounting plane is local z=0, so the
  // scale is anchored there and the flush fit is preserved.
  const TK_DEPTH = 0.53;
  {
    const raw = new THREE.Box3().setFromObject(tk);
    const rawDepth = raw.max.z - raw.min.z;
    if (rawDepth > 1e-6) tk.scale.z *= TK_DEPTH / rawDepth;
    tk.updateWorldMatrix(true, true);
  }
  const b = new THREE.Box3().setFromObject(tk);      // measured, not assumed
  const sideBox = bboxOfMatching(state.trailer as THREE.Object3D, /^(SIDE_L|SIDE_R|REAR)$/);
  const wallZ = sideBox.max.z;
  const roofY = sideBox.max.y;
  const cx = (sideBox.min.x + sideBox.max.x) / 2;
  const target = new THREE.Vector3(
    cx - (b.min.x + b.max.x) / 2,                    // centered on the wall
    (roofY - 0.02) - b.max.y,                        // top flush with roof line − 0.02 m
    wallZ - b.min.z                                  // back face flush on the wall plane
  );
  const trailer = state.trailer as THREE.Object3D;
  trailer.updateWorldMatrix(true, false);
  tk.position.copy(trailer.worldToLocal(target.clone()));
  trailer.add(tk);
  state.tk = tk;
  state.tkDepth = b.max.z - b.min.z;                 // extends cab-clearance clamp
  const dims = meta?.dims || null;
  console.info('[tk] attached — depth', state.tkDepth.toFixed(3),
    'bbox', b.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)),
    dims ? 'meta ' + JSON.stringify(dims) : '(sem meta)');
  placeTrailer();                                    // re-clamp with tk depth
}

/* Coupling per CONVENTIONS.md: kingpin over the fifth wheel. */
const CAB_TRAILER_CLEARANCE = 0.15;   // min gap (m) between cab rear bodywork and trailer front wall

export function placeTrailer() {
  const t = state.trailer;
  if (!t || !state.trailerBase) return;
  const kp = state.trailerMeta?.kingpin;
  const fw = state.cabDef?.fifthwheel;
  let frontZ = LEGACY_TRAILER_FRONT_Z, lift = 0;
  if (kp && fw && typeof fw.z === 'number') {
    frontZ = fw.z + kp.zFromFront;
    if (typeof fw.topY === 'number' && typeof kp.plateBottomY === 'number') {
      lift = fw.topY - kp.plateBottomY;
    }
  }
  // No-overlap guard: cab occupies z∈[0,length], trailer extends toward -Z from
  // its front wall at frontZ. Keep that wall — plus the Thermo King unit that
  // protrudes tkDepth toward the cab — behind the cab's rear bodywork.
  const rb = state.cabDef?.rearBodyZ;
  if (typeof rb === 'number') {
    frontZ = Math.min(frontZ, rb - CAB_TRAILER_CLEARANCE - (state.tkDepth || 0));
  }
  t.position.copy(state.trailerBase.pos);
  t.position.z += (frontZ + state.coupling.z) - state.trailerBase.frontZ;
  // Grounding wins: never sink the trailer through the floor. The base pose has
  // tire min-y = 0, so the total vertical offset IS the tire clearance. Only
  // lift for the kingpin match (nose-high is fine, sunk wheels are not), and
  // clamp the Engate height slider so tires stay above -0.01 m.
  let dy = Math.max(0, lift) + state.coupling.y;
  if (dy < -0.01) dy = -0.01;
  t.position.y += dy;
  t.updateWorldMatrix(true, true);
}
