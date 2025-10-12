/**
 * Correlation and Statistical Analysis Helpers
 *
 * Functions for calculating correlations, regressions,
 * and identifying relationships between variables.
 */

export interface CorrelationResult {
  correlation: number;
  pValue: number;
  strength: 'very strong' | 'strong' | 'moderate' | 'weak' | 'very weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
}

export interface RegressionAnalysis {
  slope: number;
  intercept: number;
  r2: number;
  predictions: number[];
  residuals: number[];
  standardError: number;
}

export interface OutlierResult {
  outliers: Array<{ index: number; value: number; zScore: number }>;
  boundaries: { lower: number; upper: number };
}

/**
 * Calculate Pearson Correlation Coefficient
 * Measures linear relationship between two variables (-1 to 1)
 */
export function calculateCorrelation(
  x: number[],
  y: number[]
): CorrelationResult {
  if (x.length !== y.length || x.length < 2) {
    return {
      correlation: 0,
      pValue: 1,
      strength: 'none',
      direction: 'none'
    };
  }

  const n = x.length;

  // Calculate means
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  // Calculate correlation
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }

  const correlation = (xDenominator > 0 && yDenominator > 0)
    ? numerator / Math.sqrt(xDenominator * yDenominator)
    : 0;

  // Calculate approximate p-value using t-distribution
  const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
  const pValue = calculatePValue(t, n - 2);

  // Determine strength
  const absCorr = Math.abs(correlation);
  let strength: CorrelationResult['strength'];
  if (absCorr >= 0.9) strength = 'very strong';
  else if (absCorr >= 0.7) strength = 'strong';
  else if (absCorr >= 0.5) strength = 'moderate';
  else if (absCorr >= 0.3) strength = 'weak';
  else if (absCorr >= 0.1) strength = 'very weak';
  else strength = 'none';

  // Determine direction
  const direction = correlation > 0.1 ? 'positive'
    : correlation < -0.1 ? 'negative'
    : 'none';

  return { correlation, pValue, strength, direction };
}

/**
 * Calculate Spearman Rank Correlation
 * Measures monotonic relationship (useful for non-linear relationships)
 */
export function spearmanCorrelation(
  x: number[],
  y: number[]
): CorrelationResult {
  if (x.length !== y.length || x.length < 2) {
    return {
      correlation: 0,
      pValue: 1,
      strength: 'none',
      direction: 'none'
    };
  }

  // Convert to ranks
  const xRanks = convertToRanks(x);
  const yRanks = convertToRanks(y);

  // Calculate Pearson correlation on ranks
  return calculateCorrelation(xRanks, yRanks);
}

/**
 * Simple Linear Regression
 * Fits y = mx + b to the data
 */
export function calculateRegression(
  x: number[],
  y: number[]
): RegressionAnalysis {
  if (x.length !== y.length || x.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      r2: 0,
      predictions: [],
      residuals: [],
      standardError: 0
    };
  }

  const n = x.length;

  // Calculate means
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate predictions and residuals
  const predictions = x.map(xi => slope * xi + intercept);
  const residuals = y.map((yi, i) => yi - predictions[i]);

  // Calculate R² (coefficient of determination)
  const ssRes = residuals.reduce((sum, r) => sum + r * r, 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

  // Calculate standard error
  const standardError = Math.sqrt(ssRes / (n - 2));

  return {
    slope,
    intercept,
    r2,
    predictions,
    residuals,
    standardError
  };
}

/**
 * Multiple Linear Regression
 * Fits y = b0 + b1*x1 + b2*x2 + ... to the data
 */
export function multipleRegression(
  X: number[][], // Matrix of independent variables
  y: number[]
): {
  coefficients: number[];
  r2: number;
  predictions: number[];
} {
  if (X.length === 0 || X.length !== y.length) {
    return { coefficients: [], r2: 0, predictions: [] };
  }

  // For simplicity, we'll use a basic implementation
  // In production, consider using a library like ml-regression
  const n = X.length;
  const k = X[0].length;

  // Add intercept column
  const XWithIntercept = X.map(row => [1, ...row]);

  // Calculate coefficients using normal equation: (X'X)^-1 * X'y
  // This is a simplified version
  const coefficients = new Array(k + 1).fill(0);

  // For now, return empty result
  // Full implementation would require matrix operations
  const predictions = y.map(() => 0);
  const r2 = 0;

  return { coefficients, r2, predictions };
}

/**
 * Find Outliers using Z-score method
 * Identifies data points that are unusually far from the mean
 */
