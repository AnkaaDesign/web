/* SONDA DE SOBREPOSIÇÃO — que peças ATRAVESSAM que peças, por triângulo.
   ===========================================================================
       node tools/chassis-bake/probe-sobreposicao.cjs <glb> <groundY> \
            [--base <glb>] [--zona z0 z1] [--min-tri N] [--top N]

   > *"cuidado com componentes entrando dentro de outros … use algoritmos de
   >  reconhecimento de sobreposição de peças"* — Kennedy, 2026-08-23.

   POR QUE ELA NÃO É UMA SONDA DE CAIXA
   ---------------------------------------------------------------------------
   `probe-eixo.cjs` e `perfil.cjs` medem CAIXA ENVOLVENTE, e caixa mente nos dois
   sentidos: a caixa de uma roda cruza a caixa da longarina sem que um triângulo
   encoste no outro, e uma chapa fina que atravessa um cilindro dá duas caixas
   que mal se tocam. Quem responde "esta peça entrou dentro daquela?" é o
   TRIÂNGULO, e é o que esta sonda testa — Möller, separação por 11 eixos,
   exata.

   ⚠️ E O NÚMERO ABSOLUTO NÃO SERVE PARA NADA. Um rip de caminhão é feito de
   peças que se atravessam de propósito: parafuso enterrado na chapa, mão-de-mola
   dentro da longarina, cubo dentro do aro. Medido no `volvo_vm_2015_6x2r.glb`
   intacto, são MILHARES de pares. Por isso o modo que importa é o **--base**:
   roda a mesma varredura no arquivo de ORIGEM, casa peça com peça por
   assinatura e imprime só o que é NOVO. O que a cirurgia criou aparece; o que o
   modelador desenhou assim, não.

   A ASSINATURA DE UMA PEÇA é `nome-do-nó | nº de triângulos | dx×dy×dz`, em
   milímetros. Ela é INVARIANTE POR TRANSLAÇÃO de propósito — mover um tanque
   1 350 mm não pode transformá-lo numa peça nova, senão o diff acusaria todas
   as sobreposições legítimas dele. Peças com a mesma assinatura (as duas
   metades de um par simétrico, os 20 rebites iguais de uma travessa) recebem um
   índice de desempate, ordenado por z.

   O ESPAÇO é o NORMALIZADO de `mounts.json` (Xn = −Xg · Yn = Yg − groundY ·
   Zn = −Zg), o mesmo de `cut-chassi.cjs`. */
const path = require('path');
const S = require('./glb-surgery.cjs');

const argv = process.argv.slice(2);
const SRC = argv[0];
const GROUND_Y = parseFloat(argv[1]);
const iBase = argv.indexOf('--base');
const BASE = iBase >= 0 ? argv[iBase + 1] : null;
const iZona = argv.indexOf('--zona');
const ZONA = iZona >= 0 ? [parseFloat(argv[iZona + 1]), parseFloat(argv[iZona + 2])] : null;
const iMin = argv.indexOf('--min-tri');
const MIN_TRI = iMin >= 0 ? parseInt(argv[iMin + 1], 10) : 12;
const iTop = argv.indexOf('--top');
const TOP = iTop >= 0 ? parseInt(argv[iTop + 1], 10) : 40;
/** Abaixo disto a interseção de caixas é ruído de vizinhança, não encaixe. */
const FOLGA = 0.002;

const mm = (v) => (v * 1000).toFixed(0);

/* ---------- matrizes de nó, compostas pela árvore (igual a probe-eixo) ---------- */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0];
  const q = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function matrizesDeMundo(g) {
  const M = new Array(g.nodes.length).fill(null);
  const visita = (i, pai) => {
    const m = mul(pai, trs(g.nodes[i]));
    M[i] = m;
    for (const c of (g.nodes[i].children || [])) visita(c, m);
  };
  const cena = (g.scenes && g.scenes[g.scene || 0]) || { nodes: [] };
  for (const r of (cena.nodes || [])) visita(r, I4());
  for (let i = 0; i < M.length; i++) if (!M[i]) M[i] = trs(g.nodes[i]);
  return M;
}
/** Direto para o NORMALIZADO: mundo do glTF e depois Xn = −Xg · Zn = −Zg. */
function paraNorm(pos, m, groundY) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    out[i] = -(m[0] * x + m[4] * y + m[8] * z + m[12]);
    out[i + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) - groundY;
    out[i + 2] = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
  }
  return out;
}

/* ══════════════════════ triângulo × triângulo ══════════════════════
   Separação por 11 eixos (2 normais + 9 produtos de aresta). Exata para
   triângulos não degenerados, e é o teste que a caixa não sabe fazer. */
