/* DIAGNÓSTICO — OS DOIS RESERVATÓRIOS DE AR do Scania 6x2, por componente.
   ===========================================================================
   *"no truck, esses 2 tanques estacados devem estar perto do tanque prata"* —
   Kennedy, 2026-08-25.

   Eles são cilindros PRETOS empilhados, entre o tanque de combustível (que
   avançou 1 045 mm) e o estepe. Não são nó nenhum: moram dentro das malhas de
   caminhão inteiro. Lista os componentes conexos da faixa com caixa, material e
   PROPORÇÃO — um reservatório é um cilindro deitado, dois lados iguais. */
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
const a = acha('scania-p', '6x2r');
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
const L2N = new THREE.Matrix4();
const v = new THREE.Vector3();
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
const achados = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const pos = o.geometry?.attributes?.position, idx = o.geometry?.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
  L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const pai = comps(idx, pos.count);
  const cx = new Map();
  /* ⚠️ SÓ O QUE O ÍNDICE AINDA DESENHA: `apagaOrfaosDoFlanco()` recorta índice,
     e varrer `position` mostraria peça que já não existe na tela. */
  for (let q = 0; q < idx.count; q++) {
    const i = idx.getX(q);
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
    const r = pai[i];
    let b = cx.get(r);
    if (!b) { b = { x0: 9, x1: -9, y0: 9, y1: -9, z0: 9, z1: -9, n: 0 }; cx.set(r, b); }
    b.n++;
    const ax = Math.abs(v.x);
    b.x0 = Math.min(b.x0, ax); b.x1 = Math.max(b.x1, ax);
    b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y);
    b.z0 = Math.min(b.z0, v.z); b.z1 = Math.max(b.z1, v.z);
  }
  const mats = (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
  const mat = mats.map((m) => m.name || '?').join('|');
  for (const [, b] of cx) {
    if (b.n < 200) continue;
    /* A JANELA DO ESTEPE (que já avançou 300 mm): Zn -3 700…-2 400. */
    if (b.z0 < -3.90 || b.z1 > -2.30) continue;
    if (b.x1 < 0.20) continue;
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0;
    if (Math.max(dx, dy, dz) > 1.4 || Math.max(dx, dy, dz) < 0.10) continue;
    achados.push({ no: o.name, mat, dx, dy, dz, ...b });
  }
});
achados.sort((p, q) => (q.dx * q.dy * q.dz) - (p.dx * p.dy * p.dz));
out.push(['componentes na janela do ESTEPE (Zn −3 900…−2 300)', '\n        '
  + achados.slice(0, 20).map((b) => `${b.no} [${b.mat}]: Zn ${mm(b.z0)}…${mm(b.z1)}`
    + ` · |x| ${mm(b.x0)}…${mm(b.x1)} · y ${mm(b.y0)}…${mm(b.y1)}`
    + ` · ${mm(b.dx)}×${mm(b.dy)}×${mm(b.dz)} · ${b.n} idx`).join('\n        ')]);
return out;
