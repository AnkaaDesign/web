/**
 * Category Transformer
 *
 * Transforms raw data into categorical format for bar, pie, and other categorical charts.
 * Handles grouping, sorting, and aggregation.
 */

interface CategoryDataPoint {
  category: string;
  [key: string]: any;
}

interface CategoryConfig {
  categoryKey: string;
  valueKeys: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  groupOthers?: boolean;
  othersLabel?: string;
  filterZeros?: boolean;
  categoryFormatter?: (value: any) => string;
}

export class CategoryTransformer {
  /**
   * Transform raw data into categorical format
   */
  static transform(data: any[], config: CategoryConfig): CategoryDataPoint[] {
    if (!data || data.length === 0) {
      return [];
    }

    // Group by category
    let grouped = this.groupByCategory(data, config);

    // Filter zeros if specified
    if (config.filterZeros) {
      grouped = this.filterZeros(grouped, config.valueKeys);
    }

    // Sort data
    if (config.sortBy) {
      grouped = this.sortData(grouped, config.sortBy, config.sortOrder || 'desc');
    }

    // Limit and group others
    if (config.limit && config.groupOthers && grouped.length > config.limit) {
      grouped = this.limitAndGroupOthers(grouped, config);
    } else if (config.limit) {
      grouped = grouped.slice(0, config.limit);
    }

    // Format categories
    if (config.categoryFormatter) {
      grouped = this.formatCategories(grouped, config.categoryKey, config.categoryFormatter);
    }

    return grouped;
  }

  /**
   * Group data by category and aggregate values
   */
  private static groupByCategory(data: any[], config: CategoryConfig): CategoryDataPoint[] {
    const grouped = new Map<string, any[]>();

    data.forEach((item) => {
      const category = String(item[config.categoryKey]);

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    });

    const result: CategoryDataPoint[] = [];
    grouped.forEach((items, category) => {
      const aggregated: any = {
        [config.categoryKey]: category,
        category,
        _count: items.length,
      };

      config.valueKeys.forEach((valueKey) => {
        aggregated[valueKey] = this.aggregateValues(
          items.map((item) => item[valueKey]),
          config.aggregation || 'sum'
        );
      });

      result.push(aggregated);
    });

    return result;
  }

  /**
   * Aggregate values based on type
   */
  private static aggregateValues(values: any[], type: string): number {
    const numbers = values.map((v) => Number(v) || 0);

    switch (type) {
      case 'sum':
        return numbers.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
      case 'count':
        return numbers.length;
      case 'min':
        return Math.min(...numbers);
      case 'max':
        return Math.max(...numbers);
      default:
        return numbers.reduce((sum, val) => sum + val, 0);
    }
  }

  /**
   * Filter out categories with zero values
   */
  private static filterZeros(data: CategoryDataPoint[], valueKeys: string[]): CategoryDataPoint[] {
    return data.filter((item) => {
      return valueKeys.some((key) => {
        const value = Number(item[key]) || 0;
        return value !== 0;
      });
    });
  }

