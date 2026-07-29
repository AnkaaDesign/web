import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatCompactNumber,
  formatDuration,
} from '../chart-formatters';
import { withPricingVisible } from '@/utils/pricing-visibility';

/**
 * `Intl.NumberFormat('pt-BR', { style: 'currency' })` separates "R$" from the number with a
 * NON-BREAKING space (U+00A0), and which of NBSP / NNBSP it picks has changed between ICU
 * versions. Asserting on a literal space made these cases depend on the Node build rather than on
 * the formatting, so normalise the whitespace and let the assertion be about the digits.
 */
const spaces = (value: string): string => value.replace(/[\u00a0\u202f]/g, ' ');

describe('Chart Formatters', () => {
  // `formatCurrency` is MASKED unless prices are visible, and the module default is hidden
  // (see utils/pricing-visibility.ts). These cases are about the FORMATTING, so they run inside
  // `withPricingVisible` — the same helper exports and share links use to get real values out of
  // a masked screen. The masking itself is pinned by its own test below, so neither behaviour can
  // regress unnoticed.
  describe('formatCurrency', () => {
    it('should format positive values correctly', () => {
      withPricingVisible(() => {
        expect(spaces(formatCurrency(1234.56))).toBe('R$ 1.234,56');
        expect(spaces(formatCurrency(1000000))).toBe('R$ 1.000.000,00');
        expect(spaces(formatCurrency(0.99))).toBe('R$ 0,99');
      });
    });

    it('should format negative values correctly', () => {
      withPricingVisible(() => {
        expect(spaces(formatCurrency(-1234.56))).toBe('-R$ 1.234,56');
        expect(spaces(formatCurrency(-100))).toBe('-R$ 100,00');
      });
    });

    it('should handle zero', () => {
      withPricingVisible(() => {
        expect(spaces(formatCurrency(0))).toBe('R$ 0,00');
      });
    });

    it('should handle very large numbers', () => {
      withPricingVisible(() => {
        expect(spaces(formatCurrency(999999999.99))).toBe('R$ 999.999.999,99');
      });
    });

    it('masks the value when prices are hidden', () => {
      expect(formatCurrency(1234.56)).toBe('R$ \u2022\u2022\u2022\u2022\u2022\u2022');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with default precision', () => {
      expect(formatPercentage(0.1234)).toBe('12,34%');
      expect(formatPercentage(0.5)).toBe('50,00%');
      expect(formatPercentage(1)).toBe('100,00%');
    });

    it('should format percentages with custom precision', () => {
      expect(formatPercentage(0.123456, { maximumFractionDigits: 1, minimumFractionDigits: 1 })).toBe('12,3%');
      expect(formatPercentage(0.123456, { maximumFractionDigits: 3, minimumFractionDigits: 3 })).toBe('12,346%');
    });

    it('should handle negative percentages', () => {
      expect(formatPercentage(-0.15)).toBe('-15,00%');
    });

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0,00%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1234)).toBe('1.234');
      expect(formatNumber(1234567)).toBe('1.234.567');
    });

    it('should format decimals correctly', () => {
      expect(formatNumber(1234.56, 2)).toBe('1.234,56');
      expect(formatNumber(1234.567, 1)).toBe('1.234,6');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1234.56, 2)).toBe('-1.234,56');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format numbers less than 1000', () => {
      expect(formatCompactNumber(999)).toBe('999');
      expect(formatCompactNumber(500)).toBe('500');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCompactNumber(1000)).toBe('1K');
      expect(formatCompactNumber(1500)).toBe('1,5K');
      expect(formatCompactNumber(999999)).toBe('1000K');
    });

    it('should format millions with M suffix', () => {
      expect(formatCompactNumber(1000000)).toBe('1M');
      expect(formatCompactNumber(1500000)).toBe('1,5M');
      expect(formatCompactNumber(25000000)).toBe('25M');
    });

    it('should format billions with B suffix', () => {
      expect(formatCompactNumber(1000000000)).toBe('1B');
      expect(formatCompactNumber(2500000000)).toBe('2,5B');
    });
  });

  describe('formatDate', () => {
    it('should format dates in Brazilian format', () => {
      const date = new Date('2024-03-15T10:30:00');
      expect(formatDate(date)).toBe('15/03/2024');
    });

    it('should format with custom pattern', () => {
      const date = new Date('2024-03-15T10:30:00');
      expect(formatDate(date, 'dd/MM/yyyy HH:mm')).toContain('15/03/2024');
    });

    it('should handle different date formats', () => {
      // A DATE-ONLY string is UTC midnight per the ECMAScript spec, so `new Date('2024-12-31')`
      // is already 30/12 21:00 in America/Sao_Paulo and formatting it locally must say 30/12.
      // Passing the string straight in takes the `parseISO` branch, which reads a date-only value
      // as LOCAL midnight — that is the path real callers use, and the one that shows the day the
      // API meant.
      expect(formatDate('2024-12-31')).toBe('31/12/2024');
      expect(formatDate(new Date(2024, 11, 31))).toBe('31/12/2024');
    });
  });

  describe('formatDuration', () => {
    it('should format hours correctly', () => {
      expect(formatDuration(5)).toBe('5h');
      // Under an hour reads as minutes rather than "0,5h" — deliberate, and what the function
      // has done since it was written.
      expect(formatDuration(0.5)).toBe('30 min');
    });

    it('should format days and hours', () => {
      expect(formatDuration(24)).toBe('1d');
      expect(formatDuration(27)).toBe('1d 3h');
      expect(formatDuration(48.5)).toBe('2d 0,5h');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0h');
    });
  });
});
