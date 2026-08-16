/* O CRIADOR DE VÍDEO — a interface.
   ===========================================================================
   O trabalho está em `scene/timeline.ts`, que abre explicando por que a curva é
   PCHIP e por que um caminho amostrado à mão não tem conserto. Aqui mora só o
   que é DOM.

   ---------------------------------------------------------------------------
   O PEDIDO, na parte que decidiu esta tela:

       *"essa funcionalidade deve ter uma interface boa, e quando selecionada
        deve esconder todos os elementos do hud para que tenha mais [espaço]
        para mostrar a timeline"*

   ---------------------------------------------------------------------------
   TRÊS FAIXAS, E CADA UMA RESPONDE UMA PERGUNTA DIFERENTE

     1. A BARRA — o que este percurso É (quantos pontos, quantos segundos, em que
        tamanho vai sair) e as duas ações que o terminam: prévia e gravar.
     2. A RÉGUA — ONDE cada ponto cai no tempo. Ela é proporcional: dois pontos
        com meio segundo entre eles ficam colados, e é assim que se VÊ que o
        movimento vai ser rápido ali. Ela também é o cabeçote: arrastar sobre ela
        move a câmera quadro a quadro.
     3. A TIRA — o que a câmera VÊ em cada ponto, com o tempo de viagem entre
        eles no conector. Um storyboard, não uma lista.

   ⚠️ E A TIRA TEM MINIATURA DE VERDADE, tirada no instante da marcação
   (`poseThumbnail()`, em `scene/capture.ts`). Sem ela a faixa 3 seria uma
   fileira de retângulos numerados e escolher qual ponto ajustar viraria
   tentativa e erro — que é exatamente o trabalho que este criador existe para
   acabar. A miniatura é o único jeito de a pergunta "qual é o ponto 3?" ter
   resposta sem mover a câmera.

   ---------------------------------------------------------------------------
   ⚠️ A CÂMERA É A FONTE DA VERDADE, E ISSO É O QUE APAGA METADE DOS CONTROLES

   Não existe editor de pose num ponto: nem campo de azimute, nem de distância,
   nem de lente por cartão. O modelo é um só, e ele é o gesto que a pessoa já
   sabe fazer:

       enquadre com o mouse  →  ＋ marca um ponto novo
       clique na miniatura   →  a câmera VOLTA àquele ponto
       ✕ no canto do cartão  →  o ponto sai

   Ajustar um ponto é apagá-lo e marcar de novo, e isso é uma ESCOLHA e não uma
   falta: um botão de "regravar" muda um enquadramento que a miniatura ainda
   mostra como era, e o efeito só aparece na próxima prévia. Dois gestos que a
   pessoa já conhece contam a mesma história sem esse descompasso.

   A LENTE entra pelo mesmo caminho: o cursor da barra escreve na câmera VIVA (o
   usuário vê o zoom acontecer) e o próximo ponto marcado guarda o valor. Um
   campo de lente por cartão seria uma SEGUNDA forma de dizer a mesma coisa — e
   as duas discordariam no dia em que alguém mexesse numa e não na outra.

   ---------------------------------------------------------------------------
   ⚠️ A INTERFACE SOME SOZINHA ENQUANTO A MÃO COMPÕE

   O dock flutua sobre o rodapé do render, e compor um enquadramento com um
   quarto da tela tapado é o defeito óbvio deste desenho. Duas respostas, as
   duas baratas:

     · enquanto o ponteiro arrasta a CENA, o dock cai para 12 % de opacidade e
       deixa de receber clique; ao soltar, volta. O gesto de compor devolve a
       tela inteira sem ninguém pedir;
     · o botão de recolher deixa só a barra (uma tira de ~44 px), para quem quer
       enquadrar com calma.

   Nenhuma das duas mexe no TAMANHO do canvas — o dock é `position: absolute`
   dentro de `#canvas-holder`, ou seja fora do fluxo. É a mesma doutrina da
   cortina (ver o ⚠️ em `ui/chrome.ts` sobre nunca dar `display:none` no holder):
   mudar a caixa do holder dispara o `ResizeObserver` de `mountStudio()`, e um
   `resize()` reescreve o buffer, a proporção da câmera e a âncora do floco
   metálico. Sobrepor é seguro; ocupar layout não é.

   ---------------------------------------------------------------------------
   O QUE ESTA TELA DELIBERADAMENTE NÃO TEM

   ARRASTAR OS MARCADORES DA RÉGUA para retimar. É o gesto bonito, e ele
   conflita com o ÚNICO gesto que a régua já tem e que vale mais: arrastar para
   ver. Com os dois no mesmo pixel, todo arrasto vira uma pergunta ("isto moveu
   o cabeçote ou o ponto 3?"), e a resposta errada estraga o percurso em vez de
   só mostrar o quadro errado. O tempo se escolhe no conector, que é onde ele
   está escrito.

   UM SEGUNDO SELETOR DE TAMANHO. O tamanho do vídeo é do painel de gravação
   (`ui/chrome.ts`), que é quem o guarda no `localStorage`; aqui ele é LIDO e
   mostrado ao lado do botão. Duas superfícies escrevendo o mesmo estado é como
   uma interface acaba discordando de si mesma — a regra é do estúdio inteiro,
   está no cabeçalho de `ui/chrome.ts`. */
import {
  addTimelineKey, removeTimelineKey, setTimelineTravel, clearTimeline,
  timelineKeys, timelineCount, timelineTimes, timelineDuration, timelineHeadroom,
  onTimelineChange, onTimelineTick,
  playTimelinePreview, pauseTimelinePreview, seekTimelinePreview,
  isTimelinePreviewing, timelinePreviewTime, flyToTimelineKey,
  enterTimelineMode, exitTimelineMode, isTimelineMode,
  applyLiveLens, liveLens, previewDroppedReflection, previewFps,
  MAX_TIMELINE_KEYS, MAX_TIMELINE_SECONDS,
  MIN_TRAVEL_SECONDS, MAX_TRAVEL_SECONDS,
  MIN_LENS_FOV, MAX_LENS_FOV,
} from '../scene/timeline';
import type { TimelineKey } from '../scene/timeline';
import { poseThumbnail } from '../scene/capture';
import { loadOutro, outroDuration } from '../scene/outro';
import { renderer } from '../scene/scene';
import { root, $, el } from '../core/dom';

