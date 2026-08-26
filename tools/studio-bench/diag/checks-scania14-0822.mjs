/* QUATORZE — o rebite SOZINHO, medido e fotografado.
   A pilha de q13 provou que a linha branca do trilho é feita pelos rebites
   gerados (esconder os dois filetes não muda nada; esconder os rebites limpa).
   Falta saber POR QUE uma fileira de calotas de 11 mm a cada 102 mm desenha
   uma FITA em vez de pontos.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania14-0822.mjs */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(2)}`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();

const rr = [];
t.traverse((o) => { if (o.isMesh && /^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) rr.push(o); });
for (const o of rr) {
  const g = o.geometry;
  g.computeBoundingBox();
  const b = g.boundingBox;
  const n = o.userData?.tsRivets || 0;
  out.push([`${o.name}`, `n ${n} · vértices ${g.getAttribute('position').count}`
    + ` · caixa x ${mm(b.max.x - b.min.x)} y ${mm(b.max.y - b.min.y)} z ${mm(b.max.z - b.min.z)} mm`
    + ` · x ${mm(b.min.x)}…${mm(b.max.x)}`]);
  /* O passo REAL entre calotas, lido da própria malha: os z distintos. */
  const pos = g.getAttribute('position');
  const zs = new Set();
  for (let i = 0; i < pos.count; i += 30) zs.add(Math.round(pos.getZ(i) * 1000));
  const l = [...zs].sort((a, b2) => a - b2);
  const d = [];
  for (let i = 1; i < Math.min(l.length, 9); i++) d.push(l[i] - l[i - 1]);
  out.push([`${o.name} · passo lido`, d.join(' ') + ' mm']);
}

/* E o TRILHO: onde está a face dele em x, contra onde a calota foi posta. */
const tr = [];
t.traverse((o) => {
  if (o.isMesh && /^estrutura-principal-9[0-5]_/.test(o.name || '')) tr.push(o);
});
for (const o of tr.slice(0, 2)) {
  const g = o.geometry;
  const pos = g.getAttribute('position');
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const v = new THREE.Vector3();
  const h = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    if (Math.abs(v.x) < 1.0) continue;
    const k = Math.round(Math.abs(v.x) * 2000) / 2;   // caixas de 0,5 mm
    h.set(k, (h.get(k) || 0) + 1);
  }
  out.push([`trilho ${o.name.slice(0, 24)} · |x| dos vértices`,
    [...h.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 6)
      .map(([k, q]) => `${k}mm:${q}`).join(' ')]);
}

/* ─── O REBITE SOZINHO, chapado, contra o céu ─── */
const guardaVis = [];
t.traverse((o) => { if (o.isMesh) { guardaVis.push([o, o.visible]); } });
scene.traverse((o) => { if (o.isMesh && !o.name.startsWith('TRAILER_TOPRAIL')) { /* nada */ } });
const bMundo = new THREE.Box3().setFromObject(t);
const c0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c0.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
for (const [o] of guardaVis) o.visible = /^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '');
const mats = rr.map((o) => o.material);
for (const o of rr) o.material = new THREE.MeshNormalMaterial();
tira('q14-so-rebite-normais', 0.9, -80, 4, V(0, 1.28, 0.2));
for (const o of rr) o.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
tira('q14-so-rebite-chapado', 0.9, -80, 4, V(0, 1.28, 0.2));
rr.forEach((o, i) => { o.material = mats[i]; });
for (const [o, v] of guardaVis) o.visible = v;

return out;
