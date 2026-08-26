/* O CANTO DIANTEIRO, FOTOGRAFADO — porque "afastado" e "flutuando" são juízos
   de OLHO, e cota nenhuma os resolve.
   ===========================================================================
   *"o thermo king ... continua afastado do implemento"* e *"os rebites acima do
   thermo king que estão flutuando"* — Kennedy, 2026-08-20. As duas queixas já
   sobreviveram a duas rodadas de medição minhas porque eu estava medindo a
   coisa errada: a caixa do TK ENCOSTA na testeira (z 3,996…4,607 contra a
   parede em 4,194), então "afastado" não é distância de caixa a caixa. Só
   vendo o quadro que ele vê dá para saber o que está aberto.

   Três enquadramentos: 3/4 dianteiro fechado no TK, testeira de frente, e
   perfil rasante no canto. A leitura é SÍNCRONA pelo mesmo motivo de
   `checks-diag-0816.mjs`: sem `preserveDrawingBuffer`, um `await` entre o
   desenho e o `toDataURL()` devolve o buffer limpo.

       node tools/studio-bench/bench.mjs --gpu --checks checks-tkfoto-0820.mjs */

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
for (let i = 0; i < 16; i++) await B.frame();

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
const vm = alvos.find((a) => /vm_2015_6x2r/i.test(a.c.file));
if (!vm) { out.push(['★', 'VM fora do catálogo']); return out; }
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
/* SEM `enterStudio()`: os prints do dono são do distrito, e a troca de cenário
   é o passo caro — foi ela que estourou os 10 min da primeira tentativa. */
for (let i = 0; i < 30; i++) await B.frame();

/* O ALVO — o topo da testeira, em MUNDO (a foto é do mundo, não do referencial
   de construção). Achado pelo próprio TK, que é a peça em disputa. */
const t = S.state.trailer;
t.updateWorldMatrix(true, true);
let tk = null;
t.traverse((o) => { if (!tk && /thermo/i.test(o.name || '')) tk = o; });
if (!tk) for (const o of scene.children) if (/thermo/i.test(o.name || '')) tk = o;
const bTk = new THREE.Box3().setFromObject(tk || t);
const alvo = bTk.getCenter(new THREE.Vector3());
out.push(['caixa do TK (mundo)', JSON.stringify({
  min: bTk.min.toArray().map((v) => +v.toFixed(3)),
  max: bTk.max.toArray().map((v) => +v.toFixed(3)),
})]);

const raw = renderer.domElement;
function tira(nome, dist, azDeg, elevDeg, deslocaY) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo.clone(); al.y += deslocaY;
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);          // SÍNCRONO — ver cabeçalho
  out.push([nome, raw.toDataURL('image/png')]);
}
/* O implemento aponta a traseira para -z, então a testeira olha para +z: a
   câmera de frente fica em azimute 0. */
tira('tk-3-4', 4.2, 38, 16, 0);
tira('tk-perfil', 3.4, 88, 8, 0);
return out;