/* ---------------- o que o dock precisa saber do resto ----------------
   Injetado por `ui/chrome.ts` em vez de importado: este módulo chamando
   `runRecord()` lá e aquele chamando `openTimeline()` aqui fecharia um ciclo de
   import, e um ciclo em cima de módulos que rodam trabalho na avaliação não dá
   erro claro — dá binding em zona morta no meio do boot. Uma função passada
   para dentro não tem esse problema. */
export interface TimelineHost {
  /** Dispara a gravação. Quem monta a cortina e o progresso é o chamador. */
  onRecord: () => void;
  /** "1080p · 60 fps" — o que o painel de gravação está pedindo, para leitura. */
  sizeLabel: () => string;
  /** `false` enquanto uma gravação ou captura estiver em curso. */
  idle: () => boolean;
}

let host: TimelineHost | null = null;
let dock: HTMLElement | null = null;
let built = false;
let open = false;
/** Um ponto marcado por gesto, para o cartão nascer com o anel. */
let selectedId = 0;
/** Ligado enquanto um campo numérico escreve: ver `onChange` lá embaixo. */
let editing = false;

/* Nós que são reescritos muitas vezes por segundo ou a cada tecla — guardados
   em vez de reprocurados. O resto é reconstruído inteiro. */
let elMeta: HTMLElement | null = null;
let elStrip: HTMLElement | null = null;
let elRuler: HTMLElement | null = null;
let elPlayhead: HTMLElement | null = null;
let elClock: HTMLElement | null = null;
let elPlay: HTMLButtonElement | null = null;
let elRec: HTMLButtonElement | null = null;
let elLens: HTMLInputElement | null = null;
let elLensVal: HTMLElement | null = null;
let elHint: HTMLElement | null = null;

/* ---------------- números como gente lê ---------------- */

const secs1 = (v: number) => `${v.toFixed(1).replace('.', ',')} s`;
const secsShort = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r} s` : `${r.toFixed(1).replace('.', ',')} s`;
};
/** Aceita vírgula: um teclado pt-BR digita "1,5" e `parseFloat` pararia no 1. */
const numOf = (s: string, fallback: number) => {
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : fallback;
};

/* ---------------- ícones ----------------
   SVG inline, traço em `currentColor`, mesma convenção de `core/template.ts` e
   `ui/hud.ts`. Nunca emoji: a plataforma escolheria a fonte, o glifo não
   seguiria a cor e não combinaria com o resto da régua. */
const ico = (d: string, size = 15) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"`
  + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
  + ` stroke-linejoin="round" focusable="false" aria-hidden="true">${d}</svg>`;

const ICO_PLAY = ico('<path d="M8 5.6 19 12 8 18.4Z"/>', 16);
const ICO_PAUSE = ico('<path d="M9 5.5v13M15 5.5v13"/>', 16);
const ICO_REC = ico('<rect x="2.8" y="6.6" width="12.4" height="10.8" rx="2"/>'
  + '<path d="M15.2 10.6l4.4-2.7a.7.7 0 0 1 1.1.6v7a.7.7 0 0 1-1.1.6l-4.4-2.7Z"/>', 16);
const ICO_AIM = ico('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>');
/* O ✕ do cartão é um X e não uma lixeira: ele mora no canto de um retângulo de
   140 px, e a 13 px uma lixeira vira uma mancha. */
const ICO_DEL = ico('<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>', 13);
const ICO_PLUS = ico('<path d="M12 5.5v13M5.5 12h13"/>', 16);
const ICO_CLOSE = ico('<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>', 15);
const ICO_MIN = ico('<path d="M6 9.5 12 15.5 18 9.5"/>', 15);

/* ===========================================================================
   CONSTRUÇÃO
   =========================================================================== */

function iconButton(cls: string, svg: string, title: string): HTMLButtonElement {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = svg;
  b.title = title;
  b.setAttribute('aria-label', title);
  return b;
}

