// packages/types/src/measure.ts

import type { BaseEntity, BaseGetManyResponse, BatchOperationResult, BaseGetUniqueResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "./common";
import { MEASURE_UNIT, MEASURE_TYPE } from "../constants";
import type { Item } from "./item";

// =====================
// Core Measure Interface
// =====================

export interface Measure extends BaseEntity {
  value: number | null;
  unit: MEASURE_UNIT | null;
  measureType: MEASURE_TYPE;
  itemId: string;

  // Relations
  item?: Item;
}

// =====================
// Include Types
// =====================

export interface MeasureIncludes {
  item?:
    | boolean
    | {
        include?: any; // Avoid circular dependency with Item
      };
}

// =====================
// Response Types
// =====================

export interface MeasureGetManyResponse extends BaseGetManyResponse<Measure> {}

export interface MeasureGetUniqueResponse extends BaseGetUniqueResponse<Measure> {}

export interface MeasureCreateResponse extends BaseCreateResponse<Measure> {}

export interface MeasureUpdateResponse extends BaseUpdateResponse<Measure> {}

export interface MeasureDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Response Types
// =====================

export interface MeasureBatchCreateResponse extends BaseCreateResponse<BatchOperationResult<Measure>> {}

export interface MeasureBatchUpdateResponse extends BaseUpdateResponse<BatchOperationResult<Measure>> {}

export interface MeasureBatchDeleteResponse extends BaseDeleteResponse {
  data?: BatchOperationResult<string>;
}

// =====================
// Unit Conversion Types
// =====================

export interface UnitConversionResult {
  value: number;
  fromUnit: MEASURE_UNIT;
  toUnit: MEASURE_UNIT;
  convertedValue: number;
  conversionFactor: number;
}

export interface UnitConversionResponse extends BaseCreateResponse<UnitConversionResult> {}

export interface BulkConversionResponse
  extends BaseCreateResponse<{
    conversions: UnitConversionResult[];
    totalConversions: number;
    successful: number;
    failed: number;
    errors?: string[];
  }> {}

// =====================
// Measure Categories (for grouping units)
// =====================

export const MEASURE_CATEGORIES = {
  WEIGHT: "Peso",
  VOLUME: "Volume",
  LENGTH: "Comprimento",
  AREA: "Área",
  COUNT: "Contagem",
  PACKAGING: "Embalagem",
  DIAMETER: "Diâmetro",
  THREAD: "Rosca",
  ELECTRICAL: "Elétrico",
} as const;

export type MeasureCategory = (typeof MEASURE_CATEGORIES)[keyof typeof MEASURE_CATEGORIES];

// =====================
// Unit Conversion Factors (relative to base units)
// =====================

export const UNIT_CONVERSION_FACTORS: Record<MEASURE_UNIT, { baseUnit: MEASURE_UNIT; factor: number; category: MeasureCategory }> = {
  // Weight units (base: GRAM)
  [MEASURE_UNIT.GRAM]: { baseUnit: MEASURE_UNIT.GRAM, factor: 1, category: MEASURE_CATEGORIES.WEIGHT },
  [MEASURE_UNIT.KILOGRAM]: { baseUnit: MEASURE_UNIT.GRAM, factor: 1000, category: MEASURE_CATEGORIES.WEIGHT },

  // Volume units (base: MILLILITER)
  [MEASURE_UNIT.MILLILITER]: { baseUnit: MEASURE_UNIT.MILLILITER, factor: 1, category: MEASURE_CATEGORIES.VOLUME },
  [MEASURE_UNIT.LITER]: { baseUnit: MEASURE_UNIT.MILLILITER, factor: 1000, category: MEASURE_CATEGORIES.VOLUME },
  [MEASURE_UNIT.CUBIC_CENTIMETER]: { baseUnit: MEASURE_UNIT.MILLILITER, factor: 1, category: MEASURE_CATEGORIES.VOLUME }, // 1 cm³ = 1 ml
  [MEASURE_UNIT.CUBIC_METER]: { baseUnit: MEASURE_UNIT.MILLILITER, factor: 1000000, category: MEASURE_CATEGORIES.VOLUME }, // 1 m³ = 1,000,000 ml

  // Length units (base: MILLIMETER)
  [MEASURE_UNIT.MILLIMETER]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 1, category: MEASURE_CATEGORIES.LENGTH },
  [MEASURE_UNIT.CENTIMETER]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 10, category: MEASURE_CATEGORIES.LENGTH },
  [MEASURE_UNIT.METER]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 1000, category: MEASURE_CATEGORIES.LENGTH },
  [MEASURE_UNIT.INCHES]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 25.4, category: MEASURE_CATEGORIES.LENGTH }, // 1 inch = 25.4 mm

  // Area units (base: SQUARE_CENTIMETER)
  [MEASURE_UNIT.SQUARE_CENTIMETER]: { baseUnit: MEASURE_UNIT.SQUARE_CENTIMETER, factor: 1, category: MEASURE_CATEGORIES.AREA },
  [MEASURE_UNIT.SQUARE_METER]: { baseUnit: MEASURE_UNIT.SQUARE_CENTIMETER, factor: 10000, category: MEASURE_CATEGORIES.AREA }, // 1 m² = 10,000 cm²

  // Count units (base: UNIT)
  [MEASURE_UNIT.UNIT]: { baseUnit: MEASURE_UNIT.UNIT, factor: 1, category: MEASURE_CATEGORIES.COUNT },
  [MEASURE_UNIT.PAIR]: { baseUnit: MEASURE_UNIT.UNIT, factor: 2, category: MEASURE_CATEGORIES.COUNT },
  [MEASURE_UNIT.DOZEN]: { baseUnit: MEASURE_UNIT.UNIT, factor: 12, category: MEASURE_CATEGORIES.COUNT },
  [MEASURE_UNIT.HUNDRED]: { baseUnit: MEASURE_UNIT.UNIT, factor: 100, category: MEASURE_CATEGORIES.COUNT },
  [MEASURE_UNIT.THOUSAND]: { baseUnit: MEASURE_UNIT.UNIT, factor: 1000, category: MEASURE_CATEGORIES.COUNT },

  // Packaging units (base: PACKAGE)
  [MEASURE_UNIT.PACKAGE]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },
  [MEASURE_UNIT.BOX]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },
  [MEASURE_UNIT.ROLL]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },
  [MEASURE_UNIT.SHEET]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },
  [MEASURE_UNIT.SET]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },
  [MEASURE_UNIT.SACK]: { baseUnit: MEASURE_UNIT.PACKAGE, factor: 1, category: MEASURE_CATEGORIES.PACKAGING },

  // Diameter units (base: MILLIMETER - fractional inches converted to mm)
  [MEASURE_UNIT.INCH_1_8]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 3.175, category: MEASURE_CATEGORIES.DIAMETER }, // 1/8" = 3.175 mm
  [MEASURE_UNIT.INCH_1_4]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 6.35, category: MEASURE_CATEGORIES.DIAMETER }, // 1/4" = 6.35 mm
  [MEASURE_UNIT.INCH_3_8]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 9.525, category: MEASURE_CATEGORIES.DIAMETER }, // 3/8" = 9.525 mm
  [MEASURE_UNIT.INCH_1_2]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 12.7, category: MEASURE_CATEGORIES.DIAMETER }, // 1/2" = 12.7 mm
  [MEASURE_UNIT.INCH_5_8]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 15.875, category: MEASURE_CATEGORIES.DIAMETER }, // 5/8" = 15.875 mm
  [MEASURE_UNIT.INCH_3_4]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 19.05, category: MEASURE_CATEGORIES.DIAMETER }, // 3/4" = 19.05 mm
  [MEASURE_UNIT.INCH_7_8]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 22.225, category: MEASURE_CATEGORIES.DIAMETER }, // 7/8" = 22.225 mm
  [MEASURE_UNIT.INCH_1]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 25.4, category: MEASURE_CATEGORIES.DIAMETER }, // 1" = 25.4 mm
  [MEASURE_UNIT.INCH_1_1_4]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 31.75, category: MEASURE_CATEGORIES.DIAMETER }, // 1 1/4" = 31.75 mm
  [MEASURE_UNIT.INCH_1_1_2]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 38.1, category: MEASURE_CATEGORIES.DIAMETER }, // 1 1/2" = 38.1 mm
  [MEASURE_UNIT.INCH_2]: { baseUnit: MEASURE_UNIT.MILLIMETER, factor: 50.8, category: MEASURE_CATEGORIES.DIAMETER }, // 2" = 50.8 mm

  // Thread units (no conversion between mm and TPI as they measure different properties)
  [MEASURE_UNIT.THREAD_MM]: { baseUnit: MEASURE_UNIT.THREAD_MM, factor: 1, category: MEASURE_CATEGORIES.THREAD }, // Thread pitch in mm
  [MEASURE_UNIT.THREAD_TPI]: { baseUnit: MEASURE_UNIT.THREAD_TPI, factor: 1, category: MEASURE_CATEGORIES.THREAD }, // Threads per inch

  // Electrical units (no conversion between different electrical properties)
  [MEASURE_UNIT.WATT]: { baseUnit: MEASURE_UNIT.WATT, factor: 1, category: MEASURE_CATEGORIES.ELECTRICAL }, // Power
  [MEASURE_UNIT.VOLT]: { baseUnit: MEASURE_UNIT.VOLT, factor: 1, category: MEASURE_CATEGORIES.ELECTRICAL }, // Voltage
  [MEASURE_UNIT.AMPERE]: { baseUnit: MEASURE_UNIT.AMPERE, factor: 1, category: MEASURE_CATEGORIES.ELECTRICAL }, // Current

  // PPE Size units (letter sizes - no conversion between sizes)
  [MEASURE_UNIT.P]: { baseUnit: MEASURE_UNIT.P, factor: 1, category: MEASURE_CATEGORIES.COUNT }, // Small size
  [MEASURE_UNIT.M]: { baseUnit: MEASURE_UNIT.M, factor: 1, category: MEASURE_CATEGORIES.COUNT }, // Medium size
  [MEASURE_UNIT.G]: { baseUnit: MEASURE_UNIT.G, factor: 1, category: MEASURE_CATEGORIES.COUNT }, // Large size
  [MEASURE_UNIT.GG]: { baseUnit: MEASURE_UNIT.GG, factor: 1, category: MEASURE_CATEGORIES.COUNT }, // Extra large size
  [MEASURE_UNIT.XG]: { baseUnit: MEASURE_UNIT.XG, factor: 1, category: MEASURE_CATEGORIES.COUNT }, // Extra extra large size
};

