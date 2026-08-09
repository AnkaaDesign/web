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
import { frameAll, controls } from '../scene/scene';
import {
  captureViewport, previewSize, previewTiles, CAPTURE_PRESETS, DEFAULT_QUALITY,
} from '../scene/capture';
import type { CaptureQuality } from '../scene/capture';
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
  $('btn-turn').addEventListener('click', (e) => {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.2;
    const btn = evCurrent(e);
    btn.classList.toggle('on', controls.autoRotate);
    /* O botão declara aria-pressed no template, então ele TEM de acompanhar —
       um toggle que anuncia "não pressionado" enquanto gira é pior do que um
       que não anuncia nada. */
    btn.setAttribute('aria-pressed', controls.autoRotate ? 'true' : 'false');
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
}

/* ---------------- o botão da câmera É o menu ----------------
   ANTES ERA UM BOTÃO DIVIDIDO: a câmera capturava direto com a qualidade
   guardada, e uma setinha de 20px ao lado abria a escolha. O dono do produto
   pediu o contrário, e com razão: *"o botao de screenshot nao deve ter um
   chevron ao lado, ao clicar nele deve abrir o chevron e ao clicar na opcao
   desejada deve tirar o render."*

   O QUE ISSO MUDA NO MODELO: a qualidade deixou de ser um MODO e virou parte da
   AÇÃO. Não existe mais um estado invisível ("em qual preset eu deixei isto?")
   que um clique na câmera gastaria sem perguntar — cada captura é escolhida no
   ato, no mesmo gesto. E o alvo de clique volta a ser um só, do tamanho dos
   outros quatro controles, em vez de um par de 34+20px em que metade fazia uma
   coisa e metade outra.

   O QUE SOBREVIVE DO ESTADO: a última qualidade usada continua sendo gravada em
   `truckstudio.capture.v1` — não para capturar sozinha, mas para o menu abrir
   com ela em foco e marcada. Um menu de três itens que sempre abre no primeiro
   trata quem exportou dezesseis vezes em Alta como se fosse a primeira vez.
   (A chave também é o que `truck-studio-desktop/src/studio/persist.ts` hidrata
   antes de importar o engine — ver o I6 §3. Tirá-la daqui quebraria aquilo.)

   Construído AQUI, imperativamente, e não no template: `core/template.ts` é o
   esqueleto estático do estúdio, e as três linhas do menu carregam a RESOLUÇÃO
   CALCULADA de cada preset — um número que só existe em runtime, porque depende
   da proporção do viewport e do limite da placa. "Alta · 7680 × 4320" é o que
   torna a escolha informada; "Alta" sozinho não é uma escolha, é um adjetivo.

   Um menu e não um <select>: o <select> não desenha três linhas com um
   subtítulo cada, e um estilizado o bastante para isso já é um menu escrito à
   mão com um controle nativo escondido embaixo. */

const QUALITY_KEY = 'truckstudio.capture.v1';
const QUALITY_ORDER: CaptureQuality[] = ['low', 'medium', 'high'];

/* A ÚLTIMA qualidade usada — ver acima: memória do menu, nunca um modo que
   captura sozinho. */
let quality: CaptureQuality = readQuality();
let menuEl: HTMLElement | null = null;
/* Os itens na ordem em que estão na tela, para as setas do teclado. Reconstruído
   a cada abertura junto com o menu. */
let menuItems: HTMLButtonElement[] = [];

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

function menuOpen(): boolean {
  return !!menuEl && !menuEl.classList.contains('hidden');
}

/**
 * Abre o menu e põe o foco no item da última qualidade usada.
 *
 * `paintQualityMenu()` roda A CADA abertura, nunca uma vez só: as resoluções
 * mudam quando a janela muda de tamanho, e um menu que mostrasse os números da
 * abertura anterior mentiria exatamente sobre a coisa que ele existe para dizer.
 */
function openMenu() {
  if (!menuEl || capturing) return;
  paintQualityMenu();
  menuEl.classList.remove('hidden');
  $('btn-shot').setAttribute('aria-expanded', 'true');
  /* Ver a nota de `.has-shotmenu` em core/studio.css: sem isto os cards de
     design (#ts-panels, mesmo z-index e depois na markup) cobrem o menu. */
  $('view-controls').classList.add('has-shotmenu');
  /* O foco entra no menu, não fica no botão: um menu que abre e deixa o teclado
     para trás é um menu que só o mouse consegue usar. */
  (menuItems.find((it) => it.classList.contains('is-on')) || menuItems[0])?.focus();
}

/** @param {boolean} restoreFocus devolver o foco ao botão (Esc, escolha) */
function closeMenu(restoreFocus = false) {
  if (!menuEl) return;
  menuEl.classList.add('hidden');
  $('btn-shot').setAttribute('aria-expanded', 'false');
  $('view-controls').classList.remove('has-shotmenu');
  if (restoreFocus) $<HTMLButtonElement>('btn-shot').focus();
}

function buildQualityMenu() {
  const cluster = $('view-controls');
  const shot = $<HTMLButtonElement>('btn-shot');

  /* O invólucro fica — ele é quem ancora o menu (`position: relative`) —, mas
     agora tem UM filho de controle. O botão da seta que morava aqui foi embora
     com a `.ts-vbtn--caret` de studio.css. */
  const wrap = el('div', 'ts-shotgroup');
  menuEl = el('div', 'ts-shotmenu hidden');
  menuEl.id = 'ts-shotmenu';
  menuEl.setAttribute('role', 'menu');
  menuEl.setAttribute('aria-label', 'Qualidade da imagem');

  shot.replaceWith(wrap);
  wrap.appendChild(shot);
  wrap.appendChild(menuEl);
  cluster.appendChild(wrap);

  /* O botão anuncia que ABRE ALGO. `aria-haspopup="menu"` + `aria-expanded` é o
     que faz um leitor de tela dizer "menu suspenso, recolhido" em vez de
     prometer um download que este clique não faz mais. */
  shot.setAttribute('aria-haspopup', 'menu');
  shot.setAttribute('aria-expanded', 'false');
  shot.setAttribute('aria-controls', 'ts-shotmenu');
  shot.title = 'Baixar imagem — escolher a qualidade';
  shot.setAttribute('aria-label', shot.title);

  shot.addEventListener('click', () => {
    if (menuOpen()) closeMenu();
    else openMenu();
  });
  /* Seta para baixo/cima abrindo o menu já no primeiro/último item é a convenção
     de menu button do APG, e é de graça aqui. */
  shot.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (!menuOpen()) openMenu();
    (e.key === 'ArrowDown' ? menuItems[0] : menuItems[menuItems.length - 1])?.focus();
  });

  /* Fechar ao clicar fora. `capture` para ver o clique antes de qualquer outro
     dono, e o guard `wrap.contains` para o próprio botão não fechar e reabrir no
     mesmo clique. */
  document.addEventListener('pointerdown', (e) => {
    if (!menuOpen()) return;
    if (wrap.contains(e.target as Node)) return;
    closeMenu();
  }, true);
  /* Esc fecha e DEVOLVE O FOCO ao botão — senão o foco fica num nó que acabou de
     virar `display:none` e o teclado volta para o começo do documento. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !menuOpen()) return;
    e.stopPropagation();
    closeMenu(true);
  });
  /* Sair do menu com Tab fecha: um menu aberto atrás do foco é um estado que a
     tela mostra e o teclado já não controla. `focusout` com relatedTarget é o
     único jeito de ver isso sem sondar. */
  wrap.addEventListener('focusout', (e: FocusEvent) => {
    if (!menuOpen()) return;
    const to = e.relatedTarget as Node | null;
    if (to && wrap.contains(to)) return;
    closeMenu();
  });
}

