/* A interface do editor de pintura: o modal, a barra, o inspetor contextual, a
   lista de camadas e o mapa do teclado.

   Tudo aqui passa por ../vehicle/livery-doc.ts — nada neste arquivo sabe como
   uma propriedade é serializada, medida ou desfeita.

   ATENÇÃO ao ciclo de importação com ../vehicle/livery.ts: aquele módulo importa
   initLiveryEditor() daqui, e este importa as telas de lá. O corpo DESTE módulo
   não pode tocar em nada de livery.ts durante a avaliação — só dentro de
   funções. É por isso que os elementos abaixo vêm de core/dom (já avaliado) e
   não há nenhuma chamada de topo. */
import * as fabric from 'fabric';
import { $, $$, evTarget, isMounted, root } from '../core/dom';
import {
  surfaces, SURFACE_KEYS, active, activeKey, setActiveKey, otherSide,
  CAPTIONS, SIDE_LABEL, DEFAULT_BG, markDirty, sizeModalCanvas, stagePanels, setStageResizer,
  pxToCm, cmToPx, panelMM, mmPerPx, cabPaintColor, isImplementPainted, getSnapshot,
} from '../vehicle/livery';
import type { SurfaceKey } from '../vehicle/livery';
import {
  FONTS, DEFAULT_FONT, ensureFont, fontLoaded, isText, isImage, stamp, assetOf,
  addImageFile, normalizeTextScale, applyLockState, history, isRestoring, EXTRA,
  align, distribute, withSelectionFlattened, restoreSelection,
  copySurface, sidesMatch, restorePersisted, bindPersistFlush,
} from '../vehicle/livery-doc';
import { initSnapping, setSnapEnabled, drawRulers, resizeSnapLayers } from './livery-guides';
/* O painel de medidas do implemento, no inspetor. Ele NÃO importa
   ../vehicle/livery (o ciclo desta dupla já é um a mais do que se quer), então é
   este arquivo que lhe diz qual face está ativa. */
import { initLiveryMeasures, syncMeasures } from './livery-measures';
/* A CARCAÇA DO THERMO KING é uma PEÇA, não um objeto de desenho: a cor dela vai
   para a demão própria de `vehicle/trim.ts`. Importar daqui não fecha ciclo —
   `trim.ts` fala com `models`/`paint`/`scene` e nunca com `ui/*`. */
import { getTrim, setTrim, setTrimColorLive } from '../vehicle/trim';
import { state as vehicleState } from '../vehicle/models';

type AnyObj = fabric.FabricObject & {
  id?: string | null; name?: string; locked?: boolean; assetId?: string; renamed?: boolean;
};

const modal = () => $('editor-modal');
const isOpen = () => !modal().classList.contains('hidden');
const cm1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

let alignFrame: 'selection' | 'outline' = 'selection';
let zoom: string = 'fit';
/**
 * O FUNDO está selecionado.
 *
 * Ele não é um objeto do fabric — é `canvas.backgroundColor` —, então nenhuma
 * seleção de tela pode representá-lo e `selMode()` nunca o devolveria. Esta
 * bandeira é a seleção dele, e é ela que faz o inspetor mostrar `data-for="bg"`
 * no lugar de `data-for="none"`.
 *
 * Vive fora de `syncInspector()` porque quem a liga é o clique na camada e quem
 * a desliga é QUALQUER seleção de verdade — as duas coisas são exclusivas por
 * construção (selecionar o fundo descarta a seleção do fabric), e é isso que
 * impede o inspetor de mostrar duas respostas ao mesmo tempo.
 */
let bgSelected = false;
/**
 * A camada do THERMO KING está selecionada — só existe na testeira.
 *
 * Mesma natureza de `bgSelected` e pelo mesmo motivo: ele não é um objeto do
 * fabric (é uma PEÇA do produto, com demão própria em vehicle/trim.ts), então
 * nenhuma seleção de tela o produz. As duas bandeiras são exclusivas entre si e
 * com a seleção do fabric — quem liga uma desliga a outra, em `selectBackground`
 * / `selectThermoKing` / `syncInspector`.
 */
let tkSelected = false;
let syncing = false;                       // impede que o inspetor ecoe a própria escrita
let clipboard: Record<string, unknown>[] | null = null;

const zoomFactor = () => (zoom === 'fit' ? 1 : parseFloat(zoom) || 1);
const resize = () => { sizeModalCanvas(activeKey(), zoomFactor()); drawRulers(); };

/* ---------------- ZOOM CONTÍNUO ----------------
   O `<select>` dava cinco degraus (Ajustar, 150, 200, 300, 400 %), e a roda do
   mouse não fazia nada sobre o painel — num baú de 14,7 m em que a arte é
   medida em centímetros, chegar perto era escolher entre 200 % e 300 %.

   `1` É O AJUSTE, não 100 % da chapa: `sizeModalCanvas()` recebe um MULTIPLICADOR
   sobre o enquadramento que já cabe na caixa do palco. Por isso o piso é 1 —
   abaixo dele o painel já está inteiro na tela e sobraria moldura vazia — e o
   teto é 8, que num painel lateral põe a fita 3M de 50 mm em ~14 px de tela. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
/** Passo por "clique" de roda. Exponencial e não aditivo: a percepção de zoom é
 *  multiplicativa, e um passo fixo anda demais perto de 1 e de menos perto de 8. */
const ZOOM_WHEEL_K = 0.0016;

/**
 * Escreve um fator de zoom qualquer e põe o `<select>` em dia.
 *
 * A roda produz valores que não estão na lista, e um `<select>` cujo `value`
 * não casa com nenhuma `<option>` fica com o texto EM BRANCO — o controle
 * pareceria quebrado no meio de um gesto. Então um valor fora da lista ganha uma
 * opção própria, rotulada com a porcentagem; um valor que casa com um degrau
 * reusa o degrau, para o menu continuar dizendo "200 %" quando ele foi escolhido
 * pelo menu.
 */
function setZoomFactor(f: number): number {
  const v = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, f));
  const sel = $<HTMLSelectElement>('stage-zoom');
  const live = () => sel.querySelector<HTMLOptionElement>('option.zoom-live');
  const preset = [...sel.options].find((o) => !o.classList.contains('zoom-live')
    && (o.value === 'fit' ? v <= 1.0005 : Math.abs(parseFloat(o.value) - v) < 0.005));
  if (preset) {
    live()?.remove();
    zoom = preset.value;
    sel.value = preset.value;
  } else {
    let opt = live();
    if (!opt) {
      opt = document.createElement('option');
      opt.className = 'zoom-live';
      sel.appendChild(opt);
    }
    zoom = String(v);
    opt.value = zoom;
    opt.textContent = Math.round(v * 100) + ' %';
    sel.value = zoom;
  }
  resize();
  return v;
}

/**
 * Zoom pela roda, ANCORADO NO CURSOR.
 *
 * Sem a âncora o palco cresce a partir do canto do contêiner de rolagem e o
 * detalhe que a pessoa estava olhando escapa da tela a cada clique de roda — num
 * painel de 14,7 m isso é a diferença entre aproximar e se perder. A conta é a
 * de sempre: o ponto sob o cursor, em coordenadas do CONTEÚDO, tem de continuar
 * sob o cursor depois da escala.
 *
 * SHIFT ROLA NA HORIZONTAL em vez de aproximar, e não é um enfeite: a rolagem
 * vertical nativa foi tomada pelo zoom, e é justamente num painel lateral
 * ampliado que percorrer o comprimento é o gesto mais frequente.
 */
function bindWheelZoom() {
  const stage = $('modal-stage');
  stage.addEventListener('wheel', (e: WheelEvent) => {
    if (!isOpen()) return;
    /* `deltaX` puro é o gesto de trackpad de duas dedos na horizontal — deixa
       passar, é rolagem de verdade. */
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.shiftKey) {
      e.preventDefault();
      stage.scrollLeft += e.deltaY;
      return;
    }
    e.preventDefault();
    const before = zoomFactor();
    const rect = stage.getBoundingClientRect();
    const px = e.clientX - rect.left + stage.scrollLeft;
    const py = e.clientY - rect.top + stage.scrollTop;
    const after = setZoomFactor(before * Math.exp(-e.deltaY * ZOOM_WHEEL_K));
    if (after === before) return;
    const k = after / before;
    stage.scrollLeft = px * k - (e.clientX - rect.left);
    stage.scrollTop = py * k - (e.clientY - rect.top);
  }, { passive: false });
}

/* ---------------- ARRASTAR O PALCO ----------------
   Pedido de 2026-08-13: *"no livery devo ser capaz de pegar e arrastar o
   livery, em caso de dar zoom"*. Ampliar já funcionava (roda ancorada no
   cursor, `bindWheelZoom`); o que faltava era MOVER — a 400 % num painel de
   14,7 m, chegar ao outro logotipo era caçar a barra de rolagem.

   O BOTÃO ESQUERDO SOBRE O PAINEL ARRASTA, e chegar a isso levou duas versões.
   A primeira deixava o esquerdo para o LAÇO DE SELEÇÃO do fabric e oferecia
   espaço, botão do meio e a moldura xadrez. O relato foi *"o drag and drop do
   livery não está funcionando"* — e ele está certo sobre o que importa: quem
   ampliou o painel para 400 % põe o cursor SOBRE o desenho e arrasta, não sobre
   a moldura, e não descobre um atalho de teclado que ninguém mostrou.

   O que decide quem fica com o gesto é O QUE ESTÁ SOB O CURSOR, perguntado ao
   próprio fabric (`findTarget`):

     tem objeto embaixo   → o fabric leva (arrastar o objeto continua igual)
     não tem              → o PALCO leva, e a vista se move
     ⇧ + arrastar         → o fabric leva de qualquer jeito: é o laço de
                            seleção, que assim não se perde
     botão do meio        → o palco, sempre — nem chega ao fabric
     ESPAÇO + arrastar    → o palco, sempre, inclusive por cima de um objeto

   Um CLIQUE sem arrasto no vazio continua selecionando o Fundo — ver `end()`
   abaixo, que é onde essa decisão passou a morar.

   CAPTURA, E NÃO BOLHA. O fabric escuta `pointerdown` no upperCanvasEl; um
   ouvinte de bolha no palco só saberia do gesto depois de o laço de seleção já
   ter começado. Na fase de captura o palco vê primeiro e, quando toma o gesto,
   `stopPropagation()` impede o laço de nascer. */
