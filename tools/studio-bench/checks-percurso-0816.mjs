/* O CRIADOR DE VÍDEO, DE PONTA A PONTA — bancada de 2026-08-16.
   ===========================================================================
   O pedido que criou o recurso: *"em vez de ter modo livre, o modo livre deve
   ser um criador de vídeo […] porque assim a câmera será suave, não rígida"*.

   A MATEMÁTICA DA CURVA já é provada sem navegador
   (`engine/scene/timeline-curve.test.ts`, 21 portões). O que ESTA bancada
   verifica é o que aquele teste não alcança, porque depende da cena de verdade:

     1. O CAMINHO DO PAINEL ATÉ O DOCK. Escolher "Percurso próprio" e clicar no
        botão que age tem de ABRIR o criador — e não gravar um vídeo.
     2. A INTERFACE SOME. `.ts-tlmode` no root, e o HUD com opacidade zero. É o
        pedido literal, e ele é CSS: nenhum teste de nó o alcança.
     3. A MINIATURA NASCE. `poseThumbnail()` renderiza para um alvo fora de tela
        com o trio sRGB/RGBA8/XR que `capture.ts` descobriu medindo — sem ele o
        resolve falha e a leitura devolve ZEROS, ou seja um retrato preto, em
        silêncio. É a falha mais fácil de não notar deste recurso.
     4. AS GUARDAS DA CENA VALEM NO PERCURSO. A promessa da PCHIP é que nenhum
        instante sai do intervalo das chaves; aqui isso é medido contra o
        `minDistance` VIVO e contra a caixa do conjunto.
     5. A PRÉVIA MOVE A CÂMERA DE VERDADE, e o cabeçote anda com ela.
     6. FECHAR DEVOLVE O ESTÚDIO. A lente volta ao valor de fábrica — sem isso o
        estúdio fica com uma teleobjetiva até o próximo F5.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-percurso-0816.mjs
*/
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
await B.until(() => !!(S.state?.trailer || S.state?.cab), 240000);
for (let i = 0; i < 20; i++) await B.frame();

const TL = S.timeline;
if (!TL?.buildTimelinePath) {
  out.push(['★ ABORTADO', 'window.__studio não publica `timeline` — sem afordance não há portão.']);
  return out;
}
const cam = S.camera;
const controls = S.controls;
const fovFabrica = cam.fov;

/* Um percurso antigo de outra sessão desta mesma página faria os portões de
   contagem mentirem. */
TL.clearTimeline();

/* ---------------------------------------------------------------------------
   PORTÃO 1 — do painel de gravação até o dock, pelos cliques de verdade. */
const btnRec = document.getElementById('btn-rec');
out.push(['botão de gravar visível', !!btnRec && !btnRec.classList.contains('hidden')]);
btnRec.click();
await B.frame();
const item = q('.ts-shotmenu__item[data-m="percurso"]');
out.push(['★ o modo "percurso" existe no painel', !!item]);
if (!item) return out;
item.click();
await B.frame();
const acao = q('#ts-recmenu .ts-shotgo');
out.push(['o botão que age vira ABRIR, não gravar',
  !!acao && /criador|percurso/i.test(acao.textContent || '')]);
acao.click();
await B.frame();
await B.frame();

const dock = document.getElementById('ts-timeline');
out.push(['★ o criador abriu', !!dock && !dock.classList.contains('hidden')]);
if (!dock) return out;

/* ---------------------------------------------------------------------------
   PORTÃO 2 — a interface some. É o pedido literal, e é CSS. */
const rootEl = document.querySelector('.truck-studio-root');
out.push(['classe .ts-tlmode no root', rootEl.classList.contains('ts-tlmode')]);
const hud = document.getElementById('ts-hud');
const panels = document.getElementById('ts-panels');
/* A transição é de 240 ms; esperar é parte da verificação (um `display:none`
   passaria neste portão sem o fade que o desenho pede). */
await new Promise((r) => setTimeout(r, 420));
const opac = (n) => (n ? +getComputedStyle(n).opacity : null);
out.push(['★ HUD escondido', opac(hud) === 0]);
out.push(['★ cards de design escondidos', opac(panels) === 0]);
out.push(['os view controls FICAM (são a saída)',
  opac(document.getElementById('view-controls')) === 1]);

/* ---------------------------------------------------------------------------
   PORTÃO 3 — marcar três pontos, com poses de verdade e miniatura. */
const foco = controls.target.clone();
const raio0 = cam.position.distanceTo(controls.target);

