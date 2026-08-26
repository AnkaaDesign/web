/* EXPORTA O KIT DA PORTA do `trailer.glb` como asset próprio.
   ===========================================================================
   POR QUE ELE PRECISA VIRAR ASSET, e não continuar sendo extraído de cada bake.

   `extractDoorKit()` monta a porta lateral com as peças da porta TRASEIRA do
   próprio implemento, casadas por TAMANHO contra `DOOR_PARTS`. Isso é o certo
   quando o implemento tem as peças — e o semirreboque tem: o kit dele sai com
   **24 famílias**.

   O sobrechassi sai com **18**. Faltam `VARAO`, `ENCAIXE` (e o par de topo),
   `SUPORTE_GUIA`, `SUPORTE_TALA` e as duas `BORRACHA_H`. A causa é de produto,
   não de código: **a traseira dele tem 2 varões, e a do semirreboque tem 4** —
   metade da ferragem simplesmente não existe naquele bake, e o resto está em
   medidas que não casam. Afrouxar tolerância não resolve: não há o que casar.

   A decisão do dono é a certa e é a mais simples: **a porta é UMA SÓ**, a do
   modelo antigo, e todo implemento usa aquela. Então ela sai daqui uma vez,
   vira `models/vehicles/porta_kit_v1.glb`, e o engine a carrega como já carrega
   a roda do FH16 e o Thermo King — asset opcional, com degradação em silêncio
   para o kit local se o arquivo faltar.

   O QUE SAI: uma malha por família, na geometria LOCAL que `extractDoorKit()`
   entrega (já recentrada e já espelhada peça a peça — ver a nota do espelho em
   `rebuildParts`), com o material de origem. O nome é `KIT_<FAMÍLIA>`, e é por
   ele que o engine remonta o `Map` na volta.

   USO
       node tools/trailer-bench/export-kit.mjs
*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { TrailerBody } from '@/pages/tools/truck-studio/engine/vehicle/trailer-geometry';
import type { DoorPart } from '@/pages/tools/truck-studio/engine/vehicle/trailer-door';

declare global {
  interface Window { __ready?: boolean; __error?: string; __diag?: unknown; __glb?: string }
}

async function main() {
  const q = new URLSearchParams(location.search);
  const src = q.get('src') || 'semirreboque_frigorifico_paleteiro.glb';

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/models/vehicles/' + src);
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);

  /* O corpo é construído só para que o construtor extraia o kit — nada da
     geometria paramétrica dele é exportado. */
  const body = new TrailerBody(root);
  const kit = (body as unknown as {
    kit: Map<DoorPart, { geo: THREE.BufferGeometry; mat: THREE.Material }>;
  }).kit;

  const out = new THREE.Scene();
  out.name = 'PORTA_KIT';
  const inventario: string[] = [];
  for (const [part, entry] of kit) {
    /* O material é CLONADO e mantém o nome: `applyTrailerFinish()` despacha por
       nome, então o kit precisa chegar ao outro implemento com os mesmos nomes
       que o acabamento conhece. Clonar evita que o exportador reescreva o
       material vivo do implemento de origem. */
    const mat = entry.mat.clone();
    mat.name = entry.mat.name;
    const mesh = new THREE.Mesh(entry.geo.clone(), mat);
    mesh.name = 'KIT_' + part;
    out.add(mesh);
    const g = mesh.geometry;
    g.computeBoundingBox();
    const b = g.boundingBox as THREE.Box3;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    inventario.push(`${part}: ${Math.round(pos.count / 3)}t · `
      + `${((b.max.x - b.min.x) * 1000).toFixed(0)}×${((b.max.y - b.min.y) * 1000).toFixed(0)}`
      + `×${((b.max.z - b.min.z) * 1000).toFixed(0)} mm · [${mat.name}]`);
  }

  /* A CHAPA DA MARCA vai no mesmo asset, e pelo mesmo motivo do kit: ela é do
     bake antigo e o novo não tem nada equivalente — o dele traz a marca do
     FABRICANTE do baú, que sai em `removeMakerBranding()`.
     A busca é por FORMA, como tudo aqui: inox, fina, larga, na linha de centro
     e na traseira. Medida no `trailer.glb`: 810 × 230 × 54 mm, 1 726 triângulos
     (as letras são recorte — uma chapa lisa daquele tamanho são 12). */
  {
    const inv = root.matrixWorld.clone().invert();
    const mm = new THREE.Matrix4();
    const bb = new THREE.Box3();
    let rearZ = Infinity;
    const cands: { mesh: THREE.Mesh; b: THREE.Box3; tris: number }[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const gb = mesh.geometry.boundingBox;
      if (!gb) return;
      bb.copy(gb).applyMatrix4(mm.multiplyMatrices(inv, mesh.matrixWorld));
      if (bb.min.z < rearZ) rearZ = bb.min.z;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      cands.push({ mesh, b: bb.clone(), tris: Math.round(pos.count / 3) });
    });
    const placa = cands.find((c) => {
      const mats = Array.isArray(c.mesh.material) ? c.mesh.material : [c.mesh.material];
      if (!mats.some((m) => /^inox-ferragem/i.test(m?.name || ''))) return false;
      if (c.tris < 1000) return false;
      const d = [c.b.max.x - c.b.min.x, c.b.max.y - c.b.min.y, c.b.max.z - c.b.min.z]
        .sort((a, b2) => a - b2);
      if (d[0] > 0.06 || d[2] < 0.35 || d[2] > 1.20) return false;
      if (Math.abs((c.b.min.x + c.b.max.x) / 2) > 0.16) return false;
      return c.b.min.z <= rearZ + 0.30;
    });
    if (placa) {
      /* RECENTRADA na origem, como as peças do kit: quem a posiciona é o
         engine, e uma geometria que carregasse o z −7,4 do bake de origem
         nasceria a sete metros de onde deve. */
      const geo = placa.mesh.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, placa.mesh.matrixWorld));
      geo.computeBoundingBox();
      const c = (geo.boundingBox as THREE.Box3).getCenter(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      const mat = (Array.isArray(placa.mesh.material) ? placa.mesh.material[0] : placa.mesh.material).clone();
      mat.name = 'inox-ferragem';
      const m = new THREE.Mesh(geo, mat);
      m.name = 'KIT_PLACA_MARCA';
      out.add(m);
      const d = (geo.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
      inventario.push(`PLACA_MARCA: ${placa.tris}t · `
        + `${(d.x * 1000).toFixed(0)}×${(d.y * 1000).toFixed(0)}×${(d.z * 1000).toFixed(0)} mm`
        + ` · [${mat.name}]`);
    } else {
      inventario.push('PLACA_MARCA: NÃO ENCONTRADA no bake de origem');
    }
  }

  window.__diag = { origem: src, familias: kit.size, inventario: inventario.sort() };

  const exporter = new GLTFExporter();
  const bin = await new Promise<ArrayBuffer>((res, rej) => {
    exporter.parse(out, (r) => res(r as ArrayBuffer), (e) => rej(e), { binary: true });
  });
  /* dataURL porque é assim que o driver da bancada recebe binário — ver o
     tratamento de `data:` em `tools/studio-bench/bench.mjs`. */
  const bytes = new Uint8Array(bin);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  window.__glb = 'data:model/gltf-binary;base64,' + btoa(s);
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e as Error)?.stack || String(e);
  window.__ready = true;
});