let panning = false;
/** Quanto o último gesto de palco andou, em pixels. */
let panMoved = 0;
let panId = -1;
let panX = 0, panY = 0;
let panPicked = false;      // o gesto começou no VAZIO do painel?
let spaceHeld = false;

/**
 * O clique caiu sobre o Thermo King do RETRATO desta face?
 *
 * `false` sempre que a resposta não for certa: fora da testeira, sem retrato,
 * sem unidade em cena (ela pode ter sido removida do produto no card de
 * Configurações) ou com o palco ainda sem layout. Errar para "é o Fundo"
 * preserva o comportamento de antes, que é o certo para um alvo de clique.
 *
 * O PALCO É A FOTO INTEIRA — `sizeModalCanvas()` dá ao `.stage-panel` a largura
 * e a altura do retrato e estica a imagem em `100% 100%` sobre ele —, então a
 * fração medida no elemento é a MESMA fração em que `snap.tk` foi publicado.
 * É por isso que não há conversão nenhuma aqui: uma segunda conta divergiria da
 * primeira na primeira medida digitada.
 */
function hitsThermoKing(e: PointerEvent): boolean {
  if (!tkPresent()) return false;
  const rect = getSnapshot(activeKey())?.tk;
  if (!rect) return false;
  const el = stagePanels[activeKey()];
  const r = el?.getBoundingClientRect();
  if (!r || r.width <= 0 || r.height <= 0) return false;
  const nx = (e.clientX - r.left) / r.width;
  const ny = (e.clientY - r.top) / r.height;
  return nx >= rect.x && nx <= rect.x + rect.w && ny >= rect.y && ny <= rect.y + rect.h;
}

function bindStagePan() {
  const stage = $('modal-stage');

  const onPanel = (e: PointerEvent) =>
    !!(e.target as HTMLElement | null)?.closest?.('.stage-panel');

  /* Tem objeto do fabric sob o cursor? `findTarget` é o MESMO caminho que o
     fabric usa para decidir o que arrastar, então perguntar a ele é a única
     forma de as duas decisões não divergirem — um teste próprio erraria em
     objeto girado, em texto com contorno e dentro de uma seleção múltipla.
     Protegido: se uma versão futura do fabric mudar a assinatura, o palco
     devolve o gesto em vez de derrubar o editor. */
  const hitsObject = (e: PointerEvent) => {
    try {
      const c = active() as unknown as { findTarget(ev: PointerEvent): unknown };
      return typeof c.findTarget === 'function' ? !!c.findTarget(e) : true;
    } catch { return true; }
  };

  const takes = (e: PointerEvent) => {
    if (e.button === 1) return true;
    if (e.button !== 0) return false;
    if (spaceHeld) return true;
    if (!onPanel(e)) return true;             // a moldura xadrez não seleciona nada
    if (e.shiftKey) return false;             // ⇧ = laço de seleção, do fabric
    return !hitsObject(e);
  };

  stage.addEventListener('pointerdown', (e: PointerEvent) => {
    panMoved = 0;
    if (!isOpen() || !takes(e)) { panPicked = false; return; }
    panning = true; panId = e.pointerId;
    panX = e.clientX; panY = e.clientY;
    /* Só um gesto que começou no VAZIO DO PAINEL vira "selecionar o Fundo" no
       fim. Um que começou na moldura, ou com o botão do meio, é navegação pura
       e não tem por que mexer na seleção. */
    panPicked = e.button === 0 && onPanel(e);
    /* A CAPTURA É OPCIONAL, e por isso protegida: `setPointerCapture` lança
       `NotFoundError` quando o `pointerId` não é de um ponteiro ativo — o que
       acontece com evento sintético (a bancada) e em alguns caminhos de caneta.
       Sem ela o arrasto ainda funciona enquanto o cursor estiver sobre o palco;
       com a exceção subindo, o gesto morria na entrada. */
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* segue sem captura */ }
    stage.classList.add('is-panning');
    e.stopPropagation();
    e.preventDefault();
  }, { capture: true });

  /* O deslocamento é medido em CLIENTE e não por `movementX`: com captura de
     ponteiro o Firefox zera o `movement*` no primeiro evento depois da captura,
     e o palco dava um pulo no começo de cada arrasto. */
  stage.addEventListener('pointermove', (e: PointerEvent) => {
    if (!panning || e.pointerId !== panId) return;
    const dx = e.clientX - panX, dy = e.clientY - panY;
    panX = e.clientX; panY = e.clientY;
    panMoved += Math.abs(dx) + Math.abs(dy);
    stage.scrollLeft -= dx;
    stage.scrollTop -= dy;
    e.preventDefault();
  }, { capture: true });

  /* ---------------- CLICAR NO CAMINHÃO É SELECIONAR O FUNDO ----------------
     Pedido de 2026-08-13: *"no livery, o background é uma camada, então quando
     clico no truck deve selecionar a camada do background"*.

     MORA AQUI, e não num `click` do palco, porque o palco agora ENGOLE o
     pointerdown do vazio (`stopPropagation` acima). Sem isso o fabric nunca vê
     o gesto, nunca dispara `selection:cleared`, e clicar fora de um objeto
     deixaria a seleção anterior de pé — o defeito seria "não consigo
     desselecionar". Então quem descarta a seleção é este bloco, que é o único
     que sabe que o gesto foi um clique e não um arrasto. */
  const end = (e: PointerEvent) => {
    if (!panning || e.pointerId !== panId) return;
    panning = false; panId = -1;
    try { stage.releasePointerCapture?.(e.pointerId); } catch { /* nunca capturou */ }
    stage.classList.remove('is-panning');
    if (!panPicked || panMoved > 4) return;
    const c = active();
    c.discardActiveObject();
    c.requestRenderAll();
    /* ---- E NA TESTEIRA, O THERMO KING É UMA CAMADA COMO O FUNDO ----
       Relato de 2026-08-16: *"o Thermo King, quando clico nele no livery, não
       seleciona sua camada"*. Ele já É uma linha fixa da lista de camadas (ver
       `thermoKingRow()`), mas o palco não sabia disso: a unidade não é um objeto
       do fabric, é um pedaço da FOTOGRAFIA do baú, e todo clique na foto caía na
       regra "clicar no caminhão seleciona o Fundo".

       O retângulo dele vem do PRÓPRIO retrato (`snap.tk`, projetado pela mesma
       câmera ortográfica que fez a imagem — ver livery-snapshot.ts), então ele
       está em registro com o que o olho vê sem nenhuma segunda conta. */
    if (hitsThermoKing(e)) selectThermoKing();
    else selectBackground();
  };
  stage.addEventListener('pointerup', end, { capture: true });
  stage.addEventListener('pointercancel', end, { capture: true });
  /* O botão do meio abre o menu de colar do Linux e rola em auto-scroll no
     Windows. Nenhum dos dois é o que se pediu. */
  stage.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  /* ESPAÇO. Fora de `bindKeys()` de propósito: lá o `typing` já derrubou o
     evento antes (um espaço dentro de um texto é um espaço), e aqui a guarda
     precisa ser a mesma mas com a resposta oposta — sair sem marcar nada. */
  const typingNow = () => {
    const ao = active().getActiveObject();
    const tag = (document.activeElement as HTMLElement | null)?.tagName || '';
    return !!(ao && (ao as fabric.IText).isEditing) || /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
  };
  const setSpace = (on: boolean) => {
    if (spaceHeld === on) return;
    spaceHeld = on;
    stage.classList.toggle('can-pan', on);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || !isMounted() || !isOpen() || typingNow()) return;
    e.preventDefault();                 // senão a página rola por baixo do modal
    setSpace(true);
  });
  document.addEventListener('keyup', (e) => { if (e.key === ' ') setSpace(false); });
  /* Trocar de aba com o espaço apertado nunca entrega o `keyup`, e o palco
     ficaria em modo de arrasto para sempre. */
  window.addEventListener('blur', () => setSpace(false));
}

const selObjects = () => active().getActiveObjects();

function selMode(objs: fabric.FabricObject[]): 'none' | 'text' | 'image' | 'multi' {
  if (!objs.length) return 'none';
  if (objs.length > 1) return 'multi';
  return isText(objs[0]) ? 'text' : isImage(objs[0]) ? 'image' : 'multi';
}

