import { describe, it, expect } from 'vitest';
import {
  aggregateByPeriod,
  calculateMovingAverage,
  fillMissingDates,
  calculateCumulativeSum,
  normalizeData,
  getTopN,
} from '../chart-data-helpers';

describe('Chart Data Helpers', () => {
  describe('aggregateByPeriod', () => {
    const sampleData = [
      { date: new Date('2024-01-15'), value: 100 },
      { date: new Date('2024-01-16'), value: 150 },
      { date: new Date('2024-02-10'), value: 200 },
      { date: new Date('2024-02-20'), value: 250 },
    ];

    it('should aggregate by month', () => {
      const result = aggregateByPeriod(sampleData, 'month', 'date', 'value');
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(250); // Jan: 100 + 150
      expect(result[1].value).toBe(450); // Feb: 200 + 250
    });

    it('should aggregate by day', () => {
      const result = aggregateByPeriod(sampleData, 'day', 'date', 'value');
      expect(result).toHaveLength(4);
    });

    it('should handle empty data', () => {
      const result = aggregateByPeriod([], 'month', 'date', 'value');
      expect(result).toEqual([]);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate 3-period moving average', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
        { value: 40 },
        { value: 50 },
      ];

      const result = calculateMovingAverage(data, 3, 'value');
      expect(result[2].movingAverage).toBe(20); // (10+20+30)/3
      expect(result[3].movingAverage).toBe(30); // (20+30+40)/3
      expect(result[4].movingAverage).toBe(40); // (30+40+50)/3
    });

    it('should handle window larger than data', () => {
      const data = [{ value: 10 }, { value: 20 }];
      const result = calculateMovingAverage(data, 5, 'value');
      expect(result[0].movingAverage).toBeUndefined();
      expect(result[1].movingAverage).toBeUndefined();
    });
  });

  describe('fillMissingDates', () => {
    it('should fill missing dates in range', () => {
      const data = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-03'), value: 30 },
      ];

      const result = fillMissingDates(data, 'date', 0);
      expect(result).toHaveLength(3);
      expect(result[1].value).toBe(0); // Missing date filled with 0
    });

    it('should preserve existing values', () => {
      const data = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-02'), value: 20 },
      ];

      const result = fillMissingDates(data, 'date', 0);
      expect(result[0].value).toBe(10);
      expect(result[1].value).toBe(20);
    });
  });

  describe('calculateCumulativeSum', () => {
    it('should calculate cumulative sum correctly', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];

      const result = calculateCumulativeSum(data, 'value');
      expect(result[0].cumulativeSum).toBe(10);
      expect(result[1].cumulativeSum).toBe(30);
      expect(result[2].cumulativeSum).toBe(60);
    });

    it('should handle empty data', () => {
      const result = calculateCumulativeSum([], 'value');
      expect(result).toEqual([]);
    });
  });

  describe('normalizeData', () => {
    it('should normalize data to 0-100 scale', () => {
      const data = [
        { value: 10 },
        { value: 50 },
        { value: 90 },
      ];

      const result = normalizeData(data, 'value');
      expect(result[0].normalized).toBe(0); // Min value
      expect(result[1].normalized).toBe(50);
      expect(result[2].normalized).toBe(100); // Max value
    });

    it('should handle all same values', () => {
      const data = [
        { value: 50 },
        { value: 50 },
        { value: 50 },
      ];

      const result = normalizeData(data, 'value');
      expect(result[0].normalized).toBe(50);
      expect(result[1].normalized).toBe(50);
      expect(result[2].normalized).toBe(50);
    });
  });

  describe('getTopN', () => {
    const data = [
      { name: 'A', value: 100 },
      { name: 'B', value: 50 },
      { name: 'C', value: 30 },
      { name: 'D', value: 20 },
      { name: 'E', value: 10 },
    ];

    it('should return top N items', () => {
      const result = getTopN(data, 3, 'value', false);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('A');
      expect(result[1].name).toBe('B');
      expect(result[2].name).toBe('C');
    });

    it('should group remaining as "Others"', () => {
      const result = getTopN(data, 2, 'value', true);
      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('Outros');
      expect(result[2].value).toBe(60); // 30+20+10
    });

    it('should handle N larger than data length', () => {
      const result = getTopN(data, 10, 'value', false);
      expect(result).toHaveLength(5);
    });
  });
});
