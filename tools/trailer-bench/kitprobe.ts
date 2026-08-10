/* Inventário do NOSSO `trailer.glb` na região das PORTAS TRASEIRAS.
   ---------------------------------------------------------------------------
   Existe por causa da armadilha que já custou três entregas: as medidas do rip
   da Ibiporã NÃO são as do nosso bake. O rip diz o que existe e onde fica; o
   TAMANHO que casa a peça em `DOOR_PARTS` tem de sair daqui.

   Não fotografa nada — cospe `window.__diag` e o `dump-kit.mjs` imprime. Duas
   listas:

     · `regiao` — toda malha com centro atrás de `z0 + 1,4 m`, agrupada por
       material e tamanho, que é a porta traseira inteira e o entorno dela;
     · `procurados` — para cada família de `DOOR_PARTS`, as malhas do baú cujo
       tamanho chega perto do alvo com tolerância FOLGADA (25 mm), ordenadas
       pelo erro. É o que responde "por que SUPORTE_TALA não é encontrada":
       ou aparece a peça com o tamanho certo e o `size` está errado, ou não
       aparece nada e a peça não existe neste bake. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DOOR_PARTS } from '@/pages/tools/truck-studio/engine/vehicle/trailer-door';

declare global {
  interface Window { __ready?: boolean; __error?: string; __diag?: unknown }
}

const WHITE = /Cor_padrao_branco|metalBranco/i;
/** Tolerância folgada da busca — 6× a de produção, para ver o que passou perto. */
const LOOSE = 0.025;

