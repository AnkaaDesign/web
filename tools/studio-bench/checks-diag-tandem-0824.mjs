/* DIAGNÓSTICO — O CONJUNTO TRASEIRO do Scania 6x2: quem anda com o tandem.
   ===========================================================================
   *"agora mova o conjunto completo de rodas e estepe 50 cm para frente"* —
   Kennedy, 2026-08-24.

   Antes de mover: QUEM é o conjunto. Lista, por NÓ, tudo o que tem geometria
   entre o eixo trativo e o auxiliar (± 900 mm), separando o que é NÓ PRÓPRIO
   (anda por matriz, barato e seguro) do que está dentro de malha de caminhão
   inteiro (precisa de componente conexo). */
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
const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
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
const zD = mount.axles.driveZ[0], zL = mount.axles.liftZ[0];
const z1 = Math.max(zD, zL) + 0.95, z0 = Math.min(zD, zL) - 0.95;

const nos = new Map();
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const pos = o.geometry.attributes.position;
  L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const passo = pos.count > 150000 ? 3 : 1;
  let dentro = 0, fora = 0;
  let b = { z0: Infinity, z1: -Infinity, x: 0, y0: Infinity, y1: -Infinity };
  for (let i = 0; i < pos.count; i += passo) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
    if (v.z >= z0 && v.z <= z1) {
      dentro++;
      b.z0 = Math.min(b.z0, v.z); b.z1 = Math.max(b.z1, v.z);
      b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y);
      b.x = Math.max(b.x, Math.abs(v.x));
    } else fora++;
  }
  if (dentro > 20) nos.set(o.name || '?', { ...b, dentro, fora,
    todo: fora === 0, pai: o.parent?.name || '' });
});
const l = [...nos].sort((p, q) => q[1].dentro - p[1].dentro);
out.push([`conjunto traseiro · janela Zn ${mm(z0)}…${mm(z1)} (trativo ${mm(zD)}, auxiliar ${mm(zL)})`,
  '\n        ' + l.slice(0, 30).map(([n, s]) =>
    `${n}${s.todo ? ' [NÓ INTEIRO]' : ` [${s.dentro} de ${s.dentro + s.fora}]`}: `
    + `Zn ${mm(s.z0)}…${mm(s.z1)} · |x| até ${mm(s.x)} · y ${mm(s.y0)}…${mm(s.y1)}`
    + (s.pai ? ` · pai ${s.pai}` : '')).join('\n        ')]);
out.push(['nós que cabem INTEIROS na janela',
  l.filter(([, s]) => s.todo).map(([n]) => n).join(' · ') || 'nenhum']);
return out;
