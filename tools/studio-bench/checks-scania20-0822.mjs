/* VINTE — A PROVA DA SOMBRA NA ARTE.
   ===========================================================================
   Reproduz a LUZ da foto do dono (hora 09:00 · altura 53° · posição 133°),
   desenha o mesmo azul nas três faces e mede, DENTRO DA MÁSCARA DE CADA FACE,
   a mediana do adesivo e a mediana da chapa. O que interessa é a RAZÃO entre
   as duas: ela é a razão dos ALBEDOS e luz nenhuma a muda — luz multiplica as
   duas. Um azul-marinho sobre chapa branca tem de dar algo entre 0,05 e 0,20.

   Roda duas vezes: com `receiveShadow` na sobreposição (o conserto) e sem (o
   estado de antes).

     node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-scania20-0822.mjs */

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

/* A LUZ DA FOTO DO DONO. Sem isto o ensaio mede outro sol: no padrão da
   bancada a traseira e um dos flancos ficam os DOIS sem luz direta, e aí a
   diferença que se quer medir não existe no quadro. */
if (S.lighting?.setHourOfDay) S.lighting.setHourOfDay(9, { animate: false });
if (S.lighting?.setLightParams) S.lighting.setLightParams({ az: 133, el: 53 }, { animate: false });
for (let i = 0; i < 20; i++) await B.frame();
out.push(['luz', `hora 9 · az 133 · el 53`]);

const t = S.state.trailer;
t.updateWorldMatrix(true, true);
const faces = {};
t.traverse((o) => {
  if (o.isMesh && /^(SIDE_R|SIDE_L|REAR)$/.test(o.name || '')) faces[o.name] = o;
});

/* ─── o azul, pelo canvas de verdade ─── */
const AZUL = '#1b3a6b';
const guarda = [];
for (const [nome, o] of Object.entries(faces)) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  if (!ov) continue;
  const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
  const cv = m.map?.image;
  if (!cv?.getContext) continue;
  const ctx = cv.getContext('2d');
  guarda.push([m, ov, m.visible, ctx.getImageData(0, 0, cv.width, cv.height), cv, m.map]);
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 0, cv.width, Math.round(cv.height * 0.55));
  m.map.needsUpdate = true;
  m.visible = true;
  out.push([`${nome} · sobreposição`, `receiveShadow ${ov.receiveShadow}`
    + ` · chapa receiveShadow ${o.receiveShadow}`]);
}
for (let i = 0; i < 6; i++) await B.frame();

/* ─── máscara por face + medida ─── */
const med = document.createElement('canvas');
const c2 = med.getContext('2d', { willReadFrequently: true });
const W = renderer.domElement.width, H = renderer.domElement.height;
med.width = W; med.height = H;
const todas = [];
scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) todas.push([o, o.visible]); });
const fundo = scene.background, ambiente = scene.environment;
const corLimpa = new THREE.Color(); renderer.getClearColor(corLimpa);
const alfaLimpo = renderer.getClearAlpha();
const bM = new THREE.Box3().setFromObject(t);
const c0 = bM.getCenter(new THREE.Vector3());
const V = (x, y, z) => new THREE.Vector3(x, y, z);
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
const lePixels = () => { c2.clearRect(0, 0, W, H); c2.drawImage(renderer.domElement, 0, 0);
  return c2.getImageData(0, 0, W, H).data; };
function mascaraDe(o) {
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  const alvo = ov || o;
  const g = alvo.material;
  for (const [m] of todas) m.visible = false;
  o.visible = true; if (ov) ov.visible = true;
  alvo.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  scene.background = null; scene.environment = null;
  renderer.setClearColor(0x000000, 1);
  renderer.render(scene, camera);
  const d = lePixels();
  alvo.material = g;
  scene.background = fundo; scene.environment = ambiente;
  renderer.setClearColor(corLimpa, alfaLimpo);
  for (const [m, v] of todas) m.visible = v;
  return d;
}
const mid = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
function mede(o) {
  const masc = mascaraDe(o);
  renderer.render(scene, camera);
  const q = lePixels();
  const az = [[], [], []], ch = [[], [], []];
  for (let i = 0; i < masc.length; i += 4) {
    if (masc[i] < 128) continue;
    const R = q[i], G = q[i + 1], Bl = q[i + 2];
    if (Bl - R > 40 && Bl - G > 18) { az[0].push(R); az[1].push(G); az[2].push(Bl); }
    else if (Math.abs(R - G) < 10 && Math.abs(G - Bl) < 10 && R > 40) {
      ch[0].push(R); ch[1].push(G); ch[2].push(Bl);
    }
  }
  if (az[0].length < 300 || ch[0].length < 300) return null;
  const A = az.map(mid), C = ch.map(mid);
  const vA = Math.max(...A) / 255, vC = Math.max(...C) / 255;
  const mxA = Math.max(...A), mnA = Math.min(...A);
  return { A, C, vA: +vA.toFixed(3), vC: +vC.toFixed(3),
    razao: +(vA / vC).toFixed(3), sat: +((mxA - mnA) / (mxA || 1)).toFixed(3),
    n: az[0].length };
}

for (const [rot, recebe] of [['COM sombra na arte (conserto)', true],
  ['SEM sombra na arte (como era)', false]]) {
  for (const [, ov] of guarda.map((g) => [g[0], g[1]])) ov.receiveShadow = recebe;
  for (let i = 0; i < 4; i++) await B.frame();
  /* O ângulo da foto do dono: atrás e à esquerda, um pouco de cima. */
  poeCamera(11, 22, 10, V(0, 0.2, 2.0));
  const linhas = [];
  for (const nome of ['REAR', 'SIDE_R', 'SIDE_L']) {
    if (!faces[nome]) continue;
    const r = mede(faces[nome]);
    linhas.push(r ? `${nome}: arte ${r.A.join(',')} (v ${r.vA}) · chapa ${r.C.join(',')}`
      + ` (v ${r.vC}) · ARTE/CHAPA ${r.razao} · sat ${r.sat}` : `${nome}: —`);
  }
  out.push([`▶ ${rot}`, linhas.join('   |   ')]);
  const dataUrl = (() => { renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png'); })();
  out.push([`q20-${recebe ? 'com' : 'sem'}-sombra`, dataUrl]);
}
for (const [, ov] of guarda.map((g) => [g[0], g[1]])) ov.receiveShadow = true;

for (const [m, ov, vis, dados, cv, tex] of guarda) {
  cv.getContext('2d').putImageData(dados, 0, 0);
  tex.needsUpdate = true; m.visible = vis;
}
return out;
