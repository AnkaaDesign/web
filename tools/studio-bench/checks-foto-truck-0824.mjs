/* FOTO do flanco do Scania 6x2 (truck) — o vão que o dono mandou fechar. */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
  return null;
};
for (const [modelo, chassi] of [['scania-p', '6x2r'], ['scania-p', '8x2r']]) {
  const a = acha(modelo, chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab;
  const bb = new THREE.Box3().setFromObject(cab);
  const c = bb.getCenter(new THREE.Vector3());
  S.camera.position.set(c.x + 16, 2.2, c.z - 1.0);
  S.controls.target.set(c.x, 1.4, c.z - 1.0);
  S.controls.update();
  for (let i = 0; i < 12; i++) await B.frame();
  out.push([`foto-${chassi}-flanco`, S.renderer.domElement.toDataURL('image/png')]);
}
return out;
