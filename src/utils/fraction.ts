/**
 * Fraction Utility Functions
 *
 * Handles conversion between fractional representations (like "1/4", "1 1/2")
 * and decimal numbers (0.25, 1.5) for inch measurements.
 */

/**
 * Convert a fraction string to a decimal number
 * Supports formats:
 * - Simple fractions: "1/4" → 0.25
 * - Mixed numbers: "1 1/2" → 1.5
 * - Decimals: "0.25" → 0.25
 * - Whole numbers: "2" → 2
 */
export function fractionToDecimal(input: string): number | null {
  if (!input || input.trim() === "") {
    return null;
  }

  const trimmed = input.trim();

  // Try to parse as a regular decimal number first
  const asNumber = parseFloat(trimmed.replace(",", "."));
  if (!isNaN(asNumber) && !trimmed.includes("/")) {
    return asNumber;
  }

  // Check for mixed number format: "1 1/2" or "1-1/2"
  const mixedMatch = trimmed.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);

    if (denominator === 0) {
      return null;
    }

    return whole + numerator / denominator;
  }

  // Check for simple fraction format: "1/4"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);

    if (denominator === 0) {
      return null;
    }

    return numerator / denominator;
  }

  return null;
}

/**
 * Convert a decimal number to the nearest common fraction
 * Used for display purposes
 */
export function decimalToFraction(decimal: number, maxDenominator: number = 64): string {
  if (decimal === 0) {
    return "0";
  }

  // Handle negative numbers
  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);

  // Extract whole number part
  const whole = Math.floor(absDecimal);
  const fractionalPart = absDecimal - whole;

  // If there's no fractional part, return whole number
  if (fractionalPart < 0.001) {
    return isNegative ? `-${whole}` : `${whole}`;
  }

  // Find the best fraction approximation
  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Math.abs(fractionalPart);

  // Common fractions for inches (eighths, sixteenths, thirty-seconds, sixty-fourths)
  const commonDenominators = [2, 4, 8, 16, 32, 64];

  for (const denominator of commonDenominators) {
    if (denominator > maxDenominator) break;

    const numerator = Math.round(fractionalPart * denominator);
    const error = Math.abs(fractionalPart - numerator / denominator);

    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }

    // If we found an exact match, stop
    if (error < 0.001) {
      break;
    }
  }

  // Simplify the fraction
  const gcd = greatestCommonDivisor(bestNumerator, bestDenominator);
  const simplifiedNumerator = bestNumerator / gcd;
  const simplifiedDenominator = bestDenominator / gcd;

  // Build the result string
  let result = "";

  if (isNegative) {
    result += "-";
  }

  if (whole > 0) {
    result += `${whole}`;
    if (simplifiedNumerator > 0) {
      result += ` ${simplifiedNumerator}/${simplifiedDenominator}`;
    }
  } else {
    result += `${simplifiedNumerator}/${simplifiedDenominator}`;
  }

  return result;
}

/**
 * Calculate greatest common divisor for fraction simplification
 */
function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/**
 * Format a decimal number as a fraction with the inch symbol
 * Example: 0.25 → '1/4"'
 */
export function formatInchesAsFraction(value: number): string {
  const fraction = decimalToFraction(value);
  return `${fraction}"`;
}

/**
 * Parse user input for inch measurements
 * Returns decimal value or null if invalid
 */
export function parseInchInput(input: string): number | null {
  // Remove inch symbol if present
  const cleaned = input.replace(/["″'']/g, "").trim();
  return fractionToDecimal(cleaned);
}

/**
 * Validate if a string is a valid fraction or decimal input
 */
export function isValidFractionInput(input: string): boolean {
  const cleaned = input.replace(/["″'']/g, "").trim();
  return fractionToDecimal(cleaned) !== null;
}

/**
 * Common inch fractions for autocomplete/suggestions
 */
export const COMMON_INCH_FRACTIONS = [
  { fraction: "1/8", decimal: 0.125 },
  { fraction: "1/4", decimal: 0.25 },
  { fraction: "3/8", decimal: 0.375 },
  { fraction: "1/2", decimal: 0.5 },
  { fraction: "5/8", decimal: 0.625 },
  { fraction: "3/4", decimal: 0.75 },
  { fraction: "7/8", decimal: 0.875 },
  { fraction: "1", decimal: 1.0 },
  { fraction: "1 1/4", decimal: 1.25 },
  { fraction: "1 1/2", decimal: 1.5 },
  { fraction: "1 3/4", decimal: 1.75 },
  { fraction: "2", decimal: 2.0 },
  { fraction: "2 1/2", decimal: 2.5 },
  { fraction: "3", decimal: 3.0 },
  { fraction: "4", decimal: 4.0 },
];
