/* O QUE PERTENCE A CADA EIXO — o inventário que um bake de configuração exige.
   ===========================================================================
       node tools/trailer-bench/axleprobe.cjs scania          # um caminhão
       node tools/trailer-bench/axleprobe.cjs scania --json   # despeja o mapa

   POR QUE ESTA SONDA EXISTE
   ---------------------------------------------------------------------------
   Transformar um bitruck 8x2 em truck 6x2 é "apagar o 2º eixo direcional" — e
   essa frase esconde o trabalho inteiro. Um eixo não é uma peça: é viga,
   cubo, aro, pneu, tambor, feixe de molas, grampo, amortecedor, para-lama,
   para-barro e as CHAPAS REBITADAS que o prendem na alma da longarina. Deixar
   qualquer uma delas para trás põe uma mão-de-mola flutuando no vazio; levar
   junto uma travessa põe um furo no quadro.

   E não dá para perguntar ao nome do nó. Neste rip `t_paralama_0_*` parece
   traseiro e é do 2º DIRECIONAL (z −1,276…+0,107); `chassis_p12` tem 247
   componentes e vai de z −8,63 a +2,81, atravessando o caminhão inteiro.
   Quem responde "que peça é esta" é a COMPONENTE CONEXA, e é isso que esta
   sonda entrega.

   O MÉTODO
   ---------------------------------------------------------------------------
   1. Lê o GLB em espaço normalizado (`glb-node.cjs`).
   2. Decompõe TODA primitiva em componentes conexos, soldando por posição a
      0,5 mm com chave NUMÉRICA (o Scania tem 2,9 M de triângulos; um `Map` de
      strings custaria centenas de MB — a mesma razão de `trailer-assembly.ts`).
   3. Acha o Z de cada eixo pelo ARO, nunca pelo pneu (§36.2: os pneus de um
      tandem se tocam e o histograma funde os dois).
   4. Atribui cada componente ao eixo mais próximo, e só quando ela está DENTRO
      da zona de influência dele — o resto é quadro, cabine ou equipamento.

   ⚠️ O QUE ELA NÃO DECIDE. A sonda diz o que está PERTO de cada eixo; dizer o
   que VAI JUNTO é leitura humana, e é por isso que ela imprime nó, material,
   caixa e contagem de cada componente em vez de um veredito. Uma travessa
   passa perto do eixo e não é dele; uma chapa rebitada passa perto e é.
*/
const path = require('path');
const fs = require('fs');
const { loadNormalized } = require('./glb-node.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const MOUNTS = path.join(WEB, 'public', 'models', 'vehicles', 'mounts.json');

/** Grade de solda, em metros. */
const WELD = 5e-4;
/** Passos por eixo na chave numérica: 65 536 × 0,5 mm = 32,7 m de alcance. */
const GRID = 65536;

/** Nó de roda — o rip nomeia `wheel_f_<i>_<eixo>` e `wheel_r_<i>_<eixo>`. */
const WHEEL_RE = /^wheel_[fr]_/i;
/** Dentro de um nó de roda, o ARO (e não o pneu). §36.2. */
const RIM_RE = /_disc|_rim|aro/i;

/** Componente com menos triângulos que isto é respingo. */
const MIN_TRIS = 4;

/** Meia-zona de influência de um eixo, em metros. Metade do menor vão entre
 *  eixos do acervo (1 254 mm no VW) com folga: o que cai fora é do quadro. */
const AXLE_REACH = 0.62;

const mm = (v) => (v * 1000).toFixed(1);
const cx = (b) => (b.x0 + b.x1) / 2;
const cz = (b) => (b.z0 + b.z1) / 2;

function components(pos, idx) {
  const n = pos.length / 3;
  const key = new Map();
  const rep = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    const ix = Math.round(pos[v * 3] / WELD) + GRID / 2;
    const iy = Math.round(pos[v * 3 + 1] / WELD) + GRID / 2;
    const iz = Math.round(pos[v * 3 + 2] / WELD) + GRID / 2;
    const k = (ix * GRID + iy) * GRID + iz;
    let r = key.get(k);
    if (r === undefined) { r = v; key.set(k, v); }
    rep[v] = r;
  }
  const parent = new Int32Array(rep);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const tri = idx && idx.length ? idx : null;
  const m = tri ? tri.length : n;
  for (let i = 0; i + 2 < m; i += 3) {
    const a = tri ? tri[i] : i, b = tri ? tri[i + 1] : i + 1, c = tri ? tri[i + 2] : i + 2;
    union(rep[a], rep[b]); union(rep[a], rep[c]);
  }
  const groups = new Map();
  for (let i = 0; i + 2 < m; i += 3) {
    const a = tri ? tri[i] : i;
    const r = find(rep[a]);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(a, tri ? tri[i + 1] : i + 1, tri ? tri[i + 2] : i + 2);
  }
  return [...groups.values()];
}

function boxOf(pos, verts) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const v of verts) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
  }
  return b;
}

