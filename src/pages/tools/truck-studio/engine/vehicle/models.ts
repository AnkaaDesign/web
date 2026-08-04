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
import { captureReflectionProbe } from '../scene/probe';
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
  /**
   * Geometria LEVE, só para as miniaturas dos cards (ui/preview.ts). Existe
   * porque `file` pode ser um FBX de dezenas de MB — a fonte aprovada para o
   * estúdio — e um card de 220 px não justifica esse download. Ausente numa
   * cabine que já é .glb: ali `file` serve para as duas coisas.
   */
  preview?: string;
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
  /** metres from the front wall back to the tyre contact patch — the pivot the
   *  coupling pitch turns about. Constant for a given implement. */
  trailerPivotFromFront?: number;
  /** half the bogie's length. Pitching about the bogie centre sinks whichever
   *  end is downhill by this times sin(pitch); the placement compensates. */
  trailerTyreHalfSpan?: number;
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
/* ---------------- onde o conjunto fica no cenário ----------------
   O caminhão não nasce mais na origem: ele fica 12 m adiante e virado 180°, ou
   seja sobre a faixa e apontando para a saída do pátio em vez de para o fundo
   dele. É a mesma pose do card do cenário — o estúdio e o thumbnail não podem
   mostrar coisas diferentes.

   POR QUE UM NÓ PAI, e não a posição dos dois grupos (que foi a primeira
   tentativa e quebrou): o assentamento e o engate — groundAndCenter(), o
   ancoramento em z de loadCab(), attachThermoKing() — medem caixas em ESPAÇO DE
   MUNDO e descontam o resultado de posições LOCAIS. Essa conta só fecha com o
   conjunto na origem. Com os grupos deslocados, cada medida voltava já com o
   deslocamento dentro e ele era descontado de novo; com o giro de 180° os eixos
   x/z ainda trocavam de sinal e o implemento ia parar longe do cavalo — medido:
   caixa do conjunto em z 17,8…36,7 em vez dos 5,8…24,6 esperados.

   Então o LUGAR mora aqui em cima, e é posto na identidade enquanto a conta
   roda (setRigPlacement(false) logo depois de cada download, restaurado no fim
   de placeTrailer, que é por onde todos os caminhos passam). Entre um e outro
   não existe quadro desenhado: as duas chamadas caem no mesmo trecho síncrono
   depois do await, então o conjunto nunca aparece na origem.

   O resto do motor não muda: focusOnRig(), frameAll() e a sonda de reflexo
   medem a caixa dos grupos, então a órbita e o probe acompanham sozinhos. */
export const rigGroup = new THREE.Group();
rigGroup.name = 'RIG';
/* z é medido no EIXO DA PISTA, não no sentido da cabine: com o giro de 180° o
   caminhão aponta para o -Z, então recuar (dar ré) é aumentar z. 22 = os 12 da
   primeira posição mais os 10 de recuo. */
export const RIG_PLACEMENT = { z: 22, yaw: Math.PI };

/** Liga (true) ou suspende (false) o lugar do conjunto no cenário. */
function setRigPlacement(on: boolean) {
  rigGroup.position.set(0, 0, on ? RIG_PLACEMENT.z : 0);
  rigGroup.rotation.set(0, on ? RIG_PLACEMENT.yaw : 0, 0);
  rigGroup.updateWorldMatrix(true, true);
}

rigGroup.add(state.cabGroup, state.trailerGroup);
scene.add(rigGroup);
setRigPlacement(true);

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
          /* A genuinely see-through surface that does NOT write depth has to be
             drawn after everything it covers, and GLASS_RE alone does not find
             them all: the trailer's rear lamp cover is `lente-sinaleita-traseira`
             — no "glass"/"vidro" in the name — so it kept renderOrder 0 while the
             marker-lamp cover beside it (`vidro-lanternas-pisca`) got 20. Two
             covers on the same lamp cluster, sorted into different passes, is
             what made the rear lamps flicker between angles. The rule that
             matters is the one about DEPTH, not about the word in the name: no
             depth write ⇒ draw last. */
          o.renderOrder = Math.max(o.renderOrder, 20);
        }
      }
    }
  });
}

/* App-side transparency audit: ONLY real glass may be transparent. Anything
   else flagged transparent (rip artifacts, loader quirks) is forced opaque.
   Complements the model-side fixes; logs every decision for verification. */
const GLASS_OK_RE = /glass|vidro|lente|windshield|window|winscreen|cristal|glazing|acrilic/i;

/* THE THIRD KIND OF TRANSPARENCY: a cut-out decal.
   ---------------------------------------------------------------------------
   This audit used to know two kinds — real glass, which stays transparent, and
   everything else, which is a rip artifact and is forced opaque. A marking whose
   shape lives in its texture's ALPHA is neither. Forcing it opaque does not make
   it look solid; it makes the whole QUAD render, so the mark arrives inside a
   rectangle of whatever the transparent pixels happen to carry.

   That is what was happening to the Ankaa mark on the mudflaps: the trailer's
   boot logged `FORÇADO OPACO: logo-ankaa` on every load. The mark is a 4-triangle
   quad with a cut-out texture, so it lost its cut-out and gained a plate.

   The right treatment is neither of the other two: keep the alpha, but resolve it
   with alphaTest instead of blending, so the decal still WRITES DEPTH and needs
   no sorting. `transparent` goes back to false for exactly that reason — with
   alphaTest the discarded fragments never reach the blend stage, and an opaque
   draw is what keeps the mark from flickering against the surface behind it. */
const DECAL_OK_RE = /logo|marca|adesivo|decal|faixa-?3m|placa/i;

function auditTransparency(root: THREE.Object3D, label: string) {
  const glassOk: string[] = [], decals: string[] = [], forced: string[] = [];
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
      } else if (DECAL_OK_RE.test(m.name || '')) {
        const std = m as THREE.MeshStandardMaterial;
        std.transparent = false;
        std.opacity = 1;
        std.depthWrite = true;
        std.alphaTest = Math.max(std.alphaTest || 0, 0.5);
        std.needsUpdate = true;
        decals.push(m.name || '(sem nome)');
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
    decals.length ? `· recorte por alphaTest: ${decals.join(', ')}` : '',
    forced.length ? `· FORÇADO OPACO: ${forced.join(', ')}` : '· nada forçado');
}

