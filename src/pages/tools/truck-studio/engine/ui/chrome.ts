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
import { recordScene, stopRecording, canRecord, RecordingDiscarded } from '../scene/record';
import type { RecordMode, RecordResolution } from '../scene/record';
import { state } from '../vehicle/models';
import { root, $, el, evCurrent } from '../core/dom';

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
     core/template.ts. Ligado aqui, uma vez, porque o nó é estático. */
  $('ts-rec-stop').addEventListener('click', () => stopRecording());
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
   · MODO. É a única escolha que muda o que o vídeo É. "Volta completa" existe
     porque um giro que fecha o laço é o material que serve para apresentação —
     roda em repetição sem emenda —, e ele não sai de uma gravação à mão por
     mais firme que seja o pulso. "Livre" é o oposto: o usuário conduz.
   · TAMANHO. Fica DEPOIS do modo porque é a pergunta técnica, e porque a
     resposta padrão ("O que está na tela") é a certa para quase todo mundo.

   A DURAÇÃO NÃO É UMA TERCEIRA PERGUNTA, e isso é deliberado. No modo volta ela
   é derivada (o giro tem período, e o período é a duração); no modo livre ela é
   o usuário que decide, apertando "Parar". Um campo de segundos seria um número
   para escolher em vez de uma coisa para fazer. */

const REC_MODE_KEY = 'truckstudio.record.mode.v1';
const REC_RES_KEY = 'truckstudio.record.res.v1';
const REC_MODE_ORDER: RecordMode[] = ['volta', 'livre'];
const REC_RES_ORDER: RecordResolution[] = ['viewport', '1080p', '1440p'];

/* "Volta completa" vem PRIMEIRO e é o padrão: é o que este estúdio faz de mais
   útil sozinho, e é o único dos dois que produz um arquivo pronto para mostrar
   sem edição. */
const REC_MODE_LABEL: Record<RecordMode, string> = {
  volta: 'Volta completa',
  livre: 'Livre',
};
const REC_MODE_BLURB: Record<RecordMode, string> = {
  volta: 'O caminhão dá uma volta inteira e o vídeo para sozinho, fechando o laço',
  livre: 'Grava enquanto você gira à mão. Para no botão, ou sozinho em 1 minuto',
};
const REC_RES_LABEL: Record<RecordResolution, string> = {
  viewport: 'Da tela',
  '1080p': '1080p',
  '1440p': '1440p',
};

/** Segundos de uma volta. Ver a nota do painel: não é uma pergunta, é um padrão. */
const REC_LAP_SECONDS = 18;

