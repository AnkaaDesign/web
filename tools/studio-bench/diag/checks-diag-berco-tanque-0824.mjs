/* DIAGNÓSTICO — O QUE FICOU NA POSIÇÃO ANTIGA DO TANQUE (Scania 6x2).
   ===========================================================================
   *"faltou mover o suporte do componente com a tampa azul"* — Kennedy.

   Depois do avanço do flanco (§49), o conjunto tanque+ARLA foi para a frente e
   alguma coisa ficou. Este diagnóstico varre o flanco na FAIXA ANTIGA
   (Zn −2 800…−900) VÉRTICE A VÉRTICE, sem filtro de tamanho de malha — porque é
   justamente dentro das malhas de caminhão inteiro (`chassis_p15`, `p18`) que
   berço e cintas moram. */
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

/* Tudo o que tem vértice na faixa antiga, POR MALHA — inclusive as longas. */
for (const [z0, z1, rot] of [[-2.90, -0.90, 'FAIXA ANTIGA do tanque (Zn −2 900…−900)'],
  [-0.90, 0.60, 'FAIXA NOVA (Zn −900…600)']]) {
  const nos = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    let s = null;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      const ax = Math.abs(v.x);
      if (ax < 0.45 || v.y < 0.25 || v.y > 1.20) continue;
      if (v.z < z0 || v.z > z1) continue;
      if (!s) s = { z0: Infinity, z1: -Infinity, x0: Infinity, x1: 0, y0: Infinity, y1: -Infinity, n: 0 };
      s.n++; s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
      s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
    }
    if (s && s.n > 20) nos.set(o.name || '?', s);
  });
  out.push([rot, '\n        ' + [...nos].sort((p, q) => q[1].n - p[1].n).slice(0, 18)
    .map(([n, s]) => `${n}: Zn ${mm(s.z0)}…${mm(s.z1)} · |x| ${mm(s.x0)}…${mm(s.x1)} · y ${mm(s.y0)}…${mm(s.y1)} · ${s.n} pts`)
    .join('\n        ')]);
}

const bb = new THREE.Box3().setFromObject(cab);
const c = bb.getCenter(new THREE.Vector3());
S.camera.position.set(c.x + 6.0, 1.15, c.z + 3.2);
S.controls.target.set(c.x - 0.2, 0.95, c.z + 2.6);
S.controls.update();
for (let i = 0; i < 12; i++) await B.frame();
out.push(['foto-berco-6x2', S.renderer.domElement.toDataURL('image/png')]);
return out;
