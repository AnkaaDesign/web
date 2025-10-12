/**
 * Time Series Transformer
 *
 * Transforms raw data into time series format for line and area charts.
 * Handles date parsing, sorting, grouping, and interpolation.
 */

interface TimeSeriesDataPoint {
  date: Date | string | number;
  [key: string]: any;
}

interface TimeSeriesConfig {
  dateKey: string;
  valueKeys: string[];
  dateFormat?: 'iso' | 'unix' | 'custom';
  customDateParser?: (value: any) => Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  fillMissingDates?: boolean;
  fillValue?: number | 'interpolate' | 'previous' | 'next';
  sortOrder?: 'asc' | 'desc';
}

export class TimeSeriesTransformer {
  /**
   * Transform raw data into time series format
   */
  static transform(data: any[], config: TimeSeriesConfig): TimeSeriesDataPoint[] {
    if (!data || data.length === 0) {
      return [];
    }

    // Parse dates
    let parsed = this.parseDates(data, config);

    // Sort by date
    parsed = this.sortByDate(parsed, config.sortOrder || 'asc');

    // Group by time period if specified
    if (config.groupBy) {
      parsed = this.groupByPeriod(parsed, config);
    }

    // Fill missing dates if specified
    if (config.fillMissingDates) {
      parsed = this.fillMissingDates(parsed, config);
    }

    return parsed;
  }

  /**
   * Parse dates according to format
   */
  private static parseDates(data: any[], config: TimeSeriesConfig): TimeSeriesDataPoint[] {
    return data.map((item) => {
      let date: Date;

      if (config.customDateParser) {
        date = config.customDateParser(item[config.dateKey]);
      } else {
        switch (config.dateFormat) {
          case 'unix':
            date = new Date(Number(item[config.dateKey]) * 1000);
            break;
          case 'iso':
          default:
            date = new Date(item[config.dateKey]);
            break;
        }
      }

      return {
        ...item,
        [config.dateKey]: date,
        _parsedDate: date,
      };
    });
  }