function build() {
  if (built) return;
  built = true;

  const d = el('div', 'ts-tl hidden');
  d.id = 'ts-timeline';
  /* `group` e não `dialog`: ele não é modal, não prende o foco e a cena
     continua sendo o assunto. Anunciá-lo como diálogo prometeria a um leitor de
     tela um foco preso que não existe. */
  d.setAttribute('role', 'group');
  d.setAttribute('aria-label', 'Criador de vídeo');
  /* O canvas é irmão, e o OrbitControls está preso a `renderer.domElement` —
     então hoje um clique aqui não tem caminho de bolha até a órbita. Isto é a
     guarda para o dia em que tiver, e é a mesma que os view controls, o HUD e
     os cards de design já aplicam. */
  const swallow = (e: Event) => e.stopPropagation();
  d.addEventListener('pointerdown', swallow);
  d.addEventListener('pointerup', swallow);
  d.addEventListener('wheel', swallow, { passive: true });

  /* ---- faixa 1: a barra ---- */
  const head = el('div', 'ts-tl__head');
  const badge = el('span', 'ts-tl__badge', 'Criador de vídeo');
  elMeta = el('span', 'ts-tl__meta');
  head.append(badge, elMeta);

  const lensWrap = el('label', 'ts-tl__lens');
  lensWrap.title = 'Fecha ou abre a LENTE, sem mover a câmera. É o zoom deste'
    + ' estúdio: chegar mais perto é impedido pela guarda que mantém a câmera'
    + ' fora da carroceria.';
  lensWrap.appendChild(el('span', 'ts-tl__lenslabel', 'Lente'));
  const lens = el('input', 'ts-tl__lensrange');
  lens.type = 'range';
  /* ⚠️ O CURSOR ANDA AO CONTRÁRIO DOS GRAUS, e é de propósito. "Mais para a
     direita = mais perto" é o que qualquer pessoa espera de um controle de
     zoom, e a ABERTURA da lente anda exatamente ao contrário disso: 45° é
     grande-angular e 13° é teleobjetiva. O cursor guarda o valor espelhado
     (`MIN + MAX − fov`) e as duas conversões estão em `lensFromSlider()` /
     `sliderFromLens()` — em nenhum outro lugar. O número LIDO continua sendo o
     grau, que é o vocabulário que o gravador já usa ("a abertura fecha de 30°
     para 13°"). */
  lens.min = String(MIN_LENS_FOV);
  lens.max = String(MAX_LENS_FOV);
  lens.step = '1';
  lens.setAttribute('aria-label', 'Zoom da lente');
  elLens = lens;
  elLensVal = el('b', 'ts-tl__lensval');
  lensWrap.append(lens, elLensVal);

  const collapse = iconButton('ts-tl__ghost ts-tl__min', ICO_MIN, 'Recolher a linha do tempo');
  const rec = el('button', 'ts-tl__go');
  rec.type = 'button';
  rec.innerHTML = ICO_REC;
  rec.appendChild(el('span', undefined, 'Gravar vídeo'));
  elRec = rec;
  const close = iconButton('ts-tl__ghost', ICO_CLOSE, 'Fechar o criador de vídeo');

  head.append(lensWrap, collapse, rec, close);

  /* ---- faixa 2: transporte + régua ---- */
  const bar = el('div', 'ts-tl__bar');
  const play = iconButton('ts-tl__play', ICO_PLAY, 'Ver a prévia do percurso');
  elPlay = play;

  const ruler = el('div', 'ts-tl__ruler');
  /* `slider` de verdade: quem usa teclado precisa de um alvo com valor, e as
     setas passam a andar no TEMPO em vez de percorrer botões. */
  ruler.setAttribute('role', 'slider');
  ruler.setAttribute('tabindex', '0');
  ruler.setAttribute('aria-label', 'Cabeçote da prévia');
  ruler.setAttribute('aria-valuemin', '0');
  elRuler = ruler;
  const fill = el('div', 'ts-tl__rulerfill');
  const playhead = el('div', 'ts-tl__playhead');
  elPlayhead = playhead;
  ruler.append(fill, playhead);

  elClock = el('span', 'ts-tl__clock');
  bar.append(play, ruler, elClock);

  /* ---- faixa 3: a tira ---- */
  elStrip = el('div', 'ts-tl__strip');
  elStrip.setAttribute('role', 'list');
  elStrip.setAttribute('aria-label', 'Pontos do percurso');

  elHint = el('p', 'ts-tl__hint');

  d.append(head, bar, elStrip, elHint);
  $('canvas-holder').appendChild(d);
  dock = d;

  /* ---------------- os gestos ---------------- */

  close.addEventListener('click', () => closeTimeline());
  collapse.addEventListener('click', () => {
    const min = d.classList.toggle('is-min');
    collapse.classList.toggle('on', min);
    collapse.title = min ? 'Mostrar a linha do tempo' : 'Recolher a linha do tempo';
    collapse.setAttribute('aria-label', collapse.title);
  });

  play.addEventListener('click', () => {
    if (isTimelinePreviewing()) pauseTimelinePreview();
    else playTimelinePreview();
    syncTransport();
  });

  rec.addEventListener('click', () => {
    if (timelineCount() < 2 || !host?.idle()) return;
    /* A prévia é derrubada ANTES de sair daqui. `recordScene()` também a derruba
       (ver a nota lá), e a repetição é de propósito: a de lá é a rede para
       qualquer chamador; esta é a que garante que o botão de prévia já esteja
       repintado quando a cortina subir. */
    pauseTimelinePreview();
    syncTransport();
    host.onRecord();
  });

  lens.addEventListener('input', () => {
    const v = applyLiveLens(lensFromSlider(numOf(lens.value, sliderFromLens(liveLens()))));
    syncLens(v);
  });

  bindRuler(ruler);

  /* ---- O DOCK SOME ENQUANTO A MÃO COMPÕE ----
     Preso ao CANVAS e não ao holder: o holder contém o próprio dock, e um
     `pointerdown` num campo de segundos borbulharia até ele e apagaria a
     interface debaixo do dedo. O canvas só recebe o gesto que é de fato a
     câmera. `pointerup`/`pointercancel` no window porque o ponteiro
     frequentemente é solto FORA do canvas no fim de um arrasto largo. */
  const canvas = renderer.domElement;
  const ghost = (on: boolean) => { if (open) d.classList.toggle('is-ghost', on); };
  canvas.addEventListener('pointerdown', () => ghost(true));
  window.addEventListener('pointerup', () => ghost(false));
  window.addEventListener('pointercancel', () => ghost(false));

  onTimelineChange(() => {
    if (editing) { syncDerived(); return; }
    renderStrip();
    syncDerived();
  });
  /* Durante a REPRODUÇÃO o tique vale a cada quadro e o estrangulamento manda;
     fora dela ele é um evento isolado (um arrasto, uma pausa, o fim de um voo) e
     tem de aparecer na hora. */
  onTimelineTick((_t, playing) => syncPlayhead(!playing));
}

/* ---------------- a régua, que é o cabeçote ----------------
   Um `pointerdown` já POSICIONA (não espera o arrasto): quem clica no meio da
   régua quer ver aquele instante, e um clique que não faz nada até a mão se
   mexer lê como controle quebrado. `setPointerCapture` é o que faz o arrasto
   continuar valendo quando o ponteiro sai da barra — que é o caso normal numa
   barra de 8 px de altura. */
