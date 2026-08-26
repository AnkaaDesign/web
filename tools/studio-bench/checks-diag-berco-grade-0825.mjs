/* SONDA — a que o berço do estepe se prendia, a grade de verdade, e fotos. */
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
const v = new THREE.Vector3();
const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const DZ = 1.52;

/* A · a que o conjunto do estepe se prendia NA COTA DE FÁBRICA. */
const cxE = new THREE.Box3();
for (const nome of ['step_0_p0', 'step_0_p1', 'step_0_p2']) {
  const o = cab.getObjectByName(nome);
  if (!o) continue;
  o.traverse((n) => {
    const pos = n.isMesh ? n.geometry?.attributes?.position : null;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(n.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) cxE.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
}
const fabrica = cxE.clone().translate(new THREE.Vector3(0, 0, DZ));
out.push(['A · conjunto do estepe', `hoje z ${mm(cxE.min.z)}…${mm(cxE.max.z)}`
  + ` · fábrica z ${mm(fabrica.min.z)}…${mm(fabrica.max.z)}`
  + ` · x ${mm(cxE.min.x)}…${mm(cxE.max.x)} y ${mm(cxE.min.y)}…${mm(cxE.max.y)}`]);
const perto = (caixa, rot) => {
  const reg = caixa.clone().expandByScalar(0.05);
  const achados = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !visivel(o) || !o.geometry || /^step_0_/.test(o.name || '')) return;
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
    for (let i = 0; i < pos.count; i += 2) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      if (!reg.containsPoint(v)) continue;
      let e = achados.get(o.name);
      if (!e) { e = { n: 0, b: new THREE.Box3() }; achados.set(o.name, e); }
      e.n++; e.b.expandByPoint(v);
    }
  });
  return [...achados.entries()].sort((p, q) => q[1].n - p[1].n).slice(0, 10)
    .map(([k, e]) => `${k} n=${e.n} x ${mm(e.b.min.x)}…${mm(e.b.max.x)}`
      + ` y ${mm(e.b.min.y)}…${mm(e.b.max.y)} z ${mm(e.b.min.z)}…${mm(e.b.max.z)}`);
};
out.push(['A · encosta HOJE (±50 mm)', '\n        ' + (perto(cxE).join('\n        ') || 'NADA')]);
out.push(['A · encostava na FÁBRICA (±50 mm)', '\n        ' + (perto(fabrica).join('\n        ') || 'NADA')]);

/* B · a grade de verdade — com as matrizes de instância. */
const gr = [];
S.state.trailer.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  let eh = false;
  for (let p = o; p; p = p.parent) if (/BARRA|ESTACAO|PONTA|BRACO|MAO|GRADE|PROTECAO/i.test(p.name || '')) eh = true;
  if (!eh) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const base = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const n = o.isInstancedMesh ? o.count : 1;
  const mi = new THREE.Matrix4(), M = new THREE.Matrix4();
  for (let k = 0; k < n; k++) {
    if (o.isInstancedMesh) { o.getMatrixAt(k, mi); M.copy(base).multiply(mi); } else M.copy(base);
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i += 3) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
    if (b.isEmpty() || b.getCenter(v).x < 0) continue;
    gr.push({ nome: o.name, b });
  }
});
gr.sort((p, q) => q.b.max.z - p.b.max.z);
const envG = new THREE.Box3();
for (const t of gr) envG.union(t.b);
out.push([`B · grade no flanco x+ — ${gr.length} peça(s) · envelope z ${mm(envG.min.z)}…${mm(envG.max.z)}`,
  '\n        ' + gr.slice(0, 30).map((t) => `${t.nome} z ${mm(t.b.min.z)}…${mm(t.b.max.z)}`
    + ` x ${mm(t.b.min.x)}…${mm(t.b.max.x)} y ${mm(t.b.min.y)}…${mm(t.b.max.y)}`).join('\n        ')]);

/* C · fotos */
for (const [nome, cam, alvo] of [
  ['flanco-tandem', [-4.9, 0.95, -3.4], [-1.0, 0.72, -3.4]],
  ['traseira', [-4.2, 1.35, -9.8], [-0.3, 0.75, -7.2]],
]) {
  S.camera.position.copy(P(...cam));
  S.controls.target.copy(P(...alvo));
  S.controls.update();
  for (let i = 0; i < 14; i++) await B.frame();
  out.push([`vm-${nome}`, S.renderer.domElement.toDataURL('image/png')]);
}
return out;
