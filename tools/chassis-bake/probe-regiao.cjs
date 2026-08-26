/* SONDA DE REGIÃO — o que existe dentro de uma caixa, componente por componente.
   ===========================================================================
       node tools/chassis-bake/probe-regiao.cjs <glb> \
            --caixa x0 x1 y0 y1 z0 z1 [--min-tri N] [--top N] [--norm groundY]

   Irmã pobre de `probe-sobreposicao.cjs`: ela não cruza nada, só DIZ O QUE HÁ.
   Serve para responder "o que segura esta peça?" sem abrir o Blender — e foi
   escrita porque a pergunta "de onde sai o suporte da grade no semirreboque"
   não tem resposta em nenhum meta.json.

   O espaço é o CRU do glTF por padrão. `--norm groundY` liga a conversão para
   o normalizado de `mounts.json` (Xn = −Xg · Yn = Yg − groundY · Zn = −Zg),
   que é o que os rips de caminhão usam.
*/
const path = require('path');
const S = require('./glb-surgery.cjs');

const argv = process.argv.slice(2);
const SRC = argv[0];
const num = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? parseFloat(argv[i + 1]) : d; };
const iC = argv.indexOf('--caixa');
const CAIXA = iC >= 0 ? argv.slice(iC + 1, iC + 7).map(Number) : null;
const MIN_TRI = num('min-tri', 2);
const TOP = num('top', 200);
const iN = argv.indexOf('--norm');
const NORM = iN >= 0 ? parseFloat(argv[iN + 1]) : null;
const ESPELHA = argv.includes('--abs-x');

const mm = (v) => (v * 1000).toFixed(0);

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
function leva(pos, m) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (NORM === null) { out[i] = wx; out[i + 1] = wy; out[i + 2] = wz; }
    else { out[i] = -wx; out[i + 1] = wy - NORM; out[i + 2] = -wz; }
  }
  return out;
}
function caixaDe(pos, idx, faces) {
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

(async () => {
  const D = await S.decoder();
  const { g, bin } = S.lerGlb(SRC);
  const M = matrizesDeMundo(g);
  const achados = [];
  for (let ni = 0; ni < g.nodes.length; ni++) {
    const no = g.nodes[ni];
    if (no.mesh === undefined) continue;
    for (const prim of g.meshes[no.mesh].primitives) {
      let d;
      try { d = S.decodifica(g, bin, prim, D); } catch (e) { continue; }
      const pos = leva(d.attrs.POSITION.arr, M[ni]);
      const matNome = prim.material !== undefined
        ? (g.materials[prim.material].name || `mat${prim.material}`) : '—';
      for (const faces of S.componentes(pos, d.idx)) {
        if (faces.length < MIN_TRI) continue;
        const b = caixaDe(pos, d.idx, faces);
        if (CAIXA) {
          const [X0, X1, Y0, Y1, Z0, Z1] = CAIXA;
          const bx0 = ESPELHA ? Math.min(Math.abs(b.x0), Math.abs(b.x1)) : b.x0;
          const bx1 = ESPELHA ? Math.max(Math.abs(b.x0), Math.abs(b.x1)) : b.x1;
          if (bx1 < X0 || bx0 > X1) continue;
          if (b.y1 < Y0 || b.y0 > Y1) continue;
          if (b.z1 < Z0 || b.z0 > Z1) continue;
        }
        achados.push({ no: no.name || `n${ni}`, mat: matNome, n: faces.length, b });
      }
    }
  }
  achados.sort((a, b) => b.n - a.n);
  console.log(`${SRC}\n${achados.length} componente(s) na caixa`
    + (CAIXA ? ` [${CAIXA.map((v) => mm(v)).join(' ')}]` : ' (tudo)')
    + (NORM !== null ? ` · normalizado com groundY ${NORM}` : ' · espaço CRU'));
  for (const a of achados.slice(0, TOP)) {
    console.log(`  ${a.n.toString().padStart(7)} tri  ${a.no.padEnd(26)} ${a.mat.padEnd(28)}`
      + ` x ${mm(a.b.x0).padStart(6)}…${mm(a.b.x1).padStart(6)}`
      + `  y ${mm(a.b.y0).padStart(6)}…${mm(a.b.y1).padStart(6)}`
      + `  z ${mm(a.b.z0).padStart(7)}…${mm(a.b.z1).padStart(7)}`
      + `  (${mm(a.b.x1 - a.b.x0)}×${mm(a.b.y1 - a.b.y0)}×${mm(a.b.z1 - a.b.z0)})`);
  }
  if (achados.length > TOP) console.log(`  … e mais ${achados.length - TOP} (use --top)`);
})();