  /**
   * Sort data by specified key
   */
  private static sortData(data: CategoryDataPoint[], sortBy: string, order: 'asc' | 'desc'): CategoryDataPoint[] {
    return data.sort((a, b) => {
      const aVal = Number(a[sortBy]) || 0;
      const bVal = Number(b[sortBy]) || 0;
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  /**
   * Limit results and group remaining into "Others"
   */
  private static limitAndGroupOthers(data: CategoryDataPoint[], config: CategoryConfig): CategoryDataPoint[] {
    const limit = config.limit!;
    const top = data.slice(0, limit);
    const others = data.slice(limit);

    if (others.length === 0) {
      return top;
    }

    const othersLabel = config.othersLabel || 'Others';
    const othersAggregated: any = {
      [config.categoryKey]: othersLabel,
      category: othersLabel,
      _count: others.reduce((sum, item) => sum + (item._count || 0), 0),
      _isOthers: true,
    };

    config.valueKeys.forEach((valueKey) => {
      othersAggregated[valueKey] = others.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
    });

    return [...top, othersAggregated];
  }

  /**
   * Format category labels
   */
  private static formatCategories(
    data: CategoryDataPoint[],
    categoryKey: string,
    formatter: (value: any) => string
  ): CategoryDataPoint[] {
    return data.map((item) => ({
      ...item,
      [categoryKey]: formatter(item[categoryKey]),
    }));
  }

  /**
   * Calculate percentages for each category
   */
  static calculatePercentages(data: CategoryDataPoint[], valueKey: string): CategoryDataPoint[] {
    const total = data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);

    return data.map((item) => {
      const value = Number(item[valueKey]) || 0;
      const percentage = total > 0 ? (value / total) * 100 : 0;

      return {
        ...item,
        [`${valueKey}_percentage`]: percentage,
        [`${valueKey}_total`]: total,
      };
    });
  }

  /**
   * Convert to pie chart format
   */
  static toPieFormat(data: CategoryDataPoint[], nameKey: string, valueKey: string): Array<{ name: string; value: number }> {
    return data.map((item) => ({
      name: String(item[nameKey]),
      value: Number(item[valueKey]) || 0,
    }));
  }

  /**
   * Convert to stacked bar format
   */
  static toStackedFormat(
    data: any[],
    categoryKey: string,
    stackKey: string,
    valueKey: string
  ): CategoryDataPoint[] {
    const categories = new Set<string>();
    const stacks = new Set<string>();

    data.forEach((item) => {
      categories.add(String(item[categoryKey]));
      stacks.add(String(item[stackKey]));
    });

    const result: CategoryDataPoint[] = [];
    categories.forEach((category) => {
      const row: any = {
        [categoryKey]: category,
        category,
      };

      stacks.forEach((stack) => {
        const match = data.find(
          (item) => String(item[categoryKey]) === category && String(item[stackKey]) === stack
        );
        row[stack] = match ? Number(match[valueKey]) || 0 : 0;
      });

      result.push(row);
    });

    return result;
  }

  /**
   * Normalize values to percentage of total
   */
  static normalizeToPercentage(data: CategoryDataPoint[], valueKeys: string[]): CategoryDataPoint[] {
    return data.map((item) => {
      const total = valueKeys.reduce((sum, key) => sum + (Number(item[key]) || 0), 0);

      const normalized: any = { ...item };
      valueKeys.forEach((key) => {
        const value = Number(item[key]) || 0;
        normalized[`${key}_normalized`] = total > 0 ? (value / total) * 100 : 0;
      });

      return normalized;
    });
  }

  /**
   * Apply ranking
   */
  static applyRanking(data: CategoryDataPoint[], valueKey: string): CategoryDataPoint[] {
    const sorted = [...data].sort((a, b) => {
      const aVal = Number(a[valueKey]) || 0;
      const bVal = Number(b[valueKey]) || 0;
      return bVal - aVal;
    });

    return sorted.map((item, index) => ({
      ...item,
      _rank: index + 1,
    }));
  }

  /**
   * Filter by value threshold
   */
  static filterByThreshold(
    data: CategoryDataPoint[],
    valueKey: string,
    threshold: number,
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' = 'gte'
  ): CategoryDataPoint[] {
    return data.filter((item) => {
      const value = Number(item[valueKey]) || 0;

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
        default:
          return true;
      }
    });
  }

  /**
   * Create frequency distribution
   */
  static createFrequencyDistribution(
    data: any[],
    valueKey: string,
    bins: number
  ): CategoryDataPoint[] {
    const values = data.map((item) => Number(item[valueKey]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / bins;

    const distribution: CategoryDataPoint[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      const binLabel = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;

      const count = values.filter((v) => v >= binStart && (i === bins - 1 ? v <= binEnd : v < binEnd)).length;

      distribution.push({
        category: binLabel,
        binStart,
        binEnd,
        count,
        frequency: (count / values.length) * 100,
      });
    }

    return distribution;
  }

  /**
   * Combine small categories
   */
  static combineSmallCategories(
    data: CategoryDataPoint[],
    valueKey: string,
    threshold: number,
    othersLabel = 'Others'
  ): CategoryDataPoint[] {
    const large: CategoryDataPoint[] = [];
    const small: CategoryDataPoint[] = [];

    data.forEach((item) => {
      const value = Number(item[valueKey]) || 0;
      if (value >= threshold) {
        large.push(item);
      } else {
        small.push(item);
      }
    });

    if (small.length === 0) {
      return large;
    }

    const combinedValue = small.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
    const combined: CategoryDataPoint = {
      category: othersLabel,
      [valueKey]: combinedValue,
      _combined: true,
      _combinedCount: small.length,
    };

    return [...large, combined];
  }
}
