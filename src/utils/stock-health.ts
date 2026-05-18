// Render-only helpers for the stock-health surfaces. The API is the
// single source of truth for monthlyConsumption / reorderPoint / maxQuantity
// (algorithm-spec §18 nightly batch) — the web app should consume the
// `monthlyConsumption`, `reorderPoint`, `maxQuantity`, `reorderQuantity` and
// `stockLevel` fields returned from the API, not recompute them.

/** Formats a days-of-stock value for the metrics card. `Infinity` is shown as
 *  "—" (no consumption signal). */
export function formatDaysOfStock(daysOfStock: number): string {
  if (!Number.isFinite(daysOfStock)) return "—";
  if (daysOfStock >= 365) return "+365 dias";
  if (daysOfStock < 1) return "<1 dia";
  return `${Math.round(daysOfStock)} dias`;
}

/** Best-effort days-of-stock from `monthlyConsumption` (which the API
 *  persists). Returns Infinity when mc is zero. */
export function projectDaysOfStock(quantity: number, monthlyConsumption: number): number {
  if (monthlyConsumption <= 0) return Infinity;
  return (quantity / monthlyConsumption) * 30;
}

/** Projects the stockout date assuming the persisted mc continues. */
export function projectStockoutDate(quantity: number, monthlyConsumption: number): Date | null {
  const days = projectDaysOfStock(quantity, monthlyConsumption);
  if (!Number.isFinite(days)) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(days));
  return date;
}

