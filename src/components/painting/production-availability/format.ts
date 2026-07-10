// Small pt-BR formatters shared across the availability planner. Kept local so the
// display precision (liters vs grams vs units) stays consistent between the cards,
// the summary and the components table.

/** e.g. 10.8 -> "10,8 L" */
export const formatLiters = (v: number): string =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;

/** e.g. 3456.7 -> "3.457 g" */
export const formatGrams = (v: number): string =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;

/** e.g. 1.4 -> "≈ 1,4 un" (fewer decimals as the count grows) */
export const formatUnits = (v: number): string =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })} un`;

/** e.g. 0.62 -> "62%" */
export const formatRatioPct = (r: number): string =>
  `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