/* Um item por preset. Ele é um BOTÃO DE AÇÃO (`role="menuitem"`), não um rádio:
   clicar não seleciona uma preferência, TIRA A IMAGEM naquela qualidade. O
   `.is-on` marca só qual foi a última — é memória, não estado ligado —, e é por
   isso que ele vem com "último uso" escrito ao lado em vez de um ✓, que leria
   como "esta opção está ativa". */
function paintQualityMenu() {
  if (!menuEl) return;
  menuEl.textContent = '';
  menuItems = [];

  const head = el('div', 'ts-shotmenu__head', 'Qualidade do render');
  head.setAttribute('aria-hidden', 'true');
  menuEl.appendChild(head);

  for (const q of QUALITY_ORDER) {
    const preset = CAPTURE_PRESETS[q];
    const size = previewSize(q);
    const tiles = previewTiles(q);
    const last = q === quality;

    const item = el('button', 'ts-shotmenu__item');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    if (last) item.classList.add('is-on');

    const row = el('span', 'ts-shotmenu__row');
    row.appendChild(el('span', 'ts-shotmenu__name', preset.label));
    row.appendChild(el('span', 'ts-shotmenu__dim', `${size.width} × ${size.height}`));
    item.appendChild(row);
    item.appendChild(el('span', 'ts-shotmenu__hint',
      `${QUALITY_BLURB[q]} · ${preset.ext.toUpperCase()}`
      + (tiles > 1 ? ` · ${tiles} ladrilhos` : '')));
    if (last) item.appendChild(el('span', 'ts-shotmenu__last', 'último uso'));

    /* O nome acessível tem de carregar TUDO: um leitor de tela lê o item, não a
       composição visual das três linhas. */
    item.setAttribute('aria-label',
      `Baixar em ${preset.label}, ${size.width} por ${size.height} pixels. `
      + QUALITY_BLURB[q] + (last ? '. Último uso.' : '.'));

    item.addEventListener('click', () => {
      writeQuality(q);
      closeMenu(true);
      void runCapture(q);
    });
    item.addEventListener('keydown', (e: KeyboardEvent) => onMenuKey(e, item));
    menuEl.appendChild(item);
    menuItems.push(item);
  }
}