function syncPanels(objs: fabric.FabricObject[]) {
  /* `bg` SUBSTITUI o modo de seleção, não se soma a ele: com o fundo escolhido
     não há objeto nenhum ativo, e deixar `none` no conjunto mostraria a seção
     "Painel" ("selecione um objeto…") logo acima da cor do fundo — duas
     respostas para a mesma pergunta. */
  const tokens = new Set<string>(
    tkSelected ? ['tk'] : bgSelected ? ['bg'] : [selMode(objs)]);
  if (!bgSelected && !tkSelected && objs.length && objs.every(isText)) tokens.add('text');
  for (const p of $$('#inspector .insp')) {
    const list = (p.dataset.for || '').split(' ');
    p.classList.toggle('hidden', !(list.includes('always') || list.some((t) => tokens.has(t))));
  }
}

/* ---------------- tipografia ---------------- */
function applyToText(fn: (o: fabric.IText) => void, commit = true) {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects().filter(isText) as fabric.IText[];
  if (!objs.length) return;
  for (const o of objs) {
    fn(o);
    o.initDimensions(); o.setCoords(); o.set('dirty', true);
  }
  markDirty(key); c.requestRenderAll();
  if (commit) history.push(key);
}

function applyToAny(fn: (o: fabric.FabricObject) => void, commit = true) {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  for (const o of objs) { fn(o); o.setCoords(); o.set('dirty', true); }
  markDirty(key); c.requestRenderAll();
  if (commit) history.push(key);
}

function buildFontMenu() {
  const menu = $('font-menu');
  menu.innerHTML = '';
  for (const f of FONTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-opt' + (fontLoaded(f.family) ? '' : ' loading');
    b.dataset.family = f.family;
    b.innerHTML = `<b style="font-family:'${f.family}'">Sua marca</b><em>${f.family} · ${f.note}</em>`;
    b.addEventListener('click', async () => {
      await setFontFamily(f.family);
      menu.classList.add('hidden');
    });
    menu.appendChild(b);
  }
  // uma prévia em fonte substituta não serve para nada, então puxa todas de uma vez
  void Promise.all(FONTS.map((f) => ensureFont(f.family))).then(() => {
    for (const el of $$('#font-menu .font-opt')) el.classList.remove('loading');
  });
}

async function setFontFamily(family: string) {
  await ensureFont(family);                            // TEM de vir antes do set,
  applyToText((o) => o.set('fontFamily', family));     // senão o fabric guarda as métricas da substituta
  syncInspector();
}

function bindTypography() {
  buildFontMenu();

  $('font-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    $('font-menu').classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('.font-picker')) $('font-menu').classList.add('hidden');
  });

  $('t-size').addEventListener('change', (e) => {
    const cm = parseFloat(evTarget<HTMLInputElement>(e).value);
    if (!(cm > 0)) return;
    applyToText((o) => o.set('fontSize', cmToPx(cm, activeKey())));
  });

  $('t-weight').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    applyToText((o) => o.set('fontWeight', Number(b.dataset.w)));
    syncInspector();
  });
  $('t-align').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    applyToText((o) => o.set('textAlign', b.dataset.a as string));
    syncInspector();
  });

  const track = $<HTMLInputElement>('t-tracking');
  track.addEventListener('input', () => {
    $('t-tracking-val').textContent = (Number(track.value) / 10).toFixed(1) + ' %';
    applyToText((o) => o.set('charSpacing', Number(track.value)), false);
  });
  track.addEventListener('change', () => history.push(activeKey()));

  const lead = $<HTMLInputElement>('t-leading');
  lead.addEventListener('input', () => {
    $('t-leading-val').textContent = (Number(lead.value) / 100).toFixed(2).replace('.', ',');
    applyToText((o) => o.set('lineHeight', Number(lead.value) / 100), false);
  });
  lead.addEventListener('change', () => history.push(activeKey()));

  $('t-fill').addEventListener('input', (e) => {
    const v = evTarget<HTMLInputElement>(e).value;
    applyToText((o) => o.set('fill', v), false);
  });
  $('t-fill').addEventListener('change', () => history.push(activeKey()));

  $('t-stroke').addEventListener('input', (e) => {
    const v = evTarget<HTMLInputElement>(e).value;
    applyToText((o) => o.set('stroke', v), false);
  });
  $('t-stroke').addEventListener('change', () => history.push(activeKey()));

  $('t-stroke-w').addEventListener('change', (e) => {
    const cm = Math.max(0, parseFloat(evTarget<HTMLInputElement>(e).value) || 0);
    applyToText((o) => o.set({
      strokeWidth: cmToPx(cm, activeKey()),
      // contorno por cima do preenchimento come as letras finas por dentro:
      // pintar o traço PRIMEIRO é o que dá o contorno que se espera
      paintFirst: 'stroke',
      strokeUniform: true,
    }));
  });

  // presets em centímetros, que é a unidade em que uma pintura é encomendada
  const presets = $('t-size-presets');
  for (const cm of [10, 20, 30, 40, 60]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = cm + ' cm';
    b.addEventListener('click', () => applyToText((o) => o.set('fontSize', cmToPx(cm, activeKey()))));
    presets.appendChild(b);
  }
}

/* ---------------- transformar ---------------- */
function bindTransform() {
  const firstRect = () => selObjects()[0]?.getBoundingRect();

  $('tf-x').addEventListener('change', (e) => {
    const r = firstRect(); if (!r) return;
    const d = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'x') - r.left;
    applyToAny((o) => o.setXY(o.getXY().add(new fabric.Point(d, 0))));
    syncInspector();
  });
  $('tf-y').addEventListener('change', (e) => {
    const r = firstRect(); if (!r) return;
    const d = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'y') - r.top;
    applyToAny((o) => o.setXY(o.getXY().add(new fabric.Point(0, d))));
    syncInspector();
  });
  $('tf-w').addEventListener('change', (e) => {
    const r = firstRect(); if (!r?.width) return;
    const target = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'x');
    if (!(target > 0)) return;
    const f = target / r.width;
    applyToAny((o) => o.set({ scaleX: o.scaleX * f, scaleY: o.scaleY * f }));
    syncInspector();
  });
  $('tf-h').addEventListener('change', (e) => {
    const r = firstRect(); if (!r?.height) return;
    const target = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'y');
    if (!(target > 0)) return;
    const f = target / r.height;
    applyToAny((o) => o.set({ scaleX: o.scaleX * f, scaleY: o.scaleY * f }));
    syncInspector();
  });

  const rot = $<HTMLInputElement>('tf-rot');
  rot.addEventListener('input', () => {
    $('tf-rot-val').textContent = rot.value + '°';
    applyToAny((o) => o.rotate(Number(rot.value)), false);
  });
  rot.addEventListener('change', () => history.push(activeKey()));
  $('tf-rot-presets').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!b) return;
    applyToAny((o) => o.rotate(Number(b.dataset.deg)));
    syncInspector();
  });

  $('flip-x').addEventListener('click', () => applyToAny((o) => o.set('flipX', !o.flipX)));
  $('flip-y').addEventListener('click', () => applyToAny((o) => o.set('flipY', !o.flipY)));
}

/* ---------------- imagem ---------------- */
function bindImage() {
  const op = $<HTMLInputElement>('i-opacity');
  op.addEventListener('input', () => {
    $('i-opacity-val').textContent = op.value + ' %';
    applyToAny((o) => o.set('opacity', Number(op.value) / 100), false);
  });
  op.addEventListener('change', () => history.push(activeKey()));

  $('i-reset-aspect').addEventListener('click', () => {
    applyToAny((o) => { if (isImage(o)) o.set('scaleY', o.scaleX); });
    syncInspector();
  });
}

/* ---------------- alinhar / distribuir ---------------- */
function bindAlign() {
  $('align-frame').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    alignFrame = b.dataset.frame as 'selection' | 'outline';
    for (const x of $$('#align-frame .seg-btn')) x.classList.toggle('on', x === b);
    syncInspector();
  });

  $('align-grid').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.icon-btn');
    if (!b) return;
    /* Com um objeto só não existe caixa de seleção a que alinhar — o painel é o
       único quadro que significa alguma coisa, então ele vale independentemente
       do botão. */
    align(b.dataset.align as never, selObjects().length > 1 ? alignFrame : 'outline');
    syncInspector();
  });

  for (const b of $$('[data-dist]')) {
    b.addEventListener('click', () => { distribute(b.dataset.dist as 'x' | 'y'); syncInspector(); });
  }
  for (const b of $$('[data-gap]')) {
    b.addEventListener('click', () => {
      const cm = parseFloat($<HTMLInputElement>('gap-val').value);
      if (!(cm >= 0)) return;
      distribute(b.dataset.gap as 'x' | 'y', cm);
      syncInspector();
    });
  }
}

/* ---------------- camadas ---------------- */
function defaultName(o: fabric.FabricObject): string {
  if (isText(o)) return ((o as fabric.IText).text || '').trim().slice(0, 24) || 'Texto';
  if (isImage(o)) return assetOf((o as AnyObj).assetId)?.name || 'Imagem';
  return 'Objeto';
}

let dragSrcIndex: number | null = null;

/**
 * A CAMADA FIXA DO FUNDO — o pé da lista, em todas as quatro faces.
 *
 * Ela sempre existiu como estado (`canvas.backgroundColor`) e nunca existiu como
 * camada: a única forma de saber que havia um fundo pintado era reparar no campo
 * "Fundo" da barra de ferramentas, entre o zoom e as guias. Uma cor que cobre o
 * painel inteiro e não aparece na lista de camadas é a definição de estado
 * invisível.
 *
 * NO PÉ porque é onde ela está: `getObjects()` vem de baixo para cima e a lista
 * é desenhada invertida, então o último elemento é a camada mais baixa — e não
 * há nada abaixo do fundo. NÃO é arrastável, não renomeia, não tem cadeado e não
 * tem olho: nenhuma dessas quatro operações existe para um `backgroundColor`, e
 * um controle que não faz nada é pior do que a ausência dele. Apagar o fundo é o
 * botão do inspetor, que é onde a cor é escolhida.
 */