/* WHERE THE IMPLEMENT'S BODY IS — and why this is not just the panel names.
   ---------------------------------------------------------------------------
   Three placements are measured off the body box, not off the whole object:
   the grounding/centring in loadTrailer(), the front-wall paint overlay, and the
   Thermo King mount. All three used the regex /^(SIDE_L|SIDE_R|REAR)$/, which is
   the merge-by-material bake's contract.

   An UNFLATTENED bake does not carry those three meshes — it keeps the rip's own
   2151 meshes and their node transforms. bboxOfMatching() then finds nothing and
   falls back to `setFromObject(root)`, the box of EVERYTHING. That box is a
   different object: it includes the mudflaps, the landing gear and — once the
   unit is attached — the Thermo King itself.

   Measured on the unflattened bake: body front wall z 1.945, whole-object max z
   2.773. So the mount plane was read 0.83 m too far forward and the unit was
   hung in mid-air ahead of the wall, which is exactly what Kennedy photographed;
   the same 0.83 m also went into `trailerBase.frontZ` and pushed the coupling
   off by the same amount.

   So the body is identified by what BOTH bakes agree on: the three named panels
   when they exist, otherwise the white-body material the panels were cut from.
   Falling back to the whole object is never right here, and this predicate
   removes that possibility. */
const WHITE_BODY_RE = /cor_padrao_branco/i;

function bodyPanelPred(_root: THREE.Object3D): MeshMatcher {
  /* THE MATERIAL, NOT THE PANEL NAMES — in either bake.
     The named panels are only the OUTER SKIN cut out of the body; the roof cap
     and the frames stay behind on the joined mesh. Measuring the body by those
     names therefore reports a roof line ~0.21 m below the real one, and
     attachThermoKing() hangs the unit that much too low. That bit the moment
     buildLiveryPanels() started creating the same three names at runtime: the
     Thermo King dropped 21 cm on its own.
     Both bakes agree on the material — in the merged one the panels carry it too,
     so this predicate covers the skin AND the rest either way. */
  return (o: THREE.Mesh) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    return mats.some((m) => !!m && WHITE_BODY_RE.test(m.name || ''));
  };
}

/* THE TYRES THAT CARRY THE TRAILER — not every mesh with "pneu" in its name.
   ---------------------------------------------------------------------------
   Grounding, the coupling pivot and the bogie half-span are all read off "the
   tyres", matched by /pneu|tire/i. On this implement that also catches
   `pneu-estepe-01/02`: the SPARE, stowed under the chassis 1.2 m behind the
   rear axle and hanging clear of the ground.

   Measured on the unflattened bake — running tyres z −10.53 … −6.52, spare
   z −12.05 … −10.83 — so including it stretched the bogie box rearward and gave
   `trailerTyreHalfSpan` 2.763 m instead of 2.005 m. placeTrailer() then adds
   `halfSpan · sin(pitch)` to put the bogie back on the ground after the nose-down
   pitch, and with the half-span 0.758 m too large that raise came out 8.7 mm too
   high. The trailer's lowest point measured 8.3 mm above the road: it was
   floating on exactly that error.

   So the running set is defined by CONTACT, not by name: of the tyre-ish meshes,
   keep those whose lowest point sits within TYRE_CONTACT_BAND of the lowest tyre
   point in the model. That is true of the bogie in any bake and false of a
   stowed spare, and it does not depend on the rip's naming. */
const TYRE_RE = /pneu|tire/i;
const TYRE_CONTACT_BAND = 0.05;   // m above the lowest tyre point

/* MEASURED FROM THE POSITION ATTRIBUTE, NEVER FROM A BOUNDING BOX.
   ---------------------------------------------------------------------------
   `Box3.setFromObject` takes the geometry's LOCAL box and transforms its eight
   corners. For anything whose node carries a rotation the result is the box of a
   rotated box — strictly larger than the real bounds, and there is no bound on
   how much larger. A tyre is the worst case here: a ~1.0 m disc only 0.3 m wide,
   sitting on a rip node with an arbitrary rotation.

   That is what was making the trailer hover. groundAndCenter() did
   `position.y -= wheels.min.y` with `wheels` from setFromObject, so it believed
   the tyres reached ~230 mm lower than they do and lifted the whole implement by
   that much. Measured by reading every tyre vertex instead: all twelve sit
   between 228.5 and 259.0 mm above the road, a 30 mm spread that is exactly the
   0.661° coupling pitch over the 2.5 m bogie — the wheels were never uneven, the
   ruler was.

   (I read the inflated boxes first and reported the wheels as sitting at twelve
   different heights. They do not. The playbook's rule — never measure these
   assets through a bounding box — is in it for this exact reason.) */
interface TyreMetrics {
  /** true lowest world-space vertex of the running tyres */
  minY: number;
  zMin: number;
  zMax: number;
  meshes: Set<THREE.Mesh>;
}

function runningTyres(root: THREE.Object3D): TyreMetrics | null {
  root.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  const found: { mesh: THREE.Mesh; minY: number; zMin: number; zMax: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!(TYRE_RE.test(o.name) || mats.some((m) => !!m && TYRE_RE.test(m.name || '')))) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    let minY = Infinity, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < minY) minY = v.y;
      if (v.z < zMin) zMin = v.z;
      if (v.z > zMax) zMax = v.z;
    }
    if (Number.isFinite(minY)) found.push({ mesh: o, minY, zMin, zMax });
  });
  if (!found.length) {
    console.warn('[implemento] nenhum pneu encontrado — assentamento e engate ficam no fallback.');
    return null;
  }
  /* The bogie is what TOUCHES: a spare stowed under the chassis is a tyre by name
     and by material, and including it stretched the half-span from 2.006 m to
     2.763 m. Contact decides, so this holds in any bake and needs no naming. */
  const floor = Math.min(...found.map((e) => e.minY));
  const out: TyreMetrics = { minY: floor, zMin: Infinity, zMax: -Infinity, meshes: new Set() };
  let dropped = 0;
  for (const e of found) {
    if (e.minY > floor + TYRE_CONTACT_BAND) { dropped++; continue; }
    out.meshes.add(e.mesh);
    out.zMin = Math.min(out.zMin, e.zMin);
    out.zMax = Math.max(out.zMax, e.zMax);
  }
  console.info('[implemento] pneus de rolagem:', out.meshes.size, 'de', found.length,
    dropped ? `(${dropped} fora do plano de contato — estepe)` : '(nenhum descartado)',
    '· base', (floor * 1000).toFixed(1), 'mm · bogie z',
    out.zMin.toFixed(2), '…', out.zMax.toFixed(2));
  return out;
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

