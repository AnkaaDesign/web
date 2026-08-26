/* DE QUEM SÃO OS SUPORTES QUE APARECEM? — isola as duas árvores na mesma
   câmera. Uma foto com só o CAMINHÃO e outra com só o IMPLEMENTO respondem em
   um segundo o que a foto do conjunto não responde: se a chapinha preta some
   com o baú, ela é do baú; se fica, é do rip do caminhão. */
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

for (const id of ['vw-constellation/8x2-tl', 'vw-constellation/4x2-tl']) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) {
    for (const md of (m.models || [])) {
      for (const ch of (md.chassis || [])) {
        if (`${md.id}/${ch.id}` === id) { mk = m; mo = md; c = ch; }
      }
    }
  }
  if (!c) continue;
  const tag = id.replace(/[^\w]+/g, '-');
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id,
    modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null },
  { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  const cab = S.state.cab, imp = S.state.trailer, mount = S.state.cabMount;
  if (!mount) continue;
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
    out.push([nome, raw.toDataURL('image/webp', 0.88)]);
  };
  const eixos = [...mount.axles.steerZ, ...mount.axles.driveZ, ...mount.axles.liftZ];
  const zM = (Math.max(...eixos) + Math.min(...eixos)) / 2;
  const vista = [[0, 0.95, zM], [5.6, 0.9, zM + 1.0]];

  foto(`Q-${tag}-1-tudo`, ...vista);
  imp.visible = false; foto(`Q-${tag}-2-so-caminhao`, ...vista); imp.visible = true;
  cab.visible = false; foto(`Q-${tag}-3-so-implemento`, ...vista); cab.visible = true;
  /* E o para-lama sozinho, contra o céu — é assim que um furo na casca
     aparece (*"paralamas está com uma parte transparente agora"*). */
  const pl = cab.getObjectByName('TS_PARALAMA_DIR2');
  if (pl) {
    const escondidos = [];
    for (const raiz of [cab, imp]) {
      raiz.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        let guarda = false;
        for (let p = o; p && p !== raiz.parent; p = p.parent) if (p === pl) guarda = true;
        if (!guarda) { o.visible = false; escondidos.push(o); }
      });
    }
    const z2 = Math.min(...(mount.axles.steerZ || [0]));
    foto(`Q-${tag}-4-paralama-so`, [0, 0.9, z2], [4.2, 1.0, z2 + 0.5]);
    foto(`Q-${tag}-5-paralama-tras`, [0, 0.9, z2], [3.6, 0.8, z2 - 1.6]);
    for (const o of escondidos) o.visible = true;
  }
}
return out;
