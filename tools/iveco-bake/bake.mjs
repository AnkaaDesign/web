/* Bake do Iveco S-Way 2021 (cavalo) para o Truck Studio.
   ===========================================================================
   Entrada : Downloads/trucks/01- Iveco.S.way.2021.trailer/Iveco_S_Way_2021_cavalo.gltf
   Saída   : public/models/vehicles/iveco.raw.glb   (comprimir depois — ver README)

   O QUE A ORIGEM É, medido e não suposto
   ---------------------------------------------------------------------------
   - Unidades em MILÍMETROS: o pneu dianteiro mede 1010,6 mm de diâmetro contra
     1015 mm reais. O bake divide tudo por 1000.
   - Frente em +Z: a placa (z 8575..8579), os faróis (`lights`, z 8390..8516) e a
     grade (z 8482..8569) estão no extremo +Z; as lanternas vermelhas (`r_glass`,
     z 2961..3023) no extremo oposto. É a orientação que loadCab() já espera.
   - CADA malha traz DUAS primitivas: uma TRIANGLE_STRIP (modo 5, 35–59% de
     triângulos degenerados, que é como uma tira costura trechos separados) e uma
     TRIANGLES (modo 4). Elas NÃO se repetem: comparadas triângulo a triângulo
     por posição, a interseção é 0,0% em todas as malhas testadas. A lista
     completa a tira; as duas precisam entrar.
   - 20 materiais, e só dois com textura (o pneu e a placa). Todo o resto é cor
     chapada — é exatamente aí que a rip perde para o Volvo e para o Scania, e é
     o que a tabela FINISH abaixo corrige.

   O QUE ESTE SCRIPT FAZ
   ---------------------------------------------------------------------------
   1. Converte tira → lista respeitando o zigue-zague do glTF (o triângulo ímpar
      inverte os dois primeiros índices) e joga fora os degenerados.
   2. VALIDA a orientação de cada primitiva contra o atributo NORMAL: se a
      maioria dos triângulos discorda da normal sombreada, aquela primitiva sai
      invertida. Sem isso não daria para tirar o doubleSided de nada — e é o
      doubleSided que estraga a sombra e o AO da carroceria.
   3. Compacta os vértices (a origem duplica o array inteiro para cada primitiva
      e usa uma fração dele) e junta as duas primitivas de cada malha em uma só.
   4. Reescreve os materiais com a doutrina que o estúdio já usa (ver FINISH).
   5. Mantém a HIERARQUIA de nós intacta — só a matriz da raiz muda. Achatar é o
      que quebrou o semirreboque: assar matrixWorld nas posições faz os 50 nós
      espelhados perderem a compensação de winding que o three faz por quadro.

   Uso: node tools/iveco-bake/bake.mjs [origem.gltf] [saida.glb]                */

import fs from 'node:fs';
import path from 'node:path';
import { load, readAccessor, walkMeshes, trs, mul, ident, writeGLB } from './gltf-lib.mjs';

const SRC = process.argv[2] || 'C:/Users/Kennedy/Downloads/trucks/01- Iveco.S.way.2021.trailer/Iveco_S_Way_2021_cavalo.gltf';
const OUT = process.argv[3] || path.resolve('public/models/vehicles/iveco.raw.glb');

/* ---------------- acabamento dos materiais ----------------
   `name` é o nome novo, e ele é FUNCIONAL, não decorativo — três sistemas do
   estúdio leem nome de material:
     · cabs.json `paintMaterials: ["carpaint"]` → loadCab() troca por
       makePaintMaterial() (verniz, flocos, casca-de-laranja). É o que dá o
       acabamento automotivo do Volvo, e a rip chamava esse material de `body`.
     · setupCommon() GLASS_RE (/glass|vidro|.../) → transparente, sem depthWrite,
       roughness ≤ 0,12 e renderOrder 20.
     · auditTransparency() GLASS_OK_RE → qualquer transparente que não seja vidro
       nem decalque é FORÇADO opaco. As lentes precisam terminar em `glass`.

   Os escalares seguem o volvo.glb aprovado e a correção de refletância que o
   Scania documenta: em metalness 1 a cor base deixa de ser tinta e vira o FILTRO
   do reflexo, então um cromado tem de devolver ~90% e um alumínio usinado ~70%.
   A rip trazia chrome em 0,80 e silver em 0,65 — escuros demais para metal.

   `2s` = doubleSided. Fica só onde a peça é uma folha só (vidros, placa, lentes,
   tecido). O resto é chapa fechada e passa a face única: sombra correta e metade
   do custo de shadow map. */
