/* QUINZE — o rebite a 0,4 m: 1 px ≈ 0,5 mm. A esta distância não há aliasing
   que explique nada, e a forma da calota aparece inteira.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-scania15-0822.mjs */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(2)}`);

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
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;
t.updateWorldMatrix(true, true);

const rr = [];
t.traverse((o) => { if (o.isMesh && /^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) rr.push(o); });
/* O flanco que a câmera vai ver: o de maior x DE MUNDO. */
let alvoMesh = null, caixa = null;
for (const o of rr) {
  const b = new THREE.Box3().setFromObject(o);
  if (!caixa || b.max.x > caixa.max.x) { caixa = b; alvoMesh = o; }
}
out.push(['baú no mundo', (() => {
  const b = new THREE.Box3().setFromObject(t);
  return `x ${mm(b.min.x)}…${mm(b.max.x)} · y ${mm(b.min.y)}…${mm(b.max.y)} · z ${mm(b.min.z)}…${mm(b.max.z)}`;
})()]);
out.push(['fileira no mundo', caixa
  ? `x ${mm(caixa.min.x)}…${mm(caixa.max.x)} · y ${mm(caixa.min.y)}…${mm(caixa.max.y)}`
    + ` · z ${mm(caixa.min.z)}…${mm(caixa.max.z)}`
  : '—']);

/* ⚠️ `controls.update()` GRUDA A CÂMERA NA DISTÂNCIA MÍNIMA DO ORBIT.
   Todas as fotos "de 0,4 m" das voltas anteriores saíram de ~4 m por causa
   disto: pede-se a posição, o `update()` a empurra de volta para
   `minDistance` e o quadro sai dez vezes mais largo do que se pediu — e aí
   uma calota de 11 mm cai em meio pixel e vira fita. Aqui o limite é
   afrouxado durante a foto e devolvido depois. */
const limA = controls.minDistance, limB = controls.maxDistance, nearA = camera.near;
function foto(nome, alvo, cam) {
  controls.minDistance = 0.02; controls.maxDistance = 1e5;
  /* ⚠️ E O PLANO PRÓXIMO. A 0,4 m ele estava CORTANDO A PAREDE INTEIRA — o
     quadro mostrava o interior do baú (os ganchos) e parecia que os rebites
     tinham virado pinos. Foto de perto mexe nos dois limites, não em um. */
  camera.near = 0.02; camera.updateProjectionMatrix();
  controls.target.copy(alvo);
  camera.position.copy(cam);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([`${nome} · câmera`, `de ${mm(camera.position.x)},${mm(camera.position.y)},`
    + `${mm(camera.position.z)} para ${mm(controls.target.x)},${mm(controls.target.y)},`
    + `${mm(controls.target.z)} · dist ${mm(camera.position.distanceTo(controls.target))}`
    + ` · fov ${camera.fov?.toFixed(1)}`]);
  out.push([nome, raw.toDataURL('image/png')]);
  controls.minDistance = limA; controls.maxDistance = limB;
  camera.near = nearA; camera.updateProjectionMatrix();
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const zc = (caixa.min.z + caixa.max.z) / 2;
const yc = (caixa.min.y + caixa.max.y) / 2;
const alvo = V(caixa.max.x, yc, zc);
const vr = rr.map((o) => o.visible);

/* De frente, quase perpendicular: 0,40 m. */
foto('q15-0-frente', alvo, V(caixa.max.x + 0.40, yc + 0.05, zc + 0.06));
for (const o of rr) o.visible = false;
foto('q15-1-frente-sem', alvo, V(caixa.max.x + 0.40, yc + 0.05, zc + 0.06));
rr.forEach((o, i) => { o.visible = vr[i]; });

/* E de esguelha, que é como o defeito aparece — mas de PERTO. */
foto('q15-2-esguelha', alvo, V(caixa.max.x + 0.28, yc + 0.10, zc + 1.20));
for (const o of rr) o.visible = false;
foto('q15-3-esguelha-sem', alvo, V(caixa.max.x + 0.28, yc + 0.10, zc + 1.20));
rr.forEach((o, i) => { o.visible = vr[i]; });

return out;
