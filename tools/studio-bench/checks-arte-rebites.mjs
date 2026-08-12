/* A ARTE COBRE OS REBITES — pedido de 2026-08-12: "as logos aplicadas na
   lateral também devem ser aplicadas nos rebites, não apenas nas chapas".

   O teste é de REGISTRO, não de aparência: a `uv1` da calota tem de ser a
   MESMA função da chapa (normalizada pela caixa DELA), senão a arte inteira
   cabe dentro de cada rebite de 18 mm. Então se compara, vértice a vértice, a
   uv1 de cada calota com a uv1 que a chapa daria naquele ponto.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-arte-rebites.mjs
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

function find(name) {
  let hit = null;
  root.traverse((o) => { if (o.isMesh && o.name === name) hit = o; });
  return hit;
}

for (const [panelName, rivetName] of [['SIDE_L', 'SIDE_L_RIVETS'], ['SIDE_R', 'SIDE_R_RIVETS']]) {
  const panel = find(panelName);
  const riv = find(rivetName);
  out.push([`${rivetName} existe`, !!panel && !!riv]);
  if (!panel || !riv) continue;

  const uv = riv.geometry.getAttribute('uv1');
  out.push([`${rivetName} tem uv1`, !!uv]);
  if (!uv) continue;

  /* A caixa da CHAPA — é ela que `addLiveryUV()` normaliza. */
  panel.geometry.computeBoundingBox();
  const b = panel.geometry.boundingBox;
  const spanZ = Math.max(1e-6, b.max.z - b.min.z);
  const spanY = Math.max(1e-6, b.max.y - b.min.y);
  const left = panelName === 'SIDE_L';
  const pos = riv.geometry.getAttribute('position');

  let worst = 0, uLo = 1, uHi = 0, vLo = 1, vHi = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    const eu = left ? (z - b.min.z) / spanZ : (b.max.z - z) / spanZ;
    const ev = (b.max.y - y) / spanY;
    worst = Math.max(worst, Math.abs(uv.getX(i) - eu), Math.abs(uv.getY(i) - ev));
    uLo = Math.min(uLo, uv.getX(i)); uHi = Math.max(uHi, uv.getX(i));
    vLo = Math.min(vLo, uv.getY(i)); vHi = Math.max(vHi, uv.getY(i));
  }
  out.push([`${rivetName}: uv1 é a da CHAPA`, worst < 1e-5]);
  out.push([`  ${rivetName} erro máx`, worst.toExponential(2)]);
  /* E a prova contra o erro que este teste existe para pegar: se a uv1 tivesse
     sido normalizada pela caixa da própria calota, cada rebite iria de 0 a 1 e
     a faixa abaixo sairia [0,1] nos dois eixos. */
  out.push([`  ${rivetName} faixa u/v`,
    `u ${uLo.toFixed(3)}..${uHi.toFixed(3)} · v ${vLo.toFixed(3)}..${vHi.toFixed(3)}`]);
  out.push([`${rivetName}: não é a caixa da calota`, (uHi - uLo) > 0.5 && (vHi - vLo) < 0.95]);

  /* A sobreposição de arte, filha da calota, com a MESMA textura da chapa. */
  const povl = panel.children.find((c) => c.isMesh && c.material?.map);
  const rovl = riv.children.find((c) => c.isMesh && c.material?.map);
  out.push([`${rivetName}: tem sobreposição de arte`, !!rovl]);
  out.push([`${rivetName}: mesma textura da chapa`,
    !!povl && !!rovl && rovl.material.map === povl.material.map]);
  out.push([`  ${rivetName} canal da textura`, rovl ? rovl.material.map.channel : '—']);
}

/* Um retrato do flanco com a arte padrão ("Sua marca"), para olhar. */
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});
S.controls.enabled = false;
const orbit = { min: S.controls.minDistance, max: S.controls.maxDistance };
S.controls.minDistance = 0; S.controls.maxDistance = Infinity;
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
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  out.push([`  ${tag} pose`,
    `${cam.position.distanceTo(eye) < 0.02 ? 'ok' : 'ESCAPOU'}`]);
}
await shot('e1-arte-nos-rebites', [-1.30, 2.75, 1.0], [-1, 0.10, 0.08], 4.0, 2.6);
await shot('e2-arte-de-perto', [-1.30, 2.75, 0.0], [-1, 0.05, 0.10], 1.6, 1.0);
S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;

return out;
