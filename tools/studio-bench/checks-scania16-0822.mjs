/* DEZESSEIS — o filete, DEPOIS DE SOLTAR A FUSÃO.
   ===========================================================================
   `q13-1` escondeu as duas malhas `FILETE_` e a diferença deu ZERO pixel — e
   isso não quer dizer que o filete não apareça: quer dizer que quem o desenha
   é o BALDE, e a origem está invisível desde a fusão (§23). O teste honesto
   solta a fusão primeiro.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-scania16-0822.mjs */

const out = [];
const B = window.__bench;

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
const RENTE = [1.6, -78, 8, V(0, 1.25, 0.2)];

/* SOLTA A FUSÃO — sem isto o experimento mede o balde, não a peça. */
const soltas = S.merge?.release ? S.merge.release() : null;
out.push(['fusão solta', soltas === null ? 'SEM afordance' : String(soltas)]);
for (let i = 0; i < 10; i++) await B.frame();

const filetes = [], rebites = [];
t.traverse((o) => {
  if (!o.isMesh) return;
  if (/^FILETE_/.test(o.name || '')) filetes.push(o);
  if (/^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) rebites.push(o);
});
out.push(['filetes · rebites', `${filetes.length} · ${rebites.length}`
  + ` · visíveis ${filetes.filter((o) => o.visible).length}/${rebites.filter((o) => o.visible).length}`]);
for (const o of filetes) {
  const b = new THREE.Box3().setFromObject(o);
  out.push([`${o.name}`, `y ${(b.min.y * 1000).toFixed(0)}…${(b.max.y * 1000).toFixed(0)}`
    + ` · x ${(b.min.x * 1000).toFixed(0)}…${(b.max.x * 1000).toFixed(0)}`]);
}

const vf = filetes.map((o) => o.visible);
tira('q16-0-solto', ...RENTE);
for (const o of filetes) o.visible = false;
tira('q16-1-solto-sem-filete', ...RENTE);
filetes.forEach((o, i) => { o.visible = vf[i]; });

return out;
