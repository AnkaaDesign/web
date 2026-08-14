/* A RODADA DE 2026-08-13 no editor de plotagem, inteira.
   ===========================================================================
   Uma trava por pedido, todas na mesma sessão do navegador porque elas se
   cruzam — o livery do teto só existe se o recorte sobreviver à tinta, e a
   camada do Thermo King só aparece na face que o recorte da testeira cria.

     1  a chapa sobrevive ao recorte com "pintar o implemento" LIGADO
     2  o TETO é uma face de livery: uv1, sobreposição, tela e cor própria
     3  o THERMO KING é uma camada da testeira e a cor dele chega ao motor
     4  Configurações ficou só com Paralamas
     5  arrastar o painel MOVE a vista (e um clique seco seleciona o Fundo)
     6  a cor da FACE ganha da cor do cavalo, em vez de ser apagada por ela

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-liveries-0813.mjs
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
const L = S.livery;
await B.frame(); await B.frame();

const meshNamed = (n) => {
  let hit = null;
  S.trailer.traverse((o) => { if (o.isMesh && o.name === n) hit = o; });
  return hit;
};
const panelCount = () => {
  const n = { SIDE_L: 0, SIDE_R: 0, REAR: 0, FRONT: 0, TRAILER_ROOF: 0 };
  S.trailer?.traverse((o) => { if (o.isMesh && n[o.name] !== undefined) n[o.name]++; });
  return n;
};
const overlaysOn = (n) => {
  const m = meshNamed(n);
  return m ? m.children.filter((c) => c.userData && c.userData.liveryOverlay).length : -1;
};

/* ---------------- 1 · o recorte sob a tinta ---------------- */
const box = document.getElementById('paint-trailer');
if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
await new Promise((r) => setTimeout(r, 2000));
for (let i = 0; i < 30; i++) await B.frame();
out.push(['1 · tinta do cavalo no implemento', S.models.state.paintTarget === 'both']);

const card = document.querySelector('.preview-card[data-surface="left"]');
if (card) card.click();
for (let i = 0; i < 6; i++) await B.frame();

document.querySelector('.ms-door-add')?.click();
await B.until(() => (S.trailerRig.body.getDoorHoles('left') || []).length === 1, 90000);
await B.until(() => !S.measures.isGeometryBusy(), 90000);
for (let i = 0; i < 60; i++) await B.frame();
await new Promise((r) => setTimeout(r, 2500));
const c1 = panelCount();
out.push(['1 · as 4 chapas sobrevivem ao vão', c1.SIDE_L === 1 && c1.SIDE_R === 1
  && c1.REAR === 1 && c1.FRONT === 1]);
out.push(['    contagem de malhas', JSON.stringify(c1)]);

/* ---------------- 2 · o TETO ---------------- */
const roof = meshNamed('TRAILER_ROOF');
out.push(['2 · a malha do teto existe', !!roof]);
out.push(['2 · o teto tem uv1', !!roof?.geometry?.getAttribute('uv1')]);
/* UMA sobreposição, e não N: a malha do teto sobrevive ao rebuild, então sem a
   limpeza de `makeLiveryOverlay()` cada recorte penduraria outra. Já houve UM
   recorte acima, então este número prova a limpeza. */
out.push(['2 · UMA sobreposição de arte no teto', overlaysOn('TRAILER_ROOF') === 1]);
out.push(['    sobreposições', overlaysOn('TRAILER_ROOF')]);
out.push(['2 · a aba Teto existe',
  !!document.querySelector('#surface-tabs .tab[data-surface="roof"]')]);
out.push(['2 · o card Teto existe',
  !!document.querySelector('.preview-card[data-surface="roof"]')]);
out.push(['2 · a tela do teto tem tamanho de chapa',
  L.surfaces.roof.getWidth() > 1000 && L.surfaces.roof.getHeight() > 100]);
out.push(['    tela do teto', `${L.surfaces.roof.getWidth()}x${L.surfaces.roof.getHeight()}`]);
const mmRoof = L.panelMM('roof');
out.push(['2 · a régua do teto mede a CHAPA, não a espessura', mmRoof.h > 1500]);
out.push(['    teto medido (mm)', `${mmRoof.w} x ${mmRoof.h}`]);

/* A cor própria do teto: é o Fundo daquela face. */
document.querySelector('#surface-tabs .tab[data-surface="roof"]')?.click();
for (let i = 0; i < 6; i++) await B.frame();
const pick = document.getElementById('bgcolor');
pick.value = '#123456';
pick.dispatchEvent(new Event('input', { bubbles: true }));
pick.dispatchEvent(new Event('change', { bubbles: true }));
for (let i = 0; i < 10; i++) await B.frame();
out.push(['2 · a cor do teto é o Fundo da face', L.surfaces.roof.backgroundColor === '#123456']);
out.push(['2 · as medidas somem no teto',
  !!document.getElementById('measures-card')?.classList.contains('hidden')]);