function backgroundRow(): HTMLElement {
  const c = active();
  const bg = typeof c.backgroundColor === 'string' ? c.backgroundColor : '';
  const row = document.createElement('div');
  row.className = 'layer-row layer-row--bg' + (bgSelected ? ' on' : '');

  /* Um vão do tamanho do punho de arrasto das outras linhas. Sem ele o ícone do
     fundo ficaria 15 px à esquerda do ícone de todas as outras camadas, e a
     lista leria como duas listas. */
  const pad = document.createElement('span');
  pad.className = 'lyr-grip is-fixed';
  pad.setAttribute('aria-hidden', 'true');

  /* A PASTILHA MOSTRA A COR EFETIVA, não só a própria — a camada Fundo é o que
     o olho vê no painel, e sem cor própria o que ele vê é a chapa. Herdada tem
     desenho próprio (anel tracejado): a cor é a mesma da linha "Cor do cavalo"
     do inspetor, e nada distinguiria "escolhi vermelho" de "estou seguindo o
     vermelho do cavalo" se as duas fossem um quadrado cheio igual. */
  const painted = isImplementPainted();
  const chip = document.createElement('span');
  chip.className = 'lyr-swatch'
    + (bg ? '' : painted ? ' is-inherited' : ' is-empty');
  if (bg) chip.style.background = bg;
  else if (painted) chip.style.background = cabPaintColor();

  const name = document.createElement('span');
  name.className = 'lyr-name lyr-name--fixed';
  name.textContent = 'Fundo';

  const state = document.createElement('span');
  state.className = 'lyr-meta';
  state.textContent = bg ? bg : painted ? 'cor do cavalo' : 'chapa do baú';

  row.append(pad, chip, name, state);
  row.title = bg
    ? 'Esta face tem cor própria e ignora a cor do cavalo — clique para trocar'
    : 'A camada mais baixa do painel — clique para escolher a cor';
  row.addEventListener('click', () => selectBackground());
  return row;
}

/**
 * Põe a seção do fundo em dia com a tela ativa.
 *
 * Roda em TODA sincronização do inspetor, e não só quando a seção está visível:
 * ela é montada uma vez e escondida por CSS (o inspetor nunca remonta — ver a
 * nota do `<aside id="inspector">` no template), então um valor velho ficaria
 * lá esperando o próximo clique na camada. Barato: meia dúzia de nós.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA SEÇÃO DIZ MUDOU EM 2026-08-13, junto com a regra.
 *
 * Antes ela mostrava um valor: o hex, ou "sem fundo". Agora ela mostra a PILHA,
 * porque é a pilha que responde à pergunta do usuário ("por que esta face está
 * preta e aquela está verde?"):
 *
 *   linha 1  Cor do cavalo  ·  ligada/desligada, vale para o baú inteiro
 *   linha 2  Só esta face   ·  quando tem cor, GANHA da linha 1
 *   título   a resposta efetiva desta face, em duas palavras
 *   rodapé   a frase que liga as duas — e ela muda com o estado, senão seria
 *            um texto fixo que descreve um caso só
 *
 * A cor semeada no seletor quando a face não tem cor própria é a EFETIVA (a do
 * cavalo, se ligada), e não `#ffffff`: um `<input type="color">` não tem estado
 * vazio, e abrir o seletor no branco quando o baú está vermelho oferece como
 * ponto de partida justamente a cor que ninguém tem.
 */
function syncBackground() {
  const raw = active().backgroundColor;
  const bg = typeof raw === 'string' ? raw : '';
  const painted = isImplementPainted();
  const chapa = painted ? cabPaintColor() : '#ffffff';

  $<HTMLInputElement>('bgcolor').value = bg || chapa;
  const sw = $('bg-sw');
  sw.classList.toggle('is-empty', !bg);
  sw.style.background = bg || '';
  $('bg-val').textContent = bg ? 'Personalizada' : 'Sem cor';
  ($('bg-clear') as HTMLButtonElement).disabled = !bg;

  /* ---- QUEM MANDA NESTA FACE, e é UMA das duas ----
     A pilha não mudou: a cor da face SOBREPÕE a do cavalo onde existir. O que
     mudou é o que a forma diz sobre ela. A caixa "Cor do cavalo" é uma decisão
     sobre o produto inteiro, então ela fica marcada em todas as faces — e até
     2026-08-16 ela também ACENDIA em todas, inclusive nas que a ignoram. As
     duas linhas verdes lado a lado leem como duas opções exclusivas ligadas ao
     mesmo tempo, que foi o relato ("e não deveria... isso acontece até nas
     laterais"). O anel agora marca o vencedor; o perdedor fica apagado, e o
     estado dele diz por quê.

     O CHECKBOX NÃO É TOCADO. Desmarcá-lo "para ficar coerente" desligaria a
     tinta do baú inteiro por causa de uma face — que é justamente o defeito que
     `setBackgroundsForPaint()` tinha e foi apagado por isso. */
  const cavaloManda = painted && !bg;
  const cavaloSobreposto = painted && !!bg;
  $('bg-row-cab').classList.toggle('is-on', cavaloManda);
  $('bg-row-cab').classList.toggle('is-muted', cavaloSobreposto);
  $('bg-cab-val').textContent = cavaloSobreposto ? 'sobreposta aqui' : 'todo o baú';
  $('bg-row-cab').title = cavaloSobreposto
    ? 'A tinta do cavalo continua valendo para o baú — esta face tem cor própria'
      + ' e fica por cima dela.'
    : 'Estende a pintura do cavalo ao implemento inteiro. As faces com cor própria'
      + ' continuam com ela.';
  $('bg-row-face').classList.toggle('is-on', !!bg);

  $('bg-state').textContent = bg ? 'cor própria' : painted ? 'cor do cavalo' : 'chapa branca';
  $('bg-hint').textContent = bg
    ? (painted
      ? 'Esta face tem cor própria e ignora a cor do cavalo. As faces sem cor'
        + ' própria continuam seguindo o cavalo.'
      : 'Esta face tem cor própria. As faces sem cor própria mostram a chapa'
        + ' branca do baú.')
    : (painted
      ? 'Sem cor própria, esta face mostra a chapa — que está com a cor do'
        + ' cavalo. Escolher uma cor aqui sobrescreve isso só nesta face.'
      : 'Sem cor própria, esta face mostra a chapa branca do baú.');
}

/** Aplica uma cor de fundo (ou `''` = sem fundo). */
function setBackground(value: string, commit: boolean) {
  const c = active(), key = activeKey();
  c.backgroundColor = value;
  markDirty(key);
  c.requestRenderAll();
  syncBackground();
  /* E a seção do Thermo King também, porque a dica dela FALA desta cor: sem
     isto, escolher um preto na testeira deixaria a explicação de "por que a
     carcaça não ficou preta" esperando o próximo clique em outra coisa. */
  syncThermoKing();
  /* A LISTA DE CAMADAS SÓ NO COMMIT. `input` chega a cada pixel percorrido
     dentro do seletor nativo, e remontar a lista inteira a cada um deles é
     reconstruir DOM sessenta vezes por segundo para mudar um quadradinho de
     13 px — enquanto o palco, que é onde o olho está, já mostra a cor ao vivo. */
  if (commit) { history.push(key); renderLayers(); }
}

/** Seleciona o FUNDO: descarta a seleção da tela e abre a seção dele. */
function selectBackground() {
  const c = active();
  c.discardActiveObject();
  c.requestRenderAll();
  bgSelected = true;
  tkSelected = false;
  syncInspector();
}

/* ---------------- A CAMADA DO THERMO KING ----------------
   Pedido de 2026-08-13: *"no livery da frontal, o thermo king deve ser uma
   camada como a base"*. Ele já tinha cor — no card Configurações, do outro lado
   da tela — e o pedido é de LUGAR: quem está desenhando a testeira está olhando
   para a unidade, e a cor dela pertence àquela tela.

   É a mesma construção da camada Fundo, com uma diferença que é o ponto: o
   Fundo é `canvas.backgroundColor` e vira TEXTURA; o Thermo King é uma PEÇA com
   demão própria (`vehicle/trim.ts`), e a cor dele vai para o material do 3D. As
   duas aparecem na mesma lista porque, para quem desenha, as duas são "coisas
   que têm cor nesta face" — a diferença de mecanismo é nossa, não dele.

   SÓ NA TESTEIRA, e não é arbitrário: a unidade é montada na parede dianteira
   (ver `placeThermoKing()` em models.ts) e não aparece em nenhuma outra face. */
const tkPresent = () => activeKey() === 'front' && !!vehicleState.tk;

/** Seleciona o THERMO KING. */
function selectThermoKing() {
  const c = active();
  c.discardActiveObject();
  c.requestRenderAll();
  tkSelected = true;
  bgSelected = false;
  syncInspector();
}

