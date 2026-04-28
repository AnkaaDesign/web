/**
 * Paint Mix Math
 *
 * Pure, side-effect-free math helpers for the Paint Mix Calculator tool.
 * All functions operate on simple value objects; no dependency on react,
 * react-query, or domain entities. The page composes these with hook data.
 *
 * Unit assumption (v1):
 *   - `pricePerLiter` is treated as the unit price for one liter of the
 *     component. The Item entity stores `prices` and a `measures` relation
 *     defining the unit, but in v1 we do NOT attempt to derive price-per-liter
 *     from arbitrary units (kg, ml, gal, ...). The page passes the raw
 *     `prices?.[0]?.value` as `pricePerLiter`. If a customer's items are not
 *     priced per liter, the resulting cost is wrong by the unit factor — this
 *     is a deliberate scope cut for v1, to be revisited once unit conversion
 *     for inventory items lands.
 */

export interface SlotInput {
  /** Numeric ratio for this slot (e.g. 3, 1, 1). Negative or NaN -> 0. */
  ratio: number;
  /** Price per liter (R$/L). null = not selected / no price available. */
  pricePerLiter: number | null;
}

export interface SlotResult {
  /** Volume in liters, rounded to 3 decimals. */
  volumeLiters: number;
  /** Volume in milliliters (integer). */
  volumeMl: number;
  /** Cost in R$ (raw, not rounded). null when pricePerLiter is null. */
  cost: number | null;
}

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Distribute `totalLiters` across slots according to their ratios.
 * Returns one SlotResult per input slot, in the same order.
 *
 * Edge cases:
 *   - sum(ratios) <= 0  -> all volumes / costs are 0 (no division by zero).
 *   - totalLiters <= 0  -> all volumes / costs are 0.
 *   - individual ratio < 0 or NaN -> treated as 0.
 *   - pricePerLiter null -> cost null (incomplete pricing).
 */
export function computeSlotVolumes(
  slots: SlotInput[],
  totalLiters: number,
): SlotResult[] {
  const total = safe(totalLiters);
  const ratios = slots.map((s) => safe(s.ratio));
  const totalRatio = ratios.reduce((acc, r) => acc + r, 0);

  if (totalRatio <= 0 || total <= 0) {
    return slots.map((s) => ({
      volumeLiters: 0,
      volumeMl: 0,
      cost: s.pricePerLiter == null ? null : 0,
    }));
  }

  return slots.map((slot, i) => {
    const fraction = ratios[i] / totalRatio;
    const volumeLitersRaw = fraction * total;
    const volumeLiters = round3(volumeLitersRaw);
    const volumeMl = Math.round(volumeLitersRaw * 1000);
    const cost =
      slot.pricePerLiter == null ? null : slot.pricePerLiter * volumeLitersRaw;
    return { volumeLiters, volumeMl, cost };
  });
}

/**
 * Sum of slot costs.
 * Returns null if any slot has null cost (= incomplete pricing). Otherwise the
 * sum of all costs (raw, not rounded — caller rounds at display time).
 */
export function computeTotalCost(results: SlotResult[]): number | null {
  let acc = 0;
  for (const r of results) {
    if (r.cost == null) return null;
    acc += r.cost;
  }
  return acc;
}

/**
 * Cost per liter of the resulting mix (R$/L).
 * Returns null if totalCost is null or totalLiters <= 0.
 */
export function computeCostPerLiter(
  totalCost: number | null,
  totalLiters: number,
): number | null {
  if (totalCost == null) return null;
  const t = safe(totalLiters);
  if (t <= 0) return null;
  return totalCost / t;
}

/**
 * Sum of slot volumes (sanity-check value, should equal totalLiters when
 * totalRatio > 0). Useful for displaying a verification line.
 */
export function sumSlotVolumes(results: SlotResult[]): number {
  return results.reduce((acc, r) => acc + r.volumeLiters, 0);
}
