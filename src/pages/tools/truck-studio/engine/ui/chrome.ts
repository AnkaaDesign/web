/* Chrome do estúdio: a linha de estado (hoje só para leitor de tela) e os
   controles de cena — enquadrar, girar, esconder a interface e capturar — que
   flutuam no canto superior direito do render.

   A TOPBAR SAIU INTEIRA. Ela tomava ~56 px de altura para mostrar o nome do
   próprio app, e levava junto os dois checkboxes de "Cabine"/"Implemento": eram
   um atalho de depuração, não uma configuração, e sumir com metade do veículo
   sem nada na tela explicando por quê é a pior coisa que um toggle pode fazer.
   Quem quer ver a cena limpa usa o botão de esconder interface, que devolve
   tudo com um clique.

   Este arquivo é o que sobrou de ui/sidebar.ts, e o nome mudou porque a coisa
   mudou: não há mais sidebar. O que morava lá foi para onde pertence —
   - iluminação → HUD de vidro (ui/hud.ts),
   - modelo → badge do caminhão (ui/selector.ts),
   - PINTURA → passo de cor do seletor, com o cavalo renderizado em cada cor
     (ui/selector.ts + ui/preview.ts + catalog/colors.ts),
   - DESIGN DO IMPLEMENTO → três cards sobre o render (#ts-panels), abrindo o
     editor grande (vehicle/livery.ts),
   - "pintar o implemento" → barra do editor grande, ao lado do painel que
     recebe a tinta (vehicle/livery.ts).
   Cada um desses tinha virado uma SEGUNDA superfície escrevendo um estado que
   outra superfície já era dona — que é como uma UI acaba discordando de si
   mesma. Sobrou aqui só o que não tem outro dono. */
import { frameAll, setTurntable, isTurntable } from '../scene/scene';
import {
  captureViewport, previewSize, previewTiles, CAPTURE_PRESETS, DEFAULT_QUALITY,
} from '../scene/capture';
import type { CaptureQuality, CaptureBackground } from '../scene/capture';
import {
  recordScene, stopRecording, canRecord, RecordingDiscarded,
} from '../scene/record';
import type {
  RecordMode, RecordResolution, RecordPhase, RecordProgress, RecordResult,
} from '../scene/record';
import { hasWebCodecs } from '../scene/record-encoder';
import { timelineCount, timelineDuration } from '../scene/timeline';
import {
  initTimeline, openTimeline, isTimelineOpen, timelineRecordingState,
} from './timeline';
import {
  showLoader, setLoaderProgress, setLoaderDetail, finishLoader, hideLoader,
} from './loader';
import type { LoaderInfo } from './loader';
import { state } from '../vehicle/models';
import { root, $, $opt, el, evCurrent, clamp01, errText } from '../core/dom';

export const setStatus = (t: string) => { $('status').textContent = t; };

/* ---------------- de que veículo é a imagem ----------------
   O nome do arquivo era `truck-studio.png`, fixo. Quem baixa cinco variações
   para comparar acaba com `truck-studio (4).png` e nenhuma forma de saber qual
   é qual. studio.ts injeta as partes aqui a cada aplicação; este módulo só as
   costura, porque é ele quem monta o download. */
let captureSubject: string[] = [];

/** studio.ts chama isto ao fim de cada aplicação. */
export function setCaptureSubject(parts: (string | null | undefined)[]) {
  captureSubject = parts.filter((p): p is string => !!p && !!p.trim());
}

/* Um pedaço de nome de arquivo seguro em qualquer sistema: sem acento, sem
   espaço, sem barra. `Vermelho Rubi` → `vermelho-rubi`. */
function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function captureFilename(width: number, height: number, ext: string): string {
  const parts = captureSubject.map(slug).filter(Boolean);
  const base = parts.length ? 'truck-studio-' + parts.join('-') : 'truck-studio';
  return `${base}-${width}x${height}.${ext}`;
}

/* ---------------- OCUPADO ----------------
   IMAGEM E VÍDEO SÃO MUTUAMENTE EXCLUSIVOS, e não por prudência: são
   incompatíveis mecanicamente. `captureViewport()` chama `stopLoop()` e troca o
   tamanho do buffer para renderizar em ladrilhos — no meio de uma gravação isso
   congela o vídeo pelos segundos que a imagem levar, e o arquivo sai com um
   trecho parado que ninguém consegue explicar depois. Na direção contrária, uma
   gravação segura o tamanho do buffer e o pino de quadros, que é exatamente o
   que a captura precisa mexer.

   Um flag por operação e um predicado que soma os dois — em vez de um único
   `busy` escrito pelos dois lados —, porque cada caminho precisa saber qual dos
   dois está rodando para dizer POR QUE recusou. */
let capturing = false;
let recording = false;
const busy = () => capturing || recording;

/* ---------------- topbar + view controls ----------------
   Os dois toggles de visibilidade seguem na topbar; enquadrar/girar/capturar
   ficam SOBRE o render, no canto superior direito (#view-controls, em
   core/template.ts). */
function bindTopbar() {
  /* #canvas-holder guarda o canvas e estes botões como IRMÃOS, e scene.ts liga o
     OrbitControls a `renderer.domElement` — o canvas, não o holder — então hoje
     um clique aqui não tem caminho de bolha até os controles. Isto é a guarda
     para o dia em que tiver: sem ela, apertar "Screenshot" começaria a arrastar
     a câmera por baixo do botão. Mesma proteção que ui/hud.ts, os badges do
     seletor e os cards de painel já aplicam. `wheel` é passivo: só precisa não
     viajar. */
  const cluster = $('view-controls');
  const swallow = (e: Event) => e.stopPropagation();
  cluster.addEventListener('pointerdown', swallow);
  cluster.addEventListener('pointerup', swallow);
  cluster.addEventListener('wheel', swallow, { passive: true });

  $('btn-reset').addEventListener('click', () => frameAll([state.cabGroup, state.trailerGroup]));
  /* PASSA POR setTurntable(), e não mais por `controls.autoRotate` direto.
     A flag crua continua "funcionando" — wantsFrame() a lê e o laço desenha —,
     mas ela pula a recentragem da mira, o congelamento do pan e o piso de
     distância, que são exatamente as três correções pedidas ("garantir que está
     sempre no centro e ambas as pontas sempre dentro da cena"). Ver o bloco
     "o GIRO DE APRESENTAÇÃO" em scene/scene.ts.
     A velocidade não é mais escrita aqui: quem não pede uma mantém a que está,
     e é a barra de gravação que a ajusta quando precisa de um período exato. */
  $('btn-turn').addEventListener('click', (e) => {
    setTurntable(!isTurntable());
    const btn = evCurrent(e);
    btn.classList.toggle('on', isTurntable());
    /* O botão declara aria-pressed no template, então ele TEM de acompanhar —
       um toggle que anuncia "não pressionado" enquanto gira é pior do que um
       que não anuncia nada. */
    btn.setAttribute('aria-pressed', isTurntable() ? 'true' : 'false');
  });
  /* Esconder a interface. Uma classe na raiz e nada mais: quem sabe o que é
     "interface" é o CSS (core/studio.css), e cada coisa que flutua sobre o
     render já tem seletor próprio lá. Um toggle que fosse apagando nó por nó
     daqui teria de ser atualizado toda vez que um novo card aparecesse — e
     esqueceria de um.
     O botão é o único que fica visível, senão desfazer viraria adivinhação. */
  $('btn-chrome').addEventListener('click', (e) => {
    const bare = root.classList.toggle('ts-bare');
    const btn = evCurrent(e);
    btn.classList.toggle('on', bare);
    btn.setAttribute('aria-pressed', bare ? 'true' : 'false');
    btn.title = bare ? 'Mostrar a interface' : 'Esconder a interface';
    btn.setAttribute('aria-label', btn.title);
    setStatus(bare ? 'Interface escondida · só a cena' : 'Interface visível');
  });

  buildQualityMenu();
  buildRecordMenu();
  bindFullscreen();
  /* O botão de parar mora na PÍLULA, não na régua — ver a nota do #ts-rec em
     core/template.ts. Ligado aqui, uma vez, porque o nó é estático.
     ELE TEM TRÊS TRABALHOS, e por isso não chama `stopRecording()` direto: parar
     (modo livre, entrega o vídeo), cancelar (qualquer outra fase, joga fora) e
     fechar o aviso que fica na tela depois que a gravação termina. Quem separa
     os três é `requestStop()`; ver o bloco "PARAR E CANCELAR NÃO SÃO A MESMA
     COISA". */
  $('ts-rec-stop').addEventListener('click', () => {
    if (recording) requestStop(); else recPill(false);
  });
}

/* ---------------- tela cheia ----------------
   O ALVO É `root`, E NUNCA `#canvas-holder`. Isto é o item carregante deste
   bloco inteiro, e errá-lo dá um bug que só aparece quando alguém abre o editor.
   A subárvore do estúdio (core/template.ts) é:

       root ─┬─ #app ─ #viewport ─ #canvas-holder ─ (canvas, HUD, badges, cards)
             └─ #editor-modal            ← IRMÃO de #app, fora do holder

   O navegador desenha em tela cheia o elemento pedido e SÓ ele: tudo que não
   for descendente dele some da tela. Pedir tela cheia no holder deixaria de
   fora o editor de plotagem inteiro, mais o painel de tinta (ui/paint-panel.ts)
   e a cortina de carregamento (ui/loader.ts) — os três são filhos de `root`, e
   os três abririam num retângulo invisível. Conferido: TODO overlay do engine é
   pendurado em `root` ou dentro de `#canvas-holder`, nenhum em `document.body`.

   NADA DE RESIZE PARA FAZER AQUI. mountStudio() mantém um ResizeObserver sobre
   `sceneMod.holder` e entrar em tela cheia muda o tamanho dele, então
   scene.resize() — que reaplica devicePixelRatio, setSize e camera.aspect — roda
   por si. Chamá-lo daqui seria um segundo dono do mesmo trabalho.

   NÃO É PERSISTIDO, e isso é decisão e não esquecimento: tela cheia só pode ser
   PEDIDA de dentro de um gesto do usuário. Uma preferência gravada seria um
   estado que o boot não tem como honrar — o botão nasceria "ligado" com a página
   em tamanho normal, que é pior do que não lembrar nada.

   ESC NÃO CONFLITA com o menu de qualidade: o handler de Escape lá em cima só
   chama stopPropagation() quando o menu está aberto, e nunca preventDefault() —
   a saída de tela cheia do navegador não passa por listener nenhum. */

/* As duas APIs, e por que a com prefixo ainda está aqui: o Safari só ganhou
   `requestFullscreen` sem prefixo na 16.4. Um Mac preso numa versão anterior é um
   usuário sem o botão, calado. São quatro nomes; declará-los custa menos do que
   descobrir isso num relato de que "o botão não faz nada nesta máquina". */
interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
const fsDoc = document as FsDocument;
const fsRoot = root as FsElement;

/** O elemento em tela cheia AGORA, seja qual for o nome da API. */
const fsElement = (): Element | null =>
  document.fullscreenElement || fsDoc.webkitFullscreenElement || null;

/** É o estúdio que está em tela cheia? */
const fsActive = () => fsElement() === root;

/* `typeof … === 'function'` e não um simples `?.`: a lib do TS declara
   `requestFullscreen`/`exitFullscreen` como OBRIGATÓRIOS em HTMLElement/Document,
   então um teste de verdade neles é "sempre verdadeiro" para o compilador e
   mentira em runtime — que é exatamente o navegador antigo que estamos cobrindo. */
const fsSupported = () =>
  typeof fsRoot.requestFullscreen === 'function'
  || typeof fsRoot.webkitRequestFullscreen === 'function';

async function toggleFullscreen() {
  try {
    if (fsActive()) {
      if (typeof fsDoc.exitFullscreen === 'function') await fsDoc.exitFullscreen();
      else await fsDoc.webkitExitFullscreen?.();
    } else if (typeof fsRoot.requestFullscreen === 'function') {
      await fsRoot.requestFullscreen({ navigationUI: 'hide' });
    } else {
      await fsRoot.webkitRequestFullscreen?.();
    }
  } catch (err: unknown) {
    /* A promessa REJEITA quando o navegador recusa por política — sem gesto do
       usuário, iframe sem `allow="fullscreen"`, permissão negada. Sem este catch
       isso vira uma rejeição não tratada no console de quem só clicou num botão,
       e a linha de estado é o único lugar em que a recusa pode ser dita. */
    console.warn('[truck-studio] tela cheia recusada', err);
    setStatus('O navegador não permitiu a tela cheia nesta página.');
  }
}

/* Repinta o botão A PARTIR DO DOCUMENTO. Nunca a partir de um booleano nosso: o
   usuário sai de tela cheia por Esc, por F11 e trocando de aba, e nenhum desses
   caminhos passa pelo clique — um estado próprio dessincroniza no primeiro Esc e
   fica mentindo até o próximo clique. */
function syncFullscreen() {
  const on = fsActive();
  const btn = $<HTMLButtonElement>('btn-full');
  root.classList.toggle('ts-full', on);
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on ? 'Sair da tela cheia' : 'Tela cheia';
  btn.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Entrar em tela cheia');
}

function bindFullscreen() {
  const btn = $<HTMLButtonElement>('btn-full');
  /* Sem a API o botão fica com o `.hidden` que veio do template. Um controle que
     não faz nada é pior que um controle ausente: ele gasta um clique e não tem
     como explicar por quê. (iPhone não tem tela cheia de ELEMENTO — só o vídeo
     nativo tem —, então este ramo é real, não teórico.) */
  if (!fsSupported()) return;
  btn.classList.remove('hidden');
  btn.addEventListener('click', () => { void toggleFullscreen(); });
  /* Os dois nomes de evento pelo mesmo motivo dos dois nomes de método. Ficam no
     `document` porque é lá que a especificação os dispara; é o mesmo lugar em que
     o menu de qualidade já mantém os dele, e initUI() roda uma vez por página. */
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
  syncFullscreen();
}

