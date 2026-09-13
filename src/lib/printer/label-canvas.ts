import { getPrinterMetaByModel, PrinterModel } from "@mmote/niimbluelib";
import { LABEL_FORMATS } from "./label-format";

/**
 * niimbluelib's ImageEncoder.encode() maps canvas WIDTH to the printhead's
 * fixed dot line ("cols") and canvas HEIGHT to the variable feed length
 * ("rows") ONLY when printDirection is the value the printer model itself
 * declares — for B1 that's "top" (confirmed in niimbluelib's own
 * printer_models.js: `{ model: B1, dpi: 203, printDirection: "top",
 * printheadPixels: 384 }`). Passing "left" instead SWAPS that mapping, which
 * is exactly what happened here: canvas.height (15mm ≈ 120px) became the
 * printhead axis and canvas.width (50mm ≈ 400px) became the feed axis — so
 * the printer fed ~400 dots (≈50mm) per label instead of ~120 (≈15mm),
 * spilling text across ~3 physical die-cut labels, rotated 90° besides.
 * Source everything from the library's metadata instead of guessing again.
 */
const B1_META = getPrinterMetaByModel(PrinterModel.B1);
if (!B1_META) {
  throw new Error("Metadados do modelo B1 não encontrados em @mmote/niimbluelib — a versão da lib mudou?");
}

export const NIIMBOT_PRINT_DIRECTION = B1_META.printDirection;

const feedPx = (mm: number): number => Math.round((mm / 25.4) * B1_META.dpi);

/** canvas.width is always the printhead's exact dot count (384) — never a raw mm→px guess — so `cols` lines up perfectly with `printheadPixels` and nothing gets padded/misaligned. canvas.height is the label's feed length (the dimension that actually varies between formats). */
const createLabelCanvas = (heightMm: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = B1_META.printheadPixels;
  canvas.height = feedPx(heightMm);
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

/** `centerX`/`maxWidthPx` are explicit (not derived from the full canvas) so this also works for text confined to one half of a divided label. */
const drawCenteredLine = (ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, maxWidthPx: number, startFontPx: number, minFontPx: number, weight = "bold") => {
  const fontPx = fitFontSize(ctx, text, maxWidthPx, startFontPx, minFontPx, weight);
  ctx.font = `${weight} ${fontPx}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, centerX, y, maxWidthPx);
};

/**
 * niimbluelib's encoder treats ANY pixel that isn't pure white as printable
 * black (`isPixelNonWhite`: `data[idx] !== 255`) — there is no midpoint
 * threshold. Canvas text/shape rendering is anti-aliased, leaving a band of
 * gray edge pixels around every glyph. On ordinary black-on-white text that
 * just fattens the glyph a little and stays legible, but on the badge's
 * inverted white-on-black text those gray edge pixels get counted as "black"
 * too, eating into the thin white letter strokes from every side — that's
 * what printed as blurred/broken letters. Re-deciding black-vs-white
 * ourselves with a real 50% luminance threshold, right before handing the
 * canvas to the encoder, means every pixel it sees is already pure black or
 * pure white, so its own `!== 255` check can no longer misfire either way.
 */
const binarize = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void => {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const luminance = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = luminance < 128 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
};

/**
 * DUPLA (50x15mm): ONE physical label, divided into a left half (paint type)
 * and a right half (paint name) with a thin divider — not two separate
 * printPage calls. An earlier version printed the type and the name as two
 * distinct physical labels; that was a misreading of "dupla" (it means the
 * label carries two pieces of information, not that the job spans two
 * die-cut labels) and got corrected after a real print showed both problems
 * (wrong print direction feeding ~3x too much paper, AND — independently of
 * that — two labels being produced where one was wanted).
 */
export function drawDuplaLabel(paintTypeName: string, paintName: string): HTMLCanvasElement {
  const { heightMm } = LABEL_FORMATS.DUPLA;
  const { canvas, ctx } = createLabelCanvas(heightMm);

  const half = canvas.width / 2;
  const pad = canvas.width * 0.04;
  const halfMaxWidth = half - pad * 2;

  drawCenteredLine(ctx, paintTypeName, half / 2, canvas.height / 2, halfMaxWidth, Math.round(canvas.height * 0.42), Math.round(canvas.height * 0.16));
  drawCenteredLine(ctx, paintName, half + half / 2, canvas.height / 2, halfMaxWidth, Math.round(canvas.height * 0.38), Math.round(canvas.height * 0.14));

  ctx.strokeStyle = "black";
  ctx.lineWidth = Math.max(1, Math.round(canvas.height * 0.03));
  ctx.beginPath();
  ctx.moveTo(half, canvas.height * 0.12);
  ctx.lineTo(half, canvas.height * 0.88);
  ctx.stroke();

  binarize(ctx, canvas);
  return canvas;
}

/**
 * COMBO (50x30mm): one physical label with both the paint type (badge, on
 * top — read first when grabbing a can off the shelf) and the paint name
 * (prominent, below).
 */
export function drawComboLabel(paintName: string, paintTypeName: string): HTMLCanvasElement {
  const { heightMm } = LABEL_FORMATS.COMBO;
  const { canvas, ctx } = createLabelCanvas(heightMm);

  // Paint type: filled badge. Thermal printers are 1-bit (no gray/tint), so a
  // solid black pill with white text is the legible substitute for a soft
  // "chip" style. Given a 12% top margin — the old 2.8% bottom margin sat
  // right where feed/registration slip clips the printable area, on top of
  // being the inverted-text case `binarize()` above exists for.
  const badgeText = paintTypeName.toUpperCase();
  const badgeFontPx = fitFontSize(ctx, badgeText, canvas.width * 0.7, Math.round(canvas.height * 0.14), Math.round(canvas.height * 0.09), "bold");
  ctx.font = `bold ${badgeFontPx}px sans-serif`;
  const textWidth = ctx.measureText(badgeText).width;
  const paddingX = canvas.width * 0.06;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = badgeFontPx * 1.8;
  const badgeX = (canvas.width - badgeWidth) / 2;
  const badgeY = canvas.height * 0.12;
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

  // Paint name: fills the remaining space below the badge, down to a matching
  // ~10% bottom margin, bold and auto-shrunk.
  ctx.fillStyle = "black";
  const contentBottom = canvas.height * 0.9;
  const nameCenterY = badgeY + badgeHeight + (contentBottom - (badgeY + badgeHeight)) / 2;
  drawCenteredLine(ctx, paintName, canvas.width / 2, nameCenterY, canvas.width * 0.92, Math.round(canvas.height * 0.26), Math.round(canvas.height * 0.11));

  binarize(ctx, canvas);
  return canvas;
}