/* Setas/Home/End dentro do menu. Enter e Espaço não aparecem aqui porque um
   <button> já os dispara como clique — reimplementá-los daria dois disparos. */
function onMenuKey(e: KeyboardEvent, item: HTMLButtonElement) {
  const i = menuItems.indexOf(item);
  if (i < 0) return;
  let to = -1;
  if (e.key === 'ArrowDown') to = (i + 1) % menuItems.length;
  else if (e.key === 'ArrowUp') to = (i - 1 + menuItems.length) % menuItems.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = menuItems.length - 1;
  else return;
  e.preventDefault();
  menuItems[to]?.focus();
}

/* ---------------- captura em alta resolução ----------------
   A UI da coisa; o trabalho pesado é de scene/capture.ts, que documenta por que
   um toDataURL do canvas visível saía em ~1500x900. Aqui só mora o que é DOM:
   a pílula, o guarda de reentrância e o download. */

/* Um clique de cada vez. captureViewport() para o loop de render e
   redimensiona o buffer; um segundo clique no meio pegaria o renderer já
   remexido e devolveria o estado errado no seu próprio finally. */
let capturing = false;

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
  if (capturing) return;
  capturing = true;

  const btn = $<HTMLButtonElement>('btn-shot');
  const pill = $('ts-shot');
  const preset = CAPTURE_PRESETS[q];
  const target = previewSize(q);
  btn.disabled = true;
  shotPillText(`Gerando imagem · ${preset.label} ${target.width} × ${target.height}…`);
  shotPillProgress(0, previewTiles(q));
  pill.classList.remove('hidden');

  try {
    await painted();
    const shot = await captureViewport({
      quality: q,
      /* O progresso por ladrilho é o que transforma "o estúdio congelou" em
         "faltam nove". Só o modo alto o emite. */
      onTile: (done, total) => {
        shotPillProgress(done, total);
        if (total > 1) {
          shotPillText(`Gerando imagem · ${preset.label} — ladrilho ${done}/${total}`);
        }
      },
    });
    downloadBlob(shot.blob, captureFilename(shot.width, shot.height, CAPTURE_PRESETS[shot.quality].ext));
    setStatus(`Imagem salva · ${shot.width} × ${shot.height}`
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

export function initUI() {
  bindTopbar();
}
