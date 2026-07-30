/* Manifest loading, model loading (Scania = ORIGINAL FBX via FBXLoader with
   runtime material treatment; trailer + volvo = curated GLBs), cab switching,
   grounding, coupling. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, onRig } from './scene.js';
import {
  makePaintMaterial, forgetPaintMaterial, setPaint, isPaintMaterial,
} from './paint.js';
import { ASSET_BASE } from './dom.js';

export { makePaintMaterial };

/* The Blender-processed scania GLB was rejected by the user — the original FBX
   through three.js FBXLoader (like the old scania viewer) is the approved look. */
const SCANIA_FBX = 'orig/scania.fbx';
const STEER_TIRE_OD = 1.015;   // m — real steer-tire outer diameter anchors the FBX scale

/* Legacy values used when manifests are not (yet) available. */
const LEGACY_TRAILER_FRONT_Z = 2.65;
const DEFAULT_CABS = {
  cabs: [{
    id: 'scania', name: 'Scania S730', file: 'assets/scania.glb',
    paintMaterials: ['carpaint'],
    wheelMeshRegex: 'tire|rim|pneu',
    dims: { height: 3.85, length: 5.7 },
    fifthwheel: null,                    // null → legacy trailer placement
  }],
};

try { localStorage.removeItem('truckstudio.coupling.v1'); } catch (_) { /* legacy key */ }

export const state = {
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
const draco = new DRACOLoader().setDecoderPath(ASSET_BASE + 'draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const fbxLoader = new FBXLoader();

export function loadGLB(url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(url,
      g => resolve(g.scene),
      e => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
      () => reject(new Error('Falha ao carregar ' + url)));
  });
}

export function loadFBX(url, onProgress) {
  return new Promise((resolve, reject) => {
    fbxLoader.load(url,
      root => resolve(root),
      e => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
      err => reject(new Error('Falha ao carregar ' + url +
        (err && err.message ? ' — ' + err.message : ''))));
  });
}

/* ---------------- manifests ---------------- */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

export async function loadManifests() {
  try {
    const j = await fetchJSON(ASSET_BASE + 'assets/cabs.json');
    if (!Array.isArray(j.cabs) || !j.cabs.length) throw new Error('cabs.json vazio');
    state.cabs = j.cabs;
  } catch (e) {
    console.warn('[manifest] cabs.json indisponível — usando padrão Scania.', e.message || e);
    state.cabs = DEFAULT_CABS.cabs;
    state.manifestFallback = true;
  }
  // scania ALWAYS loads the original FBX, regardless of what the manifest says
  for (const c of state.cabs) {
    if (c.id === 'scania') { c.file = SCANIA_FBX; c.format = 'fbx-scania'; }
  }
  // availability probe (a listed model may not be exported yet)
  await Promise.all(state.cabs.map(async c => {
    try { c.available = (await fetch(ASSET_BASE + c.file, { method: 'HEAD' })).ok; }
    catch (_) { c.available = false; }
  }));
  state.byId = Object.fromEntries(state.cabs.map(c => [c.id, c]));

  try { state.trailerMeta = await fetchJSON(ASSET_BASE + 'assets/trailer_meta.json'); }
  catch (e) {
    console.warn('[manifest] trailer_meta.json indisponível — engate legado + painéis retangulares.', e.message || e);
    state.trailerMeta = null;
  }
  return state;
}

/* ---------------- material / mesh setup ---------------- */
const GLASS_RE = /glass|vidro|windshield|window|winscreen|cristal|glazing/i;

export function setupCommon(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
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

function auditTransparency(root, label) {
  const glassOk = [], forced = [];
  const seen = new Set();
  root.traverse(o => {
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

function bboxOfMatching(root, matcher) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  const test = typeof matcher === 'function' ? matcher : (o => matcher.test(o.name));
  root.traverse(o => { if (o.isMesh && test(o)) box.expandByObject(o); });
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}

function groundAndCenter(root, bodyRe, wheelRe) {
  const body = bboxOfMatching(root, bodyRe);
  const wheels = bboxOfMatching(root, wheelRe);
  root.position.x -= (body.min.x + body.max.x) / 2;
  root.position.y -= wheels.min.y;
  root.updateWorldMatrix(true, true);
  return bboxOfMatching(root, bodyRe);
}

function disposeTree(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      forgetPaintMaterial(m);          // drop it from the paint registry too
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    }
  });
}

