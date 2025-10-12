/**
 * Comparison Transformer
 *
 * Transforms data for comparative analysis between multiple datasets.
 * Supports period-over-period, cohort, and benchmark comparisons.
 */

interface ComparisonDataPoint {
  [key: string]: any;
}

interface ComparisonConfig {
  baselineKey: string;
  compareKeys: string[];
  valueKeys: string[];
  calculateDifference?: boolean;
  calculatePercentChange?: boolean;
  calculateRatio?: boolean;
  labels?: Record<string, string>;
}

interface PeriodComparisonConfig {
  currentPeriodKey: string;
  previousPeriodKey: string;
  dateKey: string;
  valueKeys: string[];
  periodType?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

interface BenchmarkConfig {
  actualKey: string;
  benchmarkKey: string;
  valueKeys: string[];
  showVariance?: boolean;
  showPercentOfTarget?: boolean;
}

export class ComparisonTransformer {
  /**
   * Compare multiple datasets
   */
  static compare(data: ComparisonDataPoint[], config: ComparisonConfig): ComparisonDataPoint[] {
    return data.map((item) => {
      const result: any = { ...item };

      config.valueKeys.forEach((valueKey) => {
        const baselineValue = Number(item[`${config.baselineKey}_${valueKey}`]) || 0;

        config.compareKeys.forEach((compareKey) => {
          const compareValue = Number(item[`${compareKey}_${valueKey}`]) || 0;

          if (config.calculateDifference) {
            result[`${compareKey}_${valueKey}_diff`] = compareValue - baselineValue;
          }

          if (config.calculatePercentChange) {
            result[`${compareKey}_${valueKey}_pct`] =
              baselineValue !== 0 ? ((compareValue - baselineValue) / baselineValue) * 100 : 0;
          }

          if (config.calculateRatio) {
            result[`${compareKey}_${valueKey}_ratio`] = baselineValue !== 0 ? compareValue / baselineValue : 0;
          }
        });
      });

      return result;
    });
  }

  /**
   * Period-over-period comparison (e.g., this month vs last month)
   */
  static periodOverPeriod(
    currentData: any[],
    previousData: any[],
    config: PeriodComparisonConfig
  ): ComparisonDataPoint[] {
    const result: ComparisonDataPoint[] = [];

    currentData.forEach((current) => {
      const matchKey = current[config.dateKey];
      const previous = previousData.find((p) => p[config.dateKey] === matchKey);

      const comparison: any = {
        [config.dateKey]: matchKey,
      };

      config.valueKeys.forEach((valueKey) => {
        const currentValue = Number(current[valueKey]) || 0;
        const previousValue = previous ? Number(previous[valueKey]) || 0 : 0;

        comparison[`current_${valueKey}`] = currentValue;
        comparison[`previous_${valueKey}`] = previousValue;
        comparison[`${valueKey}_change`] = currentValue - previousValue;
        comparison[`${valueKey}_change_pct`] =
          previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
      });

      result.push(comparison);
    });

    return result;
  }

  /**
   * Year-over-year comparison
   */
  static yearOverYear(
    data: any[],
    dateKey: string,
    valueKeys: string[],
    currentYear: number,
    previousYear: number
  ): ComparisonDataPoint[] {
    const currentYearData = data.filter((item) => {
      const date = new Date(item[dateKey]);
      return date.getFullYear() === currentYear;
    });

    const previousYearData = data.filter((item) => {
      const date = new Date(item[dateKey]);
      return date.getFullYear() === previousYear;
    });

    return this.periodOverPeriod(currentYearData, previousYearData, {
      currentPeriodKey: `${currentYear}`,
      previousPeriodKey: `${previousYear}`,
      dateKey,
      valueKeys,
    });
  }

  /**
   * Compare against benchmark/target
   */
  static compareToBenchmark(data: any[], config: BenchmarkConfig): ComparisonDataPoint[] {
    return data.map((item) => {
      const result: any = { ...item };

      config.valueKeys.forEach((valueKey) => {
        const actual = Number(item[`${config.actualKey}_${valueKey}`]) || 0;
        const benchmark = Number(item[`${config.benchmarkKey}_${valueKey}`]) || 0;

        result[`${valueKey}_actual`] = actual;
        result[`${valueKey}_benchmark`] = benchmark;

        if (config.showVariance) {
          result[`${valueKey}_variance`] = actual - benchmark;
          result[`${valueKey}_variance_pct`] = benchmark !== 0 ? ((actual - benchmark) / benchmark) * 100 : 0;
        }

        if (config.showPercentOfTarget) {
          result[`${valueKey}_pct_of_target`] = benchmark !== 0 ? (actual / benchmark) * 100 : 0;
        }

        result[`${valueKey}_status`] = actual >= benchmark ? 'met' : 'missed';
      });

      return result;
    });
  }