/** O Z de cada eixo, pelo ARO. Devolve os centros em ordem de frente para trás. */
function eixosPeloAro(pieces) {
  const zs = [];
  for (const p of pieces) {
    if (!WHEEL_RE.test(p.node) || !RIM_RE.test(p.node + '|' + p.mesh + '|' + p.mat)) continue;
    const b = boxOf(p.pos, [...Array(p.pos.length / 3).keys()]);
    zs.push(cz(b));
  }
  zs.sort((a, b) => b - a);
  /* Agrupa aros cujo centro está a menos de 350 mm — é o mesmo `AXLE_BAND` de
     `truck-wheels.ts`, e pela mesma razão: um rodado duplo são dois aros. */
  const eixos = [];
  for (const z of zs) {
    const e = eixos[eixos.length - 1];
    if (e && Math.abs(e.soma / e.n - z) < 0.35) { e.soma += z; e.n++; }
    else eixos.push({ soma: z, n: 1 });
  }
  return eixos.map((e) => e.soma / e.n);
}

async function medir(id, rig, dump) {
  const file = path.join(WEB, 'public', rig.sourceFile);
  process.stderr.write(`lendo ${rig.sourceFile}…\n`);
  const { pieces } = await loadNormalized(file, rig);

  const eixos = eixosPeloAro(pieces);
  const papel = [];
  const st = [...(rig.axles?.steerZ || [])].sort((a, b) => b - a);
  const dr = [...(rig.axles?.driveZ || [])];
  const lf = [...(rig.axles?.liftZ || [])];
  for (const z of eixos) {
    const perto = (arr) => arr.some((v) => Math.abs(v - z) < 0.35);
    papel.push(perto(st) ? 'direcional' : perto(dr) ? 'trativo' : perto(lf) ? 'auxiliar' : '?');
  }

  console.log(`\n══ ${id} — ${eixos.length} eixos pelo ARO`);
  eixos.forEach((z, i) => console.log(`   eixo ${i + 1}  ${papel[i].padEnd(11)} z = ${mm(z)} mm`));

  process.stderr.write('decompondo…\n');
  const comps = [];
  for (const p of pieces) {
    for (const g of components(p.pos, p.idx)) {
      if (g.length / 3 < MIN_TRIS) continue;
      comps.push({ node: p.node, mat: p.mat, tris: g.length / 3, b: boxOf(p.pos, g) });
    }
  }
  console.log(`   ${pieces.length} primitivas → ${comps.length} componentes`);

  /* Atribuição: o eixo mais próximo, e só dentro do alcance. Uma componente que
     CRUZA a fronteira de dois eixos (o balancim de um tandem) fica com o mais
     próximo do centro dela e é marcada — é ela que impede o corte limpo. */
  const porEixo = eixos.map(() => []);
  const soltas = [];
  for (const c of comps) {
    const z = cz(c.b);
    let melhor = -1, dist = Infinity;
    eixos.forEach((ez, i) => { const d = Math.abs(ez - z); if (d < dist) { dist = d; melhor = i; } });
    if (melhor >= 0 && dist <= AXLE_REACH) {
      /* Marca quem se estende para dentro da zona do vizinho. */
      const vizinho = eixos.some((ez, i) => i !== melhor
        && c.b.z0 < ez + AXLE_REACH && c.b.z1 > ez - AXLE_REACH);
      porEixo[melhor].push({ ...c, vizinho });
    } else soltas.push(c);
  }

  for (let i = 0; i < eixos.length; i++) {
    const lista = porEixo[i].sort((a, b) => b.tris - a.tris);
    const tri = lista.reduce((s, c) => s + c.tris, 0);
    const sujas = lista.filter((c) => c.vizinho);
    console.log(`\n   ── eixo ${i + 1} (${papel[i]}, z ${mm(eixos[i])}) — `
      + `${lista.length} componentes · ${tri.toLocaleString('pt-BR')} tri`
      + (sujas.length ? `  ⚠️ ${sujas.length} ATRAVESSAM a zona do vizinho` : '  ✓ nenhuma atravessa'));
    for (const c of lista.slice(0, 22)) {
      console.log(`      ${String(c.tris).padStart(7)} tri  ${c.vizinho ? '⚠️' : '  '} `
        + `${c.node.padEnd(22)} ${c.mat.slice(0, 34).padEnd(34)} `
        + `x ${mm(c.b.x0)}…${mm(c.b.x1)}  y ${mm(c.b.y0)}…${mm(c.b.y1)}  z ${mm(c.b.z0)}…${mm(c.b.z1)}`);
    }
    if (lista.length > 22) console.log(`      … e mais ${lista.length - 22} componentes menores`);
  }

  if (dump) {
    const out = path.join(__dirname, `axles-${id}.json`);
    fs.writeFileSync(out, JSON.stringify({ eixos, papel, porEixo, soltas: soltas.length }, null, 1));
    console.log(`\n   mapa completo em ${path.relative(WEB, out)}`);
  }
}

(async () => {
  const man = JSON.parse(fs.readFileSync(MOUNTS, 'utf8'));
  const filtro = process.argv[2];
  const dump = process.argv.includes('--json');
  for (const [id, rig] of Object.entries(man.rigids)) {
    if (filtro && !filtro.startsWith('--') && !id.includes(filtro)) continue;
    await medir(id, rig, dump);
  }
})();
