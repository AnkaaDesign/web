/* DIAGNÓSTICO DUPLO — 1) o que sobrou na laje velha do estepe no truck;
                       2) os reservatórios: o que ficou e onde eles estão. */
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
  const une = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai[ra] = rb; };
  for (let q = 0; q < idx.count; q += 3) { une(rep[idx.getX(q)], rep[idx.getX(q + 1)]); une(rep[idx.getX(q + 1)], rep[idx.getX(q + 2)]); }
  const saida = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) saida[v] = raiz(rep[v]);
  return saida;
}
const LAJE = { x: 0.16, yBaixo: 0.10, yAlto: 0.42, z: 0.10 };

async function carrega(chassi) {
  const alvo = acha('scania-p', chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: alvo.mk.id,
    modelId: alvo.mo.id, chassisId: alvo.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  return { cab, N, cabInv };
}
/* Todos os componentes soldados numa região, em Zn. */
function censo({ cab, N, cabInv }, reg, filtro) {
  const v = new THREE.Vector3();
  const itens = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (filtro && !filtro(o)) return;
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
      itens.push({ nome: o.name, faces: b.n, box: b.box, d,
        rot: `${mm(d.x)}×${mm(d.y)}×${mm(d.z)}`,
        centro: b.box.getCenter(new THREE.Vector3()),
        inteiro: reg.containsBox(b.box) });
    }
  });
  itens.sort((a, b2) => Math.max(b2.d.x, b2.d.y, b2.d.z) - Math.max(a.d.x, a.d.y, a.d.z));
  return itens;
}
const caixaDe = (ctx, no) => {
  const o = ctx.cab.getObjectByName(no);
  if (!o) return null;
  const b = new THREE.Box3(), v = new THREE.Vector3();
  o.traverse((n) => {
    const pos = n.isMesh ? n.geometry?.attributes?.position : null;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(ctx.N).multiply(ctx.cabInv).multiply(n.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  return b.isEmpty() ? null : b;
};

/* ───────── 1 · O QUE SOBROU NA LAJE VELHA DO ESTEPE, NO TRUCK ───────── */
{
  const ctx = await carrega('6x2r');
  const cxE = caixaDe(ctx, 'VM_WHEEL_SPARE');
  const dz = 0.30;
  const velha = new THREE.Box3(
    new THREE.Vector3(cxE.min.x - LAJE.x, cxE.min.y - LAJE.yBaixo, cxE.min.z - LAJE.z - dz),
    new THREE.Vector3(cxE.max.x + LAJE.x, cxE.max.y + LAJE.yAlto, cxE.max.z + LAJE.z - dz));
  const itens = censo(ctx, velha, (o) => !/^(VM_WHEEL|TS_)/.test(o.name || '')).filter((it) => it.inteiro);
  out.push(['1 · 6x2 · estepe Zn', `${mm(cxE.min.z)}…${mm(cxE.max.z)} · laje velha ${mm(velha.min.z)}…${mm(velha.max.z)}`]);
  out.push([`1 · 6x2 · na laje VELHA, inteiros — ${itens.length}`,
    '\n        ' + itens.map((it) => `${it.nome} ${it.rot} f=${it.faces} @${mm(it.centro.x)},${mm(it.centro.y)},${mm(it.centro.z)}`).join('\n        ')]);
}
/* ───────── 2 · OS RESERVATÓRIOS ───────── */
for (const chassi of ['6x2r', '8x2r']) {
  const ctx = await carrega(chassi);
  const tanque = caixaDe(ctx, 'TS_TANQUE_VM');
  out.push([`2 · ${chassi} · TS_TANQUE_VM`, tanque
    ? `x ${mm(tanque.min.x)}…${mm(tanque.max.x)} · y ${mm(tanque.min.y)}…${mm(tanque.max.y)} · z ${mm(tanque.min.z)}…${mm(tanque.max.z)}`
    : 'AUSENTE']);
  /* A região do flanco entre a cabine e o estepe, dos dois lados. */
  const reg = new THREE.Box3(new THREE.Vector3(-1.30, 0.20, -3.60), new THREE.Vector3(1.30, 1.30, -0.60));
  const itens = censo(ctx, reg, (o) => !/^(VM_WHEEL)/.test(o.name || ''))
    .filter((it) => Math.max(Math.abs(it.box.min.x), Math.abs(it.box.max.x)) >= 0.80 && it.faces >= 24);
  out.push([`2 · ${chassi} · flanco entre cabine e estepe (|x| ≥ 800, soldado) — ${itens.length}`,
    '\n        ' + itens.slice(0, 45).map((it) => `${it.nome} ${it.rot} f=${it.faces}`
      + ` x ${mm(it.box.min.x)}…${mm(it.box.max.x)} z ${mm(it.box.min.z)}…${mm(it.box.max.z)}`
      + ` y ${mm(it.box.min.y)}…${mm(it.box.max.y)}${it.inteiro ? '' : ' (atravessa)'}`).join('\n        ')]);
}
return out;
