/* SONDA VISUAL — pinta os vizinhos do para-lama do 2º direcional do VM 8x2. */
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
/* Zn → MUNDO: `cab.matrixWorld · N⁻¹`. */
const Zn2W = new THREE.Matrix4().copy(cab.matrixWorld).multiply(N.clone().invert());
const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
const eixo2 = Math.min(...mount.axles.steerZ);

const olha = async (nome, camZn, alvoZn) => {
  const c = P(...camZn), t = P(...alvoZn);
  S.camera.position.copy(c);
  S.controls.target.copy(t);
  S.controls.update();
  for (let i = 0; i < 12; i++) await B.frame();
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
};
/* 1 · como está, dos dois flancos. */
await olha('vm-dir2-flanco-mais', [4.5, 1.30, eixo2 + 1.4], [0.9, 0.80, eixo2 + 0.15]);
await olha('vm-dir2-flanco-menos', [-4.5, 1.30, eixo2 + 1.4], [-0.9, 0.80, eixo2 + 0.15]);

/* 2 · pintados. */
const CORES = { chs_base_0_p4: 0xff0000, chs_base_0_p8: 0x00ff00, chs_base_0_p2: 0x0000ff,
  chs_base_0_p3: 0xffff00, chs_base_0_p6: 0xff00ff, chs_base_0_p11: 0x00ffff,
  chassis_p3: 0xff8800 };
const pintadas = [];
cab.traverse((o) => {
  if (!o.isMesh) return;
  const cor = CORES[o.name];
  if (cor === undefined) return;
  o.material = new THREE.MeshBasicMaterial({ color: cor });
  pintadas.push(o.name);
});
out.push(['pintadas', pintadas.join(' · ')]);
await olha('vm-dir2-pintado-mais', [4.5, 1.30, eixo2 + 1.4], [0.9, 0.80, eixo2 + 0.15]);
await olha('vm-dir2-pintado-menos', [-4.5, 1.30, eixo2 + 1.4], [-0.9, 0.80, eixo2 + 0.15]);
return out;