function bindRuler(ruler: HTMLElement) {
  const seekAt = (clientX: number) => {
    const r = ruler.getBoundingClientRect();
    if (r.width <= 0) return;
    const u = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    seekTimelinePreview(u * timelineDuration());
  };
  let dragging = false;
  ruler.addEventListener('pointerdown', (e: PointerEvent) => {
    if (timelineCount() < 2) return;
    dragging = true;
    ruler.setPointerCapture(e.pointerId);
    /* Uma prévia tocando enquanto o dedo arrasta seria o cabeçote disputado por
       dois donos — o relógio e a mão. A mão ganha, e a prévia pausa. */
    if (isTimelinePreviewing()) { pauseTimelinePreview(); syncTransport(); }
    seekAt(e.clientX);
  });
  ruler.addEventListener('pointermove', (e: PointerEvent) => {
    if (dragging) seekAt(e.clientX);
  });
  const drop = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try { ruler.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
  };
  ruler.addEventListener('pointerup', drop);
  ruler.addEventListener('pointercancel', drop);
  ruler.addEventListener('keydown', (e: KeyboardEvent) => {
    const dur = timelineDuration();
    if (dur <= 0) return;
    const step = e.shiftKey ? 1 : 0.1;
    let t = timelinePreviewTime();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t += step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t -= step;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = dur;
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (isTimelinePreviewing()) pauseTimelinePreview(); else playTimelinePreview();
      syncTransport();
      return;
    } else return;
    e.preventDefault();
    if (isTimelinePreviewing()) { pauseTimelinePreview(); syncTransport(); }
    seekTimelinePreview(t);
  });
}

/* ===========================================================================
   A TIRA
   =========================================================================== */

/* ---------------- O TEMPO DE VIAGEM É UM SELECT ----------------
   Pedido de 2026-08-16, na segunda rodada: *"em vez de um input deve ser um
   select que vá de 1 a 8s […] o select deve ser tipo 2s, 3s, 4s etc.."*.

   E o campo que ele substitui merecia sair por mais do que gosto — ele tinha
   três defeitos que só aparecem usando:

     1. CONVIDAVA UMA PRECISÃO QUE NÃO EXISTE. Ninguém julga a diferença entre
        2,4 s e 2,6 s de viagem olhando uma prévia. O que se decide aqui é
        "rápido, médio ou lento", e oito degraus cobrem isso com folga.
     2. ERA CARO DE OPERAR. Cursor de texto, teclado numérico, vírgula decimal
        (um teclado pt-BR digita "1,5" e `parseFloat` para no 1) e o aparo do
        teto reescrevendo o campo debaixo do dedo.
     3. NÃO CABIA. Num cartão de 152 px, o campo espremido entre quatro botões
        de ícone encolhia até o número desaparecer — o que de fato aconteceu na
        primeira rodada.

   ⚠️ AS OPÇÕES QUE NÃO CABEM NO TETO FICAM DESABILITADAS, e não escondidas: uma
   lista que muda de tamanho conforme o percurso cresce faz o mesmo clique cair
   em opções diferentes. Desabilitada, a opção continua no lugar e diz por quê
   pelo `title`. */
function travelSelect(k: TimelineKey): HTMLElement {
  const wrap = el('label', 'ts-tl__sel');
  wrap.title = 'Segundos de viagem entre os dois pontos — menos tempo, movimento'
    + ' mais rápido';
  const sel = el('select', 'ts-tl__selin');
  sel.setAttribute('aria-label', 'Segundos entre este ponto e o anterior');
  /* O que ainda cabe: o teto vale para a SOMA, então o limite deste campo é o
     que sobra MAIS o que ele já ocupa. */
  const teto = Math.min(MAX_TRAVEL_SECONDS, timelineHeadroom() + k.travel);
  for (let v = MIN_TRAVEL_SECONDS; v <= MAX_TRAVEL_SECONDS; v++) {
    const o = el('option', undefined, `${v}s`);
    o.value = String(v);
    if (v > teto) {
      o.disabled = true;
      o.title = `Passaria do teto de ${MAX_TIMELINE_SECONDS} s de vídeo`;
    }
    sel.appendChild(o);
  }
  sel.value = String(Math.round(k.travel));
  sel.addEventListener('change', () => {
    /* `editing` impede que a tira se reconstrua debaixo do `<select>` aberto —
       ver a nota em `onTimelineChange`. */
    editing = true;
    setTimelineTravel(k.id, Number(sel.value));
    editing = false;
  });
  wrap.appendChild(sel);
  return wrap;
}

/* ---------------- O CARTÃO É SÓ A FOTO ----------------
   Pedido da mesma rodada: *"não precisa das opções abaixo da foto do timestamp,
   regravar, s, mover para trás e deletar, o deletar deve ser no top right do
   card em si"*.

   Saíram quatro controles, e cada um tinha uma resposta melhor já na tela:

     ⟳ REGRAVAR — marcar de novo e apagar o velho faz o mesmo com os gestos que
       já existem, e sem um botão cujo efeito é invisível até a próxima prévia.
     "s" (a PAUSA) — virou um gesto: marcar o MESMO ponto duas vezes dá um trecho
       chato, e a curva para nele sozinha. Ver o § A PARADA em
       `scene/timeline.ts`.
     ‹ › REORDENAR — dois alvos de 22 px para uma operação rara, num cartão que
       não tinha largura para eles (foi o que espremeu o campo de segundos até o
       número sumir).
     🗑 no rodapé — subiu para o canto do cartão, que é onde a convenção põe o
       "remover este item" desde sempre.

   Sobra a MINIATURA, que é o alvo grande da ação frequente (ir até o ponto), o
   número, o instante e o ✕. O cartão encolheu ~30 px de altura, e essa altura
   voltou para a cena. */