const FINISH = {
  //  origem        nome novo        met   rough  2s     cor (null = mantém)      extras
  body: { name: 'carpaint', met: 0.90, rough: 0.32, two: false, cc: [1.0, 0.035] },
  black_shiny: { name: 'chassis', met: 0.25, rough: 0.42, two: false, cc: [0.85, 0.06] },
  black_matt: { name: 'blackplastic', met: 0.00, rough: 0.74, two: false, color: [0.10, 0.10, 0.105] },
  black: { name: 'blackrubber', met: 0.00, rough: 0.68, two: false, color: [0.022, 0.022, 0.024] },
  chrome: { name: 'chrome', met: 1.00, rough: 0.055, two: false, color: [0.90, 0.90, 0.90] },
  silver: { name: 'alumetal', met: 0.92, rough: 0.30, two: false, color: [0.70, 0.70, 0.72] },
  tire: { name: 'tire', met: 0.00, rough: 0.92, two: false },
  interior: { name: 'interior', met: 0.00, rough: 0.85, two: false },
  tent: { name: 'interiorfabric', met: 0.00, rough: 0.88, two: true },
  plate: { name: 'plate', met: 0.00, rough: 0.40, two: true },
  lights: { name: 'lampsreflector', met: 0.85, rough: 0.14, two: false, color: [0.82, 0.82, 0.82], emissive: 0 },
  orange: { name: 'orange', met: 0.00, rough: 0.42, two: false },
  yellow: { name: 'yellow', met: 0.00, rough: 0.42, two: false },
  red: { name: 'red', met: 0.00, rough: 0.40, two: false },
  glass: { name: 'windowglass', met: 0.00, rough: 0.05, two: true, alpha: 0.26 },
  d_glass: { name: 'darkglass', met: 0.00, rough: 0.08, two: true, alpha: 0.52 },
  vd_glass: { name: 'darkglass_roof', met: 0.00, rough: 0.10, two: true, alpha: 0.62 },
  o_glass: { name: 'orangeglass', met: 0.00, rough: 0.10, two: true, alpha: 0.72, emissive: 0 },
  y_glass: { name: 'yellowglass', met: 0.00, rough: 0.10, two: true, alpha: 0.72, emissive: 0 },
  r_glass: { name: 'redglass', met: 0.00, rough: 0.10, two: true, alpha: 0.72, emissive: 0 },
};

/* O LETREIRO DA GRADE NÃO PODE SER UM ESPELHO.
   ---------------------------------------------------------------------------
   As letras IVECO da grade saíam VERDE-OLIVA no cenário do distrito industrial.
   Não é cor errada: elas usam o mesmo `chrome` do resto (metalness 1, roughness
   0,055), e um espelho perfeito virado para a frente devolve o que está à frente
   — que ali é uma linha de árvores. É o outro lado do erro que o Scania
   documenta: lá o cromado era escuro demais e o letreiro saía preto; aqui ele é
   liso demais e o letreiro pega a paisagem.

   ASPEREZA SOZINHA NÃO RESOLVE, e testar no estúdio foi o que mostrou isso: em
   metalness 1 o three zera o difuso, então a cor da peça É o reflexo e roughness
   só o embaça — um verde borrado continua verde. O que devolve as letras à cor
   delas é BAIXAR O METALNESS, exatamente a receita que applyTrailerFinish() usa
   nas lentes das lanternas. Em 0,30/0,34 elas leem prata claro em qualquer
   cenário, com brilho de emblema e sem virar espelho.

   A peça é achada pela MEDIDA, não pelo nome, e o bake exige encontrar
   exatamente uma. */