/** @param groundY exact lowest contact height, when the caller has measured it
 *  properly. Omitted → the wheel matcher's bounding box, which is only safe for
 *  wheels whose nodes are axis-aligned (see runningTyres()). */
function groundAndCenter(
  root: THREE.Object3D, bodyRe: MeshMatcher, wheelRe: MeshMatcher, groundY?: number,
) {
  const body = bboxOfMatching(root, bodyRe);
  const drop = groundY !== undefined ? groundY : bboxOfMatching(root, wheelRe).min.y;
  root.position.x -= (body.min.x + body.max.x) / 2;
  root.position.y -= drop;
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
  const sideBox = bboxOfMatching(state.trailer, bodyPanelPred(state.trailer));
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
      /* CONSTANT bias, no slope term. This overlay really is coincident with the
         wall it is cut from — unlike the livery panels, whose triangles are moved
         out — so it needs a bias to win the depth test. But `polygonOffsetFactor`
         is SLOPE-SCALED: sighting along the front at a grazing angle it grows
         without bound and the paint bleeds out over the inox corner posts and the
         Thermo King's frame beside it, which is what Kennedy saw leaking on the
         nose. `units` is the constant term and a few of them are all a coplanar
         pair ever needs, so factor goes to 0 and the leak with it. */
      state.frontWallMat.polygonOffset = true;
      state.frontWallMat.polygonOffsetFactor = 0;
      state.frontWallMat.polygonOffsetUnits = -4;
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
      /* NO polygonOffset here. It was added when buildLiveryPanels() duplicated
         the skin — painting swapped the bias away and the flank flickered between
         white and the chosen colour. The panels are now CUT OUT of the body
         instead, so there is no second surface, and a bias on the paint would
         only make it fight the perimeter rail below it. The overlay for the front
         wall still needs one; see frontWallMat. */
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

/* Cor base dos METAIS da rip, corrigida.
   ---------------------------------------------------------------------------
   O letreiro SCANIA da grade saía PRETO. A causa não é iluminação: em
   `metalness: 1` o three faz `specularColor = mix(0.04, diffuseColor, metalness)`
   e ZERA o difuso — ou seja, a cor base deixa de ser tinta e passa a ser o
   FILTRO do reflexo. O material `chrome` da rip veio com cor 0,06 (quase preto),
   então ele refletia 6% do céu: um espelho pintado de preto.

   Os escalares vieram capturados do jogo original, onde o mesmo material era
   lido por outro pipeline. Medido nesta cabine: chrome 0,06, mirror (0,21 0,36
   0,30 — um espelho VERDE) e rim 0,11. Nenhum dos três é uma superfície que
   existe.

   Os números abaixo são refletâncias reais: cromado polido devolve ~90% do que
   recebe, um espelho ~95%, e uma liga de alumínio usinada ~70%. É a mesma
   doutrina que applyTrailerFinish() aplica às lentes das lanternas — a diferença
   é que lá o erro era metalness demais, e aqui é cor de menos. */
const SCANIA_METAL_TINT: [sub: string, r: number, g: number, b: number][] = [
  ['chrome', 0.90, 0.90, 0.90],
  ['mirror', 0.95, 0.95, 0.95],
  ['rim', 0.70, 0.70, 0.72],
];

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
      /* NÃO fixar envMapIntensity aqui: virou parâmetro de tinta
         (PaintParams.envMapIntensity) e quem manda nele é applyToMaterials(),
         que roda a cada setPaint(). O 1.3 que morava nesta linha reescrevia o
         ajuste gravado da cor toda vez que uma cabine era convertida. */
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
      /* Só onde NÃO há mapa: um metal texturizado já traz a variação dele, e
         sobrescrever a cor apagaria a textura inteira. */
      if (!src.map) {
        for (const [sub, r, g, b] of SCANIA_METAL_TINT) {
          if (!name.includes(sub)) continue;
          (out as THREE.MeshStandardMaterial).color.setRGB(r, g, b);
          break;
        }
      }
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

  setRigPlacement(false);       // assentamento e ancoragem em z medem o mundo; ver rigGroup
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

/* ---------------- what the GLB cannot carry ----------------
   The implement is baked out of the rip viewer's live scene
   (`viewer/src/exportTrailer.js`), and that bake loses three things, because
   glTF has no field for any of them:

     polygonOffset   — the viewer gives every DECAL −4/−4, so a marking lying on
                       the surface it belongs to always wins the depth test.
     envMapIntensity — authored per material family in the viewer's materials.js
                       (0.5 on the clear lamp covers, 0.3 on rubber). glTF drops
                       it, three defaults it to 1, and setupCommon() then raises
                       EVERYTHING to 1.35.
     depthWrite      — re-derived by setupCommon() from `transparent`.

   The third is already handled. The first two are restored here, and the reason
   they have to be is the rear lamps: the studio was rendering a 0.06-opacity
   cover at 1.35 env under a sunlit HDRI, which laid a white sheen over the red
   plate behind it and turned the whole cluster milky — the same failure the
   viewer's own comments describe ("washed the red lamp lenses out to pink") and
   solved with these numbers.

   Matched on MATERIAL NAME because that is the one thing the bake preserves
   exactly: the exporter merges by material and names each mesh `opt_<material>`. */
const TRAILER_DECAL_RE = /faixa-?3m|logo-ankaa/i;
/* Clear covers over a coloured plate: low env, or they veil what is under them. */
const TRAILER_LENS_RE = /lente|vidro-lanterna/i;
/* Everything else in a lamp cluster: coloured plates, LED strips, reflectors.
   These are lit surfaces, not mirrors — 1.35 blows their colour out to white. */
const TRAILER_LAMP_RE = /lanterna|led-|painel-curva|sinaleira|sinaleita/i;
/* Rubber scatters nearly everything it does not absorb; at full env strength the
   seals and mudflaps mirror the sky and read as polished plastic. */
const TRAILER_RUBBER_RE = /^borracha|aparabarro|^pneu/i;
/* Large mill-finish members: rails, posts, frame, hardware. Every one is
   `metalness: 1`, so each is a mirror of the environment until told otherwise. */
const TRAILER_STRUCT_METAL_RE = /galvanizado|estrutura-principal|^inox|metal-pouco-polido|metal-claro|^aro-rodas/i;

function applyTrailerFinish(root: THREE.Object3D) {
  const seen = new Set<string>();
  const log: string[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      const name = m.name || '';
      if (TRAILER_DECAL_RE.test(name)) {
        /* The geometry is right — the bake now quantises positions on one
           scene-wide grid, so a decal 0.2 mm proud stays proud. This is the belt
           to that braces: a depth bias costs nothing and covers the case where
           the grid and the gap are the same size. */
        m.polygonOffset = true;
        m.polygonOffsetFactor = -4;
        m.polygonOffsetUnits = -4;
        log.push(`${name}: decal −4/−4`);
      }
      if (TRAILER_LENS_RE.test(name)) {
        m.envMapIntensity = 0.5;
        log.push(`${name}: env 0.5`);
      } else if (TRAILER_LAMP_RE.test(name)) {
        /* A LAMP LENS IS A DIELECTRIC, and the rip says otherwise.
           `painel-curva-led-vermelho` — the red plate of the rear cluster —
           arrives with metalness 0.718 and roughness 0.098, straight out of the
           library's captured scalars. On a METAL the base colour tints the
           REFLECTION instead of being albedo, so under the rip viewer's dim grey
           room that plate reads as deep red, and under this studio's sunlit HDRI
           the very same numbers mirror the sky and the whole cluster goes milky
           pink. That is the one the rear lamps were failing on, and no amount of
           env trimming reaches it: measured at env 0.5, 0.85 and 0.4 the lens was
           still white — because it was reflecting the SUN, not the environment.

           The viewer's own rule already says what to do here ("authored metalness
           wins over the captured scalar — paint is a dielectric"); it simply never
           had to author this one, because its room hid the fault. So: metalness 0,
           and a floor under roughness, since 0.098 on a dielectric is still a
           mirror at grazing angles — met 0 alone, with the roughness left at
           0.098, renders as washed as before. Moulded polycarbonate is not a
           mirror. Verified by render against the viewer's own lamp. */
        m.metalness = 0;
        m.roughness = Math.max(m.roughness ?? 0, 0.32);
        m.envMapIntensity = 0.85;
        log.push(`${name}: dielétrico, rug ≥0.32, env 0.85`);
      } else if (TRAILER_STRUCT_METAL_RE.test(name)) {
        /* THE HORIZON IN THE RAIL — Kennedy's own diagnosis, and it is right.
           These are `metalness: 1` surfaces: what you see on them is not their
           colour, it is the ENVIRONMENT. The studio's environment is a
           photographic HDRI standing in for the rest of the map, and a
           panorama's dominant feature is a hard horizon line. Run that across a
           15 m rail and you get a bright/dark split that slides along the rail as
           the camera moves — which reads exactly like a rendering bug, and is
           what kept coming back on the flank frame no matter what geometry was
           corrected.

           The honest fix is not to mirror less environment but to stop being a
           mirror: mill-finish galvanised steel and structural aluminium are
           SATIN. The rip's captured scalars say otherwise for the same reason
           they said the lamp lens was a metal — the capture is unreliable about
           this exact property.

           So the roughness gets a floor, which spreads the horizon into a
           gradient no edge can be read off. Where a roughnessMap drives the
           response the scalar is only a multiplier and the floor cannot bite, so
           those get their environment turned down instead — same effect on the
           reflected horizon, and it is the only lever left.

           This does NOT put the nearby scenery into the reflection; nothing here
           can, short of a reflection probe. It stops the sky's horizon from
           drawing a line on the truck, which is the visible half of the problem.

           HOW MATTE: these flank members are not stainless, so they should barely
           reflect at all. They stay `metalness: 1` — they ARE metal, and a
           dielectric would read as painted plastic — but they get a high
           roughness floor and very little environment, which is what a matte mill
           finish actually looks like. */
        const mapDriven = !!m.roughnessMap;
        if (!mapDriven) m.roughness = Math.max(m.roughness ?? 0, 0.62);
        /* ROUGHNESS is the lever, not the environment — and cutting the
           environment to 0.18/0.28 (which is what this used to do) was wrong.
           These are `metalness: 1`, so their diffuse term is ZERO: every photon
           they show comes from the sun or from the environment. The flank rail
           lives in the body's own shadow all day, so starving its environment
           left it with nothing. Measured on the rail band (y 1.42–1.50, above the
           3M tape and below the skin), against a white panel reading ~218:

             env 0.18/0.28 → 78.6 at 07h, 88.5 at 13h, 179.0 at 18h
             env 1.0       → 152.1        155.4        204.2

           A galvanised rail beside white paint is not 2.5× darker than it, and it
           does not triple in brightness when the sun swings — that swing is what
           Kennedy reported. The high roughness floor above is what keeps it satin
           instead of a mirror, and it does that job without starving it.

           The reason the cut existed at all — the HDRI's horizon drawing a hard
           line along the rail — went away with scene/probe.ts: a local capture has
           no horizon to draw. */
        m.envMapIntensity = 1.0;
        log.push(`${name}: rug ≥0.62, env 1.0`);
      } else if (TRAILER_RUBBER_RE.test(name)) {
        m.envMapIntensity = 0.3;
        log.push(`${name}: env 0.3`);
      }
      m.needsUpdate = true;
    }
  });
  console.info('[implemento] acabamento restaurado —', log.length ? log.join(' · ') : 'nada casou (VERIFICAR: os nomes de material mudaram?)');
}

