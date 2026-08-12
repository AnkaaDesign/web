/* Os RETRATOS das correções de 2026-08-12: a ferragem centrada na faixa lisa,
   a porta lateral sem rebite de emenda e a dobradiça à frente nos dois flancos.

   As armadilhas de câmera desta bancada estão anotadas em `checks-fotos-0811`
   e valem aqui: `toDataURL()` dá branco, o cavalo tapa a testeira, e
   `controls.enabled = false` NÃO congela a pose (o `update()` reimpõe
   `minDistance` e a mira). A pose é reescrita a cada quadro e conferida.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-fotos-0812.mjs
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

function at(x, y, z) {
  root.updateWorldMatrix(true, true);
  return new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
}

async function shot(tag, look, dir, dist, frame) {
  const cam = S.camera;
  const d = new THREE.Vector3(...dir).normalize();
  const tgt = at(...look);
  const eye = at(look[0] + d.x * dist, look[1] + d.y * dist, look[2] + d.z * dist);
  const fov = 2 * Math.atan((frame / 2) / dist) * 180 / Math.PI;
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
  out.push([`  ${tag} pose`, `${off < 0.02 ? 'ok' : 'ESCAPOU'} · desvio ${Math.round(off * 1000)} mm`]);
}

/* 1 · a ferragem da porta traseira, na faixa lisa. Alvo entre as duas peças. */
await shot('d1-trava-no-friso', [1.31, 1.634, -6.46], [1, 0.10, 0.22], 2.6, 0.9);

/* Portas nos dois flancos, no meio do baú. */
const L = S.trailerDims.length;
const spec = [{ position: L / 2 - 0.45, width: 0.9, height: 2.35 }];
S.models.setTrailerDoors('left', spec);
S.models.setTrailerDoors('right', spec);
await B.until(() => S.trailerRig.body.getDoorHoles('left').length === 1
  && S.trailerRig.body.getDoorHoles('right').length === 1, 60000);
for (let i = 0; i < 10; i++) await B.frame();

for (const face of ['left', 'right']) {
  const h = S.trailerRig.body.getDoorHoles(face)[0];
  const zc = (h.z0 + h.z1) / 2, yc = (h.y0 + h.y1) / 2;
  const sx = face === 'right' ? 1 : -1;
  /* A porta inteira, para ver de que lado está a charneira. */
  await shot(`d2-porta-${face}`, [sx * 1.30, yc, zc], [sx, 0.10, 0.05], 4.2, 3.0);
  /* E o encontro com a chapa: nem rebite na folha, nem na moldura. */
  await shot(`d3-marco-${face}`, [sx * 1.30, yc, h.z0], [sx, 0.06, -0.16], 1.9, 1.3);
}

S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;
return out;
