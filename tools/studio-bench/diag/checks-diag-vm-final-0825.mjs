/* SONDA — 1) folga vertical do estepe · 2) flutuantes na frente · 3) o cardã. */
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
const W2Zn = new THREE.Matrix4().copy(N).multiply(cabInv);
const v = new THREE.Vector3();
const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

/* ── 1 · FOLGA VERTICAL DO ESTEPE ── */
const ehEstepe = (o) => { for (let p = o; p; p = p.parent) if (/^step_0_/.test(p.name || '')) return true; return false; };
const alto = [];   // pontos do estepe
const cxE = new THREE.Box3();
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry || !ehEstepe(o)) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  for (let i = 0; i < pos.count; i += 2) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    alto.push(v.x, v.y, v.z); cxE.expandByPoint(v);
  }
});
let subir = Infinity, quemS = '—';
const reg = cxE.clone().expandByScalar(0.30);
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry || ehEstepe(o)) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  for (let i = 0; i < pos.count; i += 2) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    if (!reg.containsPoint(v)) continue;
    for (let k = 0; k < alto.length; k += 3) {
      if (Math.abs(alto[k] - v.x) > 0.030 || Math.abs(alto[k + 2] - v.z) > 0.030) continue;
      const dy = v.y - alto[k + 1];
      if (dy > 0 && dy < subir) { subir = dy; quemS = o.name; }
    }
  }
});
out.push(['1 · estepe', `caixa y ${mm(cxE.min.y)}…${mm(cxE.max.y)} z ${mm(cxE.min.z)}…${mm(cxE.max.z)}`
  + ` · folga VERTICAL até o que está acima: ${mm(subir)} mm (${quemS})`]);

/* ── 2 · FLUTUANTES NA FRENTE (entre os dois direcionais) ── */
const REG = new THREE.Box3(new THREE.Vector3(-1.5, 0.15, -1.6), new THREE.Vector3(1.5, 1.6, 2.6));
const pecas = [];
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const bb = o.geometry.boundingBox, cx = new THREE.Box3();
  for (let k = 0; k < 8; k++) {
    cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
      k & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
  }
  if (!cx.intersectsBox(REG)) return;
  const px = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
  }
  const pai = compsSoldados(px, idx, pos.count);
  const g = new Map();
  for (let q = 0; q < idx.count; q++) { const i = idx.getX(q), r = pai[i]; let sset = g.get(r); if (!sset) { sset = new Set(); g.set(r, sset); } sset.add(i); }
  for (const [, set] of g) {
    const b = new THREE.Box3();
    for (const i of set) b.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
    if (!b.intersectsBox(REG)) continue;
    const d = b.getSize(new THREE.Vector3());
    if (Math.max(d.x, d.y, d.z) < 0.03) continue;
    pecas.push({ nome: o.name, box: b, d });
  }
});
const flut = [];
for (const p of pecas) {
  let melhor = Infinity, quem = '—';
  for (const o of pecas) {
    if (o === p) continue;
    const dx = Math.max(0, Math.max(p.box.min.x - o.box.max.x, o.box.min.x - p.box.max.x));
    const dy = Math.max(0, Math.max(p.box.min.y - o.box.max.y, o.box.min.y - p.box.max.y));
    const dz = Math.max(0, Math.max(p.box.min.z - o.box.max.z, o.box.min.z - p.box.max.z));
    const dd = Math.hypot(dx, dy, dz);
    if (dd < melhor) { melhor = dd; quem = o.nome; }
  }
  if (melhor > 0.02) flut.push({ p, melhor, quem });
}
flut.sort((p, q) => q.melhor - p.melhor);
out.push([`2 · flutuando entre os direcionais — ${flut.length} de ${pecas.length}`,
  '\n        ' + flut.slice(0, 20).map((f) => `${f.p.nome} ${mm(f.p.d.x)}×${mm(f.p.d.y)}×${mm(f.p.d.z)}`
    + ` · vão ${mm(f.melhor)} até ${f.quem}`
    + ` · x ${mm(f.p.box.min.x)}…${mm(f.p.box.max.x)} y ${mm(f.p.box.min.y)}…${mm(f.p.box.max.y)}`
    + ` z ${mm(f.p.box.min.z)}…${mm(f.p.box.max.z)}`).join('\n        ')]);

/* ── 3 · O CARDÃ: peça longa e fina perto da linha de centro ── */
const REG3 = new THREE.Box3(new THREE.Vector3(-0.45, 0.25, -6.5), new THREE.Vector3(0.45, 1.05, -0.6));
const longas = [];
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const bb = o.geometry.boundingBox, cx = new THREE.Box3();
  for (let k = 0; k < 8; k++) {
    cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
      k & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
  }
  if (!cx.intersectsBox(REG3)) return;
  const px = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
  }
  const pai = compsSoldados(px, idx, pos.count);
  const g = new Map();
  for (let q = 0; q < idx.count; q++) { const i = idx.getX(q), r = pai[i]; let sset = g.get(r); if (!sset) { sset = new Set(); g.set(r, sset); } sset.add(i); }
  for (const [r, set] of g) {
    const b = new THREE.Box3();
    for (const i of set) b.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
    const d = b.getSize(new THREE.Vector3());
    if (d.z < 0.30) continue;
    if (Math.max(d.x, d.y) > 0.35) continue;
    if (!REG3.containsBox(b)) continue;
    longas.push({ nome: o.name, raiz: r, box: b, d, n: set.size });
  }
});
longas.sort((p, q) => q.d.z - p.d.z);
out.push([`3 · peças longas na linha de centro (|x| ≤ 450) — ${longas.length}`,
  '\n        ' + longas.slice(0, 16).map((t) => `${t.nome} ${mm(t.d.x)}×${mm(t.d.y)}×${mm(t.d.z)} n=${t.n}`
    + ` x ${mm(t.box.min.x)}…${mm(t.box.max.x)} y ${mm(t.box.min.y)}…${mm(t.box.max.y)}`
    + ` z ${mm(t.box.min.z)}…${mm(t.box.max.z)}`).join('\n        ')]);
out.push(['3 · eixos (Zn)', `drive ${mount.axles.driveZ.map(mm).join(' ')} · lift ${mount.axles.liftZ.map(mm).join(' ')}`]);
return out;
