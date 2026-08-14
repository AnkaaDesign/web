/* Tempo de quadro medido pelo RELÓGIO DA PÁGINA, independente do motor.
   Serve para comparar VERSÕES do engine — por isso não usa nenhuma API que
   possa não existir num commit antigo. */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 30000);
const ov = document.getElementById('ts-selector');
for (let s = 0; s < 12 && !ov.classList.contains('hidden'); s++) {
  const cards = [...ov.querySelectorAll('.ts-card:not([disabled])')];
  if (!cards.length) break;
  (cards.find((c) => /volvo/i.test(c.dataset.id || '')) || cards[0]).click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!S.trailerRig, 240000);
if (S.quality?.set) { S.quality.set('alta'); }
for (let i = 0; i < 30; i++) await B.frame();      // assenta

async function medir(rotulo) {
  S.lighting.setTurntable(true);
  for (let i = 0; i < 20; i++) await B.frame();     // aquece
  const t = [];
  let prev = performance.now();
  for (let i = 0; i < 140; i++) {
    await B.frame();
    const now = performance.now();
    t.push(now - prev); prev = now;
  }
  S.lighting.setTurntable(false);
  t.sort((a, b) => a - b);
  const med = t[Math.floor(t.length / 2)];
  const p90 = t[Math.floor(t.length * 0.9)];
  const st = S.lighting.getRenderStats ? S.lighting.getRenderStats() : null;
  out.push([rotulo, `mediana ${med.toFixed(1)} ms (${(1000 / med).toFixed(0)} fps) · p90 ${p90.toFixed(1)} ms`
    + (st ? ` · ${st.calls} chamadas · ${(st.triangles / 1e6).toFixed(2)} M tri` : '')]);
  return med;
}
await medir('ALTA');
if (S.quality?.set) {
  S.quality.set('media');
  for (let i = 0; i < 20; i++) await B.frame();
  await medir('MEDIA');
}
const c = S.renderer.domElement;
out.push(['buffer', `${c.width}×${c.height}`]);
return out;
