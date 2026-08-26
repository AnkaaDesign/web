/* SONDA — o conjunto traseiro do VM 8x2 contra o do Scania 8x2. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
const relato = [];
const infoOrig = console.info.bind(console);
console.info = (...a) => { relato.push(a.map(String).join(' ')); infoOrig(...a); };
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const acha = (m, c) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      if (mo.id === m) for (const ch of (mo.chassis || [])) if (ch.id === c) return { mk, mo, c: ch };
  return null;
};
for (const [modelo, chassi] of [['volvo-vm-2015', '4x2r'], ['scania-p', '4x2r']]) {
  const a = acha(modelo, chassi);
  relato.length = 0;
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
  out.push([`— ${chassi} ${modelo} —`, `steerZ ${mount.axles.steerZ.map(mm).join(' · ')}`
    + ` · driveZ ${mount.axles.driveZ.map(mm).join(' · ')}`
    + ` · liftZ ${(mount.axles.liftZ || []).map(mm).join(' · ') || '—'}`
    + ` · cabRearZ ${mm(mount.cabRearZ)} · frameTopY ${mm(mount.frameTopY)}`]);
  out.push([`${chassi} · relato do tandem`, '\n        '
    + relato.filter((l) => /\[tandem\]/.test(l)).join('\n        ')]);
  /* As RODAS que estão na tela, agrupadas por z. */
  const pontos = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    let ehRoda = false;
    for (let p = o; p; p = p.parent) if (/wheel|VM_WHEEL|tire|pneu/i.test(p.name || '')) ehRoda = true;
    if (!ehRoda) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 7) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      if (Math.abs(v.x) < 0.35) continue;
      pontos.push({ x: v.x, y: v.y, z: v.z });
    }
  });
  pontos.sort((p, q) => p.z - q.z);
  const grupos = [];
  for (const p of pontos) {
    const g = grupos.find((k) => Math.abs(k.cz - p.z) < 0.40 && Math.sign(k.cx) === Math.sign(p.x));
    if (g) {
      g.n++; g.z0 = Math.min(g.z0, p.z); g.z1 = Math.max(g.z1, p.z);
      g.y0 = Math.min(g.y0, p.y); g.y1 = Math.max(g.y1, p.y);
      g.x0 = Math.min(g.x0, p.x); g.x1 = Math.max(g.x1, p.x);
      g.cz = (g.z0 + g.z1) / 2; g.cx = (g.x0 + g.x1) / 2;
    } else grupos.push({ n: 1, z0: p.z, z1: p.z, y0: p.y, y1: p.y, x0: p.x, x1: p.x, cz: p.z, cx: p.x });
  }
  grupos.sort((p, q) => q.cz - p.cz);
  out.push([`${chassi} · grupos de roda (|x| ≥ 350) — ${grupos.length}`,
    '\n        ' + grupos.map((g) => `n=${g.n} z ${mm(g.z0)}…${mm(g.z1)} (c ${mm(g.cz)})`
      + ` y ${mm(g.y0)}…${mm(g.y1)} x ${mm(g.x0)}…${mm(g.x1)}`
      + `${g.y0 > 0.15 * (g.y1 - g.y0) ? '  ← NÃO toca o chão (estepe?)' : ''}`).join('\n        ')]);
  /* O rabo do chassi e a carroceria. */
  const cxCab = new THREE.Box3(), cxTrl = new THREE.Box3();
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 11) cxCab.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  const W2Zn = new THREE.Matrix4().copy(N).multiply(cabInv);
  S.state.trailer.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 31) cxTrl.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  const ultimo = Math.min(...[...mount.axles.driveZ, ...(mount.axles.liftZ || [])]);
  out.push([`${chassi} · silhueta`, `chassi z ${mm(cxCab.min.z)}…${mm(cxCab.max.z)}`
    + ` · carroceria z ${mm(cxTrl.min.z)}…${mm(cxTrl.max.z)}`
    + ` · último eixo ${mm(ultimo)} → balanço até o chassi ${mm(ultimo - cxCab.min.z)}`
    + ` · até a carroceria ${mm(ultimo - cxTrl.min.z)}`]);
}
console.info = infoOrig;
return out;