/** A linha fixa do Thermo King, logo acima do Fundo. */
function thermoKingRow(): HTMLElement {
  const piece = getTrim().thermoking;
  const hex = piece.color;
  /* Sem cor própria ele SEGUE O BAÚ (`followsBody: true` em trim.ts), e o baú é
     a cor do cavalo quando a tinta está ligada. A pastilha mostra a cor
     EFETIVA, com o anel tracejado de "herdada" — mesma convenção da camada
     Fundo, ver `backgroundRow()`. */
  const painted = isImplementPainted();
  const row = document.createElement('div');
  row.className = 'layer-row layer-row--fixed' + (tkSelected ? ' on' : '');

  const pad = document.createElement('span');
  pad.className = 'lyr-grip is-fixed';
  pad.setAttribute('aria-hidden', 'true');

  const chip = document.createElement('span');
  chip.className = 'lyr-swatch' + (hex ? '' : painted ? ' is-inherited' : '');
  chip.style.background = hex || (painted ? cabPaintColor() : '#ffffff');

  const name = document.createElement('span');
  name.className = 'lyr-name lyr-name--fixed';
  name.textContent = 'Thermo King';

  const state = document.createElement('span');
  state.className = 'lyr-meta';
  state.textContent = hex ? hex : 'como o baú';

  row.append(pad, chip, name, state);
  row.title = 'A unidade de refrigeração — clique para escolher a cor da carcaça';
  row.addEventListener('click', () => selectThermoKing());
  return row;
}

/** Põe a seção do Thermo King em dia. Mesmo contrato de `syncBackground()`. */
function syncThermoKing() {
  const piece = getTrim().thermoking;
  const hex = piece.color;
  const painted = isImplementPainted();
  $<HTMLInputElement>('tk-color').value = hex || (painted ? cabPaintColor() : '#ffffff');
  const sw = $('tk-sw');
  sw.classList.toggle('is-empty', !hex);
  sw.style.background = hex || '';
  $('tk-val').textContent = hex ? 'Personalizada' : 'Sem cor';
  $('tk-row').classList.toggle('is-on', !!hex);
  ($('tk-clear') as HTMLButtonElement).disabled = !hex;
  $('tk-state').textContent = hex ? 'cor própria' : painted ? 'como o baú' : 'branca de fábrica';

  /* A LINHA DE CIMA — a mesma pilha do Fundo, e o mesmo estado.
     Ela não guarda nada: espelha `#paint-trailer`, que é o dono da decisão.
     Duas cópias do booleano divergiriam na primeira troca de caminhão. */
  ($('tk-paint-cab') as HTMLInputElement).checked = painted;
  const cavaloManda = painted && !hex;
  $('tk-row-cab').classList.toggle('is-on', cavaloManda);
  $('tk-row-cab').classList.toggle('is-muted', painted && !!hex);
  $('tk-cab-val').textContent = painted && hex ? 'sobreposta aqui' : 'todo o baú';
  /* ---- A DICA DIZ O QUE A CARCAÇA SEGUE, e é aqui que a pilha desta face
     deixa de valer.
     O Fundo do painel é PLOTAGEM: ele vira textura da chapa e não alcança a
     máquina. A carcaça segue a TINTA do implemento, que é outra coisa — a do
     cavalo quando "Cor do cavalo" está ligada, o branco de fábrica quando não.
     Sem isto escrito, quem pinta a testeira de preto e vê a carcaça continuar
     branca lê como defeito. Ver `followsBody` em `vehicle/trim.ts`. */
  const faceComCor = !!active().backgroundColor;
  $('tk-hint').textContent = (hex
    ? (painted
      ? 'A carcaça tem cor própria e ignora a cor do cavalo. O resto do baú'
        + ' continua seguindo o cavalo.'
      : 'A carcaça tem cor própria.')
      + ' A pintura dela é sempre SÓLIDA — é o que sai de uma cabine de pintura,'
      + ' e não a metálica da montadora.'
    : (painted
      ? 'Sem cor própria, a carcaça segue a tinta do implemento — hoje, a cor do'
        + ' cavalo.'
      : 'Sem cor própria, a carcaça fica branca de fábrica.'))
    + (faceComCor
      ? ' A cor do Fundo desta face é plotagem sobre a chapa e não alcança a'
        + ' unidade: para pintá-la, escolha a cor aqui.'
      : '');
}

/**
 * Escreve a cor da carcaça.
 *
 * `live` é o ARRASTO dentro do seletor nativo, que emite `input` a cada pixel
 * percorrido: ele passa por `setTrimColorLive()`, que só reescreve o uniforme da
 * demão. O caminho normal (`setTrim`) varre as ~2 150 malhas do implemento e
 * custaria isso trinta vezes por segundo — ver o bloco daquela função.
 */
function setThermoKingColor(value: string | null, live: boolean) {
  if (live && value) {
    if (setTrimColorLive('thermoking', value)) { syncThermoKing(); return; }
  }
  setTrim('thermoking', { color: value });
  syncThermoKing();
  renderLayers();
}

function renderLayers() {
  const c = active(), list = $('layer-list');
  const objs = c.getObjects();
  const activeSet = new Set(c.getActiveObjects());
  $('layer-count').textContent = objs.length ? `${objs.length} ${objs.length === 1 ? 'item' : 'itens'}` : '';
  list.innerHTML = '';
  /* As camadas FIXAS do pé da lista, na ordem em que estão no produto: a
     unidade fica montada SOBRE a parede, então ela vem acima do Fundo. */
  const fixedRows = () => {
    if (tkPresent()) list.appendChild(thermoKingRow());
    list.appendChild(backgroundRow());
  };
  if (!objs.length) {
    list.innerHTML = '<div class="layer-empty">Nenhum objeto neste painel.</div>';
    fixedRows();
    return;
  }

  // getObjects() vem de baixo para cima; uma lista de camadas se lê de cima
  objs.slice().reverse().forEach((o, i) => {
    const idx = objs.length - 1 - i;
    const a = o as AnyObj;
    const row = document.createElement('div');
    row.className = 'layer-row' + (activeSet.has(o) ? ' on' : '') + (o.visible ? '' : ' is-hidden');
    row.draggable = true;

    const grip = document.createElement('span');
    grip.className = 'lyr-grip'; grip.textContent = '⠿';
    const icon = document.createElement('span');
    icon.className = 'lyr-icon'; icon.textContent = isText(o) ? 'T' : '▣';

    const name = document.createElement('input');
    name.className = 'lyr-name'; name.readOnly = true;
    name.value = a.name || defaultName(o);
    name.title = 'Clique para selecionar · duplo clique para renomear';
    /* ⚠️ O CLIQUE SIMPLES NÃO PODE PÔR O CURSOR AQUI, e é isto que devolve a
       linha inteira à seleção.
       O campo tem `flex: 1`, ou seja é quase toda a largura da linha. Enquanto
       ele aceitava foco no primeiro clique, clicar no nome — o gesto óbvio para
       "selecionar esta camada" — punha um cursor de texto num campo somente
       leitura e não selecionava nada; sobravam o punho, o ícone e a folga entre
       os botões, que foi o "tenho que clicar numa área muito pequena".
       `preventDefault()` no `mousedown` tira o FOCO e a seleção de texto sem
       tirar o `click` nem o `dblclick`, que continuam sendo despachados — então
       a linha recebe o clique e o duplo clique continua abrindo a edição. */
    name.addEventListener('mousedown', (ev) => { if (name.readOnly) ev.preventDefault(); });
    name.addEventListener('dblclick', () => {
      name.readOnly = false;
      name.focus();                            // o mousedown recusou o foco; aqui ele é pedido
      name.select();
    });
    name.addEventListener('blur', () => {
      name.readOnly = true;
      const v = name.value.trim();
      if (v && v !== a.name) { a.name = v; a.renamed = true; history.push(activeKey()); }
      else name.value = a.name || defaultName(o);
    });
    name.addEventListener('keydown', (ev) => {
      ev.stopPropagation();                    // Delete/setas não podem chegar à tela
      if (ev.key === 'Enter') name.blur();
    });

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'lyr-btn' + (o.visible ? '' : ' on');
    eye.textContent = o.visible ? '👁' : '🚫';
    eye.title = o.visible ? 'Ocultar' : 'Mostrar';
    eye.addEventListener('click', (ev) => {
      ev.stopPropagation();
      o.set('visible', !o.visible);
      markDirty(activeKey()); c.requestRenderAll(); history.push(activeKey()); renderLayers();
    });

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'lyr-btn' + (a.locked ? ' on' : '');
    lock.textContent = a.locked ? '🔒' : '🔓';
    lock.title = a.locked ? 'Desbloquear' : 'Bloquear';
    lock.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setLocked(a, !a.locked);
      history.push(activeKey()); renderLayers();
    });

    row.append(grip, icon, name, eye, lock);

    row.addEventListener('click', (ev) => {
      /* SÓ SAI CEDO ENQUANTO SE ESTÁ RENOMEANDO. Era `ev.target === name`, sem
         a segunda metade, e com o campo ocupando a linha inteira isso queria
         dizer "clicar no nome não seleciona" — ver o bloco do `mousedown`. */
      if (ev.target === name && !name.readOnly) return;
      /* Um objeto travado não recebe clique NA TELA — selecioná-lo pela lista é
         a saída que faz o cadeado deixar de dar medo. */
      c.discardActiveObject();
      c.setActiveObject(o);
      c.requestRenderAll();
      syncInspector();
    });

    row.addEventListener('dragstart', () => { dragSrcIndex = idx; row.style.opacity = '.4'; });
    row.addEventListener('dragend', () => { row.style.opacity = ''; dragSrcIndex = null; });
    row.addEventListener('dragover', (ev) => { ev.preventDefault(); row.classList.add('dragover'); });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', (ev) => {
      ev.preventDefault();
      row.classList.remove('dragover');
      if (dragSrcIndex === null || dragSrcIndex === idx) return;
      c.moveObjectTo(objs[dragSrcIndex], idx);
      markDirty(activeKey()); c.requestRenderAll();
      history.push(activeKey());               // z-order não dispara evento público no fabric
      renderLayers();
    });

    list.appendChild(row);
  });

  fixedRows();
}

