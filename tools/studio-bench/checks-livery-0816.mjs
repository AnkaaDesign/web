/* A RODADA DE 2026-08-16 NO EDITOR DE PLOTAGEM — uma trava por pedido.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-livery-0816.mjs

     1  a cor do THERMO KING REFOTOGRAFA a testeira (e só ela)
     2  as duas linhas do Fundo nunca acendem juntas — quem acende é quem MANDA
     3  clicar no Thermo King no palco seleciona a CAMADA dele, não o Fundo
     4  clique simples na camada SELECIONA; duplo clique é que renomeia
     5  a linha sobreposta NÃO lê como ligada (tique cinza + nome riscado)
     6  o Thermo King tem a MESMA pilha de duas linhas, e a de cima é a do Fundo

   Elas se cruzam de propósito e rodam na mesma sessão: 1 e 3 dependem do mesmo
   retrato da testeira, e 2 depende do estado que 1 deixou. */
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
const quadros = async (n) => { for (let i = 0; i < n; i++) await B.frame(); };
await quadros(20);

/* Abre o editor na TESTEIRA, que é onde o Thermo King mora. */
document.querySelector('.preview-card[data-surface="front"]')?.click();
await quadros(8);
await B.until(() => !!L.getSnapshot('front'), 120000);
await quadros(6);
out.push(['editor aberto na testeira',
  document.querySelector('#surface-tabs .tab.active')?.dataset.surface === 'front']);

/* =================== 1 · a cor do TK refotografa a testeira ============== */
const antesFrente = L.getSnapshot('front')?.bg || '';
const antesLateral = L.getSnapshot('left')?.bg || '';
const tkColor = document.getElementById('tk-color');
out.push(['1 · a seção do Thermo King existe', !!tkColor]);
if (tkColor) {
  tkColor.value = '#7b1fa2';
  tkColor.dispatchEvent(new Event('change', { bubbles: true }));
  await quadros(4);
  out.push(['1 · a cor chegou ao motor', S.trim.get().thermoking.color === '#7b1fa2']);
  /* O disparo é DEBOUNCED em 200 ms e a foto cede quadros — esperar pelo
     resultado, e não por um tempo fixo, é o que torna a trava estável. */
  const trocou = await B.until(() => (L.getSnapshot('front')?.bg || '') !== antesFrente, 30000);
  out.push(['1 · a TESTEIRA foi refotografada', trocou]);
  out.push(['1 · e a LATERAL não foi (só a face que mudou)',
    (L.getSnapshot('left')?.bg || '') === antesLateral]);
}

/* =================== 2 · as duas linhas do Fundo ======================== */
const linhaCavalo = document.getElementById('bg-row-cab');
const linhaFace = document.getElementById('bg-row-face');
const caixa = document.getElementById('paint-trailer');
const acesa = (el) => !!el?.classList.contains('is-on');
const apagada = (el) => !!el?.classList.contains('is-muted');

/* Abre a seção do Fundo (clicar na camada Fundo é o caminho do usuário). */
const abrirFundo = async () => {
  const linhas = [...document.querySelectorAll('#layer-list .layer-row--bg')];
  linhas[0]?.click();
  await quadros(3);
};
await abrirFundo();

/* (a) tinta do cavalo LIGADA, face SEM cor própria → só a de cima acende */
if (caixa && !caixa.checked) { caixa.checked = true; caixa.dispatchEvent(new Event('change')); }
await quadros(6);
document.getElementById('bg-clear')?.click();
await quadros(4);
await abrirFundo();
out.push(['2a · sem cor própria — a linha do CAVALO manda', acesa(linhaCavalo) && !acesa(linhaFace)]);
out.push(['2a · e nada está marcado como sobreposto', !apagada(linhaCavalo)]);

/* (b) a face ganha cor própria → a de baixo acende e a de cima é SOBREPOSTA */
const bg = document.getElementById('bgcolor');
bg.value = '#0b0b0b';
bg.dispatchEvent(new Event('change', { bubbles: true }));
await quadros(4);
out.push(['2b · com cor própria — a linha da FACE manda', acesa(linhaFace)]);
out.push(['2b · e a do CAVALO NÃO acende junto', !acesa(linhaCavalo)]);
out.push(['2b · a do CAVALO fica marcada como sobreposta', apagada(linhaCavalo)]);
out.push(['2b · e o estado dela diz por quê',
  (document.getElementById('bg-cab-val')?.textContent || '').trim()]);
/* ⚠️ E A CAIXA CONTINUA MARCADA: a tinta do cavalo é uma decisão sobre o BAÚ
   INTEIRO. Desmarcá-la "para ficar coerente" despintaria as outras três faces. */