/**
 * Sai da tela cheia se — e só se — quem estiver nela for o estúdio.
 *
 * Chamado por unmountStudio(). O navegador já sai sozinho quando o elemento em
 * tela cheia deixa o documento (`root.remove()`), mas sair ANTES evita o quadro
 * em que a rota já trocou e a tela ainda está tomada pela ferramenta anterior.
 * A guarda `fsActive()` importa: o Ankaa pode ter posto OUTRA coisa em tela
 * cheia, e derrubá-la ao sair desta rota seria um efeito colateral nosso sobre
 * um estado que não é nosso.
 */
export function exitFullscreen() {
  if (!fsActive()) return;
  try {
    if (typeof fsDoc.exitFullscreen === 'function') void fsDoc.exitFullscreen();
    else void fsDoc.webkitExitFullscreen?.();
  } catch { /* saindo da rota de qualquer jeito */ }
}

/* ---------------- o botão da câmera abre um PAINEL DE CAPTURA ----------------
   ESTE BLOCO JÁ MUDOU DE IDEIA DUAS VEZES, e as duas estão registradas porque a
   segunda desfaz a primeira e um comentário que só contasse a última faria a
   próxima pessoa reintroduzir a que foi descartada.

   1. (antes) BOTÃO DIVIDIDO: a câmera capturava direto com a qualidade
      guardada e uma setinha de 20px ao lado abria a escolha. Descartado —
      *"o botao de screenshot nao deve ter um chevron ao lado"*.
   2. (2026-08) CLICAR NA QUALIDADE TIRAVA A FOTO. A qualidade deixava de ser um
      modo invisível e virava parte da ação, num gesto só.
   3. (agora) SELECIONAR, DEPOIS CAPTURAR. Pedido do dono do produto: *"em vez
      de tirar a foto imediatamente ao clicar na qualidade selecionada, deve ter
      um botão abaixo delas, com o ícone de foto e o texto capturar imagem"*.

   POR QUE (3) NÃO É UM RETROCESSO PARA (1). O que tornava (1) ruim era a
   escolha ficar ESCONDIDA — um estado invisível que o clique gastava sem
   perguntar. Aqui nada está escondido: fundo e qualidade estão os dois na tela,
   marcados, no mesmo painel e a um centímetro do botão que age. O que (3)
   acrescenta é a chance de ERRAR sem custo — com duas perguntas no painel
   (fundo E qualidade), o modelo de (2) obrigava a acertar as duas na ordem
   certa, e um clique na qualidade antes de trocar o fundo tirava a foto errada.
   Um botão de ação é o que separa "estou escolhendo" de "pode ir".

   As três linhas passam a ser RÁDIOS, não itens de menu: elas selecionam. Por
   isso o `role` mudou junto — anunciar "item de menu" para algo que não age é a
   mesma mentira, dita para quem usa leitor de tela.

   `truckstudio.capture.v1` continua guardando a qualidade, agora como o que ela
   voltou a ser: uma preferência. (A chave também é o que
   `truck-studio-desktop/src/studio/persist.ts` hidrata antes de importar o
   engine — ver o I6 §3. Tirá-la daqui quebraria aquilo.)

   Construído AQUI, imperativamente, e não no template: `core/template.ts` é o
   esqueleto estático do estúdio, e as três linhas carregam a RESOLUÇÃO
   CALCULADA de cada preset — um número que só existe em runtime, porque depende
   da proporção do viewport e do limite da placa. "Alta · 7680 × 4320" é o que
   torna a escolha informada; "Alta" sozinho não é uma escolha, é um adjetivo. */

const QUALITY_KEY = 'truckstudio.capture.v1';
const QUALITY_ORDER: CaptureQuality[] = ['low', 'medium', 'high'];

/* ---------------- o FUNDO da imagem ----------------
   Chave própria, e não um campo dentro de `truckstudio.capture.v1`: aquela
   string é lida por `truck-studio-desktop/src/studio/persist.ts` ANTES de
   importar o engine (ver o I6 §3), e ele espera encontrar ali um dos três ids de
   qualidade e mais nada. Trocar o formato do valor quebraria a hidratação do
   desktop em silêncio; uma chave nova não pode quebrar nada.

   E POR QUE UM CONTROLE SEPARADO, e não seis itens de menu (3 qualidades × 2
   fundos): o cabeçalho acima explica que a qualidade deixou de ser um modo
   invisível e virou parte da ação. Seis itens honrariam a letra dessa regra e
   trairiam o espírito — um menu de seis linhas para uma pergunta com duas
   respostas é pior de ler do que dois controles. O que a regra realmente exige é
   que a escolha esteja À VISTA no momento do clique, e um segmento no topo do
   MESMO menu está: a linha de cada qualidade diz, ali, qual fundo vai sair. */
const BG_KEY = 'truckstudio.capture.bg.v1';
const BG_ORDER: CaptureBackground[] = ['cena', 'recorte'];

/* ---- COMO ISTO SE CHAMA NA TELA ----
   Os ids (`cena`/`recorte`) são de CÓDIGO e ficam como estão; o que muda aqui é
   só o que a pessoa lê. O pedido foi literal: *"em vez de recorte, fundo
   transparente"* — e ele está certo. "Recorte" é jargão de quem faz arte-final;
   quem usa o estúdio quer saber se a imagem vem com fundo ou sem, e a palavra
   que responde isso sem ensinar vocabulário novo é "transparente".
   O mesmo critério vale para tudo que esta barra escreve: nada de "ladrilho",
   nada de "7/16", nada de "mosaico". Ver `shotPillText`. */
const BG_LABEL: Record<CaptureBackground, string> = {
  cena: 'Com fundo',
  recorte: 'Sem fundo',
};
const BG_BLURB: Record<CaptureBackground, string> = {
  cena: 'A imagem inteira, com o cenário atrás do veículo',
  recorte: 'Só o veículo, com fundo transparente e a sombra no chão',
};

function readBackground(): CaptureBackground {
  try {
    const v = localStorage.getItem(BG_KEY);
    if (v && (BG_ORDER as string[]).includes(v)) return v as CaptureBackground;
  } catch { /* modo privado — o padrão serve */ }
  return 'cena';
}

let background: CaptureBackground = readBackground();

function writeBackground(v: CaptureBackground) {
  background = v;
  try { localStorage.setItem(BG_KEY, v); }
  catch { /* a escolha ainda vale para esta sessão */ }
}

/* A ÚLTIMA qualidade usada — ver acima: memória do menu, nunca um modo que
   captura sozinho. */
let quality: CaptureQuality = readQuality();

/* ---------------- o PAINEL, extraído ----------------
   HÁ DOIS PAINÉIS AGORA — o da câmera e o da gravação — e eles são o MESMO
   componente: um botão da régua que abre um cartão com perguntas e um botão que
   age. O que estava escrito à mão para a câmera virou esta fábrica, e a razão de
   extrair em vez de copiar está toda na lista de comportamentos abaixo: são
   sete regras, várias delas contraintuitivas e cada uma paga com um defeito
   relatado. Um segundo painel escrito à mão herdaria as sete por cópia e
   divergiria na primeira correção que só um dos dois recebesse.

   O que a fábrica é dona (e o cabeçalho do bloco de captura explica o porquê de
   cada uma):
     1. abrir REPINTA. As resoluções mudam com o tamanho da janela, e um painel
        que mostrasse os números da abertura anterior mentiria sobre a única
        coisa que ele existe para dizer;
     2. o foco ENTRA no painel, no item marcado — senão o teclado fica para trás;
     3. Esc fecha e DEVOLVE o foco ao botão, senão ele fica num nó que acabou de
        virar display:none;
     4. clique fora fecha, em fase de captura e com guarda para o próprio botão
        não fechar e reabrir no mesmo clique;
     5. `has-shotmenu` sobe o z-index do cluster — sem ela os cards de design
        (#ts-panels) cobrem o painel. Ver a nota em core/studio.css;
     6. NÃO FECHA POR PERDA DE FOCO. Repintar destrói o nó focado e o navegador
        emite `focusout` com `relatedTarget = null`, indistinguível de um Tab —
        e o painel repinta a cada escolha, que é o que o usuário mais faz aqui;
     7. setas/Home/End percorrem os itens que o `paint` devolveu.

   `paint` DEVOLVE a lista de itens percorríveis em vez de escrevê-la numa
   variável de módulo: com dois painéis, uma variável compartilhada faria as
   setas do teclado de um andarem sobre os itens do outro. */
interface Popover {
  panel: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(restoreFocus?: boolean): void;
  /** Repinta com o painel aberto — o que toda escolha faz. */
  repaint(): void;
}

interface PopoverSpec {
  trigger: HTMLButtonElement;
  /** id do painel, para o `aria-controls` do botão. */
  id: string;
  /** Classe extra no invólucro, para o CSS próprio de cada painel. */
  groupClass?: string;
  ariaLabel: string;
  paint: (panel: HTMLElement) => HTMLButtonElement[];
  /** `false` recusa a abertura — é por onde a exclusão imagem/vídeo entra. */
  canOpen?: () => boolean;
}

function makePopover(spec: PopoverSpec): Popover {
  const cluster = $('view-controls');
  const { trigger } = spec;

  const wrap = el('div', 'ts-shotgroup' + (spec.groupClass ? ' ' + spec.groupClass : ''));
  const panel = el('div', 'ts-shotmenu hidden');
  panel.id = spec.id;
  /* `group`, e não `menu`: um menu é uma lista de AÇÕES, e estes painéis são
     perguntas mais um botão. Anunciá-los como menu prometeria a um leitor de
     tela que cada linha faz alguma coisa — e elas não fazem. */
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', spec.ariaLabel);

  /* O botão sai da régua e volta para dentro do invólucro, que é quem ancora o
     painel (`position: relative`). `replaceWith` antes do `appendChild` mantém a
     ORDEM na régua — um `appendChild` direto no cluster mandaria o botão para o
     fim dela. */
  trigger.replaceWith(wrap);
  wrap.appendChild(trigger);
  wrap.appendChild(panel);

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', spec.id);

  let items: HTMLButtonElement[] = [];
  const isOpen = () => !panel.classList.contains('hidden');

  const roving = (e: KeyboardEvent, item: HTMLButtonElement) => {
    const i = items.indexOf(item);
    if (i < 0) return;
    let to = -1;
    if (e.key === 'ArrowDown') to = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') to = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = items.length - 1;
    else return;
    e.preventDefault();
    items[to]?.focus();
  };

  const repaint = () => {
    items = spec.paint(panel);
    /* Enter e Espaço não aparecem aqui porque um <button> já os dispara como
       clique — reimplementá-los daria dois disparos. */
    for (const it of items) it.addEventListener('keydown', (e) => roving(e, it));
  };

  const open = () => {
    if (isOpen() || spec.canOpen?.() === false) return;
    repaint();
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    cluster.classList.add('has-shotmenu');
    (items.find((it) => it.classList.contains('is-on')) || items[0])?.focus();
  };

  const close = (restoreFocus = false) => {
    if (!isOpen()) return;
    panel.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    /* A classe é do CLUSTER e há dois painéis: só o último a fechar pode
       removê-la, senão fechar um derruba o z-index do outro que ficou aberto. */
    if (!cluster.querySelector('.ts-shotmenu:not(.hidden)')) {
      cluster.classList.remove('has-shotmenu');
    }
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener('click', () => { if (isOpen()) close(); else open(); });
  /* Seta para baixo/cima abrindo já no primeiro/último item é a convenção de
     menu button do APG, e é de graça aqui. */
  trigger.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (!isOpen()) open();
    (e.key === 'ArrowDown' ? items[0] : items[items.length - 1])?.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen() || wrap.contains(e.target as Node)) return;
    close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    e.stopPropagation();
    close(true);
  });

  return { panel, isOpen, open, close, repaint };
}

let shotPop: Popover | null = null;
let recPop: Popover | null = null;

/* Texto do menu. Mora AQUI e não em `CAPTURE_PRESETS.hint` de propósito: é copy
   de interface em pt-BR, e `scene/capture.ts` é o renderizador — o dia em que
   uma frase precisar de retoque não é dia de tocar no arquivo que faz a imagem.
   Cada linha diz PARA QUE o preset serve, que é a pergunta que a pessoa tem na
   cabeça ao abrir isto; a resolução e o formato o menu já mostra sozinho. */
const QUALITY_BLURB: Record<CaptureQuality, string> = {
  low: 'Leve, para mandar por e-mail ou WhatsApp',
  medium: 'O padrão — boa para apresentação e para a web',
  high: 'Para impressão e para dar muito zoom',
};

function readQuality(): CaptureQuality {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (v && (QUALITY_ORDER as string[]).includes(v)) return v as CaptureQuality;
  } catch { /* modo privado — o padrão serve */ }
  return DEFAULT_QUALITY;
}

function writeQuality(q: CaptureQuality) {
  quality = q;
  try { localStorage.setItem(QUALITY_KEY, q); }
  catch { /* a escolha ainda vale para esta sessão */ }
}

function buildQualityMenu() {
  const shot = $<HTMLButtonElement>('btn-shot');
  shot.title = 'Capturar imagem';
  shot.setAttribute('aria-label', 'Capturar imagem — abrir as opções');
  /* O botão anuncia que ABRE ALGO. `aria-haspopup` + `aria-expanded` é o que faz
     um leitor de tela dizer "diálogo, recolhido" em vez de prometer um download
     que este clique não faz mais. Quem os escreve é a fábrica. */
  shotPop = makePopover({
    trigger: shot,
    id: 'ts-shotmenu',
    ariaLabel: 'Opções de captura',
    paint: paintQualityMenu,
    /* Gravando, a captura de imagem está indisponível — e o painel nem abre, em
       vez de abrir e recusar no botão de agir. Ver o bloco OCUPADO. */
    canOpen: () => !busy(),
  });
  /* ---- QUANDO ESTE PAINEL FECHA, E SÓ QUANDO ----
     A regra é do dono do produto, dita depois de dois relatos seguidos de que
     ele fechava sozinho: *"não deveria [fechar] até clicar em tirar foto, ou
     clicar fora, ou no trigger novamente"*. São exatamente três saídas, e a
     quarta é o Esc (que é a mesma coisa que "clicar fora", dita no teclado):

       · "Capturar imagem"      → closeMenu(true) no handler do botão
       · um clique FORA do wrap → o pointerdown de captura, logo acima
       · o botão da câmera      → o toggle no click dele
       · Esc                    → o keydown, logo acima

     O FECHAMENTO POR `focusout` FOI REMOVIDO, e não apenas guardado. Ele existia
     para cobrir um Tab para fora, e cobria — mas também disparava toda vez que o
     painel se repinta, porque repintar DESTRÓI o nó focado e o navegador emite
     `focusout` com `relatedTarget = null`, que é indistinguível de um Tab. E o
     painel repinta a cada escolha, que é a coisa que o usuário mais faz aqui.
     Uma guarda de "estou repintando" chegou a ser escrita e ainda deixava
     buracos (o refoco assíncrono, o clique que não foca no Safari). A escolha é
     a simples: menos uma forma de fechar, zero formas de fechar sozinho. Quem
     sai com Tab encontra o painel aberto atrás — e o próximo Tab, o Esc ou um
     clique fora resolvem. */
}