function setLocked(o: AnyObj, v: boolean) {
  o.locked = v;
  applyLockState(o);
  const c = active();
  if (v && c.getActiveObject() === o) c.discardActiveObject();
  markDirty(activeKey());
  c.requestRenderAll();
}

/* ---------------- sincronizar o inspetor ---------------- */
function syncInspector() {
  if (syncing) return;
  syncing = true;
  try {
    const c = active(), key = activeKey();
    const objs = c.getActiveObjects();
    /* Qualquer seleção de verdade desfaz a do fundo. É aqui e não no listener de
       cada evento do fabric porque TODO caminho que muda a seleção termina
       chamando esta função — clique na tela, marquee, atalho, lista de camadas —
       e uma bandeira desligada em quatro lugares diverge no quinto. */
    if (objs.length) { bgSelected = false; tkSelected = false; }
    /* A unidade só existe na testeira: trocar de aba com ela selecionada
       deixaria o inspetor mostrando a carcaça enquanto o palco mostra a
       lateral. */
    if (tkSelected && !tkPresent()) tkSelected = false;
    syncPanels(objs);
    /* DEPOIS de `syncPanels()`, e é obrigatório nessa ordem: o card de medidas é
       `data-for="always"`, então aquele laço o REEXIBE a cada sincronização — e
       no teto ele tem de ficar escondido (ver o bloco em ui/livery-measures.ts).
       Sem esta linha, selecionar um objeto no teto trazia de volta um formulário
       de portas para uma face que não tem porta. Barato: só reconstrói quando a
       assinatura muda. */
    syncMeasures();
    syncBackground();
    syncThermoKing();

    const dims = panelMM(key), mm = mmPerPx(key);
    $('panel-dims').textContent = `${cm1(dims.w / 10)} × ${cm1(dims.h / 10)} cm`;
    $('panel-scale').textContent = `${mm.y.toFixed(2)} mm/px`;

    const texts = objs.filter(isText) as fabric.IText[];
    if (texts.length) {
      const t = texts[0];
      $('font-trigger-label').textContent = t.fontFamily;
      $('font-trigger-label').style.fontFamily = `'${t.fontFamily}'`;
      $('font-current').textContent = t.fontFamily;
      for (const el of $$('#font-menu .font-opt')) el.classList.toggle('on', el.dataset.family === t.fontFamily);
      $<HTMLInputElement>('t-size').value = String(Math.round(pxToCm(t.fontSize, key)));
      const wt = t.fontWeight === 'bold' ? 700 : Number(t.fontWeight) || 400;
      for (const b of $$('#t-weight .seg-btn')) b.classList.toggle('on', Number(b.dataset.w) === wt);
      for (const b of $$('#t-align .seg-btn')) b.classList.toggle('on', b.dataset.a === t.textAlign);
      $<HTMLInputElement>('t-tracking').value = String(t.charSpacing || 0);
      $('t-tracking-val').textContent = ((t.charSpacing || 0) / 10).toFixed(1) + ' %';
      $<HTMLInputElement>('t-leading').value = String(Math.round((t.lineHeight || 1.16) * 100));
      $('t-leading-val').textContent = (t.lineHeight || 1.16).toFixed(2).replace('.', ',');
      if (typeof t.fill === 'string') $<HTMLInputElement>('t-fill').value = t.fill;
      if (typeof t.stroke === 'string' && t.stroke) $<HTMLInputElement>('t-stroke').value = t.stroke;
      $<HTMLInputElement>('t-stroke-w').value = cm1(pxToCm(t.strokeWidth || 0, key));
    }

    const img = objs.find(isImage) as fabric.FabricImage | undefined;
    if (img) {
      $('img-name').textContent = (img as AnyObj).name || '';
      const pct = Math.round((img.opacity ?? 1) * 100);
      $<HTMLInputElement>('i-opacity').value = String(pct);
      $('i-opacity-val').textContent = pct + ' %';
      const r = img.getBoundingRect();
      const printedCm = pxToCm(r.width, key, 'x');
      const dpi = printedCm > 0 ? (img.width || 1) / (printedCm / 2.54) : 0;
      const low = dpi < 40;
      $('img-dpi').className = 'dpi-note' + (low ? ' warn-on' : '');
      $('img-dpi').textContent =
        `${img.width}×${img.height} px em ${cm1(printedCm)} cm · ${Math.round(dpi)} dpi`
        + (low ? ' ⚠ baixa resolução para impressão' : '');
    }

    if (objs.length) {
      const r = (objs.length === 1 ? objs[0] : c.getActiveObject() as fabric.FabricObject).getBoundingRect();
      $<HTMLInputElement>('tf-x').value = String(Math.round(pxToCm(r.left, key, 'x')));
      $<HTMLInputElement>('tf-y').value = String(Math.round(pxToCm(r.top, key, 'y')));
      $<HTMLInputElement>('tf-w').value = String(Math.round(pxToCm(r.width, key, 'x')));
      $<HTMLInputElement>('tf-h').value = String(Math.round(pxToCm(r.height, key, 'y')));
      const ang = objs.length === 1 ? (objs[0].angle || 0) : 0;
      $<HTMLInputElement>('tf-rot').value = String(ang > 180 ? ang - 360 : ang);
      $('tf-rot-val').textContent = Math.round(ang) + '°';
    }

    const multi = objs.length > 1;
    $('align-frame').classList.toggle('hidden', !multi);
    $('align-hint').textContent = !objs.length ? '' : multi ? `${objs.length} objetos` : '1 objeto · ao painel';
    for (const b of $$('[data-dist]')) b.classList.toggle('ctl-off', objs.length < 3);
    for (const b of $$('[data-gap]')) b.classList.toggle('ctl-off', objs.length < 2);

    renderLayers();
    updateFoot(objs);
    updateToolbarState();
  } finally {
    syncing = false;
  }
}

/* ---------------- rodapé ---------------- */
function updateFoot(objs: fabric.FabricObject[]) {
  const foot = $('modal-foot'), key = activeKey(), c = active();
  if (!objs.length) {
    foot.textContent = 'Dica: arraste o painel para movê-lo · roda do mouse aproxima'
      + ' · ⇧ + arrastar seleciona vários · clique no painel seleciona o Fundo'
      + ' · solte uma imagem em qualquer lugar para adicioná-la';
    return;
  }
  const r = (objs.length === 1 ? objs[0] : c.getActiveObject() as fabric.FabricObject).getBoundingRect();
  const parts = [`${cm1(pxToCm(r.width, key, 'x'))} × ${cm1(pxToCm(r.height, key, 'y'))} cm`];
  if (key === 'left' || key === 'right') {
    /* x=0 é a TRASEIRA na lateral esquerda e a FRENTE na direita: addLiveryUV()
       inverte o u entre os lados para o desenho ler certo nos dois.
       Só as LATERAIS têm esta leitura: numa face de ponta "distância da frente"
       é a espessura do baú, e dizer isso é ruído. */
    const fromFrontPx = key === 'left' ? c.getWidth() - (r.left + r.width) : r.left;
    parts.push(`${cm1(pxToCm(fromFrontPx, key, 'x') / 100)} m da frente`);
  }
  parts.push(`${cm1(pxToCm(c.getHeight() - (r.top + r.height), key, 'y') / 100)} m do piso`);
  foot.textContent = parts.join(' · ');
}

/* ---------------- barra ---------------- */
function updateToolbarState() {
  const key = activeKey(), n = selObjects().length;
  ($$('[data-act="undo"]')[0] as HTMLButtonElement).disabled = !history.canUndo(key);
  ($$('[data-act="redo"]')[0] as HTMLButtonElement).disabled = !history.canRedo(key);
  ($$('[data-act="delete"]')[0] as HTMLButtonElement).disabled = !n;
  ($$('[data-act="duplicate"]')[0] as HTMLButtonElement).disabled = !n;
  /* Espelhar é uma operação entre as DUAS LATERAIS; nem a traseira nem a
     testeira têm par. `otherSide()` é quem sabe disso — perguntar a ele em vez
     de listar as faces sem par é o que impede uma quinta face de nascer com o
     botão ligado sem destino. */
  ($('btn-mirror') as HTMLButtonElement).disabled = !otherSide(key);
  updateSyncDots();
}

function updateSyncDots() {
  const same = sidesMatch();
  for (const tab of $$('#surface-tabs .tab')) {
    const dot = tab.querySelector('.sync-dot');
    if (!dot) continue;
    dot.classList.toggle('on', same);
    tab.title = same ? 'Lados iguais' : 'Lados diferentes — use Espelhar para igualar';
  }
}

