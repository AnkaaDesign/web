/* Sonda de INVENTÁRIO por face — o que mora no slab de cada painel, por
   material, em faixas de altura e de comprimento.
   ---------------------------------------------------------------------------
   POR QUE ELA EXISTE

   `parts.ts` é uma tabela MEDIDA, e as peças que faltam nela (montantes de
   canto das laterais, ferragem das portas traseiras, varões) precisam de
   números do PRÓPRIO `trailer.glb` — o inventário de
   `PORTA-TRASEIRA-DIREITA.md` foi lido do `.gltf` com hierarquia, que tem
   OUTRO referencial, e copiar de lá repetiria o erro que aquele documento
   registra ("conclusões erradas com cara de certas").

   O bake é fundido POR MATERIAL: uma malha pode atravessar o baú inteiro, e a
   caixa dela não diz nada. Por isso a unidade aqui é o TRIÂNGULO: só entram os
   que moram no slab de profundidade da face, e eles são acumulados por
   material em histogramas de 5 mm — de ALTURA (y, para as fileiras de
   ferragem) e de CORRIDA (u, para os varões e os montantes). Faixas contíguas
   viram bandas nomeáveis; é delas que os `y0/y1` de `parts.ts` saem. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __report?: () => unknown;
  }
}

const r4 = (n: number) => +n.toFixed(4);
const WHITE_RE = /Cor_padrao_branco|metalBranco/i;

type FaceKey = 'left' | 'right' | 'rear' | 'front';

interface Frame {
  face: FaceKey;
  y0: number; y1: number;
  u0: number; u1: number;
  face0: number; sgn: number;
}

const matsOf = (m: THREE.Mesh): THREE.Material[] =>
  Array.isArray(m.material) ? m.material : [m.material];

function worldBox(mesh: THREE.Mesh): THREE.Box3 | null {
  const pos = mesh.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos?.count) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < pos.count; i++) {
    b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return b.isEmpty() ? null : b;
}

/* O mesmo enquadramento de `paneprobe.measureFrames()` — a pele branca é o
   referencial. Duplicado aqui de propósito: a sonda tem de poder rodar sozinha
   e morrer sozinha, sem acoplar a bancada de fotografia ao inventário. */
function measureFrames(root: THREE.Object3D): Record<FaceKey, Frame> {
  const boxes: Record<string, THREE.Box3> = {};
  const add = (k: string, b: THREE.Box3) => {
    boxes[k] = boxes[k] ? boxes[k].union(b) : b.clone();
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    if (!matsOf(m).some((x) => !!x && WHITE_RE.test(x.name || ''))) return;
    const b = worldBox(m);
    if (!b) return;
    const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    if (sx < 0.15 && sz > 1) { add(b.max.x < 0 ? 'left' : 'right', b); return; }
    if (sz < 0.30 && sx > 0.5) { add(b.max.z < 0 ? 'rear' : 'front', b); }
  });
  const mk = (face: FaceKey, b: THREE.Box3): Frame => {
    const lateral = face === 'left' || face === 'right';
    const sgn = face === 'right' || face === 'front' ? 1 : -1;
    return {
      face,
      y0: b.min.y, y1: b.max.y,
      u0: lateral ? b.min.z : b.min.x,
      u1: lateral ? b.max.z : b.max.x,
      face0: lateral ? (sgn > 0 ? b.max.x : b.min.x) : (sgn > 0 ? b.max.z : b.min.z),
      sgn,
    };
  };
  const out = {} as Record<FaceKey, Frame>;
  for (const f of ['left', 'right', 'rear', 'front'] as FaceKey[]) {
    const b = boxes[f];
    if (!b) throw new Error(`pele branca da face "${f}" não encontrada`);
    out[f] = mk(f, b);
  }
  return out;
}

const BIN = 0.005;
/** Slab: até onde uma peça "da face" pode estar, para fora e para dentro. */
const OUT = 0.12, IN = 0.10;