/* Um item por preset. Ele é um BOTÃO DE AÇÃO (`role="menuitem"`), não um rádio:
   clicar não seleciona uma preferência, TIRA A IMAGEM naquela qualidade. O
   `.is-on` marca só qual foi a última — é memória, não estado ligado —, e é por
   isso que ele vem com "último uso" escrito ao lado em vez de um ✓, que leria
   como "esta opção está ativa". */
function paintQualityMenu(menuEl: HTMLElement): HTMLButtonElement[] {
  menuEl.textContent = '';
  const menuItems: HTMLButtonElement[] = [];

  /* O FUNDO primeiro: ele qualifica as três linhas abaixo, e um controle que
     muda o significado do que vem depois tem de vir antes. */
  const bgHead = el('div', 'ts-shotmenu__head', 'Fundo');
  bgHead.setAttribute('aria-hidden', 'true');
  menuEl.appendChild(bgHead);

  const seg = el('div', 'ts-shotseg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', 'Fundo da imagem');
  for (const b of BG_ORDER) {
    const on = b === background;
    const btn = el('button', 'ts-shotseg__btn' + (on ? ' is-on' : ''), BG_LABEL[b]);
    btn.type = 'button';
    btn.dataset.bg = b;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.title = BG_BLURB[b];
    btn.setAttribute('aria-label', `${BG_LABEL[b]} — ${BG_BLURB[b]}`);
    btn.addEventListener('click', () => {
      writeBackground(b);
      /* Repinta O MENU INTEIRO, e não só o segmento: as três linhas de baixo
         mudam de formato quando o fundo é transparente (WebP com perdas
         franjaria a borda alfa, então Baixa vira PNG). Um segmento que mudasse
         sozinho deixaria o menu dizendo "WEBP" numa opção que vai sair em PNG.
         O MENU NÃO FECHA: repintar destrói o nó focado, e o fechamento por
         perda de foco foi removido justamente por isso — ver "QUANDO ESTE
         PAINEL FECHA" lá em cima. */
      shotPop?.repaint();
      /* O foco volta para a pastilha que a pessoa acabou de escolher, e não para
         a primeira qualidade: ela ainda está decidindo o fundo, e mandar o foco
         para outra seção seria o teclado discordando do que o mouse fez. */
      menuEl.querySelector<HTMLButtonElement>(
        `.ts-shotseg__btn[data-bg="${b}"]`,
      )?.focus();
    });
    seg.appendChild(btn);
  }
  menuEl.appendChild(seg);

  const head = el('div', 'ts-shotmenu__head', 'Qualidade');
  head.setAttribute('aria-hidden', 'true');
  menuEl.appendChild(head);

  /* As três linhas num `radiogroup` de verdade: sem o invólucro, três rádios
     soltos não formam um grupo e o leitor de tela não sabe dizer "1 de 3". */
  const qGroup = el('div', 'ts-shotmenu__radios');
  qGroup.setAttribute('role', 'radiogroup');
  qGroup.setAttribute('aria-label', 'Qualidade da imagem');
  menuEl.appendChild(qGroup);

  for (const q of QUALITY_ORDER) {
    const preset = CAPTURE_PRESETS[q];
    const size = previewSize(q);
    /* `previewTiles()` NÃO é consultado aqui. Ele era, para escrever "16
       ladrilhos" no subtítulo, e isso saiu — ver a nota abaixo. Quem ainda o usa
       é `runCapture()`, para dimensionar a barra de progresso. */
    const last = q === quality;

    const item = el('button', 'ts-shotmenu__item');
    item.type = 'button';
    /* RÁDIO, e não `menuitem`: esta linha escolhe, não age. Ver o bloco (3) do
       cabeçalho — quem age é o botão lá embaixo. */
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', last ? 'true' : 'false');
    if (last) item.classList.add('is-on');

    const row = el('span', 'ts-shotmenu__row');
    row.appendChild(el('span', 'ts-shotmenu__name', preset.label));
    row.appendChild(el('span', 'ts-shotmenu__dim', `${size.width} × ${size.height}`));
    item.appendChild(row);
    /* O FORMATO É O EFETIVO, não o do preset. Um recorte sai sempre em PNG (ver
       captureViewport), e o menu tem de dizer o que vai acontecer — dizer WEBP
       e entregar PNG é a mesma classe de mentira que o `scale` por viewport
       cometia. */
    const ext = background === 'recorte' ? 'PNG' : preset.ext.toUpperCase();
    /* O NÚMERO DE LADRILHOS SAIU DAQUI. Ele descrevia como a imagem é feita, não
       o que ela é — e "16 ladrilhos" não ajuda ninguém a escolher entre Média e
       Alta. O que ajuda é o que já está na linha de cima (a resolução) e o
       aviso de que a alta demora, que a frase de `QUALITY_BLURB` dá. `tiles`
       continua sendo consultado, só que para a BARRA de progresso. */
    item.appendChild(el('span', 'ts-shotmenu__hint', `${QUALITY_BLURB[q]} · ${ext}`));
    /* O selo "último uso" SAIU. Ele existia porque `.is-on` marcava memória e
       não estado — e com a seleção virando estado de verdade, o selo passaria a
       dizer o que o anel já diz, duas vezes e com a palavra errada. */

    /* O nome acessível tem de carregar TUDO: um leitor de tela lê a linha, não a
       composição visual das três partes. */
    item.setAttribute('aria-label',
      `${preset.label}, ${size.width} por ${size.height} pixels. ` + QUALITY_BLURB[q] + '.');

    item.addEventListener('click', () => {
      writeQuality(q);
      /* Repinta para o anel andar — e o menu FICA ABERTO. */
      shotPop?.repaint();
      menuEl.querySelector<HTMLButtonElement>(`.ts-shotmenu__item[data-q="${q}"]`)?.focus();
    });
    item.dataset.q = q;
    /* As setas do teclado são da fábrica: ela liga o `keydown` em cada item que
       este `paint` devolver. */
    qGroup.appendChild(item);
    menuItems.push(item);
  }

  /* ---- o botão que AGE ----
     Separado das três linhas por um filete, e com ícone: ele é a única coisa
     neste painel que produz um arquivo, e tem de parecer diferente de tudo que
     só marca uma opção. O ícone é o MESMO da câmera de #view-controls (mesma
     convenção de SVG 24×24 em currentColor), porque é literalmente a ação
     daquele botão sendo confirmada. */
  const go = el('button', 'ts-shotgo');
  go.type = 'button';
  const ico = el('span', 'ts-shotgo__ico');
  ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
    + ' stroke-linejoin="round" focusable="false"><path d="M3.4 8.8h3.2l1.3-2.2h8.2'
    + 'l1.3 2.2h3.2a.8.8 0 0 1 .8.8v8.2a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8V9.6'
    + 'a.8.8 0 0 1 .8-.8Z"/><circle cx="12" cy="13.4" r="3.1"/></svg>';
  go.appendChild(ico);
  /* `el(tag, cls, text)` tipa `cls` como `string | undefined`; `null` explícito
     não passa no strict. Omitir é a forma de dizer "sem classe". */
  go.appendChild(el('span', undefined, 'Capturar imagem'));
  go.addEventListener('click', () => {
    const q = quality;
    shotPop?.close(true);
    void runCapture(q);
  });
  menuEl.appendChild(go);
  return menuItems;
}

/* ---------------- captura em alta resolução ----------------
   A UI da coisa; o trabalho pesado é de scene/capture.ts, que documenta por que
   um toDataURL do canvas visível saía em ~1500x900. Aqui só mora o que é DOM:
   a pílula, o guarda de reentrância e o download. */

/* Um clique de cada vez — o par `capturing`/`recording` e o predicado `busy()`
   estão declarados lá em cima, no bloco OCUPADO, porque agora são DOIS os
   trabalhos que se excluem. captureViewport() para o loop de render e
   redimensiona o buffer; um segundo clique no meio pegaria o renderer já
   remexido e devolveria o estado errado no seu próprio finally. */

/* Um rAF agenda DEPOIS do próximo cálculo de estilo/layout; o segundo só roda
   depois que aquele quadro foi pintado. Duas voltas, portanto, é o mínimo que
   garante que a pílula está NA TELA antes de a captura travar a thread — com
   uma só, o indicador aparece quando o trabalho que ele anuncia já acabou.

   MAS rAF NÃO DISPARA NUMA ABA EM SEGUNDO PLANO, e este `await` era o quarto
   travamento dessa família — os três primeiros estão documentados no I3 §6
   (`studio.ts:runApply`, `selector.ts:finish`, `capture.ts` entre ladrilhos).
   Sem o guarda, pedir uma captura e trocar de aba pendurava a promessa PARA
   SEMPRE: `capturing` ficava true, o botão desabilitado e a pílula no ar, sem
   erro nenhum e sem caminho de volta a não ser recarregar. Reproduzido: numa
   aba não-fronteada a captura parava ANTES do primeiro render, com zero
   chamadas a `renderer.render`.
   A regra é a mesma de `scene/capture.ts:yieldFrame()`: ceder um quadro é
   otimização de APRESENTAÇÃO, e nunca pode ser o motivo de um trabalho não
   começar. Escondido → resolve na hora (não há pintura a esperar); visível →
   corre com um `setTimeout`, que cobre o rAF que não vier. */
const painted = () =>
  new Promise<void>((resolve) => {
    if (document.hidden) { resolve(); return; }
    let settled = false;
    const go = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 250);
  });

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  /* Revogar na mesma volta cancela o download em alguns motores: o clique só
     ENFILEIRA a busca da blob: URL. Alguns segundos cobrem isso com folga, e o
     PNG (dezenas de MB em 12 MP) não fica pendurado na memória além disso —
     que é justamente o que este recurso não pode fazer. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* A pílula da captura agora tem TEXTO VARIÁVEL. Ela era um rótulo fixo do
   template ("Gerando imagem…"), o que bastava quando a operação durava menos de
   um segundo; no preset alto são dezesseis renders e vários segundos, e uma
   frase parada durante isso lê como travado. O nó do texto é o último <span> da
   pílula — o template deliberadamente não lhe deu um id, então ele é alcançado
   por posição e a escrita é TOLERANTE: um template que mude não pode derrubar a
   captura, só deixá-la silenciosa. */
function shotPillText(text: string) {
  const span = $('ts-shot').querySelector('span');
  if (span) span.textContent = text;
}

/* A BARRA DE PROGRESSO da pílula, criada sob demanda.
   O texto sozinho ("ladrilho 7/16") já contava a verdade, mas contar é mais
   lento de ler do que ver: no preset alto são vários segundos, e uma barra que
   anda é a diferença entre "está trabalhando" e "será que travou". Injetada aqui
   e não no template porque `core/template.ts` não é meu — e porque uma barra que
   só existe durante o preset de 16 ladrilhos não pertence ao esqueleto estático.
   Tolerante a um template que mude: sem a pílula, a captura segue sem barra. */
function shotPillBar(): HTMLElement | null {
  const pill = $('ts-shot');
  let bar = pill.querySelector<HTMLElement>('.ts-shotbar');
  if (!bar) {
    bar = el('span', 'ts-shotbar');
    bar.appendChild(el('span', 'ts-shotbar__fill'));
    pill.appendChild(bar);
  }
  return bar;
}

