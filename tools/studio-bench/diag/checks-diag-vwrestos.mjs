/* O QUE SÃO AS CHAPAS QUE APARECEM ATRÁS DA GRADE DO VW — de perto, e só o
   caminhão. Duas alturas de câmera e um recorte apertado; sem isso "os
   suportes da antiga grade ainda estão lá" continua sendo uma foto sem nome. */
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

let mk = null, mo = null, c = null;
for (const m of (S.catalog.catalog?.manufacturers || [])) {
  for (const md of (m.models || [])) {
    for (const ch of (md.chassis || [])) {
      if (`${md.id}/${ch.id}` === 'vw-constellation/8x2-tl') { mk = m; mo = md; c = ch; }
    }
  }
}
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id,
  modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null },
{ curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 25; i++) await B.frame();

const cab = S.state.cab, imp = S.state.trailer, mount = S.state.cabMount;
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
  .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const Ninv = new THREE.Matrix4().copy(N).invert();
const foto = (nome, alvoN, olhoN) => {
  const t = new THREE.Vector3(...alvoN).applyMatrix4(Ninv);
  const o = new THREE.Vector3(...olhoN).applyMatrix4(Ninv);
  controls.target.copy(t); camera.position.copy(o); camera.lookAt(t);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/webp', 0.9)]);
};

/* E QUEM É CADA MALHA: pinta de VERMELHO tudo que estiver na faixa da grade
   (|x| > 0,90 · y 0,45…1,25) e de VERDE o resto do caminhão. A cor responde a
   pergunta que a forma não responde. */
const vermelho = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const verde = new THREE.MeshBasicMaterial({ color: 0x203020 });
const guardados = [];
const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
const L2N = new THREE.Matrix4();
const v = new THREE.Vector3();
cab.traverse((node) => {
  const m = node;
  if (!m.isMesh || !m.geometry || !m.visible) return;
  const pos = m.geometry.getAttribute('position');
  if (!pos) return;
  L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
  let naFaixa = 0;
  const passo = pos.count > 40000 ? 5 : 1;
  for (let i = 0; i < pos.count; i += passo) {
    v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
    if (Math.abs(v.x) > 0.90 && v.y > 0.45 && v.y < 1.25) naFaixa++;
  }
  guardados.push([m, m.material]);
  m.material = naFaixa > 20 ? vermelho : verde;
});
for (const [m, mat] of guardados) m.material = mat;
imp.visible = false;
/* ⚠️ DE CIMA, e é isso que responde a pergunta: um poste ENTRE as longarinas é
   mobília de chassi-cabine (o berço de carroceria); um poste NO FLANCO é o que
   sobrou da grade de fábrica. A vista lateral não separa os dois — as duas
   caem no mesmo pixel. */
const z = -2.0;
foto('X-vw-cima-1', [0, 0.90, z], [2.4, 3.4, z + 1.2]);
foto('X-vw-cima-2', [0, 0.90, z], [0.2, 4.2, z + 0.2]);
foto('X-vw-lado-baixo', [0, 0.85, z], [3.4, 0.30, z - 1.0]);
imp.visible = true;
return out;