/* ---------------- local reflection ----------------
   Binds the probe's cubemap as `envMap` on the implement's materials, so what the
   metal mirrors is the scene it is standing in and not the scenario's HDRI. An
   explicit `envMap` takes precedence over `scene.environment` in three, so this is
   a per-material override and everything else in the scene is untouched.

   Applied to the WHOLE implement rather than only the obvious metals: a dielectric
   barely changes (its environment term is a weak Fresnel rim), and picking a
   subset would leave two neighbouring parts reflecting two different worlds, which
   is a worse artefact than the one being fixed.

   The intensities that applyTrailerFinish() sets are deliberately NOT changed
   here. They were chosen to stop the HDRI's horizon drawing a line on the flank;
   a local capture has no such horizon, so if the metals now read too dark that is
   a tuning question to settle against a render, not something to guess at.

   ------------------------------------------------------------------------
   THE PROBE DOES NOT SEE THE CLOCK, AND THAT IS WHY THE IMPLEMENT GLOWED AT
   NIGHT. Two compounding faults, both consequences of the sentence three lines
   above this one — "an explicit envMap takes precedence over scene.environment":

     1. It takes precedence over `scene.environmentIntensity` too. That uniform
        is the ONLY thing carrying the day-for-night grade to reflections
        (applyRig() drives it to lerp(1, 0.40, nightness) under an HDRI), and a
        material with its own envMap is not multiplied by it — only by its own
        envMapIntensity, which applyTrailerFinish() authored as a constant 1.0
        to 1.35. So every surface on the implement kept full daylight
        reflectivity at midnight.
     2. It ran once per choice and never again, so the CONTENT was a capture of
        the scenario at whatever hour the model happened to load at — a lit
        warehouse and a bright sky, mirrored by a truck parked in the dark.

     And it applies to `state.trailer` only, which is why this reads as the
     implement being lit differently from the cab rather than as the whole rig
     being bright: the cab has no explicit envMap and has been following the
     clock correctly the whole time. That asymmetry is exactly what Kennedy saw.

   Both are fixed by ONE continuous scalar — see applyProbeEnvGain() below for
   why it is a ratio of `scene.environmentIntensity` and not a re-capture. */
