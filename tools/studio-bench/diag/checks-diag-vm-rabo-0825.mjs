/* SONDA — o que ficou atrás da carroceria no VM 8x2, e a foto de perfil. */
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
const acha = (m, c) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      if (mo.id === m) for (const ch of (mo.chassis || [])) if (ch.id === c) return { mk, mo, c: ch };
  return null;
};
for (const [modelo, chassi] of [['volvo-vm-2015', '4x2r'], ['volvo-vm-2015', '6x2r'], ['volvo-vm-2015', '8x2r']]) {
  const a = acha(modelo, chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const v = new THREE.Vector3();
  const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  /* Quem tem vértice atrás do limite. */
  const W2Zn = new THREE.Matrix4().copy(N).multiply(cabInv);
  const cxTrl = new THREE.Box3();
  S.state.trailer.traverse((o) => {
    if (!o.isMesh || !visivel(o) || !o.geometry) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 31) cxTrl.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  const limite = cxTrl.min.z;
  const atras = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !visivel(o) || !o.geometry) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      if (v.z >= limite) continue;
      let e = atras.get(o.name);
      if (!e) { e = { n: 0, b: new THREE.Box3() }; atras.set(o.name, e); }
      e.n++; e.b.expandByPoint(v);
    }
  });
  const lista = [...atras.entries()].sort((p, q) => p[1].b.min.z - q[1].b.min.z);
  out.push([`${chassi} · carroceria acaba em ${mm(limite)}; atrás disso — ${lista.length} malha(s)`,
    lista.length ? '\n        ' + lista.slice(0, 14).map(([k, e]) => `${k} n=${e.n}`
      + ` x ${mm(e.b.min.x)}…${mm(e.b.max.x)} y ${mm(e.b.min.y)}…${mm(e.b.max.y)}`
      + ` z ${mm(e.b.min.z)}…${mm(e.b.max.z)}`).join('\n        ') : 'nada']);
  const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
  const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
  S.camera.position.copy(P(-13.5, 2.4, -3.6));
  S.controls.target.copy(P(0, 1.5, -3.6));
  S.controls.update();
  for (let i = 0; i < 16; i++) await B.frame();
  out.push([`perfil-${chassi}`, S.renderer.domElement.toDataURL('image/png')]);
  S.camera.position.copy(P(-5.0, 1.15, -4.2));
  S.controls.target.copy(P(-0.5, 0.70, -5.6));
  S.controls.update();
  for (let i = 0; i < 16; i++) await B.frame();
  out.push([`tandem-${chassi}`, S.renderer.domElement.toDataURL('image/png')]);
}
return out;