function sub(a, b, o) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; }
function cross(a, b, o) {
  o[0] = a[1] * b[2] - a[2] * b[1];
  o[1] = a[2] * b[0] - a[0] * b[2];
  o[2] = a[0] * b[1] - a[1] * b[0];
  return o;
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

const _e = [];
for (let i = 0; i < 16; i++) _e.push(new Float64Array(3));

/** Projeta os dois triângulos no eixo e diz se há separação. */
function separa(eixo, A, B) {
  const n2 = dot(eixo, eixo);
  if (n2 < 1e-16) return false;                    // eixo degenerado: não decide
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let i = 0; i < 3; i++) {
    const p = dot(eixo, A[i]);
    if (p < a0) a0 = p; if (p > a1) a1 = p;
    const q = dot(eixo, B[i]);
    if (q < b0) b0 = q; if (q > b1) b1 = q;
  }
  /* A folga é EM MILÍMETROS DE VERDADE: normaliza pelo comprimento do eixo,
     senão um eixo longo esconde uma penetração real e um curto inventa uma. */
  const tol = FOLGA * Math.sqrt(n2);
  return a1 < b0 + tol || b1 < a0 + tol;
}
function cruzam(A, B) {
  const u0 = sub(A[1], A[0], _e[0]), u1 = sub(A[2], A[1], _e[1]), u2 = sub(A[0], A[2], _e[2]);
  const v0 = sub(B[1], B[0], _e[3]), v1 = sub(B[2], B[1], _e[4]), v2 = sub(B[0], B[2], _e[5]);
  if (separa(cross(u0, u1, _e[6]), A, B)) return false;
  if (separa(cross(v0, v1, _e[7]), A, B)) return false;
  const us = [u0, u1, u2], vs = [v0, v1, v2];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (separa(cross(us[i], vs[j], _e[8]), A, B)) return false;
    }
  }
  return true;
}

/* ══════════════════════ leitura ══════════════════════ */

function caixa(pos, idx, faces) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const f of faces) {
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
    }
  }
  return b;
}

async function pecasDe(arquivo, groundY) {
  const D = await S.decoder();
  const { g, bin } = S.lerGlb(arquivo);
  const M = matrizesDeMundo(g);
  const pecas = [];
  for (let ni = 0; ni < g.nodes.length; ni++) {
    const no = g.nodes[ni];
    if (no.mesh === undefined) continue;
    for (const prim of g.meshes[no.mesh].primitives) {
      let d;
      try { d = S.decodifica(g, bin, prim, D); } catch (e) { continue; }
      const pos = paraNorm(d.attrs.POSITION.arr, M[ni], groundY);
      for (const faces of S.componentes(pos, d.idx)) {
        if (faces.length < MIN_TRI) continue;
        const b = caixa(pos, d.idx, faces);
        if (ZONA && ((b.z0 + b.z1) / 2 < ZONA[0] || (b.z0 + b.z1) / 2 > ZONA[1])) continue;
        pecas.push({
          nome: no.name || '?', pos, idx: d.idx, faces, b,
          dx: b.x1 - b.x0, dy: b.y1 - b.y0, dz: b.z1 - b.z0,
          zc: (b.z0 + b.z1) / 2, xc: (b.x0 + b.x1) / 2, yc: (b.y0 + b.y1) / 2,
        });
      }
    }
  }
  /* A ASSINATURA, com desempate por z — ver o cabeçalho. */
  const porAssinatura = new Map();
  for (const p of pecas) {
    p.assin = `${p.nome}|${p.faces.length}|${mm(p.dx)}x${mm(p.dy)}x${mm(p.dz)}`;
    if (!porAssinatura.has(p.assin)) porAssinatura.set(p.assin, []);
    porAssinatura.get(p.assin).push(p);
  }
  for (const lista of porAssinatura.values()) {
    lista.sort((a, b2) => b2.zc - a.zc);
    lista.forEach((p, i) => { p.chave = lista.length > 1 ? `${p.assin}#${i}` : p.assin; });
  }
  return pecas;
}

/* ══════════════════════ a varredura ══════════════════════ */

function sobrepoe(a, b) {
  return a.b.x0 < b.b.x1 - FOLGA && b.b.x0 < a.b.x1 - FOLGA
    && a.b.y0 < b.b.y1 - FOLGA && b.b.y0 < a.b.y1 - FOLGA
    && a.b.z0 < b.b.z1 - FOLGA && b.b.z0 < a.b.z1 - FOLGA;
}