const BADGE = { met: 0.30, rough: 0.34, color: [0.80, 0.80, 0.82], name: 'chromebadge' };
const isBadge = (box, zmaxAll) => (
  box.max[2] > zmaxAll - 100 &&                    // a até 100 mm da face dianteira
  box.max[0] - box.min[0] > 500 && box.max[0] - box.min[0] < 900 &&
  box.max[1] - box.min[1] < 250 &&
  box.max[2] - box.min[2] < 50
);

/* Por que emissive vai a ZERO nas lanternas e no farol
   ---------------------------------------------------------------------------
   A rip acende os faróis o tempo todo (emissive 0,85) e as lentes em 0,5. O
   estúdio NÃO governa emissive de veículo: `lampModelEmissive` em scene/lamps.ts
   só toma conta do poste do cenário. O volvo.glb aprovado não traz emissive
   nenhum. Um farol aceso ao meio-dia é a primeira coisa que denuncia um modelo
   de jogo, então ele sai; acender farol é recurso de cabine, e teria de valer
   para as três. */

const g = load(SRC);
const log = [];
const say = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };

/* ---------------- 1. medir o mundo antes de mexer ---------------- */
const parts = walkMeshes(g);
let ymin = 1e30, zmin = 1e30, zmax = -1e30, xmin = 1e30, xmax = -1e30, ymax = -1e30;
for (const p of parts) {
  ymin = Math.min(ymin, p.box.min[1]); ymax = Math.max(ymax, p.box.max[1]);
  zmin = Math.min(zmin, p.box.min[2]); zmax = Math.max(zmax, p.box.max[2]);
  xmin = Math.min(xmin, p.box.min[0]); xmax = Math.max(xmax, p.box.max[0]);
}
say(`origem (mm): x [${xmin.toFixed(1)}, ${xmax.toFixed(1)}]  y [${ymin.toFixed(1)}, ${ymax.toFixed(1)}]  z [${zmin.toFixed(1)}, ${zmax.toFixed(1)}]`);

const S = 0.001;                      // mm → m
const xc = (xmin + xmax) / 2;         // centraliza a bitola em x=0

/* caixa em mundo por malha, para as regras que dependem de MEDIDA */
const meshBox = new Map();
for (const p of parts) {
  const mi = g.nodes[p.node].mesh;
  let b = meshBox.get(mi);
  if (!b) { b = { min: [1e30, 1e30, 1e30], max: [-1e30, -1e30, -1e30] }; meshBox.set(mi, b); }
  for (let k = 0; k < 3; k++) {
    b.min[k] = Math.min(b.min[k], p.box.min[k]);
    b.max[k] = Math.max(b.max[k], p.box.max[k]);
  }
}

/* ---------------- 2. malhas ---------------- */
let flipped = 0, degen = 0, trisOut = 0, vertsOut = 0, badges = 0;
const badgeMatIdx = g.materials.length;      // material extra, anexado no fim
const newMeshes = [];
const meshMap = new Map();            // índice antigo → novo
const bin = [];                       // chunks binários, na ordem dos bufferViews
const bufferViews = [];
const accessors = [];

function pushAccessor(arr, type, componentType, extra = {}) {
  const byteOffset = bin.reduce((s, c) => s + c.byteLength + ((4 - (c.byteLength % 4)) % 4), 0);
  bin.push(arr);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: arr.byteLength, ...(extra.target ? { target: extra.target } : {}) });
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
  const a = { bufferView: bufferViews.length - 1, componentType, count: arr.length / n, type };
  if (extra.min) { a.min = extra.min; a.max = extra.max; }
  accessors.push(a);
  return accessors.length - 1;
}

