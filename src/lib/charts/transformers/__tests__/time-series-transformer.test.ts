/**
 * Time Series Transformer Tests
 *
 * Comprehensive test suite for time series transformations including:
 * - Date parsing with various formats
 * - Grouping by time periods
 * - Filling missing dates with different strategies
 * - Moving averages
 * - Growth rate calculations
 * - Resampling time series
 * - Edge cases handling
 */

import { describe, it, expect } from 'vitest';
import { TimeSeriesTransformer } from '../time-series-transformer';

describe('TimeSeriesTransformer', () => {
  describe('transform()', () => {
    it('should transform raw data into time series format with ISO dates', () => {
      const data = [
        { date: '2024-01-03', value: 300 },
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 200 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        dateFormat: 'iso',
        sortOrder: 'asc',
      });

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(100);
      expect(result[1].value).toBe(200);
      expect(result[2].value).toBe(300);
      expect(result[0]._parsedDate).toBeInstanceOf(Date);
    });

    it('should handle unix timestamps', () => {
      const data = [
        { timestamp: 1704067200, value: 100 }, // 2024-01-01 00:00:00 UTC
        { timestamp: 1704153600, value: 200 }, // 2024-01-02 00:00:00 UTC
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'timestamp',
        valueKeys: ['value'],
        dateFormat: 'unix',
      });

      expect(result).toHaveLength(2);
      expect(result[0]._parsedDate).toBeInstanceOf(Date);
    });

    it('should handle custom date parser', () => {
      const data = [
        { customDate: '01/01/2024', value: 100 },
        { customDate: '02/01/2024', value: 200 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'customDate',
        valueKeys: ['value'],
        customDateParser: (val) => {
          const [day, month, year] = val.split('/');
          return new Date(Number(year), Number(month) - 1, Number(day));
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]._parsedDate).toBeInstanceOf(Date);
    });

    it('should return empty array for empty input', () => {
      const result = TimeSeriesTransformer.transform([], {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toEqual([]);
    });

    it('should sort data in descending order', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-03', value: 300 },
        { date: '2024-01-02', value: 200 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        sortOrder: 'desc',
      });

      expect(result[0].value).toBe(300);
      expect(result[1].value).toBe(200);
      expect(result[2].value).toBe(100);
    });
  });

  describe('groupByPeriod()', () => {
    it('should group by day and average values', () => {
      const data = [
        { date: '2024-01-01T10:00:00', value: 100 },
        { date: '2024-01-01T14:00:00', value: 200 },
        { date: '2024-01-02T10:00:00', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'day',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // Average of 100 and 200
      expect(result[1].value).toBe(300);
    });

    it('should group by week', () => {
      const data = [
        { date: new Date(2024, 0, 1, 12, 0), value: 100 }, // Week 1, noon to avoid timezone issues
        { date: new Date(2024, 0, 3, 12, 0), value: 200 }, // Week 1
        { date: new Date(2024, 0, 8, 12, 0), value: 300 }, // Week 2
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'week',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // Average of week 1
      expect(result[1].value).toBe(300);
    });

    it('should group by month', () => {
      const data = [
        { date: new Date(2024, 0, 1, 12, 0), value: 100 },  // January, noon to avoid timezone issues
        { date: new Date(2024, 0, 15, 12, 0), value: 200 }, // January
        { date: new Date(2024, 1, 1, 12, 0), value: 300 },  // February
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'month',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // January average
      expect(result[1].value).toBe(300); // February
    });

    it('should group by quarter', () => {
      const data = [
        { date: new Date(2024, 0, 1, 12, 0), value: 100 },  // Q1 (Jan), noon to avoid timezone issues
        { date: new Date(2024, 1, 1, 12, 0), value: 200 },  // Q1 (Feb)
        { date: new Date(2024, 3, 1, 12, 0), value: 300 },  // Q2 (Apr)
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'quarter',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // Q1 average
      expect(result[1].value).toBe(300); // Q2
    });

    it('should group by year', () => {
      const data = [
        { date: new Date(2024, 0, 1, 12, 0), value: 100 },  // 2024, noon to avoid timezone issues
        { date: new Date(2024, 5, 1, 12, 0), value: 200 },  // 2024
        { date: new Date(2025, 0, 1, 12, 0), value: 300 },  // 2025
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'year',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // 2024 average
      expect(result[1].value).toBe(300); // 2025
    });

    it('should group by hour', () => {
      const data = [
        { date: '2024-01-01T10:00:00', value: 100 },
        { date: '2024-01-01T10:30:00', value: 200 },
        { date: '2024-01-01T11:00:00', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'hour',
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // 10:00 hour average
      expect(result[1].value).toBe(300); // 11:00 hour
    });

    it('should handle multiple value keys when grouping', () => {
      const data = [
        { date: '2024-01-01', sales: 100, profit: 20 },
        { date: '2024-01-01', sales: 200, profit: 40 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['sales', 'profit'],
        groupBy: 'day',
      });

      expect(result).toHaveLength(1);
      expect(result[0].sales).toBe(150);
      expect(result[0].profit).toBe(30);
    });
  });

  describe('fillMissingDates()', () => {
    it('should fill missing dates with interpolated values', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-05', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        fillMissingDates: true,
        fillValue: 'interpolate',
        groupBy: 'day',
      });

      expect(result.length).toBeGreaterThan(2);
      expect(result[0].value).toBe(100);
      expect(result[result.length - 1].value).toBe(300);

      // Check interpolated values exist
      const filledPoints = result.filter(p => p._filled);
      expect(filledPoints.length).toBeGreaterThan(0);
    });

    it('should fill missing dates with previous value', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-05', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        fillMissingDates: true,
        fillValue: 'previous',
        groupBy: 'day',
      });

      const filledPoints = result.filter(p => p._filled);
      filledPoints.forEach(point => {
        expect(point.value).toBe(100);
      });
    });

    it('should fill missing dates with next value', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-05', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        fillMissingDates: true,
        fillValue: 'next',
        groupBy: 'day',
      });

      const filledPoints = result.filter(p => p._filled);
      filledPoints.forEach(point => {
        expect(point.value).toBe(300);
      });
    });

    it('should fill missing dates with constant value', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-05', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        fillMissingDates: true,
        fillValue: 0,
        groupBy: 'day',
      });

      const filledPoints = result.filter(p => p._filled);
      filledPoints.forEach(point => {
        expect(point.value).toBe(0);
      });
    });

    it('should not fill dates if less than 2 data points', () => {
      const data = [{ date: '2024-01-01', value: 100 }];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        fillMissingDates: true,
        fillValue: 'interpolate',
      });

      expect(result).toHaveLength(1);
    });

    it('should correctly interpolate with multiple value keys', () => {
      const data = [
        { date: '2024-01-01', sales: 100, profit: 20 },
        { date: '2024-01-03', sales: 300, profit: 60 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['sales', 'profit'],
        fillMissingDates: true,
        fillValue: 'interpolate',
        groupBy: 'day',
      });

      expect(result.length).toBe(3);
      const midPoint = result[1];
      expect(midPoint.sales).toBe(200); // Interpolated
      expect(midPoint.profit).toBe(40); // Interpolated
    });
  });

  describe('calculateMovingAverage()', () => {
    it('should calculate 3-period moving average', () => {
      const data = [
        { date: '2024-01-01', value: 100, _parsedDate: new Date('2024-01-01') },
        { date: '2024-01-02', value: 200, _parsedDate: new Date('2024-01-02') },
        { date: '2024-01-03', value: 300, _parsedDate: new Date('2024-01-03') },
        { date: '2024-01-04', value: 400, _parsedDate: new Date('2024-01-04') },
      ];

      const result = TimeSeriesTransformer.calculateMovingAverage(data, 'value', 3);

      expect(result[0].value_ma3).toBe(100); // Only 1 point
      expect(result[1].value_ma3).toBe(150); // (100 + 200) / 2
      expect(result[2].value_ma3).toBe(200); // (100 + 200 + 300) / 3
      expect(result[3].value_ma3).toBe(300); // (200 + 300 + 400) / 3
    });

    it('should calculate 2-period moving average', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-02') },
        { value: 300, _parsedDate: new Date('2024-01-03') },
      ];

      const result = TimeSeriesTransformer.calculateMovingAverage(data, 'value', 2);

      expect(result[0].value_ma2).toBe(100);
      expect(result[1].value_ma2).toBe(150);
      expect(result[2].value_ma2).toBe(250);
    });

    it('should handle single data point', () => {
      const data = [{ value: 100, _parsedDate: new Date() }];

      const result = TimeSeriesTransformer.calculateMovingAverage(data, 'value', 3);

      expect(result[0].value_ma3).toBe(100);
    });

    it('should handle null/undefined values as zero', () => {
      const data = [
        { value: 100, _parsedDate: new Date() },
        { value: null, _parsedDate: new Date() },
        { value: 300, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateMovingAverage(data, 'value', 2);

      expect(result[1].value_ma2).toBe(50); // (100 + 0) / 2
      expect(result[2].value_ma2).toBe(150); // (0 + 300) / 2
    });

    it('should preserve original data', () => {
      const data = [
        { date: '2024-01-01', value: 100, _parsedDate: new Date() },
        { date: '2024-01-02', value: 200, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateMovingAverage(data, 'value', 2);

      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].value).toBe(100);
    });
  });

  describe('calculateGrowthRate()', () => {
    it('should calculate percentage growth rate', () => {
      const data = [
        { value: 100, _parsedDate: new Date() },
        { value: 150, _parsedDate: new Date() },
        { value: 225, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateGrowthRate(data, 'value');

      expect(result[0].value_growth).toBe(0); // First point has no growth
      expect(result[1].value_growth).toBe(50); // (150-100)/100 * 100 = 50%
      expect(result[2].value_growth).toBe(50); // (225-150)/150 * 100 = 50%
    });

    it('should handle negative growth', () => {
      const data = [
        { value: 200, _parsedDate: new Date() },
        { value: 100, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateGrowthRate(data, 'value');

      expect(result[1].value_growth).toBe(-50); // (100-200)/200 * 100 = -50%
    });

    it('should handle zero previous value', () => {
      const data = [
        { value: 0, _parsedDate: new Date() },
        { value: 100, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateGrowthRate(data, 'value');

      expect(result[1].value_growth).toBe(0); // Division by zero handled
    });

    it('should handle single data point', () => {
      const data = [{ value: 100, _parsedDate: new Date() }];

      const result = TimeSeriesTransformer.calculateGrowthRate(data, 'value');

      expect(result[0].value_growth).toBe(0);
    });

    it('should calculate accurate growth rates with decimals', () => {
      const data = [
        { value: 100.5, _parsedDate: new Date() },
        { value: 110.55, _parsedDate: new Date() },
      ];

      const result = TimeSeriesTransformer.calculateGrowthRate(data, 'value');

      expect(result[1].value_growth).toBeCloseTo(10, 0); // ~10% growth
    });
  });

  describe('resample()', () => {
    it('should resample to day with sum aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01T10:00:00') },
        { value: 200, _parsedDate: new Date('2024-01-01T14:00:00') },
        { value: 300, _parsedDate: new Date('2024-01-02T10:00:00') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'sum', ['value']);

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(300); // Sum for day 1
      expect(result[1].value).toBe(300); // Sum for day 2
    });

    it('should resample to week with average aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date(2024, 0, 1, 12, 0) },  // Week 1, noon to avoid timezone issues
        { value: 200, _parsedDate: new Date(2024, 0, 2, 12, 0) },  // Week 1
        { value: 300, _parsedDate: new Date(2024, 0, 8, 12, 0) },  // Week 2
      ];

      const result = TimeSeriesTransformer.resample(data, 'week', 'avg', ['value']);

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // Average for week 1
      expect(result[1].value).toBe(300); // Average for week 2
    });

    it('should resample with min aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-01') },
        { value: 50, _parsedDate: new Date('2024-01-01') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'min', ['value']);

      expect(result[0].value).toBe(50);
    });

    it('should resample with max aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-01') },
        { value: 50, _parsedDate: new Date('2024-01-01') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'max', ['value']);

      expect(result[0].value).toBe(200);
    });

    it('should resample with first aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-01') },
        { value: 300, _parsedDate: new Date('2024-01-01') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'first', ['value']);

      expect(result[0].value).toBe(100);
    });

    it('should resample with last aggregation', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-01') },
        { value: 300, _parsedDate: new Date('2024-01-01') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'last', ['value']);

      expect(result[0].value).toBe(300);
    });

    it('should handle multiple value keys in resampling', () => {
      const data = [
        { sales: 100, profit: 20, _parsedDate: new Date('2024-01-01') },
        { sales: 200, profit: 40, _parsedDate: new Date('2024-01-01') },
      ];

      const result = TimeSeriesTransformer.resample(data, 'day', 'sum', ['sales', 'profit']);

      expect(result[0].sales).toBe(300);
      expect(result[0].profit).toBe(60);
    });

    it('should resample to month', () => {
      const data = [
        { value: 100, _parsedDate: new Date(2024, 0, 1, 12, 0) },   // January, noon to avoid timezone issues
        { value: 200, _parsedDate: new Date(2024, 0, 15, 12, 0) },  // January
        { value: 300, _parsedDate: new Date(2024, 1, 1, 12, 0) },   // February
      ];

      const result = TimeSeriesTransformer.resample(data, 'month', 'sum', ['value']);

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(300); // January sum
      expect(result[1].value).toBe(300); // February sum
    });
  });

  describe('filterByDateRange()', () => {
    it('should filter data within date range', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-15') },
        { value: 300, _parsedDate: new Date('2024-02-01') },
      ];

      const result = TimeSeriesTransformer.filterByDateRange(
        data,
        new Date('2024-01-10'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(200);
    });

    it('should include boundary dates', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-15') },
        { value: 300, _parsedDate: new Date('2024-02-01') },
      ];

      const result = TimeSeriesTransformer.filterByDateRange(
        data,
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no dates in range', () => {
      const data = [
        { value: 100, _parsedDate: new Date('2024-01-01') },
        { value: 200, _parsedDate: new Date('2024-01-02') },
      ];

      const result = TimeSeriesTransformer.filterByDateRange(
        data,
        new Date('2024-02-01'),
        new Date('2024-02-28')
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data array', () => {
      const result = TimeSeriesTransformer.transform([], {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toEqual([]);
    });

    it('should handle single data point', () => {
      const data = [{ date: '2024-01-01', value: 100 }];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(100);
    });

    it('should handle duplicate dates', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-01', value: 200 },
        { date: '2024-01-01', value: 300 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'day',
      });

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(200); // Average of 100, 200, 300
    });

    it('should handle null values', () => {
      const data = [
        { date: '2024-01-01', value: null },
        { date: '2024-01-02', value: 200 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(null);
    });

    it('should handle undefined values', () => {
      const data = [
        { date: '2024-01-01' },
        { date: '2024-01-02', value: 200 },
      ];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toHaveLength(2);
    });

    it('should preserve data integrity - count matches', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString(),
        value: Math.random() * 1000,
      }));

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(result).toHaveLength(data.length);
    });

    it('should handle very large datasets efficiently', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        date: new Date(2024, 0, 1 + (i % 365)).toISOString(),
        value: Math.random() * 1000,
      }));

      const start = Date.now();
      const result = TimeSeriesTransformer.transform(largeData, {
        dateKey: 'date',
        valueKeys: ['value'],
        groupBy: 'day',
      });
      const duration = Date.now() - start;

      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should return correct types for all fields', () => {
      const data = [{ date: '2024-01-01', value: 100 }];

      const result = TimeSeriesTransformer.transform(data, {
        dateKey: 'date',
        valueKeys: ['value'],
      });

      expect(typeof result[0].value).toBe('number');
      expect(result[0]._parsedDate).toBeInstanceOf(Date);
    });
  });
});
