import { LABEL_HEIGHT, LABEL_WIDTH } from "./task-label-card";

// A4 sheet of truck-body labels, printed on photo paper and cut on the ScanNCut with Direct Cut.
// The API prints it (api src/modules/production/task-label/task-label-sheet.ts draws the real page);
// this mirror only lays out the preview — keep both layouts identical.
//
// Layout: 2 columns × 8 rows of lying cards = 16 slots (8 trucks, one label per side).
// Columns are spread evenly — the same space left of the first card, between them and right of
// the second (~23.3 mm). Rows are 6 mm apart: wider than the cut needs because each card's
// caption (task name + serial/plate) is printed in that gap, just above the card:
// it tells which truck the label belongs to and falls away with the scrap after the cut.
// (A mixed standing/lying layout fits 17, but an odd slot and rotated captions aren't worth one card.)
//
// Each card carries a 0.5 mm black ring drawn just OUTSIDE its edge: the scanner traces the ring,
// and its inner contour is exactly the card edge, so the cut leaves no black on the card.

export const SHEET_WIDTH = 210;
export const SHEET_HEIGHT = 297;
export const ROW_GAP = 6;
const COLUMNS = 2;
const ROWS = 8;

export const CAPTION_SIZE = 3;
// above the card edge: descenders clear the cut ring (~0.6 mm) and caps clear the card above (~1.4 mm)
export const CAPTION_BASELINE = 1.9;
const CAPTION_MAX_CHARS = 46; // ~65 mm of Manrope 700 at 3 mm (≈1.4 mm a character)

export interface LabelSlot {
  index: number;
  /** Top-left of the card on the sheet (mm). */
  x: number;
  y: number;
}

function buildSlots(): LabelSlot[] {
  const columnGap = (SHEET_WIDTH - COLUMNS * LABEL_WIDTH) / (COLUMNS + 1);
  const blockH = ROWS * LABEL_HEIGHT + (ROWS - 1) * ROW_GAP;
  const top = (SHEET_HEIGHT - blockH) / 2;
  const slots: LabelSlot[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      slots.push({ index: slots.length, x: columnGap + c * (LABEL_WIDTH + columnGap), y: top + r * (LABEL_HEIGHT + ROW_GAP) });
    }
  }
  return slots;
}

export const LABEL_SLOTS: readonly LabelSlot[] = buildSlots();

export interface PlacedLabel {
  slot: number;
  taskId: string;
  /** Printed above the card, outside the cut: e.g. "TJB Transporte · 38887". */
  caption: string;
}

/** "Name · serial" (or plate), the name shortened so the line never runs past the card. */
export function taskLabelCaption(name: string, identifier: string | null | undefined): string {
  const id = identifier?.trim();
  const room = CAPTION_MAX_CHARS - (id ? id.length + 3 : 0);
  const shortName = name.length > room ? `${name.slice(0, Math.max(0, room - 1)).trimEnd()}…` : name;
  return id ? `${shortName} · ${id}` : shortName;
}

/**
 * Orientation mark for a fresh sheet: a small grey "▲ TOPO" in BOTH top corners — the edge that stays
 * UP when the sheet stands in the printer's rear tray. The printer prints the page head-first (the
 * edge that goes in first), so the API turns the page 180° before sending it: the sheet comes out
 * reading upright as it stands in the tray, exactly like this preview (api task-label-sheet.ts,
 * FEED ORIENTATION). Grey and at the 3 mm limit, far from the cards, so the ScanNCut ignores it.
 */
export function orientationMarkSvg(): string {
  const edge = 3.5; // just inside the printer's 3 mm unprintable border
  const fontSize = 3.4;
  const capHeight = fontSize * 0.71; // Manrope/Helvetica capitals: the triangle is exactly as tall
  const baseline = edge + capHeight;
  const width = capHeight * 1.15;
  const gap = 1;
  const f = (v: number) => v.toFixed(2);
  // the triangle sits on the text's baseline and reaches its cap height, so "▲ TOPO" reads as one line
  const triangle = (x: number) =>
    `<path d="M${f(x + width / 2)} ${f(baseline - capHeight)}L${f(x + width)} ${f(baseline)}H${f(x)}Z" fill="#9CA3AF"/>`;
  const label = (x: number, anchor: "start" | "end") =>
    `<text x="${f(x)}" y="${f(baseline)}" font-family="Manrope, Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#9CA3AF" text-anchor="${anchor}">TOPO</text>`;
  return (
    triangle(edge) +
    label(edge + width + gap, "start") +
    triangle(SHEET_WIDTH - edge - width) +
    label(SHEET_WIDTH - edge - width - gap, "end")
  );
}
