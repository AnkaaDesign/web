/* DEZOITO — A PROVA EM PIXEL do véu especular da arte.
   ===========================================================================
   A mesma cor de adesivo (o azul-marinho da 137) é posta na LATERAL e na
   TRASEIRA, cada face é fotografada DE ESGUELHA (que é como o dono olha a
   traseira), e mede-se a mediana. Roda duas vezes: com o acabamento novo (o
   da chapa) e com o antigo (rugosidade 0,55 · metal 0,10 · env 1,00).

   O que se espera, se o diagnóstico estiver certo: no acabamento antigo a
   traseira lê MAIS CLARA e MENOS SATURADA que a lateral; no novo, as duas
   caem juntas.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania18-0822.mjs */

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

const chapas = {};
t.traverse((o) => {
  if (o.isMesh && /^(SIDE_R|REAR)$/.test(o.name || '')) chapas[o.name] = o;
});
const ovs = {};
for (const [nome, o] of Object.entries(chapas)) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  if (ov) ovs[nome] = ov;
}
out.push(['faces', Object.keys(ovs).join(' · ')]);

/* A COR DE ADESIVO, sem textura: `color` multiplica o mapa, e sem mapa ela é
   o pigmento puro. É o mesmo pigmento nas duas faces, então o que sair
   diferente é só o que a luz e o acabamento fazem com ele. */
const AZUL = 0x1b3a6b;
const guarda = [];
for (const [nome, ov] of Object.entries(ovs)) {
  const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
  guarda.push([nome, m, m.map, m.visible, m.transparent, m.roughness, m.metalness,
    m.envMapIntensity, m.color.clone()]);
  m.map = null;
  m.transparent = false;
  m.color.setHex(AZUL);
  m.visible = true;
  m.needsUpdate = true;
}

const limA = controls.minDistance, limB = controls.maxDistance, nearA = camera.near;
function miraEsguelha(o, giroDeg) {
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(new THREE.Vector3());
  const d = b.getSize(new THREE.Vector3());
  const n = new THREE.Vector3();
  if (d.x <= d.y && d.x <= d.z) n.set(Math.sign(c.x) || 1, 0, 0);
  else n.set(0, 0, Math.sign(c.z - 7.6) || 1);
  /* Gira a câmera `giroDeg` em torno do eixo vertical: 0° é de frente. */
  const a = THREE.MathUtils.degToRad(giroDeg);
  const dir = n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).normalize();
  const dist = Math.max(d.x, d.y, d.z) * 0.9 + 2.5;
  controls.minDistance = 0.02; controls.maxDistance = 1e5; camera.near = 0.05;
  controls.target.copy(c);
  camera.position.copy(c.clone().addScaledVector(dir, dist));
  camera.lookAt(c);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  controls.minDistance = limA; controls.maxDistance = limB;
  camera.near = nearA; camera.updateProjectionMatrix();
  return raw.toDataURL('image/png');
}

function acabamento(rough, metal, envI) {
  for (const ov of Object.values(ovs)) {
    const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
    m.roughness = rough; m.metalness = metal; m.envMapIntensity = envI;
    m.needsUpdate = true;
  }
}

for (const [rot, r, mtl, e] of [
  ['novo (o da chapa)', 1, 0.05, 1.35],
  ['antigo (proprio)', 0.55, 0.10, 1.00],
]) {
  acabamento(r, mtl, e);
  for (const [nome, o] of Object.entries(chapas)) {
    for (const giro of [0, 55]) {
      out.push([`q18-${rot.split(' ')[0]}-${nome}-${giro}`, miraEsguelha(o, giro)]);
    }
  }
}

/* devolve tudo */
for (const [, m, map, vis, tr, r, mt, e, cor] of guarda) {
  m.map = map; m.visible = vis; m.transparent = tr;
  m.roughness = r; m.metalness = mt; m.envMapIntensity = e; m.color.copy(cor);
  m.needsUpdate = true;
}

return out;
