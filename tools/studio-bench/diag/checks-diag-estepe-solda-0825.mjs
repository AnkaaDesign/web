/* ▶▶▶ O MESMO CENSO, MAS SOLDANDO VÉRTICE POR POSIÇÃO.
   ===========================================================================
   A hipótese: o bitruck é o RIP e os outros três são RECORTE — e o recorte
   passa por Draco, que deduplica vértice. Então a mesma peça é UM componente
   no toco e DEZENAS de tiras no bitruck, e é por isso que o conjunto anda
   partido lá e inteiro aqui.

   Este check mede as duas contas lado a lado, na mesma região. */
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
/* Sem solda — a conta do motor hoje. */
function compsCru(idx, n) {
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
/* Com solda — mesma grade de 0,5 mm de `glb-surgery.cjs`. */
const WELD = 5e-4, GRID = 65536;
function compsSolda(pos, idx) {
  const nv = pos.count;
  const mapa = new Map();
  const rep = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const ix = Math.round(pos.getX(v) / WELD) + GRID / 2;
    const iy = Math.round(pos.getY(v) / WELD) + GRID / 2;
    const iz = Math.round(pos.getZ(v) / WELD) + GRID / 2;
    const k = (ix * GRID + iy) * GRID + iz;
    let r = mapa.get(k);
    if (r === undefined) { r = v; mapa.set(k, v); }
    rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  for (let q = 0; q < idx.count; q += 3) {
    const a = raiz(rep[idx.getX(q)]), b = raiz(rep[idx.getX(q + 1)]), c = raiz(rep[idx.getX(q + 2)]);
    if (a !== b) pai[b] = a;
    if (a !== c) pai[c] = a;
  }
  const saida = new Int32Array(nv);
  for (let v = 0; v < nv; v++) saida[v] = raiz(rep[v]);
  return saida;
}
const INFLA = new THREE.Vector3(0.16, 0.42, 0.16);

async function mede(chassi) {
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
  const v = new THREE.Vector3();
  const spare = cab.getObjectByName('VM_WHEEL_SPARE');
  const cxE = new THREE.Box3();
  spare.traverse((n) => {
    const m = n;
    const pos = m.isMesh ? m.geometry?.attributes?.position : null;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(m.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) cxE.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  const centro = cxE.getCenter(new THREE.Vector3());
  const reg = new THREE.Box3(cxE.min.clone().sub(INFLA), cxE.max.clone().add(INFLA));
  const res = { cru: [], solda: [], centro, cxE, foraSolda: [] };
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    for (let p = o; p; p = p.parent) if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return;
    const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
    if (!pos || !idx || pos.count > 260000) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    for (const modo of ['cru', 'solda']) {
      const pai = modo === 'cru' ? compsCru(idx, pos.count) : compsSolda(pos, idx);
      const caixas = new Map();
      for (let q = 0; q < idx.count; q += 3) {
        const r = pai[idx.getX(q)];
        let b = caixas.get(r);
        if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
        for (let k = 0; k < 3; k++) {
          const i = idx.getX(q + k);
          b.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
          b.n++;
        }
      }
      for (const [, b] of caixas) {
        if (!b.box.intersectsBox(reg)) continue;
        const d = b.box.getSize(new THREE.Vector3());
        const rel = b.box.getCenter(new THREE.Vector3()).sub(centro);
        const it = { nome: o.name, n: b.n, maior: Math.max(d.x, d.y, d.z),
          chave: `${o.name}|${mm(d.x)}x${mm(d.y)}x${mm(d.z)}`,
          pos: `${mm(rel.x)},${mm(rel.y)},${mm(rel.z)}` };
        if (reg.containsBox(b.box)) res[modo].push(it);
        else if (modo === 'solda') res.foraSolda.push(it);
      }
    }
  });
  res.cru.sort((a, b2) => b2.maior - a.maior);
  res.solda.sort((a, b2) => b2.maior - a.maior);
  return res;
}
const cfg = ['4x2r', '8x2r'];
const D = {};
for (const c of cfg) D[c] = await mede(c);
for (const c of cfg) {
  out.push([`0 · ${c}`, `sem solda ${D[c].cru.length} comp. · COM SOLDA ${D[c].solda.length} comp.`
    + ` (${D[c].foraSolda.length} atravessam)`]);
}
for (const c of cfg) {
  out.push([`1 · ${c} — COM SOLDA, do maior ao menor (top 70)`,
    '\n        ' + D[c].solda.slice(0, 70).map((it) => `${it.chave} n=${it.n} @${it.pos}`).join('\n        ')]);
}
/* O casamento entre toco e bitruck, com solda: a mesma peça tem de ter a mesma
   chave nos dois (a posição difere de 400 mm no z quando não andou). */
const chaves = (L) => new Set(L.map((it) => it.chave));
const kT = chaves(D['4x2r'].solda), kB = chaves(D['8x2r'].solda);
out.push(['2 · chaves iguais (toco ∩ bitruck), com solda',
  `${[...kT].filter((k) => kB.has(k)).length} de ${kT.size} / ${kB.size}`]);
const kTc = chaves(D['4x2r'].cru), kBc = chaves(D['8x2r'].cru);
out.push(['3 · … e sem solda', `${[...kTc].filter((k) => kBc.has(k)).length} de ${kTc.size} / ${kBc.size}`]);
return out;