for (const [mi, me] of g.meshes.entries()) {
  /* Todas as primitivas de uma malha carregam o MESMO material nesta rip — a
     junção abaixo depende disso, então ela é verificada e não suposta. */
  const matIdx = me.primitives[0].material;
  if (me.primitives.some(p => p.material !== matIdx)) {
    say(`!! malha ${mi} ${me.name} tem materiais diferentes por primitiva — pulando junção`);
  }
  const wantUV = !!(g.materials[matIdx]?.pbrMetallicRoughness?.baseColorTexture);

  const P = [], N = [], T = [], I = [];   // saída acumulada da malha
  let base = 0;

  for (const pr of me.primitives) {
    const mode = pr.mode ?? 4;
    const pos = readAccessor(g, pr.attributes.POSITION);
    const nrm = pr.attributes.NORMAL != null ? readAccessor(g, pr.attributes.NORMAL) : null;
    const uv = wantUV && pr.attributes.TEXCOORD_0 != null ? readAccessor(g, pr.attributes.TEXCOORD_0) : null;
    const idx = pr.indices != null ? readAccessor(g, pr.indices) : null;
    if (!idx) { say(`!! primitiva sem índices em ${me.name} — pulada`); continue; }

    /* tira → lista, com o zigue-zague do glTF */
    const tri = [];
    if (mode === 4) {
      for (let t = 0; t * 3 + 2 < idx.length; t++) {
        const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
        if (a === b || b === c || a === c) { degen++; continue; }
        tri.push(a, b, c);
      }
    } else if (mode === 5) {
      for (let t = 0; t + 2 < idx.length; t++) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2];
        if (a === b || b === c || a === c) { degen++; continue; }
        if (t % 2 === 0) tri.push(a, b, c); else tri.push(b, a, c);
      }
    } else { say(`!! modo ${mode} não suportado em ${me.name}`); continue; }
    if (!tri.length) continue;

    /* A orientação é conferida contra a normal sombreada, que é o único juiz
       independente que a origem oferece. Amostra até 2000 triângulos. */
    let agree = 0, tested = 0;
    if (nrm) {
      const step = Math.max(1, Math.floor(tri.length / 3 / 2000));
      for (let t = 0; t * 3 < tri.length; t += step) {
        const a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
        const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
        const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
        const sx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3];
        const sy = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1];
        const sz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
        const d = gx * sx + gy * sy + gz * sz;
        if (Math.abs(d) < 1e-12) continue;
        tested++;
        if (d > 0) agree++;
      }
    }
    if (tested > 0 && agree / tested < 0.5) {
      for (let t = 0; t * 3 < tri.length; t++) {
        const b = tri[t * 3 + 1]; tri[t * 3 + 1] = tri[t * 3 + 2]; tri[t * 3 + 2] = b;
      }
      flipped++;
    }

    /* compacta: a origem guarda o array de vértices inteiro em CADA primitiva e
       usa uma fração dele (23364 vértices para 1449 triângulos, num caso) */
    const remap = new Map();
    for (let k = 0; k < tri.length; k++) {
      const v = tri[k];
      let nv = remap.get(v);
      if (nv === undefined) {
        nv = base + remap.size;
        remap.set(v, nv);
        P.push(pos[v * 3] , pos[v * 3 + 1], pos[v * 3 + 2]);
        if (nrm) N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
        if (uv) T.push(uv[v * 2], uv[v * 2 + 1]);
      }
      I.push(nv);
    }
    base += remap.size;
  }

  if (!I.length) continue;

  const pos32 = new Float32Array(P.length);
  const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
  for (let i = 0; i < P.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = P[i + k];
      pos32[i + k] = v;
      if (v < mn[k]) mn[k] = v;
      if (v > mx[k]) mx[k] = v;
    }
  }
  const attributes = { POSITION: pushAccessor(pos32, 'VEC3', 5126, { min: mn, max: mx, target: 34962 }) };
  if (N.length) attributes.NORMAL = pushAccessor(new Float32Array(N), 'VEC3', 5126, { target: 34962 });
  if (T.length) attributes.TEXCOORD_0 = pushAccessor(new Float32Array(T), 'VEC2', 5126, { target: 34962 });
  const indices = pushAccessor(new Uint32Array(I), 'SCALAR', 5125, { target: 34963 });

  /* o letreiro da grade sai do `chrome` comum — ver BADGE */
  let matOut = matIdx;
  const box = meshBox.get(mi);
  if (matIdx != null && g.materials[matIdx].name === 'chrome' && box && isBadge(box, zmax)) {
    matOut = badgeMatIdx;
    badges++;
    say(`  letreiro da grade: ${me.name} — ${((box.max[0] - box.min[0]) / 10).toFixed(1)} × ` +
      `${((box.max[1] - box.min[1]) / 10).toFixed(1)} cm em z ${(box.max[2] / 1000).toFixed(3)} m → cromado acetinado`);
  }

  meshMap.set(mi, newMeshes.length);
  newMeshes.push({ name: me.name, primitives: [{ attributes, indices, material: matOut, mode: 4 }] });
  trisOut += I.length / 3;
  vertsOut += P.length / 3;
}

