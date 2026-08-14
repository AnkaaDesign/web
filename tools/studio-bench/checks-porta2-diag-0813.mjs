/* DIAGNÓSTICO: por que o retrato para de ser refeito com a tinta ligada.
   ===========================================================================
   `checks-porta2-editor-0813.mjs` mostrou o defeito e não a causa: com
   "Pintar o implemento com a cor do cavalo" LIGADO, `getSnapshot('left')`
   continua sendo o MESMO objeto depois de recortar dois vãos de porta — ou
   seja, nenhuma foto nova é publicada. Com a tinta desligada as duas portas
   aparecem (`checks-porta2-0813.mjs`).

   Esta bancada não afirma nada: ela põe uma sonda de 100 ms no ar e imprime a
   LINHA DO TEMPO de quatro coisas — identidade do retrato, número de vãos na
   geometria, quantas malhas SIDE_L existem e se o inspetor está ocupado — em
   volta de cada clique. Mais os `console.warn` da página, que é onde
   `takeFaceSnapshots()` reclama quando uma face falha.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-porta2-diag-0813.mjs
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
const L = S.livery;
await B.frame(); await B.frame();

/* ---------------- as reclamações da página ---------------- */
const warns = [];
const warn0 = console.warn;
console.warn = (...a) => { warns.push(a.map(String).join(' ').slice(0, 160)); warn0(...a); };

/* ---------------- a sonda ---------------- */
const seen = new Map();          // objeto do retrato → número de série
let serial = 0;
const idOf = (o) => {
  if (!o) return '-';
  if (!seen.has(o)) seen.set(o, ++serial);
  return String(seen.get(o));
};
const sideCount = () => {
  let n = 0;
  S.trailer?.traverse((o) => { if (o.isMesh && o.name === 'SIDE_L') n++; });
  return n;
};
const sample = () => [
  idOf(L.getSnapshot('left')),
  (S.trailerRig?.body?.getDoorHoles?.('left') || []).length,
  sideCount(),
  S.measures.isGeometryBusy() ? 'B' : '.',
].join('/');

const t0 = performance.now();
const line = [];
let last = '';
const probe = setInterval(() => {
  const s = sample();
  if (s !== last) { line.push(`${Math.round(performance.now() - t0)}ms ${s}`); last = s; }
}, 100);

/* ---------------- o caminho do print ---------------- */
const box = document.getElementById('paint-trailer');
if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
await new Promise((r) => setTimeout(r, 2500));

const card = document.querySelector('.preview-card[data-surface="left"]');
if (card) card.click();
for (let i = 0; i < 6; i++) await B.frame();

line.push('— clique porta 1 —');
document.querySelector('.ms-door-add')?.click();
await new Promise((r) => setTimeout(r, 12000));

line.push('— clique porta 2 —');
document.querySelector('.ms-door-add')?.click();
await new Promise((r) => setTimeout(r, 12000));

clearInterval(probe);
console.warn = warn0;

out.push(['legenda', 'retrato# / vãos / malhas SIDE_L / ocupado']);
for (const l of line) out.push(['  ', l]);
out.push(['retratos distintos publicados', serial]);
for (const w of warns.slice(0, 12)) out.push(['  warn', w]);
out.push(['total de warns', warns.length]);

return out;
