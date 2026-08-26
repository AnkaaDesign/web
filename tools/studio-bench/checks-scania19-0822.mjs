/* DEZENOVE — O AZUL DA ARTE, pelo caminho REAL (canvas + alfa + uv1).
   ===========================================================================
   O ensaio anterior (q18) pintou `material.color` com `map = null` e
   `transparent = false`. Isso mede o pigmento, mas NÃO mede o caminho que a
   arte de verdade percorre: textura sRGB no canal 1, alfa por pixel e mistura
   com a chapa por trás. E o dono é claro sobre o recorte da queixa:

     *"a traseira e lateral estão cinza, devem ser, mas o azul da traseira está
     muito mais acinzentado, enquanto o da lateral é vívido"*

   Ou seja: a CHAPA pode ser mais escura atrás — isso é a luz e está certo. O
   que não pode é o AZUL perder saturação. Aqui se desenha o mesmo azul no
   canvas de cada face e se mede o pixel nas duas, do ângulo da foto dele.

     node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-scania19-0822.mjs */

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

const faces = {};
t.traverse((o) => {
  if (o.isMesh && /^(SIDE_R|SIDE_L|REAR)$/.test(o.name || '')) faces[o.name] = o;
});
out.push(['faces', Object.keys(faces).join(' · ')]);

/* ─── DESENHA O AZUL NO CANVAS DE CADA FACE ───
   Metade de cima do canvas, chapado. O resto fica transparente, então a mesma
   foto mostra chapa nua e arte lado a lado — e a comparação sai do MESMO
   quadro, sem depender de exposição. */
const AZUL = '#1b3a6b';
const guarda = [];
for (const [nome, o] of Object.entries(faces)) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  if (!ov) continue;
  const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
  const tex = m.map;
  const cv = tex?.image;
  if (!cv || !cv.getContext) { out.push([`${nome} · canvas`, 'AUSENTE']); continue; }
  const ctx = cv.getContext('2d');
  guarda.push([nome, m, m.visible, ctx.getImageData(0, 0, cv.width, cv.height), cv, tex]);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 0, cv.width, Math.round(cv.height * 0.5));
  ctx.restore();
  tex.needsUpdate = true;
  m.visible = true;
  out.push([`${nome} · canvas`, `${cv.width}×${cv.height} · colorSpace ${tex.colorSpace}`
    + ` · flipY ${tex.flipY} · aniso ${tex.anisotropy}`]);
}
for (let i = 0; i < 6; i++) await B.frame();

/* ─── O ÂNGULO DA FOTO DO DONO: traseira-esquerda, de cima ─── */
const bM = new THREE.Box3().setFromObject(t);
const c0 = bM.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c0.clone();
  if (desloca) al.add(desloca);
  const limA = controls.minDistance, limB = controls.maxDistance;
  controls.minDistance = 0.02; controls.maxDistance = 1e5;
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  controls.minDistance = limA; controls.maxDistance = limB;
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/* ⚠️ O RABO DO IMPLEMENTO É +Z NO MUNDO (o `rigGroup` carrega orientYaw = π),
   então mirar "atrás" é somar em z, não subtrair. */
tira('q19-3quartos', 9.0, 28, 10, V(0, 0.2, 2.0));
tira('q19-traseira', 6.0, 5, 6, V(0, 0.3, 3.2));
tira('q19-lateral', 7.0, 75, 6, V(0, 0.3, 0));

/* ─── E A CONTA: o azul de cada face, POR MÁSCARA ───
   ⚠️ A CAIXA PROJETADA DA FACE NÃO SERVE DE RECORTE. Numa vista de 3/4 a
   caixa da traseira cobre meio caminhão, e a primeira tentativa devolveu o
   MESMO rgb para a traseira e para o flanco — estava medindo os mesmos pixels
   duas vezes. O recorte honesto é uma passada de MÁSCARA: tudo invisível menos
   a face, material chapado, fundo preto; os pixels brancos dessa passada são
   os que pertencem à face, e só neles se lê o quadro de verdade. */
const med = document.createElement('canvas');
const c2 = med.getContext('2d', { willReadFrequently: true });
const W = renderer.domElement.width, H = renderer.domElement.height;
med.width = W; med.height = H;

const todas = [];
scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) todas.push([o, o.visible]); });
const fundo = scene.background, ambiente = scene.environment;
const corLimpa = new THREE.Color(); renderer.getClearColor(corLimpa);
const alfaLimpo = renderer.getClearAlpha();

