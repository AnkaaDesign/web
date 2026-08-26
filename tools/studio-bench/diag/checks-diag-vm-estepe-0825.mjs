/* SONDA — onde está o estepe do VM bitruck, e o que ele encosta. */
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
const SOLDA = 5e-4;
function compsSoldados(px, idx, nVert) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let v = 0; v < nVert; v++) {
    const x = px[v * 3], y = px[v * 3 + 1], z = px[v * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  let g = SOLDA, nx, ny, nz;
  for (;;) {
    nx = Math.floor((x1 - x0) / g) + 2; ny = Math.floor((y1 - y0) / g) + 2; nz = Math.floor((z1 - z0) / g) + 2;
    if (nx * ny * nz <= Number.MAX_SAFE_INTEGER) break;
    g *= 2;
  }
  const celula = new Map(), rep = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) {
    const k = (Math.round((px[v * 3] - x0) / g) * ny + Math.round((px[v * 3 + 1] - y0) / g)) * nz
      + Math.round((px[v * 3 + 2] - z0) / g);
    const r = celula.get(k);
    if (r === undefined) { celula.set(k, v); rep[v] = v; } else rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const raiz = (i) => { let r = i; while (pai[r] !== r) r = pai[r]; while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; } return r; };
  const une = (p, q) => { const rp = raiz(p), rq = raiz(q); if (rp !== rq) pai[rp] = rq; };
  for (let q = 0; q < idx.count; q += 3) { une(rep[idx.getX(q)], rep[idx.getX(q + 1)]); une(rep[idx.getX(q + 1)], rep[idx.getX(q + 2)]); }
  const saida = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) saida[v] = raiz(rep[v]);
  return saida;
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
/* Entre o 2º direcional e o eixo auxiliar, sob o chassi. */
const reg = new THREE.Box3(new THREE.Vector3(-1.45, 0.05, -9.50), new THREE.Vector3(1.45, 1.60, 3.50));
const itens = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 900000) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const bb = o.geometry.boundingBox, cx = new THREE.Box3();
  for (let k = 0; k < 8; k++) {
    cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
      k & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
  }
  if (!cx.intersectsBox(reg)) return;
  const px = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
  }
  const pai = compsSoldados(px, idx, pos.count);
  const caixas = new Map();
  for (let q = 0; q < idx.count; q += 3) {
    const r = pai[idx.getX(q)];
    let b = caixas.get(r);
    if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
    b.n++;
    for (let k = 0; k < 3; k++) { const i = idx.getX(q + k); b.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])); }
  }
  const cadeia = [];
  for (let p = o; p && p !== cab; p = p.parent) cadeia.push(p.name || '?');
  for (const b of caixas.values()) {
    if (!reg.containsBox(b.box)) continue;
    const d = b.box.getSize(new THREE.Vector3());
    const dd = [d.x, d.y, d.z].sort((p2, q2) => q2 - p2);
    if (dd[0] < 0.60 || dd[0] > 1.60) continue;
    if (dd[2] < 0.12 || dd[2] > 0.70) continue;
    /* DISCO: as duas maiores dimensões quase iguais e a terceira menor. */
    const disco = dd[1] / dd[0] > 0.85 && dd[2] / dd[0] < 0.75;
    if (!disco) continue;
    if (b.box.min.y < 0.15 * dd[0]) continue;          // toca o chão: é rodagem
    itens.push({ nome: o.name, cadeia: cadeia.join('/'), faces: b.n, box: b.box, d, disco,
      rot: `${mm(d.x)}×${mm(d.y)}×${mm(d.z)}` });
  }
});
itens.sort((p, q) => Math.max(q.d.x, q.d.y, q.d.z) - Math.max(p.d.x, p.d.y, p.d.z));
out.push([`DISCOS que não tocam o chão no caminhão todo — ${itens.length}`,
  '\n        ' + itens.slice(0, 40).map((it) => `${it.disco ? '◉ DISCO ' : '        '}${it.nome} ${it.rot} f=${it.faces}`
    + ` x ${mm(it.box.min.x)}…${mm(it.box.max.x)} y ${mm(it.box.min.y)}…${mm(it.box.max.y)}`
    + ` z ${mm(it.box.min.z)}…${mm(it.box.max.z)}  [${it.cadeia}]`).join('\n        ')]);
/* E a foto da região entre o tanque e o tandem. */
const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
for (const [nome, camZ, alvoZ] of [['tanque-tandem', -2.2, -3.0], ['tandem', -4.0, -4.4]]) {
  S.camera.position.copy(P(4.2, 1.05, camZ));
  S.controls.target.copy(P(0.6, 0.65, alvoZ));
  S.controls.update();
  for (let i = 0; i < 14; i++) await B.frame();
  out.push([`vm-${nome}`, S.renderer.domElement.toDataURL('image/png')]);
}
return out;
