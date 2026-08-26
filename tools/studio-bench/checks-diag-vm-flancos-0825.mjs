/* SONDA — os dois flancos do VM 8x2 no 2º direcional, e o teste de esconder. */
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
const a = acha('volvo-vm-2015', '8x2r');
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
const olha = async (nome, lado) => {
  S.camera.position.copy(P(lado * 3.1, 1.00, eixo2 - 1.25));
  S.controls.target.copy(P(lado * 0.95, 0.72, eixo2 + 0.10));
  S.controls.update();
  for (let i = 0; i < 14; i++) await B.frame();
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
};
await olha('flanco-x-mais', +1);
await olha('flanco-x-menos', -1);
/* Quem some, some. */
const acharMalhas = (nome) => { const l = []; cab.traverse((o) => { if (o.isMesh && o.name === nome) l.push(o); }); return l; };
for (const nome of ['chs_base_0_p13', 'chs_base_0_p12', 'chs_base_0_p4', 'chs_base_0_p2']) {
  const ms = acharMalhas(nome);
  ms.forEach((m) => { m.visible = false; });
  await olha(`sem-${nome}-x-menos`, -1);
  await olha(`sem-${nome}-x-mais`, +1);
  ms.forEach((m) => { m.visible = true; });
}
return out;
