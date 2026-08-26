/* DIAGNÓSTICO — a ferragem da grade lateral no SOBRECHASSI contra a do SEMIRREBOQUE.
   ===========================================================================
   *"o suporte dela no implemento de sobrechassi não se parece nada com o do
   semirreboque, ela não está sendo presa realmente no implemento"* — Kennedy,
   2026-08-23, com duas capturas de baixo.

   Não conserta nada: conta e mede o que existe embaixo de `TS_PROTECAO_LATERAL`
   (braço, mão-francesa, grampo, suporte, montante), diz o que o semirreboque
   tem no mesmo lugar, e fotografa os dois do mesmo ângulo. */
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
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

/* ── as linhas que `attachSideGuard()` imprime ── */
const relatos = [];
const orig = console.info;
console.info = (...a) => { try { relatos.push(a.map(String).join(' ')); } catch { /* nada */ } orig.apply(console, a); };

function caixas(raizNome, re) {
  const t = S.state.trailer;
  if (!t) return null;
  const raiz = t.getObjectByName(raizNome) || t;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const porPapel = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const nome = (o.name || '').replace(/^FUSAO__/, '');
    const m = re.exec(nome);
    if (!m) return;
    const papel = m[1];
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    let b = porPapel.get(papel);
    if (!b) { b = { n: 0, inst: 0, x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] }; porPapel.set(papel, b); }
    b.n++;
    b.inst += o.isInstancedMesh ? o.count : 1;
    const passo = pos.count > 20000 ? 7 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      b.x[0] = Math.min(b.x[0], ax); b.x[1] = Math.max(b.x[1], ax);
      b.y[0] = Math.min(b.y[0], v.y); b.y[1] = Math.max(b.y[1], v.y);
      b.z[0] = Math.min(b.z[0], v.z); b.z[1] = Math.max(b.z[1], v.z);
    }
  });
  return porPapel;
}
const PAPEIS = /^(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/;
const conta = (m) => m ? [...m].map(([k, b]) =>
  `${k}: ${b.n} malha(s)/${b.inst} inst · |x| ${mm(b.x[0])}…${mm(b.x[1])}`
  + ` y ${mm(b.y[0])}…${mm(b.y[1])} z ${mm(b.z[0])}…${mm(b.z[1])}`).join('\n        ') : '—';

const foto = (nome, alvo, olho) => {
  controls.target.copy(new THREE.Vector3(...alvo));
  camera.position.set(...olho);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
};

/* ══ 1 · O SEMIRREBOQUE, que é a referência ══ */
{
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
    if (!c && /4x2|6x2/.test(ch.id) && /scania-r-2016|volvo-fh/.test(md.id)) { mk = m; mo = md; c = ch; }
  if (c) {
    await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
    await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
    await B.until(() => !!S.state.trailer, 300000);
    for (let i = 0; i < 25; i++) await B.frame();
    out.push([`semirreboque (${mo.id}/${c.id}) · implemento`, S.state.trailerDef?.file || '?']);
    out.push(['semirreboque · papéis na árvore do implemento', '\n        ' + conta(caixas(null, PAPEIS))]);
    const t = S.state.trailer;
    const bb = new THREE.Box3().setFromObject(t);
    const zc = (bb.min.z + bb.max.z) / 2;
    foto('grade-semi-1-baixo', [0, 0.7, zc], [3.0, 0.15, zc + 2.6]);
    foto('grade-semi-2-perto', [0, 0.8, zc], [2.4, 0.9, zc + 1.2]);
  } else out.push(['★ acha um cavalo com semirreboque', false]);
}

/* ══ 2 · OS TRÊS RÍGIDOS ══ */
for (const [modelId, chassisId, tag] of [['scania-p', '8x2r', 'scania'], ['volvo-vm-2015', '8x2r', 'vm'], ['vw-constellation', '8x2-tl', 'vw']]) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
    if (md.id === modelId && ch.id === chassisId) { mk = m; mo = md; c = ch; }
  if (!c) { out.push([`★ acha ${modelId}/${chassisId}`, false]); continue; }
  relatos.length = 0;
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  out.push([`${tag} · papéis sob TS_PROTECAO_LATERAL`, '\n        ' + conta(caixas('TS_PROTECAO_LATERAL', PAPEIS))]);
  const grade = relatos.filter((l) => /prote|ferragem|baias|obstáculos/i.test(l));
  out.push([`${tag} · relato do motor`, '\n        ' + (grade.join('\n        ') || '(nada no console)')]);
  const t = S.state.trailer;
  const bb = new THREE.Box3().setFromObject(t);
  const zc = (bb.min.z + bb.max.z) / 2;
  foto(`grade-${tag}-1-baixo`, [0, 0.7, zc], [3.0, 0.15, zc + 2.6]);
  foto(`grade-${tag}-2-perto`, [0, 0.8, zc], [2.4, 0.9, zc + 1.2]);
  foto(`grade-${tag}-3-por-dentro`, [0, 0.8, zc], [1.6, 0.35, zc + 3.4]);
}
console.info = orig;
return out;
