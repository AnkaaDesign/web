/* SONDA — quem é a peça na frente do para-lama, por RAIO na tela. */
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
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
const W2Zn = new THREE.Matrix4().copy(N).multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
const eixo2 = Math.min(...mount.axles.steerZ);
S.camera.position.copy(P(-3.2, 1.05, eixo2 + 1.35));
S.controls.target.copy(P(-0.95, 0.72, eixo2 + 0.20));
S.controls.update();
for (let i = 0; i < 12; i++) await B.frame();
const cv = S.renderer.domElement;
const W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
out.push(['0 · tela', `${W} × ${H}`]);
const rc = new THREE.Raycaster();
const conta = new Map();
/* A faixa da queixa: à frente da roda, na altura do arco. */
/* ⚠️ EM FRAÇÃO DA TELA, e não em pixel do PNG: o `toDataURL` sai em 1152×720 e
   o canvas é 1440×900 — amostrar em pixel do print aponta 25 % ao lado. */
for (let fx = 0.60; fx <= 0.82; fx += 0.01) {
  for (let fy = 0.53; fy <= 0.72; fy += 0.01) {
    rc.setFromCamera(new THREE.Vector2(fx * 2 - 1, -(fy * 2 - 1)), S.camera);
    const hits = rc.intersectObject(cab, true).filter((h) => h.object.visible);
    if (!hits.length) continue;
    const h = hits[0];
    const p = h.point.clone().applyMatrix4(W2Zn);
    const k = h.object.name || '(sem nome)';
    const c = conta.get(k) || { n: 0, cx: new THREE.Box3() };
    c.n++; c.cx.expandByPoint(p);
    conta.set(k, c);
  }
}
const lista = [...conta.entries()].sort((p, q) => q[1].n - p[1].n);
out.push([`1 · o que a tela mostra na faixa x 60…82 % · y 53…72 % — ${lista.length} peça(s)`,
  '\n        ' + lista.map(([k, c]) => `${k} · ${c.n} raio(s)`
    + ` · Zn x ${mm(c.cx.min.x)}…${mm(c.cx.max.x)} y ${mm(c.cx.min.y)}…${mm(c.cx.max.y)}`
    + ` z ${mm(c.cx.min.z)}…${mm(c.cx.max.z)}`).join('\n        ')]);
/* E a caixa INTEIRA de cada uma delas. */
const caixas = [];
cab.traverse((o) => {
  if (!o.isMesh || !conta.has(o.name || '')) return;
  const pos = o.geometry?.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const b = new THREE.Box3(); const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  caixas.push(`${o.name} (${pos.count} vért.) x ${mm(b.min.x)}…${mm(b.max.x)}`
    + ` y ${mm(b.min.y)}…${mm(b.max.y)} z ${mm(b.min.z)}…${mm(b.max.z)}`);
});
out.push(['2 · caixa INTEIRA das malhas acusadas', '\n        ' + caixas.join('\n        ')]);
return out;
