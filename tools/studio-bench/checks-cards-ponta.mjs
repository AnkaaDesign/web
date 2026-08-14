/* OS DOIS CARDS DE PONTA — por que traseira e testeira saem de tamanhos
   diferentes.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-cards-ponta.mjs

   Diagnóstico antes do conserto: mede a proporção publicada em `--ts-pw-ar`
   para cada face e o tamanho renderizado de cada card, para saber se a
   diferença vem do RETRATO (proporções de fato diferentes) ou de uma das duas
   faces ter degradado para a foto estática. */
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
/* Os retratos são assíncronos — sem esperar, as duas faces ainda estariam na
   foto estática e a medida não diria nada. */
await B.until(() => {
  const r = document.querySelector('.preview-card[data-surface="rear"]');
  const f = document.querySelector('.preview-card[data-surface="front"]');
  return !!r && !!f && r.classList.contains('ts-pw-behind') && f.classList.contains('ts-pw-behind');
}, 120000);
for (let i = 0; i < 10; i++) await B.frame();

for (const key of ['rear', 'front', 'left', 'right']) {
  const card = document.querySelector('.preview-card[data-surface="' + key + '"]');
  if (!card) { out.push([key, 'card ausente']); continue; }
  const media = card.querySelector('.ts-panel__media');
  const cv = media && media.querySelector('canvas');
  const cs = getComputedStyle(card);
  const ar = cs.getPropertyValue('--ts-pw-ar').trim();
  const cr = card.getBoundingClientRect();
  const mr = media ? media.getBoundingClientRect() : { width: 0, height: 0 };
  out.push([`${key} · --ts-pw-ar`, ar || '(não publicada)']);
  out.push([`${key} · card  (l x a)`,
    `${cr.width.toFixed(1)} x ${cr.height.toFixed(1)}`]);
  out.push([`${key} · media (l x a)`,
    `${mr.width.toFixed(1)} x ${mr.height.toFixed(1)}`]);
  out.push([`${key} · retrato atrás`, card.classList.contains('ts-pw-behind')]);
  out.push([`${key} · canvas buffer`, cv ? `${cv.width} x ${cv.height}` : 'n/d']);
}

const r = document.querySelector('.preview-card[data-surface="rear"]').getBoundingClientRect();
const f = document.querySelector('.preview-card[data-surface="front"]').getBoundingClientRect();
const dh = Math.abs(r.height - f.height);
const dw = Math.abs(r.width - f.width);
/* Meio pixel de folga: as duas caixas saem de `aspect-ratio` sobre a mesma
   largura, e o arredondamento sub-pixel do layout pode devolver 0,5. */
out.push(['DIFERENÇA de altura entre os dois cards de ponta',
  dh <= 0.5 ? `ok (${dh.toFixed(1)} px)` : `${dh.toFixed(1)} px  <<< desiguais`]);
out.push(['DIFERENÇA de largura',
  dw <= 0.5 ? `ok (${dw.toFixed(1)} px)` : `${dw.toFixed(1)} px  <<< desiguais`]);

/* E o letterbox tem de ser SIMÉTRICO e não-negativo: uma tarja só em cima
   significaria a conta do deslocamento errada, e uma negativa significaria o
   retrato saindo da caixa. */
for (const key of ['rear', 'front']) {
  const card = document.querySelector('.preview-card[data-surface="' + key + '"]');
  const cs = getComputedStyle(card);
  const bgh = parseFloat(cs.getPropertyValue('--ts-pw-bgh')) || 100;
  const bgy = parseFloat(cs.getPropertyValue('--ts-pw-bgy')) || 0;
  const sobra = 100 - bgh;
  out.push([`${key} · tarja do retrato`,
    bgh > 100 || bgy < -0.01 ? `INVÁLIDA (h ${bgh}%, y ${bgy}%)  <<<`
      : Math.abs(sobra / 2 - bgy) <= 0.05
        ? `ok (retrato ${bgh.toFixed(1)}%, centrado)`
        : `assimétrica: h ${bgh.toFixed(1)}%, y ${bgy.toFixed(1)}%  <<<`]);
}

return out;
