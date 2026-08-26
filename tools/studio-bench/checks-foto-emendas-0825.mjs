/* FOTO do flanco — o quadro do relato de 2026-08-25 ("2 fileiras de rebites
   perto") e o mesmo quadro no sobrechassi.
   node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-foto-emendas-0825.mjs */
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
for (let i = 0; i < 20; i++) await B.frame();
const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

function tira(nome, alvo, dist, azDeg, elevDeg) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  controls.target.copy(alvo);
  camera.position.set(
    alvo.x + Math.sin(a) * Math.cos(e) * dist,
    alvo.y + Math.sin(e) * dist,
    alvo.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
function alvoDoFlanco() {
  const t = S.state.trailer; t.updateWorldMatrix(true, true);
  let p = null;
  t.traverse((o) => { if (o.isMesh && o.name === 'SIDE_L') p = o; });
  const b = new THREE.Box3().setFromObject(p || t);
  return b.getCenter(new THREE.Vector3());
}
tira('flanco-semi', alvoDoFlanco(), 16, -60, 12);
tira('flanco-semi-perto', alvoDoFlanco(), 9, -75, 6);

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) { if (c.file && c.available !== false) alvos.push({ mk, mo, c }); }
  }
}
const vm = alvos.find((a) => /vm_2015_6x2r/i.test(a.c.file));
if (vm) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  tira('flanco-sobre', alvoDoFlanco(), 11, -60, 10);
  tira('flanco-sobre-perto', alvoDoFlanco(), 6, -78, 5);
}
return out;
