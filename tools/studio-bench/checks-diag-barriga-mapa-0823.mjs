/* DIAGNÓSTICO 7 — O MAPA DA BARRIGA DO IMPLEMENTO: |x| × z.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-barriga-mapa-0823.mjs

   A pergunta é uma só e é do IMPLEMENTO: **a que altura, em cada |x| e em cada
   z, está a peça mais baixa do implemento acima da grade?** É ela que o braço
   encontra por baixo, e é nela que ele se aparafusa. Nada do caminhão entra. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '  —' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;

const XS = [[0.62, 0.72], [0.72, 0.82], [0.82, 0.92], [0.92, 1.02], [1.02, 1.12],
  [1.12, 1.22], [1.22, 1.28]];

function mapa(yPiso) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const grade = new Map();   /* `${ix}|${k}` -> {y, nome} */
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (v.y < yPiso || v.y > yPiso + 0.60) continue;
      const ix = XS.findIndex((f) => ax >= f[0] && ax < f[1]);
      if (ix < 0) continue;
      const k = Math.round(v.z / 0.50);
      const ch = `${ix}|${k}`;
      const u = grade.get(ch);
      if (!u || v.y < u.y) grade.set(ch, { y: v.y, nome: o.name });
    }
  });
  return grade;
}

const CFG = [['scania-p', /^8x2r$/, 'SOBRECHASSI'], ['scania-r-2016', /4x2/, 'SEMIRREBOQUE']];
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
  /* O piso da varredura é o TOPO DA BARRA da grade: 1 010 mm de solo. */
  const yPiso = 1.010 - raizY;
  const G = mapa(yPiso);
  out.push([`══ ${rot}`, `raiz em ${mm(raizY)} mm de solo · varre de y local ${mm(yPiso)} (solo 1010) para cima`]);
  const ks = [...new Set([...G.keys()].map((s) => +s.split('|')[1]))].sort((a, b) => a - b);
  const cab = XS.map((f) => `${mm(f[0])}-${mm(f[1])}`.padStart(10)).join('');
  out.push(['  z (mm) ╲ |x|', cab]);
  const linhas = ks.map((k) => {
    const cel = XS.map((_, ix) => {
      const u = G.get(`${ix}|${k}`);
      return (u ? mm(u.y + raizY) : '—').padStart(10);
    }).join('');
    return `${String(mm(k * 0.5)).padStart(6)} ${cel}`;
  });
  out.push(['  altura de SOLO da peça mais baixa do implemento', '\n        ' + linhas.join('\n        ')]);
  /* E quem são, na faixa que interessa. */
  const donos = new Map();
  for (const [ch, u] of G) {
    const ix = +ch.split('|')[0];
    if (ix < 3) continue;
    const s = donos.get(u.nome) || { n: 0, y0: Infinity, y1: -Infinity };
    s.n++; s.y0 = Math.min(s.y0, u.y + raizY); s.y1 = Math.max(s.y1, u.y + raizY);
    donos.set(u.nome, s);
  }
  out.push(['  quem faz a barriga além de |x| 920', '\n        '
    + [...donos].sort((p, q) => q[1].n - p[1].n).slice(0, 10)
      .map(([n, s]) => `${n.padEnd(44)} ${String(s.n).padStart(4)} células · y solo ${mm(s.y0)}…${mm(s.y1)}`).join('\n        ')]);
}
return out;
