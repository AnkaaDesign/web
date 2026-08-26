/* DIAGNÓSTICO 5 — AS TRAVESSAS DO SOBRECHASSI, e o que o semirreboque tem no
   mesmo papel.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-travessas-0823.mjs

   O diagnóstico 4 achou, no sobrechassi, `FUSAO__metal-preto__b2` em
   |x| 374…1 305 e y local 6…167 — ou seja uma peça que vai DA LONGARINA ATÉ A
   LARGURA DO BAÚ, na altura em que um braço de grade se aparafusa. Se ela for
   um conjunto de TRAVESSAS discretas, é nela que a grade se prende, e a régua
   deixa de ser o chassi do caminhão.

   Este diagnóstico mede a malha isolada, célula de z a célula de z. */
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

/** Perfil de uma malha: por célula de z, o |x| mínimo/máximo e o y, restrito a
 *  |x| ≥ `xMin`. Um conjunto de travessas aparece como bandas periódicas. */
function perfil(re, xMin, yLo, yHi, cel = 0.05) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const mapa = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (!re.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (ax < xMin || v.y < yLo || v.y > yHi) continue;
      const k = Math.round(v.z / cel);
      let s = mapa.get(k);
      if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; mapa.set(k, s); }
      s.n++; s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
    }
  });
  return [...mapa].sort((a, b) => a[0] - b[0]);
}

/** Agrupa células vizinhas em BANDAS — é isso que vira "travessa em z=…". */
function bandas(pares, cel) {
  const out2 = [];
  for (const [k, s] of pares) {
    const z0 = k * cel - cel / 2, z1 = k * cel + cel / 2;
    const u = out2[out2.length - 1];
    if (u && z0 - u.z1 <= cel * 1.5) {
      u.z1 = z1; u.n += s.n;
      u.x0 = Math.min(u.x0, s.x0); u.x1 = Math.max(u.x1, s.x1);
      u.y0 = Math.min(u.y0, s.y0); u.y1 = Math.max(u.y1, s.y1);
    } else out2.push({ z0, z1, n: s.n, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 });
  }
  return out2;
}

const CFG = [
  ['scania-p', /^8x2r$/, 'SOBRECHASSI (Scania P 8x2)', 969],
  ['scania-r-2016', /4x2/, 'SEMIRREBOQUE', -1],
];
for (const [modelId, chRe, rot] of CFG) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
    if (!c && md.id === modelId && chRe.test(ch.id)) { mk = m; mo = md; c = ch; }
  if (!c) { out.push([`★ acha ${modelId}`, false]); continue; }
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 35; i++) await B.frame();
  const raizY = new THREE.Vector3().setFromMatrixPosition(S.state.trailer.matrixWorld).y;
  out.push([`══ ${rot}`, `${S.state.implement?.id} · raiz em y ${mm(raizY)} mm de solo`]);

  /* A janela: do topo da barra da grade (y 1 010 de SOLO) para cima, até o
     assoalho. Em local isso é 1,010 − raizY. */
  const yLo = 1.010 - raizY / 1000;
  const yHi = yLo + 0.40;
  out.push(['  janela medida (local)', `y ${mm(yLo)}…${mm(yHi)} — de solo 1010 a 1410`]);

  for (const [nome, re, xMin] of [
    ['TUDO do implemento além de |x| 900', /./, 0.90],
    ['TUDO do implemento além de |x| 600', /./, 0.60],
  ]) {
    const b = bandas(perfil(re, xMin, yLo, yHi), 0.05);
    out.push([`  ${nome} — bandas em z`, '\n        '
      + (b.length ? b.map((s) => `z ${String(mm(s.z0)).padStart(6)}…${String(mm(s.z1)).padStart(6)}`
        + ` (${mm(s.z1 - s.z0)} mm) · |x| ${mm(s.x0)}…${mm(s.x1)} · y ${mm(s.y0)}…${mm(s.y1)}`
        + ` (solo ${mm(s.y0 + raizY / 1000)}…${mm(s.y1 + raizY / 1000)}) · ${s.n} pts`).join('\n        ')
        : '(nada)')]);
  }
  /* E QUEM são essas peças. */
  {
    const t = S.state.trailer;
    const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
    const L = new THREE.Matrix4(); const v = new THREE.Vector3();
    const porNome = new Map();
    t.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
      for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
      L.copy(inv).multiply(o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
        const ax = Math.abs(v.x);
        if (ax < 0.60 || v.y < yLo || v.y > yHi) continue;
        let s = porNome.get(o.name);
        if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z: new Set() }; porNome.set(o.name, s); }
        s.n++; s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
        s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
        s.z.add(Math.round(v.z / 0.25));
      }
    });
    out.push(['  quem são elas', '\n        '
      + [...porNome].sort((p, q) => q[1].n - p[1].n).slice(0, 12)
        .map(([n, s]) => `${n.padEnd(44)} ${String(s.n).padStart(6)} pts · |x| ${mm(s.x0)}…${mm(s.x1)}`
          + ` · y solo ${mm(s.y0 + raizY / 1000)}…${mm(s.y1 + raizY / 1000)} · ${s.z.size} células de z`).join('\n        ')]);
  }
}
return out;