function poseEm(azGraus, elGraus, raio) {
  const a = (azGraus * Math.PI) / 180;
  const e = (elGraus * Math.PI) / 180;
  const ce = Math.cos(e);
  controls.target.copy(foco);
  cam.position.set(
    foco.x + Math.sin(a) * ce * raio,
    foco.y + Math.sin(e) * raio,
    foco.z + Math.cos(a) * ce * raio,
  );
}

const marcar = async (az, el, raio) => {
  poseEm(az, el, raio);
  await B.frame();
  await B.frame();
  q('.ts-tl__add').click();
  await B.frame();
};

/* Três azimutes bem separados e um raio que FECHA e depois REABRE: é o caso em
   que uma curva com ultrapassagem joga a câmera para dentro da carroceria.
   ⚠️ E O PONTO DO MEIO ENCOSTA NO `minDistance`, de propósito. Com os três a
   trinta metros o portão de ultrapassagem passaria por sorte: uma
   Catmull-Rom erraria por ~1 m e ainda ficaria longe da lataria. Colando o
   mínimo na guarda VIVA, qualquer ultrapassagem no raio cai DENTRO da zona que
   a cena existe para proteger — que é o defeito que se quer pegar. */
const dMin = controls.minDistance > 0 ? controls.minDistance : raio0 * 0.5;
await marcar(20, 14, Math.min(raio0 * 1.15, dMin * 2.2));
await marcar(120, 22, dMin * 1.02);
await marcar(210, 10, Math.min(raio0 * 1.2, dMin * 2.4));

out.push(['★ três pontos marcados', TL.timelineCount() === 3]);
out.push(['cartões e conectores na tira',
  `${qa('.ts-tl__key').length} cartões · ${qa('.ts-tl__conn').length} conectores`]);
const chaves = TL.timelineKeys();
out.push(['★ as três miniaturas nasceram (não pretas nem nulas)',
  chaves.every((k) => typeof k.thumb === 'string' && k.thumb.length > 800)]);
out.push(['duração = soma dos tempos digitados', r2(TL.timelineDuration()) === 4]);

/* Retimar pelo SELECT do conector — é como o usuário muda a velocidade. */
const campo = q('.ts-tl__conn .ts-tl__selin');
out.push(['o seletor de tempo é um select de 1 a 8 s',
  !!campo && campo.tagName === 'SELECT' && campo.options.length === 8
  && campo.options[0].textContent === '1s' && campo.options[7].textContent === '8s']);
campo.value = '1';
campo.dispatchEvent(new Event('change', { bubbles: true }));
await B.frame();
out.push(['★ retimar pelo conector muda a duração', r2(TL.timelineDuration()) === 3]);
campo.value = '2';
campo.dispatchEvent(new Event('change', { bubbles: true }));
await B.frame();

/* O cartão é SÓ a foto: sem a fileira de botões, e com o ✕ no canto. */
const card = q('.ts-tl__key');
out.push(['★ o cartão não tem a fileira de controles',
  !card.querySelector('.ts-tl__krow') && !card.querySelector('.ts-tl__mini')]);
const kill = card.querySelector('.ts-tl__kill');
const cr = card.getBoundingClientRect();
const kr = kill ? kill.getBoundingClientRect() : null;
out.push(['★ o ✕ fica no canto superior direito do cartão',
  !!kr && kr.right < cr.right + 1 && kr.right > cr.right - 26
  && kr.top < cr.top + 26 && kr.top >= cr.top - 1]);

/* ---------------------------------------------------------------------------
   PORTÃO 4 — as guardas da cena valem em TODO instante do percurso.
   A promessa da PCHIP é que nenhum valor intermediário sai do intervalo das
   chaves; medido aqui contra o `minDistance` VIVO e contra a caixa do conjunto,
   que é o que a promessa existe para proteger. */
const path = TL.buildTimelinePath();
out.push(['o percurso resolve', !!path]);
if (!path) return out;

const THREE = S.THREE;
const caixa = new THREE.Box3();
for (const g of [S.models.state.cabGroup, S.models.state.trailerGroup]) {
  if (g && g.visible) caixa.expandByObject(g);
}
const raios = chaves.map((k) => Math.hypot(k.px - k.tx, k.py - k.ty, k.pz - k.tz));
const rMin = Math.min(...raios);
const rMax = Math.max(...raios);

