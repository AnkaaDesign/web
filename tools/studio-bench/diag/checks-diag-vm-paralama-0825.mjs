/* SONDA — o para-lama do 2º direcional no VM bitruck: quem o corta. */
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
const a = acha('volvo-vm-2015', '8x2r');
relato.length = 0;
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
  modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
out.push(['0 · relato do motor (para-lama)', '\n        ' + relato.filter((l) => /para-lama|paralama|fender/i.test(l)).join('\n        ')]);

const cab = S.state.cab, mount = S.state.cabMount;
cab.updateWorldMatrix(true, true);
const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
const v = new THREE.Vector3();
out.push(['0 · eixos', `steerZ ${mount.axles.steerZ.map((z) => mm(z)).join(' · ')}`
  + ` · driveZ ${mount.axles.driveZ.map((z) => mm(z)).join(' · ')} · frameTopY ${mm(mount.frameTopY)}`]);

/* A peça montada. */
let peca = null;
cab.traverse((o) => { if (/paralama|fender/i.test(o.name || '') && o.name.startsWith('TS')) peca = o; });
cab.traverse((o) => { if (!peca && /^TS_.*(PARALAMA|FENDER)/i.test(o.name || '')) peca = o; });
const nomes = [];
cab.traverse((o) => { if (/^TS_/.test(o.name || '')) nomes.push(o.name); });
out.push(['0 · nós TS_ na cabine', nomes.join(' · ') || '—']);

const caixaZn = (o) => {
  const b = new THREE.Box3();
  o.traverse((n) => {
    const pos = n.isMesh ? n.geometry?.attributes?.position : null;
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(n.matrixWorld);
    const idx = n.geometry.getIndex?.();
    if (idx) { for (let q = 0; q < idx.count; q++) { const i = idx.getX(q); b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M)); } }
    else for (let i = 0; i < pos.count; i++) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
  });
  return b;
};
if (peca) {
  const bb = caixaZn(peca);
  out.push(['1 · o arco montado', `${peca.name} · x ${mm(bb.min.x)}…${mm(bb.max.x)}`
    + ` · y ${mm(bb.min.y)}…${mm(bb.max.y)} · z ${mm(bb.min.z)}…${mm(bb.max.z)}`]);
}
/* Quem está na janela do corte, à frente do eixo. */
const eixo = mount.axles.steerZ.length > 1 ? Math.max(...mount.axles.steerZ) : mount.axles.steerZ[0];
const eixo2 = mount.axles.steerZ.length > 1 ? Math.min(...mount.axles.steerZ) : eixo;
out.push(['1 · eixo do 2º direcional (Zn)', `${mm(eixo2)} (o 1º em ${mm(eixo)})`]);
const janela = new THREE.Box3(new THREE.Vector3(0.45, 0.55, eixo2), new THREE.Vector3(1.30, 1.60, eixo2 + 1.30));
const achados = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  for (let p = o; p; p = p.parent) { if (p === peca) return; }
  if (/wheel|tire|pneu|rim|aro|VM_WHEEL/i.test(o.name || '')) return;
  const pos = o.geometry.attributes?.position;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const b = new THREE.Box3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    if (!janela.containsPoint(v)) continue;
    b.expandByPoint(v); n++;
  }
  if (!n) return;
  achados.push({ nome: o.name, n, b, zMin: b.min.z });
});
achados.sort((p, q) => p.zMin - q.zMin);
out.push([`2 · na janela do corte (|x| 450…1300, y 550…1600, z ${mm(eixo2)}…${mm(eixo2 + 1.30)}) — ${achados.length}`,
  '\n        ' + achados.slice(0, 30).map((it) => `${it.nome} n=${it.n}`
    + ` x ${mm(it.b.min.x)}…${mm(it.b.max.x)} y ${mm(it.b.min.y)}…${mm(it.b.max.y)}`
    + ` z ${mm(it.b.min.z)}…${mm(it.b.max.z)}`).join('\n        ')]);
console.info = infoOrig;
return out;
