/**
 * Aggregation Transformer
 *
 * Provides various aggregation functions for chart data.
 * Supports grouping, rollup, pivot, and statistical aggregations.
 */

interface AggregationConfig {
  groupBy: string | string[];
  aggregations: Array<{
    field: string;
    operation: AggregationType;
    alias?: string;
  }>;
  having?: {
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
}

type AggregationType =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'median'
  | 'mode'
  | 'stddev'
  | 'variance'
  | 'first'
  | 'last'
  | 'distinct';

interface GroupedData {
  [key: string]: any;
}

export class AggregationTransformer {
  /**
   * Aggregate data with grouping
   */
  static aggregate(data: any[], config: AggregationConfig): GroupedData[] {
    const groups = this.groupData(data, config.groupBy);
    const result: GroupedData[] = [];

    groups.forEach((items, groupKey) => {
      const row: any = this.parseGroupKey(groupKey, config.groupBy);

      config.aggregations.forEach((agg) => {
        const values = items.map((item) => item[agg.field]);
        const aggregatedValue = this.performAggregation(values, agg.operation);
        const outputKey = agg.alias || `${agg.operation}_${agg.field}`;
        row[outputKey] = aggregatedValue;
      });

      // Apply HAVING filter if specified
      if (config.having) {
        const fieldValue = row[config.having.field];
        if (this.evaluateCondition(fieldValue, config.having.operator, config.having.value)) {
          result.push(row);
        }
      } else {
        result.push(row);
      }
    });

    return result;
  }

