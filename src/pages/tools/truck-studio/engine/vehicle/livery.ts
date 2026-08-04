/* Plotagem do implemento: TRÊS telas do fabric independentes (lateral esquerda,
   lateral direita, traseira) + CanvasTextures no LiveryUV da carreta
   (TEXCOORD_1), editor grande em modal, guias de silhueta do painel, prévias e
   arrastar-e-soltar. */
import * as THREE from 'three';
import * as fabric from 'fabric';
import { root, $, $$, isMounted, evTarget } from '../core/dom';
import { VEHICLES_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';
import { invalidate } from '../scene/scene';
import { setPaintTarget } from './models';
import { setStatus } from '../ui/chrome';

/** Os três painéis pintáveis do implemento. Toda tabela por superfície usa isto como chave. */
type SurfaceKey = 'left' | 'right' | 'rear';

/** O pedaço de trailer_meta.json que este módulo lê. */
export interface OutlineMeta {
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/* ---------------- telas do fabric (moram no modal, existem sempre) -------- */
/* TRANSPARENTE por padrão, e não mais branco.
   O branco existia para imitar o painel do baú num retângulo vazio. Agora o
   painel de verdade está ali atrás — a foto da lateral e a das portas, POR BAIXO
   da tela, tanto no card quanto no editor (core/studio.css) — e um fundo branco
   opaco pintado por cima simplesmente a escondia.
   Consequência no 3D, que é a que importa: a tela vira textura do overlay
   (attachOverlays), então transparente = o baú aparece com o material dele
   mesmo. Era exatamente o que o branco produzia, só que agora sem uma camada de
   tinta branca por cima de tudo. O "Fundo" da barra continua podendo pintar a
   tela inteira de uma cor, e o "×" volta para cá. */
const DEFAULT_BG = '';

function makeFab(el: HTMLCanvasElement) {
  return new fabric.Canvas(el, { preserveObjectStacking: true, backgroundColor: DEFAULT_BG });
}
const fabLeft = makeFab($<HTMLCanvasElement>('fabric-left'));
const fabRight = makeFab($<HTMLCanvasElement>('fabric-right'));
const fabRear = makeFab($<HTMLCanvasElement>('fabric-rear'));

const surfaces: Record<SurfaceKey, fabric.Canvas> = { left: fabLeft, right: fabRight, rear: fabRear };
const SURFACE_KEYS: SurfaceKey[] = ['left', 'right', 'rear'];
let activeSurface: SurfaceKey = 'left';
const active = () => surfaces[activeSurface];

const CAPTIONS: Record<SurfaceKey, string> = {
  left: 'Lateral esquerda · pintura fica dentro da silhueta tracejada',
  right: 'Lateral direita · pintura fica dentro da silhueta tracejada',
  rear: 'Portas traseiras · pintura fica dentro da silhueta tracejada',
};

/* ---------------- texturas ---------------- */
function makeTex(el: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(el);
  t.flipY = false;                      // casa com a orientação do LiveryUV exportado em glTF
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const texLeft = makeTex(fabLeft.lowerCanvasEl);
const texRight = makeTex(fabRight.lowerCanvasEl);
const texRear = makeTex(fabRear.lowerCanvasEl);
const textures: Record<SurfaceKey, THREE.CanvasTexture> = { left: texLeft, right: texRight, rear: texRear };

/* ---------------- overlays 3D ---------------- */

/* SEM polygonOffset. Ele estava aqui para ganhar o teste de profundidade contra
   o painel sobre o qual este overlay se apoia, e não é preciso para isso: o
   overlay COMPARTILHA a geometria do painel e é desenhado depois (renderOrder 2,
   e a passada transparente roda depois da opaca), então, em profundidade igual,
   o LessEqualDepth padrão do three já o deixa passar.

   O que o viés fazia, em vez disso, era vazar. `polygonOffsetFactor: -1` é
   ESCALADO PELA INCLINAÇÃO: quanto mais a superfície foge da câmera, mais para a
   frente o fragmento é empurrado. Olhando ao longo da lateral — que é o ponto
   inteiro de uma carreta de 15 m — essa inclinação é enorme, e o overlay era
   puxado para a frente o bastante para passar no teste de profundidade NA FRENTE
   DA LONGARINA que corre pela borda de baixo. A longarina então aparecia como uma
   faixa larga da cor do baú, que voltava a ser metal quando a câmera girava
   alguns graus.

   A observação do próprio Kennedy é o que identifica isso, e é decisiva: o
   defeito existe no BRANCO e some quando o implemento está PINTADO. Pintar muda
   duas coisas, e só uma delas toca este overlay — `setBackgroundsForPaint()`
   limpa o fundo da tela para transparente, e aí o overlay deixa de cobrir
   qualquer coisa. O viés continuava lá; simplesmente não sobrou nada para
   desenhar com ele. Todo o resto dos dois estados é idêntico. */
function makeLiveryOverlay(mesh: THREE.Mesh, texture: THREE.CanvasTexture) {
  texture.channel = 1;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    metalness: 0.1,
    roughness: 0.55,
  });
  if (mat.map) mat.map.channel = 1;
  const overlay = new THREE.Mesh(mesh.geometry, mat);
  overlay.renderOrder = 2;
  mesh.add(overlay);
  overlay.position.set(0, 0, 0);
}

/* O overlay é FILHO do painel que ele cobre, e é só isso que precisa ser
   verdade: a textura já é compartilhada e viva, e o descarte vem junto com o
   descarte do baú. Havia aqui um registro `liveryMeshes` que colecionava os três
   arrays — nada nunca o leu, e um índice que só é escrito é uma referência que
   segura geometria depois de a carreta ter sido trocada. */
export function attachOverlays(trailerRoot: THREE.Object3D) {
  trailerRoot.traverse(node => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    if (o.name === 'SIDE_L') makeLiveryOverlay(o, texLeft);
    else if (o.name === 'SIDE_R') makeLiveryOverlay(o, texRight);
    else if (o.name === 'REAR') makeLiveryOverlay(o, texRear);
  });
}

