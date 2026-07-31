/* Livery editing: THREE independent fabric canvases (left side, right side,
   rear) + CanvasTextures on the trailer's LiveryUV (TEXCOORD_1), large modal
   editor, panel-outline guides, previews, drag&drop. */
import * as THREE from 'three';
import * as fabric from 'fabric';
import { $, $$, isMounted, evTarget } from '../core/dom';

/** The three paintable trailer panels. Every per-surface map is keyed by this. */
export type SurfaceKey = 'left' | 'right' | 'rear';

/** The subset of trailer_meta.json this module reads. */
export interface OutlineMeta {
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/* ---------------- fabric canvases (live in the modal, always exist) -------- */
/* default WHITE like the trailer's white panels; "×" clears to transparent
   (original aluminum) and only then the checkerboard shows through */
const DEFAULT_BG = '#ffffff';

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

function makeLiveryOverlay(mesh: THREE.Mesh, texture: THREE.CanvasTexture) {
  texture.channel = 1;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    metalness: 0.1,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
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

/* ---------------- modal ---------------- */
const modal = $('editor-modal');
const stage = $('modal-stage');
const stagePanels: Record<SurfaceKey, HTMLElement> =
  { left: $('stage-left'), right: $('stage-right'), rear: $('stage-rear') };

function sizeModalCanvas(fab: fabric.Canvas) {
  const maxW = stage.clientWidth - 40, maxH = stage.clientHeight - 40;
  const ar = fab.getWidth() / fab.getHeight();
  let w = maxW, h = w / ar;
  if (h > maxH) { h = maxH; w = h * ar; }
  fab.setDimensions({ width: w + 'px', height: h + 'px' }, { cssOnly: true });
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
  sizeModalCanvas(surfaces[key]);
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
    if (!modal.classList.contains('hidden')) sizeModalCanvas(active());
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
