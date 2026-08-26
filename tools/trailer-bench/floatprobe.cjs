/* O QUE ESTÁ FLUTUANDO — peça sem vizinho, medida por distância de caixa.
   ===========================================================================
       node tools/trailer-bench/floatprobe.cjs scania_p_6x2r.glb
       node tools/trailer-bench/floatprobe.cjs             # os quatro Scania

   POR QUE ESTA SONDA EXISTE
   ---------------------------------------------------------------------------
   *"analise esses 3 componentes que estao flutuando"* — e a lista de três é do
   olho, não da malha. Um recorte de eixo pode deixar órfã qualquer peça que
   estivesse pendurada num suporte que saiu, e achá-las uma a uma na foto é como
   se descobre a terceira depois de entregar a segunda.

   DUAS DEFINIÇÕES, e elas pegam coisas diferentes:

     · SOLTA — a caixa não encosta na caixa de nenhuma outra. Pega a peça que
       ficou isolada no espaço.
     · SEM APOIO — não há geometria ACIMA dela, dentro da própria pegada em
       (x, z), a menos de `APOIO` do topo dela. Pega a peça que PENDURA: um
       para-barro é preso por um braço que vem de cima, e sem esse braço ele
       fica no ar mesmo com a caixa encostando na longarina que passa ao lado.

   A segunda é a que importa aqui, e a primeira sozinha NÃO a acha: a caixa de
   um para-barro em |x| 410 encosta na caixa da longarina, que atravessa o
   caminhão inteiro — distância zero, e mesmo assim ele está pendurado no vazio.

   ⚠️ E A PERGUNTA QUE DECIDE O CONSERTO NÃO É "ESTÁ SOLTA?", É "JÁ ESTAVA?".
   Um rip de jogo pendura meia dúzia de peças no vazio de fábrica — para-barro
   preso por um braço que ninguém modelou, saia lateral sem suporte. Comparar o
   arquivo derivado com a FONTE separa o que eu quebrei do que eu herdei, e são
   consertos diferentes: o que eu quebrei se conserta no recorte, o que veio
   assim se conserta com peça nova ou com remoção.
*/
const path = require('path');
const fs = require('fs');
const { loadNormalized } = require('./glb-node.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const TRUCKS = path.join(WEB, 'public', 'models', 'trucks');
const MOUNTS = path.join(WEB, 'public', 'models', 'vehicles', 'mounts.json');

const WELD = 5e-4, GRID = 65536;
/** Componente com menos triângulos que isto é respingo. */
const MIN_TRIS = 4;
/** Folga acima da qual duas caixas não se encostam. 5 mm é ruído de malha. */
const TOCA = 0.005;
/** Uma peça só interessa se ela é MACIÇA o bastante para se ver. */
const MIN_AREA = 0.004;   // m² na maior face da caixa

/** Vão vertical acima do qual uma peça pendurada está PENDURADA NO VAZIO.
 *  40 mm: menor que a menor chapa de suporte do acervo (a mão-de-mola tem 121)
 *  e maior que a folga de montagem de um para-barro real. */
const APOIO = 0.040;

/** Margem de sobreposição em planta. O braço que segura um para-barro pode
 *  nascer ao lado da aba dele, não exatamente em cima. */
const PLANTA = 0.030;

/** A mesa da longarina do Scania P, de `mounts.json`. Acima dela a pergunta
 *  "tem apoio em cima?" não faz sentido. */
const FRAME_TOP = 1.0373;

const mm = (v) => (v * 1000).toFixed(0);

function componentes(pos, idx) {
  const nv = pos.length / 3;
  const chave = new Map();
  const rep = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const ix = Math.round(pos[v * 3] / WELD) + GRID / 2;
    const iy = Math.round(pos[v * 3 + 1] / WELD) + GRID / 2;
    const iz = Math.round(pos[v * 3 + 2] / WELD) + GRID / 2;
    const k = (ix * GRID + iy) * GRID + iz;
    let r = chave.get(k);
    if (r === undefined) { r = v; chave.set(k, v); }
    rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const acha = (a) => { while (pai[a] !== a) { pai[a] = pai[pai[a]]; a = pai[a]; } return a; };
  const une = (a, b) => { const ra = acha(a), rb = acha(b); if (ra !== rb) pai[ra] = rb; };
  const tri = idx && idx.length ? idx : null;
  const m = tri ? tri.length : nv;
  for (let i = 0; i + 2 < m; i += 3) {
    const a = tri ? tri[i] : i, b = tri ? tri[i + 1] : i + 1, c = tri ? tri[i + 2] : i + 2;
    une(rep[a], rep[b]); une(rep[a], rep[c]);
  }
  const g = new Map();
  for (let f = 0; f < m / 3; f++) {
    const a = tri ? tri[f * 3] : f * 3;
    const r = acha(rep[a]);
    let s = g.get(r);
    if (!s) { s = []; g.set(r, s); }
    s.push(f);
  }
  return [...g.values()];
}

function caixa(pos, idx, faces) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  const tri = idx && idx.length ? idx : null;
  for (const f of faces) {
    for (let k = 0; k < 3; k++) {
      const v = tri ? tri[f * 3 + k] : f * 3 + k;
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
    }
  }
  return b;
}