/* ---------------- guias de silhueta do painel ---------------- */
const FALLBACK_OUTLINE = [[0.015, 0.015], [0.985, 0.015], [0.985, 0.985], [0.015, 0.985]];
const outlines: Record<SurfaceKey, number[][]> =
  { left: FALLBACK_OUTLINE, right: FALLBACK_OUTLINE, rear: FALLBACK_OUTLINE };

function guideMarkup(poly: number[][], w: number, h: number) {
  const pts = poly.map(([u, v]) => [u * w, (1 - v) * h]);
  const path = 'M ' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') + ' Z';
  const sw = Math.max(2, w / 480);
  return `
    <path d="M0 0 H${w} V${h} H0 Z ${path}" fill="rgba(8,10,16,.5)" fill-rule="evenodd"/>
    <path d="${path}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="${sw}"
      stroke-dasharray="${sw * 4} ${sw * 3}" vector-effect="non-scaling-stroke"/>`;
}

function installGuide(key: SurfaceKey) {
  const fab = surfaces[key];
  const w = fab.getWidth(), h = fab.getHeight();
  const wrap = fab.wrapperEl;
  let svg = wrap.querySelector('.guide-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('guide-svg');
    wrap.appendChild(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = guideMarkup(outlines[key], w, h);
}

export function setOutlines(meta: OutlineMeta | null) {
  if (meta && Array.isArray(meta.outlineSide) && meta.outlineSide.length >= 3) {
    outlines.left = meta.outlineSide;
    outlines.right = meta.outlineSide;
  }
  if (meta && Array.isArray(meta.outlineRear) && meta.outlineRear.length >= 3) {
    outlines.rear = meta.outlineRear;
  }
  for (const k of SURFACE_KEYS) { installGuide(k); drawPreview(k); }
}

/* ---------------- prévias dos cards de design (#ts-panels) ---------------- */
const prevEls: Record<SurfaceKey, HTMLCanvasElement> = {
  left: $<HTMLCanvasElement>('prev-left'),
  right: $<HTMLCanvasElement>('prev-right'),
  rear: $<HTMLCanvasElement>('prev-rear'),
};
const prevPending: Record<SurfaceKey, boolean> = { left: false, right: false, rear: false };

function drawPreview(key: SurfaceKey) {
  const pc = prevEls[key];
  const ctx = pc?.getContext('2d');
  if (!pc || !ctx) return;
  const src = surfaces[key].lowerCanvasEl;
  ctx.clearRect(0, 0, pc.width, pc.height);
  ctx.drawImage(src, 0, 0, pc.width, pc.height);
  const poly = outlines[key];
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  poly.forEach(([u, v]: number[], i: number) => {
    const x = u * pc.width, y = (1 - v) * pc.height;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function schedulePreview(key: SurfaceKey) {
  if (prevPending[key]) return;
  prevPending[key] = true;
  requestAnimationFrame(() => { prevPending[key] = false; drawPreview(key); });
}

/* O ÚNICO ponto em que a textura da plotagem é marcada como suja, e por isso
   também o único de onde o laço de render precisa ser avisado.

   As duas metades andam juntas e é de propósito que estejam na mesma linha:
   - `needsUpdate` manda a CanvasTexture inteira para a GPU (as três somam ~13 MB,
     mais a regeneração dos mipmaps), então marcar sem necessidade é caro;
   - `invalidate()` diz ao laço sob demanda de scene/scene.ts que o quadro mudou.
     Sem isso, com o laço ligado, desenhar no baú NÃO chegaria ao 3D: o fabric
     dispara este evento a partir dos próprios handlers de ponteiro e do próprio
     rAF dele, que o laço não observa. Um quadro só bastaria; invalidate() já
     compra três, o que cobre um upload que aterrisse no quadro seguinte.

   A passada do watchdog é a exceção — ela se anuncia por `watchdogPass` para não
   fazer nem um nem outro, porque normalmente repinta pixels idênticos. Ver o
   bloco do watchdog no fim do arquivo.
   A bandeira é declarada AQUI, e não junto do watchdog: ela é lida por este
   ouvinte, que é registrado na avaliação do módulo. */
let watchdogPass = false;

function publishSurface(k: SurfaceKey) {
  textures[k].needsUpdate = true;
  invalidate();
}

for (const k of SURFACE_KEYS) {
  surfaces[k].on('after:render', () => {
    if (!watchdogPass) publishSurface(k);
    schedulePreview(k);
  });
}

/* ---------------- a foto do painel, e a janela dentro dela ----------------
   Cada superfície tem uma FOTO do painel real com o painel VAZADO: a lataria,
   os frisos, as dobradiças e a borracha central das portas são opacos, e onde
   entra tinta é transparente. A tela do fabric é montada exatamente sobre esse
   vazio e por BAIXO da foto — é isso que faz um texto atravessado pela borracha
   aparecer cortado no editor do mesmo jeito que vai sair no baú.

   Onde fica o vazio é MEDIDO na própria imagem, não escrito à mão: as fotos são
   reexportadas (as duas mudaram no meio desta sessão), e um retângulo fixo no
   código estaria errado no dia seguinte sem avisar ninguém.

   Como se mede, e por que não é só a caixa dos pixels transparentes: o fundo em
   volta do caminhão também é transparente, e ele encosta na borda da imagem. O
   que caracteriza a JANELA é ser transparente e estar CERCADA — então uma linha
   só conta se o trecho vazio dela tiver pixel opaco dos dois lados, a mesma
   regra vale por coluna, e a janela é a interseção das duas. O fundo cai fora
   por tocar a borda; a folga entre as lanternas do teto cai fora por não ser
   cercada na vertical. */
interface PanelWindow {
  /** proporção da FOTO inteira (largura/altura) */
  photoAr: number;
  /** posição e tamanho da janela, em fração da foto */
  x: number; y: number; w: number; h: number;
}

/* URL SERVÍVEL, não caminho de manifesto: a árvore do studio mora na API sob
   `STUDIO_BASE`, e `core/paths.ts` só entrega o pedaço relativo. Um
   `VEHICLES_DIR + 'panels/lateral.png'` cru resolveria contra a origem do WEB,
   que não tem mais os arquivos — e o sintoma seria um 404 mudo, porque as duas
   coisas que consomem isto (o `url()` da variável CSS e o `new Image()` da
   medição) degradam em silêncio.
   `assetUrl()` é idempotente por contrato, então resolver AQUI, uma vez, é o
   suficiente; os dois consumidores usam o valor como está. */
const PANEL_IMAGE: Record<SurfaceKey, string> = {
  left: assetUrl(VEHICLES_DIR + 'panels/lateral.png'),
  right: assetUrl(VEHICLES_DIR + 'panels/lateral.png'),
  rear: assetUrl(VEHICLES_DIR + 'panels/traseira.png'),
};

/* Sem medida ainda (ou foto sem janela): a tela ocupa a caixa inteira e a foto
   volta a ficar ATRÁS dela — ver .ts-pw-ready em core/studio.css. Um fallback
   que deixasse a foto opaca por cima esconderia o desenho inteiro. */
const windows: Partial<Record<SurfaceKey, PanelWindow>> = {};

/** alpha até aqui conta como vazado — margem para o antialias da borda */
const CLEAR_A = 8;

function findWindow(img: HTMLImageElement): PanelWindow | null {
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, W, H).data; }
  catch { return null; }                       // canvas de outra origem

  const clear = (px: number, py: number) => data[(py * W + px) * 4 + 3] <= CLEAR_A;
  /* Trechos curtos são frestas entre ferragens, não painel. 2% de cada eixo. */
  const minRunX = Math.max(4, Math.round(W * 0.02));
  const minRunY = Math.max(4, Math.round(H * 0.02));
  const hIn = new Uint8Array(W * H), vIn = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    let s = -1;
    for (let px = 0; px <= W; px++) {
      const isClear = px < W && clear(px, y);
      if (isClear) { if (s < 0) s = px; continue; }
      if (s < 0) continue;
      const e = px - 1;
      if (s > 0 && e < W - 1 && e - s + 1 >= minRunX) {
        for (let i = s; i <= e; i++) hIn[y * W + i] = 1;
      }
      s = -1;
    }
  }
  for (let px = 0; px < W; px++) {
    let s = -1;
    for (let y = 0; y <= H; y++) {
      const isClear = y < H && clear(px, y);
      if (isClear) { if (s < 0) s = y; continue; }
      if (s < 0) continue;
      const e = y - 1;
      if (s > 0 && e < H - 1 && e - s + 1 >= minRunY) {
        for (let i = s; i <= e; i++) vIn[i * W + px] = 1;
      }
      s = -1;
    }
  }

  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      if (!hIn[y * W + px] || !vIn[y * W + px]) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;                   // foto sem janela: opaca
  const w = (maxX - minX + 1) / W, h = (maxY - minY + 1) / H;
  /* Uma janela minúscula é medida errada (uma sombra vazada, um recorte solto),
     e aceitar isso encolheria a tela de desenho a um selo no meio da foto. */
  if (w < 0.2 || h < 0.2) return null;
  return { photoAr: W / H, x: minX / W, y: minY / H, w, h };
}

const pct = (v: number) => (v * 100).toFixed(3) + '%';

/* Publica a janela nas duas superfícies que a mostram — o card sobre o render e
   o palco do editor. Vai em variáveis CSS porque quem desenha isso é o CSS;
   daqui sai só a medida. */
function publishWindow(key: SurfaceKey, win: PanelWindow) {
  windows[key] = win;
  const targets = [
    root.querySelector<HTMLElement>('.preview-card[data-surface="' + key + '"]'),
    stagePanels[key],
  ];
  for (const el of targets) {
    if (!el) continue;
    el.style.setProperty('--ts-pw-img', 'url("' + PANEL_IMAGE[key] + '")');
    el.style.setProperty('--ts-pw-ar', String(win.photoAr));
    el.style.setProperty('--ts-pw-x', pct(win.x));
    el.style.setProperty('--ts-pw-y', pct(win.y));
    el.style.setProperty('--ts-pw-w', pct(win.w));
    el.style.setProperty('--ts-pw-h', pct(win.h));
    el.classList.add('ts-pw-ready');
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    /* NÃO é cortesia de CORS: esta imagem é DESENHADA num canvas que findWindow()
       lê de volta com getImageData() para medir a janela vazada. Uma imagem de
       outra origem carregada sem CORS CONTAMINA o canvas, o getImageData lança
       SecurityError, e o `catch { return null }` de lá engole o erro — a medida
       simplesmente não acontece e o editor cai no fallback sem nada no console
       dizendo por quê.
       Não aparece em dev: o proxy do Vite faz a requisição same-origin. Só morde
       quando VITE_STUDIO_ASSETS_BASE aponta para a origem da API — produção. A
       API responde `Access-Control-Allow-Origin: *`, então isto basta.
       Antes de `src`, sempre: o atributo só vale se estiver posto quando a
       requisição parte. */
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
    img.src = url;
  });
}

/* Mede uma vez por ARQUIVO: as duas laterais usam a mesma foto, e varrer 1,7 M
   de pixels duas vezes para chegar ao mesmo número é trabalho jogado fora. */
async function measurePanelWindows() {
  const byUrl = new Map<string, Promise<PanelWindow | null>>();
  await Promise.all(SURFACE_KEYS.map(async (key) => {
    const url = PANEL_IMAGE[key];
    let job = byUrl.get(url);
    if (!job) {
      job = loadImage(url).then((img) => (img ? findWindow(img) : null));
      byUrl.set(url, job);
    }
    const win = await job;
    if (!win) {
      console.warn('[truck-studio] a foto do painel "' + key + '" não tem janela vazada —'
        + ' o desenho segue POR CIMA dela (comportamento antigo). Exporte o PNG com o'
        + ' painel transparente para o desenho entrar por baixo da ferragem.');
      return;
    }
    publishWindow(key, win);
    sizePreviewCanvas(key);
    drawPreview(key);
  }));
}

/* A prévia do card é um canvas de tamanho fixo no template; se a janela medida
   tiver outra proporção, o buffer é reajustado para o desenho não sair
   espremido dentro dele. Só a ALTURA muda — a largura é a resolução escolhida. */
function sizePreviewCanvas(key: SurfaceKey) {
  const win = windows[key];
  const pc = prevEls[key];
  if (!win || !pc) return;
  const fab = surfaces[key];
  const h = Math.max(24, Math.round(pc.width * (fab.getHeight() / fab.getWidth())));
  if (pc.height !== h) pc.height = h;
}

/* ---------------- cor do implemento ----------------
   O que aparece ATRÁS da arte, pela janela: o baú branco de fábrica ou, quando
   "pintar o implemento" está ligado, a mesma tinta do cavalo. Uma variável CSS
   porque os dois lugares que a mostram (card e editor) são desenhados por CSS,
   e porque assim não há um segundo estado a manter em sincronia. */
const IMPLEMENT_WHITE = '#ffffff';
let cabPaintHex = IMPLEMENT_WHITE;
let paintedImplement = false;

function syncImplementColor() {
  root.style.setProperty('--ts-implement', paintedImplement ? cabPaintHex : IMPLEMENT_WHITE);
}

/** A tinta escolhida para o cavalo; studio.ts chama a cada aplicação de cor. */
export function setCabPaintColor(hex: string | null | undefined) {
  cabPaintHex = hex || IMPLEMENT_WHITE;
  syncImplementColor();
}

/* ---------------- editor em modal ---------------- */
const modal = $('editor-modal');
const stage = $('modal-stage');
const stagePanels: Record<SurfaceKey, HTMLElement> =
  { left: $('stage-left'), right: $('stage-right'), rear: $('stage-rear') };

/* Duas caixas, não uma: a FOTO é o que ocupa o palco, e a tela é a janela dentro
   dela. Antes só existia a tela, e era ela que era enquadrada. */
function sizeModalCanvas(key: SurfaceKey) {
  const fab = surfaces[key];
  const win = windows[key];
  const panel = stagePanels[key];
  const maxW = stage.clientWidth - 40, maxH = stage.clientHeight - 40;
  if (maxW <= 0 || maxH <= 0) return;         // modal ainda sem layout

  const outerAr = win ? win.photoAr : fab.getWidth() / fab.getHeight();
  let w = maxW, h = w / outerAr;
  if (h > maxH) { h = maxH; w = h * outerAr; }

  panel.style.width = w + 'px';
  panel.style.height = h + 'px';
  fab.setDimensions(
    { width: (win ? w * win.w : w) + 'px', height: (win ? h * win.h : h) + 'px' },
    { cssOnly: true },
  );
  fab.calcOffset();
}

function showSurface(key: SurfaceKey) {
  activeSurface = key;
  for (const c of Object.values(surfaces)) c.isDrawingMode = false;
  $$('.tool').forEach(b => b.classList.remove('on'));
  for (const k of SURFACE_KEYS) stagePanels[k].classList.toggle('hidden', k !== key);
  $$('#surface-tabs .tab').forEach(b =>
    b.classList.toggle('active', b.dataset.surface === key));
  $('editor-caption').textContent = CAPTIONS[key];
  sizeModalCanvas(key);
}

function openEditor(key?: SurfaceKey) {
  modal.classList.remove('hidden');
  showSurface(key || activeSurface);
}
function closeEditor() {
  for (const c of Object.values(surfaces)) {
    c.isDrawingMode = false;
    c.discardActiveObject();
    c.requestRenderAll();
  }
  $$('.tool').forEach(b => b.classList.remove('on'));
  modal.classList.add('hidden');
}

/* ---------------- ferramentas ---------------- */
const colorInput = $<HTMLInputElement>('color');
const currentColor = () => colorInput.value;

function setDrawMode(btn: HTMLElement) {
  $$('.tool').forEach(b => b.classList.remove('on'));
  for (const c of Object.values(surfaces)) c.isDrawingMode = false;
  btn.classList.add('on');
  const c = active();
  c.isDrawingMode = true;
  c.freeDrawingBrush = new fabric.PencilBrush(c);
  c.freeDrawingBrush.color = currentColor();
  c.freeDrawingBrush.width = +$<HTMLInputElement>('brush').value;
}
function stopDrawMode() {
  $$('.tool').forEach(b => b.classList.remove('on'));
  for (const c of Object.values(surfaces)) c.isDrawingMode = false;
}

function addImageFile(file: File, x?: number | null, y?: number | null) {
  const url = URL.createObjectURL(file);
  fabric.FabricImage.fromURL(url).then(img => {
    const c = active();
    const s = Math.min(c.getWidth() / 3 / img.width, c.getHeight() / 1.6 / img.height);
    img.set({
      left: x ?? c.getWidth() / 2, top: y ?? c.getHeight() / 2,
      originX: 'center', originY: 'center',
      scaleX: s, scaleY: s,
    });
    c.add(img);
    c.setActiveObject(img);
    URL.revokeObjectURL(url);
  }).catch(err => console.error('logo:', err));
}

function bindTools() {
  $$('.modal-toolbar .tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      const c = active();
      const mid = { left: c.getWidth() / 2, top: c.getHeight() / 2 };
      if (act !== 'draw') stopDrawMode();
      switch (act) {
        case 'text': {
          const t = new fabric.IText('Sua marca', {
            ...mid, originX: 'center', originY: 'center',
            fontFamily: 'Arial Black', fontSize: c.getHeight() / 4,
            fill: currentColor(),
          });
          c.add(t); c.setActiveObject(t);
          break;
        }
        case 'logo': $('logo-input').click(); break;
        case 'draw': setDrawMode(btn); break;
        case 'rect': {
          const r = new fabric.Rect({
            ...mid, originX: 'center', originY: 'center',
            width: c.getWidth() / 4, height: c.getHeight() / 2.4,
            fill: currentColor(),
          });
          c.add(r); c.setActiveObject(r);
          break;
        }
        case 'circle': {
          const ci = new fabric.Circle({
            ...mid, originX: 'center', originY: 'center',
            radius: c.getHeight() / 4, fill: currentColor(),
          });
          c.add(ci); c.setActiveObject(ci);
          break;
        }
        case 'delete': {
          c.getActiveObjects().forEach((o) => c.remove(o));
          c.discardActiveObject(); c.requestRenderAll();
          break;
        }
        case 'clear':
          c.getObjects().slice().forEach((o) => c.remove(o));
          c.backgroundColor = DEFAULT_BG;
          c.requestRenderAll();
          break;
        case 'front': {
          const o = c.getActiveObject();
          if (o) { c.bringObjectToFront(o); c.requestRenderAll(); }
          break;
        }
        case 'back': {
          const o = c.getActiveObject();
          if (o) { c.sendObjectToBack(o); c.requestRenderAll(); }
          break;
        }
      }
    });
  });

  $('logo-input').addEventListener('change', (e) => {
    const input = evTarget<HTMLInputElement>(e);
    const file = input.files?.[0];
    if (file) addImageFile(file);
    input.value = '';
  });

  colorInput.addEventListener('input', () => {
    const c = active();
    const o = c.getActiveObject();
    if (o) { o.set('fill', currentColor()); c.requestRenderAll(); }
    if (c.isDrawingMode && c.freeDrawingBrush) c.freeDrawingBrush.color = currentColor();
  });

  $('brush').addEventListener('input', (e) => {
    const { value } = evTarget<HTMLInputElement>(e);
    for (const c of Object.values(surfaces)) {
      if (c.freeDrawingBrush) c.freeDrawingBrush.width = +value;
    }
  });

  $('bgcolor').addEventListener('input', (e) => {
    const c = active();
    c.backgroundColor = evTarget<HTMLInputElement>(e).value;
    c.requestRenderAll();
  });
  $('bg-clear').addEventListener('click', () => {
    const c = active();
    c.backgroundColor = '';
    c.requestRenderAll();
  });
}