out.push(['2b · a caixa continua marcada (a pilha não é exclusiva)', caixa.checked === true]);
out.push(['2b · e o motor continua com o implemento pintado',
  S.models.state.paintTarget === 'both']);

/* (c) a mesma face NAS LATERAIS — o relato dizia "acontece até nas laterais" */
document.querySelector('#surface-tabs .tab[data-surface="left"]')?.click();
await quadros(4);
await abrirFundo();
out.push(['2c · na lateral sem cor própria — só o CAVALO acende',
  acesa(linhaCavalo) && !acesa(linhaFace)]);
document.querySelector('#surface-tabs .tab[data-surface="front"]')?.click();
await quadros(4);
await abrirFundo();

/* =================== 3 · clicar no TK seleciona a camada dele =========== */
const snapFront = L.getSnapshot('front');
out.push(['3 · o retrato publica o retângulo do Thermo King', !!snapFront?.tk]);
if (snapFront?.tk) {
  const painel = L.stagePanels.front;
  const r = painel.getBoundingClientRect();
  const alvo = snapFront.tk;
  const cx = r.left + (alvo.x + alvo.w / 2) * r.width;
  const cy = r.top + (alvo.y + alvo.h / 2) * r.height;
  const opts = (x, y) => ({
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: 1,
    pointerId: 11, pointerType: 'mouse', isPrimary: true,
  });
  const canvasEl = L.surfaces.front.upperCanvasEl;
  canvasEl.dispatchEvent(new PointerEvent('pointerdown', opts(cx, cy)));
  canvasEl.dispatchEvent(new PointerEvent('pointerup', opts(cx, cy)));
  await quadros(4);
  const secTk = document.querySelector('#inspector .insp[data-for="tk"]');
  const secBg = document.querySelector('#inspector .insp[data-for="bg"]');
  out.push(['3 · a seção do Thermo King abriu', !secTk?.classList.contains('hidden')]);
  out.push(['3 · e a do Fundo não', !!secBg?.classList.contains('hidden')]);
  out.push(['3 · a linha dele na lista de camadas ficou marcada',
    [...document.querySelectorAll('#layer-list .layer-row--fixed')]
      .some((el) => el.classList.contains('on') && /Thermo King/.test(el.textContent || ''))]);

  /* E um clique FORA do retângulo continua caindo no Fundo — o comportamento
     de antes não pode ter sido trocado por este. */
  const fx = r.left + Math.min(0.97, alvo.x + alvo.w + 0.12) * r.width;
  const fy = r.top + (alvo.y + alvo.h / 2) * r.height;
  canvasEl.dispatchEvent(new PointerEvent('pointerdown', opts(fx, fy)));
  canvasEl.dispatchEvent(new PointerEvent('pointerup', opts(fx, fy)));
  await quadros(4);
  out.push(['3 · fora do retângulo ainda seleciona o Fundo',
    !document.querySelector('#inspector .insp[data-for="bg"]')?.classList.contains('hidden')]);
}

/* =================== 4 · clique simples seleciona a camada ============== */
document.querySelector('.tool[data-act="text"]')?.click();
await quadros(6);
const linhaObj = document.querySelector('#layer-list .layer-row:not(.layer-row--bg):not(.layer-row--fixed)');
out.push(['4 · há uma camada de objeto na lista', !!linhaObj]);
if (linhaObj) {
  const campo = linhaObj.querySelector('input.lyr-name');
  out.push(['4 · o nome nasce somente-leitura', campo?.readOnly === true]);
  /* Desmarca tudo antes, para o "ficou selecionada" significar alguma coisa. */
  L.surfaces.front.discardActiveObject();
  L.surfaces.front.requestRenderAll();
  document.querySelector('#layer-list .layer-row--bg')?.click();
  await quadros(3);

  /* UM clique, EM CIMA DO CAMPO DE NOME — é o gesto do relato. */
  const rc = campo.getBoundingClientRect();
  const ev = (t) => new MouseEvent(t, {
    bubbles: true, cancelable: true, composed: true,
    clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2, button: 0,
  });
  campo.dispatchEvent(ev('mousedown'));
  campo.dispatchEvent(ev('mouseup'));
  campo.dispatchEvent(ev('click'));
  await quadros(4);
  out.push(['4 · clique no NOME selecionou a camada',
    L.surfaces.front.getActiveObjects().length === 1]);
  out.push(['4 · e NÃO entrou em edição', campo.readOnly === true]);
  out.push(['4 · e não roubou o foco', document.activeElement !== campo]);

  /* DUPLO clique entra em edição. */
  campo.dispatchEvent(new MouseEvent('dblclick', {
    bubbles: true, cancelable: true, composed: true,
    clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2,
  }));
  await quadros(3);
  out.push(['4 · duplo clique ABRE a edição', campo.readOnly === false]);
  /* O TEXTO FICA SELECIONADO, e é isso que se mede — não o `activeElement`.
     Num navegador headless a JANELA não tem foco, então `document.activeElement`
     cai no `<body>` mesmo depois de um `focus()` que funcionou; o que sobrevive
     a isso é o efeito do `select()`, que é o gesto de "já pode digitar por
     cima". */
  out.push(['4 · e o texto fica selecionado para digitar por cima',
    campo.selectionStart === 0 && campo.selectionEnd === campo.value.length
    && campo.value.length > 0]);
}

