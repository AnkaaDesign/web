/* SONDA VISUAL DE PERTO — o para-lama do 2º direcional do VM 8x2. */
const out = [];
const B = window.__bench;
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
const a = acha('volvo-vm-2015', '8x2r');
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
  modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
const cab = S.state.cab, mount = S.state.cabMount;
cab.updateWorldMatrix(true, true);
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
const eixo2 = Math.min(...mount.axles.steerZ);
const olha = async (nome, cam, alvo) => {
  S.camera.position.copy(P(...cam));
  S.controls.target.copy(P(...alvo));
  S.controls.update();
  for (let i = 0; i < 12; i++) await B.frame();
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
};
const CAM = [-3.2, 1.05, eixo2 + 1.35], ALVO = [-0.95, 0.72, eixo2 + 0.20];
await olha('perto-1-como-esta', CAM, ALVO);

const CORES = { chs_base_0_p4: 0xff0000, chs_base_0_p8: 0x00ff00, chs_base_0_p2: 0x0000ff,
  chs_base_0_p6: 0xff00ff, chs_base_0_p11: 0x00ffff, chassis_p3: 0xff8800,
  chs_base_0_p0: 0x884400, chs_base_0_p1: 0x00ff88, chs_base_0_p5: 0x8800ff,
  chs_base_0_p7: 0xffffff, chs_base_0_p9: 0x444444, chs_base_0_p10: 0x88ff00 };
const guardados = new Map();
cab.traverse((o) => {
  if (!o.isMesh) return;
  const cor = CORES[o.name];
  if (cor === undefined) return;
  guardados.set(o, o.material);
  o.material = new THREE.MeshBasicMaterial({ color: cor });
});
out.push(['legenda', Object.entries(CORES).map(([k, c]) => `${k}=${c.toString(16).padStart(6, '0')}`).join(' · ')]);
await olha('perto-2-pintado', CAM, ALVO);
for (const [o, m] of guardados) o.material = m;

/* 3 · sem os dois que o motor acusa como obstáculo. */
const escondidos = [];
cab.traverse((o) => {
  if (o.isMesh && (o.name === 'chs_base_0_p4' || o.name === 'chs_base_0_p8')) { o.visible = false; escondidos.push(o.name); }
});
out.push(['escondidos', escondidos.join(' · ') || '—']);
await olha('perto-3-sem-p4-p8', CAM, ALVO);
return out;