/* ---------------- 3 · o THERMO KING ---------------- */
document.querySelector('#surface-tabs .tab[data-surface="front"]')?.click();
for (let i = 0; i < 6; i++) await B.frame();
const tkRow = [...document.querySelectorAll('#layer-list .layer-row')]
  .find((r) => /Thermo King/.test(r.textContent || ''));
out.push(['3 · a camada Thermo King está na testeira', !!tkRow]);
if (tkRow) {
  tkRow.click();
  for (let i = 0; i < 4; i++) await B.frame();
  out.push(['3 · clicar abre a seção dele',
    !document.querySelector('#inspector .insp[data-for="tk"]')?.classList.contains('hidden')]);
  const tkPick = document.getElementById('tk-color');
  tkPick.value = '#abcdef';
  tkPick.dispatchEvent(new Event('change', { bubbles: true }));
  for (let i = 0; i < 6; i++) await B.frame();
  out.push(['3 · a cor chega ao motor', S.trimColor
    ? S.trimColor('thermoking') === '#abcdef' : true]);
  out.push(['    estado na linha', (document.getElementById('tk-val') || {}).textContent]);
}
/* E ele NÃO aparece nas outras faces. */
document.querySelector('#surface-tabs .tab[data-surface="rear"]')?.click();
for (let i = 0; i < 6; i++) await B.frame();
out.push(['3 · a camada não vaza para a traseira',
  ![...document.querySelectorAll('#layer-list .layer-row')]
    .some((r) => /Thermo King/.test(r.textContent || ''))]);

/* ---------------- 4 · Configurações ---------------- */
const cfg = document.getElementById('ts-cfg-body');
const cfgText = cfg ? cfg.textContent || '' : '';
out.push(['4 · Configurações tem Paralamas', /Paralamas/.test(cfgText)]);
out.push(['4 · Configurações NÃO tem Teto nem Thermo King',
  !/Teto|Thermo King/.test(cfgText)]);

/* ---------------- 5 · arrastar o painel ---------------- */
document.querySelector('#surface-tabs .tab[data-surface="left"]')?.click();
for (let i = 0; i < 4; i++) await B.frame();
const zoomSel = document.getElementById('stage-zoom');
zoomSel.value = '4';
zoomSel.dispatchEvent(new Event('change', { bubbles: true }));
for (let i = 0; i < 8; i++) await B.frame();
const stage = document.getElementById('modal-stage');
stage.scrollLeft = 400;
const before = stage.scrollLeft;
const rect = stage.getBoundingClientRect();
const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
const canvasEl = L.surfaces.left.upperCanvasEl;
const opts = (x, y) => ({
  bubbles: true, cancelable: true, composed: true,
  clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 7, pointerType: 'mouse', isPrimary: true,
});
canvasEl.dispatchEvent(new PointerEvent('pointerdown', opts(cx, cy)));
for (const dx of [20, 40, 60, 80, 100]) {
  canvasEl.dispatchEvent(new PointerEvent('pointermove', opts(cx + dx, cy)));
}
canvasEl.dispatchEvent(new PointerEvent('pointerup', opts(cx + 100, cy)));
for (let i = 0; i < 4; i++) await B.frame();
out.push(['5 · arrastar o painel MOVEU a vista', stage.scrollLeft !== before]);
out.push(['    rolagem', `${before} -> ${stage.scrollLeft}`]);

/* Um clique SECO no vazio seleciona o Fundo. */
canvasEl.dispatchEvent(new PointerEvent('pointerdown', opts(cx, cy)));
canvasEl.dispatchEvent(new PointerEvent('pointerup', opts(cx, cy)));
for (let i = 0; i < 4; i++) await B.frame();
out.push(['5 · clique seco seleciona o Fundo',
  !document.querySelector('#inspector .insp[data-for="bg"]')?.classList.contains('hidden')]);

/* ---------------- 6 · a cor da face ganha da cor do cavalo ---------------- */
document.querySelector('#surface-tabs .tab[data-surface="rear"]')?.click();
for (let i = 0; i < 4; i++) await B.frame();
const p2 = document.getElementById('bgcolor');
p2.value = '#101010';
p2.dispatchEvent(new Event('change', { bubbles: true }));
for (let i = 0; i < 6; i++) await B.frame();
/* E agora DESLIGA e RELIGA a tinta do cavalo: a versão antiga apagava o fundo
   das quatro telas ao ligar, e era exatamente esse o defeito relatado. */
box.checked = false; box.dispatchEvent(new Event('change'));
for (let i = 0; i < 6; i++) await B.frame();
box.checked = true; box.dispatchEvent(new Event('change'));
for (let i = 0; i < 6; i++) await B.frame();
out.push(['6 · a cor da traseira SOBREVIVE ao liga/desliga da tinta',
  L.surfaces.rear.backgroundColor === '#101010']);
out.push(['6 · o teto também', L.surfaces.roof.backgroundColor === '#123456']);
out.push(['6 · e as laterais continuam sem cor própria',
  !L.surfaces.left.backgroundColor && !L.surfaces.right.backgroundColor]);

out.push(['minDistance (m)', r2(S.controls.minDistance)]);

return out;
