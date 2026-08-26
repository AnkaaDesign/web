/* SONDA — mapa de nomes na região entre os dois direcionais do VM 8x2. */
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
const a = acha('volvo-vm-2015', '8x2r');
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
S.camera.position.copy(P(-3.4, 1.00, 1.4));
S.controls.target.copy(P(-0.8, 0.78, 0.35));
S.controls.update();
for (let i = 0; i < 14; i++) await B.frame();
out.push(['foto', S.renderer.domElement.toDataURL('image/png')]);
const rc = new THREE.Raycaster();
const letras = new Map(); const ordem = [];
const COLS = 92, ROWS = 34;
const linhas = [];
const onde = new Map();
for (let r = 0; r < ROWS; r++) {
  let s = '';
  for (let c = 0; c < COLS; c++) {
    rc.setFromCamera(new THREE.Vector2(((c + 0.5) / COLS) * 2 - 1, -(((r + 0.5) / ROWS) * 2 - 1)), S.camera);
    const hits = rc.intersectObject(cab, true).filter((h) => h.object.visible);
    if (!hits.length) { s += '.'; continue; }
    const nome = hits[0].object.name || '?';
    let L = letras.get(nome);
    if (L === undefined) {
      L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[ordem.length] || '#';
      letras.set(nome, L); ordem.push(nome);
    }
    const p = hits[0].point.clone().applyMatrix4(W2Zn);
    let e = onde.get(nome);
    if (!e) { e = new THREE.Box3(); onde.set(nome, e); }
    e.expandByPoint(p);
    s += L;
  }
  linhas.push(s);
}
out.push(['mapa', '\n        ' + linhas.join('\n        ')]);
out.push(['legenda', '\n        ' + ordem.map((n) => {
  const b = onde.get(n);
  return `${letras.get(n)} = ${n} · Zn x ${mm(b.min.x)}…${mm(b.max.x)} y ${mm(b.min.y)}…${mm(b.max.y)} z ${mm(b.min.z)}…${mm(b.max.z)}`;
}).join('\n        ')]);
return out;
