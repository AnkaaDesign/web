/* Quanto a pose do conjunto move o Thermo King.
   ---------------------------------------------------------------------------
   Reproduz as DUAS formas de medir — a antiga, em mundo com `Box3` de nó girado,
   e a nova, por vértice no referencial do implemento — e roda as duas sob as
   poses que o engate realmente aplica: giro de 180° e inclinação `pitchX`, que o
   solver deriva da altura da quinta roda, ou seja DO CHASSI DO CAVALO.

   Se a tese estiver certa, o resultado ANTIGO anda com a inclinação e o NOVO
   não anda nada. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('/vendor/draco/');
loader.setDRACOLoader(draco);
const load = (u: string) => new Promise<THREE.Group>((ok, no) =>
  loader.load(u, (g) => ok(g.scene), undefined, no));
const V = '/studio-assets/v1/models/vehicles/';

const WHITE_BODY_RE = /cor_padrao_branco/i;
const FRONT_RAIL_MAT_RE = /ferragem|estrutura/i;
const FRONT_RAIL_BAND = 0.15;

const isBody = (o: THREE.Mesh) => {
  if (!o.visible) return false;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((m) => !!m && WHITE_BODY_RE.test((m as THREE.Material).name || ''));
};

/* ---- a forma ANTIGA: Box3 de nó, em mundo ---- */
function boxWorldAABB(root: THREE.Object3D, test?: (o: THREE.Mesh) => boolean) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    if (test && !test(o)) return;
    box.expandByObject(o);
  });
  return box;
}

/* ---- a forma NOVA: por vértice, no referencial de `frame` ---- */
function bboxInFrame(frame: THREE.Object3D, subject: THREE.Object3D,
  test?: (o: THREE.Mesh) => boolean) {
  frame.updateWorldMatrix(true, true);
  subject.updateWorldMatrix(true, true);
  const inv = frame.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  subject.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (test && !test(o)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
    }
  });
  return box;
}

/** A travessa da testeira, num eixo ou no outro. */
function rail(trailer: THREE.Object3D, z1: number, local: boolean): number | null {
  trailer.updateWorldMatrix(true, true);
  const inv = trailer.matrixWorld.clone().invert();
  const zMin = z1 - FRONT_RAIL_BAND;
  const loc = new THREE.Vector3();
  const wld = new THREE.Vector3();
  let bestTop = -Infinity, bestUnder: number | null = null;
  trailer.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && FRONT_RAIL_MAT_RE.test((m as THREE.Material).name || ''))) return;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    let n2 = 0, lo = Infinity, hi = -Infinity, xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      wld.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      loc.copy(wld).applyMatrix4(inv);
      if (loc.z < zMin) continue;
      n2++;
      const y = local ? loc.y : wld.y;
      if (y < lo) lo = y; if (y > hi) hi = y;
      if (loc.x < xLo) xLo = loc.x; if (loc.x > xHi) xHi = loc.x;
    }
    if (!n2 || xLo > -0.5 || xHi < 0.5) return;
    if (hi > bestTop) { bestTop = hi; bestUnder = lo; }
  });
  return bestUnder;
}

(async () => {
  const trailer = await load(V + 'trailer.glb');
  const tk = await load(V + 'thermoking.glb');
  const scene = new THREE.Scene();
  scene.add(trailer);
  trailer.add(tk);

  /* a testeira, no referencial do baú: o datum imóvel do mapZ() */
  const bodyLocal0 = bboxInFrame(trailer, trailer, isBody);
  const z1 = bodyLocal0.max.z;

  const rows: string[] = [];
  const TOP_GAP = 0.23;

  /* Poses que o engate aplica: yaw 180° sempre, e a inclinação que varia com a
     altura da quinta roda do cavalo. O leque cobre o que os chassis do catálogo
     produzem (o próprio módulo cita 0,661° num caso). */
  for (const deg of [0, 0.3, 0.661, 1.0, 1.4]) {
    trailer.rotation.set(deg * Math.PI / 180, 0, 0);
    trailer.position.set(0, 1.2, 22);
    trailer.updateMatrix();
    trailer.updateWorldMatrix(true, true);

    // ANTIGO: mede em mundo, converte o deslocamento pela parte linear
    const sideW = boxWorldAABB(trailer, isBody);
    const bW = new THREE.Box3().setFromObject(tk);
    const railW = rail(trailer, z1, false);
    const wantTopW = railW ?? (sideW.max.y - TOP_GAP);
    const topW = Math.max(wantTopW, sideW.min.y + (bW.max.y - bW.min.y));
    const moveW = new THREE.Vector3(
      (sideW.min.x + sideW.max.x) / 2 - (bW.min.x + bW.max.x) / 2,
      topW - bW.max.y,
      sideW.max.z - bW.min.z,
    );
    const o0 = trailer.worldToLocal(new THREE.Vector3());
    const o1 = trailer.worldToLocal(moveW.clone());
    const oldLocal = o1.sub(o0);

    // NOVO: tudo no referencial do implemento
    const sideL = bboxInFrame(trailer, trailer, isBody);
    const bL = bboxInFrame(trailer, tk);
    const railL = rail(trailer, z1, true);
    const wantTopL = railL ?? (sideL.max.y - TOP_GAP);
    const topL = Math.max(wantTopL, sideL.min.y + (bL.max.y - bL.min.y));
    const newLocal = new THREE.Vector3(
      (sideL.min.x + sideL.max.x) / 2 - (bL.min.x + bL.max.x) / 2,
      topL - bL.max.y,
      sideL.max.z - bL.min.z,
    );

    const f = (v: THREE.Vector3) => `[${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}]`;
    rows.push(`inclinação ${deg.toFixed(3)}°  ANTIGO ${f(oldLocal)}   NOVO ${f(newLocal)}`
      + `   · travessa mundo ${railW?.toFixed(4)} local ${railL?.toFixed(4)}`);
  }

  (window as unknown as Record<string, unknown>).__tk = rows;
  (window as unknown as Record<string, unknown>).__ready = true;
})().catch((e) => {
  (window as unknown as Record<string, unknown>).__error = String(e?.stack || e);
  (window as unknown as Record<string, unknown>).__ready = true;
});
