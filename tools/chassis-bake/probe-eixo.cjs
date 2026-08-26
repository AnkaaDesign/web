/* SONDA DE EIXO — quais componentes conexos moram na faixa de um eixo.
   ===========================================================================
       node tools/chassis-bake/probe-eixo.cjs <glb> <groundY> <Zn> <banda> [minTri]
       node tools/chassis-bake/probe-eixo.cjs <glb> <groundY> --inventario

   É a sonda que precede qualquer corte de eixo, e ela existe por um motivo
   específico: **ela roda no MESMO referencial e no MESMO decodificador do
   cortador**. A primeira versão desta sonda foi escrita em Blender e mentiu —
   `transform_apply` só achata a matriz do OBJETO, e o importador glTF pendura
   tudo num nó de conversão Y-up→Z-up, então ler `v.co` cru depois dele dá
   coordenadas LOCAIS num arquivo e coordenadas de mundo em outro, conforme o
   rip tenha ou não pai. O resultado foi "o VW não tem nenhum componente na
   faixa do eixo auxiliar", que é falso. Aqui não há essa fronteira: o mesmo
   `glb-surgery.cjs` que corta é o que mede.

   O ESPAÇO é o NORMALIZADO de `mounts.json` (`forward = +Z`, pneu em `y = 0`),
   igual a `cut-scania.cjs`:

       Xn = −Xg · Yn = Yg − groundY · Zn = −Zg

   ⚠️⚠️ E ELA APLICA A MATRIZ DO NÓ. `cut-scania.cjs` pôde ignorá-la porque os
   SEIS nós que ele corta estão na identidade — mas isso é exceção, não regra.
   Medido: **189 dos 228 nós do Scania, 123 dos 139 do VM e 39 dos 55 do VW**
   carregam `translation`/`rotation`/`scale`. Ler posição crua num nó desses dá
   coordenadas de peça, não de caminhão: a roda do VM aparece numa caixa de
   ±0,3 m em torno da origem. A sonda compõe a matriz de mundo subindo a árvore
   e só então converte para o normalizado. */
const path = require('path');
const S = require('./glb-surgery.cjs');

const argv = process.argv.slice(2);
const SRC = argv[0];
const GROUND_Y = parseFloat(argv[1]);
const INVENTARIO = argv.includes('--inventario');
/* --limpo LARGURA [minTri] — varre o quadro procurando uma BAIA em que nenhum
   componente caiba inteiro. É a baia que se pode esticar sem rasgar nada: tudo
   que a cruza é prismático (longarina, chicote, tubulação) e acompanha. Mesmo
   critério de `tail.bays` em mounts.json, aplicado no MEIO do quadro. */
const iLimpo = argv.indexOf('--limpo');
const LIMPO = iLimpo >= 0 ? {
  larg: parseFloat(argv[iLimpo + 1]),
  minTri: argv[iLimpo + 2] ? parseInt(argv[iLimpo + 2], 10) : 20,
} : null;
/* --vazio X0 X1 Y0 Y1 [celula] — perfil de ocupação em z dentro de uma faixa
   lateral/vertical. É com ele que se acha ONDE cabe um eixo. */
const iVazio = argv.indexOf('--vazio');
const VAZIO = iVazio >= 0 ? {
  x0: parseFloat(argv[iVazio + 1]), x1: parseFloat(argv[iVazio + 2]),
  y0: parseFloat(argv[iVazio + 3]), y1: parseFloat(argv[iVazio + 4]),
  cel: argv[iVazio + 5] ? parseFloat(argv[iVazio + 5]) : 0.05,
} : null;
const ZEIXO = (INVENTARIO || VAZIO || LIMPO) ? 0 : parseFloat(argv[2]);
const BANDA = (INVENTARIO || VAZIO || LIMPO) ? 0 : parseFloat(argv[3]);
const MIN_TRI = INVENTARIO ? 0 : (argv[4] ? parseInt(argv[4], 10) : 8);

const mm = (v) => (v * 1000).toFixed(0);

/* ---------- matrizes de nó, compostas pela árvore ---------- */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {                        // coluna-maior, como o glTF
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
/** Matriz de MUNDO de cada nó, composta da raiz para baixo. */
function matrizesDeMundo(g) {
  const M = new Array(g.nodes.length).fill(null);
  const visita = (i, pai) => {
    const m = mul(pai, trs(g.nodes[i]));
    M[i] = m;
    for (const c of (g.nodes[i].children || [])) visita(c, m);
  };
  const raizes = (g.scenes && g.scenes[g.scene || 0] && g.scenes[g.scene || 0].nodes) || [];
  for (const r of raizes) visita(r, I4());
  for (let i = 0; i < M.length; i++) if (!M[i]) M[i] = trs(g.nodes[i]);   // órfão
  return M;
}
/** Aplica a matriz a um array de posições, devolvendo uma cópia em MUNDO. */
function emMundo(pos, m) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}