/** Authored envMapIntensity per implement material — the value the tracking gain
 *  multiplies. Read back through the map so a re-capture never compounds. */
let probeBase = new Map<THREE.MeshStandardMaterial, number>();
/** `scene.environmentIntensity` at the instant the live cubemap was captured. */
let probeEnvIntensity = 1;

/* THE IMPLEMENT MUST NOT LAG THE WORLD. The first version of this fix
   re-captured the probe a quarter-second after the slider settled, which is
   worse than the bug it replaced: every other surface in the scene tracked the
   clock per frame while the implement waited and then SNAPPED — Kennedy read it
   immediately as "o trailer demora mais que o resto do mundo". A discrete event
   cannot be made smooth by tuning its delay.

   So there is no clock-driven re-capture at all. Instead the gain is the RATIO
   of `scene.environmentIntensity` now to its value when the cube was shot.
   `scene.environmentIntensity` is the single number applyRig() drives for every
   other material's environment term, so multiplying by that ratio makes the
   implement's response curve IDENTICAL to the cab's and to the set's — not
   approximately, exactly, and on the same frame. Free: it is a uniform.

   What it costs is content: at 21:00 the cube is still a picture taken at
   whatever hour the model loaded at, dimmed. That is day-for-night, which is the
   doctrine this engine already applies to a projected dome (see the plate note
   in environment.ts) and it holds here for the same reason plus one more — the
   probe is a 256² PMREM, so by the time any surface rough enough to matter
   samples it, what survives is level and broad colour, not content. Uniform
   scaling also keeps the bright parts bright relative to the dark ones, which is
   what makes a graded day plate read as moonlight instead of as a flat wash.

   The probe is still re-captured on the events that genuinely invalidate it — a
   new scenario, a new cab, the implement moving — because those already redraw
   the whole frame and no pop is visible inside them. */
function applyProbeEnvGain() {
  if (!probeBase.size) return;
  const f = scene.environmentIntensity / (probeEnvIntensity || 1);
  for (const [m, base] of probeBase) m.envMapIntensity = base * f;
}

/* applyRig() writes scene.environmentIntensity and only THEN runs the rig hooks,
   so this reads the value for the frame being applied, not the previous one. */
onRig(applyProbeEnvGain);

export function refreshVehicleReflection() {
  const trailer = state.trailer;
  if (!trailer) return;
  const rig = new THREE.Box3();
  rig.expandByObject(state.trailerGroup);
  if (state.cab) rig.expandByObject(state.cabGroup);
  if (rig.isEmpty()) return;
  const at = rig.getCenter(new THREE.Vector3());

  const tex = captureReflectionProbe({
    at,
    /* The vehicle cannot be in its own reflection. Both groups, so the trailer
       does not mirror the cab's back panel at point-blank range either. */
    hide: [state.cabGroup, state.trailerGroup],
  });
  if (!tex) return;

  let n = 0;
  const seen = new Set<string>();
  /* Rebuilt rather than mutated: a cab or implement swap disposes materials, and
     a Map keyed on them would hold every generation alive. Bases are carried
     over from the outgoing map when the material survives — reading
     envMapIntensity off the material here would read the PREVIOUS night gain and
     bake it in, compounding a little more with every re-capture. */
  const next = new Map<THREE.MeshStandardMaterial, number>();
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      m.envMap = tex;
      m.needsUpdate = true;
      next.set(m, probeBase.get(m) ?? m.envMapIntensity);
      n++;
    }
  });
  probeBase = next;
  /* The capture happened under the CURRENT rig, so its radiance already carries
     the environment level for this hour: the gain is 1 until the clock moves. */
  probeEnvIntensity = scene.environmentIntensity || 1;
  applyProbeEnvGain();
  console.info('[probe] reflexo local aplicado a', n, 'materiais do implemento · captura em',
    at.toArray().map((v) => +v.toFixed(2)).join(', '),
    '· envIntensity', probeEnvIntensity.toFixed(3));
}