  /**
   * Sort data by date
   */
  private static sortByDate(data: TimeSeriesDataPoint[], order: 'asc' | 'desc'): TimeSeriesDataPoint[] {
    return data.sort((a, b) => {
      const dateA = (a._parsedDate as Date).getTime();
      const dateB = (b._parsedDate as Date).getTime();
      return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }

  /**
   * Group data by time period
   */
  private static groupByPeriod(data: TimeSeriesDataPoint[], config: TimeSeriesConfig): TimeSeriesDataPoint[] {
    const grouped = new Map<string, any[]>();

    data.forEach((item) => {
      const date = item._parsedDate as Date;
      const key = this.getGroupKey(date, config.groupBy!);

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    // Aggregate grouped data
    const result: TimeSeriesDataPoint[] = [];
    grouped.forEach((items, key) => {
      const aggregated: any = {
        [config.dateKey]: items[0]._parsedDate,
        _parsedDate: items[0]._parsedDate,
        _groupKey: key,
      };

      config.valueKeys.forEach((valueKey) => {
        const values = items.map((item) => Number(item[valueKey]) || 0);
        aggregated[valueKey] = values.reduce((sum, val) => sum + val, 0) / values.length;
      });

      result.push(aggregated);
    });

    return result;
  }

  /**
   * Get group key based on period
   */
  private static getGroupKey(date: Date, period: string): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();

    switch (period) {
      case 'hour':
        return `${year}-${month}-${day}-${hour}`;
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${weekNum}`;
      case 'month':
        return `${year}-${month}`;
      case 'quarter':
        const quarter = Math.floor(month / 3);
        return `${year}-Q${quarter}`;
      case 'year':
        return `${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Get ISO week number
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Fill missing dates in the series
   */
  private static fillMissingDates(data: TimeSeriesDataPoint[], config: TimeSeriesConfig): TimeSeriesDataPoint[] {
    if (data.length < 2) {
      return data;
    }

    const result: TimeSeriesDataPoint[] = [];
    const interval = this.getIntervalMs(config.groupBy || 'day');

    for (let i = 0; i < data.length - 1; i++) {
      result.push(data[i]);

      const currentDate = (data[i]._parsedDate as Date).getTime();
      const nextDate = (data[i + 1]._parsedDate as Date).getTime();
      const gap = nextDate - currentDate;

      if (gap > interval) {
        const fillPoints = this.createFillPoints(data[i], data[i + 1], config, interval);
        result.push(...fillPoints);
      }
    }

    result.push(data[data.length - 1]);
    return result;
  }

  /**
   * Create fill points for missing dates
   */
  private static createFillPoints(
    start: TimeSeriesDataPoint,
    end: TimeSeriesDataPoint,
    config: TimeSeriesConfig,
    interval: number
  ): TimeSeriesDataPoint[] {
    const result: TimeSeriesDataPoint[] = [];
    const startDate = (start._parsedDate as Date).getTime();
    const endDate = (end._parsedDate as Date).getTime();

    let currentDate = startDate + interval;

    while (currentDate < endDate) {
      const point: any = {
        [config.dateKey]: new Date(currentDate),
        _parsedDate: new Date(currentDate),
        _filled: true,
      };

      config.valueKeys.forEach((valueKey) => {
        if (config.fillValue === 'interpolate') {
          const progress = (currentDate - startDate) / (endDate - startDate);
          const startVal = Number(start[valueKey]) || 0;
          const endVal = Number(end[valueKey]) || 0;
          point[valueKey] = startVal + (endVal - startVal) * progress;
        } else if (config.fillValue === 'previous') {
          point[valueKey] = start[valueKey];
        } else if (config.fillValue === 'next') {
          point[valueKey] = end[valueKey];
        } else {
          point[valueKey] = config.fillValue ?? null;
        }
      });

      result.push(point);
      currentDate += interval;
    }

    return result;
  }

  /**
   * Get interval in milliseconds
   */
  private static getIntervalMs(period: string): number {
    switch (period) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      case 'quarter':
        return 90 * 24 * 60 * 60 * 1000;
      case 'year':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Calculate moving average
   */
  static calculateMovingAverage(data: TimeSeriesDataPoint[], valueKey: string, window: number): TimeSeriesDataPoint[] {
    return data.map((item, index) => {
      const start = Math.max(0, index - window + 1);
      const windowData = data.slice(start, index + 1);
      const sum = windowData.reduce((acc, curr) => acc + (Number(curr[valueKey]) || 0), 0);
      return {
        ...item,
        [`${valueKey}_ma${window}`]: sum / windowData.length,
      };
    });
  }

  /**
   * Calculate growth rate
   */
  static calculateGrowthRate(data: TimeSeriesDataPoint[], valueKey: string): TimeSeriesDataPoint[] {
    return data.map((item, index) => {
      if (index === 0) {
        return {
          ...item,
          [`${valueKey}_growth`]: 0,
        };
      }

      const current = Number(item[valueKey]) || 0;
      const previous = Number(data[index - 1][valueKey]) || 0;
      const growth = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

      return {
        ...item,
        [`${valueKey}_growth`]: growth,
      };
    });
  }

  /**
   * Filter by date range
   */
  static filterByDateRange(data: TimeSeriesDataPoint[], startDate: Date, endDate: Date): TimeSeriesDataPoint[] {
    return data.filter((item) => {
      const date = item._parsedDate as Date;
      return date >= startDate && date <= endDate;
    });
  }

  /**
   * Resample to different frequency
   */
  static resample(
    data: TimeSeriesDataPoint[],
    targetPeriod: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year',
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last',
    valueKeys: string[]
  ): TimeSeriesDataPoint[] {
    const grouped = new Map<string, TimeSeriesDataPoint[]>();

    data.forEach((item) => {
      const date = item._parsedDate as Date;
      const key = this.getGroupKey(date, targetPeriod);

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const result: TimeSeriesDataPoint[] = [];
    grouped.forEach((items) => {
      const aggregated: any = {
        _parsedDate: items[0]._parsedDate,
      };

      valueKeys.forEach((valueKey) => {
        const values = items.map((item) => Number(item[valueKey]) || 0);

        switch (aggregation) {
          case 'sum':
            aggregated[valueKey] = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'avg':
            aggregated[valueKey] = values.reduce((sum, val) => sum + val, 0) / values.length;
            break;
          case 'min':
            aggregated[valueKey] = Math.min(...values);
            break;
          case 'max':
            aggregated[valueKey] = Math.max(...values);
            break;
          case 'first':
            aggregated[valueKey] = values[0];
            break;
          case 'last':
            aggregated[valueKey] = values[values.length - 1];
            break;
        }
      });

      result.push(aggregated);
    });

    return result;
  }
}