interface Item {
  name: string;
  material: string;
  /** Tamanho no baú, em mm, na ordem dos eixos do MUNDO. */
  size: [number, number, number];
  /** Centro no baú, em metros. */
  c: [number, number, number];
  tris: number;
}

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();

  /* Caixa do corpo BRANCO — o datum de tudo, o mesmo que `TrailerBody` usa. */
  const body = new THREE.Box3();
  const v = new THREE.Vector3();
  const all: Item[] = [];

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const matName = mats.map((x) => x?.name || '?').join('+');
    const m4 = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const pos = m.geometry.attributes.position;
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) {
      b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m4));
    }
    if (mats.some((x) => !!x && WHITE.test(x.name || ''))) body.union(b);
    const s = b.getSize(new THREE.Vector3());
    const c = b.getCenter(new THREE.Vector3());
    all.push({
      name: m.name || '(sem nome)',
      material: matName,
      size: [+(s.x * 1000).toFixed(1), +(s.y * 1000).toFixed(1), +(s.z * 1000).toFixed(1)],
      c: [+c.x.toFixed(4), +c.y.toFixed(4), +c.z.toFixed(4)],
      tris: pos.count / 3,
    });
  });

  const z0 = body.min.z, z1 = body.max.z;
  const centre = body.getCenter(new THREE.Vector3());

  /* --- 1. A REGIÃO da porta traseira, agrupada por material + tamanho ------ */
  const rear = all.filter((it) => it.c[2] < z0 + 1.4);
  const groups = new Map<string, { material: string; size: string; n: number;
    x: number[]; y: number[]; z: number[]; tris: number; nomes: Set<string> }>();
  for (const it of rear) {
    const key = `${it.material}|${it.size.join('×')}`;
    let g = groups.get(key);
    if (!g) {
      g = { material: it.material, size: it.size.join(' × '), n: 0,
        x: [], y: [], z: [], tris: it.tris, nomes: new Set() };
      groups.set(key, g);
    }
    g.n++;
    g.x.push(+it.c[0].toFixed(3)); g.y.push(+it.c[1].toFixed(4)); g.z.push(+it.c[2].toFixed(4));
    g.nomes.add(it.name);
  }
  const regiao = [...groups.values()]
    .sort((a, b) => b.n - a.n || a.material.localeCompare(b.material))
    .map((g) => ({
      material: g.material, size_mm: g.size, n: g.n, tris: g.tris,
      y: [...new Set(g.y)].sort((a, b) => a - b),
      x: [...new Set(g.x)].sort((a, b) => a - b),
      z: [...new Set(g.z)].sort((a, b) => a - b),
      nomes: [...g.nomes].slice(0, 3),
    }));

  /* --- 2. Cada família de DOOR_PARTS, com tolerância folgada --------------- */
  const erroDe = (size: number[], alvo: number[]) => {
    /* Mesmo casamento guloso de `extractDoorKit()`: multiconjunto, sem ordem. */
    const used = [false, false, false];
    let worst = 0;
    for (let t = 0; t < 3; t++) {
      let best = -1, bestErr = Infinity;
      for (let s = 0; s < 3; s++) {
        if (used[s]) continue;
        const e = Math.abs(size[s] / 1000 - alvo[t]);
        if (e < bestErr) { bestErr = e; best = s; }
      }
      used[best] = true;
      if (bestErr > worst) worst = bestErr;
    }
    return worst;
  };

  const procurados = DOOR_PARTS.map((sp) => {
    const cands = all
      .filter((it) => sp.material.test(it.material))
      .map((it) => ({ it, err: erroDe(it.size, sp.size) }))
      .filter((r) => r.err <= LOOSE)
      .sort((a, b) => a.err - b.err)
      .slice(0, 8)
      .map((r) => ({
        err_mm: +(r.err * 1000).toFixed(1),
        size_mm: r.it.size.join(' × '),
        material: r.it.material,
        c: r.it.c,
        /* Distância do centro do baú nos dois eixos que `extractDoorKit()` usa
           para decidir o sentido — é aqui que VARAO e ANEL ficam indecisos. */
        dz_mm: +((r.it.c[2] - centre.z) * 1000).toFixed(0),
        dx_mm: +((r.it.c[0] - centre.x) * 1000).toFixed(0),
        tris: r.it.tris,
        nome: r.it.name,
      }));
    return { part: sp.part, alvo_mm: sp.size.map((n) => +(n * 1000).toFixed(1)).join(' × '),
      material: sp.material.source, achados: cands.length, cands };
  });

  window.__diag = {
    corpo: {
      x: [+body.min.x.toFixed(4), +body.max.x.toFixed(4)],
      y: [+body.min.y.toFixed(4), +body.max.y.toFixed(4)],
      z: [+z0.toFixed(4), +z1.toFixed(4)],
      centro: [+centre.x.toFixed(4), +centre.y.toFixed(4), +centre.z.toFixed(4)],
    },
    malhas: all.length,
    regiao_traseira: { n: rear.length, grupos: regiao },
    /* A FOLHA TRASEIRA DIREITA, peça a peça, em coordenadas DA PORTA.
       Agrupado esconde o pareamento — "8 rebites em 10 alturas" não diz qual
       rebite fica em qual altura —, e é o pareamento que `layoutDoor()` precisa
       conferir. `u` da borda da DOBRADIÇA (x 1,215), `v` do pé da folha
       (y 1,5919), `w` para fora (a traseira olha para −Z, face da folha em
       z −7,4753). Os três data saem das peças que já casam ao milímetro
       (TALA/PINO em u, ANEL/CABECOTE em v), não de palpite. */
    folha_direita: all
      .filter((it) => it.c[2] < z0 + 1.4 && it.c[0] > -0.02 && it.c[0] < 1.30
        && it.c[1] > 1.45 && it.c[1] < 4.20)
      .map((it) => ({
        u: +((1.215 - it.c[0]) * 1000).toFixed(1),
        v: +((it.c[1] - 1.5919) * 1000).toFixed(1),
        w: +((-7.4753 - it.c[2]) * 1000).toFixed(1),
        size_mm: it.size.join(' × '),
        material: it.material,
        tris: Math.round(it.tris),
        nome: it.name,
      }))
      .sort((a, b) => a.u - b.u || a.v - b.v),
    procurados,
  };
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  window.__ready = true;
});
