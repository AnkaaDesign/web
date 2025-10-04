import type { Measure } from "../types";
import { MEASURE_TYPE } from "../constants";

/**
 * Maps PPE size enum values to numeric values
 * Letter sizes (P, M, G) are stored as unit field
 * Numeric sizes (36, 38, 40) are stored as value field
 */
export const PPE_SIZE_TO_NUMERIC: Record<string, number> = {
  // Boots and Pants sizes (numeric) - stored in value field
  SIZE_36: 36,
  SIZE_38: 38,
  SIZE_40: 40,
  SIZE_42: 42,
  SIZE_44: 44,
  SIZE_46: 46,
  SIZE_48: 48,
};

// Letter sizes that should be stored as unit, not value
export const LETTER_SIZES = ["P", "M", "G", "GG", "XG"];

/**
 * Maps numeric values back to PPE size enum values
 */
export const NUMERIC_TO_PPE_SIZE: Record<number, string> = Object.fromEntries(Object.entries(PPE_SIZE_TO_NUMERIC).map(([size, value]) => [value, size]));

/**
 * Get PPE size from an item's measures array
 * For SIZE type measures:
 * - Letter sizes (P, M, G, GG, XG) are stored in unit field
 * - Numeric sizes (36, 38, 40, etc.) are stored in value field
 */
export function getPpeSizeFromMeasures(measures: Measure[]): string | null {
  const sizeMeasure = measures.find((m) => m.measureType === MEASURE_TYPE.SIZE);
  if (!sizeMeasure) return null;

  // Letter sizes are stored in unit field
  if (sizeMeasure.unit && LETTER_SIZES.includes(sizeMeasure.unit)) {
    return sizeMeasure.unit;
  }

  // Numeric sizes are stored in value field
  if (sizeMeasure.value !== null && sizeMeasure.value !== undefined) {
    // Convert numeric value to SIZE_XX format
    return NUMERIC_TO_PPE_SIZE[sizeMeasure.value] || `SIZE_${sizeMeasure.value}`;
  }

  return null;
}

/**
 * Convert PPE size string to numeric value for filtering/sorting
 */
export function ppeSizeToNumeric(size: string): number | null {
  return PPE_SIZE_TO_NUMERIC[size] || null;
}

/**
 * Convert numeric value back to PPE size string
 */
export function numericToPpeSize(value: number): string | null {
  return NUMERIC_TO_PPE_SIZE[value] || null;
}