function keyCard(k: TimelineKey, index: number): HTMLElement {
  const card = el('div', 'ts-tl__key' + (k.id === selectedId ? ' is-on' : ''));
  card.dataset.id = String(k.id);
  card.setAttribute('role', 'listitem');

  /* A MINIATURA É O BOTÃO DE IR ATÉ O PONTO. Um alvo grande para a ação mais
     frequente da tela — "me leve de volta ao ponto 3 para eu olhá-lo" — e ele
     mostra exatamente para onde vai. */
  const go = el('button', 'ts-tl__thumb');
  go.type = 'button';
  go.title = 'Levar a câmera até este ponto';
  go.setAttribute('aria-label', `Ir para o ponto ${index + 1}`);
  if (k.thumb) {
    const img = el('img');
    img.src = k.thumb;
    img.alt = '';
    img.decoding = 'async';
    go.appendChild(img);
  } else {
    /* Sem retrato, a placa numerada. É a mesma doutrina de `initials()` em
       `core/dom.ts`: melhor uma placa que identifica do que um ícone de imagem
       quebrada. */
    go.appendChild(el('span', 'ts-tl__ph', String(index + 1)));
  }
  /* A AFORDÂNCIA DE QUE A FOTO É UM BOTÃO. Uma miniatura parece um retrato, não
     um alvo — e é o alvo mais usado desta tela. O selo aparece no hover e no
     FOCO (o teclado precisa da mesma pista), e some no resto do tempo para não
     tapar o enquadramento, que é o que a miniatura existe para mostrar.
     ⚠️ ANTES do número e do instante na ordem do DOM: ele é um véu de tela
     cheia sobre a miniatura, e vindo depois cobriria os dois selos que têm de
     continuar legíveis. */
  const seal = el('span', 'ts-tl__seal');
  seal.innerHTML = ICO_AIM;
  go.appendChild(seal);
  go.appendChild(el('span', 'ts-tl__num', String(index + 1)));
  const at = el('span', 'ts-tl__at');
  at.dataset.at = String(k.id);
  go.appendChild(at);
  go.addEventListener('click', () => {
    selectedId = k.id;
    markSelection();
    if (isTimelinePreviewing()) { pauseTimelinePreview(); syncTransport(); }
    flyToTimelineKey(k.id);
  });
  card.appendChild(go);

  /* O ✕ NO CANTO DO CARTÃO, e FORA do botão da miniatura: um <button> dentro de
     outro <button> é HTML inválido e o navegador desfaz o aninhamento na
     análise — o ✕ acabaria como IRMÃO do cartão, fora do lugar. Por isso ele é
     filho do cartão e se posiciona por cima da foto. */
  const kill = iconButton('ts-tl__kill', ICO_DEL, `Remover o ponto ${index + 1}`);
  kill.addEventListener('click', () => removeTimelineKey(k.id));
  card.appendChild(kill);
  return card;
}

/** O conector entre dois cartões: a linha, a seta e os segundos de viagem. */
function connector(k: TimelineKey): HTMLElement {
  const c = el('div', 'ts-tl__conn');
  c.appendChild(el('span', 'ts-tl__connline'));
  c.appendChild(travelSelect(k));
  return c;
}


function renderStrip() {
  const strip = elStrip;
  if (!strip) return;
  strip.textContent = '';
  const ks = timelineKeys();

  if (!ks.length) {
    /* O VAZIO EXPLICA O GESTO. Uma tira vazia com um "+" solto não diz que a
       marcação usa a CÂMERA, e o primeiro ponto é justamente o único momento em
       que a pessoa ainda não sabe disso. */
    const empty = el('div', 'ts-tl__empty');
    empty.appendChild(el('strong', undefined, 'Enquadre e marque o primeiro ponto.'));
    empty.appendChild(el('span', undefined,
      'Arraste a cena até o começo do vídeo e clique em Marcar ponto. '
      + 'Depois mova a câmera, marque o próximo e diga quantos segundos '
      + 'a viagem entre eles leva.'));
    strip.appendChild(empty);
  }

  for (let i = 0; i < ks.length; i++) {
    if (i > 0) strip.appendChild(connector(ks[i]));
    strip.appendChild(keyCard(ks[i], i));
  }

  const add = el('button', 'ts-tl__add');
  add.type = 'button';
  add.innerHTML = ICO_PLUS;
  add.appendChild(el('span', undefined, ks.length ? 'Marcar ponto' : 'Marcar o 1º ponto'));
  add.title = 'Guarda o enquadramento atual como um ponto do percurso';
  add.disabled = ks.length >= MAX_TIMELINE_KEYS;
  add.addEventListener('click', () => {
    /* A MINIATURA É TIRADA AQUI, no clique, e não depois: ela tem de retratar a
       pose que está sendo guardada, e um quadro depois a câmera já pode ter
       andado (a inércia do OrbitControls continua correndo por ~0,5 s). */
    const k = addTimelineKey(poseThumbnail());
    if (k) selectedId = k.id;
    /* A tira cresce para a direita e o ponto novo nasce no fim — sem isto ele
       nasce fora da vista em qualquer percurso com mais de quatro pontos. */
    requestAnimationFrame(() => { strip.scrollLeft = strip.scrollWidth; });
  });
  strip.appendChild(add);
}

/** Só o anel de seleção, sem reconstruir a tira. */
function markSelection() {
  elStrip?.querySelectorAll<HTMLElement>('.ts-tl__key').forEach((n) => {
    n.classList.toggle('is-on', n.dataset.id === String(selectedId));
  });
}

/* ===========================================================================
   OS NÚMEROS DERIVADOS
   ===========================================================================
   Tudo que muda quando um tempo muda: o resumo, os marcadores da régua, o
   instante em cada cartão e o estado dos dois botões que agem. Escrito por
   comparação (`!==`) porque isto roda a cada tecla digitada num campo. */

function setText(node: HTMLElement | null | undefined, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}

