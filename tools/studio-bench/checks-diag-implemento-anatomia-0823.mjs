/* DIAGNÓSTICO 4 — A ANATOMIA DE BAIXO DOS DOIS IMPLEMENTOS, sem o caminhão.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-implemento-anatomia-0823.mjs

   *"analise os implementos individualmente, sem considerar o chassi do truck"*
   — Kennedy, 2026-08-23.

   A grade é peça do IMPLEMENTO, e o braço que a prende é peça do implemento
   também: no semirreboque ele bolta na longarina DELE. Então a pergunta certa
   não é "o que o caminhão põe no caminho" — é **"o que este implemento oferece
   para aparafusar, e onde"**. Tudo em LOCAL do implemento (y = 0 na raiz dele),
   que é o referencial em que a peça é desenhada e montada. */
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

/** Tudo do implemento (menos a grade) abaixo de `yTeto` local, por MALHA. */
function anatomia(yTeto, xMax) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const porNome = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      if (v.y > yTeto) continue;
      const ax = Math.abs(v.x);
      if (ax > xMax) continue;
      let s = porNome.get(o.name);
      if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, zs: new Set() }; porNome.set(o.name, s); }
      s.n++;
      s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
      s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
      s.zs.add(Math.round(v.z / 0.25));
    }
  });
  return porNome;
}

/** O PERFIL EM |x| do implemento numa faixa de altura: quanto material existe
 *  em cada célula de 50 mm de |x|. É o que responde "até onde o implemento vai
 *  para fora, nesta altura". */
function perfilX(y0, y1) {
  const t = S.state.trailer;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const cel = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      if (v.y < y0 || v.y > y1) continue;
      const k = Math.round(Math.abs(v.x) / 0.05);
      cel.set(k, (cel.get(k) || 0) + 1);
    }
  });
  return [...cel].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${mm(k * 0.05)}:${n}`).join(' ');
}

/** As TRAVESSAS: por célula de z, o |x| máximo que o implemento alcança na
 *  faixa de altura pedida. Uma travessa aparece como um pico periódico. */
function travessas(y0, y1) {
  const t = S.state.trailer;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const cel = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      if (v.y < y0 || v.y > y1) continue;
      const k = Math.round(v.z / 0.10);
      const ax = Math.abs(v.x);
      const u = cel.get(k);
      if (u === undefined || ax > u) cel.set(k, ax);
    }
  });
  return [...cel].sort((a, b) => a[0] - b[0]).map(([k, x]) => `${mm(k * 0.1)}:${mm(x)}`).join(' ');
}

const CFG = [
  ['scania-r-2016', /4x2/, 'SEMIRREBOQUE (a referência)'],
  ['scania-p', /^8x2r$/, 'SOBRECHASSI sobre o Scania P'],
  ['vw-constellation', /^8x2-tl$/, 'SOBRECHASSI sobre o VW'],
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
  out.push([`══ ${rot}`, `${S.state.implement?.id} · ${S.state.implement?.file || ''}`]);

  /* Onde está o CHÃO no referencial do implemento? A grade do sobrechassi tem
     a barra em 510 mm de solo; no semirreboque não há grade montada, então
     serve a caixa do implemento. */
  const bb = new THREE.Box3().setFromObject(S.state.trailer);
  const t = S.state.trailer;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const cantoBaixo = new THREE.Vector3(0, 0, 0).applyMatrix4(t.matrixWorld);
  out.push(['  raiz do implemento em MUNDO (y = solo real)',
    `y ${mm(cantoBaixo.y)} mm · caixa local y ${mm(bb.min.y - cantoBaixo.y)}…${mm(bb.max.y - cantoBaixo.y)}`]);
  void inv;

  const A = anatomia(0.30, 1.40);
  out.push(['  anatomia abaixo de y local +300 mm (por malha, top 16)', '\n        '
    + [...A].sort((p, q) => q[1].n - p[1].n).slice(0, 16)
      .map(([n, s]) => `${n.padEnd(46)} ${String(s.n).padStart(6)} pts · |x| ${String(mm(s.x0)).padStart(5)}…${String(mm(s.x1)).padStart(5)}`
        + ` y ${String(mm(s.y0)).padStart(6)}…${String(mm(s.y1)).padStart(6)} z ${String(mm(s.z0)).padStart(6)}…${String(mm(s.z1)).padStart(6)}`
        + ` · ${s.zs.size} células de z`).join('\n        ')]);
  for (const [y0, y1] of [[-0.10, 0.02], [0.02, 0.10], [0.10, 0.20], [-0.30, -0.10]]) {
    out.push([`  perfil em |x| na faixa y ${mm(y0)}…${mm(y1)} (célula de 50 mm)`,
      '\n        ' + perfilX(y0, y1)]);
  }
  out.push(['  travessas — |x| máximo por célula de z, y local −60…+60',
    '\n        ' + travessas(-0.06, 0.06)]);
  out.push(['  …e na faixa y +60…+200 (onde mora o assoalho)',
    '\n        ' + travessas(0.06, 0.20)]);
}
return out;