function shotPillProgress(done: number, total: number) {
  const bar = shotPillBar();
  if (!bar) return;
  /* `hidden` em vez de remover: um passe único não tem progresso a mostrar, e
     uma barra que salta de 0 a 100 num quadro é ruído, não informação. */
  bar.classList.toggle('hidden', total <= 1);
  const fill = bar.firstElementChild as HTMLElement | null;
  if (fill) fill.style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`;
}

/**
 * Tira a imagem. A qualidade vem SEMPRE de quem chamou — do item de menu que o
 * usuário acabou de clicar —, nunca de um estado guardado: é isso que o novo
 * modelo de interação quer dizer.
 */
async function runCapture(q: CaptureQuality) {
  /* `busy()` e não `capturing`: uma gravação em curso também impede — ver o
     bloco OCUPADO. O painel já não abre nesse estado, mas o caminho do teclado
     e um futuro atalho não passam por ele. */
  if (busy()) return;
  capturing = true;

  const btn = $<HTMLButtonElement>('btn-shot');
  const pill = $('ts-shot');
  /* `CAPTURE_PRESETS[q]` NÃO é lido aqui, e a ausência é o registro: ele existia
     para montar "Gerando imagem · Alta 7680 × 4320…" e o rótulo do ladrilho.
     Os dois saíram — ver o bloco abaixo e o `onTile`. */
  btn.disabled = true;
  /* SEM NÚMERO NENHUM AQUI. A pílula dizia
     "Gerando imagem · Alta 7680 × 4320…" e depois "ladrilho 7/16", e o dono do
     produto foi direto: *"eu não quero esse texto, é muito técnico, quero
     nomenclaturas mais comuns"*. Ele está certo — um ladrilho é um detalhe de
     COMO a imagem é feita, e quem está esperando quer saber se falta muito.
     Quem responde isso é a BARRA; o texto só precisa dizer o que está
     acontecendo. */
  shotPillText('Gerando imagem…');
  shotPillProgress(0, previewTiles(q));
  pill.classList.remove('hidden');

  try {
    await painted();
    const shot = await captureViewport({
      quality: q,
      background,
      /* SÓ A BARRA. O texto NÃO é reescrito aqui, e esta linha já foi escrita
         errada uma vez: o rótulo inicial tinha perdido o "ladrilho 7/16" (ver o
         bloco SEM NÚMERO NENHUM acima) e este callback continuava repondo-o a
         cada quadrilátero, então a frase voltava sozinha meio segundo depois de
         a captura começar. Remover o número de UM dos dois lugares é não
         remover o número.

         O pedido é literal e vale para os dois: *"eu não quero esse texto, é
         muito técnico, quero nomenclaturas mais comuns"*. Um ladrilho é um
         detalhe de COMO a imagem é feita; quem está esperando quer saber se
         falta muito, e quem responde isso é a barra. */
      onTile: (done, total) => shotPillProgress(done, total),
    });
    /* A extensão sai do FUNDO antes do preset, pela mesma razão do rótulo: um
       recorte é PNG mesmo em Baixa, e um arquivo `.webp` com bytes de PNG
       dentro é um arquivo que alguns programas simplesmente não abrem. */
    const ext = shot.background === 'recorte' ? 'png' : CAPTURE_PRESETS[shot.quality].ext;
    downloadBlob(shot.blob, captureFilename(shot.width, shot.height, ext));
    setStatus(`Imagem salva · ${shot.width} × ${shot.height}`
      + (shot.background === 'recorte' ? ' · recorte' : '')
      + (shot.tiles > 1 ? ` · ${shot.tiles} ladrilhos` : '')
      + (shot.degraded ? ` · ${shot.degraded}` : ''));
  } catch (err: unknown) {
    console.error('[truck-studio] captura falhou', err);
    setStatus('Não foi possível gerar a imagem: '
      + (err instanceof Error ? err.message : String(err)));
  } finally {
    pill.classList.add('hidden');
    /* Devolve o rótulo genérico: a próxima captura reescreve antes de mostrar,
       mas um "ladrilho 16/16" congelado no DOM seria um estado velho esperando
       para reaparecer. Mesmo motivo para a barra voltar a zero. */
    shotPillText('Gerando imagem…');
    shotPillProgress(0, 1);
    btn.disabled = false;
    capturing = false;
  }
}

/* ---------------- GRAVAR VÍDEO ----------------
   A UI da coisa; o trabalho está em scene/record.ts, que abre explicando por que
   um vídeo não pode sair de um render target como a imagem sai.

   O PAINEL É O MESMO COMPONENTE DA CÂMERA — mesma fábrica, mesmas classes — e
   isso é a decisão de desenho deste bloco: "levar a cena embora" é uma coisa só
   com duas saídas, e um segundo vocabulário de interface para a segunda saída
   faria o usuário aprender duas vezes o que já sabe. Duas perguntas e um botão
   que age, exatamente como lá.

   AS DUAS PERGUNTAS, e por que são estas:
   · MODO. É a única escolha que muda o que o vídeo É, e são TRÊS respostas.
     "Cinemático" é a câmera passeando por pontos escolhidos, com aproximações e
     desacelerações — o vídeo que se manda para o cliente, e o único dos três que
     nenhuma mão consegue reproduzir. "Volta completa" é o giro que fecha o laço:
     roda em repetição sem emenda, e é o material de catálogo. "Livre" é o
     oposto dos dois: o usuário conduz.
   · TAMANHO. Fica DEPOIS do modo porque é a pergunta técnica, e porque a
     resposta padrão ("Da tela") é a certa para quase todo mundo.

   A DURAÇÃO NÃO É UMA TERCEIRA PERGUNTA, e isso é deliberado. Na volta ela é
   derivada (o giro tem período, e o período é a duração); no cinemático ela é a
   soma dos planos, que quem desenhou o percurso já decidiu; no livre é o usuário
   que decide, apertando "Parar". Um campo de segundos seria um número para
   escolher em vez de uma coisa para fazer — e cada modo já mostra a sua ao lado
   do nome.

   E OS QUADROS POR SEGUNDO TAMBÉM NÃO SÃO, agora por um motivo mais forte: não
   há o que escolher. O gravador passou a desenhar os quadros um a um, com um
   relógio virtual, e a carimbá-los a 60 fps — então 60 é o que sai, em qualquer
   máquina, e um seletor só ofereceria à pessoa a chance de piorar o próprio
   vídeo. O que a interface tem de fazer com esse número é PROMETÊ-LO (a nota no
   fim do painel) e ser honesta nos DOIS desfechos em que o arquivo não é o
   esperado — que já foram um só, e viraram dois quando o codificador virou uma
   cadeia sondada por capacidade:

   1. TEMPO REAL (`RecordResult.realtime`). A máquina não codifica NENHUM dos
      formatos da cadeia fora do tempo real; o vídeo sai no ritmo dela e pode
      engasgar. É o único caso em que os 60 fps não valem.
   2. OUTRO CONTÊINER (`RecordResult.ext !== 'mp4'`). A máquina não codifica
      H.264, a cadeia caiu em VP9 ou AV1 e o arquivo saiu WebM. Os 60 fps VALEM
      inteiros — o que muda é para onde o arquivo pode ir sem conversão.

   ⚠️ Nenhum dos dois é "o navegador tal": os dois são CAPACIDADE da máquina, e o
   texto tem de dizer isso. O Firefox do dono grava H.264 por hardware e pega o
   caminho bom. Ver `recResultBanner()`. */

const REC_MODE_KEY = 'truckstudio.record.mode.v1';
const REC_RES_KEY = 'truckstudio.record.res.v1';

/* O andaime que existia aqui foi RECOLHIDO em 2026-08-15: `RecordMode` já lista
   os três modos em `scene/record.ts`, então a união local e a conversão no
   `runRecord()` viraram ruído e saíram. */

/* A ORDEM É A DO VALOR PARA QUEM USA, e não a da idade de cada modo. O percurso
   é o único que produz um vídeo que mais ninguém tem, então ele abre a lista; o
   cinemático é o pronto-para-mandar; a volta é o giro de catálogo.
   O PADRÃO CONTINUA SENDO A VOLTA, e isso é deliberado: quem já escolheu tem a
   escolha guardada, e mudar o padrão por baixo de quem nunca abriu o painel
   trocaria o vídeo que ele espera receber. */
const REC_MODE_ORDER: RecordMode[] = ['percurso', 'volta'];
const REC_RES_ORDER: RecordResolution[] = ['viewport', '1080p', '1440p'];

const REC_MODE_LABEL: Record<RecordMode, string> = {
  percurso: 'Percurso próprio',
  volta: 'Volta completa',
};
/* Sem jargão de câmera. "Dolly", "easing" e "keyframe" são palavras de quem
   edita vídeo; quem abre este painel quer saber o que vai receber. ("Plano"
   fica: é a palavra que o percurso usa, e é ela que aparece na cortina durante
   a espera.)

   ⚠️ E NADA DE "APROXIMA" NO CINEMÁTICO. O zoom dele é de LENTE — a abertura
   fecha de 30° para 13° —, e não de aproximação: `controls.minDistance` é um
   raio inteiro do conjunto e a câmera é expulsa da caixa do veículo dentro do
   próprio quadro, então chegar perto é mecanicamente impossível nesta cena. O
   RESULTADO para quem assiste é o mesmo (o enquadramento sai de ~21 m de largura
   para ~7 m), mas prometer "aproximação" é prometer um movimento que o vídeo não
   tem — e a primeira pessoa a comparar as duas coisas encontra a diferença. */
/* ⚠️ E A FRASE DO PERCURSO NÃO DIZ "GRAVE ENQUANTO GIRA", que era o que a do
   modo `livre` prometia. O modo mudou de natureza: nada é gravado enquanto o
   usuário mexe na câmera — ele MARCA pontos, e a máquina passa por eles. Uma
   frase herdada do modo antigo faria a pessoa procurar um botão de gravar que
   não existe mais. */
const REC_MODE_BLURB: Record<RecordMode, string> = {
  percurso: 'Você marca os pontos e o tempo entre eles; a câmera passa por todos '
    + 'numa curva lisa. Tem prévia antes de gravar.',
  volta: 'Uma volta inteira que fecha o laço, sem emenda. É o giro de catálogo.',
};
const REC_RES_LABEL: Record<RecordResolution, string> = {
  viewport: 'Da tela',
  '1080p': '1080p',
  '1440p': '1440p',
};

/** Segundos de uma volta. Ver a nota do painel: não é uma pergunta, é um padrão. */
const REC_LAP_SECONDS = 18;

/* Os quadros por segundo PEDIDOS, e o número mora aqui porque esta interface o
   PROMETE por escrito. `RecordOptions.fps` já tem 60 como padrão; passá-lo assim
   mesmo é o que faz a promessa da tela e o pedido ao gravador serem o mesmo
   número — um padrão que mudasse do outro lado deixaria a nota mentindo em
   silêncio. É também com ele que a pílula converte "quadro 412 de 1.080" em
   segundos de vídeo, que é a metade da leitura que o usuário mais precisa. */
const REC_FPS = 60;

/* ⚠️ UMA SONDAGEM QUE ADIANTA, E A AUTORIDADE NÃO É ELA.
   `hasWebCodecs()` é síncrona de propósito — está escrito no cabeçalho dela, em
   scene/record-encoder.ts: existe para a interface poder decidir antes de
   qualquer promessa. Serve para AVISAR ANTES DO CLIQUE, porque numa máquina sem
   ela as duas coisas que este painel promete mudam de figura: os 60 fps e a
   espera longa.
   Mas ela é só o PORTÃO da API, não a resposta. A decisão de verdade passa por
   `pickOfflineCodec()`, que percorre a cadeia (avc/MP4 → vp9/WebM → av1/WebM)
   perguntando a cada uma se este tamanho e esta taxa cabem — e essa é assíncrona
   e não cabe na pintura de um painel. Duas coisas, portanto, só se sabem depois:
   SE o vídeo saiu do laço offline e EM QUE contêiner ele saiu. As duas vêm no
   resultado (`realtime` e `ext`) e as duas aparecem no aviso de fim; se a
   sondagem daqui e o resultado discordarem, quem fica na tela é o resultado. */
const offlineLikely = () => hasWebCodecs();

function readRecMode(): RecordMode {
  try {
    const v = localStorage.getItem(REC_MODE_KEY);
    if (v && (REC_MODE_ORDER as string[]).includes(v)) return v as RecordMode;
    /* ⚠️ O `livre` GUARDADO VIRA `percurso`, e isso não é compatibilidade
       cega — é a leitura certa da INTENÇÃO. Quem tinha o livre escolhido queria
       conduzir a câmera; o percurso é essa mesma vontade, feita direito. Sem
       esta linha ele cairia no padrão e receberia uma volta de catálogo sem
       nada explicando por quê, na primeira vez que abrisse o painel depois da
       atualização. */
    /* E o `cinematica` também: ele era um percurso autorado com a decupagem
       cravada no código, e quem o tinha escolhido queria justamente um filme
       com movimento de câmera — que é o que o criador entrega, agora com os
       pontos na mão de quem grava. */
    if (v === 'livre' || v === 'cinematica') return 'percurso';
  } catch { /* modo privado — o padrão serve */ }
  return 'volta';
}
function readRecRes(): RecordResolution {
  try {
    const v = localStorage.getItem(REC_RES_KEY);
    if (v && (REC_RES_ORDER as string[]).includes(v)) return v as RecordResolution;
  } catch { /* modo privado — o padrão serve */ }
  return 'viewport';
}

let recMode: RecordMode = readRecMode();
let recRes: RecordResolution = readRecRes();

function writeRecMode(v: RecordMode) {
  recMode = v;
  try { localStorage.setItem(REC_MODE_KEY, v); } catch { /* vale para a sessão */ }
}

function writeRecRes(v: RecordResolution) {
  recRes = v;
  try { localStorage.setItem(REC_RES_KEY, v); } catch { /* vale para a sessão */ }
}

/** Um segmento de pastilhas — o mesmo desenho do "Fundo" do painel da câmera. */
function segment<T extends string>(
  opts: { values: T[]; current: T; label: Record<T, string>; group: string;
          onPick: (v: T) => void; title?: Record<T, string> },
): HTMLElement {
  const seg = el('div', 'ts-shotseg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', opts.group);
  for (const v of opts.values) {
    const on = v === opts.current;
    const btn = el('button', 'ts-shotseg__btn' + (on ? ' is-on' : ''), opts.label[v]);
    btn.type = 'button';
    btn.dataset.v = v;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    const hint = opts.title?.[v];
    if (hint) {
      btn.title = hint;
      btn.setAttribute('aria-label', `${opts.label[v]} — ${hint}`);
    }
    btn.addEventListener('click', () => opts.onPick(v));
    seg.appendChild(btn);
  }
  return seg;
}

/* ---- a duração que cada modo promete, à direita do nome ----
   O mesmo lugar em que o menu da câmera põe a resolução do preset: é o número
   que torna a escolha informada. No cinemático são DOIS números, e o primeiro é
   o que responde "que tipo de vídeo é esse": seis planos não é a mesma coisa que
   vinte e quatro segundos de uma tomada só. Os dois saem de `record.ts`, nunca
   de uma constante daqui — é lá que o percurso é desenhado. */
function recModeDuration(m: RecordMode): string {
  if (m === 'volta') return `~${REC_LAP_SECONDS} s`;
  /* O ÚNICO DOS DOIS CUJA DURAÇÃO É UM FATO E NÃO UM PADRÃO — ela é a soma dos
     tempos que o usuário escolheu. Com o percurso vazio o lugar do número diz o
     que falta, que é mais útil do que "0 s". */
  const n = timelineCount();
  if (n < 2) return n === 0 ? 'a montar' : '1 ponto';
  return `${n} pontos · ${Math.round(timelineDuration() * 10) / 10} s`;
}

function paintRecordMenu(panel: HTMLElement): HTMLButtonElement[] {
  panel.textContent = '';

  const modeHead = el('div', 'ts-shotmenu__head', 'Modo');
  modeHead.setAttribute('aria-hidden', 'true');
  panel.appendChild(modeHead);

  /* ---- O MODO DEIXOU DE SER UM SEGMENTO DE PASTILHAS ----
     Com dois modos, um segmento cabia e bastava: os rótulos eram curtos e a
     diferença entre eles morava numa nota embaixo. Com TRÊS não cabe nem serve.
     Não cabe porque "Volta completa" já era o motivo de este painel ser mais
     largo que o da câmera (ver `--ts-recmenu-w` em core/studio.css) e um terceiro
     terço quebraria os rótulos em duas linhas de alturas diferentes; e não serve
     porque a pergunta virou outra — não é mais "qual das duas", é "que tipo de
     vídeo eu quero", e essa se responde lendo uma frase por opção.
     Então: as MESMAS linhas do menu de qualidade (`.ts-shotmenu__item`), com
     nome, duração à direita e uma frase embaixo. Um vocabulário a menos para o
     usuário aprender e um componente a menos para manter. */
  const modeGroup = el('div', 'ts-shotmenu__radios');
  modeGroup.setAttribute('role', 'radiogroup');
  modeGroup.setAttribute('aria-label', 'Modo de gravação');
  panel.appendChild(modeGroup);

  const modeItems: HTMLButtonElement[] = [];
  for (const m of REC_MODE_ORDER) {
    const on = m === recMode;
    const item = el('button', 'ts-shotmenu__item' + (on ? ' is-on' : ''));
    item.type = 'button';
    item.dataset.m = m;
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', on ? 'true' : 'false');

    const row = el('span', 'ts-shotmenu__row');
    row.appendChild(el('span', 'ts-shotmenu__name', REC_MODE_LABEL[m]));
    const dur = recModeDuration(m);
    if (dur) row.appendChild(el('span', 'ts-shotmenu__dim', dur));
    item.appendChild(row);
    item.appendChild(el('span', 'ts-shotmenu__hint', REC_MODE_BLURB[m]));
    /* O leitor de tela lê a LINHA, não a composição visual das três partes. */
    item.setAttribute('aria-label',
      `${REC_MODE_LABEL[m]}${dur ? ', ' + dur : ''}. ${REC_MODE_BLURB[m]}`);

    /* Repinta o painel INTEIRO — a nota abaixo descreve o modo escolhido, e uma
       lista que mudasse sozinha a deixaria falando do outro. Mesma regra do
       "Fundo" da câmera, e pelo mesmo motivo o painel NÃO fecha. */
    item.addEventListener('click', () => {
      writeRecMode(m);
      recPop?.repaint();
      panel.querySelector<HTMLButtonElement>(`.ts-shotmenu__item[data-m="${m}"]`)?.focus();
    });
    modeGroup.appendChild(item);
    modeItems.push(item);
  }

  /* A nota diz o que vai acontecer AGORA, com o número que o usuário não
     precisou digitar.

     ⚠️ NO CINEMÁTICO ELA CARREGA UMA EXPECTATIVA, e é de propósito que a frase
     não soa como aviso. O desvio das construções fica SUSPENSO durante o filme —
     um percurso autorado não pode ser corrigido por baixo, senão a câmera treme
     no meio de um plano —, e a consequência honesta é que num pátio apertado ela
     pode passar raspando por uma parede. Dito antes, é uma característica do
     modo; descoberto no vídeo, é um defeito. */
  panel.appendChild(el('span', 'ts-recnote',
    recMode === 'volta'
      ? `Uma volta em ~${REC_LAP_SECONDS} s, começando de onde a câmera está.`
      : 'O criador abre sobre a cena e recolhe o resto da interface. Marque os '
        + 'pontos com a câmera, veja a prévia, grave.'));

  const resHead = el('div', 'ts-shotmenu__head', 'Tamanho');
  resHead.setAttribute('aria-hidden', 'true');
  panel.appendChild(resHead);
  panel.appendChild(segment<RecordResolution>({
    values: REC_RES_ORDER, current: recRes, label: REC_RES_LABEL,
    group: 'Tamanho do vídeo',
    title: {
      viewport: 'Grava exatamente o que está na tela, sem mexer em nada',
      '1080p': 'Força 1920 × 1080 — a cena aparece com tarja enquanto o vídeo é feito',
      '1440p': 'Força 2560 × 1440 — a cena aparece com tarja enquanto o vídeo é feito',
    },
    onPick: (v) => {
      writeRecRes(v);
      recPop?.repaint();
      panel.querySelector<HTMLButtonElement>(`.ts-shotseg__btn[data-v="${v}"]`)?.focus();
    },
  }));
  /* O AVISO DA TARJA É OBRIGATÓRIO, e é o oposto da doutrina de capture.ts: lá a
     imagem grande sai de um render target e a tela nunca muda. Aqui o
     `captureStream` lê o canvas composto, então forçar 1080p FORÇA O CANVAS
     VISÍVEL — e um viewport que muda de proporção sozinho, sem aviso, lê como
     defeito. Ver o cabeçalho de scene/record.ts. */
  if (recRes !== 'viewport') {
    panel.appendChild(el('span', 'ts-recnote',
      'A cena fica com tarja enquanto o vídeo é feito — o vídeo sai inteiro.'));
  }

  /* ---- A ESPERA É DITA ANTES, E NÃO SÓ QUANDO ELA CHEGA ----
     O gravador desenha os quadros um a um em vez de capturar a tela ao vivo: é
     isso que faz o vídeo sair liso a 60 fps em qualquer máquina, e é isso que
     torna a espera bem MAIOR que a duração do arquivo — quatro minutos de
     relógio para dezoito segundos de vídeo é um resultado normal aqui. Uma
     pessoa que descobre isso só depois de clicar acha que a ferramenta travou;
     uma que leu antes reconhece o preço que ela mesma aceitou pagar.
     A frase fica junto do botão que age, que é onde ela ainda é decisão. */
  const offline = offlineLikely();
  panel.appendChild(el('span', 'ts-recnote' + (offline ? '' : ' ts-recnote--warn'),
    offline
      ? 'O vídeo sai a 60 fps, liso. Ele é desenhado quadro a quadro depois da '
        + 'gravação, então a espera costuma ser bem maior que a duração do vídeo '
        + '— a barra mostra quanto falta e dá para cancelar.'
      /* ⚠️ SEM NOMEAR NAVEGADOR. A frase anterior dizia "em Chrome ou Edge
         atualizados", e isso é falso na máquina do dono — Firefox com H.264 por
         hardware, que pega o caminho bom. O que falta aqui é uma API, e é disso
         que a frase fala. */
      : 'Este navegador não tem o codificador que desenha quadro a quadro: o '
        + 'vídeo vai ser gravado em tempo real, sai mais rápido e pode engasgar '
        + 'nos trechos pesados. Num navegador atualizado ele sai liso, a 60 fps.'));

  /* ---- o botão que AGE, e no percurso ele age em OUTRA coisa ----
     ⚠️ UM CAMINHO, E NÃO DOIS. A tentação é oferecer "Gravar vídeo" aqui também
     quando já existem pontos marcados — o percurso está pronto, por que fazer o
     usuário abrir uma tela para clicar no botão que ele acabou de ver? Porque a
     gravação do percurso é a última etapa de um trabalho que acontece LÁ: quem
     grava sem abrir o criador não confere a prévia, não vê os tempos e não sabe
     de qual das três versões que ele montou hoje o percurso é. Dois botões
     "gravar" em duas telas também seriam dois lugares para desabilitar, dois
     para explicar por que está desabilitado, e duas chances de discordarem.
     Aqui: ENTRAR. Lá: gravar. */
  const go = el('button', 'ts-shotgo');
  go.type = 'button';
  const ico = el('span', 'ts-shotgo__ico');
  ico.setAttribute('aria-hidden', 'true');
  const isPath = recMode === 'percurso';
  /* O MESMO ícone do botão da régua, pelo mesmo motivo da câmera: é aquela ação
     sendo confirmada, não uma ação nova. No percurso o ícone é outro porque a
     ação é outra — uma tira de linha do tempo, não uma câmera. */
  ico.innerHTML = isPath
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"'
      + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
      + ' stroke-linejoin="round" focusable="false">'
      + '<path d="M3 12h18"/><circle cx="6.5" cy="12" r="2.1"/>'
      + '<circle cx="12" cy="12" r="2.1"/><circle cx="17.5" cy="12" r="2.1"/>'
      + '<path d="M3 6.5h18M3 17.5h18" opacity=".45"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"'
      + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
      + ' stroke-linejoin="round" focusable="false">'
      + '<rect x="2.8" y="6.6" width="12.4" height="10.8" rx="2"/>'
      + '<path d="M15.2 10.6l4.4-2.7a.7.7 0 0 1 1.1.6v7a.7.7 0 0 1-1.1.6l-4.4-2.7Z"/></svg>';
  go.appendChild(ico);
  go.appendChild(el('span', undefined,
    !isPath ? 'Gravar vídeo'
      : isTimelineOpen() ? 'Voltar ao criador'
        : timelineCount() ? 'Continuar o percurso'
          : 'Abrir o criador de vídeo'));
  go.addEventListener('click', () => {
    recPop?.close(true);
    if (isPath) openTimeline();
    else void runRecord();
  });
  panel.appendChild(go);

  /* Só os RÁDIOS entram na navegação por setas — as três linhas de modo e as três
     pastilhas de tamanho, nessa ordem, que é a de leitura. O botão que age fica
     de fora de propósito: ele é alcançado por Tab, e incluí-lo num percurso
     circular de rádios faria a seta para baixo, no último rádio, disparar a
     gravação. */
  return [...modeItems,
    ...panel.querySelectorAll<HTMLButtonElement>('.ts-shotseg__btn')];
}

function buildRecordMenu() {
  const btn = $<HTMLButtonElement>('btn-rec');
  /* Sem `MediaRecorder` ou sem `captureStream` o botão fica com o `.hidden` do
     template. Mesma doutrina de #btn-full: um controle morto na régua é pior do
     que um controle ausente, porque gasta um clique e não tem como explicar por
     quê. (Safari só ganhou `captureStream` em canvas na 15, e há parque abaixo
     disso.) */
  if (!canRecord()) return;
  btn.classList.remove('hidden');
  recPop = makePopover({
    trigger: btn,
    id: 'ts-recmenu',
    groupClass: 'ts-recgroup',
    ariaLabel: 'Opções de gravação',
    paint: paintRecordMenu,
    /* GRAVANDO, ESTE BOTÃO NÃO ABRE O PAINEL — ele para a gravação. O `canOpen`
       recusa a abertura e o `click` abaixo trata o caso, nessa ordem: um painel
       que abrisse por cima de uma gravação em curso ofereceria "Gravar vídeo"
       enquanto um vídeo grava. */
    canOpen: () => !busy(),
  });
  btn.addEventListener('click', () => { if (recording) requestStop(); });
}

/* ================= A PÍLULA: A ESPERA, DESENHADA =================
   ⚠️ ESTA PARTE MUDOU DE NATUREZA. O que estava aqui era um cronômetro de uma
   linha, e bastava: a gravação era em tempo real, então dezoito segundos de
   vídeo custavam dezoito segundos de relógio e não havia nada a explicar.
   Agora o gravador DESENHA os quadros um a um, com um relógio virtual, e os
   carimba a 60 fps — o vídeo sai liso em qualquer máquina, e o preço é uma
   espera que pode ser muito maior que o arquivo. Foi o combinado com o dono do
   produto: *"mesmo que tenha que ter um loading enorme durante a gravação, para
   não travar e sair a 60 fps liso e na qualidade selecionada"*.

   O TRABALHO DESTE BLOCO É FAZER ESSA ESPERA PARECER O PREÇO COMBINADO, E NÃO
   UM TRAVAMENTO. Uma barra que só anda não faz isso. Quatro coisas fazem:

   1. A FASE TEM NOME. "Renderizando o vídeo", com "Quadro 412 de 1.080" ao lado,
      diz o que a máquina está fazendo agora. Uma roda girando não diz nada — e é
      embaixo de uma roda girando que a pessoa desiste e recarrega a página no
      meio de um trabalho de quatro minutos.

   2. DOIS RELÓGIOS, ROTULADOS, NUNCA UM PELO OUTRO. É o defeito clássico desta
      tela. `elapsed` é quanto o USUÁRIO já esperou; `videoSeconds` é quanto de
      VÍDEO já existe. Aqui eles divergem MUITO — quatro minutos de parede
      produzindo dezoito segundos de vídeo é um resultado normal. Trocar um pelo
      outro faz a pessoa concluir ou que o vídeo vai ter quatro minutos (e
      cancelar um vídeo que estava certo) ou que falta pouco (e achar que travou
      quando não acaba). Por isso cada um é uma FRASE com sujeito — "Você
      esperou…" e "Vídeo pronto:…" — e não dois números lado a lado.

   3. ETA SÓ DEPOIS DE HAVER ETA. Um "faltam 4 h" que vira "faltam 40 s" três
      segundos depois queima a barra pelo resto da sessão: a pessoa deixa de
      acreditar em qualquer número que esta tela mostrar. Enquanto o gravador
      não tiver estimativa — ou enquanto a amostra for curta demais para valer —
      o texto é "calculando o tempo que falta…", que é a verdade. Ver `etaText`.

   4. O QUE APARECE ATRÁS NÃO É O VÍDEO — E POR ISSO NÃO APARECE MAIS.
      ⚠️ Aqui havia uma FRASE explicando que a cena girando fora de ordem atrás
      da pílula era o laço offline desenhando, e não o vídeo tocando. O dono
      testou e reprovou: *"o que está sendo visto está todo travado e muito
      estranho, acredito que ficaria melhor um loading como o loading de
      carregando modelo etc"*. Quando o que está na tela LÊ COMO DEFEITO,
      esconder ganha de explicar. Quem esconde é a cortina — ver o bloco
      "A CORTINA, E POR QUE ELA GANHOU DA EXPLICAÇÃO", mais abaixo —, e a
      pílula passou a dividir o trabalho com ela.

   ⚠️ E NADA DISSO PODE CUSTAR CARO. O progresso chega no máximo ~10×/s de
   propósito: durante a renderização o recurso escasso é exatamente a CPU/GPU que
   uma interface animada consumiria. Daí, nesta ordem de importância:
     · nada é MEDIDO — `getBoundingClientRect` não aparece neste arquivo;
     · a barra anda por `transform: scaleX()`, que o compositor resolve sem
       recalcular layout, e não por `width`, que recalcula;
     · a pílula tem LARGURA FIXA no CSS. Sem isso, cada texto novo a
       redimensiona e, como ela é centrada por `translateX(-50%)`, o
       recentramento a faz tremer dez vezes por segundo;
     · todo texto passa por `setText()`, que não escreve o que já está escrito.

   A PÍLULA CONTINUA NÃO ENTRANDO NO VÍDEO — overlay de DOM nunca é composto no
   canvas —, então ela pode dizer o que quiser sem sujar o arquivo. */

function recPill(on: boolean) {
  $('ts-rec').classList.toggle('hidden', !on);
}

/** `83` → `1:23`. Um cronômetro em segundos crus vira aritmética mental. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `6.94` → `6,9 s`. Uma casa fixa: é o número que ANDA, e uma casa que aparece
 *  e some faz a linha inteira dançar mesmo com dígitos tabulares. */
const secs1 = (v: number) => `${v.toFixed(1).replace('.', ',')} s`;

/** `24` → `24 s`, `18.5` → `18,5 s`. Para o número PARADO: um ",0" pendurado num
 *  total que nunca muda é ruído puro. */
const secsShort = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r} s` : `${r.toFixed(1).replace('.', ',')} s`;
};

