import { LABEL_HEIGHT, LABEL_WIDTH } from "./task-label-card";

// A4 sheet of truck-body labels, printed on photo paper and cut on the ScanNCut with Direct Cut.
// The API prints it (api src/modules/production/task-label/task-label-sheet.ts draws the real page,
// turned 180° for the printer — see FEED ORIENTATION there); this mirror only lays out the preview.
// Keep both layouts identical.
//
// Layout: 5 columns × 4 rows of STANDING cards = 20 slots (10 trucks, one label per side). Each
// 70 × 30 card is turned 90° clockwise (QR on top), so a slot is 30 wide × 70 tall.
// - Height is the tight side: 4 × 70 + 3 × 3.5 = 290.5 mm leaves 3.25 mm top and bottom — just
//   inside the printer's 3 mm unprintable border. A bigger row gap would clip the first and last
//   rows, and borderless mode would rescale the page and break the millimetres the ScanNCut cuts by.
// - Width has 60 mm to spare, spread EVENLY: the same 10 mm left of the first column, between the
//   columns and right of the last.
// The caption (task name + serial/plate) runs down the 10 mm gap RIGHT of each card — which, read
// the way the turned card reads, is ABOVE it — centred on the card's height, in the light guide grey,
// and falls away with the scrap after the cut. (The last column's caption sits in the right margin.)
// Each card carries a 0.2 mm black ring just OUTSIDE its edge: the scanner traces the ring, and
// its inner contour is exactly the card edge, so the cut leaves no black on the card.
//
// FEED ORIENTATION (checked on paper, 02/10/2026): the L3250 takes the sheet standing in the rear
// tray, printable side facing the front, and prints the page's FIRST raster line on the edge that
// goes in first — the bottom edge as the sheet stands. Sent as drawn, the sheet came out upside down
// relative to how it sits in the tray. So the page is turned 180° before printing (`feedRotated`):
// looking at the sheet in the tray, everything reads upright, the preview matches it, and "▲ TOPO"
// marks the edge that stays UP in the tray.

export const SHEET_WIDTH = 210;
export const SHEET_HEIGHT = 297;
/** Between rows: as much as the page height allows. */
export const ROW_GAP = 3.5;
export const CUT_RING = 0.2;
const COLUMNS = 5;
const ROWS = 4;
/** A standing card: the 70 × 30 card turned 90° clockwise. */
export const SLOT_WIDTH = LABEL_HEIGHT;
export const SLOT_HEIGHT = LABEL_WIDTH;

// Ink for everything printed OUTSIDE the cards (caption + "TOPO"): a light grey that still reads up
// close but stays under the contrast the ScanNCut's Direct Cut traces, so it never offers them as
// shapes to cut — only the black rings are picked up.
export const GUIDE_INK = "#BCC1C8";

export const CAPTION_SIZE = 2.6;
const CAPTION_MAX_CHARS = 48; // ~58 mm of Manrope 700 at 2.6 mm (≈1.2 mm a character): within the card height

export interface LabelSlot {
  index: number;
  /** Top-left of the card on the sheet (mm). */
  x: number;
  y: number;
}

/** Between columns, and the side margins: the spare width split evenly. */
export const COLUMN_GAP = (SHEET_WIDTH - COLUMNS * SLOT_WIDTH) / (COLUMNS + 1);

function buildSlots(): LabelSlot[] {
  const blockH = ROWS * SLOT_HEIGHT + (ROWS - 1) * ROW_GAP;
  const top = (SHEET_HEIGHT - blockH) / 2;
  const slots: LabelSlot[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      slots.push({
        index: slots.length,
        x: COLUMN_GAP + c * (SLOT_WIDTH + COLUMN_GAP),
        y: top + r * (SLOT_HEIGHT + ROW_GAP),
      });
    }
  }
  return slots;
}

export const LABEL_SLOTS: readonly LabelSlot[] = buildSlots();

export interface PlacedLabel {
  slot: number;
  taskId: string;
  /** Printed in the gap beside the card (above it, as the card reads), outside the cut: e.g. "TJB Transporte · 38887". */
  caption: string;
}

/** "Name · serial" (or plate), the name shortened so the line never runs past the card. */
export function taskLabelCaption(name: string, identifier: string | null | undefined): string {
  const id = identifier?.trim();
  const room = CAPTION_MAX_CHARS - (id ? id.length + 3 : 0);
  const shortName =
    name.length > room ? `${name.slice(0, Math.max(0, room - 1)).trimEnd()}…` : name;
  return id ? `${shortName} · ${id}` : shortName;
}

/** Where a slot's caption is centred: in the middle of the gap right of the card (above it, as the card reads), at mid-height. */
export function captionAnchor(slot: LabelSlot): { x: number; y: number } {
  return { x: slot.x + SLOT_WIDTH + COLUMN_GAP / 2, y: slot.y + SLOT_HEIGHT / 2 };
}

/**
 * Orientation mark for a fresh sheet: a small grey arrowhead in each side margin, level with the
 * first row and pointing UP — the edge that stays up when the sheet stands in the printer's rear
 * tray (see FEED ORIENTATION above). The sheet goes back in the same way and the next print lands on
 * the free slots. Grey, small and clear of the captions (those sit at mid-height), so the ScanNCut's
 * Direct Cut doesn't take it for a shape.
 */
export function orientationMarkSvg(): string {
  const first = LABEL_SLOTS[0];
  const margin = first.x; // the side margin's width
  // small enough to stay inside the 3 mm unprintable border of a 10 mm margin
  const width = 3;
  const height = 2.6;
  const f = (v: number) => v.toFixed(2);
  const arrow = (cx: number) =>
    `<path d="M${f(cx)} ${f(first.y)}L${f(cx + width / 2)} ${f(first.y + height)}H${f(cx - width / 2)}Z" fill="${GUIDE_INK}"/>`;
  return arrow(margin / 2) + arrow(SHEET_WIDTH - margin / 2);
}
