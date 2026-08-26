/* DIAGNÓSTICO — a foto do céu hora a hora, para OLHAR.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-ceu-fotos-0824.mjs

   `checks-ceu-0824.mjs` responde perguntas de FATO sobre a travessia (pesos,
   saltos, monotonicidade). Este arquivo responde a única que ele não pode: **como
   é que fica.** Foi assim que o defeito de 44 % de poente às 19:00 apareceu — numa
   foto, não num número —, e é assim que se confere que ele saiu.

   Enquadra alto e para trás para o CÉU ocupar o quadro, que é o que está em
   julgamento; um enquadramento de produto poria o caminhão na frente das nuvens
   justamente onde elas precisam ser vistas. */
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
    const local = cards.find((c) => /volvo/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;

const env = S.catalog.getEnvironment('distrito-industrial');
if (env) await S.environment.applyEnvironment(env);
out.push(['par de céus montado', await B.until(() => !!S.lighting.getSkyBlend().ativo, 240000)]);

const cam = S.camera, ctl = S.controls, R = S.renderer, gl = R.getContext();
/* Longe, alto e olhando ligeiramente para cima: o horizonte cai no terço de
   baixo e a metade de cima do quadro é céu puro. */
ctl.target.set(0, 6, 0);
cam.position.set(26, 9, 26);
cam.lookAt(0, 6, 0);
ctl.update();

const HORAS = [17.75, 18.25, 18.5, 19, 19.5, 21, 23];
for (const h of HORAS) {
  S.lighting.setHourOfDay(h);
  for (let i = 0; i < 12; i++) await B.frame();
  R.render(S.scene, cam);
  const w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * hh * 4);
  gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  /* `readPixels` entrega a origem embaixo; o canvas 2D a quer em cima. */
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const img = c.getContext('2d').createImageData(w, hh);
  for (let y = 0; y < hh; y++) {
    img.data.set(buf.subarray((hh - 1 - y) * w * 4, (hh - y) * w * 4), y * w * 4);
  }
  c.getContext('2d').putImageData(img, 0, 0);
  const rot = String(Math.floor(h)).padStart(2, '0')
    + String(Math.round((h % 1) * 60)).padStart(2, '0');
  out.push(['ceu-' + rot + ' (mix ' + S.lighting.getSkyBlend().peso.toFixed(3) + ')',
    c.toDataURL('image/webp', 0.9)]);
}

return out;
