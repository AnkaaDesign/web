/* FOTOS — o conjunto do estepe e os reservatórios de ar, nos dois que andam. */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const acha = (m, c) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      if (mo.id === m) for (const ch of (mo.chassis || [])) if (ch.id === c) return { mk, mo, c: ch };
  return null;
};
for (const chassi of ['6x2r', '8x2r', '4x2r']) {
  const a = acha('scania-p', chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const foto = async (nome, c, dist, alt) => {
    S.camera.position.set(c.x + dist, c.y + alt, c.z + 0.9);
    S.controls.target.set(c.x, c.y + 0.05, c.z);
    S.controls.update();
    for (let i = 0; i < 12; i++) await B.frame();
    out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
  };
  const spare = S.state.cab.getObjectByName('VM_WHEEL_SPARE');
  if (spare) await foto(`estepe-${chassi}`, new THREE.Box3().setFromObject(spare).getCenter(new THREE.Vector3()), 5.2, 0.75);
  /* Os reservatórios + o tanque, num quadro só: o alvo é o meio entre eles. */
  const b = new THREE.Box3();
  S.state.cab.traverse((n) => {
    if (!n.isMesh || !n.visible) return;
    if ((n.name || '').startsWith('TANK_L') || (n.name || '').startsWith('TANK_R')) b.expandByObject(n);
  });
  if (!b.isEmpty()) await foto(`tanque-reserva-${chassi}`, b.getCenter(new THREE.Vector3()), 7.0, 1.0);
}
return out;