/** Distância entre duas caixas: 0 quando se interpenetram. */
function dist(a, b) {
  const dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
  const dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
  const dz = Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1));
  return Math.hypot(dx, dy, dz);
}

async function medir(arquivo, rig) {
  const { pieces } = await loadNormalized(path.join(TRUCKS, arquivo), rig);
  const comps = [];
  for (const p of pieces) {
    for (const g of componentes(p.pos, p.idx)) {
      if (g.length < MIN_TRIS) continue;
      const b = caixa(p.pos, p.idx, g);
      const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0;
      const area = Math.max(dx * dy, dy * dz, dx * dz);
      comps.push({ node: p.node, mat: p.mat, tris: g.length, b, area,
        dx, dy, dz, xc: (b.x0 + b.x1) / 2, zc: (b.z0 + b.z1) / 2 });
    }
  }

  /* Malha espacial de 300 mm para não fazer n². */
  const CEL = 0.30;
  const balde = new Map();
  const chaves = (b, folga) => {
    const out = [];
    for (let i = Math.floor((b.x0 - folga) / CEL); i <= Math.floor((b.x1 + folga) / CEL); i++) {
      for (let j = Math.floor((b.y0 - folga) / CEL); j <= Math.floor((b.y1 + folga) / CEL); j++) {
        for (let k = Math.floor((b.z0 - folga) / CEL); k <= Math.floor((b.z1 + folga) / CEL); k++) {
          out.push(`${i},${j},${k}`);
        }
      }
    }
    return out;
  };
  comps.forEach((c, i) => { for (const k of chaves(c.b, 0)) {
    let s = balde.get(k); if (!s) { s = []; balde.set(k, s); } s.push(i);
  } });

  const soltas = [];
  const semApoio = [];
  comps.forEach((c, i) => {
    if (c.area < MIN_AREA) return;
    let perto = Infinity, quem = null;
    const vistos = new Set();
    for (const k of chaves(c.b, CEL)) {
      for (const j of (balde.get(k) || [])) {
        if (j === i || vistos.has(j)) continue;
        vistos.add(j);
        const d = dist(c.b, comps[j].b);
        if (d < perto) { perto = d; quem = comps[j]; }
      }
    }
    if (perto > TOCA) soltas.push({ ...c, folga: perto, vizinho: quem });

    /* SEM APOIO. Só faz sentido para quem PENDURA — peça que mora abaixo da
       mesa da longarina. Acima dela a pergunta é outra (lataria se apoia por
       flange, não por cima). */
    if (c.b.y1 > FRAME_TOP) return;
    let teto = Infinity, dono = null;
    for (const o of comps) {
      if (o === c) continue;
      /* Sobreposição em planta, com margem: um braço de para-barro pode nascer
         um pouco ao lado da aba dele. */
      const ox = Math.min(c.b.x1, o.b.x1) - Math.max(c.b.x0, o.b.x0);
      const oz = Math.min(c.b.z1, o.b.z1) - Math.max(c.b.z0, o.b.z0);
      if (ox < -PLANTA || oz < -PLANTA) continue;
      if (o.b.y0 < c.b.y1 - 0.01) continue;           // não está acima
      if (o.b.y0 < teto) { teto = o.b.y0; dono = o; }
    }
    const vao = teto - c.b.y1;
    if (vao > APOIO) semApoio.push({ ...c, vao: Number.isFinite(vao) ? vao : Infinity, teto: dono });
  });
  semApoio.sort((a, b) => b.area - a.area);
  soltas.sort((a, b) => b.area - a.area);
  return { comps: comps.length, soltas, semApoio };
}