/* The car-paint material itself lives in paint.js (three finish families,
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
const dryRough = new WeakMap();

function applyVehicleWetness(w) {
  for (const root of [state.cab, state.trailer]) {
    if (!root) continue;
    root.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || isPaintMaterial(m) || typeof m.roughness !== 'number') continue;
        if (!dryRough.has(m)) dryRough.set(m, m.roughness);
        const dry = dryRough.get(m);
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

onRig(rig => {
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

function isWhiteBodyMat(m) {
  return !!m && (m.name || '').toLowerCase().includes(WHITE_BODY_SUB);
}

/* Paint set: the named livery panels only. The rest of the white body is ONE
   joined mesh (opt_Cor_padrao_branco…: front wall + roof + trim + frames all
   in a single geometry — verified by bbox enumeration), so the FRONT WALL is
   handled separately by extracting its triangles into a paint overlay; see
   buildFrontWallOverlay(). Frames/rails/posts stay on the original material. */
const TK_PAINT_SUB = 'tk-housing-white';   // Thermo King housing joins the paint set

function trailerPanelMeshes() {
  const out = [];
  if (state.trailer) {
    state.trailer.traverse(o => {
      if (!o.isMesh) return;
      if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) { out.push(o); return; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m && (m.name || '').toLowerCase().includes(TK_PAINT_SUB))) out.push(o);
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
  const sources = [];
  state.trailer.traverse(o => {
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
    const candidates = [];
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
    const keepPos = [], keepNor = [];
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
   paint.js and driven from the same parameter set, so a "sync" is just a
   re-apply of the current params. */
export function syncTrailerPaintFromCab() {
  setPaint({});
}

export function setPaintTarget(mode) {
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
      state.trailer.traverse(o => {
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

function firstMatName(o) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return ((m && m.name) || '').toLowerCase();
}

function convertScaniaMaterials(root) {
  const cache = new Map();
  const convert = src => {
    if (!src) return src;
    if (cache.has(src.uuid)) return cache.get(src.uuid);
    const name = (src.name || '').toLowerCase();
    let out;
    if (name.includes('carpaint')) {
      out = makePaintMaterial(src.color, src.map);   // automotive flake paint
      out.name = src.name;
      out.envMapIntensity = 1.3;
      cache.set(src.uuid, out);
      return out;
    }
    const glassKey = Object.keys(SCANIA_GLASS).find(k => name.includes(k));
    if (glassKey) {
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        metalness: 0, roughness: 0.08,
        transparent: true, opacity: SCANIA_GLASS[glassKey],
      });
      out.depthWrite = false;
    } else {
      let hit = null;
      for (const [sub, met, rou] of SCANIA_FINISH) {
        if (name.includes(sub)) { hit = [met, rou]; break; }
      }
      const [met, rou] = hit || SCANIA_DEFAULT_FINISH;
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        map: src.map || null, normalMap: src.normalMap || null,
        metalness: met, roughness: rou,
      });
      if (out.map) { out.map.colorSpace = THREE.SRGBColorSpace; out.map.anisotropy = 8; }
    }
    out.envMapIntensity = 1.3;
    cache.set(src.uuid, out);
    return out;
  };
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

function meshesWhere(root, pred) {
  const out = [];
  root.traverse(o => { if (o.isMesh && pred(o)) out.push(o); });
  return out;
}

async function loadScaniaOriginal(onProgress) {
  const root = await loadFBX(ASSET_BASE + SCANIA_FBX, onProgress);

  /* strip baked lights/cameras from the rip */
  const kill = [];
  root.traverse(o => { if (o.isLight || o.isCamera) kill.push(o); });
  kill.forEach(o => o.parent && o.parent.remove(o));

  convertScaniaMaterials(root);

  const rig = new THREE.Group();
  rig.add(root);
  rig.updateWorldMatrix(true, true);

  /* uniform scale anchored on the steer tires: median tire-mesh bounding
     diameter (vertical) → 1.015 m */
  const tires = meshesWhere(root, o => firstMatName(o).includes('tire'));
  if (tires.length) {
    const ds = tires
      .map(m => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y)
      .filter(d => d > 1e-9)
      .sort((a, b) => a - b);
    const d = ds[Math.floor(ds.length / 2)];
    if (d) rig.scale.setScalar(STEER_TIRE_OD / d);
    console.info('[scania] tire meshes:', tires.length, 'median OD:', d, '→ scale', (STEER_TIRE_OD / d).toFixed(5));
  } else {
    console.warn('[scania] no tire-material meshes found — FBX left unscaled!');
  }
  rig.updateWorldMatrix(true, true);

  /* orient front to +Z: longest horizontal axis = length; front detected via
     the WHEEL_*F empties (front wheels sit at the grille end) */
  const box = new THREE.Box3().setFromObject(rig);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x > size.z ? 'x' : 'z';
  const fronts = [];
  root.traverse(o => {
    if (/wheel[_ ]?[lr]f/i.test(o.name) || /wheel[_ ]?f[lr]/i.test(o.name)) {
      fronts.push(o.getWorldPosition(new THREE.Vector3()));
    }
  });
  let dir;
  if (fronts.length) {
    const avg = fronts.reduce((a, p) => a + p[axis], 0) / fronts.length;
    dir = Math.sign(avg - center[axis]) || 1;
  } else {
    dir = -1;   // source vehicle faces -Y in Blender terms; verified empirically
    console.warn('[scania] WHEEL_*F empties not found — fallback orientation');
  }
  let yaw = 0;
  if (axis === 'z') yaw = dir > 0 ? 0 : Math.PI;
  else yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  if (yaw) rig.rotation.y = yaw;
  rig.updateWorldMatrix(true, true);
  console.info('[scania] axis:', axis, 'frontDir:', dir, 'yaw:', (yaw * 180 / Math.PI) + '°',
    'wheelF nodes:', fronts.length);
  return rig;
}

/* ---------------- cab ---------------- */
export async function loadCab(id, onProgress) {
  const def = state.byId[id];
  if (!def) throw new Error('Cabine desconhecida: ' + id);
  const cab = def.format === 'fbx-scania'
    ? await loadScaniaOriginal(onProgress)
    : await loadGLB(ASSET_BASE + def.file, onProgress);

  if (state.cab) {
    state.cabGroup.remove(state.cab);
    disposeTree(state.cab);
  }
  setupCommon(cab);
  auditTransparency(cab, def.id);            // only glass may be transparent
  state.cabGroup.add(cab);
  const wheelRe = new RegExp(def.wheelMeshRegex || 'tire|rim|pneu', 'i');
  // FBX mesh names may not carry wheel words — match material names too
  const wheelPred = o => wheelRe.test(o.name) || wheelRe.test(firstMatName(o));
  const box = groundAndCenter(cab, /./, wheelPred);
  cab.position.z -= box.min.z;               // cab rear at z=0 → occupies [0, length]
  cab.position.z += CAB_FORWARD_GAP;         // slightly forward: more cab↔trailer gap
  cab.updateWorldMatrix(true, true);

  state.cab = cab;
  state.cabId = id;
  state.cabDef = def;
  state.cabBox = bboxOfMatching(cab, /./);

  const subs = (def.paintMaterials || ['carpaint']).map(s => s.toLowerCase());
  // GLB cabs (volvo): upgrade the paint materials to automotive flake paint
  if (def.format !== 'fbx-scania') {
    const cache = new Map();
    cab.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const rep = mats.map(m => {
        if (m && subs.some(s => (m.name || '').toLowerCase().includes(s))) {
          if (!cache.has(m.uuid)) {
            const p = makePaintMaterial(m.color, m.map);
            p.name = m.name;
            cache.set(m.uuid, p);
          }
          return cache.get(m.uuid);
        }
        return m;
      });
      o.material = Array.isArray(o.material) ? rep : rep[0];
    });
  }
  state.paintMats = [];
  const seen = new Set();
  cab.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && !seen.has(m) && subs.some(s => (m.name || '').toLowerCase().includes(s))) {
        seen.add(m);
        state.paintMats.push(m);
      }
    }
  });
  /* Newly created paint materials register themselves with paint.js, so a
     re-apply pushes the CURRENT parameters onto them — the imported colour is
     never used, and a cab swap keeps whatever the user had configured. */
  setPaint({});
  reapplyVehicleWetness();     // a freshly loaded cab starts dry otherwise
  placeTrailer();
  syncTrailerPaintFromCab();   // keep painted trailer in step after a cab switch
  return def;
}

