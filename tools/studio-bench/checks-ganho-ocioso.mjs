/* QUANTO O LAÇO SOB DEMANDA ECONOMIZA — o número, medido, não estimado.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-ganho-ocioso.mjs

   A flag é trocável em tempo de execução (`setOnDemandRendering`), e é isso que
   torna o A/B honesto: a MESMA cena, a MESMA pose, a MESMA máquina, os dois
   laços, com segundos de relógio de parede entre as leituras. Nada aqui é
   extrapolado de um perfil.

   A régua é `renderer.info.render.frame` contra `performance.now()`, ou seja
   quadros REALMENTE desenhados por segundo com o usuário sem tocar em nada —
   que é o estado em que o estúdio passa a maior parte do tempo, porque o
   usuário está OLHANDO. Multiplicado pelas chamadas de desenho e pelos
   triângulos por quadro, dá o trabalho por segundo que a GPU deixa de fazer. */
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
await settle();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!S.trailerRig, 240000);
const L = S.lighting;

/** Quadros desenhados por segundo de relógio, com ninguém tocando em nada. */
async function idleFps(ms) {
  const f0 = S.renderer.info.render.frame;
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, ms));
  const dt = (performance.now() - t0) / 1000;
  return { fps: (S.renderer.info.render.frame - f0) / dt, dt };
}

/* deixa tudo assentar (preset, órbita, sombra) antes de medir */
for (let i = 0; i < 40; i++) await B.frame();

const st = L.getRenderStats();
const calls = st.calls, tris = st.triangles;

L.setOnDemandRendering(false);
for (let i = 0; i < 20; i++) await B.frame();
const cont = await idleFps(3000);

L.setOnDemandRendering(true);
for (let i = 0; i < 20; i++) await B.frame();
const dem = await idleFps(3000);

const r1 = (v) => Math.round(v * 10) / 10;
out.push(['chamadas de desenho por quadro', calls]);
out.push(['triângulos por quadro', tris.toLocaleString('pt-BR')]);
out.push(['OCIOSO — laço contínuo (antes)', `${r1(cont.fps)} quadros/s`]);
out.push(['OCIOSO — laço sob demanda (agora)', `${r1(dem.fps)} quadros/s`]);
out.push(['chamadas de desenho por segundo, antes',
  Math.round(cont.fps * calls).toLocaleString('pt-BR')]);
out.push(['chamadas de desenho por segundo, agora',
  Math.round(dem.fps * calls).toLocaleString('pt-BR')]);
out.push(['triângulos por segundo, antes',
  Math.round(cont.fps * tris).toLocaleString('pt-BR')]);
out.push(['triângulos por segundo, agora',
  Math.round(dem.fps * tris).toLocaleString('pt-BR')]);
out.push(['economia no estado ocioso',
  cont.fps > 0 ? `${r1(100 * (1 - dem.fps / cont.fps))} %` : 'n/d']);

return out;