function readRecMode(): RecordMode {
  try {
    const v = localStorage.getItem(REC_MODE_KEY);
    if (v && (REC_MODE_ORDER as string[]).includes(v)) return v as RecordMode;
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

function paintRecordMenu(panel: HTMLElement): HTMLButtonElement[] {
  panel.textContent = '';

  const modeHead = el('div', 'ts-shotmenu__head', 'Modo');
  modeHead.setAttribute('aria-hidden', 'true');
  panel.appendChild(modeHead);
  panel.appendChild(segment<RecordMode>({
    values: REC_MODE_ORDER, current: recMode, label: REC_MODE_LABEL,
    title: REC_MODE_BLURB, group: 'Modo de gravação',
    /* Repinta o painel INTEIRO — a nota abaixo do segmento descreve o modo
       escolhido, e um segmento que mudasse sozinho a deixaria falando do outro.
       Mesma regra do "Fundo" da câmera, e pelo mesmo motivo o painel não fecha. */
    onPick: (v) => {
      writeRecMode(v);
      recPop?.repaint();
      panel.querySelector<HTMLButtonElement>(`.ts-shotseg__btn[data-v="${v}"]`)?.focus();
    },
  }));
  /* A nota diz o que vai acontecer, com o NÚMERO: "uma volta em ~18 s" é o que
     responde a pergunta que o usuário tem depois de escolher o modo, e é a
     duração que ele não precisou digitar. */
  panel.appendChild(el('span', 'ts-recnote',
    recMode === 'volta'
      ? `Uma volta em ~${REC_LAP_SECONDS} s, começando de onde a câmera está.`
      : 'Você conduz a câmera; o vídeo acompanha. Máximo de 1 minuto.'));

  const resHead = el('div', 'ts-shotmenu__head', 'Tamanho');
  resHead.setAttribute('aria-hidden', 'true');
  panel.appendChild(resHead);
  panel.appendChild(segment<RecordResolution>({
    values: REC_RES_ORDER, current: recRes, label: REC_RES_LABEL,
    group: 'Tamanho do vídeo',
    title: {
      viewport: 'Grava exatamente o que está na tela, sem mexer em nada',
      '1080p': 'Força 1920 × 1080 — a cena aparece com tarja enquanto grava',
      '1440p': 'Força 2560 × 1440 — a cena aparece com tarja enquanto grava',
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
      'A cena fica com tarja durante a gravação — o vídeo sai inteiro.'));
  }

  const go = el('button', 'ts-shotgo');
  go.type = 'button';
  const ico = el('span', 'ts-shotgo__ico');
  ico.setAttribute('aria-hidden', 'true');
  /* O MESMO ícone do botão da régua, pelo mesmo motivo da câmera: é aquela ação
     sendo confirmada, não uma ação nova. */
  ico.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
    + ' stroke-linejoin="round" focusable="false">'
    + '<rect x="2.8" y="6.6" width="12.4" height="10.8" rx="2"/>'
    + '<path d="M15.2 10.6l4.4-2.7a.7.7 0 0 1 1.1.6v7a.7.7 0 0 1-1.1.6l-4.4-2.7Z"/></svg>';
  go.appendChild(ico);
  go.appendChild(el('span', undefined, 'Gravar vídeo'));
  go.addEventListener('click', () => {
    recPop?.close(true);
    void runRecord();
  });
  panel.appendChild(go);

  /* Só as pastilhas entram na navegação por setas. O botão que age fica de fora
     de propósito — ele é alcançado por Tab, e incluí-lo num percurso circular de
     rádios faria a seta para baixo, no último rádio, disparar a gravação. */
  return [...panel.querySelectorAll<HTMLButtonElement>('.ts-shotseg__btn')];
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
  btn.addEventListener('click', () => { if (recording) stopRecording(); });
}

/* A pílula. Ela NÃO entra no vídeo — overlay de DOM nunca é composto no canvas —
   e por isso pode dizer o que quiser sem sujar o arquivo. */
function recPill(on: boolean) {
  $('ts-rec').classList.toggle('hidden', !on);
}

/** `83` → `1:23`. Um cronômetro em segundos crus vira aritmética mental. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function recPillText(elapsed: number, progress: number | null) {
  /* No modo volta o texto diz QUANTO FALTA em porcentagem, e não os segundos
     decorridos: a volta tem fim conhecido, e "72 %" responde "posso esperar?"
     melhor do que "0:13". No livre não há fração honesta — só o relógio. */
  const t = progress === null
    ? `Gravando · ${clock(elapsed)}`
    : `Gravando a volta · ${Math.round(progress * 100)} %`;
  const node = document.getElementById('ts-rec-text');
  if (node) node.textContent = t;
}

async function runRecord() {
  if (busy()) return;
  recording = true;

  const btn = $<HTMLButtonElement>('btn-rec');
  const shot = $<HTMLButtonElement>('btn-shot');
  /* O botão da câmera fica DESABILITADO durante a gravação, não escondido: some
     um controle e a régua se reorganiza embaixo do cursor. Ver o bloco OCUPADO
     para por que os dois não podem correr juntos. */
  shot.disabled = true;
  btn.classList.add('on');
  btn.setAttribute('aria-pressed', 'true');
  btn.title = 'Parar a gravação';
  btn.setAttribute('aria-label', 'Parar a gravação');
  recPillText(0, recMode === 'volta' ? 0 : null);
  recPill(true);
  setStatus('Gravando…');

  try {
    const video = await recordScene({
      mode: recMode,
      resolution: recRes,
      lapSeconds: REC_LAP_SECONDS,
      onTick: recPillText,
    });
    /* Mesmo nome-base da imagem — `captureFilename()` já carrega marca, modelo e
       cor —, com a duração no lugar de nada: quem grava três voltas para
       comparar precisa distinguir os arquivos, e a duração é o que muda. */
    const name = captureFilename(video.width, video.height, video.ext)
      .replace(`.${video.ext}`, `-${Math.round(video.seconds)}s.${video.ext}`);
    downloadBlob(video.blob, name);
    setStatus(`Vídeo salvo · ${video.width} × ${video.height} · ${clock(video.seconds)}`
      + (video.degraded ? ` · ${video.degraded}` : ''));
  } catch (err: unknown) {
    /* Um descarte NÃO é uma falha: é o usuário saindo da rota com uma gravação
       no ar. Nada a baixar e nada a dizer — a linha de estado pertence a uma
       tela que já não está mais na frente dele. */
    if (err instanceof RecordingDiscarded) return;
    console.error('[truck-studio] gravação falhou', err);
    setStatus('Não foi possível gravar o vídeo: '
      + (err instanceof Error ? err.message : String(err)));
  } finally {
    recPill(false);
    btn.classList.remove('on');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Gravar vídeo';
    btn.setAttribute('aria-label', 'Gravar um vídeo da cena');
    shot.disabled = false;
    recording = false;
  }
}

export function initUI() {
  bindTopbar();
}