/* ---------------- livery panels, built at load ----------------
   `livery.attachOverlays()` looks for meshes named SIDE_L / SIDE_R / REAR and
   hangs a canvas-textured overlay on each, sampling through TEXCOORD_1. Those
   three meshes are a contract of the MERGE-BY-MATERIAL bake — the exporter cuts
   them out of the white body and writes the livery UV itself.

   An UNFLATTENED bake has no such meshes: it keeps the rip's own hierarchy, which
   is precisely why it renders correctly (mirrored nodes keep the transforms three
   compensates for). So on that asset the editor painted nothing at all — there
   was nothing named for the overlay to attach to.

   Rather than force one bake or the other, the panels are cut here, at load, by
   the SAME rule the exporter uses: depth from the body's extreme face, not height
   and not the face normal. The flank is corrugated, so a band has to clear the
   whole rib (crest at 1.2986, next sheet inboard at 1.2409 — 40 mm takes the rib
   and stops short of the inner wall); the rear keeps a normal test because the
   door frame's returns face sideways and are not painted.

   THE TRIANGLES ARE MOVED, NOT COPIED. The first version of this added the panels
   on top of the skin they were cut from and held them in front with polygonOffset,
   the way buildFrontWallOverlay() does. That is wrong here, and exportTrailer.js
   says so in its own contract: the panels "must NOT also remain in the joined body
   mesh — the studio swaps their material to car paint, and a duplicate underneath
   would show through". It does: painted red, the flank's bottom band came out a
   muddy brown that snapped back to red when the camera moved a few degrees, which
   is two coplanar surfaces trading the depth test. A depth bias cannot fix a
   duplicate, it can only decide which of the two wins this frame.
   So each source mesh has its own index rebuilt without the triangles that left.
   Only the geometries that actually lost triangles are touched, and a geometry
   shared by several meshes is cloned first so the others keep theirs. */
const LIVERY_SKIN_SIDE = 0.04;
const LIVERY_SKIN_REAR = 0.10;

/** The exporter's layout, vertex for vertex — see exportTrailer.js addLiveryUV.
 *  v runs DOWNWARDS because the CanvasTexture is built with flipY = false; u runs
 *  the way each panel reads from outside, which is mirrored between the flanks.
 *  Get either backwards and the artwork is a legible mirror image. */
