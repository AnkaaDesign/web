import { LABEL_FORMATS, mmToPx } from "./label-format";

const createLabelCanvas = (widthMm: number, heightMm: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(widthMm);
  canvas.height = mmToPx(heightMm);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar o contexto do canvas para a etiqueta");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  return { canvas, ctx };
};

/** Shrinks the font size until `text` fits within `maxWidthPx`, down to `minFontPx`. */
const fitFontSize = (ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number, startFontPx: number, minFontPx: number, weight: string): number => {
  let fontPx = startFontPx;
  while (fontPx > minFontPx) {
    ctx.font = `${weight} ${fontPx}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidthPx) break;
    fontPx -= 2;
  }
  return fontPx;
};

const drawCenteredLine = (ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement, y: number, startFontPx: number, minFontPx: number, weight = "bold") => {
  const maxWidthPx = canvas.width * 0.92;
  const fontPx = fitFontSize(ctx, text, maxWidthPx, startFontPx, minFontPx, weight);
  ctx.font = `${weight} ${fontPx}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, y, maxWidthPx);
};

/**
 * DUPLA (50x15mm): two separate physical labels in one print job —
 * one with only the paint type, one with only the paint name.
 */
export function drawDuplaLabels(paintTypeName: string, paintName: string): { typeCanvas: HTMLCanvasElement; nameCanvas: HTMLCanvasElement } {
  const { widthMm, heightMm } = LABEL_FORMATS.DUPLA;

  const { canvas: typeCanvas, ctx: typeCtx } = createLabelCanvas(widthMm, heightMm);
  drawCenteredLine(typeCtx, paintTypeName, typeCanvas, typeCanvas.height / 2, Math.round(typeCanvas.height * 0.55), Math.round(typeCanvas.height * 0.22));

  const { canvas: nameCanvas, ctx: nameCtx } = createLabelCanvas(widthMm, heightMm);
  drawCenteredLine(nameCtx, paintName, nameCanvas, nameCanvas.height / 2, Math.round(nameCanvas.height * 0.5), Math.round(nameCanvas.height * 0.18));

  return { typeCanvas, nameCanvas };
}

/**
 * COMBO (50x30mm): one physical label with both the paint name (prominent,
 * top) and the paint type (secondary badge, bottom).
 */
export function drawComboLabel(paintName: string, paintTypeName: string): HTMLCanvasElement {
  const { widthMm, heightMm } = LABEL_FORMATS.COMBO;
  const { canvas, ctx } = createLabelCanvas(widthMm, heightMm);

  // Paint name: upper ~60%, bold, auto-shrunk.
  drawCenteredLine(ctx, paintName, canvas, canvas.height * 0.38, Math.round(canvas.height * 0.26), Math.round(canvas.height * 0.11));

  // Paint type: filled badge in the lower third. Thermal printers are 1-bit
  // (no gray/tint), so a solid black pill with white text is the legible
  // substitute for a soft "chip" style.
  const badgeText = paintTypeName.toUpperCase();
  const badgeFontPx = fitFontSize(ctx, badgeText, canvas.width * 0.7, Math.round(canvas.height * 0.14), Math.round(canvas.height * 0.09), "bold");
  ctx.font = `bold ${badgeFontPx}px sans-serif`;
  const textWidth = ctx.measureText(badgeText).width;
  const paddingX = canvas.width * 0.06;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = badgeFontPx * 1.8;
  const badgeX = (canvas.width - badgeWidth) / 2;
  const badgeY = canvas.height * 0.72;
  const radius = badgeHeight / 2;

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.moveTo(badgeX + radius, badgeY);
  ctx.arcTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeHeight, radius);
  ctx.arcTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX, badgeY + badgeHeight, radius);
  ctx.arcTo(badgeX, badgeY + badgeHeight, badgeX, badgeY, radius);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeWidth, badgeY, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

  return canvas;
}

/**
 * niimbluelib's ImageEncoder.encodeCanvas(canvas, direction) expects "left"
 * or "top" depending on how the printhead is fed relative to the canvas —
 * verified working as "left" on the throwaway test page against a real B1.
 * If a physical print comes out rotated 90°, flip this to "top".
 */
export const NIIMBOT_PRINT_DIRECTION: "left" | "top" = "left";