async function addText() {
  const c = active(), key = activeKey();
  await ensureFont(DEFAULT_FONT);
  const t = new fabric.IText('Sua marca', {
    left: c.getWidth() / 2, top: c.getHeight() / 2,
    originX: 'center', originY: 'center',
    fontFamily: DEFAULT_FONT,
    fontSize: cmToPx(40, key),            // 40 cm — altura normal do nome de uma frota
    fill: $<HTMLInputElement>('t-fill').value,
  });
  stamp(t as AnyObj, 'Sua marca');
  c.add(t); c.setActiveObject(t);
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

async function duplicateSelection() {
  const c = active(), key = activeKey();
  const objs = withSelectionFlattened(c);
  if (!objs.length) return;
  const clones = await Promise.all(objs.map((o) => o.clone(EXTRA)));
  for (const o of clones) {
    const a = o as AnyObj;
    a.id = null; stamp(a, a.name);
    o.setXY(o.getXY().add(new fabric.Point(24, 24)));
    o.setCoords();
    c.add(o);
  }
  restoreSelection(c, clones);
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

function deleteSelection() {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  for (const o of objs) c.remove(o);
  c.discardActiveObject();
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

function bindToolbar() {
  for (const btn of $$('.modal-toolbar .tool')) {
    btn.addEventListener('click', async () => {
      const c = active(), key = activeKey();
      switch (btn.dataset.act) {
        case 'text': await addText(); break;
        case 'logo': $('logo-input').click(); break;
        case 'duplicate': await duplicateSelection(); break;
        case 'delete': deleteSelection(); break;
        case 'undo': await history.undo(key); syncInspector(); break;
        case 'redo': await history.redo(key); syncInspector(); break;
        case 'clear':
          for (const o of c.getObjects().slice()) c.remove(o);
          c.backgroundColor = DEFAULT_BG;
          markDirty(key); c.requestRenderAll(); history.push(key);
          syncInspector();
          break;
      }
    });
  }

  $('logo-input').addEventListener('change', async (e) => {
    const input = evTarget<HTMLInputElement>(e);
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await addImageFile(file);
    history.push(activeKey());
    syncInspector();
  });

  /* O FUNDO, agora no INSPETOR. `input` acompanha o arrasto dentro do seletor
     nativo sem gravar no histórico; `change` é a escolha, e é ela que empilha um
     desfazer. Mesmo par que o card de configurações usa, e pelo mesmo motivo:
     um passo de histórico por pixel percorrido encheria a pilha de 40 estados
     com um gesto só. */
  $('bgcolor').addEventListener('input', (e) => {
    setBackground(evTarget<HTMLInputElement>(e).value, false);
  });
  $('bgcolor').addEventListener('change', (e) => {
    setBackground(evTarget<HTMLInputElement>(e).value, true);
  });
  $('bg-clear').addEventListener('click', (e) => { e.stopPropagation(); setBackground('', true); });

  /* A LINHA INTEIRA ABRE O SELETOR, e não só a pastilha de 22 px.
     Pedido de 2026-08-13: *"quando clicar no card do seletor de cor deve abrir o
     picker, não somente no color picker em si"*. O alvo passa a ser o que se
     lê como um controle — a linha —, que é a mesma regra que a linha de cima já
     tinha de graça por ser um `<label>` em volta do checkbox.

     Aqui não dá para usar `<label for>`: o seletor JÁ mora dentro de um
     elemento próprio (a pastilha), e envolver a linha num segundo rótulo faria
     o botão "×" disparar o seletor junto — por isso ele para a propagação
     acima, e por isso o clique DENTRO da pastilha sai cedo (lá o input nativo
     já recebeu o clique, e um `.click()` por cima abriria e fecharia). */
  $('bg-row-face').addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest('.bg-chip') || t?.closest('.bg-reset')) return;
    $<HTMLInputElement>('bgcolor').click();
  });

  /* ---- Thermo King: o mesmo par input/change e a mesma linha clicável ---- */
  $('tk-color').addEventListener('input', (e) => {
    setThermoKingColor(evTarget<HTMLInputElement>(e).value, true);
  });
  $('tk-color').addEventListener('change', (e) => {
    setThermoKingColor(evTarget<HTMLInputElement>(e).value, false);
  });
  $('tk-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    setThermoKingColor(null, false);
  });
  $('tk-row').addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest('.bg-chip') || t?.closest('.bg-reset')) return;
    $<HTMLInputElement>('tk-color').click();
  });

  /* A LINHA "COR DO CAVALO" DA SEÇÃO DO THERMO KING ACIONA A DO FUNDO.
     ---------------------------------------------------------------------
     Ela é a MESMA decisão vista de outro lugar (a tinta vale para o implemento
     inteiro e a carcaça a segue por `followsBody`), então ela não implementa
     nada: escreve no `#paint-trailer` e despacha o `change` dele. Assim o
     caminho continua sendo UM — o de `bindTrailerPaint()` em vehicle/livery.ts,
     que troca o material do 3D, refotografa e escreve o status — e os dois
     controles não podem discordar.

     `change` e não `click`: o `<label>` já alterna o checkbox interno antes de o
     evento chegar aqui, e reagir ao clique alternaria duas vezes. */
  $('tk-paint-cab').addEventListener('change', (e) => {
    const alvo = $<HTMLInputElement>('paint-trailer');
    alvo.checked = evTarget<HTMLInputElement>(e).checked;
    alvo.dispatchEvent(new Event('change'));
  });

  /* "Pintar o implemento" é de vehicle/livery.ts (ele mexe no material do 3D e
     no fundo das QUATRO telas de uma vez), mas agora mora nesta seção — então o
     inspetor tem de se redesenhar quando ele muda, ou a camada Fundo continuaria
     anunciando a cor que `setBackgroundsForPaint()` acabou de tirar. Segundo
     ouvinte no mesmo elemento, registrado DEPOIS do de lá (initLivery() roda
     antes de initLiveryEditor()), então lê o estado já aplicado. */
  $('paint-trailer').addEventListener('change', () => {
    syncBackground();
    /* A carcaça do Thermo King SEGUE a tinta do implemento quando não tem cor
       própria, então ligar e desligar esta caixa muda o que a seção dela diz —
       "Como o baú" contra "De fábrica" — e a pastilha dela na lista de camadas. */
    syncThermoKing();
    renderLayers();
  });

  $('stage-zoom').addEventListener('change', (e) => {
    const v = evTarget<HTMLSelectElement>(e).value;
    setZoomFactor(v === 'fit' ? 1 : parseFloat(v) || 1);
  });
  $('snap-toggle').addEventListener('change', (e) => setSnapEnabled(evTarget<HTMLInputElement>(e).checked));
}

/* ---------------- espelhar ---------------- */
function bindMirror() {
  const pop = () => $('mirror-pop');
  /* O DESTINO, não a face ativa: "Espelhar para o lado do passageiro". O nome
     sai de `SIDE_LABEL` (vehicle/livery.ts) e nunca de um literal aqui —
     "esquerda/direita" é ambíguo em cima de um caminhão, e o lugar onde essa
     decisão está escrita é lá. */
  const label = () => (SIDE_LABEL[otherSide(activeKey()) ?? 'rear'] || '').toLowerCase();

  $('btn-mirror').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!otherSide(activeKey())) return;
    $('mirror-pop-title').textContent = `Espelhar para o ${label()}`;
    const dst = otherSide(activeKey());
    const n = dst ? surfaces[dst].getObjects().length : 0;
    $('mirror-warn').textContent = n
      ? `⚠ A arte atual do ${label()} (${n} ${n === 1 ? 'objeto' : 'objetos'}) será substituída. Ctrl+Z desfaz.`
      : '';
    pop().classList.remove('hidden');
  });

  $('mirror-cancel').addEventListener('click', () => pop().classList.add('hidden'));
  $('mirror-go').addEventListener('click', async () => {
    pop().classList.add('hidden');
    const from = activeKey(), to = otherSide(from);
    if (!to) return;
    const mode = pop().querySelector<HTMLInputElement>('input[name="mirror-mode"]:checked')?.value;
    await copySurface(from, to, { reflect: mode === 'reflect' });
    syncInspector();
  });

  $('btn-help').addEventListener('click', (e) => {
    e.stopPropagation();
    $('help-pop').classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t?.closest?.('#mirror-pop') && !t?.closest?.('#btn-mirror')) pop().classList.add('hidden');
    if (!t?.closest?.('#help-pop') && !t?.closest?.('#btn-help')) $('help-pop').classList.add('hidden');
  });
}

/* ---------------- superfícies ---------------- */
export function showSurface(key: SurfaceKey) {
  setActiveKey(key);
  for (const k of SURFACE_KEYS) stagePanels[k].classList.toggle('hidden', k !== key);
  for (const b of $$('#surface-tabs .tab')) b.classList.toggle('active', b.dataset.surface === key);
  $('editor-caption').textContent = CAPTIONS[key];
  resize();
  syncInspector();
  /* As portas são POR FACE, então o painel de medidas troca de conteúdo junto
     com a aba. A altura e o comprimento não trocam — são do baú inteiro —, e é
     por isso que a seção não é escondida nem remontada do zero aqui. */
  syncMeasures(key);
}

/**
 * A PÍLULA DE CARREGAMENTO TEM DE ATRAVESSAR O MODAL.
 *
 * `#cab-switching` é o indicador padrão de "espere um pouco" do estúdio — troca
 * de caminhão, troca de cenário, preset de luz, redimensionamento do baú — e ele
 * é `position: absolute` dentro de `#canvas-holder`, com z-index 9. O modal do
 * editor é `position: fixed; z-index: 9999`, ou seja a pílula ficava ATRÁS dele.
 *
 * Consequência: "+ Adicionar porta" dispara um recorte de ~3 s de thread
 * presa e o único aviso visível era uma linha no inspetor. O pedido foi direto —
 * *"quando adicionar porta deve ter o mesmo loading que há quando está
 * carregando o mapa"* —, e a resposta certa não é um segundo indicador, é fazer
 * ESTE aparecer: a marca no root troca a pílula para `fixed` acima do modal
 * enquanto o editor está aberto (regra em core/studio.css).
 *
 * No root e não no modal porque a pílula não é filha do modal — ela é filha do
 * canvas-holder, e o seletor precisa de um ancestral comum aos dois.
 */
