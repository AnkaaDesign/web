/* Inventário do implemento — o que existe no `trailer.glb` depois do rig.
   ---------------------------------------------------------------------------
   Não desenha nada. Sobe o GLB, monta o `TrailerRig` (que é o que o estúdio
   monta) e despeja, por MATERIAL e por MALHA GRANDE, o que há: contagem,
   triângulos e caixa MEDIDA POR VÉRTICE no referencial do implemento.

   Existe porque a simplificação pedida — "sem frisos, sem chapas, só o shape" —
   é uma decisão de QUAIS peças entram no desenho. Tomar essa decisão por
   adivinhação de nome é como a versão antiga de `trailer-geometry.ts`
   classificava chapa por "extensão em Z", e ela errava. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TrailerRig } from '@/pages/tools/truck-studio/engine/vehicle/trailer-rig';

declare global {
  interface Window { __ready?: boolean; __error?: string; __inv?: unknown }
}

const triCount = (m: THREE.Mesh) => {
  const g = m.geometry;
  const p = g.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!p) return 0;
  return (g.index ? g.index.count : p.count) / 3;
};

/** Caixa lida do ATRIBUTO e transformada para o referencial de `root`. */
function boxIn(mesh: THREE.Mesh, root: THREE.Object3D) {
  const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!p || !p.count) return null;
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  return b;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const dump = (b: THREE.Box3 | null) => b && !b.isEmpty()
  ? { x: [r3(b.min.x), r3(b.max.x)], y: [r3(b.min.y), r3(b.max.y)], z: [r3(b.min.z), r3(b.max.z)] }
  : null;

async function main() {
  const draco = new DRACOLoader().setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');

  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const rig = new TrailerRig(root);
  root.updateMatrixWorld(true);

  const byMat = new Map<string, { meshes: number; tris: number; box: THREE.Box3; names: Set<string> }>();
  const big: Array<{ name: string; mat: string; tris: number; box: unknown }> = [];
  let meshes = 0;

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const matName = mats.map((x) => (x as THREE.Material)?.name || '(anon)').join('+');
    const t = triCount(m);
    const b = boxIn(m, root);
    let e = byMat.get(matName);
    if (!e) { e = { meshes: 0, tris: 0, box: new THREE.Box3(), names: new Set() }; byMat.set(matName, e); }
    e.meshes++; e.tris += t;
    if (b) e.box.union(b);
    if (e.names.size < 8) e.names.add(m.name || '(sem nome)');
    if (t >= 300) big.push({ name: m.name || '(sem nome)', mat: matName, tris: t, box: dump(b) });
  });

  big.sort((a, b) => b.tris - a.tris);

  window.__inv = {
    meshes,
    dims: rig.dims,
    materiais: [...byMat.entries()]
      .sort((a, b) => b[1].tris - a[1].tris)
      .map(([name, e]) => ({
        material: name, malhas: e.meshes, tris: e.tris,
        box: dump(e.box), exemplos: [...e.names],
      })),
    grandes: big.slice(0, 60),
  };
  window.__ready = true;
}

main().catch((e) => { window.__error = String(e?.stack || e); window.__ready = true; });
