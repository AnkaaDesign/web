/* DIAGNÓSTICO DECISIVO — O DESLOCAMENTO ACUMULA ENTRE CARGAS?
   ===========================================================================
   *"voce esta quebrando tudo … e nem deveria ter movido mais as rodas ou estepe
   desse"* — Kennedy, 2026-08-25.

   `shiftRearBogie()` e o avanço do flanco ESCREVEM na cena do caminhão (matriz
   de nó e vértice). Se a árvore vier de um CACHE reaproveitado entre cargas, a
   segunda carga aplica o mesmo delta sobre uma geometria que já andou — e o
   conjunto sai andando sozinho a cada troca de chassi. Este check carrega o
   MESMO chassi três vezes, com uma ida a outro chassi no meio, e mede sempre a
   mesma coisa: o centro do cubo traseiro e o do estepe, em Zn. */
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
async function carrega(chassi) {
  const a = acha('scania-p', chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();
}
function mede(rot) {
  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const alvo = { roda: { z0: 9, z1: -9 }, estepe: { z0: 9, z1: -9 }, tanque: { z0: 9, z1: -9 },
    berco: { z0: 9, z1: -9 } };
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    let chave = null;
    for (let p = o; p; p = p.parent) {
      if (/^VM_WHEEL_DUAL/.test(p.name || '')) { chave = 'roda'; break; }
      if (/^VM_WHEEL_SPARE/.test(p.name || '')) { chave = 'estepe'; break; }
      if (/^TS_TANQUE/.test(p.name || '')) { chave = 'tanque'; break; }
    }
    if (!chave) return;
    const passo = pos.count > 40000 ? 7 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      const s = alvo[chave];
      s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
    }
  });
  out.push([`${rot}`, Object.entries(alvo)
    .map(([k, s]) => `${k} ${isFinite(s.z0) ? `${mm(s.z0)}…${mm(s.z1)}` : '—'}`).join(' · ')
    + ` · driveZ ${(S.state.cabMount.axles.driveZ || []).map(mm).join(',')}`]);
}
await carrega('6x2r'); mede('1ª carga do 6x2');
await carrega('4x2r');
await carrega('6x2r'); mede('2ª carga do 6x2 (depois do toco)');
await carrega('8x2r');
await carrega('6x2r'); mede('3ª carga do 6x2 (depois do bitruck)');
return out;