/** Triângulos de `p` cuja caixa toca a janela — a única parte que interessa. */
function trisNaJanela(p, w) {
  const out = [];
  const { pos, idx } = p;
  for (const f of p.faces) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    if (x1 < w.x0 || x0 > w.x1 || y1 < w.y0 || y0 > w.y1 || z1 < w.z0 || z0 > w.z1) continue;
    out.push([x0, x1, y0, y1, z0, z1, f]);
  }
  return out;
}

function tri(p, f, dst) {
  for (let k = 0; k < 3; k++) {
    const v = p.idx[f * 3 + k];
    dst[k][0] = p.pos[v * 3]; dst[k][1] = p.pos[v * 3 + 1]; dst[k][2] = p.pos[v * 3 + 2];
  }
  return dst;
}

function varre(pecas, rotulo) {
  /* Grade uniforme para a fase larga: 0,25 m é maior que quase toda peça de
     chassi e pequeno o bastante para não pôr o caminhão inteiro numa célula. */
  const CEL = 0.25;
  const balde = new Map();
  const chaveCel = (i, j, k) => `${i},${j},${k}`;
  pecas.forEach((p, i) => {
    for (let a = Math.floor(p.b.x0 / CEL); a <= Math.floor(p.b.x1 / CEL); a++) {
      for (let b2 = Math.floor(p.b.y0 / CEL); b2 <= Math.floor(p.b.y1 / CEL); b2++) {
        for (let c = Math.floor(p.b.z0 / CEL); c <= Math.floor(p.b.z1 / CEL); c++) {
          const k = chaveCel(a, b2, c);
          if (!balde.has(k)) balde.set(k, []);
          balde.get(k).push(i);
        }
      }
    }
  });
  const vistos = new Set();
  const pares = [];
  let candidatos = 0;
  const A = [new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  const B = [new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  for (const lista of balde.values()) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = Math.min(lista[i], lista[j]), b2 = Math.max(lista[i], lista[j]);
        const k = a * 1e6 + b2;
        if (vistos.has(k)) continue;
        vistos.add(k);
        const pa = pecas[a], pb = pecas[b2];
        if (!sobrepoe(pa, pb)) continue;
        candidatos++;
        const w = {
          x0: Math.max(pa.b.x0, pb.b.x0), x1: Math.min(pa.b.x1, pb.b.x1),
          y0: Math.max(pa.b.y0, pb.b.y0), y1: Math.min(pa.b.y1, pb.b.y1),
          z0: Math.max(pa.b.z0, pb.b.z0), z1: Math.min(pa.b.z1, pb.b.z1),
        };
        const ta = trisNaJanela(pa, w), tb = trisNaJanela(pb, w);
        if (!ta.length || !tb.length) continue;
        let n = 0;
        fora:
        for (const t1 of ta) {
          for (const t2 of tb) {
            if (t1[1] < t2[0] || t2[1] < t1[0]) continue;
            if (t1[3] < t2[2] || t2[3] < t1[2]) continue;
            if (t1[5] < t2[4] || t2[5] < t1[4]) continue;
            if (cruzam(tri(pa, t1[6], A), tri(pb, t2[6], B))) {
              n++;
              if (n >= 8) break fora;               // já provou: não conta mais
            }
          }
        }
        if (n) {
          pares.push({
            a: pa, b: pb, n,
            vol: (w.x1 - w.x0) * (w.y1 - w.y0) * (w.z1 - w.z0),
            w,
          });
        }
      }
    }
  }
  console.error(`   [${rotulo}] ${pecas.length} peças · ${candidatos} pares de caixa · `
    + `${pares.length} com triângulo cruzado`);
  return pares;
}

/* ══════════════════════ o casamento com a BASE ══════════════════════
   ⚠️ A ASSINATURA SOZINHA FICA CEGA EM MALHA RECORTADA, e o §43.10 registra o
   número: no VW, `truck_p4` sai do `cut-chassi.cjs` REINDEXADO, então nenhum
   componente dele casa `nome | nº de triângulos | dx×dy×dz` com o do rip — e o
   diff `--base` cospe **542 falsos positivos**, o que na prática torna a sonda
   inutilizável naquele caminhão.

   A saída é a segunda régua: **o CENTROIDE**. Ela é o complemento exato da
   assinatura, porque as duas erram em situações opostas:

     · a ASSINATURA é invariante por TRANSLAÇÃO (de propósito: mover um tanque
       1 350 mm não pode transformá-lo numa peça nova) e sensível a RECORTE;
     · o CENTROIDE é invariante a recorte (tirar 3 % das faces de uma chapa não
       move o centro dela) e sensível a translação.

   Então: casa-se primeiro por assinatura; o que sobrar procura, DENTRO DO
   MESMO NÓ, o componente da base com o centroide mais próximo — guloso, do par
   mais próximo para o mais distante, cada base usada uma vez só. Uma peça que
   a cirurgia MOVEU de propósito não casa por nenhuma das duas e continua
   aparecendo como nova, que é o certo. */
