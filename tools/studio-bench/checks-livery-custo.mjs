/* Quanto o livery custa no 3D — contagem, não palpite. */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 30000);
const overlay = document.getElementById('ts-selector');
for (let s = 0; s < 12 && !overlay.classList.contains('hidden'); s++) {
  const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
  if (!cards.length) break;
  (cards.find((c) => /volvo/i.test(c.dataset.id || '')) || cards[0]).click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!S.trailerRig, 240000);
for (let i = 0; i < 10; i++) await B.frame();

let ovl = 0, ovlTris = 0, ovlVisible = 0;
const geos = new Set();
S.scene.traverse((o) => {
  if (!o.userData?.liveryOverlay) return;
  ovl++;
  let vis = o.visible, p = o.parent;
  while (vis && p) { vis = p.visible; p = p.parent; }
  if (vis) ovlVisible++;
  const g = o.geometry;
  if (g) { geos.add(g.uuid); const idx = g.getIndex(); ovlTris += (idx ? idx.count : g.getAttribute('position').count) / 3; }
});
out.push(['malhas de sobreposição de livery', ovl]);
out.push(['delas visíveis agora', ovlVisible]);
out.push(['triângulos que elas redesenham', Math.round(ovlTris).toLocaleString('pt-BR')]);
out.push(['geometrias distintas (compartilhadas com a base)', geos.size]);

/* O custo por fragmento: elas são transparent:true, então sem early-Z. */
let transp = 0, std = 0;
S.scene.traverse((o) => {
  if (!o.userData?.liveryOverlay) return;
  const m = o.material;
  if (m?.transparent) transp++;
  if (m?.type === 'MeshStandardMaterial') std++;
});
out.push(['com transparent:true (sem early-Z)', transp]);
out.push(['com MeshStandardMaterial (laço de luz completo)', std]);

/* A conta total da cena, para a proporção. */
S.lighting.setTurntable(true);
for (let i = 0; i < 4; i++) await B.frame();
const st = S.lighting.getRenderStats();
S.lighting.setTurntable(false);
out.push(['chamadas da cena inteira', st.calls.toLocaleString('pt-BR')]);
out.push(['fração que é sobreposição de livery',
  `${((ovlVisible / st.calls) * 100).toFixed(1)} %`]);

/* VRAM das telas do fabric. */
let px = 0;
for (const k of ['left', 'right', 'rear', 'front', 'roof']) {
  const c = document.getElementById('fabric-' + k);
  if (c) { px += c.width * c.height; out.push([`tela ${k}`, `${c.width}×${c.height}`]); }
}
out.push(['VRAM das cinco telas', `${(px * 4 * 4 / 3 / 1e6).toFixed(1)} MB`]);
out.push(['maior upload por edição', `${(4096 * 724 * 4 / 1e6).toFixed(1)} MB (o teto)`]);
return out;