/* Com os painéis do baú pintados da cor do cavalo, o fundo branco opaco das
   telas do fabric esconderia a tinta — então o fundo vira transparente enquanto
   está pintado, e volta ao que era depois.
   O fundo guardado mora num WeakMap, e não na própria tela: o Canvas do fabric
   não tem campo para isso, e uma tabela ao lado mantém explícita a pergunta
   "chegou a ser guardado?", que é justamente a que decide entre DEFAULT_BG e
   restaurar. */
const bgBeforePaint = new WeakMap<fabric.Canvas, string | fabric.TFiller | undefined>();

function setBackgroundsForPaint(painted: boolean) {
  for (const c of Object.values(surfaces)) {
    if (painted) {
      bgBeforePaint.set(c, c.backgroundColor);
      c.backgroundColor = '';
    } else {
      const prev = bgBeforePaint.get(c);
      c.backgroundColor = (prev === undefined || prev === null) ? DEFAULT_BG : prev;
      bgBeforePaint.delete(c);
    }
    c.renderAll();
  }
}

/* ---------------- "pintar o implemento com a cor do cavalo" ----------------
   O controle mora na barra do editor grande, e não junto da escolha de cor: a
   cor é do CAVALO (passo do seletor), e estendê-la ao baú é uma decisão sobre o
   IMPLEMENTO — tomada olhando para o painel que vai receber a tinta.

   As duas metades têm de andar juntas, e é por isso que estão na mesma função:
   models.setPaintTarget('both') troca o material dos painéis do baú pela tinta
   do cavalo, e setBackgroundsForPaint(true) tira o fundo BRANCO das telas do
   fabric — sem isso o branco continuaria desenhado POR CIMA da tinta e o
   implemento seguiria branco na tela. Desligar restaura o branco de fábrica.
   Ligar/desligar não mexe em nada que o usuário tenha desenhado: o que sai e
   volta é só o fundo. */