function syncDerived() {
  const n = timelineCount();
  const dur = timelineDuration();
  const times = timelineTimes();

  const size = host?.sizeLabel() ?? '';
  /* ⚠️ O FECHO ENTRA NA CONTA, e tem de entrar: o arquivo sai com a vinheta
     emendada, então dizer só a duração do percurso seria a interface prometendo
     um vídeo mais curto do que o que vai baixar. Ele só aparece quando de fato
     carregou — numa máquina sem ele o número volta a ser só o do percurso, que
     continua sendo a verdade. */
  const fecho = outroDuration();
  setText(elMeta, n === 0
    ? 'nenhum ponto ainda'
    : `${n} ${n === 1 ? 'ponto' : 'pontos'} · ${secsShort(dur)}`
      + (fecho > 0 ? ` + ${secsShort(fecho)} de fecho` : '')
      + (size ? ' · ' + size : ''));

  /* Os marcadores. Reconstruídos e não reposicionados: são poucos, e a
     alternativa (casar nós existentes com chaves por id) é código que só existe
     para poupar vinte e quatro `appendChild`. */
  if (elRuler) {
    elRuler.querySelectorAll('.ts-tl__mark').forEach((m) => m.remove());
    elRuler.setAttribute('aria-valuemax', dur.toFixed(2));
    if (dur > 0) {
      for (let i = 0; i < times.length; i++) {
        const m = el('span', 'ts-tl__mark');
        m.style.left = `${(times[i] / dur) * 100}%`;
        m.title = `Ponto ${i + 1} · ${secs1(times[i])}`;
        elRuler.appendChild(m);
      }
    }
  }

  /* O instante de cada ponto, no cartão. */
  elStrip?.querySelectorAll<HTMLElement>('.ts-tl__at').forEach((node) => {
    const id = Number(node.dataset.at);
    const i = timelineKeys().findIndex((k) => k.id === id);
    if (i >= 0) setText(node, secs1(times[i]));
  });

  const canPlay = n >= 2;
  if (elPlay) elPlay.disabled = !canPlay;
  if (elRec) {
    elRec.disabled = !canPlay || !(host?.idle() ?? true);
    elRec.title = canPlay
      ? 'Renderizar o percurso e baixar o vídeo'
      : 'Marque pelo menos dois pontos';
  }
  if (elRuler) elRuler.classList.toggle('is-off', !canPlay);

  /* A NOTA DO PÉ diz uma coisa de cada vez, e a ordem é a da urgência: o teto
     batido primeiro (ele bloqueia o próximo gesto), depois o que fazer agora —
     e, com a prévia tocando, a fluidez ganha de tudo. Ver `syncHint()`. */
  syncHint();

  syncTravelValues();
  syncClock();
  syncPlayhead(true);
}

/* ---------------- A NOTA DO PÉ ----------------
   Separada de `syncDerived()` porque ela é a ÚNICA linha desta tela cujo
   conteúdo depende de uma MEDIÇÃO e não do modelo: enquanto a prévia toca, ela
   é reescrita pelo tique. Uma nota que só mudasse com o modelo ficaria falando
   do teto de pontos enquanto a pessoa olha uma prévia engasgando. */
function syncHint() {
  const n = timelineCount();
  const room = timelineHeadroom();
  setText(elHint,
    isTimelinePreviewing()
      ? previewNote()
      : n >= MAX_TIMELINE_KEYS
        ? `Teto de ${MAX_TIMELINE_KEYS} pontos. Remova um para marcar outro.`
        : room <= 0.05
          ? `Teto de ${MAX_TIMELINE_SECONDS} s de vídeo — reduza um tempo para esticar outro.`
          : n < 2
            ? 'A câmera passa pelos pontos numa curva lisa, sem parar em cada um.'
              + ' Para ela descansar num enquadramento, marque o mesmo ponto duas vezes.'
            : `Prévia e vídeo seguem exatamente o mesmo caminho. Ainda cabem ${secsShort(room)}.`);
}

/**
 * A frase enquanto a prévia toca.
 *
 * ⚠️⚠️ ABAIXO DE ~50 fps ELA TROCA DE ASSUNTO, e essa troca é o conserto de
 * produto desta rodada. "A prévia está travada" quase sempre quer dizer *"o
 * vídeo vai sair assim?"* — e a resposta é NÃO, categoricamente: o arquivo é
 * desenhado quadro a quadro, FORA do tempo real, com um relógio virtual de
 * 1/60 s (é o desenho inteiro de `scene/record.ts`). Uma prévia a 24 fps numa
 * máquina modesta produz um vídeo a 60 fps liso — e sem esta linha não há como
 * saber disso, então a pessoa desiste de um percurso que estava certo.
 *
 * O número é MEDIDO (`previewFps()`), nunca prometido. E o limiar é folgado de
 * propósito: 55 fps numa tela de 60 Hz é uma prévia perfeita, e avisar ali
 * criaria um problema que não existe.
 */
function previewNote(): string {
  const fps = Math.round(previewFps());
  if (fps > 0 && fps < 50) {
    return `A prévia está a ${fps} fps nesta máquina — o VÍDEO sai a 60, liso:`
      + ' ele é desenhado quadro a quadro, fora do tempo real.';
  }
  return previewDroppedReflection()
    ? 'O piso espelhado e a resolução caem durante a prévia para ela rodar lisa'
      + ' — no vídeo os dois voltam inteiros.'
    : 'A resolução cai um pouco durante a prévia para ela rodar lisa'
      + ' — no vídeo ela volta inteira.';
}

/**
 * Reescreve os `<select>` de viagem a partir do modelo.
 *
 * Chamado depois de um aparo — o teto de `MAX_TIMELINE_SECONDS` pode ter
 * reduzido o número escolhido, e um `<select>` mostrando 8 s num percurso que
 * ficou com 6 é a interface mentindo sobre o próprio vídeo. Também é aqui que
 * as opções que deixaram de caber ganham o `disabled`.
 */
function syncTravelValues() {
  const ks = timelineKeys();
  const conns = elStrip?.querySelectorAll<HTMLElement>('.ts-tl__conn') ?? [];
  conns.forEach((conn, i) => {
    const sel = conn.querySelector<HTMLSelectElement>('.ts-tl__selin');
    /* O conector `i` fica ANTES do cartão `i+1`, e o `travel` é da chave de
       DEPOIS dele — é o tempo de viagem ATÉ ela. */
    const k = ks[i + 1];
    if (!sel || !k) return;
    const teto = Math.min(MAX_TRAVEL_SECONDS, timelineHeadroom() + k.travel);
    for (const o of Array.from(sel.options)) {
      const v = Number(o.value);
      const off = v > teto;
      if (o.disabled !== off) o.disabled = off;
    }
    const v = String(Math.round(k.travel));
    if (sel.value !== v) sel.value = v;
  });
}

