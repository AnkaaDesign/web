/* QUÃO PERTO A ÓRBITA DEIXA CHEGAR — medido, não estimado.
   ===========================================================================
   Relato repetido em 2026-08-13: *"precisa diminuir o zoom in máximo, está
   chegando muito perto do caminhão"*, e depois *"o zoom in máximo continua
   extremamente alto"* — o segundo DEPOIS de `FOCUS_MIN_F` ter subido de 0,60
   para 0,80. Ou seja: mexer naquele número não estava mexendo no que o usuário
   sente, e a bancada existe para dizer por quê.

   As duas grandezas são diferentes e só a segunda é o relato:

     minDistance   raio da esfera em volta da MIRA (FOCUS_MIN_F · r)
     FOLGA         distância da lente até a LATARIA — e a mira pode ser
                   arrastada FOCUS_PAN_F · r para cima do flanco, então a
                   segunda não se deduz da primeira

   O teste força o pior caso: arrasta a mira para o flanco, joga a câmera para
   cima do baú, deixa os `frameHooks` rodarem (é lá que a expulsão da caixa
   acontece) e mede o que sobrou. Repete por oito azimutes.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-zoom-0813.mjs
*/
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;

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
const THREE = S.THREE;
const cam = S.camera;
const controls = S.controls;
await B.frame(); await B.frame();

/* A caixa do CONJUNTO em cena, que é o que a lente pode furar. */
const rig = new THREE.Box3();
for (const g of [S.models.state.cabGroup, S.models.state.trailerGroup]) {
  if (g && g.visible) rig.expandByObject(g);
}
const size = rig.getSize(new THREE.Vector3());
const centre = rig.getCenter(new THREE.Vector3());
out.push(['conjunto em cena', `${r2(size.x)} × ${r2(size.y)} × ${r2(size.z)} m`]);
out.push(['minDistance corrente (m)', r2(controls.minDistance)]);

/** Distância da lente até a superfície da caixa. Negativa = está DENTRO. */
function clearance(p) {
  const dx = Math.max(rig.min.x - p.x, p.x - rig.max.x);
  const dy = Math.max(rig.min.y - p.y, p.y - rig.max.y);
  const dz = Math.max(rig.min.z - p.z, p.z - rig.max.z);
  const outside = new THREE.Vector3(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  if (outside.lengthSq() > 0) return outside.length();
  return Math.max(dx, dy, dz);              // dentro: o mais negativo é a folga
}

/* Pior caso: a mira arrastada para o flanco E a lente empurrada para cima da
   lataria. Oito azimutes em volta, na altura do baú. */
const rows = [];
let worst = Infinity, worstAz = 0;
for (let i = 0; i < 8; i++) {
  const az = (i / 8) * Math.PI * 2;
  const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
  /* A mira vai para o ponto da carroceria naquele azimute — o pan a puxa de
     volta para a coleira, e é justamente esse limite que se quer exercitar. */
  const aim = centre.clone().addScaledVector(dir, Math.max(size.x, size.z) * 0.5);
  aim.y = centre.y;
  controls.target.copy(aim);
  /* E a lente ENCOSTADA nela: 10 cm. Sem os ganchos, isto é a câmera dentro do
     baú; com eles, é o pior caso legítimo. */
  cam.position.copy(controls.target).addScaledVector(dir, 0.10);
  cam.updateMatrixWorld(true);
  for (let f = 0; f < 8; f++) await B.frame();
  const d = clearance(cam.position);
  const toTarget = cam.position.distanceTo(controls.target);
  rows.push({ az: Math.round((az * 180) / Math.PI), d, toTarget });
  if (d < worst) { worst = d; worstAz = Math.round((az * 180) / Math.PI); }
}
for (const r of rows) {
  out.push(['    ', `azimute ${r.az}° · folga ${r2(r.d)} m · até a mira ${r2(r.toTarget)} m`]);
}
out.push(['FOLGA MÍNIMA até a lataria (m)', r2(worst)]);
out.push(['    no azimute', worstAz + '°']);
/* O alvo: nunca dentro da carroceria, e nunca tão perto que o quadro deixe de
   mostrar a chapa. 1,2 m com a lente de 30° dá ~0,64 m de altura no quadro. */
out.push(['a lente NUNCA entra na carroceria', worst > 0]);
out.push(['folga mínima >= 1,20 m', worst >= 1.2]);

/* E a altura do quadro naquele ponto, que é o número que o olho julga. */
const fovRad = (cam.fov * Math.PI) / 180;
out.push(['altura do quadro na folga mínima (m)', r2(2 * worst * Math.tan(fovRad / 2))]);

return out;
