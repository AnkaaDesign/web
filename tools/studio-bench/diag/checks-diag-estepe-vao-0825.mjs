/* SONDA — o vão real do conjunto do estepe, as folgas da grade, e fotos. */
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
for (const [modelo, chassi] of [['volvo-vm-2015', '8x2r'], ['scania-p', '8x2r']]) {
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
  const W2Zn = new THREE.Matrix4().copy(N).multiply(cabInv);
  const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
  const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
  const v = new THREE.Vector3();
  const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  /* A · o conjunto do estepe contra o resto. */
  const ehEstepe = (o) => { for (let p = o; p; p = p.parent) if (/^step_0_|VM_WHEEL_SPARE/.test(p.name || '')) return true; return false; };
  const pontosE = [];
  const cxE = new THREE.Box3();
  cab.traverse((o) => {
    if (!o.isMesh || !visivel(o) || !o.geometry || !ehEstepe(o)) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 2) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      pontosE.push(v.x, v.y, v.z); cxE.expandByPoint(v);
    }
  });
  if (!pontosE.length) { out.push([`${modelo} ${chassi} · estepe`, 'sem estepe']); }
  else {
    const reg = cxE.clone().expandByScalar(0.35);
    let melhor = Infinity, quem = '—', onde = null;
    cab.traverse((o) => {
      if (!o.isMesh || !visivel(o) || !o.geometry || ehEstepe(o)) return;
      const pos = o.geometry.attributes?.position;
      if (!pos) return;
      const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
      for (let i = 0; i < pos.count; i += 2) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
        if (!reg.containsPoint(v)) continue;
        for (let k = 0; k < pontosE.length; k += 3) {
          const d = Math.hypot(pontosE[k] - v.x, pontosE[k + 1] - v.y, pontosE[k + 2] - v.z);
          if (d < melhor) { melhor = d; quem = o.name; onde = v.clone(); }
          if (melhor < 0.002) break;
        }
        if (melhor < 0.002) return;
      }
    });
    out.push([`${modelo} ${chassi} · estepe`, `caixa x ${mm(cxE.min.x)}…${mm(cxE.max.x)} y ${mm(cxE.min.y)}…${mm(cxE.max.y)}`
      + ` z ${mm(cxE.min.z)}…${mm(cxE.max.z)} · VÃO até o resto do caminhão: ${mm(melhor)} mm (${quem}`
      + `${onde ? ` em ${mm(onde.x)},${mm(onde.y)},${mm(onde.z)}` : ''})`]);
  }
  /* B · a grade: trechos do relato + as rodas. */
  out.push([`${modelo} · grade`, relato.filter((l) => /trecho\(s\)/.test(l)).slice(-1)[0] || '—']);
  out.push([`${modelo} · para-lama`, '\n        ' + relato.filter((l) => /baia do 2º direcional/.test(l)).join('\n        ')]);
  out.push([`${modelo} · tandem`, '\n        ' + relato.filter((l) => /por vértice|conjunto traseiro/.test(l)).join('\n        ')]);
  const rodas = [];
  cab.traverse((o) => {
    if (!o.isMesh || !visivel(o) || !o.geometry) return;
    let r = false;
    for (let p = o; p; p = p.parent) if (/VM_WHEEL/i.test(p.name || '')) r = true;
    if (!r) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i += 11) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
    if (!b.isEmpty() && b.max.x > 0.5) rodas.push(b);
  });
  const eixosR = [];
  for (const b of rodas) {
    const c = (b.min.z + b.max.z) / 2;
    const g = eixosR.find((e) => Math.abs(e.c - c) < 0.30);
    if (g) { g.z0 = Math.min(g.z0, b.min.z); g.z1 = Math.max(g.z1, b.max.z); g.c = (g.z0 + g.z1) / 2; }
    else eixosR.push({ c, z0: b.min.z, z1: b.max.z });
  }
  eixosR.sort((p, q) => q.c - p.c);
  out.push([`${modelo} · rodas (z)`, eixosR.map((e) => `${mm(e.z0)}…${mm(e.z1)}`).join(' · ')]);
  if (chassi === '8x2r') {
    for (const [nome, cam, alvo] of [
      ['estepe', [-2.6, 0.95, -8.6], [-0.2, 0.62, -7.3]],
      ['frente', [-3.8, 1.05, 1.9], [-0.7, 0.80, 0.4]],
      ['cardan', [-4.9, 0.95, -3.4], [-1.0, 0.72, -3.4]],
    ]) {
      S.camera.position.copy(P(...cam));
      S.controls.target.copy(P(...alvo));
      S.controls.update();
      for (let i = 0; i < 14; i++) await B.frame();
      out.push([`vm-${nome}`, S.renderer.domElement.toDataURL('image/png')]);
    }
  }
}
console.info = infoOrig;
return out;