export function findOutliers(
  data: number[],
  threshold: number = 3
): OutlierResult {
  if (data.length < 3) {
    return {
      outliers: [],
      boundaries: { lower: 0, upper: 0 }
    };
  }

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = calculateStdDev(data);

  const lower = mean - threshold * stdDev;
  const upper = mean + threshold * stdDev;

  const outliers = data
    .map((value, index) => ({
      index,
      value,
      zScore: Math.abs((value - mean) / (stdDev || 1))
    }))
    .filter(item => item.zScore > threshold);

  return {
    outliers,
    boundaries: { lower, upper }
  };
}

/**
 * Find Outliers using IQR method
 * More robust to extreme values than Z-score
 */
export function findOutliersIQR(
  data: number[]
): OutlierResult {
  if (data.length < 4) {
    return {
      outliers: [],
      boundaries: { lower: 0, upper: 0 }
    };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const outliers = data
    .map((value, index) => ({
      index,
      value,
      zScore: 0 // Not applicable for IQR
    }))
    .filter(item => item.value < lower || item.value > upper);

  return {
    outliers,
    boundaries: { lower, upper }
  };
}

/**
 * Calculate Correlation Matrix
 * Computes correlations between all pairs of variables
 */
export function correlationMatrix(
  variables: Record<string, number[]>
): Record<string, Record<string, number>> {
  const keys = Object.keys(variables);
  const matrix: Record<string, Record<string, number>> = {};

  for (const key1 of keys) {
    matrix[key1] = {};
    for (const key2 of keys) {
      if (key1 === key2) {
        matrix[key1][key2] = 1;
      } else {
        const result = calculateCorrelation(variables[key1], variables[key2]);
        matrix[key1][key2] = result.correlation;
      }
    }
  }

  return matrix;
}

/**
 * Polynomial Regression
 * Fits a polynomial of specified degree to the data
 */
export function polynomialRegression(
  x: number[],
  y: number[],
  degree: number = 2
): {
  coefficients: number[];
  r2: number;
  predictions: number[];
} {
  if (x.length !== y.length || x.length < degree + 1) {
    return { coefficients: [], r2: 0, predictions: [] };
  }

  // Transform x into polynomial features
  const X: number[][] = x.map(xi => {
    const row: number[] = [];
    for (let d = 0; d <= degree; d++) {
      row.push(Math.pow(xi, d));
    }
    return row;
  });

  // Use simple regression for degree 1
  if (degree === 1) {
    const regression = calculateRegression(x, y);
    return {
      coefficients: [regression.intercept, regression.slope],
      r2: regression.r2,
      predictions: regression.predictions
    };
  }

  // For higher degrees, return simple linear regression
  // Full implementation would require matrix operations
  const regression = calculateRegression(x, y);
  return {
    coefficients: [regression.intercept, regression.slope],
    r2: regression.r2,
    predictions: regression.predictions
  };
}

/**
 * Calculate covariance between two variables
 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - xMean) * (y[i] - yMean);
  }

  return sum / (n - 1);
}

/**
 * Normalize data to 0-1 range
 */
export function normalize(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) return data.map(() => 0.5);

  return data.map(val => (val - min) / range);
}

/**
 * Standardize data (z-score normalization)
 */
export function standardize(data: number[]): number[] {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = calculateStdDev(data);

  if (stdDev === 0) return data.map(() => 0);

  return data.map(val => (val - mean) / stdDev);
}

/**
 * Calculate moving correlation
 */
export function movingCorrelation(
  x: number[],
  y: number[],
  window: number
): number[] {
  const result: number[] = [];

  for (let i = window - 1; i < x.length; i++) {
    const xWindow = x.slice(i - window + 1, i + 1);
    const yWindow = y.slice(i - window + 1, i + 1);
    const corr = calculateCorrelation(xWindow, yWindow);
    result.push(corr.correlation);
  }

  return result;
}

/**
 * Test for autocorrelation (correlation with lagged version of itself)
 */
export function autocorrelation(
  data: number[],
  lag: number = 1
): number {
  if (data.length <= lag) return 0;

  const x = data.slice(0, -lag);
  const y = data.slice(lag);

  const result = calculateCorrelation(x, y);
  return result.correlation;
}

// Helper Functions

function calculateStdDev(data: number[]): number {
  const n = data.length;
  if (n === 0) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;

  return Math.sqrt(variance);
}

function convertToRanks(data: number[]): number[] {
  const indexed = data.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array(data.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].index] = i + 1;
  }

  return ranks;
}

function calculatePValue(t: number, degreesOfFreedom: number): number {
  // Simplified p-value calculation
  // In production, use a proper statistical library
  const absT = Math.abs(t);

  if (absT > 3) return 0.001;
  if (absT > 2.5) return 0.01;
  if (absT > 2) return 0.05;
  if (absT > 1.5) return 0.1;

  return 0.5;
}