  /**
   * Cohort analysis
   */
  static cohortAnalysis(
    data: any[],
    cohortKey: string,
    periodKey: string,
    valueKey: string
  ): ComparisonDataPoint[] {
    const cohorts = new Map<string, Map<string, number>>();

    data.forEach((item) => {
      const cohort = String(item[cohortKey]);
      const period = String(item[periodKey]);
      const value = Number(item[valueKey]) || 0;

      if (!cohorts.has(cohort)) {
        cohorts.set(cohort, new Map());
      }
      cohorts.get(cohort)!.set(period, value);
    });

    const result: ComparisonDataPoint[] = [];
    const allPeriods = new Set<string>();
    cohorts.forEach((periods) => {
      periods.forEach((_, period) => allPeriods.add(period));
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    cohorts.forEach((periods, cohort) => {
      const row: any = {
        cohort,
      };

      sortedPeriods.forEach((period, index) => {
        const value = periods.get(period) || 0;
        row[`period_${index}`] = value;
        row[`period_${index}_label`] = period;

        if (index > 0) {
          const previousValue = periods.get(sortedPeriods[index - 1]) || 0;
          row[`period_${index}_retention`] = previousValue !== 0 ? (value / previousValue) * 100 : 0;
        }
      });

      result.push(row);
    });

    return result;
  }

  /**
   * Side-by-side comparison
   */
  static sideBySide(datasets: any[][], labels: string[], commonKey: string, valueKeys: string[]): ComparisonDataPoint[] {
    const result: ComparisonDataPoint[] = [];
    const allKeys = new Set<string>();

    datasets.forEach((dataset) => {
      dataset.forEach((item) => {
        allKeys.add(String(item[commonKey]));
      });
    });

    allKeys.forEach((key) => {
      const row: any = {
        [commonKey]: key,
      };

      datasets.forEach((dataset, index) => {
        const label = labels[index] || `dataset_${index}`;
        const match = dataset.find((item) => String(item[commonKey]) === key);

        valueKeys.forEach((valueKey) => {
          row[`${label}_${valueKey}`] = match ? Number(match[valueKey]) || 0 : 0;
        });
      });

      result.push(row);
    });

    return result;
  }

  /**
   * Calculate variance analysis
   */
  static varianceAnalysis(
    data: any[],
    actualKey: string,
    plannedKey: string,
    valueKeys: string[]
  ): ComparisonDataPoint[] {
    return data.map((item) => {
      const result: any = { ...item };

      valueKeys.forEach((valueKey) => {
        const actual = Number(item[`${actualKey}_${valueKey}`]) || 0;
        const planned = Number(item[`${plannedKey}_${valueKey}`]) || 0;

        result[`${valueKey}_variance`] = actual - planned;
        result[`${valueKey}_variance_pct`] = planned !== 0 ? ((actual - planned) / planned) * 100 : 0;
        result[`${valueKey}_favorable`] = actual >= planned;
      });

      return result;
    });
  }

  /**
   * Rolling comparison (e.g., 7-day rolling average)
   */
  static rollingComparison(
    data: any[],
    valueKey: string,
    window: number,
    compareField = 'value'
  ): ComparisonDataPoint[] {
    return data.map((item, index) => {
      const start = Math.max(0, index - window + 1);
      const windowData = data.slice(start, index + 1);
      const rollingAvg =
        windowData.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0) / windowData.length;

      const currentValue = Number(item[valueKey]) || 0;

      return {
        ...item,
        [`${compareField}_rolling_avg`]: rollingAvg,
        [`${compareField}_vs_rolling`]: currentValue - rollingAvg,
        [`${compareField}_vs_rolling_pct`]: rollingAvg !== 0 ? ((currentValue - rollingAvg) / rollingAvg) * 100 : 0,
      };
    });
  }

  /**
   * Rank comparison
   */
  static rankComparison(data: any[], valueKey: string, groupKey?: string): ComparisonDataPoint[] {
    if (!groupKey) {
      const sorted = [...data].sort((a, b) => {
        const aVal = Number(a[valueKey]) || 0;
        const bVal = Number(b[valueKey]) || 0;
        return bVal - aVal;
      });

      return sorted.map((item, index) => ({
        ...item,
        [`${valueKey}_rank`]: index + 1,
        [`${valueKey}_percentile`]: ((data.length - index) / data.length) * 100,
      }));
    }

    const groups = new Map<string, any[]>();
    data.forEach((item) => {
      const group = String(item[groupKey]);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(item);
    });

    const result: ComparisonDataPoint[] = [];
    groups.forEach((groupData) => {
      const sorted = [...groupData].sort((a, b) => {
        const aVal = Number(a[valueKey]) || 0;
        const bVal = Number(b[valueKey]) || 0;
        return bVal - aVal;
      });

      sorted.forEach((item, index) => {
        result.push({
          ...item,
          [`${valueKey}_rank_in_group`]: index + 1,
          [`${valueKey}_percentile_in_group`]: ((groupData.length - index) / groupData.length) * 100,
        });
      });
    });

    return result;
  }

  /**
   * Normalize for comparison (convert to index with base period)
   */
  static normalizeToIndex(data: any[], valueKey: string, baseIndex = 0, baseValue = 100): ComparisonDataPoint[] {
    if (data.length === 0) {
      return [];
    }

    const baseVal = Number(data[baseIndex][valueKey]) || 1;

    return data.map((item) => {
      const value = Number(item[valueKey]) || 0;
      return {
        ...item,
        [`${valueKey}_index`]: (value / baseVal) * baseValue,
      };
    });
  }

  /**
   * Calculate contribution percentage
   */
  static calculateContribution(data: any[], valueKeys: string[]): ComparisonDataPoint[] {
    const totals: Record<string, number> = {};

    valueKeys.forEach((key) => {
      totals[key] = data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
    });

    return data.map((item) => {
      const result: any = { ...item };

      valueKeys.forEach((key) => {
        const value = Number(item[key]) || 0;
        result[`${key}_contribution`] = totals[key] > 0 ? (value / totals[key]) * 100 : 0;
      });

      return result;
    });
  }
}