(async () => {
  const man = JSON.parse(fs.readFileSync(MOUNTS, 'utf8'));
  const rig = Object.values(man.rigids).find((r) => /scania_p_8x2r/.test(r.sourceFile));
  const alvos = process.argv.slice(2).length ? process.argv.slice(2)
    : ['scania_p_8x2r.glb', 'scania_p_6x2r.glb', 'scania_p_4x2r.glb', 'scania_p_6x4r.glb'];
  const porArquivo = {};
  for (const a of alvos) {
    const r = await medir(a, rig);
    porArquivo[a] = r;
    console.log(`\n══ ${a} — ${r.comps} componentes · ${r.soltas.length} SOLTAS · `
      + `${r.semApoio.length} SEM APOIO`);
    for (const s of r.semApoio.slice(0, 20)) {
      console.log(`   PENDURA vão ${(Number.isFinite(s.vao) ? mm(s.vao) : '∞').padStart(5)} mm  `
        + `${String(s.tris).padStart(6)} tri  ${s.node.padEnd(18)} ${s.mat.slice(0, 26).padEnd(26)} `
        + `${mm(s.dx)}×${mm(s.dy)}×${mm(s.dz)}  |x|=${mm(Math.abs(s.xc))}  `
        + `y ${mm(s.b.y0)}…${mm(s.b.y1)}  zc=${mm(s.zc)}`);
    }
    for (const s of r.soltas.slice(0, 24)) {
      console.log(`   folga ${mm(s.folga).padStart(5)} mm  ${String(s.tris).padStart(6)} tri  `
        + `${s.node.padEnd(18)} ${s.mat.slice(0, 30).padEnd(30)} `
        + `${mm(s.dx)}×${mm(s.dy)}×${mm(s.dz)}  |x|=${mm(Math.abs(s.xc))}  `
        + `y ${mm(s.b.y0)}…${mm(s.b.y1)}  zc=${mm(s.zc)}`);
    }
  }
  /* O QUE MUDOU em relação à fonte — é isso que separa o herdado do quebrado. */
  const fonte = porArquivo['scania_p_8x2r.glb'];
  if (fonte) {
    const chave = (s) => `${s.node}|${mm(s.dx)}×${mm(s.dy)}×${mm(s.dz)}|${mm(s.zc)}`;
    const naFonte = new Set(fonte.soltas.map(chave));
    for (const [a, r] of Object.entries(porArquivo)) {
      if (a === 'scania_p_8x2r.glb') continue;
      const novas = r.soltas.filter((s) => !naFonte.has(chave(s)));
      console.log(`\n── ${a}: ${novas.length} solta(s) que a FONTE não tem`);
      for (const s of novas) {
        console.log(`   ⚠️ folga ${mm(s.folga)} mm · ${s.node} · ${mm(s.dx)}×${mm(s.dy)}×${mm(s.dz)} · zc=${mm(s.zc)}`);
      }
    }
  }
  process.exit(0);
})();
