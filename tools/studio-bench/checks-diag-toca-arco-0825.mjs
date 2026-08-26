/* SONDA — quem AINDA toca o arco do 2º direcional, por ocupação em voxel. */
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
const arco = cab.getObjectByName('TS_PARALAMA_DIR2');
/* Ocupação do arco: células de 30 mm sobre os VÉRTICES DE FACE VIVA. */
const CEL = 0.030;
const ocupa = new Set();
const cxArco = new THREE.Box3();
const chave = (x, y, z) => `${Math.round(x / CEL)}|${Math.round(y / CEL)}|${Math.round(z / CEL)}`;
arco.traverse((n) => {
  if (!n.isMesh || !n.geometry) return;
  const pos = n.geometry.attributes?.position, idx = n.geometry.getIndex?.();
  if (!pos) return;
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(n.matrixWorld);
  const usa = (i) => {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    cxArco.expandByPoint(v);
    ocupa.add(chave(v.x, v.y, v.z));
  };
  if (idx) for (let q = 0; q < idx.count; q++) usa(idx.getX(q));
  else for (let i = 0; i < pos.count; i++) usa(i);
});
out.push(['0 · arco', `x ${mm(cxArco.min.x)}…${mm(cxArco.max.x)} y ${mm(cxArco.min.y)}…${mm(cxArco.max.y)}`
  + ` z ${mm(cxArco.min.z)}…${mm(cxArco.max.z)} · ${ocupa.size} células de ${mm(CEL)} mm`]);
const reg = cxArco.clone().expandByScalar(0.05);
const toca = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  for (let p = o; p; p = p.parent) if (p === arco || /^(VM_WHEEL|TS_)/.test(p.name || '')) return;
  if (/wheel|tire|pneu|rim|aro/i.test(o.name || '')) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
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
  const info = new Map();
  for (let q = 0; q < idx.count; q++) {
    const i = idx.getX(q), r = pai[i];
    let e = info.get(r);
    if (!e) { e = { box: new THREE.Box3(), n: 0, dentro: 0 }; info.set(r, e); }
    e.n++;
    e.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
    if (ocupa.has(chave(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]))) e.dentro++;
  }
  for (const e of info.values()) {
    if (!e.dentro) continue;
    const d = e.box.getSize(new THREE.Vector3());
    toca.push({ nome: o.name, dentro: e.dentro, n: e.n, box: e.box,
      rot: `${mm(d.x)}×${mm(d.y)}×${mm(d.z)}` });
  }
});
toca.sort((p, q) => q.dentro - p.dentro);
out.push([`1 · AINDA tocam o arco — ${toca.length} componente(s) soldado(s)`,
  '\n        ' + toca.slice(0, 45).map((it) => `${it.nome} ${it.rot} · ${it.dentro}/${it.n} vért. na casca`
    + ` · x ${mm(it.box.min.x)}…${mm(it.box.max.x)} y ${mm(it.box.min.y)}…${mm(it.box.max.y)}`
    + ` z ${mm(it.box.min.z)}…${mm(it.box.max.z)}`).join('\n        ')]);
return out;
