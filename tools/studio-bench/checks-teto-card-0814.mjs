/* O CARD DO TETO TEM CHAPA — relato de 2026-08-14.
   ===========================================================================
   *"o teto do implemento no card do livery está transparente, mas quando abro
   o modal do livery ele fica branco como deveria"*.

   A chapa do card e a do palco saem da MESMA variável (`--ts-implement`), mas
   por caminhos de CSS diferentes: no palco `.stage-panel .canvas-container`
   pinta o fundo incondicionalmente, e no card a regra é
   `.ts-panel.ts-pw-ready .ts-panel__media canvas`. Quem liga `.ts-pw-ready` é
   `publishWindow()`, e o teto nunca chegava lá — ele não tem foto de
   degradação nem é `SnapshotKey`. Daí a face sair branca de um lado e
   transparente do outro.

   As travas abaixo comparam os DOIS lados na mesma sessão, que é a única forma
   de a resposta significar alguma coisa: "o card está branco" isolado passaria
   com o palco quebrado do mesmo jeito.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-teto-card-0814.mjs
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
for (let i = 0; i < 10; i++) await B.frame();

const cardOf = (k) => document.querySelector('.preview-card[data-surface="' + k + '"]');
const prevOf = (k) => document.getElementById('prev-' + k);
/* A cor EFETIVA, já resolvida pelo navegador: é ela que o olho vê, e é a
   pergunta que o relato faz. Um `getPropertyValue('--ts-implement')` diria só
   que a variável existe — ela sempre existiu. */
const bgOf = (el) => (el ? getComputedStyle(el).backgroundColor : 'sem elemento');
/* "rgba(…, 0)" e "transparent" são o defeito; qualquer cor opaca é chapa. */
const isClear = (c) => c === 'transparent' || /,\s*0\s*\)$/.test(c);

/* Espera o retrato das quatro faces recortadas aterrissar — sem ele as
   comparações abaixo mediriam o estado de boot, não o de regime.
   O RESULTADO É REPORTADO, e não engolido: sem cavalo no pacote local (os GLBs
   moraram para a API) o boot pode não chegar até a foto, e aí a trava 5 mede
   uma ausência de retrato que não é regressão nenhuma. */
const CUT = ['left', 'right', 'rear', 'front'];
const snapped = await B.until(() => CUT.every((k) => L.hasSnapshot(k)), 240000);
/* Texto e não booleano: a ausência de retrato NESTA máquina é ambiente (o
   pacote local não tem o cavalo), não regressão. Reprovar a rodada por isso
   ensinaria a ignorar o vermelho da bancada, que é o pior estrago possível. */
out.push(['retratos das 4 chapas', snapped ? 'aterrissaram'
  : 'NÃO aterrissaram — travas 5 ficam de fora (falta o GLB do cavalo)']);
for (let i = 0; i < 10; i++) await B.frame();

/* ---------------- 1 · o card do teto ---------------- */
const roofCard = cardOf('roof');
out.push(['1 · o card do teto existe', !!roofCard]);
out.push(['1 · o card do teto está PRONTO (.ts-pw-ready)',
  !!roofCard?.classList.contains('ts-pw-ready')]);
/* Sem retrato, então sem a inversão: a chapa é o fundo da própria tela. */
out.push(['1 · e sem retrato (.ts-pw-behind desligada)',
  !roofCard?.classList.contains('ts-pw-behind')]);
const roofBg = bgOf(prevOf('roof'));
out.push(['1 · a miniatura do teto tem CHAPA', !isClear(roofBg)]);
out.push(['    fundo da miniatura', roofBg]);
/* E nenhuma foto pedida: `panels/teto.png` não existe e nunca vai existir. */
out.push(['1 · o card do teto não pede foto nenhuma',
  (roofCard?.style.getPropertyValue('--ts-pw-img') || '').trim() === 'none']);

/* ---------------- 2 · o card e o palco dizem a mesma coisa ---------------- */
roofCard?.click();
for (let i = 0; i < 10; i++) await B.frame();
out.push(['2 · o editor abriu no teto', L.activeKey ? L.activeKey() === 'roof'
  : !document.getElementById('livery-modal')?.classList.contains('hidden')]);
const stageBg = bgOf(document.querySelector('#modal-stage .canvas-container'));
out.push(['2 · o palco tem chapa', !isClear(stageBg)]);
out.push(['2 · CARD E PALCO NA MESMA COR', roofBg === stageBg]);
out.push(['    palco / card', stageBg + '  ·  ' + roofBg]);

/* ---------------- 3 · a miniatura não sai espremida ---------------- */
/* `sizePreviewCanvas()` se guardava na janela publicada, então o buffer do
   teto ficava no 600×106 literal do template enquanto a tela do fabric seguia
   a chapa medida — a arte saía esticada na razão entre as duas. */
const fab = L.surfaces.roof;
const pv = prevOf('roof');
const arFab = fab.getWidth() / fab.getHeight();
const arPv = pv ? pv.width / pv.height : 0;
out.push(['3 · o buffer da miniatura segue a chapa', Math.abs(arPv - arFab) / arFab < 0.02]);
out.push(['    razão tela / miniatura', arFab.toFixed(3) + ' · ' + arPv.toFixed(3)]);

/* ---------------- 4 · a chapa segue a tinta, nos dois ---------------- */
/* Ligar "pintar o implemento" troca `--ts-implement`. Card e palco leem a mesma
   variável, então os dois têm de virar juntos — e essa é a prova de que o card
   voltou para o caminho de CSS certo, e não ganhou um branco escrito à mão. */
const box = document.getElementById('paint-trailer');
if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
await new Promise((r) => setTimeout(r, 2000));
for (let i = 0; i < 30; i++) await B.frame();
const roofBg2 = bgOf(prevOf('roof'));
const stageBg2 = bgOf(document.querySelector('#modal-stage .canvas-container'));
/* SÓ VALE SE HOUVER TINTA. Sem cavalo carregado (os GLBs de caminhão moram na
   API, e o pacote local da bancada não os tem) `cabPaintColor()` é o branco de
   partida — ligar a caixa troca branco por branco, e uma trava de igualdade
   reprovaria uma máquina, não o código. */
const cabHex = L.cabPaintColor ? L.cabPaintColor() : '#ffffff';
if (cabHex.toLowerCase() === '#ffffff') {
  out.push(['4 · (sem tinta de cavalo nesta máquina — trava não aplicável)', cabHex]);
} else {
  out.push(['4 · a chapa mudou com a tinta do cavalo', roofBg2 !== roofBg]);
}
out.push(['4 · e continua igual à do palco', roofBg2 === stageBg2]);
out.push(['    palco / card pintados', stageBg2 + '  ·  ' + roofBg2]);

/* ---------------- 5 · as outras quatro não regrediram ---------------- */
/* Elas continuam com RETRATO (a foto do próprio baú atrás da arte), que é um
   caminho de CSS diferente do do teto. Uma "correção" que ligasse chapa em todo
   mundo apagaria o retrato delas. */
if (snapped) {
  out.push(['5 · as quatro chapas seguem com retrato',
    CUT.every((k) => cardOf(k)?.classList.contains('ts-pw-behind'))]);
  out.push(['5 · e a tela delas segue transparente (o retrato aparece)',
    CUT.every((k) => isClear(bgOf(prevOf(k))))]);
} else {
  out.push(['5 · (sem retrato nesta máquina — trava não aplicável)',
    CUT.map((k) => k + ':' + (L.hasSnapshot(k) ? 'sim' : 'não')).join(' ')]);
}

return out;
