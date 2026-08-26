/* ▶▶ DETECTOR DE PEÇA FLUTUANTE — por DISTÂNCIA, não por janela.
   ===========================================================================
   Uma peça flutua quando não há NADA a menos de `TOCA` dela. É a definição do
   dono ("essas peças flutuando"), e é a única que não depende de eu adivinhar
   qual janela usar. */
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
const CHASSI = window.__chassi || '8x2r';
const a = acha('volvo-vm-2015', CHASSI);
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
const REG = new THREE.Box3(new THREE.Vector3(-1.5, 0, -8.6), new THREE.Vector3(1.5, 1.5, 0.2));
const CEL = 0.05, TOCA = 0.02, MIN_PECA = 0.04;

/* 1 · componentes + grade espacial */
const pecas = [];          // { nome, box, xs: Float32Array }
const grade = new Map();   // chave da célula → [índices de peça]
const chave = (x, y, z) => `${Math.floor(x / CEL)}|${Math.floor(y / CEL)}|${Math.floor(z / CEL)}`;
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
  const grupos = new Map();
  for (let q = 0; q < idx.count; q++) {
    const i = idx.getX(q), r = pai[i];
    let g = grupos.get(r);
    if (!g) { g = new Set(); grupos.set(r, g); }
    g.add(i);
  }
  for (const [, set] of grupos) {
    const b = new THREE.Box3();
    for (const i of set) b.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
    if (!b.intersectsBox(REG)) continue;
    const d = b.getSize(new THREE.Vector3());
    if (Math.max(d.x, d.y, d.z) < MIN_PECA) continue;
    const xs = new Float32Array(set.size * 3);
    let k = 0;
    for (const i of set) { xs[k++] = px[i * 3]; xs[k++] = px[i * 3 + 1]; xs[k++] = px[i * 3 + 2]; }
    const id = pecas.length;
    pecas.push({ nome: o.name, box: b, xs, d });
    for (let j = 0; j < xs.length; j += 3) {
      const c = chave(xs[j], xs[j + 1], xs[j + 2]);
      let l = grade.get(c);
      if (!l) { l = []; grade.set(c, l); }
      if (l[l.length - 1] !== id) l.push(id);
    }
  }
});
out.push(['0 · censo', `${pecas.length} componente(s) soldados ≥ ${mm(MIN_PECA)} mm na região`]);

/* 2 · para cada peça, a menor distância a QUALQUER outra */
const flut = [];
for (let id = 0; id < pecas.length; id++) {
  const p = pecas[id];
  const vizinhos = new Set();
  const b = p.box.clone().expandByScalar(0.16);
  for (let cx2 = Math.floor(b.min.x / CEL); cx2 <= Math.floor(b.max.x / CEL); cx2++) {
    for (let cy = Math.floor(b.min.y / CEL); cy <= Math.floor(b.max.y / CEL); cy++) {
      for (let cz = Math.floor(b.min.z / CEL); cz <= Math.floor(b.max.z / CEL); cz++) {
        const l = grade.get(`${cx2}|${cy}|${cz}`);
        if (l) for (const q of l) if (q !== id) vizinhos.add(q);
      }
    }
  }
  let melhor = Infinity, quem = '—';
  for (const q of vizinhos) {
    const o = pecas[q];
    /* caixa contra caixa primeiro (barato), depois vértice contra vértice */
    const dx = Math.max(0, Math.max(p.box.min.x - o.box.max.x, o.box.min.x - p.box.max.x));
    const dy = Math.max(0, Math.max(p.box.min.y - o.box.max.y, o.box.min.y - p.box.max.y));
    const dz = Math.max(0, Math.max(p.box.min.z - o.box.max.z, o.box.min.z - p.box.max.z));
    const dCaixa = Math.hypot(dx, dy, dz);
    if (dCaixa >= melhor) continue;
    if (dCaixa <= TOCA) { melhor = dCaixa; quem = o.nome; if (melhor === 0) break; continue; }
    melhor = dCaixa; quem = o.nome;
  }
  if (melhor > TOCA) flut.push({ p, melhor, quem });
}
flut.sort((p, q) => Math.max(q.p.d.x, q.p.d.y, q.p.d.z) - Math.max(p.p.d.x, p.p.d.y, p.p.d.z));
out.push([`${CHASSI} · FLUTUANDO (nada a menos de ${mm(TOCA)} mm) — ${flut.length}`,
  '\n        ' + flut.slice(0, 34).map((f) => `${f.p.nome} ${mm(f.p.d.x)}×${mm(f.p.d.y)}×${mm(f.p.d.z)}`
    + ` · vão ${mm(f.melhor)} mm até ${f.quem}`
    + ` · x ${mm(f.p.box.min.x)}…${mm(f.p.box.max.x)} y ${mm(f.p.box.min.y)}…${mm(f.p.box.max.y)}`
    + ` z ${mm(f.p.box.min.z)}…${mm(f.p.box.max.z)}`).join('\n        ')]);
/* 4 · a grade lateral, malha a malha */
const g = [];
S.state.trailer.traverse((o) => {
  if (!o.isMesh || !visivel(o) || !o.geometry) return;
  let eh = false;
  for (let p = o; p; p = p.parent) if (/GRADE|PROTECAO|LATERAL|BARRA|ESTACAO|PONTA/i.test(p.name || '')) eh = true;
  if (!eh) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(W2Zn).multiply(o.matrixWorld);
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i += 3) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  if (b.isEmpty() || b.max.x < 0) return;
  g.push({ nome: o.name, b, inst: o.isInstancedMesh ? o.count : 0 });
});
g.sort((p, q) => q.b.max.z - p.b.max.z);
out.push([`2 · grade lateral no flanco x+ — ${g.length} malha(s)`,
  '\n        ' + g.slice(0, 26).map((t) => `${t.nome}${t.inst ? ` ×${t.inst}` : ''}`
    + ` z ${mm(t.b.min.z)}…${mm(t.b.max.z)} x ${mm(t.b.min.x)}…${mm(t.b.max.x)} y ${mm(t.b.min.y)}…${mm(t.b.max.y)}`).join('\n        ')]);
return out;
