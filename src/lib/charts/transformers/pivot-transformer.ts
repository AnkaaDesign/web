/**
 * Pivot Transformer
 *
 * Transforms data for heatmaps and pivot tables.
 * Handles matrix transformations, cross-tabulations, and correlation matrices.
 */

interface PivotConfig {
  rowKey: string;
  columnKey: string;
  valueKey: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  fillValue?: number | null;
  sortRows?: boolean;
  sortColumns?: boolean;
}

interface HeatmapConfig {
  xKey: string;
  yKey: string;
  valueKey: string;
  normalize?: boolean;
  normalizeBy?: 'row' | 'column' | 'global';
}

interface MatrixData {
  rows: string[];
  columns: string[];
  values: number[][];
  data: any[];
}

export class PivotTransformer {
  /**
   * Create pivot table
   */
  static pivot(data: any[], config: PivotConfig): MatrixData {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const pivotMap = new Map<string, Map<string, number[]>>();

    // Collect unique rows and columns
    data.forEach((item) => {
      const row = String(item[config.rowKey]);
      const col = String(item[config.columnKey]);
      const value = Number(item[config.valueKey]) || 0;

      rowSet.add(row);
      colSet.add(col);

      if (!pivotMap.has(row)) {
        pivotMap.set(row, new Map());
      }
      if (!pivotMap.get(row)!.has(col)) {
        pivotMap.get(row)!.set(col, []);
      }
      pivotMap.get(row)!.get(col)!.push(value);
    });

    let rows = Array.from(rowSet);
    let columns = Array.from(colSet);

    if (config.sortRows) {
      rows.sort();
    }
    if (config.sortColumns) {
      columns.sort();
    }

    // Build matrix
    const values: number[][] = [];
    const resultData: any[] = [];

    rows.forEach((row) => {
      const rowValues: number[] = [];
      const rowData: any = { [config.rowKey]: row };

      columns.forEach((col) => {
        const cellValues = pivotMap.get(row)?.get(col) || [];
        const aggregated = cellValues.length > 0
          ? this.aggregate(cellValues, config.aggregation || 'sum')
          : (config.fillValue ?? 0);

        rowValues.push(aggregated);
        rowData[col] = aggregated;
      });

      values.push(rowValues);
      resultData.push(rowData);
    });

    return {
      rows,
      columns,
      values,
      data: resultData,
    };
  }

