/* DEZESSETE — POR QUE A ARTE DA TRASEIRA LÊ MAIS LAVADA QUE A DA LATERAL.
   ===========================================================================
   *"a logo que coloquei na traseira parece muito mais lavada, opaca e
   esbranquiçada que a da lateral, que está muito mais vívida"* — Kennedy,
   2026-08-22, duas vezes.

   O material da sobreposição é criado no MESMO `makeLiveryOverlay()` para as
   cinco faces, então "é o material" já está descartado por leitura de código.
   O que ainda não foi medido é (a) o ESTADO desses materiais depois que a
   sonda de reflexo passa e (b) o que cada face RECEBE de luz — que é o que
   decide se um branco lê branco ou lê leitoso.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania17-0822.mjs */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 40; i++) await B.frame();

const t = S.state.trailer;
t.updateWorldMatrix(true, true);

/* ═══════════ A. AS CHAPAS E AS SOBREPOSIÇÕES, LADO A LADO ═══════════ */
const chapas = {};
t.traverse((o) => {
  if (!o.isMesh) return;
  if (/^(SIDE_L|SIDE_R|REAR|FRONT|TRAILER_ROOF)$/.test(o.name || '')) chapas[o.name] = o;
});
out.push(['A · chapas achadas', Object.keys(chapas).join(' · ') || 'nenhuma']);

const resumo = (m) => m ? JSON.stringify({
  tipo: m.type, cor: '#' + m.color?.getHexString?.(),
  metal: m.metalness, rough: m.roughness,
  env: !!m.envMap, envI: m.envMapIntensity,
  transp: m.transparent, op: m.opacity, blend: m.blending,
  depthW: m.depthWrite, toneMapped: m.toneMapped,
  emissive: '#' + m.emissive?.getHexString?.(), emissiveI: m.emissiveIntensity,
  aoI: m.aoMapIntensity, lightMap: !!m.lightMap, aoMap: !!m.aoMap,
  vis: m.visible, temMapa: !!m.map, canal: m.map?.channel,
  colorSpace: m.map?.colorSpace,
}) : '—';

for (const [nome, o] of Object.entries(chapas)) {
  const base = Array.isArray(o.material) ? o.material[0] : o.material;
  out.push([`A · ${nome} · chapa`, resumo(base)]);
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  out.push([`A · ${nome} · sobreposição`, ov
    ? resumo(Array.isArray(ov.material) ? ov.material[0] : ov.material)
      + ` · renderOrder ${ov.renderOrder} · visível ${ov.visible}`
    : 'NENHUMA']);
}

/* ═══════════ B. O QUE CADA FACE RECEBE DE LUZ ═══════════
   A chapa é a MESMA branca nas quatro faces. Então o que sair diferente no
   pixel é luz, não material — e é o que decide se um branco lê branco ou
   lê leitoso. Para medir sem depender de arte, a câmera olha cada face de
   frente e se lê a mediana da chapa nua. */
function olha(o) {
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(new THREE.Vector3());
  const n = new THREE.Vector3();
  /* A normal da face é o eixo MAIS CURTO da caixa. */
  const d = b.getSize(new THREE.Vector3());
  if (d.x <= d.y && d.x <= d.z) n.set(Math.sign(c.x) || 1, 0, 0);
  else if (d.z <= d.y) n.set(0, 0, Math.sign(c.z - 7.6) || 1);
  else n.set(0, 1, 0);
  const dist = Math.max(d.x, d.y, d.z) * 1.1 + 2;
  controls.minDistance = 0.02; controls.maxDistance = 1e5;
  const nearA = camera.near; camera.near = 0.05;
  controls.target.copy(c);
  camera.position.copy(c.clone().addScaledVector(n, dist));
  camera.lookAt(c);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  camera.near = nearA; camera.updateProjectionMatrix();
  return raw.toDataURL('image/png');
}
for (const nome of ['SIDE_R', 'REAR', 'FRONT']) {
  if (chapas[nome]) out.push([`q17-${nome}`, olha(chapas[nome])]);
}

/* ═══════════ C. AS LUZES E O AMBIENTE DA CENA ═══════════ */
const luzes = [];
scene.traverse((o) => {
  if (o.isLight) {
    luzes.push(`${o.type}${o.name ? `(${o.name})` : ''} i=${o.intensity.toFixed(2)}`
      + (o.position ? ` @ ${o.position.toArray().map((v) => v.toFixed(1)).join(',')}` : '')
      + (o.castShadow ? ' ✧sombra' : ''));
  }
});
out.push(['C · luzes', luzes.join(' · ')]);
out.push(['C · ambiente', `environment ${!!scene.environment}`
  + ` · envIntensity ${scene.environmentIntensity ?? '—'}`
  + ` · toneMapping ${renderer.toneMapping} exp ${renderer.toneMappingExposure}`]);

return out;