function addLiveryUV(geo: THREE.BufferGeometry, key: 'SIDE_L' | 'SIDE_R' | 'REAR') {
  geo.computeBoundingBox();
  const b = geo.boundingBox as THREE.Box3;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const spanX = Math.max(1e-6, b.max.x - b.min.x);
  const spanY = Math.max(1e-6, b.max.y - b.min.y);
  const spanZ = Math.max(1e-6, b.max.z - b.min.z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    uv[i * 2] = key === 'SIDE_L' ? (z - b.min.z) / spanZ
      : key === 'SIDE_R' ? (b.max.z - z) / spanZ
        : (b.max.x - x) / spanX;
    uv[i * 2 + 1] = (b.max.y - y) / spanY;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
}

function buildLiveryPanels(trailer: THREE.Object3D) {
  let already = false;
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) already = true;
  });
  if (already) return;                         // merged bake: the exporter did it

  const sources: THREE.Mesh[] = [];
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !!m && WHITE_BODY_RE.test(m.name || ''))) sources.push(o);
  });
  if (!sources.length) {
    console.warn('[livery] nenhuma malha do corpo branco — o editor de arte não terá onde pintar.');
    return;
  }

  trailer.updateWorldMatrix(true, true);
  const toLocal = trailer.matrixWorld.clone().invert();
  const prepared = sources.map((m) => {
    const mat = toLocal.clone().multiply(m.matrixWorld);
    return { mesh: m, mat, nrm: new THREE.Matrix3().getNormalMatrix(mat) };
  });

  /* Pass 1 — the body's own extents, read from the POSITION ATTRIBUTE. A bounding
     box here would be the rotated-box-of-a-box again, and these thresholds are
     40 mm wide. */
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  for (const p of prepared) {
    const pos = p.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(p.mat));
  }

  const keep: Record<'SIDE_L' | 'SIDE_R' | 'REAR', { p: number[]; n: number[]; u: number[] }> = {
    SIDE_L: { p: [], n: [], u: [] }, SIDE_R: { p: [], n: [], u: [] }, REAR: { p: [], n: [], u: [] },
  };
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();

  /* One entry per source mesh that lost triangles: the ordinals to drop. */
  const removals = new Map<THREE.Mesh, Set<number>>();
  /* How many meshes reference each geometry — a shared one must be cloned before
     its index is rewritten, or a sibling loses triangles it still needs. */
  const geomUsers = new Map<THREE.BufferGeometry, number>();
  for (const p of prepared) {
    geomUsers.set(p.mesh.geometry, (geomUsers.get(p.mesh.geometry) || 0) + 1);
  }

  for (const p of prepared) {
    const g = p.mesh.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!nor) continue;
    /* uv0 comes ALONG, per vertex. The panel wears the body's own material, whose
       roughnessMap and metalnessMap read uv0 — the first version wrote zeros here
       and the whole panel then sampled a single texel while the body around it
       sampled the real maps. That seam is a band of slightly different finish
       along the flank, and it vanished the moment the implement was painted,
       because car paint has no such maps. Kennedy reported exactly that: wrong in
       white, right in colour. */
    const uvs = g.attributes.uv;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(p.mat);
      b2.fromBufferAttribute(pos, i1).applyMatrix4(p.mat);
      c.fromBufferAttribute(pos, i2).applyMatrix4(p.mat);
      let where: 'SIDE_L' | 'SIDE_R' | 'REAR' | null = null;
      if (Math.min(a.x, b2.x, c.x) >= box.max.x - LIVERY_SKIN_SIDE) where = 'SIDE_R';
      else if (Math.max(a.x, b2.x, c.x) <= box.min.x + LIVERY_SKIN_SIDE) where = 'SIDE_L';
      if (!where && Math.max(a.z, b2.z, c.z) <= box.min.z + LIVERY_SKIN_REAR) {
        e1.subVectors(b2, a); e2.subVectors(c, a);
        fn.crossVectors(e1, e2).normalize();
        /* abs(): ~0.2 % of these ripped triangles are wound backwards, so the
           sign of the face normal proves nothing about which way it faces. */
        if (Math.abs(fn.z) >= 0.7) where = 'REAR';
      }
      if (!where) continue;
      na.fromBufferAttribute(nor, i0).applyMatrix3(p.nrm).normalize();
      nb.fromBufferAttribute(nor, i1).applyMatrix3(p.nrm).normalize();
      nc.fromBufferAttribute(nor, i2).applyMatrix3(p.nrm).normalize();
      const k = keep[where];
      k.p.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z);
      k.n.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
      if (uvs) {
        k.u.push(uvs.getX(i0), uvs.getY(i0), uvs.getX(i1), uvs.getY(i1), uvs.getX(i2), uvs.getY(i2));
      } else {
        k.u.push(0, 0, 0, 0, 0, 0);
      }
      let rm = removals.get(p.mesh);
      if (!rm) { rm = new Set(); removals.set(p.mesh, rm); }
      rm.add(t);
    }
  }

  /* Take the moved triangles OUT of the meshes they came from. Index-only
     surgery: the vertices stay where they are (unreferenced ones cost a little
     memory and nothing else), so nothing else that reads these geometries is
     disturbed. */
  let strippedMeshes = 0, strippedTris = 0;
  for (const [mesh, drop] of removals) {
    const g0 = mesh.geometry;
    const src = g0.index ? g0.index.array : null;
    const total = Math.floor((src ? src.length : g0.attributes.position.count) / 3);
    const keepIdx: number[] = [];
    for (let t = 0; t < total; t++) {
      if (drop.has(t)) continue;
      keepIdx.push(
        src ? src[t * 3] : t * 3,
        src ? src[t * 3 + 1] : t * 3 + 1,
        src ? src[t * 3 + 2] : t * 3 + 2,
      );
    }
    const g = (geomUsers.get(g0) || 1) > 1 ? g0.clone() : g0;
    if (g !== g0) mesh.geometry = g;
    const Arr = g.attributes.position.count > 65535 ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new Arr(keepIdx), 1));
    g.clearGroups();
    strippedMeshes++;
    strippedTris += drop.size;
  }

  const srcMat = (Array.isArray(sources[0].material) ? sources[0].material[0] : sources[0].material) as THREE.MeshStandardMaterial;
  const report: string[] = [];
  for (const key of ['SIDE_L', 'SIDE_R', 'REAR'] as const) {
    const k = keep[key];
    if (!k.p.length) { report.push(`${key}: VAZIO`); continue; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k.p), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(k.n), 3));
    /* The SOURCE uv0, carried through — see the note where it is collected. */
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(k.u), 2));
    addLiveryUV(geo, key);
    /* No polygonOffset, and that is the point: these triangles no longer exist
       anywhere else, so there is nothing to win a depth test against. A bias here
       would only pull the panel over the RAIL that runs along its bottom edge. */
    const mat = srcMat.clone();
    mat.name = srcMat.name;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = key;
    mesh.castShadow = true;                    // it IS the skin now, not an overlay
    mesh.receiveShadow = true;
    trailer.add(mesh);
    report.push(`${key}: ${k.p.length / 9} tris`);
  }
  console.info('[livery] chapas recortadas do corpo —', report.join(' · '),
    `· ${strippedTris} triângulos removidos de ${strippedMeshes} malhas de origem`);
}