/* =================== 5 · a linha sobreposta não lê como ligada ========== */
/* O relato depois do primeiro conserto: *"cor do cavalo continuar selecionada,
   mesmo quando eu pinto de uma cor diferente"*. O que sobrava dizendo "ligado
   AQUI" era o TIQUE verde ao lado de uma linha apagada. */
await abrirFundo();
const est = (el) => (el ? getComputedStyle(el) : null);
{
  const marcado = est(linhaCavalo.querySelector('.bg-check'));
  const nome = est(linhaCavalo.querySelector('.bg-name'));
  out.push(['5 · a linha do cavalo está sobreposta agora', apagada(linhaCavalo)]);
  out.push(['5 · o tique perdeu o acento (não é mais verde)',
    (marcado?.accentColor || '') !== '' && !/34,\s*197|22c55e/i.test(marcado.accentColor)]);
  out.push(['    accent-color do tique', marcado?.accentColor]);
  out.push(['5 · e o nome está riscado', /line-through/.test(nome?.textDecorationLine || '')]);
  out.push(['5 · a linha inteira está apagada', parseFloat(est(linhaCavalo).opacity) < 0.8]);
}
/* E sem sobreposição nada disso vale. */
document.getElementById('bg-clear')?.click();
await quadros(4);
await abrirFundo();
out.push(['5 · sem cor própria, o nome NÃO fica riscado',
  !/line-through/.test(est(linhaCavalo.querySelector('.bg-name'))?.textDecorationLine || '')]);
out.push(['5 · e a linha volta ao normal', parseFloat(est(linhaCavalo).opacity) > 0.95]);

/* =================== 6 · a pilha do Thermo King ========================= */
/* *"o Thermo King está faltando essa opção pintar da cor do cavalo"*. */
const tkLinhaCavalo = document.getElementById('tk-row-cab');
const tkCaixa = document.getElementById('tk-paint-cab');
out.push(['6 · a linha "Cor do cavalo" existe na seção do Thermo King', !!tkLinhaCavalo]);
if (tkLinhaCavalo && tkCaixa) {
  /* Abre a seção do Thermo King pela camada dele. */
  [...document.querySelectorAll('#layer-list .layer-row--fixed')]
    .find((el) => /Thermo King/.test(el.textContent || ''))?.click();
  await quadros(4);
  out.push(['6 · ela espelha o estado do #paint-trailer',
    tkCaixa.checked === document.getElementById('paint-trailer').checked]);

  /* Com cor própria na carcaça, a de cima fica SOBREPOSTA. */
  const tkc = document.getElementById('tk-color');
  tkc.value = '#2e7d32';
  tkc.dispatchEvent(new Event('change', { bubbles: true }));
  await quadros(4);
  out.push(['6 · com cor própria, a de baixo manda', acesa(document.getElementById('tk-row'))]);
  out.push(['6 · e a do cavalo fica sobreposta', apagada(tkLinhaCavalo)]);
  out.push(['6 · com o nome riscado',
    /line-through/.test(est(tkLinhaCavalo.querySelector('.bg-name'))?.textDecorationLine || '')]);

  /* Tirando a cor própria, a de cima volta a mandar. */
  document.getElementById('tk-clear')?.click();
  await quadros(4);
  out.push(['6 · sem cor própria, a do CAVALO manda', acesa(tkLinhaCavalo)]);
  out.push(['6 · e a carcaça voltou a seguir o baú',
    S.trim.get().thermoking.color === null]);

  /* E desmarcar AQUI desliga a tinta do baú inteiro — é o mesmo estado. */
  tkCaixa.checked = false;
  tkCaixa.dispatchEvent(new Event('change', { bubbles: true }));
  await quadros(6);
  out.push(['6 · desmarcar aqui desliga a tinta do implemento',
    S.models.state.paintTarget === 'cab'
    && document.getElementById('paint-trailer').checked === false]);
  tkCaixa.checked = true;
  tkCaixa.dispatchEvent(new Event('change', { bubbles: true }));
  await quadros(6);
  out.push(['6 · e marcar de volta religa', S.models.state.paintTarget === 'both']);
}

return out;
