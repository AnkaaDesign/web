/* SONDA — o que ficou na cota velha, a grade e o estepe do VM 8x2. */
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
const v = new THREE.Vector3();
const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
out.push(['0 · grade (relato)', '\n        ' + relato.filter((l) => /\[grade/.test(l)).join('\n        ')]);

/* ─── A · o que ficou na LAJE do tandem, na cota VELHA ─── */
const DZ = 1.52;
const eixos = [...mount.axles.driveZ, ...mount.axles.liftZ].map((z) => z + DZ);
const zA = Math.min(...eixos) - 0.95, zB = Math.max(...eixos) + 0.95;
const laje = new THREE.Box3(new THREE.Vector3(-1.45, 0, zA), new THREE.Vector3(1.45, mount.frameTopY + 0.15, zB));
const pisoMesa = mount.frameTopY - 0.60;
const itens = [];
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  for (let p = o; p; p = p.parent) if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const bb = o.geometry.boundingBox, cx = new THREE.Box3();
  for (let k = 0; k < 8; k++) {
    cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
      k & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
  }
  if (!cx.intersectsBox(laje)) return;
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
  for (const b of caixas.values()) {
    if (!laje.containsBox(b.box)) continue;
    const d = b.box.getSize(new THREE.Vector3());
    const maior = Math.max(d.x, d.y, d.z);
    if (maior < 0.04) continue;
    const travessa = b.box.min.x * b.box.max.x <= 0 && b.box.min.y >= pisoMesa;
    itens.push({ nome: o.name, faces: b.n, box: b.box, d, maior,
      motivo: travessa ? 'TRAVESSA' : maior < 0.10 ? 'miúda' : 'sem corrente',
      rot: `${mm(d.x)}×${mm(d.y)}×${mm(d.z)}` });
  }
});
itens.sort((p, q) => q.maior - p.maior);
const semCorrente = itens.filter((it) => it.motivo === 'sem corrente');
out.push([`A · ficaram na laje velha — ${itens.length} (travessa ${itens.filter((i2) => i2.motivo === 'TRAVESSA').length}`
  + ` · miúda ${itens.filter((i2) => i2.motivo === 'miúda').length} · sem corrente ${semCorrente.length})`,
  '\n        ' + semCorrente.slice(0, 30).map((it) => `${it.nome} ${it.rot} f=${it.faces}`
    + ` x ${mm(it.box.min.x)}…${mm(it.box.max.x)} y ${mm(it.box.min.y)}…${mm(it.box.max.y)}`
    + ` z ${mm(it.box.min.z)}…${mm(it.box.max.z)}`).join('\n        ')]);

/* ─── B · a grade lateral ─── */
const cxGrade = new THREE.Box3();
const trechosG = [];
S.state.trailer.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  let ehGrade = false;
  for (let p = o; p; p = p.parent) if (/GRADE|PROTECAO|SIDE_GUARD|TS_GRADE/i.test(p.name || '')) ehGrade = true;
  if (!ehGrade) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i += 5) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  if (b.isEmpty()) return;
  cxGrade.union(b);
  if (b.max.x > 0) trechosG.push({ nome: o.name, b });
});
trechosG.sort((p, q) => q.b.max.z - p.b.max.z);
out.push(['B · grade lateral (flanco x+)', cxGrade.isEmpty() ? 'não achada'
  : `envelope z ${mm(cxGrade.min.z)}…${mm(cxGrade.max.z)} · x ${mm(cxGrade.min.x)}…${mm(cxGrade.max.x)}`
  + ` · y ${mm(cxGrade.min.y)}…${mm(cxGrade.max.y)} · ${trechosG.length} malha(s)`]);
out.push(['B · peças da grade, da frente para trás', '\n        '
  + trechosG.slice(0, 24).map((t) => `${t.nome} z ${mm(t.b.min.z)}…${mm(t.b.max.z)} x ${mm(t.b.min.x)}…${mm(t.b.max.x)}`).join('\n        ')]);
/* As baias de roda no flanco. */
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
  if (!b.isEmpty() && b.max.x > 0.3) rodas.push(b);
});
rodas.sort((p, q) => q.max.z - p.max.z);
out.push(['B · rodas do flanco x+ (z)', rodas.map((b) => `${mm(b.min.z)}…${mm(b.max.z)}`).join(' · ')]);

/* ─── C · o estepe ─── */
for (const nome of ['step_0_p0', 'step_0_p1', 'step_0_p2']) {
  const o = cab.getObjectByName(nome);
  if (!o) { out.push([`C · ${nome}`, 'AUSENTE']); continue; }
  const b = new THREE.Box3();
  o.traverse((n) => {
    const pos = n.isMesh ? n.geometry?.attributes?.position : null;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(W2Zn).multiply(n.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  out.push([`C · ${nome}`, `x ${mm(b.min.x)}…${mm(b.max.x)} y ${mm(b.min.y)}…${mm(b.max.y)} z ${mm(b.min.z)}…${mm(b.max.z)}`]);
}
/* O que existe LOGO ACIMA do berço do estepe. */
const berco = cab.getObjectByName('step_0_p2');
const cxB = new THREE.Box3();
berco.traverse((n) => {
  const pos = n.isMesh ? n.geometry?.attributes?.position : null;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(n.matrixWorld);
  for (let i = 0; i < pos.count; i += 3) cxB.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
});
const acima = new THREE.Box3(new THREE.Vector3(cxB.min.x - 0.25, cxB.min.y - 0.05, cxB.min.z - 0.25),
  new THREE.Vector3(cxB.max.x + 0.25, cxB.max.y + 0.60, cxB.max.z + 0.25));
const vizB = new Map();
cab.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  if (/^step_0_/.test(o.name || '')) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  for (let i = 0; i < pos.count; i += 3) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    if (!acima.containsPoint(v)) continue;
    let e = vizB.get(o.name);
    if (!e) { e = { n: 0, b: new THREE.Box3() }; vizB.set(o.name, e); }
    e.n++; e.b.expandByPoint(v);
  }
});
out.push([`C · o que existe em volta/acima do berço — ${vizB.size}`,
  '\n        ' + [...vizB.entries()].sort((p, q) => q[1].n - p[1].n).slice(0, 14)
    .map(([k, e]) => `${k} n=${e.n} x ${mm(e.b.min.x)}…${mm(e.b.max.x)} y ${mm(e.b.min.y)}…${mm(e.b.max.y)}`
      + ` z ${mm(e.b.min.z)}…${mm(e.b.max.z)}`).join('\n        ')]);
console.info = infoOrig;
return out;