/* ---------------- trailer ---------------- */
export async function loadTrailer(onProgress) {
  const trailer = await loadGLB(ASSET_BASE + 'assets/trailer.glb', onProgress);
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
  let meta = null;
  try { meta = await fetchJSON(ASSET_BASE + 'assets/thermoking_meta.json'); } catch (_) { /* optional */ }
  let tk;
  try {
    tk = await loadGLB(ASSET_BASE + 'assets/thermoking.glb');
  } catch (e) {
    console.warn('[tk] thermoking.glb indisponível —', e.message || e);
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
  const sideBox = bboxOfMatching(state.trailer, /^(SIDE_L|SIDE_R|REAR)$/);
  const wallZ = sideBox.max.z;
  const roofY = sideBox.max.y;
  const cx = (sideBox.min.x + sideBox.max.x) / 2;
  const target = new THREE.Vector3(
    cx - (b.min.x + b.max.x) / 2,                    // centered on the wall
    (roofY - 0.02) - b.max.y,                        // top flush with roof line − 0.02 m
    wallZ - b.min.z                                  // back face flush on the wall plane
  );
  state.trailer.updateWorldMatrix(true, false);
  tk.position.copy(state.trailer.worldToLocal(target.clone()));
  state.trailer.add(tk);
  state.tk = tk;
  state.tkDepth = b.max.z - b.min.z;                 // extends cab-clearance clamp
  const dims = (meta && meta.dims) || null;
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
  const kp = state.trailerMeta && state.trailerMeta.kingpin;
  const fw = state.cabDef && state.cabDef.fifthwheel;
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
  const rb = state.cabDef && state.cabDef.rearBodyZ;
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