function caixaNorm(cru) {
  const b = {
    x0: -cru.x1, x1: -cru.x0,
    y0: cru.y0 - GROUND_Y, y1: cru.y1 - GROUND_Y,
    z0: -cru.z1, z1: -cru.z0,
  };
  b.dx = b.x1 - b.x0; b.dy = b.y1 - b.y0; b.dz = b.z1 - b.z0;
  b.xc = (b.x0 + b.x1) / 2; b.yc = (b.y0 + b.y1) / 2; b.zc = (b.z0 + b.z1) / 2;
  return b;
}

(async () => {
  const D = await S.decoder();
  const { g, bin } = S.lerGlb(SRC);
  S.verificaSuporte(g);

  const M = matrizesDeMundo(g);
  const tortos = g.nodes.filter((n) => n.translation || n.rotation || n.scale || n.matrix);
  console.log(`### ${path.basename(SRC)} · groundY ${GROUND_Y}`);
  console.log(`### ${g.nodes.length} nós · ${g.meshes.length} malhas`
    + (tortos.length ? ` · ⚠️ ${tortos.length} nó(s) NÃO estão na identidade: `
      + tortos.slice(0, 6).map((n) => n.name).join(', ') + ' — a matriz É aplicada'
      : ' · todos os nós na identidade ✓'));
  if (!INVENTARIO) console.log(`### eixo Zn ${ZEIXO} · banda ±${BANDA} · min ${MIN_TRI} tri`);

  let totDentro = 0, totCruza = 0, totTri = 0;
  const inventario = [];
  const ocup = new Map();
  const pecas = [];

  for (let i = 0; i < g.nodes.length; i++) {
    const no = g.nodes[i];
    if (no.mesh === undefined) continue;
    const prim = g.meshes[no.mesh].primitives[0];
    let d;
    try { d = S.decodifica(g, bin, prim, D); } catch (e) { console.log(`  ⚠️ ${no.name}: ${e.message}`); continue; }
    const pos = emMundo(d.attrs.POSITION.arr, M[i]);
    const nTri = d.idx.length / 3;

    if (LIMPO) {
      const comps = S.componentes(pos, d.idx);
      for (const faces of comps) {
        if (faces.length < LIMPO.minTri) continue;
        const b = caixaNorm(S.caixaDeFaces(pos, d.idx, faces));
        pecas.push({ z0: b.z0, z1: b.z1, n: faces.length, nome: no.name, b });
      }
      continue;
    }

    if (LIMPO) {
    /* Uma peça "longa" atravessa qualquer baia e é prismática por hipótese —
       longarina, chicote, tubo. Só as CURTAS impedem o esticamento. */
    const LONGA = 1.5;
    const curtas = pecas.filter((p) => (p.z1 - p.z0) < LONGA);
    const longas = pecas.length - curtas.length;
    curtas.sort((a, b) => a.z0 - b.z0);
    const z0 = Math.min(...pecas.map((p) => p.z0));
    const z1 = Math.max(...pecas.map((p) => p.z1));
    console.log(`### ${pecas.length} componentes (${longas} longas, ignoradas) · z ${mm(z0)}…${mm(z1)}`);
    console.log(`### procurando baia limpa de ${mm(LIMPO.larg)} mm`);
    const PASSO = 0.025;
    const achadas = [];
    for (let a = z0; a + LIMPO.larg <= z1; a += PASSO) {
      const b2 = a + LIMPO.larg;
      const dentro = curtas.filter((p) => p.z0 >= a && p.z1 <= b2);
      const cruza = curtas.filter((p) => p.z0 < b2 && p.z1 > a && !(p.z0 >= a && p.z1 <= b2));
      if (dentro.length === 0 && cruza.length === 0) {
        const u = achadas[achadas.length - 1];
        if (u && a <= u.b + PASSO * 1.01) u.b = b2; else achadas.push({ a, b: b2 });
      }
    }
    if (!achadas.length) {
      console.log('   NENHUMA baia totalmente limpa — as menos sujas:');
      const cand = [];
      for (let a = z0; a + LIMPO.larg <= z1; a += PASSO) {
        const b2 = a + LIMPO.larg;
        const sujo = curtas.filter((p) => p.z0 < b2 && p.z1 > a);
        cand.push({ a, b: b2, n: sujo.length, tri: sujo.reduce((s2, p) => s2 + p.n, 0) });
      }
      cand.sort((x, y) => x.tri - y.tri);
      for (const c of cand.slice(0, 8)) {
        console.log(`   z ${mm(c.a)}…${mm(c.b)}  ${c.n} peça(s) · ${c.tri} tri`);
      }
    } else {
      for (const f of achadas) console.log(`   BAIA LIMPA z ${mm(f.a)} … ${mm(f.b)}  (${mm(f.b - f.a)} mm de folga)`);
    }
  } else if (VAZIO) {
      for (let k = 0; k < pos.length; k += 3) {
        const xn = -pos[k], yn = pos[k + 1] - GROUND_Y, zn = -pos[k + 2];
        const ax = Math.abs(xn);
        if (ax < VAZIO.x0 || ax > VAZIO.x1 || yn < VAZIO.y0 || yn > VAZIO.y1) continue;
        const cel = Math.round(zn / VAZIO.cel);
        const e = ocup.get(cel) || new Map();
        e.set(no.name, (e.get(no.name) || 0) + 1);
        ocup.set(cel, e);
      }
      continue;
    }

    if (INVENTARIO) {
      const comps = S.componentes(pos, d.idx);
      const b = caixaNorm(S.caixaDeFaces(pos, d.idx, Array.from({ length: nTri }, (_, k) => k)));
      inventario.push({ nome: no.name, nv: pos.length / 3, nTri, comps: comps.length, b });
      continue;
    }

    /* Peneira barata pela caixa da malha inteira. */
    const bAll = caixaNorm(S.caixaDeFaces(pos, d.idx, Array.from({ length: nTri }, (_, k) => k)));
    if (bAll.z0 > ZEIXO + BANDA || bAll.z1 < ZEIXO - BANDA) continue;

    const comps = S.componentes(pos, d.idx);
    const dentro = [], cruza = [];
    for (const faces of comps) {
      if (faces.length < MIN_TRI) continue;
      const b = caixaNorm(S.caixaDeFaces(pos, d.idx, faces));
      if (Math.abs(b.zc - ZEIXO) > BANDA) continue;
      if (b.z0 >= ZEIXO - BANDA && b.z1 <= ZEIXO + BANDA) dentro.push({ n: faces.length, b });
      else cruza.push({ n: faces.length, b });
    }
    if (!dentro.length && !cruza.length) continue;
    dentro.sort((a, b) => b.n - a.n); cruza.sort((a, b) => b.n - a.n);
    const triD = dentro.reduce((s, c) => s + c.n, 0);
    const triC = cruza.reduce((s, c) => s + c.n, 0);
    totDentro += dentro.length; totCruza += cruza.length; totTri += triD;
    console.log(`-- ${no.name}  (${nTri} tri, ${comps.length} comp)  dentro ${dentro.length}`
      + ` (${triD} tri) · cruza ${cruza.length} (${triC} tri)`);
    for (const c of dentro.slice(0, 8)) {
      console.log(`   DENTRO ${String(c.n).padStart(7)} tri  ${mm(c.b.dx)}×${mm(c.b.dy)}×${mm(c.b.dz)} mm`
        + `  |x|=${mm(Math.abs(c.b.xc))}  y ${mm(c.b.y0)}…${mm(c.b.y1)}  z ${mm(c.b.z0)}…${mm(c.b.z1)}`);
    }
    if (dentro.length > 8) console.log(`   DENTRO +${dentro.length - 8} comp`);
    for (const c of cruza.slice(0, 8)) {
      console.log(`   CRUZA  ${String(c.n).padStart(7)} tri  ${mm(c.b.dx)}×${mm(c.b.dy)}×${mm(c.b.dz)} mm`
        + `  |x|=${mm(Math.abs(c.b.xc))}  y ${mm(c.b.y0)}…${mm(c.b.y1)}  z ${mm(c.b.z0)}…${mm(c.b.z1)}`);
    }
    if (cruza.length > 8) console.log(`   CRUZA  +${cruza.length - 8} comp`);
  }

  if (LIMPO) {
    /* Uma peça "longa" atravessa qualquer baia e é prismática por hipótese —
       longarina, chicote, tubo. Só as CURTAS impedem o esticamento. */
    const LONGA = 1.5;
    const curtas = pecas.filter((p) => (p.z1 - p.z0) < LONGA);
    const longas = pecas.length - curtas.length;
    curtas.sort((a, b) => a.z0 - b.z0);
    const z0 = Math.min(...pecas.map((p) => p.z0));
    const z1 = Math.max(...pecas.map((p) => p.z1));
    console.log(`### ${pecas.length} componentes (${longas} longas, ignoradas) · z ${mm(z0)}…${mm(z1)}`);
    console.log(`### procurando baia limpa de ${mm(LIMPO.larg)} mm`);
    const PASSO = 0.025;
    const achadas = [];
    for (let a = z0; a + LIMPO.larg <= z1; a += PASSO) {
      const b2 = a + LIMPO.larg;
      const dentro = curtas.filter((p) => p.z0 >= a && p.z1 <= b2);
      const cruza = curtas.filter((p) => p.z0 < b2 && p.z1 > a && !(p.z0 >= a && p.z1 <= b2));
      if (dentro.length === 0 && cruza.length === 0) {
        const u = achadas[achadas.length - 1];
        if (u && a <= u.b + PASSO * 1.01) u.b = b2; else achadas.push({ a, b: b2 });
      }
    }
    if (!achadas.length) {
      console.log('   NENHUMA baia totalmente limpa — as menos sujas:');
      const cand = [];
      for (let a = z0; a + LIMPO.larg <= z1; a += PASSO) {
        const b2 = a + LIMPO.larg;
        const sujo = curtas.filter((p) => p.z0 < b2 && p.z1 > a);
        cand.push({ a, b: b2, n: sujo.length, tri: sujo.reduce((s2, p) => s2 + p.n, 0) });
      }
      cand.sort((x, y) => x.tri - y.tri);
      for (const c of cand.slice(0, 8)) {
        console.log(`   z ${mm(c.a)}…${mm(c.b)}  ${c.n} peça(s) · ${c.tri} tri`);
      }
    } else {
      for (const f of achadas) console.log(`   BAIA LIMPA z ${mm(f.a)} … ${mm(f.b)}  (${mm(f.b - f.a)} mm de folga)`);
    }
  } else if (VAZIO) {
    console.log(`### VAZIO |x| ${VAZIO.x0}…${VAZIO.x1} · y ${VAZIO.y0}…${VAZIO.y1}`
      + ` · célula ${VAZIO.cel} m`);
    const ks = [...ocup.keys()].sort((a, b) => a - b);
    const faixas = [];
    for (const k of ks) {
      const z0 = k * VAZIO.cel - VAZIO.cel / 2, z1 = k * VAZIO.cel + VAZIO.cel / 2;
      const u = faixas[faixas.length - 1];
      if (u && z0 - u.z1 <= VAZIO.cel * 1.01) {
        u.z1 = z1;
        for (const [n, c] of ocup.get(k)) u.quem.set(n, (u.quem.get(n) || 0) + c);
      } else {
        faixas.push({ z0, z1, quem: new Map(ocup.get(k)) });
      }
    }
    let ant = null;
    for (const f of faixas) {
      if (ant !== null && f.z1 < ant) {
        console.log(`   ····· LIVRE ${mm(f.z1)} … ${mm(ant)}  (${mm(ant - f.z1)} mm)`);
      }
      const top = [...f.quem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      console.log(`   OCUPADO z ${mm(f.z0)} … ${mm(f.z1)}  (${mm(f.z1 - f.z0)} mm)  `
        + top.map(([n, c]) => `${n}:${c}`).join(' '));
      ant = f.z0;
    }
  } else if (INVENTARIO) {
    inventario.sort((a, b) => b.nTri - a.nTri);
    for (const r of inventario) {
      console.log(`${(r.nome || '?').padEnd(26)} ${String(r.nTri).padStart(7)} tri `
        + `${String(r.comps).padStart(5)} comp  x ${mm(r.b.x0)}…${mm(r.b.x1)} `
        + `y ${mm(r.b.y0)}…${mm(r.b.y1)}  z ${mm(r.b.z0)}…${mm(r.b.z1)}`);
    }
    console.log(`### ${inventario.length} malhas · ${inventario.reduce((s, r) => s + r.nTri, 0)} tri`);
  } else {
    console.log(`### TOTAL ${totDentro} comp DENTRO (${totTri} tri) · ${totCruza} comp cruzando`);
  }
})();
