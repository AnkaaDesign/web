/* SONDA — o arco do 2º direcional de perto: VM 8x2 contra o doador Scania 8x2. */
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
for (const [modelo, chassi] of [['volvo-vm-2015', '8x2r'], ['scania-p', '8x2r']]) {
  const a = acha(modelo, chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
  const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
  const eixo2 = Math.min(...mount.axles.steerZ);
  for (const lado of [+1, -1]) {
    S.camera.position.copy(P(lado * 2.0, 1.15, eixo2 - 0.10));
    S.controls.target.copy(P(lado * 1.0, 0.95, eixo2 + 0.25));
    S.controls.update();
    for (let i = 0; i < 14; i++) await B.frame();
    out.push([`arco-${modelo}-${lado > 0 ? 'mais' : 'menos'}`, S.renderer.domElement.toDataURL('image/png')]);
  }
}
return out;