/* O último estado PINTADO, e não o último estado LIDO. `syncTransport()` é
   chamado de dentro do tique da prévia (dez a sessenta vezes por segundo), e
   reescrever `innerHTML` a cada chamada refaria o SVG do botão sessenta vezes
   por segundo para desenhar o mesmo triângulo. */
let transportOn: boolean | null = null;

function syncTransport() {
  const on = isTimelinePreviewing();
  if (on === transportOn) return;
  transportOn = on;
  if (elPlay) {
    elPlay.innerHTML = on ? ICO_PAUSE : ICO_PLAY;
    elPlay.title = on ? 'Pausar a prévia' : 'Ver a prévia do percurso';
    elPlay.setAttribute('aria-label', elPlay.title);
    elPlay.classList.toggle('on', on);
  }
  dock?.classList.toggle('is-playing', on);
  /* A nota do pé muda de assunto quando a prévia começa e quando ela para —
     ver a ressalva do piso espelhado em `syncDerived()`. */
  syncDerived();
}

function syncClock() {
  const dur = timelineDuration();
  if (dur <= 0) { setText(elClock, '—'); return; }
  /* A TAXA AO LADO DO RELÓGIO, e só enquanto toca. É o número que transforma
     "está travado" — que não se pode responder — em um fato que se lê. */
  const fps = isTimelinePreviewing() ? Math.round(previewFps()) : 0;
  setText(elClock, `${secs1(timelinePreviewTime())} / ${secsShort(dur)}`
    + (fps > 0 ? ` · ${fps} fps` : ''));
}

/* ================= O CUSTO DE UM QUADRO DE PRÉVIA =================
   A prévia não é cara de CALCULAR: ela avalia sete polinômios cúbicos e escreve
   dois vetores. O que ela fazia de caro era ESCREVER NO DOM sessenta vezes por
   segundo — `style.transform`, dois `setAttribute` de ARIA e dois `textContent`
   por quadro —, dentro de um dock que tem `backdrop-filter` sobre um canvas que
   também repinta sessenta vezes por segundo. Cinco invalidações de estilo por
   quadro para mover um risco de dois pixels.

   ⚠️ ISSO É DESPERDÍCIO REAL E FOI CORTADO, MAS NÃO ERA O ENGASGO RELATADO. A
   primeira versão deste bloco afirmava que era — sem ter medido. Quando o
   relato voltou (*"tinha parado de bugar, mas voltou por algum motivo"*), a
   segunda passagem foi atrás da causa com o instrumento certo e ela é outra: a
   ESCALA DE RENDER, que a prévia congelava ao chamar `markBusy()`. Está tudo no
   § O MODO PROXY DA PRÉVIA, em `scene/timeline.ts`.

   O que fica aqui, e continua valendo por si:

     1. NADA É ESCRITO SE NÃO MUDOU. O cabeçote só é reposicionado quando anda
        mais de meio milésimo da régua; ARIA, relógio e lente no máximo dez vezes
        por segundo, e ainda assim só na diferença.
     2. NADA AQUI PODE LER LAYOUT. `getBoundingClientRect` é a única chamada que
        este arquivo se proíbe: ela força um recálculo síncrono no meio do quadro
        que está desenhando a cena. É por isso que o cabeçote anda por
        `translateX(%)` — ver a nota do nó de largura inteira, logo abaixo. */

/** Quantas vezes por segundo o que é TEXTO e ARIA pode mudar. */
const SLOW_MS = 100;

let lastSlowAt = 0;
let lastHeadU = -1;
let lastHeadOff: boolean | null = null;
let lastLensDeg = -1;
let lastAria = '';

/**
 * `force` pula o estrangulamento, e existe para os tiques que NÃO são
 * reprodução — um arrasto do cabeçote que termina, uma pausa, o fim de um voo.
 * Ali um atraso de um décimo deixaria o relógio dizendo o número errado depois
 * que tudo parou, que foi o defeito da primeira versão. Continua barato porque
 * toda escrita abaixo é comparada antes.
 */
function syncPlayhead(force = false) {
  const dur = timelineDuration();
  const t = timelinePreviewTime();
  const u = dur > 0 ? Math.min(1, Math.max(0, t / dur)) : 0;

  if (elPlayhead) {
    const off = dur <= 0;
    if (off !== lastHeadOff) {
      lastHeadOff = off;
      elPlayhead.classList.toggle('hidden', off);
    }
    /* ⚠️ O NÓ TEM A LARGURA INTEIRA DA RÉGUA E O RISCO MORA NA BORDA ESQUERDA
       DELE (ver `.ts-tl__playhead::before` no CSS). É o que torna
       `translateX(u × 100%)` correto sem MEDIR nada: a porcentagem de um
       `translate` é relativa ao PRÓPRIO elemento, e o próprio elemento é a
       régua. Um `left: %` daria o mesmo pixel e recalcularia layout sessenta
       vezes por segundo.
       O limiar de meio milésimo é meio pixel numa régua de 1 000 px: abaixo
       dele a escrita não move nada que o olho veja. */
    if (Math.abs(u - lastHeadU) > 5e-4) {
      lastHeadU = u;
      elPlayhead.style.transform = `translateX(${(u * 100).toFixed(2)}%)`;
    }
  }

  const now = performance.now();
  if (!force && now - lastSlowAt < SLOW_MS) return;
  lastSlowAt = now;

  const aria = t.toFixed(2);
  if (aria !== lastAria) {
    lastAria = aria;
    elRuler?.setAttribute('aria-valuenow', aria);
  }
  syncClock();
  /* A NOTA DO PÉ muda com a TAXA enquanto a prévia toca — ela é a única linha
     desta tela cujo conteúdo depende de uma medição e não do modelo. */
  if (isTimelinePreviewing()) syncHint();
  /* A LENTE VIVA acompanha o voo até um ponto: `flyToTimelineKey()` escreve o
     `fov` da chave na câmera, e um cursor que continuasse em 30° estaria
     mentindo sobre o que o percurso vai gravar. Comparado em NÚMERO antes de
     tocar em qualquer nó — ler `camera.fov` não custa nada, escrever no DOM
     custa. */
  const deg = Math.round(liveLens());
  if (deg !== lastLensDeg) {
    lastLensDeg = deg;
    syncLens(deg);
  }
  /* ⚠️ SEM A GUARDA DE "só quando não está tocando", que era o que estava aqui.
     Ela partia de que quem INICIA a prévia é sempre o botão — e o botão de fato
     repinta a si mesmo no clique. Mas a prévia também começa de fora: pelo
     console, pela bancada, e um dia por um atalho de teclado. Nesses casos o
     botão ficava com o ▷ enquanto o percurso corria, ou seja anunciando o
     contrário do estado. `syncTransport()` compara antes de escrever
     (`transportOn`), então chamá-la sempre custa uma comparação. */
  syncTransport();
}