// =====================
// Helper Functions
// =====================

/**
 * Check if two units can be converted between each other
 */
export function canConvertUnits(fromUnit: MEASURE_UNIT, toUnit: MEASURE_UNIT): boolean {
  const fromConfig = UNIT_CONVERSION_FACTORS[fromUnit];
  const toConfig = UNIT_CONVERSION_FACTORS[toUnit];
  return fromConfig.baseUnit === toConfig.baseUnit;
}

/**
 * Get the category of a measure unit
 */
export function getMeasureUnitCategory(unit: MEASURE_UNIT): MeasureCategory {
  return UNIT_CONVERSION_FACTORS[unit].category;
}

/**
 * Get all units in the same category
 */
export function getUnitsInCategory(category: MeasureCategory): MEASURE_UNIT[] {
  return Object.entries(UNIT_CONVERSION_FACTORS)
    .filter(([_, config]) => config.category === category)
    .map(([unit]) => unit as MEASURE_UNIT);
}

/**
 * Calculate conversion factor between two units
 */
export function getConversionFactor(fromUnit: MEASURE_UNIT, toUnit: MEASURE_UNIT): number | null {
  if (!canConvertUnits(fromUnit, toUnit)) {
    return null;
  }

  const fromConfig = UNIT_CONVERSION_FACTORS[fromUnit];
  const toConfig = UNIT_CONVERSION_FACTORS[toUnit];

  return fromConfig.factor / toConfig.factor;
}

/**
 * Convert a value between two units
 */
export function convertValue(value: number, fromUnit: MEASURE_UNIT, toUnit: MEASURE_UNIT): number | null {
  const factor = getConversionFactor(fromUnit, toUnit);
  if (factor === null) {
    return null;
  }

  return value * factor;
}