  /**
   * Group data by keys
   */
  private static groupData(data: any[], groupBy: string | string[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    const keys = Array.isArray(groupBy) ? groupBy : [groupBy];

    data.forEach((item) => {
      const groupKey = keys.map((key) => String(item[key] ?? 'null')).join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    return groups;
  }

  /**
   * Parse group key back to object
   */
  private static parseGroupKey(groupKey: string, groupBy: string | string[]): any {
    const keys = Array.isArray(groupBy) ? groupBy : [groupBy];
    const values = groupKey.split('|');
    const result: any = {};

    keys.forEach((key, index) => {
      result[key] = values[index] === 'null' ? null : values[index];
    });

    return result;
  }

  /**
   * Perform aggregation operation
   */
  private static performAggregation(values: any[], operation: AggregationType): number {
    const numbers = values.map((v) => Number(v)).filter((v) => !isNaN(v));

    switch (operation) {
      case 'sum':
        return numbers.reduce((sum, val) => sum + val, 0);

      case 'avg':
        return numbers.length > 0 ? numbers.reduce((sum, val) => sum + val, 0) / numbers.length : 0;

      case 'count':
        return values.length;

      case 'min':
        return numbers.length > 0 ? Math.min(...numbers) : 0;

      case 'max':
        return numbers.length > 0 ? Math.max(...numbers) : 0;

      case 'median':
        return this.calculateMedian(numbers);

      case 'mode':
        return this.calculateMode(numbers);

      case 'stddev':
        return this.calculateStdDev(numbers);

      case 'variance':
        return this.calculateVariance(numbers);

      case 'first':
        return numbers.length > 0 ? numbers[0] : 0;

      case 'last':
        return numbers.length > 0 ? numbers[numbers.length - 1] : 0;

      case 'distinct':
        return new Set(values).size;

      default:
        return 0;
    }
  }

  /**
   * Calculate median
   */
  private static calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Calculate mode
   */
  private static calculateMode(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const frequency = new Map<number, number>();
    let maxFreq = 0;
    let mode = numbers[0];

    numbers.forEach((num) => {
      const freq = (frequency.get(num) || 0) + 1;
      frequency.set(num, freq);

      if (freq > maxFreq) {
        maxFreq = freq;
        mode = num;
      }
    });

    return mode;
  }

  /**
   * Calculate standard deviation
   */
  private static calculateStdDev(numbers: number[]): number {
    return Math.sqrt(this.calculateVariance(numbers));
  }

  /**
   * Calculate variance
   */
  private static calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const avg = numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
    const squaredDiffs = numbers.map((val) => Math.pow(val - avg, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / numbers.length;
  }

  /**
   * Evaluate condition for HAVING clause
   */
  private static evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return true;
    }
  }

  /**
   * Rolling aggregation
   */
  static rollingAggregate(
    data: any[],
    valueKey: string,
    window: number,
    operation: AggregationType = 'avg'
  ): any[] {
    return data.map((item, index) => {
      const start = Math.max(0, index - window + 1);
      const windowData = data.slice(start, index + 1);
      const values = windowData.map((d) => d[valueKey]);
      const aggregated = this.performAggregation(values, operation);

      return {
        ...item,
        [`${valueKey}_rolling_${operation}`]: aggregated,
      };
    });
  }

  /**
   * Cumulative aggregation
   */
  static cumulativeAggregate(data: any[], valueKey: string, operation: 'sum' | 'avg' = 'sum'): any[] {
    let cumulative = 0;
    let count = 0;

    return data.map((item) => {
      const value = Number(item[valueKey]) || 0;
      count++;

      if (operation === 'sum') {
        cumulative += value;
      } else {
        cumulative = (cumulative * (count - 1) + value) / count;
      }

      return {
        ...item,
        [`${valueKey}_cumulative_${operation}`]: cumulative,
      };
    });
  }

  /**
   * Group and pivot
   */
  static pivot(
    data: any[],
    rowKey: string,
    colKey: string,
    valueKey: string,
    aggregation: AggregationType = 'sum'
  ): any[] {
    const rows = new Set<string>();
    const cols = new Set<string>();

    data.forEach((item) => {
      rows.add(String(item[rowKey]));
      cols.add(String(item[colKey]));
    });

    const result: any[] = [];

    rows.forEach((row) => {
      const pivotRow: any = {
        [rowKey]: row,
      };

      cols.forEach((col) => {
        const matches = data.filter(
          (item) => String(item[rowKey]) === row && String(item[colKey]) === col
        );

        const values = matches.map((item) => item[valueKey]);
        pivotRow[col] = this.performAggregation(values, aggregation);
      });

      result.push(pivotRow);
    });

    return result;
  }

  /**
   * Unpivot (melt) data
   */
  static unpivot(
    data: any[],
    idColumns: string[],
    valueColumns: string[],
    variableName = 'variable',
    valueName = 'value'
  ): any[] {
    const result: any[] = [];

    data.forEach((row) => {
      valueColumns.forEach((col) => {
        const unpivoted: any = {};

        idColumns.forEach((idCol) => {
          unpivoted[idCol] = row[idCol];
        });

        unpivoted[variableName] = col;
        unpivoted[valueName] = row[col];

        result.push(unpivoted);
      });
    });

    return result;
  }

  /**
   * Multi-level grouping (rollup)
   */
  static rollup(data: any[], groupLevels: string[][], aggregations: any[]): any[] {
    const result: any[] = [];

    groupLevels.forEach((level) => {
      const aggregated = this.aggregate(data, {
        groupBy: level,
        aggregations,
      });

      aggregated.forEach((row) => {
        result.push({
          ...row,
          _groupLevel: level.join(','),
          _groupDepth: level.length,
        });
      });
    });

    return result;
  }

  /**
   * Percentile calculation
   */
  static percentile(data: any[], valueKey: string, percentile: number): number {
    const values = data.map((item) => Number(item[valueKey]) || 0).sort((a, b) => a - b);

    if (values.length === 0) return 0;

    const index = (percentile / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  /**
   * Quartiles
   */
  static quartiles(data: any[], valueKey: string): { q1: number; q2: number; q3: number; iqr: number } {
    const q1 = this.percentile(data, valueKey, 25);
    const q2 = this.percentile(data, valueKey, 50);
    const q3 = this.percentile(data, valueKey, 75);
    const iqr = q3 - q1;

    return { q1, q2, q3, iqr };
  }

  /**
   * Binning (discretization)
   */
  static bin(
    data: any[],
    valueKey: string,
    bins: number | number[],
    labels?: string[]
  ): any[] {
    const values = data.map((item) => Number(item[valueKey]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    let edges: number[];

    if (typeof bins === 'number') {
      const binSize = (max - min) / bins;
      edges = Array.from({ length: bins + 1 }, (_, i) => min + i * binSize);
    } else {
      edges = bins;
    }

    return data.map((item, index) => {
      const value = values[index];
      let binIndex = edges.findIndex((edge, i) => i < edges.length - 1 && value >= edge && value < edges[i + 1]);

      if (binIndex === -1 && value === max) {
        binIndex = edges.length - 2;
      }

      return {
        ...item,
        [`${valueKey}_bin`]: binIndex,
        [`${valueKey}_bin_label`]: labels ? labels[binIndex] : `${edges[binIndex]}-${edges[binIndex + 1]}`,
      };
    });
  }

  /**
   * Window functions
   */
  static windowFunction(
    data: any[],
    valueKey: string,
    windowFunc: 'rank' | 'dense_rank' | 'row_number' | 'lag' | 'lead',
    partitionBy?: string,
    orderBy?: string,
    offset = 1
  ): any[] {
    const partitions = new Map<string, any[]>();

    if (partitionBy) {
      data.forEach((item) => {
        const partition = String(item[partitionBy]);
        if (!partitions.has(partition)) {
          partitions.set(partition, []);
        }
        partitions.get(partition)!.push(item);
      });
    } else {
      partitions.set('all', data);
    }

    const result: any[] = [];

    partitions.forEach((partitionData) => {
      let sorted = partitionData;

      if (orderBy) {
        sorted = [...partitionData].sort((a, b) => {
          const aVal = Number(a[orderBy]) || 0;
          const bVal = Number(b[orderBy]) || 0;
          return bVal - aVal;
        });
      }

      sorted.forEach((item, index) => {
        const extended: any = { ...item };

        switch (windowFunc) {
          case 'rank':
          case 'dense_rank':
          case 'row_number':
            extended[`${valueKey}_${windowFunc}`] = index + 1;
            break;

          case 'lag':
            if (index >= offset) {
              extended[`${valueKey}_lag`] = sorted[index - offset][valueKey];
            }
            break;

          case 'lead':
            if (index + offset < sorted.length) {
              extended[`${valueKey}_lead`] = sorted[index + offset][valueKey];
            }
            break;
        }

        result.push(extended);
      });
    });

    return result;
  }
}