/* As duas conversões do cursor espelhado — ver o ⚠️ na construção dele. Uma
   involução: `f(f(x)) === x`, o que é o que garante que ler e escrever não
   possam divergir. */
const lensFromSlider = (v: number) => MIN_LENS_FOV + MAX_LENS_FOV - v;
const sliderFromLens = lensFromSlider;

function syncLens(v: number) {
  const deg = Math.round(v);
  lastLensDeg = deg;
  const pos = Math.round(sliderFromLens(deg));
  if (elLens && document.activeElement !== elLens && Number(elLens.value) !== pos) {
    elLens.value = String(pos);
  }
  /* O leitor de tela ouve o GRAU, não a posição espelhada do cursor: "34" seria
     um número que não aparece em lugar nenhum da tela. */
  elLens?.setAttribute('aria-valuetext', `${deg} graus`);
  setText(elLensVal, `${deg}°`);
}

/* ===========================================================================
   ABRIR E FECHAR
   =========================================================================== */

/** `ui/chrome.ts` chama uma vez, no `initUI()`. */
export function initTimeline(h: TimelineHost) {
  host = h;
}

export const isTimelineOpen = () => open;

/**
 * Abre o criador.
 *
 * ⚠️ A CLASSE NO `root` É QUEM ESCONDE O RESTO, e não uma varredura de nós daqui
 * — é a mesma doutrina do modo limpo (`#btn-chrome`): quem sabe o que é
 * "interface" é o CSS, e cada coisa que flutua sobre o render já tem seletor
 * próprio na lista de `core/studio.css`. Um `hide()` nó a nó escrito aqui
 * precisaria ser atualizado toda vez que um card novo aparecesse — e esqueceria
 * de um.
 *
 * ⚠️ E A CLASSE É PRÓPRIA (`ts-tlmode`), NUNCA A `ts-bare` DO BOTÃO DE ESCONDER.
 * Reusar aquela faria fechar o criador DESFAZER um modo limpo que o usuário
 * tinha ligado à mão antes de abri-lo. Duas classes, uma lista de seletores,
 * nenhum estado roubado.
 */
export function openTimeline() {
  build();
  if (open) return;
  open = true;
  /* ⚠️ A VINHETA É BUSCADA AO ABRIR, e não na gravação. São 295 KB, a promessa é
     memoizada e ninguém espera por ela aqui — mas quando a gravação chegar ela
     já estará em memória, e a barra passa a poder somar os ~8 s do fecho à
     duração que promete. Falhar é silencioso por desenho: `outroDuration()`
     devolve 0 e a barra volta a falar só do percurso. */
  void loadOutro().then(() => { if (open) syncDerived(); });
  enterTimelineMode();
  root.classList.add('ts-tlmode');
  dock?.classList.remove('hidden', 'is-ghost');
  renderStrip();
  syncDerived();
  syncTransport();
  syncLens(liveLens());
}

export function closeTimeline() {
  if (!open) return;
  open = false;
  root.classList.remove('ts-tlmode');
  dock?.classList.add('hidden');
  /* Devolve o giro suspenso, o desvio das construções e a LENTE de fábrica —
     ver o § ENTRAR E SAIR DO MODO em `scene/timeline.ts`. Os pontos ficam: o
     percurso sobrevive a fechar e reabrir, e refazê-lo por causa de um clique
     no ✕ seria o pior desfecho possível desta tela. */
  exitTimelineMode();
}

/**
 * A gravação começou ou terminou.
 *
 * O dock continua NA TELA durante a gravação — ele fica atrás da cortina, que
 * cobre tudo —, mas os dois botões que agem precisam recusar o clique nos
 * segundos entre o fim da cortina e a repintura. E o modo de cena precisa ser
 * reafirmado: ver `reassertTimelineMode()`.
 */
export function timelineRecordingState(recording: boolean) {
  if (!built) return;
  if (elRec) elRec.disabled = recording || timelineCount() < 2;
  if (elPlay) elPlay.disabled = recording || timelineCount() < 2;
  dock?.classList.toggle('is-busy', recording);
  if (!recording) syncDerived();
}

/**
 * Saída de rota. `unmountStudio()` solta o `root` inteiro, então o DOM some
 * sozinho — o que NÃO some sozinho é o estado de CENA que o modo segurava (o
 * desvio suspenso e a lente). Sem isto, ir para outra tela com o criador aberto
 * deixaria o estúdio com uma teleobjetiva e sem correção de desvio na próxima
 * visita, sem nada explicando por quê.
 */
export function teardownTimeline() {
  if (open) closeTimeline();
  else if (isTimelineMode()) exitTimelineMode();
}

/** Só para o console e a bancada: joga o percurso fora. */
export function resetTimeline() {
  clearTimeline();
  selectedId = 0;
}
