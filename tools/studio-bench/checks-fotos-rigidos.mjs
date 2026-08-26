/* AS FOTOS DOS DEZ RÍGIDOS — flanco, trem dianteiro, meio e tandem.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-fotos-rigidos.mjs

   O portão de varredura diz ONDE estão os cruzamentos; estas fotos dizem se
   eles APARECEM. Elas enquadram em espaço NORMALIZADO (o mesmo de
   `mounts.json`), então o mesmo nome de arquivo mostra o mesmo pedaço do
   caminhão nas dez configurações — é o que permite comparar antes e depois.

   Os dois flancos, porque metade dos defeitos deste acervo é de um lado só. */

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
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}

for (const a of alvos) {
  const rot = `${a.mo.id}-${a.c.id}`;
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  const cab = S.state.cab;
  const mount = S.state.cabMount;
  if (!mount) continue;
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  const Ninv = new THREE.Matrix4().copy(N).invert();

  const foto = (nome, alvoN, olhoN) => {
    const t = new THREE.Vector3(...alvoN).applyMatrix4(Ninv);
    const o = new THREE.Vector3(...olhoN).applyMatrix4(Ninv);
    controls.target.copy(t);
    camera.position.copy(o);
    camera.lookAt(t);
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
    renderer.render(scene, camera);
    /* ⚠️ WEBP, E NÃO PNG. Um lote de 110 PNG de 1 152 × 720 é ~110 MB num único
       retorno de `Runtime.evaluate`, e o CDP simplesmente não volta — a bancada
       fica 20 min parada e morre no `timeout`. Em webp 0,88 o mesmo lote dá
       ~8 MB e volta em segundos, com perda que não muda nada do que estas
       fotos existem para mostrar (peça dentro de peça). */
    out.push([nome, raw.toDataURL('image/webp', 0.88)]);
  };

  const steer = [...(mount.axles.steerZ || [])].sort((x, y) => y - x);
  const drive = [...mount.axles.driveZ, ...mount.axles.liftZ].sort((x, y) => y - x);
  const zFrente = steer[0] ?? 2;
  const zTras = drive[drive.length - 1] ?? -5;
  const zMeio = (zFrente + zTras) / 2;
  const z2dir = steer.length > 1 ? steer[1] : zFrente;

  for (const [lado, sig] of [['D', 1], ['E', -1]]) {
    /* 1 · o conjunto inteiro, de perfil e de perto o bastante para ler a saia */
    foto(`R-${rot}-${lado}-1-flanco`, [0, 1.1, zMeio], [sig * 16, 1.6, zMeio]);
    /* 2 · o trem dianteiro (é onde mora o para-lama do 2º direcional) */
    foto(`R-${rot}-${lado}-2-frente`, [0, 0.95, (zFrente + z2dir) / 2],
      [sig * 6.2, 1.15, (zFrente + z2dir) / 2 - sig * 0.2]);
    /* 3 · o meio: tanque, grade e o vão entre a grade e a barriga do baú */
    foto(`R-${rot}-${lado}-3-meio`, [0, 0.85, zMeio], [sig * 6.0, 1.0, zMeio + 0.8]);
    /* 4 · o tandem, com a ponta do corrido e a roda */
    foto(`R-${rot}-${lado}-4-tandem`, [0, 0.85, zTras + 0.4], [sig * 5.2, 1.0, zTras + 1.6]);
    /* 5 · de baixo, 30 cm do chão — é o ângulo em que "peça dentro de peça"
           aparece, e nenhuma foto anterior desta frente o tinha. */
    foto(`R-${rot}-${lado}-5-baixo`, [0, 0.55, zMeio], [sig * 4.6, -0.25, zMeio + 1.2]);
  }
  /* 6 · três quartos traseiro, para ver a grade contra o tandem */
  foto(`R-${rot}-Q-6-tres-quartos`, [0, 1.0, zTras], [7.0, 1.4, zTras + 5.5]);
}

return out;
