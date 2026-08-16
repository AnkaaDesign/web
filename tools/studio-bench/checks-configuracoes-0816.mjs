/* O CARD DE CONFIGURAÇÕES — quatro defeitos de uma tela só. 2026-08-16.
   ===========================================================================
   Relato do dono, inteiro:

     *"quando configurações está aberto a parte lateral de todos os cards ficam
      cortados, além disso parece ter um background em todos juntos, não
      deveria, e todos os cards têm um border green no hover, exceto a
      iluminação, e o paralamas está faltando ter a opção de pintar da cor do
      cavalo também, como todos os outros itens"*

   São QUATRO queixas e TRÊS causas — as duas primeiras são o mesmo defeito visto
   de dois ângulos:

     1+2. `overflow-y: auto` em `#ts-panels` FORÇA `overflow-x` a `auto` (regra de
          CSS: um eixo que deixa de ser `visible` tira o `visible` do outro). O
          que passa a ser cortado no eixo horizontal não é conteúdo — os cards
          têm exatamente a largura da caixa —, é a SOMBRA. Sem ela as bordas
          viram um corte reto de cima a baixo e as sombras dos cinco cards se
          emendam nos vãos: a coluna inteira lê como UMA LAJE ESCURA. Conserto:
          acolchoar por dentro e recuar o deslocamento pelo mesmo tanto.
     3.   `#ts-hud:hover` acendia em branco enquanto `.ts-panel:hover` e
          `.ts-cfg:hover` acendem em `--accent`. Duas gramáticas para o mesmo
          gesto, em duas colunas visíveis ao mesmo tempo.
     4.   O para-lama era a única peça com `followsBody: false`. Virou `true` —
          e isso destapou DOIS buracos no motor, que este arquivo prova
          fechados:
            · ele é a única peça que segue o corpo SEM estar em
              `trailerPanelMeshes()`, então ninguém guardava o material de
              fábrica dele (`trimFactoryMat`);
            · ele casa por MATERIAL, e vestir a tinta APAGA a identidade dele —
              `meshesOf()` deixava de encontrá-lo e a cor entrava sem nunca mais
              sair. Era um defeito ANTERIOR (valia para a cor própria) e está
              fechado pelo carimbo `userData.trimKey`.

   ⚠️ O CONJUNTO DESTA BANCADA NÃO TEM MATERIAL `paralamas` — 52 materiais no
   implemento, nenhum casa. Por isso o portão 4 testa o CAMINHO num para-lama
   SINTÉTICO: uma malha ganha um material com aquele nome e o teste segue o
   material dela nas quatro transições. É o mecanismo que está sob teste, não a
   presença da peça.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-configuracoes-0816.mjs
*/
const out = [];
const B = window.__bench;
const q = (s) => document.querySelector(s);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!(S.state?.trailer || S.state?.cab), 240000);
for (let i = 0; i < 20; i++) await B.frame();

const panels = document.getElementById('ts-panels');
q('#ts-cfg-toggle').click();
await B.frame(); await B.frame();
await new Promise((r) => setTimeout(r, 300));

/* 1+2 · a sombra tem onde cair: o card mais largo NÃO encosta nas bordas da caixa de rolagem */
const card = q('#ts-panels .ts-panel:not(.ts-panel--end)');
const cb = card.getBoundingClientRect();
const pb = panels.getBoundingClientRect();
out.push(['folga do card até a borda do scroller',
  `esq ${Math.round(cb.left - pb.left)} px · dir ${Math.round(pb.right - cb.right)} px`]);
out.push(['★ a sombra lateral não é cortada (>= 6 px dos dois lados)',
  cb.left - pb.left >= 6 && pb.right - cb.right >= 6]);
out.push(['★ o card continua a 14 px da borda do render',
  Math.round(window.innerWidth - cb.right)]);

/* 3 · o hover do HUD é verde, como os cards */
const hud = document.getElementById('ts-hud');
const green = getComputedStyle(document.querySelector('.truck-studio-root')).getPropertyValue('--accent').trim();
const rule = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } })
  .filter((r) => r.selectorText && /#ts-hud:hover/.test(r.selectorText))
  .map((r) => r.style.borderColor).join(' | ');
out.push(['borda do #ts-hud:hover', rule]);
out.push(['★ o HUD acende em verde como os cards', /accent/.test(rule)]);

/* 4 · a linha "Cor do cavalo" existe no card e aciona a do editor */
const row = document.getElementById('ts-cfg-row-cab');
const box = document.getElementById('ts-cfg-paint-cab');
const master = document.getElementById('paint-trailer');
out.push(['★ a linha "Cor do cavalo" existe em Configurações', !!row && !!box]);
out.push(['ela nasce espelhando a do editor', !!box && box.checked === master.checked]);
box.checked = true;
box.dispatchEvent(new Event('change', { bubbles: true }));
await B.frame(); await B.frame();
out.push(['★ marcar aqui aciona a decisão ÚNICA', master.checked === true && S.models.state.paintTarget === 'both']);

/* 4b · O MECANISMO, provado num para-lama SINTÉTICO.
   ⚠️ O conjunto desta bancada não tem material `paralamas` (52 materiais no
   implemento, nenhum deles casa) — então o que se testa aqui é o CAMINHO, e não
   a presença da peça: uma malha ganha um material chamado `paralamas`, e o teste
   confere que ela veste a tinta do baú e, o que importa mais, que ELA VOLTA. */
const T = S.THREE;
let alvo = null;
S.models.state.trailer?.traverse((o) => { if (!alvo && o.isMesh && !Array.isArray(o.material)) alvo = o; });
out.push(['malha de teste encontrada', !!alvo]);
const original = alvo.material;
const falso = new T.MeshStandardMaterial({ name: 'paralamas', color: 0x777777 });
alvo.material = falso;

const master2 = document.getElementById('paint-trailer');
const setar = async (on) => {
  master2.checked = on;
  master2.dispatchEvent(new Event('change'));
  await B.frame(); await B.frame();
};

await setar(true);
const bodyMat = S.models.state.trailerPaintMat;
out.push(['★ com "Cor do cavalo" LIGADA o para-lama veste a tinta do baú',
  !!bodyMat && alvo.material === bodyMat]);

await setar(false);
out.push(['★ e DESLIGANDO ele VOLTA ao de fábrica (não fica pintado)',
  alvo.material === falso]);

/* E A COR PRÓPRIA: ela ganha da do cavalo, E SAI quando se pede. O segundo é o
   defeito ANTERIOR que o carimbo fecha — uma peça casada por material some do
   alcance deste módulo assim que recebe a primeira demão, e a cor entrava sem
   nunca mais sair. */
await setar(true);
const pick = document.getElementById('ts-cfg-pick-fenders');
out.push(['o seletor de cor do para-lama existe', !!pick]);
pick.value = '#c8102e';
pick.dispatchEvent(new Event('input', { bubbles: true }));
pick.dispatchEvent(new Event('change', { bubbles: true }));
await B.frame(); await B.frame();
out.push(['★ a cor PRÓPRIA ganha da tinta do cavalo',
  alvo.material !== bodyMat && alvo.material !== falso]);
const reset = document.getElementById('ts-cfg-reset-fenders');
reset.click();
await B.frame(); await B.frame();
out.push(['★ e tirar a cor própria devolve a peça (defeito anterior, fechado)',
  alvo.material === bodyMat]);
await setar(false);
out.push(['★ e depois ela volta ao de fábrica', alvo.material === falso]);

alvo.material = original;
delete alvo.userData.trimKey;
delete alvo.userData.trimFactoryMat;
out.push(['malha de teste devolvida', alvo.material === original]);
return out;
