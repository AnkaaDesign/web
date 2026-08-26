/* SONDA — o plano de corte do rabo e quem o conjunto traseiro empurrou para lá. */
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
for (const [modelo, chassi] of [['volvo-vm-2015', '8x2r'], ['scania-p', '8x2r']]) {
  const a = acha(modelo, chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab, mount = S.state.cabMount;
  const t = mount.tail;
  out.push([`${modelo} · tail`, t ? `tailEndZ ${mm(t.tailEndZ)} · bays ${t.bays.map((b) => `${mm(b.z)}`).join(' · ')}`
    + ` · corteFrente ${mm(t.bays[t.bays.length - 1].z)}` : 'sem tail']);
  if (!t) continue;
  const corte = t.bays[t.bays.length - 1].z;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const v = new THREE.Vector3();
  const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  /* Malhas com base de rabo memorizada (foram esticadas) e o quanto delas. */
  const lista = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const memo = o.userData?.tsTailBase;
    if (!memo || !memo.idx || !memo.idx.length) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const b = new THREE.Box3();
    for (let k = 0; k < memo.idx.length; k += 3) {
      const i = memo.idx[k];
      b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
    }
    lista.push({ nome: o.name, n: memo.idx.length, de: pos.count, b, vis: visivel(o) });
  });
  lista.sort((p, q) => q.n - p.n);
  out.push([`${modelo} · malhas esticadas pelo rabo — ${lista.length}`,
    '\n        ' + lista.slice(0, 22).map((it) => `${it.nome} ${it.n}/${it.de} vért.${it.vis ? '' : ' (oculta)'}`
      + ` z ${mm(it.b.min.z)}…${mm(it.b.max.z)}`).join('\n        ')]);
}
return out;