function bindTrailerPaint() {
  $('paint-trailer').addEventListener('change', (e) => {
    const { checked } = evTarget<HTMLInputElement>(e);
    setPaintTarget(checked ? 'both' : 'cab');
    setBackgroundsForPaint(checked);
    /* A chapa que aparece pela janela do painel segue a mesma decisão: ligado,
       o baú é da cor do cavalo, e o editor tem de mostrar a arte sobre ELA — um
       desenho que sumia no branco pode gritar sobre o vermelho, e vice-versa. */
    paintedImplement = checked;
    syncImplementColor();
    setStatus(checked
      ? 'Pintura aplicada à cabine e ao implemento (incluindo a frente)'
      : 'Pintura somente na cabine');
  });
}

/* ---------------- arrastar imagens para a tela do modal ---------------- */
function bindDnD() {
  let depth = 0;
  stage.addEventListener('dragenter', e => {
    e.preventDefault();
    if (++depth > 0) stage.classList.add('dragging');
  });
  stage.addEventListener('dragleave', e => {
    e.preventDefault();
    if (--depth <= 0) { depth = 0; stage.classList.remove('dragging'); }
  });
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    stage.classList.remove('dragging');
    const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    const c = active();
    const rect = c.upperCanvasEl.getBoundingClientRect();
    let x = null, y = null;
    if (rect.width && rect.height &&
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      x = (e.clientX - rect.left) / rect.width * c.getWidth();
      y = (e.clientY - rect.top) / rect.height * c.getHeight();
    }
    addImageFile(file, x, y);
  });
}

