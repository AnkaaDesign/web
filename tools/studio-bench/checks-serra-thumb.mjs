/* A MINIATURA do cenário `serra`, tirada do próprio app.
   ===========================================================================
   Existe separada de `checks-serra.mjs` porque a pose é outra: a miniatura do
   seletor não é um retrato do produto, é um retrato do LUGAR. Ela tem de dizer
   em 960 x 600 px o que o cenário é — estrada de serra, corte de rocha, mata
   fechada, curva —, e para isso a lente sobe, afasta e o veículo sai do meio.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-serra-thumb.mjs
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
await B.until(() => !!S.trailerRig, 240000);
await B.frame(); await B.frame();

const THREE = S.THREE;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

const alvo = S.catalog.getEnvironment('serra');
if (!alvo) { out.push(['!! serra no manifesto', false]); return out; }
await S.environment.applyEnvironment(alvo);
for (let i = 0; i < 60; i++) await B.frame();

S.controls.enabled = false;
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;
S.lighting.applyPreset('ensolarado', { animate: false });

/* O VEÍCULO SOME DA MINIATURA. Ele muda a cada escolha do usuário — cavalo,
   cor, implemento —, então uma miniatura com caminhão dentro fica errada assim
   que ele troca de marca. O cartão vende o CENÁRIO. */
const cab = S.cabGroup;
const trl = S.trailerGroup;
const vis = [cab && cab.visible, trl && trl.visible];
if (cab) cab.visible = false;
if (trl) trl.visible = false;

const cam = S.camera;
const E = new THREE.Vector3(11, 8.5, 30);
const T = new THREE.Vector3(-4, 2.5, -46);
for (let i = 0; i < 30; i++) {
  S.controls.target.copy(T);
  cam.position.copy(E);
  cam.up.set(0, 1, 0);
  cam.fov = 40;
  cam.near = 0.1;
  cam.far = 6000;
  cam.updateProjectionMatrix();
  cam.lookAt(T);
  cam.updateMatrixWorld(true);
  S.lighting.invalidate(2);
  await B.frame();
}
const res = await B.captureViewport({ quality: 'alta', background: 'cena' });
out.push(['thumb', await toURL(res.blob)]);
out.push(['  pose', `desvio ${Math.round(cam.position.distanceTo(E) * 1000)} mm`]);

if (cab) cab.visible = vis[0];
if (trl) trl.visible = vis[1];
S.controls.enabled = true;
return out;
