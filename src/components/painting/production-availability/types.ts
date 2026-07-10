// Shared types for the "Disponibilidade de Produção" planner.

/** A paint the user intends to produce, plus the editable volume for it. */
export interface SelectionRow {
  paintId: string;
  paintName: string;
  hex: string;
  finish: string;
  typeName: string | null;
  brandName: string | null;
  /** How many scheduled tasks contributed this paint (0 when added manually). */
  taskCount: number;
  /** Editable target volume in liters. */
  volumeLiters: number;
  hasFormula: boolean;
  source: "schedule" | "manual";
}

/**
 * Producibility of a single paint once every selection's demand competes for the
 * same stock:
 * - `producible`   — every component has enough stock for the whole plan
 * - `insufficient` — at least one component runs short
 * - `no-formula`   — the paint has no formula, so demand can't be computed
 * - `pending`      — not yet calculated (no volume, or a recompute in flight)
 */
export type PaintStatus = "producible" | "insufficient" | "no-formula" | "pending";

/** Minimal paint payload the "add paint" combobox hands back to the planner. */
export interface AddPaintPayload {
  id: string;
  name: string;
  hex: string;
  finish: string;
  typeName: string | null;
  brandName: string | null;
}