  /**
   * Aggregate values
   */
  private static aggregate(values: number[], type: string): number {
    switch (type) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      default:
        return values.reduce((sum, val) => sum + val, 0);
    }
  }

  /**
   * Transform data for heatmap
   */
  static toHeatmap(data: any[], config: HeatmapConfig): Array<{ x: string; y: string; value: number }> {
    // First pass: collect data
    const heatmapData = data.map((item) => ({
      x: String(item[config.xKey]),
      y: String(item[config.yKey]),
      value: Number(item[config.valueKey]) || 0,
    }));

    // Normalize if requested
    if (config.normalize && config.normalizeBy) {
      return this.normalizeHeatmap(heatmapData, config.normalizeBy);
    }

    return heatmapData;
  }

  /**
   * Normalize heatmap values
   */
  private static normalizeHeatmap(
    data: Array<{ x: string; y: string; value: number }>,
    normalizeBy: 'row' | 'column' | 'global'
  ): Array<{ x: string; y: string; value: number }> {
    if (normalizeBy === 'global') {
      const max = Math.max(...data.map((d) => Math.abs(d.value)));
      return data.map((d) => ({
        ...d,
        value: max > 0 ? d.value / max : 0,
      }));
    }

    if (normalizeBy === 'row') {
      const rowMaxes = new Map<string, number>();
      data.forEach((d) => {
        const currentMax = rowMaxes.get(d.y) || 0;
        rowMaxes.set(d.y, Math.max(currentMax, Math.abs(d.value)));
      });

      return data.map((d) => {
        const max = rowMaxes.get(d.y) || 1;
        return {
          ...d,
          value: max > 0 ? d.value / max : 0,
        };
      });
    }

    if (normalizeBy === 'column') {
      const colMaxes = new Map<string, number>();
      data.forEach((d) => {
        const currentMax = colMaxes.get(d.x) || 0;
        colMaxes.set(d.x, Math.max(currentMax, Math.abs(d.value)));
      });

      return data.map((d) => {
        const max = colMaxes.get(d.x) || 1;
        return {
          ...d,
          value: max > 0 ? d.value / max : 0,
        };
      });
    }

    return data;
  }

  /**
   * Create correlation matrix
   */
  static correlationMatrix(data: any[], fields: string[]): MatrixData {
    const n = fields.length;
    const values: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(1);
        } else {
          const correlation = this.calculateCorrelation(data, fields[i], fields[j]);
          row.push(correlation);
        }
      }
      values.push(row);
    }

    const resultData: any[] = [];
    fields.forEach((field, i) => {
      const rowData: any = { field };
      fields.forEach((col, j) => {
        rowData[col] = values[i][j];
      });
      resultData.push(rowData);
    });

    return {
      rows: fields,
      columns: fields,
      values,
      data: resultData,
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private static calculateCorrelation(data: any[], field1: string, field2: string): number {
    const values1 = data.map((item) => Number(item[field1]) || 0);
    const values2 = data.map((item) => Number(item[field2]) || 0);

    const n = values1.length;
    if (n === 0) return 0;

    const mean1 = values1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Create cross-tabulation
   */
  static crossTab(
    data: any[],
    rowKey: string,
    colKey: string,
    showPercentages = false,
    percentageBy: 'row' | 'column' | 'total' = 'total'
  ): MatrixData {
    const pivotData = this.pivot(data, {
      rowKey,
      columnKey: colKey,
      valueKey: 'count',
      aggregation: 'count',
    });

    if (showPercentages) {
      const { rows, columns, values } = pivotData;

      let total = 0;
      const rowTotals: number[] = [];
      const colTotals: number[] = [];

      // Calculate totals
      rows.forEach((_, i) => {
        let rowSum = 0;
        columns.forEach((_, j) => {
          rowSum += values[i][j];
          colTotals[j] = (colTotals[j] || 0) + values[i][j];
        });
        rowTotals[i] = rowSum;
        total += rowSum;
      });

      // Convert to percentages
      const percentageValues: number[][] = rows.map((_, i) =>
        columns.map((_, j) => {
          const value = values[i][j];
          if (percentageBy === 'row') {
            return rowTotals[i] > 0 ? (value / rowTotals[i]) * 100 : 0;
          } else if (percentageBy === 'column') {
            return colTotals[j] > 0 ? (value / colTotals[j]) * 100 : 0;
          } else {
            return total > 0 ? (value / total) * 100 : 0;
          }
        })
      );

      pivotData.values = percentageValues;

      // Update data objects
      pivotData.data = rows.map((row, i) => {
        const rowData: any = { [rowKey]: row };
        columns.forEach((col, j) => {
          rowData[col] = percentageValues[i][j];
        });
        return rowData;
      });
    }

    return pivotData;
  }

  /**
   * Create contingency table with chi-square test
   */
  static contingencyTable(
    data: any[],
    rowKey: string,
    colKey: string
  ): {
    observed: MatrixData;
    expected: MatrixData;
    chiSquare: number;
    pValue: number;
    degreesOfFreedom: number;
  } {
    const observed = this.pivot(data, {
      rowKey,
      columnKey: colKey,
      valueKey: 'count',
      aggregation: 'count',
    });

    const { rows, columns, values: observedValues } = observed;

    // Calculate row and column totals
    const rowTotals = observedValues.map((row) => row.reduce((sum, val) => sum + val, 0));
    const colTotals = columns.map((_, j) => observedValues.reduce((sum, row) => sum + row[j], 0));
    const total = rowTotals.reduce((sum, val) => sum + val, 0);

    // Calculate expected frequencies
    const expectedValues: number[][] = rows.map((_, i) =>
      columns.map((_, j) => (rowTotals[i] * colTotals[j]) / total)
    );

    // Calculate chi-square statistic
    let chiSquare = 0;
    rows.forEach((_, i) => {
      columns.forEach((_, j) => {
        const observed = observedValues[i][j];
        const expected = expectedValues[i][j];
        if (expected > 0) {
          chiSquare += Math.pow(observed - expected, 2) / expected;
        }
      });
    });

    const degreesOfFreedom = (rows.length - 1) * (columns.length - 1);
    const pValue = this.chiSquarePValue(chiSquare, degreesOfFreedom);

    return {
      observed,
      expected: {
        rows,
        columns,
        values: expectedValues,
        data: rows.map((row, i) => {
          const rowData: any = { [rowKey]: row };
          columns.forEach((col, j) => {
            rowData[col] = expectedValues[i][j];
          });
          return rowData;
        }),
      },
      chiSquare,
      pValue,
      degreesOfFreedom,
    };
  }

  /**
   * Approximate chi-square p-value (simplified)
   */
  private static chiSquarePValue(chiSquare: number, df: number): number {
    // This is a very simplified approximation
    // For production use, consider using a proper statistical library
    if (df <= 0) return 1;

    const k = Math.sqrt(2 * chiSquare) - Math.sqrt(2 * df - 1);
    const p = 1 - this.normalCDF(k);

    return Math.max(0, Math.min(1, p));
  }

  /**
   * Normal cumulative distribution function (approximation)
   */
  private static normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return x > 0 ? 1 - p : p;
  }

  /**
   * Transpose matrix
   */
  static transpose(matrix: MatrixData): MatrixData {
    const { rows, columns, values } = matrix;

    const transposedValues: number[][] = columns.map((_, j) =>
      rows.map((_, i) => values[i][j])
    );

    const transposedData = columns.map((col, j) => {
      const rowData: any = { row: col };
      rows.forEach((row, i) => {
        rowData[row] = values[i][j];
      });
      return rowData;
    });

    return {
      rows: columns,
      columns: rows,
      values: transposedValues,
      data: transposedData,
    };
  }

  /**
   * Create distance matrix
   */
  static distanceMatrix(
    data: any[],
    idKey: string,
    featureKeys: string[],
    distanceMetric: 'euclidean' | 'manhattan' | 'cosine' = 'euclidean'
  ): MatrixData {
    const ids = data.map((item) => String(item[idKey]));
    const n = ids.length;
    const values: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(0);
        } else {
          const distance = this.calculateDistance(
            data[i],
            data[j],
            featureKeys,
            distanceMetric
          );
          row.push(distance);
        }
      }
      values.push(row);
    }

    const resultData = ids.map((id, i) => {
      const rowData: any = { [idKey]: id };
      ids.forEach((otherId, j) => {
        rowData[otherId] = values[i][j];
      });
      return rowData;
    });

    return {
      rows: ids,
      columns: ids,
      values,
      data: resultData,
    };
  }

  /**
   * Calculate distance between two data points
   */
  private static calculateDistance(
    point1: any,
    point2: any,
    features: string[],
    metric: string
  ): number {
    const values1 = features.map((f) => Number(point1[f]) || 0);
    const values2 = features.map((f) => Number(point2[f]) || 0);

    switch (metric) {
      case 'euclidean':
        return Math.sqrt(
          values1.reduce((sum, val, i) => sum + Math.pow(val - values2[i], 2), 0)
        );

      case 'manhattan':
        return values1.reduce((sum, val, i) => sum + Math.abs(val - values2[i]), 0);

      case 'cosine':
        const dotProduct = values1.reduce((sum, val, i) => sum + val * values2[i], 0);
        const mag1 = Math.sqrt(values1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(values2.reduce((sum, val) => sum + val * val, 0));
        return mag1 > 0 && mag2 > 0 ? 1 - dotProduct / (mag1 * mag2) : 0;

      default:
        return 0;
    }
  }

  /**
   * Create density matrix (for heatmaps)
   */
  static densityMatrix(
    data: any[],
    xKey: string,
    yKey: string,
    xBins: number,
    yBins: number
  ): MatrixData {
    const xValues = data.map((item) => Number(item[xKey]) || 0);
    const yValues = data.map((item) => Number(item[yKey]) || 0);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xBinSize = (xMax - xMin) / xBins;
    const yBinSize = (yMax - yMin) / yBins;

    const values: number[][] = Array.from({ length: yBins }, () => Array(xBins).fill(0));

    data.forEach((item) => {
      const x = Number(item[xKey]) || 0;
      const y = Number(item[yKey]) || 0;

      const xBin = Math.min(Math.floor((x - xMin) / xBinSize), xBins - 1);
      const yBin = Math.min(Math.floor((y - yMin) / yBinSize), yBins - 1);

      values[yBin][xBin]++;
    });

    const xLabels = Array.from({ length: xBins }, (_, i) =>
      (xMin + i * xBinSize).toFixed(2)
    );
    const yLabels = Array.from({ length: yBins }, (_, i) =>
      (yMin + i * yBinSize).toFixed(2)
    );

    const resultData = yLabels.map((yLabel, i) => {
      const rowData: any = { y: yLabel };
      xLabels.forEach((xLabel, j) => {
        rowData[xLabel] = values[i][j];
      });
      return rowData;
    });

    return {
      rows: yLabels,
      columns: xLabels,
      values,
      data: resultData,
    };
  }
}