let menorRaio = Infinity;
let maiorRaio = 0;
let menorFolga = Infinity;
let saltoMax = 0;
let ant = null;
for (let i = 0; i <= 600; i++) {
  const t = (path.duration * i) / 600;
  path.place(t);
  const r = cam.position.distanceTo(controls.target);
  menorRaio = Math.min(menorRaio, r);
  maiorRaio = Math.max(maiorRaio, r);
  if (!caixa.isEmpty()) {
    menorFolga = Math.min(menorFolga, caixa.distanceToPoint(cam.position));
  }
  if (ant) saltoMax = Math.max(saltoMax, cam.position.distanceTo(ant));
  ant = cam.position.clone();
}
out.push(['raio das chaves', `${r2(rMin)} … ${r2(rMax)} m`]);
out.push(['raio percorrido', `${r2(menorRaio)} … ${r2(maiorRaio)} m`]);
/* A folga de 1 cm absorve o aparo do `minDistance`, que é uma guarda VIVA e
   pode ser mais apertada que a menor chave. */
out.push(['★ NÃO ULTRAPASSA — nenhum instante sai da faixa das chaves',
  menorRaio >= rMin - 0.01 && maiorRaio <= rMax + 0.01]);
out.push(['★ e nenhum instante fura o `minDistance` VIVO da cena',
  `guarda ${r2(controls.minDistance)} m · menor do percurso ${r2(menorRaio)} m`,
  menorRaio >= controls.minDistance - 0.01]);
out.push(['★ a câmera nunca entra na carroceria',
  caixa.isEmpty() ? 'sem caixa (rodou sem --geometry)' : menorFolga > 0.5]);
out.push(['folga mínima até a lataria',
  caixa.isEmpty() ? '—' : `${r2(menorFolga)} m`]);
/* Um salto entre duas amostras vizinhas denuncia descontinuidade — é o que uma
   volta ao contrário no azimute produziria. A 600 amostras num percurso de 4 s,
   um movimento normal anda centímetros por passo. */
out.push(['★ o caminho é contínuo (sem volta ao contrário)',
  `maior salto entre amostras vizinhas: ${r2(saltoMax)} m`, saltoMax < 1.5]);

/* ---------------------------------------------------------------------------
   PORTÃO 5 — a prévia move a câmera, e o cabeçote anda com ela. */
path.place(0);
await B.frame();
const antesPreview = cam.position.clone();
q('.ts-tl__play').click();
await new Promise((r) => setTimeout(r, 900));
const tDurante = TL.timelinePreviewTime();
const posDurante = cam.position.clone();
out.push(['★ a prévia anda no tempo', tDurante > 0.2 && tDurante < path.duration]);
out.push(['★ a prévia move a câmera', posDurante.distanceTo(antesPreview) > 0.5]);
out.push(['a órbita fica travada enquanto a prévia roda', controls.enabled === false]);
const cabecote = q('.ts-tl__playhead');
out.push(['o cabeçote acompanha',
  /translateX\(\s*[1-9]/.test(cabecote?.style.transform || '')]);
TL.pauseTimelinePreview();
await B.frame();
out.push(['★ pausar devolve a órbita ao usuário', controls.enabled === true]);

/* O cabeçote arrastado é a mesma `place()` da gravação. */
TL.seekTimelinePreview(0);
await B.frame();
const k0 = chaves[0];
out.push(['★ o instante 0 é o ponto 1',
  cam.position.distanceTo(new THREE.Vector3(k0.px, k0.py, k0.pz)) < 0.05]);
TL.seekTimelinePreview(path.duration);
await B.frame();
const kN = chaves[chaves.length - 1];
out.push(['★ o instante final é o último ponto',
  cam.position.distanceTo(new THREE.Vector3(kN.px, kN.py, kN.pz)) < 0.05]);

/* ---------------------------------------------------------------------------
   PORTÃO 6 — fechar devolve o estúdio.
   A LENTE é a parte que some em silêncio: `resize()` reescreve `aspect` e NÃO
   devolve o `fov`, então um percurso com zoom deixaria o estúdio numa
   teleobjetiva até o próximo recarregamento. */
TL.applyLiveLens(14);
await B.frame();
out.push(['a lente viva obedece', r2(cam.fov) === 14]);
q('.ts-tl .ts-tl__ghost:last-of-type')?.click();
/* O ✕ é o último `.ts-tl__ghost` da barra; se a ordem mudar, o portão cai no
   caminho de programa em vez de silenciar. */
if (rootEl.classList.contains('ts-tlmode')) TL.exitTimelineMode();
await B.frame();
out.push(['★ fechar tira a classe do root', !rootEl.classList.contains('ts-tlmode')]);
out.push(['★ fechar devolve a LENTE de fábrica', r2(cam.fov) === r2(fovFabrica)]);
out.push(['os pontos SOBREVIVEM ao fechamento', TL.timelineCount() === 3]);

return out;
