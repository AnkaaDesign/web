/* Livery editing: THREE independent fabric canvases (left side, right side,
   rear) + CanvasTextures on the trailer's LiveryUV (TEXCOORD_1), large modal
   editor, panel-outline guides, previews, drag&drop. */
import * as THREE from 'three';
import * as fabric from 'fabric';
import { root, $, $$, isMounted, evTarget } from '../core/dom';
import { VEHICLES_DIR } from '../core/paths';
import { setPaintTarget } from './models';
import { setStatus } from '../ui/chrome';

/** The three paintable trailer panels. Every per-surface map is keyed by this. */
export type SurfaceKey = 'left' | 'right' | 'rear';

/** The subset of trailer_meta.json this module reads. */
export interface OutlineMeta {
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/* ---------------- fabric canvases (live in the modal, always exist) -------- */
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
export const fabLeft = makeFab($<HTMLCanvasElement>('fabric-left'));
export const fabRight = makeFab($<HTMLCanvasElement>('fabric-right'));
export const fabRear = makeFab($<HTMLCanvasElement>('fabric-rear'));

const surfaces: Record<SurfaceKey, fabric.Canvas> = { left: fabLeft, right: fabRight, rear: fabRear };
const SURFACE_KEYS: SurfaceKey[] = ['left', 'right', 'rear'];
let activeSurface: SurfaceKey = 'left';
const active = () => surfaces[activeSurface];

const CAPTIONS: Record<SurfaceKey, string> = {
  left: 'Lateral esquerda · pintura fica dentro da silhueta tracejada',
  right: 'Lateral direita · pintura fica dentro da silhueta tracejada',
  rear: 'Portas traseiras · pintura fica dentro da silhueta tracejada',
};

/* ---------------- textures ---------------- */
function makeTex(el: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(el);
  t.flipY = false;                      // matches glTF-exported LiveryUV orientation
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const texLeft = makeTex(fabLeft.lowerCanvasEl);
export const texRight = makeTex(fabRight.lowerCanvasEl);
export const texRear = makeTex(fabRear.lowerCanvasEl);
const textures: Record<SurfaceKey, THREE.CanvasTexture> = { left: texLeft, right: texRight, rear: texRear };

/* ---------------- 3D overlays ---------------- */
export const liveryMeshes: Record<SurfaceKey, THREE.Mesh[]> = { left: [], right: [], rear: [] };

/* NO polygonOffset. It was here to win the depth test against the panel this
   overlay sits on, and it is not needed for that: the overlay SHARES the panel's
   geometry and is drawn later (renderOrder 2, and the transparent pass runs after
   the opaque one), so at equal depth three's default LessEqualDepth already lets
   it through.
 *
 * What the bias did instead was leak. `polygonOffsetFactor: -1` is SLOPE-SCALED:
 * the steeper the surface runs away from the camera, the further forward the
 * fragment is pushed. Sighting along the flank — which is the whole point of a
 * 15 m trailer — that slope is enormous, and the overlay was being pulled far
 * enough forward to pass the depth test IN FRONT OF THE PERIMETER RAIL that runs
 * along its bottom edge. The rail then read as a wide band of body colour that
 * snapped back to metal when the camera moved a few degrees.
 *
 * Kennedy's own observation is what identifies it, and it is decisive: the defect
 * is there in WHITE and gone when the implement is PAINTED. Painting changes two
 * things, and only one of them touches this overlay — `setBackgroundsForPaint()`
 * clears the canvas background to transparent, so the overlay stops covering
 * anything. The bias was still there; there was simply nothing left to draw with
 * it. Everything else about the two states is identical. */
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
  return overlay;
}

export function attachOverlays(trailerRoot: THREE.Object3D) {
  trailerRoot.traverse(node => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    if (o.name === 'SIDE_L') liveryMeshes.left.push(makeLiveryOverlay(o, texLeft));
    else if (o.name === 'SIDE_R') liveryMeshes.right.push(makeLiveryOverlay(o, texRight));
    else if (o.name === 'REAR') liveryMeshes.rear.push(makeLiveryOverlay(o, texRear));
  });
}

/* ---------------- panel outline guides ---------------- */
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

/* ---------------- sidebar previews ---------------- */
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

for (const k of SURFACE_KEYS) {
  surfaces[k].on('after:render', () => {
    textures[k].needsUpdate = true;
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

const PANEL_IMAGE: Record<SurfaceKey, string> = {
  left: VEHICLES_DIR + 'panels/lateral.png',
  right: VEHICLES_DIR + 'panels/lateral.png',
  rear: VEHICLES_DIR + 'panels/traseira.png',
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

/* ---------------- modal ---------------- */
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

export function openEditor(key?: SurfaceKey) {
  modal.classList.remove('hidden');
  showSurface(key || activeSurface);
}
export function closeEditor() {
  for (const c of Object.values(surfaces)) {
    c.isDrawingMode = false;
    c.discardActiveObject();
    c.requestRenderAll();
  }
  $$('.tool').forEach(b => b.classList.remove('on'));
  modal.classList.add('hidden');
}

/* ---------------- tools ---------------- */
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

/* When the trailer panels are painted with the cab color, the livery canvases'
   solid white default background would hide the paint — switch backgrounds to
   transparent while painted, and restore the previous background after. */
/* The stashed background lives in a WeakMap rather than on the canvas: fabric's
   Canvas has no slot for it, and a side table keeps the "was it stashed at all?"
   question (which DEFAULT_BG vs. restore turns on) explicit. */
const bgBeforePaint = new WeakMap<fabric.Canvas, string | fabric.TFiller | undefined>();

export function setBackgroundsForPaint(painted: boolean) {
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

/* ---------------- drag & drop images onto the modal canvas ---------------- */
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

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!isMounted() || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeEditor(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const c = active();
      const o = c.getActiveObject();
      if (o && (o as fabric.IText).isEditing) return;   // typing inside IText
      c.getActiveObjects().forEach((obj) => c.remove(obj));
      c.discardActiveObject(); c.requestRenderAll();
    }
  });

  window.addEventListener('resize', () => {
    if (!modal.classList.contains('hidden')) sizeModalCanvas(activeSurface);
  });

  for (const k of SURFACE_KEYS) {
    installGuide(k);
    surfaces[k].requestRenderAll();
    drawPreview(k);
  }

  /* Watchdog: 2D canvas buffers can be discarded under GPU memory pressure
     (big models) and requestRenderAll depends on rAF, which stalls when the
     page isn't compositing. A periodic SYNCHRONOUS renderAll repaints from
     fabric's object model and re-fires after:render (texture + previews). */
  setInterval(() => {
    if (!isMounted()) return;                     // route left the studio — nothing to repaint
    try { for (const c of Object.values(surfaces)) c.renderAll(); } catch { /* ignore */ }
  }, 4000);
}