say(`triângulos: ${trisOut.toLocaleString('pt-BR')}   vértices: ${vertsOut.toLocaleString('pt-BR')}`);
if (badges !== 1) say(`!! o seletor do letreiro casou ${badges} peças (esperado 1) — confira BADGE/isBadge`);
say(`degenerados descartados: ${degen.toLocaleString('pt-BR')}   primitivas invertidas pela conferência de normal: ${flipped}`);

/* ---------------- 3. materiais ---------------- */
const materials = g.materials.map((m) => {
  const src = m.pbrMetallicRoughness || {};
  const fin = FINISH[m.name];
  if (!fin) { say(`!! material sem acabamento definido: ${m.name}`); }
  const f = fin || { name: m.name, met: src.metallicFactor ?? 1, rough: src.roughnessFactor ?? 1, two: true };
  const bc = (src.baseColorFactor || [1, 1, 1, 1]).slice();
  if (f.color) { bc[0] = f.color[0]; bc[1] = f.color[1]; bc[2] = f.color[2]; }
  if (f.alpha != null) bc[3] = f.alpha;
  const out = {
    name: f.name,
    pbrMetallicRoughness: {
      baseColorFactor: bc,
      metallicFactor: f.met,
      roughnessFactor: f.rough,
      ...(src.baseColorTexture ? { baseColorTexture: src.baseColorTexture } : {}),
    },
    doubleSided: !!f.two,
  };
  if (bc[3] < 0.999) { out.alphaMode = 'BLEND'; }
  const emi = f.emissive != null ? f.emissive : null;
  if (emi === 0) { /* apagado de propósito — ver nota acima */ }
  else if (m.emissiveFactor) out.emissiveFactor = m.emissiveFactor;
  if (f.cc) {
    out.extensions = { KHR_materials_clearcoat: { clearcoatFactor: f.cc[0], clearcoatRoughnessFactor: f.cc[1] } };
  }
  return out;
});
materials.push({
  name: BADGE.name,
  pbrMetallicRoughness: {
    baseColorFactor: [...BADGE.color, 1],
    metallicFactor: BADGE.met, roughnessFactor: BADGE.rough,
  },
  doubleSided: false,
});

/* ---------------- 4. texturas ----------------
   A PLACA DA RIP É A MARCA D'ÁGUA DO FORNECEDOR: 832×181 px escrito "SQUIR",
   com o site e o crédito em letra miúda embaixo. Ela aparece na dianteira E na
   traseira, e as duas malhas usam a textura INTEIRA (u e v de 0 a 1, medido),
   então a substituição só precisa manter a proporção. `plate.png`, ao lado
   deste script, é uma placa Mercosul limpa no mesmo 832×181. */
const PLATE_PNG = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'plate.png');
const images = (g.images || []).map((im) => {
  const uri = im.uri || '';
  let mime = uri.slice(5, uri.indexOf(';'));
  let data = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  if (/plate/i.test(im.name || '') && fs.existsSync(PLATE_PNG)) {
    data = fs.readFileSync(PLATE_PNG);
    mime = 'image/png';
    say(`placa substituída pela limpa (${(data.length / 1024).toFixed(0)} KB) — a da rip dizia SQUIR`);
  }
  const byteOffset = bin.reduce((s, c) => s + c.byteLength + ((4 - (c.byteLength % 4)) % 4), 0);
  bin.push(data);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: data.byteLength });
  return { name: im.name, mimeType: mime, bufferView: bufferViews.length - 1 };
});
const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
const textures = (g.textures || []).map(t => ({ source: t.source, sampler: 0 }));