/** Duração falada, para a linha de estado: "cerca de 3 minutos". */
function roughly(seconds: number): string {
  if (seconds < 45) return 'menos de um minuto';
  const min = Math.round(seconds / 60);
  return `cerca de ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
}

/* ================= AS DUAS LINHAS, E POR QUE SÃO DUAS =================
   ⚠️ AQUI HAVIA QUATRO LINHAS, E O DONO COLOU O TEXTO DA TELA DUAS VEZES — que
   é o sinal de que está prolixo. Era isto:

       Quadro 495 de 1.440
       Você esperou 0:23 · faltam ~0:45
       Vídeo pronto: 8,3 s de 24,0 s — é o que você vai assistir
       Cancelar joga fora os quadros já renderizados.

   Duas saíram por serem muleta e não informação: "é o que você vai assistir"
   existia para desambiguar os dois relógios, e com os rótulos certos ("prontos"
   × "decorridos") ele se desambigua sozinho; e a nota do cancelar virou o
   `title` do próprio botão — ela só importa no instante do clique, e uma frase
   permanente sobre uma ação eventual é peso morto na tela o tempo todo.

   ⚠️ MAS CONDENSAR NÃO É FUNDIR. Os dois relógios continuam em linhas
   SEPARADAS, e é a única coisa desta tela que não pode ser negociada por
   concisão: `videoSeconds` é VÍDEO PRONTO e `elapsed` é ESPERA DE PAREDE, eles
   divergem muito (23 s de relógio para 8,3 s de vídeo) e quem os lê como um só
   ou desiste de um vídeo que estava certo ou acha que travou. O que os separa
   agora é o particípio no fim de cada linha: "prontos" fala do arquivo,
   "decorridos" fala do relógio da parede. */

/** "quadro 495/1440 · 8,3 s de 24 s prontos" — o relógio do VÍDEO. */
function workLine(p: RecordProgress): string {
  const bits: string[] = [];
  /* Sem separador de milhar: "495/1440" é lido de relance, e um ponto ali
     dividiria atenção com a vírgula decimal que vem logo depois, na mesma linha
     ("8,3 s"). Dois separadores diferentes em quatro palavras é o tipo de coisa
     que faz o olho parar para conferir. */
  if (p.frame != null && p.total != null) bits.push(`quadro ${p.frame}/${p.total}`);
  const done = p.videoSeconds ?? (p.frame != null ? p.frame / REC_FPS : null);
  if (done != null) {
    const total = videoTotal(p);
    bits.push(total == null
      ? `${secs1(done)} de vídeo prontos`
      : `${secs1(done)} de ${secsShort(total)} prontos`);
  }
  return bits.join(' · ');
}

/** "0:23 decorridos · faltam ~0:45" — o relógio de PAREDE. */
function wallLine(p: RecordProgress): string {
  /* Sem estimativa no fechamento do arquivo: os quadros acabaram, e a que sobrou
     é a do laço que já terminou. */
  return p.phase === 'finalizando'
    ? `${clock(p.elapsed)} decorridos`
    : `${clock(p.elapsed)} decorridos · ${etaText(p)}`;
}

/** Quantos segundos de vídeo o arquivo vai ter, quando isso é sabido. */
function videoTotal(p: RecordProgress): number | null {
  /* Sai dos QUADROS, que é o número que o gravador conhece de verdade. Os outros
     dois só entram enquanto ele não mandou o total, e só nos modos cuja duração
     é sabida de antemão — o livre não tem uma. */
  if (p.total != null && p.total > 0) return p.total / REC_FPS;
  if (recMode === 'volta') return REC_LAP_SECONDS;
  /* O percurso PASSOU A TER UMA, e é a mudança que o modo `livre` não podia
     fazer: lá a duração só se conhecia quando o usuário apertava "parar", então
     esta função devolvia `null` e a pílula ficava sem o "de 24 s". */
  if (recMode === 'percurso') {
    const d = timelineDuration();
    return d > 0 ? d : null;
  }
  return null;
}

/* Escreve só quando muda. Um `textContent =` invalida o layout do nó mesmo
   quando o texto é idêntico; são seis linhas nesta pílula e dez ticks por
   segundo, e a maioria delas só muda uma vez por segundo (o relógio) ou nunca (a
   nota). O `!==` custa uma comparação de string e evita sessenta invalidações
   por segundo. */
function setText(node: HTMLElement | null | undefined, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}

/** O mesmo, sumindo com a linha quando não há o que dizer nela. */
function setLine(node: HTMLElement | null | undefined, text: string) {
  if (!node) return;
  setText(node, text);
  node.classList.toggle('hidden', text === '');
}

/* ⚠️ ERAM SEIS LINHAS, SÃO TRÊS. A pílula tinha uma linha para cada coisa que a
   renderização precisava dizer — contagem, relógio de parede, relógio de vídeo,
   nota do cancelar. Tudo isso MUDOU DE CASA para dentro da cortina (o dono
   reprovou as duas caixas), e com a renderização fora daqui sobraram os três
   estados em que a pílula é a única superfície: o modo livre gravando, o
   fechamento do arquivo quando não houve cortina, e os avisos de fim. */
interface RecPillParts {
  pill: HTMLElement;
  title: HTMLElement;
  sub: HTMLElement;
  bar: HTMLElement;
  fill: HTMLElement;
  note: HTMLElement;
  stop: HTMLButtonElement | null;
}
let pillParts: RecPillParts | null = null;

/* As linhas novas são INJETADAS AQUI, e não escritas em core/template.ts, pelo
   mesmo motivo de `shotPillBar()`: aquele arquivo é o esqueleto estático do
   estúdio e não é meu. Construído uma vez e guardado — a pílula é o mesmo nó do
   começo ao fim da página.
   TOLERANTE A UM TEMPLATE QUE MUDE: se `#ts-rec-text` ou o botão sumirem, a
   gravação continua funcionando, só fica mais calada. Uma gravação de quatro
   minutos não pode morrer porque alguém renomeou um id. */
function recPillParts(): RecPillParts {
  if (pillParts) return pillParts;

  const pill = $('ts-rec');
  const stop = $opt<HTMLButtonElement>('ts-rec-stop');
  const title = $opt('ts-rec-text') || el('span');

  /* ⚠️ A PÍLULA DEIXA DE SER UMA REGIÃO VIVA, e isto é acessibilidade e não
     descuido. O template a declara `role="status" aria-live="polite"`, o que
     estava certo enquanto ela dizia uma frase por segundo; agora ela muda dez
     vezes por segundo e tem um BOTÃO dentro — uma região viva assim despeja a
     fila inteira no leitor de tela e ainda atrapalha quem tenta alcançar o
     "Cancelar" no meio do despejo.
     O anúncio muda de porta: passa a sair pelo #status, a linha de estado do
     estúdio, que já é `role="status"` + `aria-live="polite"` e já é escondida
     visualmente (`.ts-sr`). E sai só nos momentos que valem — troca de fase e
     cada 25 % —, nunca em `assertive`: interromper a leitura a cada degrau é
     ruído, não informação. */
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Gravação de vídeo');
  pill.setAttribute('aria-live', 'off');

  const body = el('div', 'ts-recbody');
  const sub = el('span', 'ts-recsub');
  const bar = el('div', 'ts-recbar hidden');
  /* `progressbar` com valor em PORCENTO, e não em quadros: 0..100 é o que um
     leitor de tela sabe ler sozinho ("38 por cento"), e a contagem de quadros
     já está escrita por extenso na linha de cima. */
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Progresso da renderização');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '0');
  const fill = el('span', 'ts-recbar__fill');
  bar.appendChild(fill);
  const note = el('span', 'ts-recwhy');

  body.append(title, sub, bar, note);
  /* Antes do botão para a ordem visual ficar ponto → texto → botão, que é a que
     o template já tinha. Sem o botão, vai para o fim. */
  if (stop) pill.insertBefore(body, stop); else pill.appendChild(body);

  pillParts = { pill, title, sub, bar, fill, note, stop };
  return pillParts;
}

const REC_PHASE_TITLE: Record<RecordPhase, string> = {
  preparando: 'Preparando a gravação…',
  gravando: 'Gravando',
  renderizando: 'Renderizando o vídeo',
  finalizando: 'Montando o arquivo…',
};

/* O que o leitor de tela ouve na troca de fase. É outro texto e não o mesmo da
   pílula de propósito: quem ouve não tem as outras cinco linhas à vista, então
   cada anúncio precisa se bastar. */
const REC_PHASE_SPOKEN: Record<RecordPhase, string> = {
  preparando: 'Preparando a gravação.',
  /* ⚠️ ESTA FASE FICOU SÓ PARA O CAMINHO EM TEMPO REAL. A frase anterior dizia
     "gire o caminhão e toque em Parar", que era o modo `livre` falando; hoje a
     cena se move sozinha e o botão só serve para interromper. */
  gravando: 'Gravando em tempo real. A cena está sendo capturada enquanto roda.',
  renderizando: 'Renderizando o vídeo quadro a quadro. '
    + 'A espera é bem maior que a duração do vídeo.',
  finalizando: 'Montando o arquivo do vídeo.',
};

/* ---- estado da pílula, zerado a cada gravação por `recReset()` ---- */
let recPhase: RecordPhase = 'preparando';
let etaSmooth: number | null = null;
let etaVisible = false;
let lastPct = -1;
let lastPhase: RecordPhase | null = null;
let spokenStep = -1;
let bannerTimer: number | undefined;

/* ⚠️ O ETA SÓ APARECE DEPOIS DE UMA AMOSTRA QUE VALHA ALGUMA COISA.
   O gravador já manda `etaSeconds: null` enquanto não tem estimativa, e este é o
   segundo cinto: nos primeiros segundos o denominador é minúsculo (dois quadros
   lentos porque a cena ainda está aquecendo shader) e qualquer conta honesta dá
   um número absurdo. Um "faltam 4 h" que vira "faltam 40 s" três segundos depois
   não é um erro que se corrige sozinho — a pessoa para de acreditar na barra
   pelo resto da sessão, e a barra é a única coisa que segura essa espera.
   Depois de aparecer, o número NÃO VOLTA a "calculando": um rótulo que pisca
   entre um número e uma reticência lê como indecisão. */
const ETA_MIN_ELAPSED = 5;
const ETA_MIN_PROGRESS = 0.03;

function etaText(p: RecordProgress): string {
  const raw = p.etaSeconds;
  const sampled = p.elapsed >= ETA_MIN_ELAPSED && (p.progress ?? 0) >= ETA_MIN_PROGRESS;
  if (raw != null && Number.isFinite(raw) && (etaVisible || sampled)) {
    /* Média móvel exponencial. O número cru salta a cada quadro fora da curva
       (uma troca de aba, uma coleta de lixo, um quadro com chuva), e um restante
       que sobe e desce lê como chute mesmo quando a média está certa. Com 0,25
       ele acompanha uma mudança real de ritmo em ~4 ticks (menos de meio
       segundo) e ignora o solavanco de um. */
    etaSmooth = etaSmooth == null ? raw : etaSmooth + (raw - etaSmooth) * 0.25;
    etaVisible = true;
  }
  if (!etaVisible || etaSmooth == null) return 'calculando o que falta…';
  return `faltam ~${clock(etaSmooth)}`;
}

/* ================= A CORTINA, E POR QUE ELA GANHOU DA EXPLICAÇÃO =================
   ⚠️ ISTO DESFAZ UMA DECISÃO DESTE ARQUIVO, e a decisão desfeita fica escrita
   porque ela é a armadilha.

   O laço offline desenha no CANVAS VISÍVEL — não há outro lugar para desenhar —,
   então durante a renderização a cena gira rápido, fora de ordem, aos saltos. A
   primeira resposta foi TEXTO: uma frase na pílula avisando que aquilo não era o
   vídeo tocando. O dono testou e reprovou: *"o que está sendo visto está todo
   travado e muito estranho, acredito que ficaria melhor um loading como o loading
   de carregando modelo etc"*. Ele está certo, e a lição é geral: quando o que
   está na tela LÊ COMO DEFEITO, esconder ganha de explicar. Ninguém quer ver
   1 080 quadros fora de ordem, nem mesmo entendendo o motivo.

   É A MESMA CORTINA DO CARREGAMENTO DE MODELO (ui/loader.ts), e não uma segunda:
   a referência que o dono deu foi literalmente aquela, e um segundo vocabulário
   de espera faria o estúdio ter dois jeitos de dizer "aguarde".

   ⚠️ ELA NÃO TOCA NO CANVAS, e isto é condição de vida do vídeo. Conferido em
   ui/loader.css: `.ts-load` é `position: absolute; inset: 0` dentro de `root`,
   ou seja FORA DO FLUXO — a caixa de #canvas-holder não muda, o ResizeObserver de
   mountStudio() não dispara e `resize()` não roda. Se ela redimensionasse o
   buffer no meio da gravação, o vídeo morreria ali. E cobrir o canvas também não
   atrapalha a captura: `enc.add()` agarra o pixel na MESMA tarefa em que o quadro
   foi desenhado, antes de qualquer composição (ver o cabeçalho de `renderLoop`
   em scene/record.ts) — o que está por cima na tela é irrelevante para ele.

   ⚠️⚠️ E NUNCA `display: none` NO #canvas-holder NEM NO CANVAS. A ideia é
   tentadora — a cortina é opaca, então "esconder o que ninguém vê" parece de
   graça — e o estrago não aparece no vídeo, aparece DEPOIS DELE: com o holder
   oculto, `clientWidth`/`clientHeight` viram 0 e três funções passam a não fazer
   nada numa guarda de tamanho zero (`resize()`, `applyQualityProfile()` e
   `anchorPaintPixel()`). O estúdio ficaria preso em 1080p, com o floco metálico
   ancorado na resolução do VÍDEO, até alguém recarregar a página — degradado
   para sempre por ter gravado uma vez. Sobrepor e transicionar opacidade é
   seguro; ocultar não é.

   A DIVISÃO DE TRABALHO COM A PÍLULA, que continua no ar por cima da cortina:
     · CORTINA — o que está sendo produzido e o quanto falta: a foto do caminhão,
       o modo, a barra, a porcentagem e UMA linha de fase (o `.ts-load-label` é
       `white-space: nowrap` com reticências, então ela tem de ser curta);
     · PÍLULA — a contagem de quadros, os dois relógios e o CANCELAR. Ela existe
       porque a cortina não tem onde pôr um botão: ui/loader.ts é dono de tudo
       que está sob #ts-loader e não se mexe de fora.
   Nada aparece nos dois lugares. */

/* Só quem levanta a cortina pode baixá-la: `curtainMine` impede que o `finally`
   de uma gravação derrube uma cortina que passou a ser de outro dono (uma
   aplicação fria de studio.ts, por exemplo). */
let curtainMine = false;

/** A foto do caminhão que o crachá já mostra — lida, nunca alterada. */
function badgePhoto(): string | null {
  /* Mesma licença que ui/loader.ts toma com este mesmo crachá ("we measure it
     and never mutate it"): o dono dele é ui/selector.ts. Ler o `src` é o que
     evita um segundo caminho de imagem só para a cortina da gravação — e é o que
     garante que a foto seja EXATAMENTE a do caminhão que está em cena. */
  const img = root.querySelector<HTMLImageElement>('#ts-badge .ts-badge__img');
  if (!img || img.classList.contains('hidden')) return null;
  return img.getAttribute('src') || null;
}

function recCurtainInfo(): LoaderInfo {
  const bits: string[] = [REC_MODE_LABEL[recMode].toLowerCase(), `${REC_FPS} fps`];
  if (recRes !== 'viewport') bits.push(REC_RES_LABEL[recRes]);
  return {
    subject: 'truck',
    /* `captureSubject` é o que studio.ts injeta a cada aplicação — marca, modelo
       e cor. Sem ele a cortina ainda diz o que está fazendo. */
    modelName: captureSubject[0] || 'Gravando o vídeo',
    modelSubtitle: 'Gravando · ' + bits.join(' · '),
    modelImage: badgePhoto(),
    /* SEM `envThumb` de propósito: ele vira um fundo desfocado com um ken-burns
       de 20 s, e uma camada borrada animando o tempo todo disputaria GPU com o
       render que é o único assunto desta tela. O fundo chapado é mais barato e
       mais limpo. */
  };
}

function recCurtain(on: boolean) {
  if (on === curtainMine) return;
  curtainMine = on;
  if (on) showLoader(recCurtainInfo());
  else hideLoader();
}

/** A fase, em uma linha curta — é tudo que `.ts-load-label` comporta. */
function curtainLabel(p: RecordProgress): string {
  /* ⚠️ HAVIA UM NOME DE PLANO AQUI ("Plano 3 de 6 · detalhe"), cruzando o campo
     `shot` do progresso com a lista do modo cinemático. Os dois saíram com o
     modo (2026-08-16). O que o rótulo NÃO pode virar é a contagem de quadros: a
     cortina é `aria-live="polite"`, então tudo que se escreve nela é FALADO, e
     um número que muda dez vezes por segundo transformaria a espera num despejo
     contínuo no leitor de tela. A contagem vive na pílula, que é muda por
     construção. */
  if (p.phase === 'renderizando') {
    /* "Renderizando o vídeo" e não "…, quadro a quadro": a linha logo abaixo diz
       "quadro 495/1440", e repetir a ideia em duas linhas seguidas é o tipo de
       prolixidade que o dono já reprovou uma vez. */
    return REC_PHASE_TITLE.renderizando;
  }
  if (p.phase === 'finalizando') return 'Montando o arquivo…';
  return 'Preparando a gravação…';
}

/**
 * Um tick de progresso — o `RecordTick` que `scene/record.ts` chama.
 *
 * ⚠️ UMA SUPERFÍCIE DE CADA VEZ, e é a regra que este arquivo aprendeu na
 * reprovação: ou a cortina, ou a pílula, nunca as duas. *"não precisa desse
 * segundo loading"*. Quando a cortina está de pé, ela é a tela inteira do que
 * está acontecendo — barra, contadores, relógios e o cancelar — e a pílula
 * simplesmente não existe; quando não está, a pílula é a única coisa que diz
 * que há uma gravação.
 */
function recProgress(p: RecordProgress) {
  recPhase = p.phase;

  const pct = p.progress == null ? null : Math.round(clamp01(p.progress) * 100);

  /* ---- 1. A CORTINA ----
     Sobe nas fases em que a tela mostraria quadros fora de ordem, e SÓ nelas:
     · `renderizando` — sempre. É o laço offline, é o motivo de tudo isto;
     · `preparando` — só quando o vídeo vai mesmo ser renderizado (modo que não é
       o livre E navegador com o codificador offline). No `livre` o preparo é um
       piscar antes de o usuário assumir a câmera, e no caminho em tempo real a
       fase seguinte é o próprio usuário gravando: subir a cortina nos dois seria
       um lampejo de tela cheia sem nada para esconder;
     · `finalizando` — mantém a que já estava de pé, e nunca levanta uma nova. A
       montagem do arquivo é rápida e vem sempre depois de outra fase.
     `gravando` BAIXA a cortina: ali o usuário está orbitando à mão e precisa ver
     a cena — é o oposto exato do problema que a cortina resolve. */
  /* ⚠️ A EXCEÇÃO DO MODO LIVRE SAIU DAQUI, e a saída é a medida do que mudou:
     ela existia porque naquele modo o `preparando` era um piscar antes de o
     USUÁRIO assumir a câmera — subir uma cortina de tela cheia ali seria um
     lampejo sem nada para esconder. Os três modos de hoje entram direto no laço
     offline, então preparo é preparo nos três. */
  recCurtain(
    p.phase === 'renderizando'
    || (p.phase === 'preparando' && offlineLikely())
    || (p.phase === 'finalizando' && curtainMine),
  );
  if (curtainMine) {
    /* ⚠️ A FRAÇÃO DA CORTINA É SÓ A DA RENDERIZAÇÃO, e a armadilha aqui é séria:
       `setLoaderProgress` é MONOTÔNICA por construção (ver o cabeçalho dela).
       O `preparando` também emite fração — é o assentamento do giro, que vai de
       0 a 1 em alguns quadros —, e alimentá-la aqui deixaria a barra CRAVADA em
       100 % durante os minutos de render seguintes, sem nunca poder voltar. Zero
       durante o preparo, portanto; e o zero também serve para segurar o "creep"
       do componente, que inventaria progresso se ninguém reportasse nada. */
    const curtainP = p.phase === 'renderizando' ? clamp01(p.progress ?? 0)
      : p.phase === 'finalizando' ? 1
        : 0;
    setLoaderProgress(curtainP, curtainLabel(p));
    /* As duas linhas e o botão, no encaixe que ui/loader.ts abriu para trabalho
       longo. No `preparando` não há nada contável ainda — só o rótulo de fase e a
       saída, porque poder desistir vale desde o primeiro segundo. */
    setLoaderDetail({
      lines: p.phase === 'preparando' ? [] : [workLine(p), wallLine(p)],
      action: {
        label: 'Cancelar',
        /* O PREÇO DO CLIQUE MORA NO `title`, e não numa linha permanente: ele só
           importa no instante em que a mão está sobre o botão. */
        title: p.phase === 'finalizando'
          ? 'O arquivo já está sendo fechado — não dá mais para cancelar'
          : 'Cancelar e jogar fora os quadros já renderizados',
        /* ⚠️ EM `finalizando` NÃO HÁ MAIS O QUE CANCELAR: os quadros já estão
           todos desenhados e o que corre é o fechamento do arquivo, que dura um
           piscar. Desabilitado é mais honesto que um botão que aceita o clique e
           não faz nada — e que sumir com ele, porque um botão que some leva o
           cursor junto. */
        disabled: p.phase === 'finalizando',
        onClick: requestStop,
      },
    });
  }

  /* ---- 2. A PÍLULA, quando não há cortina ----
     Sobram três estados: o modo livre gravando (o usuário dirige a câmera e
     PRECISA ver a cena), o preparo desse mesmo modo, e o caminho em tempo real,
     que não tem fase de renderização para esconder. */
  recPill(!curtainMine);
  if (!curtainMine) paintRecPill(p, pct);

  /* ---- o que é FALADO ----
     Troca de fase sempre; dentro da renderização, de 25 em 25 %. O passo é
     grosso de propósito: quem ouve não precisa de dez avisos, precisa saber que
     a coisa anda e o que ainda falta. */
  if (p.phase !== lastPhase) {
    lastPhase = p.phase;
    spokenStep = -1;
    const t = p.phase === 'gravando' ? 'Parar a gravação' : 'Cancelar a gravação';
    const btn = $<HTMLButtonElement>('btn-rec');
    btn.title = t;
    btn.setAttribute('aria-label', t);
    /* ⚠️ COM A CORTINA DE PÉ, ELA JÁ É UMA REGIÃO VIVA (`#ts-loader` nasce
       `role="status" aria-live="polite"`) e o rótulo dela É o nome da fase.
       Anunciar de novo por #status faria o leitor de tela dizer duas vezes,
       com palavras ligeiramente diferentes, a mesma transição. */
    if (!curtainMine) setStatus(REC_PHASE_SPOKEN[p.phase]);
  } else if (p.phase === 'renderizando' && pct != null) {
    const step = Math.floor(pct / 25);
    if (step > spokenStep && step > 0 && step < 4) {
      spokenStep = step;
      setStatus(`Renderizando o vídeo, ${step * 25} por cento`
        + (etaVisible && etaSmooth != null ? `. Faltam ${roughly(etaSmooth)}.` : '.'));
    }
  }
}

/**
 * A pílula, nos estados em que ela é a única superfície.
 *
 * Nunca roda com a cortina de pé — quem decide é `recProgress`. O ramo de
 * `renderizando` aqui existe para o caso em que a cortina não subiu (um
 * template sem `#ts-loader`, um dia): melhor uma pílula falando do que uma
 * renderização de quatro minutos sem nada na tela.
 */
function paintRecPill(p: RecordProgress, pct: number | null) {
  const parts = recPillParts();

  let title: string;
  let sub = '';
  let note = '';
  if (p.phase === 'gravando') {
    /* ⚠️ AQUI O RELÓGIO É O DO VÍDEO, e não o de parede: nesta fase os dois
       correm juntos (é tempo real), mas `elapsed` carrega os segundos de
       preparação, em que nada foi gravado ainda.
       ⚠️ E ESTA FASE SÓ EXISTE NO CAMINHO DE RESERVA desde que o modo `livre`
       saiu — é a máquina sem codificador offline gravando a tela enquanto a cena
       roda. Por isso o texto fala de ESPERAR, e não mais de conduzir a câmera:
       não há nada para o usuário fazer aqui. */
    title = pct == null
      ? `Gravando · ${clock(p.videoSeconds ?? p.elapsed)}`
      : `Gravando · ${pct} %`;
    sub = 'A cena está rodando e sendo capturada — não mexa na câmera até o fim.';
  } else if (p.phase === 'renderizando') {
    title = pct == null ? REC_PHASE_TITLE.renderizando : `Renderizando o vídeo · ${pct} %`;
    sub = workLine(p);
    note = wallLine(p);
  } else if (p.phase === 'preparando') {
    title = REC_PHASE_TITLE.preparando;
    sub = 'Ajustando o tamanho e o primeiro quadro.';
  } else {
    title = REC_PHASE_TITLE.finalizando;
    sub = wallLine(p);
  }
  setText(parts.title, title);
  setLine(parts.sub, sub);
  setLine(parts.note, note);

  /* A barra fica escondida em `preparando` MESMO QUANDO ELE MANDA FRAÇÃO: a que
     o gravador emite ali é o assentamento do giro, que vai a 100 % em alguns
     quadros e voltaria do zero na renderização. Uma barra que reinicia é lida
     como trabalho perdido. `aria-valuenow` só é reescrito quando o inteiro muda. */
  if (pct != null && p.phase !== 'preparando') {
    parts.bar.classList.remove('hidden');
    if (pct !== lastPct) {
      lastPct = pct;
      parts.fill.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
      parts.bar.setAttribute('aria-valuenow', String(pct));
    }
  } else {
    parts.bar.classList.add('hidden');
  }

  const s = parts.stop;
  if (s) {
    /* Sem cortina, "parar" só é entrega no modo livre gravando; nas outras fases
       o mesmo botão descarta. Ver "PARAR E CANCELAR NÃO SÃO A MESMA COISA". */
    const keep = p.phase === 'gravando';
    const done = p.phase === 'finalizando';
    setText(s, keep ? 'Parar' : 'Cancelar');
    const hint = done
      ? 'O arquivo já está sendo fechado — não dá mais para cancelar'
      : keep
        ? 'Parar a gravação e montar o vídeo'
        : 'Cancelar e jogar fora os quadros já renderizados';
    if (s.title !== hint) { s.title = hint; s.setAttribute('aria-label', hint); }
    if (s.disabled !== done) s.disabled = done;
  }
}

/* ---------------- o aviso que fica DEPOIS ----------------
   ⚠️ A LINHA DE ESTADO É INVISÍVEL. `setStatus()` escreve em #status, que é
   `.ts-sr` — existe para leitor de tela e mais nada (ver core/template.ts). Isso
   bastava enquanto tudo que ela dizia era redundante com um arquivo que aparecia
   na barra de downloads; não basta mais para as duas coisas que ESTA ferramenta
   tem obrigação de confessar:

   · `realtime` — o navegador não tinha o render offline e o vídeo saiu em tempo
     real, podendo ter engasgado. É o ÚNICO caso em que a promessa dos 60 fps não
     vale, e esconder isso é pior do que nunca ter prometido: a pessoa mostra o
     vídeo travado para um cliente sem saber por quê;
   · `degraded` — a gravação roda no perfil de teto, mas `spotPool` e
     `shadowType` são FRIOS e não podem ser levantados no meio dela (ver o bloco
     do PINO DE TETO em core/quality.ts). Um vídeo feito no nível Baixo sai sem
     os refletores da noite, e o texto que diz isso é a honestidade da ferramenta.

   Então a pílula fica na tela e vira um aviso. Com ressalva ela NÃO some sozinha
   — quem não leu tem de fechar; sem ressalva ela se recolhe em alguns segundos,
   porque "deu certo" não merece um clique. */
type RecTone = 'ok' | 'warn' | 'error';

function recBanner(tone: RecTone, title: string, notes: string[], hold: boolean) {
  const parts = recPillParts();
  clearTimeout(bannerTimer);
  bannerTimer = undefined;

  parts.pill.classList.remove('is-warn', 'is-error');
  parts.pill.classList.add('is-done');
  if (tone !== 'ok') parts.pill.classList.add(tone === 'warn' ? 'is-warn' : 'is-error');

  setText(parts.title, title);
  setLine(parts.sub, notes[0] ?? '');
  setLine(parts.note, notes.slice(1).join(' '));
  parts.bar.classList.add('hidden');

  const s = parts.stop;
  if (s) {
    s.disabled = false;
    setText(s, 'Fechar');
    s.title = 'Fechar o aviso';
    s.setAttribute('aria-label', 'Fechar o aviso');
  }
  recPill(true);
  if (!hold) bannerTimer = window.setTimeout(() => recPill(false), 7000);
}

/** Devolve a pílula ao estado de gravação. Chamado no começo de cada uma. */
function recReset() {
  const parts = recPillParts();
  clearTimeout(bannerTimer);
  bannerTimer = undefined;
  parts.pill.classList.remove('is-done', 'is-warn', 'is-error');
  parts.fill.style.transform = 'scaleX(0)';
  parts.bar.setAttribute('aria-valuenow', '0');
  etaSmooth = null;
  etaVisible = false;
  lastPct = -1;
  lastPhase = null;
  spokenStep = -1;
  recPhase = 'preparando';
}

/* ---------------- PARAR E CANCELAR NÃO SÃO A MESMA COISA ----------------
   E o botão é um só, o que faz da fase a única coisa que os separa.

   No modo livre, durante `gravando`, parar é o jeito NORMAL de terminar: as
   poses que o usuário já conduziu viram vídeo, e é isso que o botão sempre
   prometeu. Em qualquer outra fase não existe vídeo a entregar — existem quadros
   pela metade —, então o mesmo botão DESCARTA. É por isso que ele troca de
   rótulo ("Parar" / "Cancelar") e por isso que o descarte está escrito na
   pílula, à vista, e não só num `title` que só aparece no hover.

   `finalizando` não cancela: ver a nota do botão em `recProgress`. */
let cancelledByUser = false;

function requestStop() {
  if (!recording || recPhase === 'finalizando') return;
  const discard = recPhase !== 'gravando';
  cancelledByUser = discard;
  stopRecording(discard);
}

async function runRecord() {
  if (busy()) return;
  recording = true;
  cancelledByUser = false;

  const btn = $<HTMLButtonElement>('btn-rec');
  const shot = $<HTMLButtonElement>('btn-shot');
  /* O botão da câmera fica DESABILITADO durante a gravação, não escondido: some
     um controle e a régua se reorganiza embaixo do cursor. Ver o bloco OCUPADO
     para por que os dois não podem correr juntos. */
  shot.disabled = true;
  btn.classList.add('on');
  btn.setAttribute('aria-pressed', 'true');

  recReset();
  /* O criador continua na tela atrás da cortina; os dois botões que agem lá
     dentro precisam recusar o clique até isto voltar. */
  timelineRecordingState(true);
  /* O primeiro estado é PINTADO ANTES do primeiro `await`, já dizendo
     "Preparando": a primeira coisa que o gravador faz é trocar o tamanho do
     buffer e pedir um quadro, e isso segura a thread. Sem ele a tela ficaria
     alguns décimos congelada sem nada explicando por quê — que é o começo errado
     para uma espera que a pessoa vai ter de aguentar por minutos.
     Quem decide se isso é a cortina ou a pílula é o próprio `recProgress`; daqui
     não sai mais nenhum `recPill(true)`, senão as duas apareceriam juntas. */
  recProgress({ phase: 'preparando', progress: null, elapsed: 0 });

  /* A pílula sobrevive ao `finally` quando há um aviso para ler; ver `recBanner`. */
  let banner = false;
  try {
    /* UM QUADRO PINTADO ANTES DE COMEÇAR, pela mesma razão que a captura de
       imagem tem o dela (ver `painted()`): a cortina e a pílula acabaram de ser
       postas no DOM, e o gravador vai segurar a thread para trocar o tamanho do
       buffer e assentar o giro. Sem este quadro, o "loading" que anuncia a
       espera só apareceria depois do primeiro pedaço dela.
       DENTRO do `try` de propósito: o `finally` é o que devolve o botão da
       câmera e derruba a cortina, e um `await` fora dele seria um caminho —
       ainda que estreito — de sair daqui com o estúdio travado em "gravando". */
    await painted();

    const video = await recordScene({
      mode: recMode,
      resolution: recRes,
      /* ⚠️ SÓ A VOLTA LÊ ESTE NÚMERO. No `percurso` a duração é a soma dos
         tempos da linha do tempo, e o gravador a busca lá — mandar um número
         daqui seria uma segunda fonte para a mesma verdade, que é como a prévia
         e o arquivo passam a ter durações diferentes. Ver `RecordOptions`. */
      lapSeconds: REC_LAP_SECONDS,
      fps: REC_FPS,
      onTick: recProgress,
    });
    /* Mesmo nome-base da imagem — `captureFilename()` já carrega marca, modelo e
       cor —, com a duração no lugar de nada: quem grava três voltas para
       comparar precisa distinguir os arquivos, e a duração é o que muda. */
    const name = captureFilename(video.width, video.height, video.ext)
      .replace(`.${video.ext}`, `-${Math.round(video.seconds)}s.${video.ext}`);
    downloadBlob(video.blob, name);
    /* A CORTINA SAI PELA PORTA DA FRENTE quando deu certo: `finishLoader()`
       completa a barra até 100 % e dissolve. É a batida que fecha a espera — o
       usuário PRECISA ver a barra chegar ao fim, senão a tela some no meio e
       fica a dúvida de se terminou ou se abortou.
       `flyToBadge: false` porque o voo da foto para o crachá conta uma história
       que não aconteceu aqui: ele significa "este caminhão acabou de ser
       carregado e foi pousar ali", e nada foi carregado. */
    if (curtainMine) {
      curtainMine = false;
      await finishLoader({ flyToBadge: false });
    }
    banner = true;
    recResultBanner(video);
  } catch (err: unknown) {
    /* A CORTINA CAI ANTES DO AVISO, e não junto com ele no `finally`. As duas
       superfícies nunca podem estar na tela ao mesmo tempo — é a regra desta
       rodada —, e um aviso posto sob uma cortina que só some no `finally`
       dependeria de o navegador não pintar entre uma linha e outra. Depende de
       nada: derruba primeiro, fala depois. */
    recCurtain(false);
    if (err instanceof RecordingDiscarded) {
      /* Um descarte tem DUAS origens e elas não se parecem. Pelo botão, é uma
         ação do usuário e merece a confirmação de que nada foi salvo — senão a
         tela some e fica a dúvida de se o arquivo veio ou não. Por saída de
         rota (`unmountStudio` chama `stopRecording(true)`), não há a quem dizer:
         a tela já não está mais na frente dele. */
      if (cancelledByUser) {
        banner = true;
        recBanner('ok', 'Gravação cancelada',
          ['Nada foi salvo — os quadros já renderizados foram descartados.'], false);
      }
      return;
    }
    console.error('[truck-studio] gravação falhou', err);
    banner = true;
    recBanner('error', 'Não foi possível gravar o vídeo', [errText(err)], true);
    setStatus('Não foi possível gravar o vídeo: ' + errText(err));
  } finally {
    /* ⚠️ A CORTINA TEM DE CAIR EM TODO CAMINHO — erro, descarte, saída de rota.
       Uma cortina que fica de pé é o pior estado possível desta tela: ela cobre o
       estúdio inteiro e não tem botão nenhum. `recCurtain(false)` é idempotente e
       só derruba a que É NOSSA (ver `curtainMine`), então uma cortina levantada
       por outro dono no meio disto sobrevive. */
    recCurtain(false);
    if (!banner) recPill(false);
    btn.classList.remove('on');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Gravar vídeo';
    btn.setAttribute('aria-label', 'Gravar um vídeo da cena');
    shot.disabled = false;
    recording = false;
    timelineRecordingState(false);
  }
}

/** O aviso de fim, com as ressalvas do bloco acima. */
function recResultBanner(video: RecordResult) {
  const size = `${video.width} × ${video.height}`;
  const notes: string[] = [];
  let tone: RecTone = 'ok';

  /* ⚠️ O CONTÊINER SAI DO RESULTADO, NUNCA DE UM `.mp4` PRESUMIDO. O codificador
     virou uma CADEIA sondada por capacidade — avc/MP4 → vp9/WebM → av1/WebM →
     reserva em tempo real —, então o formato do arquivo é uma descoberta de
     runtime e não uma promessa deste arquivo. `video.ext` é o contêiner que
     ganhou; escrever "MP4" à mão aqui é a mesma classe de mentira que um arquivo
     WebM chamado `.mp4`, só que dita na tela.

     ⚠️ E O RÓTULO FALA DE CAPACIDADE, NÃO DE NAVEGADOR. "Firefox" não é sinônimo
     de "reserva": a máquina do dono é Firefox com H.264 por hardware e pega o
     caminho bom, em MP4. Quem cai na reserva é a máquina sem codificador para
     NENHUM dos três formatos — e é isso que a frase tem de dizer, senão ela
     acusa o navegador errado na cara de quem está com o vídeo bom na mão.

     A ORDEM É A DA IMPORTÂNCIA, e não a da leitura do objeto: a primeira nota é
     a que o CSS mostra em texto cheio (`.is-warn .ts-recsub`) e as outras saem em
     cinza. Uma ressalva em cinza embaixo de um "60 fps · MP4" brilhante é uma
     confissão escondida atrás de um detalhe técnico. */
  const mp4 = video.ext.toLowerCase() === 'mp4';

  /* `else if`, e não dois `if`: numa máquina sem H.264 e sem WebCodecs os dois
     seriam verdade ao mesmo tempo, e dizer as duas coisas junto confunde. O
     tempo real é o aviso mais grave e fica com o slot de destaque. */
  if (video.realtime) {
    tone = 'warn';
    notes.push('Esta máquina não sabe desenhar o vídeo quadro a quadro, então '
      + 'ele foi gravado em tempo real: pode ter engasgado nos trechos pesados.');
  } else if (!mp4) {
    /* O TERCEIRO DESFECHO, que não existia: offline (60 fps garantidos) mas em
       outro contêiner. Não é uma falha — o vídeo é liso e a promessa dos 60 fps
       vale inteira —, e mesmo assim precisa ser dito, porque o arquivo vai parar
       num WhatsApp ou num PowerPoint que não abrem WebM. Elogio e ressalva na
       mesma frase, nessa ordem. */
    tone = 'warn';
    notes.push(`Saiu em ${video.ext.toUpperCase()}, não em MP4: esta máquina não `
      + `codifica H.264. Os ${video.fps} fps estão garantidos e o vídeo é liso — `
      + 'mas o arquivo não abre direto no WhatsApp nem no PowerPoint. '
      + 'Converta para MP4 antes de mandar adiante.');
  }
  if (video.degraded) {
    tone = 'warn';
    notes.push(`Ressalva: ${video.degraded}.`);
  }
  /* A linha técnica só entra quando NÃO há ressalva. Ela é o "deu tudo certo"
     escrito com números; ao lado de um aviso ela só disputaria a atenção dele.
     E o `fps` sai do RESULTADO: no caminho em tempo real ele é o que foi pedido,
     não o que a máquina entregou — mais um motivo para não aparecer lá. */
  if (tone === 'ok') {
    notes.push(`${video.fps} fps · ${video.ext.toUpperCase()} · o download já começou.`);
  }

  const head = `Vídeo salvo · ${size} · ${clock(video.seconds)}`;
  recBanner(tone, head, notes, tone !== 'ok');
  setStatus(head
    + (video.realtime ? ' · gravado em tempo real, pode ter engasgado'
      : ` · ${video.fps} fps · ${video.ext.toUpperCase()}`)
    + (mp4 || video.realtime ? '' : ' · converta para MP4 antes de postar')
    + (video.degraded ? ` · ${video.degraded}` : ''));
}

export function initUI() {
  bindTopbar();
  /* ⚠️ INJETADO, E NÃO IMPORTADO DOS DOIS LADOS. `ui/timeline.ts` precisa
     disparar a gravação e ler o tamanho escolhido, os dois donos deste arquivo;
     se ele importasse `runRecord` daqui e este importasse `openTimeline` de lá,
     o ciclo fecharia — e um ciclo entre módulos que rodam trabalho na avaliação
     não dá erro claro, dá binding em zona morta no meio do boot. Três funções
     passadas para dentro custam três linhas e nenhuma aresta. */
  initTimeline({
    onRecord: () => {
      /* O criador só grava PERCURSO. Escrever o modo aqui é o que impede o caso
         em que alguém deixou "Volta completa" marcado no painel, abriu o criador
         e recebeu um giro de catálogo depois de montar sete pontos. */
      if (recMode !== 'percurso') { writeRecMode('percurso'); recPop?.repaint(); }
      void runRecord();
    },
    sizeLabel: () => `${REC_RES_LABEL[recRes]} · ${REC_FPS} fps`,
    idle: () => !busy(),
  });
}
