/* DIAGNÓSTICO — O TANDEM POR COMPONENTE CONEXO (Scania 6x2).
   ===========================================================================
   Antes de mover o conjunto de rodas é preciso saber QUEM cabe na janela e o
   que é estrutura do quadro. A unidade é o componente conexo — a mesma de
   `pegaOBerco()` (§46) —, e o que se procura é uma régua que separe suspensão,
   eixo, para-lama e roda das TRAVESSAS do chassi. */
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
const zD = mount.axles.driveZ[0], zL = mount.axles.liftZ[0];
const z1 = Math.max(zD, zL) + 0.95, z0 = Math.min(zD, zL) - 0.95;
const achados = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const pos = o.geometry?.attributes?.position, idx = o.geometry?.getIndex?.();
  if (!pos || !idx || pos.count > 200000) return;
  L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const pai = comps(idx, pos.count);
  const cx = new Map();
  for (let i = 0; i < pos.count; i++) {
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
  for (const [, b] of cx) {
    if (b.n < 60) continue;
    const cabe = b.z0 >= z0 && b.z1 <= z1;
    if (!cabe) continue;
    /* As rodas já são nós nossos e andam por matriz — o que interessa aqui é o
       que está DENTRO da malha do rip: suspensão, eixo, para-lama, travessa. */
    if (/^wheel_|^VM_WHEEL/.test(o.name || '')) continue;
    /* E fora a REBITAGEM DA LONGARINA: `chassis_p14` devolve centenas de
       componentes de 19 mm em |x| 408…440, que é a alma (railX 425). Eles cabem
       na janela e não são o tandem — quem move a longarina move o caminhão. */
    if (b.x1 < 0.50) continue;
    achados.push({ no: o.name, ...b });
  }
});
achados.sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) * (q.z1 - q.z0)
  - (p.x1 - p.x0) * (p.y1 - p.y0) * (p.z1 - p.z0));
out.push([`componentes que CABEM na janela do tandem (Zn ${mm(z0)}…${mm(z1)})`, '\n        '
  + achados.slice(0, 30).map((b) => `${b.no}: Zn ${mm(b.z0)}…${mm(b.z1)} · |x| ${mm(b.x0)}…${mm(b.x1)}`
    + ` · y ${mm(b.y0)}…${mm(b.y1)} · ${b.n} vért`).join('\n        ')]);
out.push(['mesa da longarina (frameTopY) e alma (railX)', `${mm(mount.frameTopY)} · ${mm(mount.railX)}`]);
return out;
