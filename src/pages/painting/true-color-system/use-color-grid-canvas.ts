import { useCallback } from "react";
import { cmykToRgb, isLightColor, buildRange, cellId } from "./cmyk-utils";

interface DrawGridParams {
  canvas: HTMLCanvasElement;
  y: number;
  k: number;
  step: number;
  cMin: number;
  cMax: number;
  mMin: number;
  mMax: number;
  selected: Set<string>;
  selectionMode: boolean;
}

export interface CellHit {
  c: number;
  m: number;
  col: number;
  row: number;
}

/** Returns the pixel size of a single cell for the current grid layout */
export function getCellMetrics(
  canvasW: number,
  canvasH: number,
  step: number,
  cMin: number,
  cMax: number,
  mMin: number,
  mMax: number,
) {
  const mVals = buildRange(step, mMin, mMax);
  const cVals = buildRange(step, cMin, cMax);
  const Nm = mVals.length;
  const Nc = cVals.length;
  if (Nm === 0 || Nc === 0) return null;
  const cellPx = Math.max(2, Math.min(canvasW / Nm, canvasH / Nc));
  return { cellPx, Nm, Nc, mVals, cVals, chartW: cellPx * Nm, chartH: cellPx * Nc };
}

/** Given a marquee rectangle (in canvas-local px), return all cell IDs inside it */
export function cellsInRect(
  rect: { x1: number; y1: number; x2: number; y2: number },
  canvasEl: HTMLCanvasElement,
  y: number,
  k: number,
  step: number,
  cMin: number,
  cMax: number,
  mMin: number,
  mMax: number,
): string[] {
  const bounding = canvasEl.getBoundingClientRect();
  const metrics = getCellMetrics(bounding.width, bounding.height, step, cMin, cMax, mMin, mMax);
  if (!metrics) return [];

  const { Nm, Nc, mVals, cVals, chartW, chartH } = metrics;
  const cellW = chartW / Nm;
  const cellH = chartH / Nc;

  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);

  const colStart = Math.max(0, Math.floor(left / cellW));
  const colEnd = Math.min(Nm - 1, Math.floor(right / cellW));
  const rowStart = Math.max(0, Math.floor(top / cellH));
  const rowEnd = Math.min(Nc - 1, Math.floor(bottom / cellH));

  const ids: string[] = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      ids.push(cellId(y, k, cVals[row], mVals[col]));
    }
  }
  return ids;
}

export function useColorGridCanvas() {
  const drawGrid = useCallback(
    ({ canvas, y, k, step, cMin, cMax, mMin, mMax, selected, selectionMode }: DrawGridParams) => {
      const host = canvas.parentElement;
      if (!host) return;

      const mVals = buildRange(step, mMin, mMax);
      const cVals = buildRange(step, cMin, cMax);
      const Nm = mVals.length;
      const Nc = cVals.length;

      if (Nm === 0 || Nc === 0) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      const rect = host.getBoundingClientRect();
      const availW = rect.width;
      const availH = rect.height;

      const cellPx = Math.max(2, Math.min(availW / Nm, availH / Nc));
      const chartW = cellPx * Nm;
      const chartH = cellPx * Nc;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = chartW * dpr;
      canvas.height = chartH * dpr;
      canvas.style.width = chartW + "px";
      canvas.style.height = chartH + "px";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, chartW, chartH);

      const gap = Math.max(1.5, Math.min(3.5, cellPx * 0.07));

      for (let row = 0; row < Nc; row++) {
        for (let col = 0; col < Nm; col++) {
          const c = cVals[row];
          const m = mVals[col];
          const [r, g, b] = cmykToRgb(c, m, y, k);
          const id = cellId(y, k, c, m);
          const isSelected = selected.has(id);

          const x = col * cellPx + gap / 2;
          const yPos = row * cellPx + gap / 2;
          const cw = cellPx - gap;
          const ch = cellPx - gap;

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, yPos, cw, ch);

          if (isSelected && selectionMode) {
            const mark = isLightColor(r, g, b) ? "#1d1d1f" : "#fff";
            ctx.strokeStyle = mark;
            ctx.lineWidth = Math.max(1.2, cellPx * 0.06);
            ctx.strokeRect(x + 1, yPos + 1, cw - 2, ch - 2);
            ctx.fillStyle = mark;
            ctx.beginPath();
            ctx.arc(x + cw - 4, yPos + 4, Math.max(1.2, cellPx * 0.1), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    [],
  );

  const hitTest = useCallback(
    (
      canvas: HTMLCanvasElement,
      clientX: number,
      clientY: number,
      step: number,
      cMin: number,
      cMax: number,
      mMin: number,
      mMax: number,
    ): CellHit | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const yPx = clientY - rect.top;
      const mVals = buildRange(step, mMin, mMax);
      const cVals = buildRange(step, cMin, cMax);
      const Nm = mVals.length;
      const Nc = cVals.length;
      if (Nm === 0 || Nc === 0) return null;
      const col = Math.max(0, Math.min(Nm - 1, Math.floor((x / rect.width) * Nm)));
      const row = Math.max(0, Math.min(Nc - 1, Math.floor((yPx / rect.height) * Nc)));
      return { c: cVals[row], m: mVals[col], col, row };
    },
    [],
  );

  return { drawGrid, hitTest };
}