/* ---------------- watchdog ----------------
   Por que ele existe: um buffer de canvas 2D pode ser descartado sob pressão de
   memória de GPU (os modelos são grandes), e `requestRenderAll` depende de rAF,
   que para quando a página não está compondo. Uma repintura SÍNCRONA periódica
   redesenha a partir do modelo de objetos do fabric, que é a fonte de verdade.

   O que ele NÃO pode fazer é marcar a textura como suja em toda passada. Cada
   `needsUpdate` reenvia a CanvasTexture inteira para a GPU e regenera os mipmaps
   — as três somam ~13 MB — e, num estúdio parado, a repintura periódica produz
   exatamente os mesmos pixels. Era isso que acontecia: 13 MB de upload a cada 4
   segundos, pela vida inteira da aba, sem nada ter mudado.

   Então a passada se anuncia (`watchdogPass`, lido pelo `after:render` lá em
   cima) e depois compara uma ASSINATURA do que foi pintado. Só sobe o que
   mudou. As edições de verdade continuam subindo na hora, pelo caminho normal:
   elas não passam por aqui. */
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

/* Recorte minúsculo, e é o bastante: a assinatura só precisa distinguir "a
   repintura devolveu o que já estava lá" de "o buffer tinha sido descartado e
   voltou diferente" — e um buffer perdido volta em branco ou em lixo, que 24×24
   pixels denunciam de sobra. O que ela NÃO precisa detectar é edição fina; essa
   chega pelo after:render, que não é gated por nada disto. */
