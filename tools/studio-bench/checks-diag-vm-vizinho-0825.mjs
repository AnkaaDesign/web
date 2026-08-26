/* SONDA — o que ATRAVESSA o para-lama do 2º direcional no VM bitruck. */
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
function comps(idx, n) {
  const pai = new Int32Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  for (let q = 0; q < idx.count; q += 3) {
    const x = raiz(idx.getX(q)), y = raiz(idx.getX(q + 1)), z = raiz(idx.getX(q + 2));
    if (x !== y) pai[y] = x;
    if (x !== z) pai[z] = x;
  }
  for (let i = 0; i < n; i++) pai[i] = raiz(i);
  return pai;
}
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
const v = new THREE.Vector3();
const peca = cab.getObjectByName('TS_PARALAMA_DIR2');
/* A região: o flanco em torno do 2º direcional, do lado do para-lama. */
const reg = new THREE.Box3(new THREE.Vector3(0.40, 0.45, -1.30), new THREE.Vector3(1.35, 1.35, 0.70));
const itens = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  for (let p = o; p; p = p.parent) if (p === peca) return;
  if (/wheel|tire|pneu|rim|aro|VM_WHEEL/i.test(o.name || '')) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos) return;
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const px = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
  }
  if (!idx || pos.count > 260000) {
    const b = new THREE.Box3(); let n = 0;
    for (let i = 0; i < pos.count; i++) { v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); if (reg.containsPoint(v)) { b.expandByPoint(v); n++; } }
    if (n) itens.push({ nome: o.name + ' (malha inteira)', n, b });
    return;
  }
  const pai = comps(idx, pos.count);
  const caixas = new Map();
  for (let q = 0; q < idx.count; q += 3) {
    const r = pai[idx.getX(q)];
    let b = caixas.get(r);
    if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
    b.n++;
    for (let k = 0; k < 3; k++) { const i = idx.getX(q + k); b.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])); }
  }
  for (const b of caixas.values()) {
    if (!b.box.intersectsBox(reg)) continue;
    const d = b.box.getSize(new THREE.Vector3());
    if (Math.max(d.x, d.y, d.z) < 0.04) continue;
    itens.push({ nome: o.name, n: b.n, b: b.box, d });
  }
});
itens.sort((p, q) => p.b.min.z - q.b.min.z);
out.push([`vizinhança do 2º direcional (x 400…1350, y 450…1350, z −1300…700) — ${itens.length}`,
  '\n        ' + itens.slice(0, 60).map((it) => `${it.nome} n=${it.n}`
    + ` x ${mm(it.b.min.x)}…${mm(it.b.max.x)} y ${mm(it.b.min.y)}…${mm(it.b.max.y)}`
    + ` z ${mm(it.b.min.z)}…${mm(it.b.max.z)}`).join('\n        ')]);
/* E a foto do ângulo da queixa. */
const bb = new THREE.Box3().setFromObject(peca);
const c = bb.getCenter(new THREE.Vector3());
S.camera.position.set(c.x + 4.6, c.y + 0.35, c.z + 2.2);
S.controls.target.set(c.x, c.y - 0.15, c.z + 0.25);
S.controls.update();
for (let i = 0; i < 12; i++) await B.frame();
out.push(['foto-vm-paralama', S.renderer.domElement.toDataURL('image/png')]);
return out;