/* ---------------- trailer ---------------- */
export async function loadTrailer(onProgress?: (t: number) => void) {
  const trailer = await loadGLB(VEHICLES_DIR + 'trailer.glb', onProgress);
  setRigPlacement(false);       // a conta abaixo é em espaço de mundo; ver rigGroup
  setupCommon(trailer);
  state.trailerGroup.add(trailer);
  /* Measured BEFORE grounding: membership is decided by which tyres share the
     contact plane, and translating the whole trailer cannot change that. */
  const tyres = runningTyres(trailer);
  const tyreSet = tyres ? tyres.meshes : new Set<THREE.Mesh>();
  const box = groundAndCenter(trailer, bodyPanelPred(trailer),
    (o: THREE.Mesh) => tyreSet.has(o), tyres ? tyres.minY : undefined);
  auditTransparency(trailer, 'trailer');     // glass blends, decals alphaTest
  applyTrailerFinish(trailer);               // AFTER setupCommon: it overrides env 1.35
  /* After grounding, before studio.ts calls livery.attachOverlays(). */
  buildLiveryPanels(trailer);
  state.trailer = trailer;
  state.trailerBase = { pos: trailer.position.clone(), frontZ: box.max.z };
  state.trailerBox = box;
  /* Where the tyres meet the ground, measured back from the front wall. The
     coupling pitch (see placeTrailer) turns about this, so it has to be taken
     from the base pose — before any placement moves the trailer along Z.
     The BOGIE, not every tyre: see runningTyres(). */
  if (tyres) {
    state.trailerPivotFromFront = box.max.z - (tyres.zMin + tyres.zMax) / 2;
    state.trailerTyreHalfSpan = (tyres.zMax - tyres.zMin) / 2;
  }
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
  let meta: { dims?: unknown; widthFrac?: unknown; topGap?: unknown } | null = null;
  try { meta = await fetchJSON(VEHICLES_DIR + 'thermoking_meta.json'); } catch { /* optional */ }
  let tk: THREE.Group;
  try {
    tk = await loadGLB(VEHICLES_DIR + 'thermoking.glb');
  } catch (e: unknown) {
    console.warn('[tk] thermoking.glb indisponível —', errText(e));
    return;
  }
  setRigPlacement(false);       // idem: medidas de mundo daqui para baixo
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
  /* Measured BEFORE the unit joins the trailer — `state.tk` is set below, and
     once it is a child, a whole-object fallback would include the unit in its
     own mount plane. bodyPanelPred() removes that fallback, but the ordering is
     still the honest one. */
  const trailerRoot = state.trailer as THREE.Object3D;
  const sideBox = bboxOfMatching(trailerRoot, bodyPanelPred(trailerRoot));
  const wallZ = sideBox.max.z;
  const roofY = sideBox.max.y;
  const cx = (sideBox.min.x + sideBox.max.x) / 2;

  /* SIZE AND DROP, both from thermoking_meta.json so they can be trimmed
     without a code change.
       widthFrac — the housing's width as a fraction of the body width. The unit
         is meant to fill the white front panel out to where the corner rails
         start; the rip's own scale left it floating in the middle of it.
       topGap   — metres between the roof line and the top of the housing. It
         used to be a flat 0.02, which pinned the unit under the roof cap; the
         real thing sits lower, with its base on the front panel's bottom edge.
     Scaled in X and Y together — this is a photograph of a real product, so it
     may not be stretched — and Z is left alone because TK_DEPTH above already
     set the mount depth. */
  const readNum = (v: unknown, d: number, lo: number, hi: number) =>
    Number.isFinite(+(v as number)) ? Math.min(hi, Math.max(lo, +(v as number))) : d;
  const widthFrac = readNum(meta?.widthFrac, 0.86, 0.4, 1);
  const topGap = readNum(meta?.topGap, 0.1, 0, 1);
  {
    const cur = new THREE.Box3().setFromObject(tk);
    const curW = cur.max.x - cur.min.x;
    const wantW = (sideBox.max.x - sideBox.min.x) * widthFrac;
    if (curW > 1e-6) {
      const s = wantW / curW;
      tk.scale.x *= s;
      tk.scale.y *= s;
      tk.updateWorldMatrix(true, true);
    }
  }

  const b = new THREE.Box3().setFromObject(tk);      // measured, not assumed
  const target = new THREE.Vector3(
    cx - (b.min.x + b.max.x) / 2,                    // centered on the wall
    (roofY - topGap) - b.max.y,                      // top sits topGap below the roof line
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
  /* Esta função é o fim de TODO caminho que mexe no conjunto — carga de cabine,
     de implemento, do Thermo King e os controles de engate — e por isso é aqui
     que o lugar dele no cenário volta a valer (ver rigGroup). Inclusive na saída
     antecipada: sair daqui com o conjunto na origem deixaria o caminhão no lugar
     errado até a próxima carga. Ela mesma só usa coordenadas locais, então roda
     igual com o pai deslocado ou não. */
  if (!t || !state.trailerBase) { setRigPlacement(true); return; }
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
  t.rotation.x = 0;                       // re-derived below; never accumulate
  t.position.copy(state.trailerBase.pos);
  t.position.z += (frontZ + state.coupling.z) - state.trailerBase.frontZ;
  // Grounding wins: never sink the trailer through the floor. The base pose has
  // tire min-y = 0, so the total vertical offset IS the tire clearance. Only
  // lift for the kingpin match (nose-high is fine, sunk wheels are not), and
  // clamp the Engate height slider so tires stay above -0.01 m.
  let dy = Math.max(0, lift) + state.coupling.y;
  if (dy < -0.01) dy = -0.01;
  t.position.y += dy;

  /* A NEGATIVE lift is a PITCH, not a drop.
     -----------------------------------------------------------------------
     `Math.max(0, lift)` above throws away the case where the trailer's kingpin
     plate sits ABOVE this cab's fifth wheel — on the corrected implement that is
     91 mm — and the result is a visible slab of daylight between the plate and
     the coupler that no value in trailer_meta.json can close, because the clamp
     discards it before it is used.

     Dropping the trailer bodily would bury its tyres, which is what the clamp
     exists to prevent. But that is not what a real rig does: the trailer is held
     at the kingpin and rests on its own tyres, so if the plate is high the
     trailer simply sits NOSE-DOWN, pivoting on the tyre contact patch. Over a
     ~10 m kingpin-to-axle arm, 91 mm is about half a degree — invisible as an
     attitude, and it puts the plate exactly on the coupler.

     The pivot point stays fixed by construction: rotate about it, then translate
     by however far it moved. */
  const halfSpan = state.trailerTyreHalfSpan ?? 0;
  const arm = (state.trailerPivotFromFront ?? 0) - (kp?.zFromFront ?? 0);
  /* Solved so BOTH ends land: the pitch is taken about the bogie CENTRE, which
     tips the downhill axle `halfSpan·sinθ` under the floor, so the trailer is
     raised by exactly that much afterwards. The raise also lifts the plate, so
     the angle has to account for it — the net drop at the plate is
     (arm − halfSpan)·sinθ. Solving that for the required drop gives the one
     angle where the plate sits on the coupler AND the lowest tyre sits on the
     ground, with no iteration. */
  const armEff = arm - halfSpan;
  if (lift < -0.001 && armEff > 0.5) {
    const theta = Math.asin(THREE.MathUtils.clamp(-lift / armEff, 0, 0.25));
    const pivotZ = (frontZ + state.coupling.z) - (state.trailerPivotFromFront as number);
    const p0 = t.position.clone();
    const pivot = new THREE.Vector3(p0.x, 0, pivotZ);      // y = 0: the contact patch
    const local = pivot.clone().sub(p0);
    t.rotation.x = theta;
    const moved = local.applyMatrix4(new THREE.Matrix4().makeRotationX(theta)).add(p0);
    t.position.add(pivot.sub(moved));
    t.position.y += halfSpan * Math.sin(theta);            // put the bogie back on the ground
  }
  t.updateWorldMatrix(true, true);
  /* Engate resolvido: o conjunto volta para o lugar dele no cenário. */
  setRigPlacement(true);
}