interface Acc {
  tris: number;
  yBins: Map<number, number>;
  uBins: Map<number, number>;
  d0: number; d1: number;
}

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);

  const frames = measureFrames(root);

  const acc: Record<FaceKey, Map<string, Acc>> = {
    left: new Map(), right: new Map(), rear: new Map(), front: new Map(),
  };

  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
    const matName = matsOf(mesh).map((m) => m?.name || '?').join('+');
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    mesh.updateWorldMatrix(true, false);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      for (const face of ['left', 'right', 'rear', 'front'] as FaceKey[]) {
        const f = frames[face];
        const lateral = face === 'left' || face === 'right';
        const dOf = (v: THREE.Vector3) => (lateral ? v.x : v.z);
        const uOf = (v: THREE.Vector3) => (lateral ? v.z : v.x);
        /* Assinada PARA FORA: positivo = além da pele. */
        const ds = [dOf(va), dOf(vb), dOf(vc)].map((d) => (d - f.face0) * f.sgn);
        if (Math.min(...ds) < -IN || Math.max(...ds) > OUT) continue;
        const ys = [va.y, vb.y, vc.y];
        const us = [uOf(va), uOf(vb), uOf(vc)];
        if (Math.max(...ys) < f.y0 - 1.2 || Math.min(...ys) > f.y1 + 0.3) continue;
        if (Math.max(...us) < f.u0 - 0.05 || Math.min(...us) > f.u1 + 0.05) continue;
        let a = acc[face].get(matName);
        if (!a) {
          a = { tris: 0, yBins: new Map(), uBins: new Map(), d0: Infinity, d1: -Infinity };
          acc[face].set(matName, a);
        }
        a.tris++;
        const yMid = (ys[0] + ys[1] + ys[2]) / 3;
        const uMid = (us[0] + us[1] + us[2]) / 3;
        a.yBins.set(Math.round(yMid / BIN), (a.yBins.get(Math.round(yMid / BIN)) || 0) + 1);
        a.uBins.set(Math.round(uMid / BIN), (a.uBins.get(Math.round(uMid / BIN)) || 0) + 1);
        const dm = Math.min(...ds), dM = Math.max(...ds);
        if (dm < a.d0) a.d0 = dm;
        if (dM > a.d1) a.d1 = dM;
        break; // um triângulo pertence a UMA face
      }
    }
  });

  /** Faixas contíguas de um histograma, com vão de tolerância de 2 bins. */
  const bands = (bins: Map<number, number>, gap = 2) => {
    const ks = [...bins.keys()].sort((a, b) => a - b);
    const out: { lo: number; hi: number; tris: number }[] = [];
    let cur: { lo: number; hi: number; tris: number } | null = null;
    for (const k of ks) {
      const n = bins.get(k) as number;
      if (cur && k - cur.hi / BIN <= gap + (cur.hi / BIN - cur.hi / BIN)) { /* placeholder */ }
      if (cur && k * BIN - cur.hi <= gap * BIN + 1e-9) { cur.hi = k * BIN; cur.tris += n; }
      else { if (cur) out.push(cur); cur = { lo: k * BIN, hi: k * BIN, tris: n }; }
    }
    if (cur) out.push(cur);
    return out;
  };

  const report: Record<string, unknown> = {};
  for (const face of ['left', 'right', 'rear', 'front'] as FaceKey[]) {
    const f = frames[face];
    const faceOut: Record<string, unknown> = {
      branco: { y: [r4(f.y0), r4(f.y1)], u: [r4(f.u0), r4(f.u1)], face0: r4(f.face0), sgn: f.sgn },
    };
    for (const [mat, a] of [...acc[face].entries()].sort((x, y) => y[1].tris - x[1].tris)) {
      if (WHITE_RE.test(mat)) continue;
      faceOut[mat] = {
        tris: a.tris,
        profundidade: [r4(a.d0), r4(a.d1)],
        /* Altura RELATIVA AO PISO DO BRANCO da face — a unidade de parts.ts. */
        y_bandas_mm: bands(a.yBins).map((b) => ({
          do_piso: [Math.round((b.lo - f.y0) * 1000), Math.round((b.hi - f.y0) * 1000)],
          tris: b.tris,
        })).filter((b) => b.tris > 3).slice(0, 24),
        u_bandas_mm: bands(a.uBins).map((b) => ({
          do_u0: [Math.round((b.lo - f.u0) * 1000), Math.round((b.hi - f.u0) * 1000)],
          tris: b.tris,
        })).filter((b) => b.tris > 3).slice(0, 24),
      };
    }
    report[face] = faceOut;
  }

  /* ------------------------------------------------------------------
     A FILEIRA DE REBITES DO TRILHO, especificamente: histograma fino (1 mm)
     em u do inox que mora NA JANELA da peça `rivet-row` (v 1,42–1,56, slab da
     pele esquerda). O histograma geral por material mistura todas as alturas
     e já enganou uma vez — os "pares em 918/993" eram ferragem de outra cota. */
  {
    const f = frames.left;
    const uHist = new Map<number, number>();
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
      const matName = matsOf(mesh).map((m) => m?.name || '?').join('+');
      if (!/inox-ferragem/i.test(matName)) return;
      const g = mesh.geometry;
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const idx = g.index ? g.index.array : null;
      const tri = Math.floor((idx ? idx.length : pos.count) / 3);
      mesh.updateWorldMatrix(true, false);
      for (let t = 0; t < tri; t++) {
        const i0 = idx ? idx[t * 3] : t * 3;
        const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
        const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
        va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
        vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
        const y = (va.y + vb.y + vc.y) / 3;
        if (y < 1.42 || y > 1.56) continue;
        const ds = [va.x, vb.x, vc.x].map((x) => (x - f.face0) * f.sgn);
        if (Math.min(...ds) < -0.06 || Math.max(...ds) > 0.08) continue;
        const u = (va.z + vb.z + vc.z) / 3;
        const k = Math.round(u * 1000);
        uHist.set(k, (uHist.get(k) || 0) + 1);
      }
    });
    const ks = [...uHist.keys()].sort((a, b) => a - b);
    const groups: { u0: number; u1: number; tris: number }[] = [];
    let cur: { u0: number; u1: number; tris: number } | null = null;
    for (const k of ks) {
      const n = uHist.get(k) as number;
      if (cur && k - cur.u1 <= 25) { cur.u1 = k; cur.tris += n; }
      else { if (cur) groups.push(cur); cur = { u0: k, u1: k, tris: n }; }
    }
    if (cur) groups.push(cur);
    report.left_rivet_row = {
      janela: 'y 1,42–1,56 · slab −60..+80 mm da crista esquerda',
      unidades_mm_do_u0: groups.map((g) => ({
        centro: Math.round(((g.u0 + g.u1) / 2) - f.u0 * 1000),
        largura: g.u1 - g.u0, tris: g.tris,
      })),
    };
  }

  /* ------------------------------------------------------------------
     O CHAPADÃO PRETO da faixa inferior da traseira: que material mora na
     janela y rel 100..460 mm, a até 35 mm de profundidade da pele? */
  {
    const f = frames.rear;
    const found = new Map<string, number>();
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
      const matName = matsOf(mesh).map((m) => m?.name || '?').join('+');
      if (WHITE_RE.test(matName)) return;
      const g = mesh.geometry;
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const idx = g.index ? g.index.array : null;
      const tri = Math.floor((idx ? idx.length : pos.count) / 3);
      mesh.updateWorldMatrix(true, false);
      for (let t = 0; t < tri; t++) {
        const i0 = idx ? idx[t * 3] : t * 3;
        const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
        const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
        va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
        vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
        const y = (va.y + vb.y + vc.y) / 3;
        if (y < f.y0 + 0.10 || y > f.y0 + 0.46) continue;
        const ds = [va.z, vb.z, vc.z].map((z) => (z - f.face0) * f.sgn);
        if (Math.min(...ds) < -0.035 || Math.max(...ds) > 0.02) continue;
        const x = (va.x + vb.x + vc.x) / 3;
        if (x < f.u0 + 0.3 || x > f.u1 - 0.3) continue;
        found.set(matName, (found.get(matName) || 0) + 1);
      }
    });
    report.rear_black = Object.fromEntries(
      [...found.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
  }

  window.__report = () => report;
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  window.__ready = true;
});
