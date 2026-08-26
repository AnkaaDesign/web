/* DIAGNÓSTICO 6 — AS TRAVESSAS DO SOBRECHASSI, uma a uma.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-outriggers-0823.mjs

   O diagnóstico 5 mostrou que, na janela do braço (solo 1 010…1 410 mm), o
   sobrechassi está VAZIO além de |x| 600 — enquanto o semirreboque tem
   estrutura em 47 células de z. Mas logo abaixo dessa janela o sobrechassi tem
   `FUSAO__metal-preto__b2`, |x| 374…1 305 e solo 975…1 136: uma peça que sai da
   longarina e vai até a largura do baú. Se ela for um conjunto de TRAVESSAS
   discretas, é NELAS que a grade se prende — e a régua deixa de ter qualquer
   relação com o chassi do caminhão. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;

function bandasDe(nomeRe, xMin, xMax, yLo, yHi, cel = 0.05) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const mapa = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (!nomeRe.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (ax < xMin || ax > xMax || v.y < yLo || v.y > yHi) continue;
      const k = Math.round(v.z / cel);
      let s = mapa.get(k);
      if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; mapa.set(k, s); }
      s.n++; s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
    }
  });
  const pares = [...mapa].sort((a, b) => a[0] - b[0]);
  const bs = [];
  for (const [k, s] of pares) {
    const z0 = k * cel - cel / 2, z1 = k * cel + cel / 2;
    const u = bs[bs.length - 1];
    if (u && z0 - u.z1 <= cel * 1.5) {
      u.z1 = z1; u.n += s.n; u.x0 = Math.min(u.x0, s.x0); u.x1 = Math.max(u.x1, s.x1);
      u.y0 = Math.min(u.y0, s.y0); u.y1 = Math.max(u.y1, s.y1);
    } else bs.push({ z0, z1, n: s.n, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 });
  }
  return bs;
}

let mk = null, mo = null, c = null;
for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
  if (!c && md.id === 'scania-p' && ch.id === '8x2r') { mk = m; mo = md; c = ch; }
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 35; i++) await B.frame();
const raizY = new THREE.Vector3().setFromMatrixPosition(S.state.trailer.matrixWorld).y;
out.push(['sobrechassi · raiz em y de solo', `${mm(raizY)} mm`]);
const solo = (y) => y + raizY;

for (const [rot, re] of [
  ['FUSAO__metal-preto__b2', /^FUSAO__metal-preto__b2$/],
  ['FUSAO__metal-preto__b3', /^FUSAO__metal-preto__b3$/],
  ['FUSAO__metal-estrutura-principal-padrao__b3', /^FUSAO__metal-estrutura-principal-padrao__b3$/],
  ['FUSAO__metal-galvanizado-mantido__b3', /^FUSAO__metal-galvanizado-mantido__b3$/],
]) {
  /* Só o que está FORA da longarina — |x| 700…1 320 — e abaixo do assoalho. */
  const bs = bandasDe(re, 0.70, 1.32, -0.40, 0.25);
  out.push([`${rot} · bandas em z além de |x| 700, y local −400…+250`, '\n        '
    + (bs.length ? bs.map((s) => `z ${String(mm(s.z0)).padStart(6)}…${String(mm(s.z1)).padStart(6)}`
      + ` (${String(mm(s.z1 - s.z0)).padStart(4)} mm) · |x| ${mm(s.x0)}…${mm(s.x1)}`
      + ` · y solo ${mm(solo(s.y0))}…${mm(solo(s.y1))} · ${s.n} pts`).join('\n        ') : '(nada)')]);
}
/* E a peça inteira, sem recorte em x, para ver de onde ela sai. */
for (const [rot, re] of [['FUSAO__metal-preto__b2', /^FUSAO__metal-preto__b2$/]]) {
  const bs = bandasDe(re, 0.0, 1.40, -0.40, 0.25);
  out.push([`${rot} · a peça inteira (|x| 0…1400)`, '\n        '
    + bs.map((s) => `z ${String(mm(s.z0)).padStart(6)}…${String(mm(s.z1)).padStart(6)}`
      + ` (${String(mm(s.z1 - s.z0)).padStart(4)} mm) · |x| ${mm(s.x0)}…${mm(s.x1)}`
      + ` · y solo ${mm(solo(s.y0))}…${mm(solo(s.y1))} · ${s.n} pts`).join('\n        ')]);
}
return out;