/** Quanto o centroide pode ter andado. Um recorte de índice não move o centro
 *  de uma chapa mais que isto; uma peça deslocada de propósito move muito
 *  mais. */
const TOL_CENTRO = 0.060;
/** …e quanto a caixa pode ter mudado de tamanho, em fração. */
const TOL_TAMANHO = 0.30;

function casaComBase(alvo, base) {
  const chavesBase = new Set(base.map((p) => p.chave));
  const porNome = new Map();
  for (const p of base) {
    if (!porNome.has(p.nome)) porNome.set(p.nome, []);
    porNome.get(p.nome).push(p);
  }
  let exatas = 0, porCentro = 0, orfas = 0;
  const pendentes = [];
  for (const p of alvo) {
    if (chavesBase.has(p.chave)) { p.chaveBase = p.chave; exatas++; continue; }
    pendentes.push(p);
  }
  /* Guloso pelo par mais próximo: sem isso duas peças recortadas da mesma
     família podem casar com o mesmo componente da base. */
  const cand = [];
  for (const p of pendentes) {
    for (const q of (porNome.get(p.nome) || [])) {
      const d = Math.hypot(p.xc - q.xc, p.yc - q.yc, p.zc - q.zc);
      if (d > TOL_CENTRO) continue;
      const rel = (a, b) => Math.abs(a - b) / Math.max(a, b, 1e-4);
      if (rel(p.dx, q.dx) > TOL_TAMANHO || rel(p.dy, q.dy) > TOL_TAMANHO
        || rel(p.dz, q.dz) > TOL_TAMANHO) continue;
      cand.push({ d, p, q });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const usadas = new Set();
  for (const c of cand) {
    if (c.p.chaveBase || usadas.has(c.q.chave)) continue;
    c.p.chaveBase = c.q.chave;
    usadas.add(c.q.chave);
    porCentro++;
  }
  for (const p of pendentes) {
    if (!p.chaveBase) { p.chaveBase = p.chave; orfas++; }
  }
  console.error(`   [casamento] ${exatas} por assinatura · ${porCentro} por centroide `
    + `(≤ ${mm(TOL_CENTRO)} mm) · ${orfas} sem par na base`);
  return { exatas, porCentro, orfas };
}

(async () => {
  console.log(`### SOBREPOSIÇÃO — ${path.basename(SRC)}`);
  const pecas = await pecasDe(SRC, GROUND_Y);
  const pares = varre(pecas, 'alvo');

  let base = null;
  if (BASE) {
    const pb = await pecasDe(BASE, GROUND_Y);
    const parB = varre(pb, 'base');
    const casa = casaComBase(pecas, pb);
    base = new Set(parB.map((p) => [p.a.chave, p.b.chave].sort().join(' ×× ')));
    console.log(`### base ${path.basename(BASE)} — ${base.size} pares legítimos do rip`
      + ` · casamento: ${casa.exatas} por assinatura, ${casa.porCentro} por centroide,`
      + ` ${casa.orfas} sem par`);
  }

  const novos = pares.filter((p) => !base
    || !base.has([p.a.chaveBase || p.a.chave, p.b.chaveBase || p.b.chave].sort().join(' ×× ')));
  novos.sort((a, b) => b.vol - a.vol);
  console.log(`### ${novos.length} par(es) ${base ? 'NOVOS' : ''} — os ${Math.min(TOP, novos.length)} maiores:\n`);
  for (const p of novos.slice(0, TOP)) {
    const cx = ((p.w.x0 + p.w.x1) / 2), cz = ((p.w.z0 + p.w.z1) / 2);
    console.log(`  ${mm(p.w.x1 - p.w.x0).padStart(5)}×${mm(p.w.y1 - p.w.y0).padStart(5)}`
      + `×${mm(p.w.z1 - p.w.z0).padStart(5)} mm  em x ${mm(cx).padStart(6)} z ${mm(cz).padStart(6)}`
      + `  (${p.n >= 8 ? '8+' : p.n} tri)`);
    console.log(`      ${p.a.nome} ${p.a.faces.length} tri ${mm(p.a.dx)}×${mm(p.a.dy)}×${mm(p.a.dz)}`
      + ` @ z ${mm(p.a.zc)} x ${mm(p.a.xc)}`);
    console.log(`      ${p.b.nome} ${p.b.faces.length} tri ${mm(p.b.dx)}×${mm(p.b.dy)}×${mm(p.b.dz)}`
      + ` @ z ${mm(p.b.zc)} x ${mm(p.b.xc)}`);
  }
})();
