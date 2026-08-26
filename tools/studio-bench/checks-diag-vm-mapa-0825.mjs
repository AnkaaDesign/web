/* SONDA — MAPA DE NOMES sobre o quadro: um raio por célula, letra por malha. */
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
const W2Zn = new THREE.Matrix4().copy(N).multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Zn2W);
const eixo2 = Math.min(...mount.axles.steerZ);
/* Enquadramento da foto do dono: da caixa de bateria ao para-barro. */
S.camera.position.copy(P(2.35, 0.98, eixo2 - 0.70));
S.controls.target.copy(P(0.95, 0.80, eixo2 + 0.20));
S.controls.update();
for (let i = 0; i < 14; i++) await B.frame();
out.push(['foto-mapa', S.renderer.domElement.toDataURL('image/png')]);
const rc = new THREE.Raycaster();
const letras = new Map();
const ordem = [];
const COLS = 78, ROWS = 30;
const linhas = [];
for (let r = 0; r < ROWS; r++) {
  let s = '';
  for (let c = 0; c < COLS; c++) {
    const fx = (c + 0.5) / COLS, fy = (r + 0.5) / ROWS;
    rc.setFromCamera(new THREE.Vector2(fx * 2 - 1, -(fy * 2 - 1)), S.camera);
    const hits = rc.intersectObject(cab, true).filter((h) => h.object.visible);
    if (!hits.length) { s += '.'; continue; }
    const nome = hits[0].object.name || '?';
    let L = letras.get(nome);
    if (L === undefined) {
      L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[ordem.length] || '#';
      letras.set(nome, L); ordem.push(nome);
    }
    s += L;
  }
  linhas.push(s);
}
out.push(['mapa', '\n        ' + linhas.join('\n        ')]);
out.push(['legenda', '\n        ' + ordem.map((n) => `${letras.get(n)} = ${n}`).join('\n        ')]);
return out;