const PROBE = 24;
const probeCanvas = document.createElement('canvas');
probeCanvas.width = PROBE;
probeCanvas.height = PROBE;
const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
const probeSig: Partial<Record<SurfaceKey, number>> = {};

/** FNV-1a sobre os 2304 bytes do recorte. null = não deu para ler. */
function contentSignature(key: SurfaceKey): number | null {
  if (!probeCtx) return null;
  probeCtx.clearRect(0, 0, PROBE, PROBE);
  probeCtx.drawImage(surfaces[key].lowerCanvasEl, 0, 0, PROBE, PROBE);
  let data: Uint8ClampedArray;
  try { data = probeCtx.getImageData(0, 0, PROBE, PROBE).data; }
  catch { return null; }                       // canvas contaminado por outra origem
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h = Math.imul(h ^ data[i], 0x01000193);
  }
  return h >>> 0;
}

function watchdogTick() {
  if (!isMounted()) return;                    // a rota saiu do estúdio — nada a repintar
  watchdogPass = true;
  try {
    for (const k of SURFACE_KEYS) {
      surfaces[k].renderAll();
      const sig = contentSignature(k);
      /* null = a leitura falhou: marcar é o lado seguro do erro. Uma textura
         velha no caminhão é pior que um upload a mais. */
      if (sig === null || sig !== probeSig[k]) {
        probeSig[k] = sig ?? undefined;
        publishSurface(k);
      }
    }
  } catch { /* ignora */ }
  finally { watchdogPass = false; }
}