const markEditorOpen = (on: boolean) => root.classList.toggle('ts-editing', on);

export function openEditor(key?: SurfaceKey) {
  modal().classList.remove('hidden');
  markEditorOpen(true);
  showSurface(key || activeKey());
}

export function closeEditor() {
  for (const c of Object.values(surfaces)) { c.discardActiveObject(); c.requestRenderAll(); }
  $('font-menu').classList.add('hidden');
  $('mirror-pop').classList.add('hidden');
  $('help-pop').classList.add('hidden');
  modal().classList.add('hidden');
  markEditorOpen(false);
}

/* ---------------- arrastar e soltar ---------------- */
function bindDnD() {
  const stage = $('modal-stage');
  let depth = 0;
  stage.addEventListener('dragenter', (e) => { e.preventDefault(); if (++depth > 0) stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; stage.classList.remove('dragging'); } });
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    stage.classList.remove('dragging');
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const c = active();
    const rect = c.upperCanvasEl.getBoundingClientRect();
    let x: number | null = null, y: number | null = null;
    if (rect.width && rect.height &&
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      x = (e.clientX - rect.left) / rect.width * c.getWidth();
      y = (e.clientY - rect.top) / rect.height * c.getHeight();
    }
    await addImageFile(file, x, y);
    history.push(activeKey());
    syncInspector();
  });
}

/* ---------------- teclado ---------------- */
let nudgeTimer = 0;
let nudgeKey: SurfaceKey | null = null;
function nudgeCommit(key: SurfaceKey) {
  nudgeKey = key;
  clearTimeout(nudgeTimer);
  nudgeTimer = window.setTimeout(flushNudge, 450);
}
function flushNudge() {
  if (!nudgeKey) return;
  clearTimeout(nudgeTimer);
  history.push(nudgeKey);
  nudgeKey = null;
  updateToolbarState();
}

function bindKeys() {
  document.addEventListener('keydown', async (e: KeyboardEvent) => {
    if (!isMounted() || !isOpen()) return;
    const c = active(), key = activeKey();
    const ao = c.getActiveObject();
    const tag = (e.target as HTMLElement)?.tagName || '';
    const typing = !!(ao && (ao as fabric.IText).isEditing) || /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === 'Escape') {
      /* TRÊS DEGRAUS, e o do meio nasceu com a seleção do fundo: ele é uma
         seleção de verdade para o inspetor, então fechar o modal por cima dele
         seria fechar com algo selecionado — o único caso em que Esc pularia um
         passo. */
      if (ao) { c.discardActiveObject(); c.requestRenderAll(); syncInspector(); }
      else if (bgSelected || tkSelected) { bgSelected = tkSelected = false; syncInspector(); }
      else closeEditor();
      return;
    }
    if (typing && !mod) return;

    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) await history.redo(key); else await history.undo(key);
      syncInspector();
      return;
    }
    if (mod && k === 'y') { e.preventDefault(); await history.redo(key); syncInspector(); return; }
    if (mod && k === 'd') { e.preventDefault(); await duplicateSelection(); return; }
    if (mod && k === 'a') {
      e.preventDefault();
      const objs = c.getObjects().filter((o) => o.visible && !(o as AnyObj).locked);
      c.discardActiveObject();
      restoreSelection(c, objs);
      c.requestRenderAll(); syncInspector();
      return;
    }
    if (mod && k === 'c') {
      const objs = c.getActiveObjects();
      if (objs.length) clipboard = objs.map((o) => o.toObject(EXTRA));
      return;
    }
    if (mod && k === 'v') {
      if (!clipboard) return;
      e.preventDefault();
      const fams = new Set(clipboard.map((o) => o.fontFamily as string).filter(Boolean));
      await Promise.all([...fams].map(ensureFont));
      const objs = await fabric.util.enlivenObjects<fabric.FabricObject>(clipboard);
      for (const o of objs) {
        const a = o as AnyObj;
        a.id = null; stamp(a, a.name);
        o.setXY(o.getXY().add(new fabric.Point(24, 24)));
        o.setCoords();
        c.add(o);
      }
      c.discardActiveObject();
      restoreSelection(c, objs);
      markDirty(key); c.requestRenderAll(); history.push(key);
      syncInspector();
      return;
    }
    if (mod && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      for (const o of c.getActiveObjects()) {
        if (e.key === ']') c.bringObjectForward(o); else c.sendObjectBackwards(o);
      }
      markDirty(key); c.requestRenderAll(); history.push(key);
      syncInspector();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key.startsWith('Arrow')) {
      const target = c.getActiveObject();
      if (!target) return;
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      target.setXY(target.getXY().add(new fabric.Point(dx, dy)));
      target.setCoords();
      markDirty(key); c.requestRenderAll();
      nudgeCommit(key);                    // uma seta segurada vira UMA entrada, não quarenta
      syncInspector();
      return;
    }
    if (!mod && k === 't') { e.preventDefault(); await addText(); }
  });

  document.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) flushNudge(); });
}

/* ---------------- init ---------------- */
export function initLiveryEditor() {
  bindToolbar();
  bindTypography();
  bindTransform();
  bindImage();
  bindAlign();
  bindMirror();
  bindDnD();
  bindKeys();
  bindWheelZoom();
  bindStagePan();
  /* Depois dos binds e antes dos ouvintes do fabric: ele monta DOM dentro do
     inspetor e se inscreve nas mudanças de medida, e nada aqui em baixo depende
     disso ter acontecido. */
  initLiveryMeasures();

  for (const btn of $$('#surface-tabs .tab')) {
    btn.addEventListener('click', () => showSurface(btn.dataset.surface as SurfaceKey));
  }
  for (const card of $$('.preview-card')) {
    card.addEventListener('click', () => openEditor(card.dataset.surface as SurfaceKey));
  }

  $('modal-close').addEventListener('click', closeEditor);
  modal().addEventListener('pointerdown', (e) => { if (e.target === modal()) closeEditor(); });
  window.addEventListener('resize', () => { if (isOpen()) resize(); });

  /* O RETRATO CHEGA DEPOIS, E O PALCO TEM DE ACOMPANHAR.
     A caixa da tela do fabric sai de `snap.box` (ver `sizeModalCanvas`), e o
     retrato é assíncrono desde que deixou de travar a página: uma porta nova ou
     uma altura nova mudam a caixa da chapa, e a foto com a caixa nova aterrissa
     alguns quadros depois. Sem este reenquadramento o palco ficaria com a
     medida do retrato ANTERIOR até o próximo resize de janela — que é o mesmo
     desencontro que este trabalho está removendo, só que atrasado.
     Injetado porque a seta de import aponta daqui para `vehicle/livery`, e só
     este arquivo sabe o zoom corrente. */
  setStageResizer((key) => { if (isOpen() && key === activeKey()) resize(); });

  /* ANTES do laço abaixo, de propósito: os handlers do fabric disparam na ordem
     de registro, e o encaixe (que roda no object:modified) precisa ajustar a
     posição antes de o histórico gravá-la. Registrado depois, o desfazer
     voltaria para a posição de antes do ajuste — um lugar onde o objeto nunca
     esteve. */
  initSnapping(() => { if (isOpen()) updateFoot(selObjects()); });
  resizeSnapLayers();

  for (const k of SURFACE_KEYS) {
    const c = surfaces[k];

    for (const ev of ['selection:created', 'selection:updated'] as const) {
      c.on(ev, () => { if (k === activeKey()) syncInspector(); });
    }

    /* Escalar uma multi-seleção deixa o fator na ActiveSelection e só o assa nos
       filhos quando a seleção é desfeita — bem depois de object:modified. Então
       normaliza aqui também, ou o campo de corpo mente sobre um texto
       redimensionado em grupo. */
    c.on('selection:cleared', () => {
      if (isRestoring()) return;
      let changed = false;
      c.forEachObject((o) => { if (normalizeTextScale(o)) changed = true; });
      if (changed) { markDirty(k); c.requestRenderAll(); history.push(k); }
      if (k === activeKey()) syncInspector();
    });

    c.on('object:modified', (opt) => {
      if (isRestoring()) return;
      const target = opt.target as fabric.FabricObject | undefined;
      if (target instanceof fabric.ActiveSelection) target.getObjects().forEach(normalizeTextScale);
      else if (target) normalizeTextScale(target);
      markDirty(k); c.requestRenderAll();
      history.push(k);
      if (k === activeKey()) syncInspector();
    });

    c.on('text:changed', (opt) => {
      const t = opt.target as AnyObj | undefined;
      if (t && !t.renamed) t.name = defaultName(t);
      if (k === activeKey()) { renderLayers(); updateToolbarState(); }
    });
    c.on('text:editing:exited', () => history.push(k));
  }

  bindPersistFlush();

  /* Semeia o estado vazio de forma SÍNCRONA: restorePersisted() é assíncrono, e
     uma edição que chegasse antes dele resolver empilharia sobre uma pilha sem
     base, deixando a primeira ação impossível de desfazer. */
  for (const k of SURFACE_KEYS) history.seed(k);
  void restorePersisted()
    .then((ok) => { if (ok) for (const k of SURFACE_KEYS) history.push(k); })
    .finally(() => syncInspector());
}
