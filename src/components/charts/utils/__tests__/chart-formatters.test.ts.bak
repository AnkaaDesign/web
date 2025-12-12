import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatCompactNumber,
  formatDuration,
} from '../chart-formatters';

describe('Chart Formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive values correctly', () => {
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
      expect(formatCurrency(1000000)).toBe('R$ 1.000.000,00');
      expect(formatCurrency(0.99)).toBe('R$ 0,99');
    });

    it('should format negative values correctly', () => {
      expect(formatCurrency(-1234.56)).toBe('-R$ 1.234,56');
      expect(formatCurrency(-100)).toBe('-R$ 100,00');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('R$ 0,00');
    });

    it('should handle very large numbers', () => {
      expect(formatCurrency(999999999.99)).toBe('R$ 999.999.999,99');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with default precision', () => {
      expect(formatPercentage(0.1234)).toBe('12,34%');
      expect(formatPercentage(0.5)).toBe('50,00%');
      expect(formatPercentage(1)).toBe('100,00%');
    });

    it('should format percentages with custom precision', () => {
      expect(formatPercentage(0.123456, 1)).toBe('12,3%');
      expect(formatPercentage(0.123456, 3)).toBe('12,346%');
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
      const date = new Date('2024-12-31');
      expect(formatDate(date)).toBe('31/12/2024');
    });
  });

  describe('formatDuration', () => {
    it('should format hours correctly', () => {
      expect(formatDuration(5)).toBe('5h');
      expect(formatDuration(0.5)).toBe('0,5h');
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