/* ---------------- 5. nós ---------------- */
const nodes = g.nodes.map((n) => {
  const o = { ...n };
  delete o.mesh;
  if (n.mesh != null && meshMap.has(n.mesh)) o.mesh = meshMap.get(n.mesh);
  return o;
});

/* A raiz passa a levar mm→m, o assentamento no chão e a traseira em z=0. A conta
   é p' = S·(p_mundo + T), então a matriz nova é Escala · Translação · antiga —
   nenhum vértice é tocado e a hierarquia (com seus nós espelhados) fica intacta. */
const rootIdx = g.scenes[g.scene ?? 0].nodes[0];
const Tm = ident(); Tm[12] = -xc; Tm[13] = -ymin; Tm[14] = -zmin;
const Sm = ident(); Sm[0] = Sm[5] = Sm[10] = S;
nodes[rootIdx].matrix = mul(Sm, mul(Tm, trs(g.nodes[rootIdx])));
delete nodes[rootIdx].translation; delete nodes[rootIdx].rotation; delete nodes[rootIdx].scale;

const totalBin = bin.reduce((s, c) => s + c.byteLength + ((4 - (c.byteLength % 4)) % 4), 0);
const json = {
  asset: { version: '2.0', generator: 'ankaa iveco-bake' },
  extensionsUsed: ['KHR_materials_clearcoat'],
  scene: 0,
  scenes: g.scenes,
  nodes,
  meshes: newMeshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: totalBin }],
  ...(images.length ? { images, textures, samplers } : {}),
};
writeGLB(OUT, json, bin);
say(`escrito ${OUT} — ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`);

/* ---------------- 6. números para o cabs.json ----------------
   Medidos DEPOIS do bake, no espaço final (metros, chão em y=0, traseira em
   z=0), lendo posição por posição — nunca uma caixa de objeto. */
const mm = (v) => v * S;
say('');
say('=== para public/models/vehicles/cabs.json ===');
say(`  dims.length = ${mm(zmax - zmin).toFixed(3)}   dims.width = ${mm(xmax - xmin).toFixed(3)}   dims.height = ${mm(ymax - ymin).toFixed(3)}`);

/* quinta roda: a maior superfície horizontal isolada acima do chassi */
const fifth = parts
  .filter(p => p.mat === 'black_matt')
  .map(p => ({ p, w: p.box.max[0] - p.box.min[0], d: p.box.max[2] - p.box.min[2], h: p.box.max[1] - p.box.min[1] }))
  .filter(o => o.h < 60 && o.w > 700 && o.d > 400 && o.p.box.max[1] > 1000 && o.p.box.max[1] < 1500)
  .sort((a, b) => b.w * b.d - a.w * a.d)[0];
if (fifth) {
  const zc = (fifth.p.box.min[2] + fifth.p.box.max[2]) / 2;
  say(`  fifthwheel.z = ${mm(zc - zmin).toFixed(3)}   fifthwheel.topY = ${mm(fifth.p.box.max[1] - ymin).toFixed(3)}` +
    `   (chapa ${mm(fifth.w).toFixed(2)} × ${mm(fifth.d).toFixed(2)} m, ${fifth.p.name})`);
}
/* traseira da carroceria alta: menor z entre as peças de cabine acima de 1,5 m */
let rearBody = 1e30;
for (const p of parts) if (p.box.max[1] - ymin > 1500 && p.mat === 'body') rearBody = Math.min(rearBody, p.box.min[2]);
say(`  rearBodyZ = ${mm(rearBody - zmin).toFixed(3)}`);

/* O log fica JUNTO DA FERRAMENTA, não junto do .glb: public/ é servido, e um
   .txt de build ali vira asset público. */
fs.writeFileSync(path.join(path.dirname(PLATE_PNG), 'ultimo-bake.log.txt'), log.join('\n'), 'utf8');