/* ---------------- ciclo de vida ----------------
   O DOM do engine sobrevive à rota (ver core/dom.ts), e é por isso que estes
   dois precisam de um par: um ouvinte em `document` e um `setInterval` ficariam
   vivos em TODAS as outras telas do Ankaa. Os dois já eram inertes lá — o
   keydown sai cedo por `isMounted()`, o intervalo também —, mas uma ferramenta
   3D não tem por que manter uma captura global em `document` numa página que
   não a mostra, e "inerte" é uma promessa que a próxima edição pode quebrar sem
   ninguém perceber. */
function onDocKeyDown(e: KeyboardEvent) {
  if (!isMounted() || modal.classList.contains('hidden')) return;
  if (e.key === 'Escape') { closeEditor(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const c = active();
    const o = c.getActiveObject();
    if (o && (o as fabric.IText).isEditing) return;   // digitando dentro de um IText
    c.getActiveObjects().forEach((obj) => c.remove(obj));
    c.discardActiveObject(); c.requestRenderAll();
  }
}

function onWindowResize() {
  if (!modal.classList.contains('hidden')) sizeModalCanvas(activeSurface);
}

/**
 * Liga os ouvintes globais e o watchdog. Idempotente — chame de mountStudio().
 * `initLivery()` já chama no fim, então o primeiro boot não precisa dela.
 */
export function resumeLivery() {
  document.addEventListener('keydown', onDocKeyDown);
  window.addEventListener('resize', onWindowResize);
  if (watchdogTimer === null) watchdogTimer = setInterval(watchdogTick, 4000);
}

/**
 * Desliga os dois. Idempotente — chame de unmountStudio().
 * Não desmonta nada do editor: as telas, as texturas e o que o usuário desenhou
 * continuam vivos, que é o ponto de o subárvore do engine sobreviver à rota.
 */
export function teardownLivery() {
  document.removeEventListener('keydown', onDocKeyDown);
  window.removeEventListener('resize', onWindowResize);
  if (watchdogTimer !== null) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

/* ---------------- init ---------------- */
export function initLivery() {
  bindTools();
  bindDnD();
  bindTrailerPaint();
  syncImplementColor();
  /* Fora do caminho crítico: são ~4,5 M de pixels varridos, e até a medida
     chegar os cards já estão desenhados com a foto atrás (o fallback). */
  void measurePanelWindows();

  $$('#surface-tabs .tab').forEach((btn) =>
    btn.addEventListener('click', () => showSurface(btn.dataset.surface as SurfaceKey)));

  $$('.preview-card').forEach((card) =>
    card.addEventListener('click', () => openEditor(card.dataset.surface as SurfaceKey)));

  $('modal-close').addEventListener('click', closeEditor);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) closeEditor(); });

  for (const k of SURFACE_KEYS) {
    installGuide(k);
    surfaces[k].requestRenderAll();
    drawPreview(k);
    probeSig[k] = contentSignature(k) ?? undefined;
  }

  resumeLivery();
}