function poeCamera(dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c0.clone(); if (desloca) al.add(desloca);
  const limA = controls.minDistance, limB = controls.maxDistance;
  controls.minDistance = 0.02; controls.maxDistance = 1e5;
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  controls.update();
  controls.minDistance = limA; controls.maxDistance = limB;
}
function lePixels() {
  c2.clearRect(0, 0, W, H);
  c2.drawImage(renderer.domElement, 0, 0);
  return c2.getImageData(0, 0, W, H).data;
}
function mascaraDe(o) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  const alvo = ov || o;
  const guardaMat = alvo.material;
  for (const [m] of todas) m.visible = false;
  /* A face E a sobreposição dela: o pai precisa estar visível para o filho
     ser percorrido pelo render. */
  o.visible = true; if (ov) ov.visible = true;
  alvo.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  scene.background = null; scene.environment = null;
  renderer.setClearColor(0x000000, 1);
  renderer.render(scene, camera);
  const d = lePixels();
  alvo.material = guardaMat;
  scene.background = fundo; scene.environment = ambiente;
  renderer.setClearColor(corLimpa, alfaLimpo);
  for (const [m, v] of todas) m.visible = v;
  return d;
}
function mede(o, rot) {
  const masc = mascaraDe(o);
  renderer.render(scene, camera);
  const quadro = lePixels();
  const rs = [], gs = [], bs = [];
  for (let i = 0; i < masc.length; i += 4) {
    if (masc[i] < 128) continue;                      // fora da face
    const R = quadro[i], G = quadro[i + 1], Bl = quadro[i + 2];
    if (!(Bl > R + 12 && Bl > G + 6 && Bl < 220)) continue;   // só o adesivo
    rs.push(R); gs.push(G); bs.push(Bl);
  }
  if (rs.length < 200) return `${rot}: sem pixel de adesivo (${rs.length})`;
  const mid = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const R = mid(rs), G = mid(gs), Bl = mid(bs);
  const mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl);
  return `${rot}: ${rs.length} px · rgb ${R},${G},${Bl}`
    + ` · sat ${(mx ? (mx - mn) / mx : 0).toFixed(3)} · val ${(mx / 255).toFixed(3)}`;
}

/* ─── O EXPERIMENTO: um termo por vez ───
   Cinco leituras da MESMA face nas MESMAS câmeras, cada uma com um termo de
   luz desligado. O termo que igualar a traseira ao flanco é o culpado. */
const luzes = [];
scene.traverse((o) => { if (o.isLight) luzes.push([o, o.intensity]); });
const ovMats = [];
for (const o of Object.values(faces)) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  if (ov) ovMats.push(Array.isArray(ov.material) ? ov.material[0] : ov.material);
}
const tmA = renderer.toneMapping, expA = renderer.toneMappingExposure;

const cenarios = [
  ['como está', () => {}],
  ['sem env na arte', () => { for (const m of ovMats) { m.envMapIntensity = 0; m.needsUpdate = true; } }],
  ['sem environment', () => { scene.environment = null; }],
  ['só direcional', () => {
    for (const [l] of luzes) if (!l.isDirectionalLight) l.intensity = 0;
    scene.environment = null;
  }],
  ['sem tonemap', () => { renderer.toneMapping = THREE.NoToneMapping; }],
];
for (const [rot, aplica] of cenarios) {
  /* devolve tudo antes de cada cenário */
  for (const [l, i2] of luzes) l.intensity = i2;
  scene.environment = ambiente;
  for (const m of ovMats) { m.envMapIntensity = 1.35; m.needsUpdate = true; }
  renderer.toneMapping = tmA; renderer.toneMappingExposure = expA;
  aplica();
  for (let k = 0; k < 3; k++) await B.frame();
  const linha = [];
  poeCamera(9.0, 28, 10, V(0, 0.2, 2.0));
  for (const nome of ['REAR', 'SIDE_R', 'SIDE_L']) {
    if (faces[nome]) linha.push(mede(faces[nome], nome));
  }
  out.push([`azul · ${rot}`, linha.join('  |  ')]);
}
for (const [l, i2] of luzes) l.intensity = i2;
scene.environment = ambiente;
for (const m of ovMats) { m.envMapIntensity = 1.35; m.needsUpdate = true; }
renderer.toneMapping = tmA; renderer.toneMappingExposure = expA;

/* devolve os canvases */
for (const [, m, vis, dados, cv, tex] of guarda) {
  cv.getContext('2d').putImageData(dados, 0, 0);
  tex.needsUpdate = true; m.visible = vis;
}
return out;
