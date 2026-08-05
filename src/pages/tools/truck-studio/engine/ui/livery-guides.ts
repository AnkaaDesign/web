/* Guias de encaixe e as réguas em centímetros do editor de pintura.

   As guias são desenhadas num <canvas> PRÓPRIO por cima da pilha do fabric — e
   NUNCA como objetos fabric.Line. Tudo que entra na tela do fabric é desenhado
   no lowerCanvasEl, que É a textura do baú: uma linha de guia viraria uma faixa
   pintada no caminhão de verdade (e apareceria na lista de camadas, e em cada
   instantâneo do desfazer). É o mesmo motivo pelo qual a silhueta tracejada é um
   SVG irmão, e não um objeto. */
import * as fabric from 'fabric';
import { $, root } from '../core/dom';
import { surfaces, SURFACE_KEYS, active, activeKey, outlineFrame, panelMM } from '../vehicle/livery';
import type { SurfaceKey } from '../vehicle/livery';

let snapEnabled = true;
export const setSnapEnabled = (v: boolean) => { snapEnabled = v; };

const layers: Partial<Record<SurfaceKey, HTMLCanvasElement>> = {};
const guideState: { v: number[]; h: number[] } = { v: [], h: [] };

/* O encaixe é CALCULADO enquanto se arrasta e APLICADO ao soltar.
   Corrigir a posição a cada mousemove faz o objeto grudar e escorregar por
   baixo do cursor — a peça deixa de acompanhar a mão, e para sair de uma linha
   forte é preciso brigar com ela. Arrastando, o objeto vai exatamente para onde
   o cursor manda e as guias só MOSTRAM onde ele vai cair; o ajuste acontece no
   object:modified, num salto só, quando o gesto termina. */
const pending: Partial<Record<SurfaceKey, { dx: number; dy: number }>> = {};

function installSnapLayer(key: SurfaceKey) {
  const fab = surfaces[key], wrap = fab.wrapperEl;
  let el = wrap.querySelector<HTMLCanvasElement>('.snap-overlay');
  if (!el) {
    el = document.createElement('canvas');
    el.className = 'snap-overlay';
    wrap.appendChild(el);
  }
  // o buffer acompanha o do fabric e o CSS estica os dois igual, então as guias
  // são desenhadas em coordenadas de cena, sem transformação nenhuma
  el.width = fab.getWidth();
  el.height = fab.getHeight();
  layers[key] = el;
  return el;
}

export function resizeSnapLayers() {
  for (const key of SURFACE_KEYS) installSnapLayer(key);
}

/* A tela tem 2048 px e aparece com uns 1000 px de CSS, então uma tolerância que
   PARECE 6 px na tela vale ~12 px de cena — e o número muda entre as laterais e
   a traseira, que têm buffers diferentes. */
function sceneTol(c: fabric.Canvas, screenPx = 6) {
  const r = c.upperCanvasEl.getBoundingClientRect();
  return screenPx * (c.getWidth() / (r.width || c.getWidth()));
}

function snapTargets(c: fabric.Canvas, key: SurfaceKey, moving: fabric.FabricObject) {
  const w = c.getWidth(), h = c.getHeight(), f = outlineFrame(key);
  const v = [0, w / 2, w, f.left, f.left + f.width / 2, f.left + f.width];
  const hz = [0, h / 2, h, f.top, f.top + f.height / 2, f.top + f.height];
  const inSel = moving instanceof fabric.ActiveSelection ? moving.getObjects() : null;
  c.forEachObject((o) => {
    if (o === moving || !o.visible || (o as { locked?: boolean }).locked) return;
    if (inSel && inSel.includes(o)) return;      // membros da seleção arrastada
    const r = o.getBoundingRect();
    v.push(r.left, r.left + r.width / 2, r.left + r.width);
    hz.push(r.top, r.top + r.height / 2, r.top + r.height);
  });
  return { v, h: hz };
}

function drawGuides(key: SurfaceKey) {
  const layer = layers[key];
  const ctx = layer?.getContext('2d');
  if (!layer || !ctx) return;
  ctx.clearRect(0, 0, layer.width, layer.height);
  if (!guideState.v.length && !guideState.h.length) return;
  ctx.save();
  ctx.strokeStyle = '#ff3b7f';
  ctx.lineWidth = Math.max(1.5, layer.width / 1200);
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  for (const x of guideState.v) { ctx.moveTo(x, 0); ctx.lineTo(x, layer.height); }
  for (const y of guideState.h) { ctx.moveTo(0, y); ctx.lineTo(layer.width, y); }
  ctx.stroke();
  ctx.restore();
}

function clearGuides(key: SurfaceKey) {
  guideState.v = []; guideState.h = [];
  delete pending[key];
  drawGuides(key);
}

/* IMPORTANTE: chame isto ANTES de registrar o object:modified que grava o
   histórico. Os handlers do fabric disparam na ordem de registro, e o encaixe
   precisa entrar antes — senão o histórico guarda a posição de antes do ajuste
   e o desfazer volta para um lugar onde o objeto nunca esteve. */
