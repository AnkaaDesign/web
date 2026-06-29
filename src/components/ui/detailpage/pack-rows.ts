// Two-column masonry for the detail-page card layout.
//
// A run of consecutive HALF-width sections (full-width ones are handled by the caller) is split into
// a LEFT and a RIGHT column. Each card keeps its NATURAL height — cards are NOT stretched to a shared
// band height (that only wastes space when a short card sits beside a tall one). Cards are placed, in
// reading order, into whichever column is currently SHORTER, so the two columns stay close in height
// with no forced empty space. A pinned card (½← / ½→) goes to its column regardless.
//
// Heights are ESTIMATED (field count + per-card chrome + resolved height for embedded content). The
// estimate only decides placement; it never affects the rendered height.

export interface BalancedColumns<T> {
  /** Top→bottom stack in the LEFT column. */
  left: T[];
  /** Top→bottom stack in the RIGHT column. */
  right: T[];
}

interface EstSection {
  fields: { block?: boolean; dataType?: string }[];
  /** Explicit column pin: 1 = left, 2 = right, undefined = auto-balance. */
  column?: 1 | 2;
  height?: number;
  def: { render?: unknown };
}

const PX_FIELD = 38; // one label:value row (incl. gap)
const PX_BLOCK = 64; // textarea / multiselect / block field
const CARD_CHROME = 96; // CardHeader (title) + card paddings
const RENDER_FALLBACK = 260; // a render section with no resolved height
const GAP = 16; // gap-4 between stacked cards

function estHeight(s: EstSection): number {
  let body = 0;
  for (const f of s.fields) body += f.block || f.dataType === "textarea" || f.dataType === "multiselect" ? PX_BLOCK : PX_FIELD;
  if (s.def.render) body += s.height ?? RENDER_FALLBACK;
  return CARD_CHROME + Math.max(body, PX_FIELD);
}

/** Split a run of half-width sections into two height-balanced columns (natural heights). */
export function balanceColumns<T extends EstSection>(block: T[]): BalancedColumns<T> {
  const left: T[] = [];
  const right: T[] = [];
  let lh = 0;
  let rh = 0;
  for (const s of block) {
    const h = estHeight(s);
    const toLeft = s.column === 1 ? true : s.column === 2 ? false : lh <= rh; // pin wins; else shorter column
    if (toLeft) {
      lh += (left.length ? GAP : 0) + h;
      left.push(s);
    } else {
      rh += (right.length ? GAP : 0) + h;
      right.push(s);
    }
  }
  return { left, right };
}
