/* O PERFIL DO FRISO, medido — altura × profundidade de dois passos, direto da
   pele. Existe porque o lugar do rebite já foi chutado duas vezes em cima de
   suposições sobre a forma (primeiro no sulco, depois na curvatura): esta
   tabela acaba com a interpretação. */
const out = [];
const B = window.__bench;
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
const overlay = document.getElementById('ts-selector');
for (let i = 0; i < 12 && !overlay.classList.contains('hidden'); i++) {
  const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
  if (!cards.length) break;
  (cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || '')) || cards[0]).click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
out.push(['__studio', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['rig', await B.until(() => !!S.trailerRig, 240000)]);
await B.frame();

const prof = S.trailerRig.profile;
const mesh = S.trailer.getObjectByName('SIDE_L');
const pos = mesh.geometry.getAttribute('position');
const nor = mesh.geometry.getAttribute('normal');

/* Vértices da pele (|nx| alto), no espaço LOCAL, agregados por altura. */
let minX = Infinity;
for (let i = 0; i < pos.count; i++) if (pos.getX(i) < minX) minX = pos.getX(i);
const row0 = prof.floorY + prof.skirtHeight;
const y0 = row0 - 0.006, y1 = row0 + prof.pitch * 2 + 0.006;
const pts = new Map();
for (let i = 0; i < pos.count; i++) {
  const y = pos.getY(i);
  if (y < y0 || y > y1) continue;
  if (Math.abs(nor.getX(i)) < 0.6) continue;
  const key = Math.round(y * 2000);            // 0,5 mm
  const d = pos.getX(i) - minX;                // profundidade a partir da crista
  const e = pts.get(key);
  if (e === undefined || d < e) pts.set(key, d);
}
const tab = [...pts.entries()].sort((a, b) => a[0] - b[0])
  .map(([k, d]) => `${((k / 2000 - row0) * 1000).toFixed(1)}mm→${(d * 1000).toFixed(1)}`);
out.push(['pitch_mm', (prof.pitch * 1000).toFixed(2)]);
out.push(['perfil (y_rel → prof_mm)', tab.join(' · ')]);
return out;
