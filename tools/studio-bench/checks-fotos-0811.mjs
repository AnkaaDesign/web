/* Os RETRATOS das três correções de 2026-08-11, nos enquadramentos dos prints
   do Kennedy. A bancada mede (`checks-correcoes-0811.mjs`); isto é para OLHAR.

   TRÊS ARMADILHAS, as três pagas nesta sessão:
   · `renderer.domElement.toDataURL()` devolve BRANCO. O renderizador do
     estúdio não usa `preserveDrawingBuffer` (scene.ts diz por quê), então o
     buffer já foi apresentado quando a leitura acontece. Quem tira foto aqui
     é `captureViewport()`, que renderiza para um alvo próprio.
   · o CAVALO fica na frente da testeira: qualquer câmera plantada adiante da
     parede dianteira nasce dentro da cabine. Ele é escondido e devolvido.
   · a câmera é dada por ALVO + DIREÇÃO + DISTÂNCIA, nunca por dois pontos
     soltos. Com dois pontos soltos o alvo sai do quadro sem avisar — foi o
     que produziu três fotos de parede lisa antes desta versão.
   · e `controls.enabled = false` NÃO é o bastante: `update()` continua rodando
     no laço e reimpõe `minDistance`, que o estúdio deixa em 0,40 · raio do rig
     (uns 3,8 m). Toda foto de perto era empurrada para longe mantendo só a
     DIREÇÃO — daí três close-ups que saíram panorâmicas. A mira e os limites
     de órbita têm de ser mexidos junto, e devolvidos no fim.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-fotos-0811.mjs
   Sai em tools/studio-bench/shots/.
*/
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const root = S.trailer;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

S.controls.enabled = false;
const orbit = { min: S.controls.minDistance, max: S.controls.maxDistance };
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;
S.lighting.applyPreset('ensolarado', { animate: false });

/* O conjunto está ENGATADO: girado e adiantado. Tudo é dito no referencial do
   implemento e levado ao mundo pela matriz dele — coordenada de mundo aqui
   enquadra o estacionamento. */
function at(x, y, z) {
  root.updateWorldMatrix(true, true);
  return new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
}

/**
 * @param look  alvo, no referencial do implemento
 * @param dir   de onde se olha (vetor local, normalizado aqui)
 * @param dist  metros do alvo
 * @param frame altura em metros que o quadro deve cobrir NO ALVO — a fov sai
 *              daí, então a peça não some por engano de lente.
 */
async function shot(tag, look, dir, dist, frame) {
  const cam = S.camera;
  const d = new THREE.Vector3(...dir).normalize();
  const tgt = at(...look);
  const eye = at(look[0] + d.x * dist, look[1] + d.y * dist, look[2] + d.z * dist);
  const fov = 2 * Math.atan((frame / 2) / dist) * 180 / Math.PI;
  /* REIMPOSTA A CADA QUADRO, e é isso que finalmente segurou a pose: entre o
     amortecimento do `OrbitControls` e a animação de abertura do estúdio, uma
     pose escrita uma vez só é lida de volta alguns quadros depois já mexida.
     Trinta quadros reescrevendo dão tempo de tudo que anima terminar. */
  for (let i = 0; i < 30; i++) {
    S.controls.target.copy(tgt);
    cam.position.copy(eye);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.lookAt(tgt);
    cam.updateMatrixWorld(true);
    S.lighting.invalidate(2);
    await B.frame();
  }
  const off = cam.position.distanceTo(eye);
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  /* Se a câmera escapou, a foto mente — melhor dizer do que entregar quieto. */
  out.push([`  ${tag} pose`, `${off < 0.02 ? 'ok' : 'ESCAPOU'} · desvio ${Math.round(off * 1000)} mm`]);
}

/* 1 · o canto de cima da testeira — onde a listra branca aparecia entre a
   carenagem do Thermo King e o frame galvanizado. Alvo no meio do vão antigo
   (|x| 1020, y 4030). */
const cab = S.cab || S.state?.cab;
if (cab) cab.visible = false;
await shot('c1-vao-do-tk', [1.02, 4.03, 7.23], [0.55, 0.35, 1], 2.2, 0.9);
await shot('c1-testeira-inteira', [0, 3.9, 7.25], [0.75, 0.30, 1], 6.5, 3.4);
if (cab) cab.visible = true;

/* 2 · a trava e a borracha, a ~1 m de distância e de fora. Alvo entre as duas
   peças (a trava em z −6,41, a borracha em −6,51). */
await shot('c2-trava-de-perto', [1.31, 1.655, -6.46], [1, 0.22, 0.42], 1.1, 0.42);
await shot('c2-trava-no-friso', [1.31, 1.655, -6.46], [1, 0.16, 0.30], 2.0, 0.85);

/* 3 · as duas pontas do painel: a chapa INTEIRA encostando na testeira, e a
   sobra na traseira. A primeira emenda fica a 1,000 m da ponta dianteira. */
await shot('c3-chapa-da-frente', [1.30, 2.7, 6.55], [1, 0.22, 0.55], 3.4, 2.4);
await shot('c3-sobra-de-tras', [1.30, 2.7, -6.9], [1, 0.22, -0.55], 3.4, 2.4);
await shot('c3-lateral-geral', [1.30, 2.6, 0], [1, 0.35, 0.30], 14.0, 8.0);

S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;
return out;
