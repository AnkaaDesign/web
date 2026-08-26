/* DIAGNÓSTICO — QUEM É CADA PEÇA DO FLANCO, com MATERIAL e cor.
   ===========================================================================
   *"esses 2 tanques pretos stackados deve ir para próximo ao tanque que foi
   movido, e falta corrigir o suporte do tanque pequeno com tampa verde, que
   está dentro do tanque grande"* — Kennedy, 2026-08-24.

   Lista, no vão do 6x2 e do 8x2, tudo o que tem geometria no flanco com o NOME
   do nó, o MATERIAL e a COR-BASE — que é como se acha "o preto empilhado" e "o
   de tampa verde" sem adivinhar. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
const hex = (c) => (c ? '#' + c.getHexString() : '—');
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
for (const chassi of ['6x2r', '8x2r']) {
  const a = acha('scania-p', chassi);
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
  const zT = mount.axles.driveZ[0];
  const linhas = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const passo = pos.count > 120000 ? 3 : 1;
    let s = null;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      const ax = Math.abs(v.x);
      if (v.y < 0.15 || v.y > 1.35) continue;
      if (v.z < -3.60 || v.z > -1.60) continue;
      if (!s) s = { z0: Infinity, z1: -Infinity, x0: Infinity, x1: 0, y0: Infinity, y1: -Infinity, n: 0 };
      s.n++; s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
      s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
    }
    if (!s || s.n < 40) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
    linhas.push({ nome: o.name || '?', ...s,
      mat: mats.map((m) => `${m.name || '?'} ${hex(m.color)}`).join(' | ') });
  });
  linhas.sort((p, q) => q.z0 - p.z0);
  out.push([`${chassi} · peças do flanco no vão (frente → trás)`, '\n        '
    + linhas.slice(0, 45).map((s) => `${s.nome}: Zn ${mm(s.z0)}…${mm(s.z1)} · |x| ${mm(s.x0)}…${mm(s.x1)}`
      + ` · y ${mm(s.y0)}…${mm(s.y1)} · ${s.n} pts · ${s.mat}`).join('\n        ')]);
}
return out;