export function initSnapping(onMove?: () => void) {
  for (const key of SURFACE_KEYS) {
    installSnapLayer(key);
    const c = surfaces[key];

    c.on('object:moving', (opt) => {
      const target = opt.target as fabric.FabricObject;
      const e = opt.e as MouseEvent | undefined;
      guideState.v = []; guideState.h = [];
      delete pending[key];
      if (!snapEnabled || e?.shiftKey) { drawGuides(key); onMove?.(); return; }

      const tol = sceneTol(c);
      const t = snapTargets(c, key, target);
      const r = target.getBoundingRect();
      let dx = 0, dy = 0, bestX = tol, bestY = tol;

      for (const probe of [r.left, r.left + r.width / 2, r.left + r.width]) {
        for (const line of t.v) {
          const d = line - probe;
          if (Math.abs(d) < bestX) { bestX = Math.abs(d); dx = d; guideState.v = [line]; }
        }
      }
      for (const probe of [r.top, r.top + r.height / 2, r.top + r.height]) {
        for (const line of t.h) {
          const d = line - probe;
          if (Math.abs(d) < bestY) { bestY = Math.abs(d); dy = d; guideState.h = [line]; }
        }
      }

      // guarda o ajuste para o solte; NÃO mexe no objeto agora
      if (dx || dy) pending[key] = { dx, dy };
      drawGuides(key);
      onMove?.();
    });

    /* O salto acontece aqui, uma vez, com o gesto já terminado. */
    c.on('object:modified', (opt) => {
      const p = pending[key];
      const target = opt.target as fabric.FabricObject | undefined;
      if (p && target && (p.dx || p.dy)) {
        target.set({ left: target.left + p.dx, top: target.top + p.dy });
        target.setCoords();
        c.requestRenderAll();
      }
      clearGuides(key);
    });

    c.on('mouse:up', () => clearGuides(key));
    c.on('selection:cleared', () => clearGuides(key));
  }
}

/* ---------------- réguas ----------------
   Origem no canto dianteiro-inferior do painel: "a quantos metros da cabine" e
   "a que altura do piso" são as medidas que um pintor de frota usa.
   addLiveryUV() faz a SIDE_L correr traseira→frente e a SIDE_R frente→traseira,
   então a régua horizontal conta ao contrário na lateral esquerda. */
const tickSteps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
function tickStep(cmPerPx: number) {
  const want = 60 * cmPerPx;               // um rótulo a cada ~60 px de tela
  return tickSteps.find((s) => s >= want) ?? 5000;
}

function paintRuler(
  el: HTMLCanvasElement, lengthPx: number, cmPerPx: number,
  horizontal: boolean, originAtEnd: boolean, offsetPx: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const box = el.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  el.width = w * dpr; el.height = h * dpr;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!lengthPx || !isFinite(cmPerPx) || cmPerPx <= 0) return;

  const step = tickStep(cmPerPx);
  const thick = horizontal ? h : w;
  ctx.font = '9px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(139,147,167,.9)';
  ctx.strokeStyle = 'rgba(139,147,167,.45)';
  ctx.lineWidth = 1;
  ctx.textBaseline = horizontal ? 'top' : 'middle';

  const totalCm = lengthPx * cmPerPx;
  ctx.beginPath();
  for (let cm = 0; cm <= totalCm + 0.001; cm += step / 2) {
    const along = cm / cmPerPx;
    const pos = offsetPx + (originAtEnd ? lengthPx - along : along);
    const major = Math.abs(cm % step) < 0.001;
    const len = major ? thick * 0.55 : thick * 0.3;
    if (horizontal) { ctx.moveTo(pos + 0.5, thick - len); ctx.lineTo(pos + 0.5, thick); }
    else { ctx.moveTo(thick - len, pos + 0.5); ctx.lineTo(thick, pos + 0.5); }
    if (major && cm > 0.001) {
      const label = step >= 100 ? `${Math.round(cm / 100)}m` : `${Math.round(cm)}`;
      if (horizontal) ctx.fillText(label, pos + 3, 2);
      else { ctx.save(); ctx.translate(2, pos); ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore(); }
    }
  }
  ctx.stroke();
}

export function drawRulers() {
  const rulerH = $<HTMLCanvasElement>('ruler-h');
  const rulerV = $<HTMLCanvasElement>('ruler-v');
  if (!rulerH || !rulerV || !root.isConnected) return;
  const key = activeKey(), c = active();
  const panel = c.wrapperEl?.getBoundingClientRect();
  const hBox = rulerH.getBoundingClientRect(), vBox = rulerV.getBoundingClientRect();
  if (!panel || !panel.width || !panel.height) {
    paintRuler(rulerH, 0, 1, true, false, 0);
    paintRuler(rulerV, 0, 1, false, true, 0);
    return;
  }

  const dims = panelMM(key);
  // px de tela -> cm, pelo tamanho que a tela ocupa agora
  const cmPerScreenX = (dims.w / 10) / panel.width;
  const cmPerScreenY = (dims.h / 10) / panel.height;

  paintRuler(rulerH, panel.width, cmPerScreenX, true, key === 'left', panel.left - hBox.left);
  paintRuler(rulerV, panel.height, cmPerScreenY, false, true, panel.top - vBox.top);
}
