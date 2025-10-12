/**
 * Predictive Models and Statistical Analysis
 *
 * Advanced statistical models for forecasting, trend analysis,
 * and predictive analytics.
 */

export interface ForecastResult {
  predicted: number[];
  timestamps: Date[];
  confidenceIntervals: {
    lower: number[];
    upper: number[];
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality?: {
    detected: boolean;
    period?: number;
  };
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  predictions: number[];
}

/**
 * Simple Linear Regression
 * Fits a line to the data and makes predictions
 */
export function linearRegression(
  data: TimeSeriesData[]
): RegressionResult {
  if (data.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      r2: 0,
      predictions: data.map(d => d.value)
    };
  }

  const n = data.length;
  const x = data.map((_, i) => i); // Use indices as x values
  const y = data.map(d => d.value);

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

  // Calculate R²
  const predictions = x.map(xi => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

  return {
    slope,
    intercept,
    r2,
    predictions
  };
}

/**
 * Moving Average
 * Smooths data by averaging over a window
 */
export function movingAverage(
  data: number[],
  window: number
): number[] {
  if (window <= 0 || window > data.length) {
    return [...data];
  }

  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(data.length, i + Math.ceil(window / 2));
    const slice = data.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }

  return result;
}

/**
 * Exponential Smoothing
 * Weighted average where recent data has more weight
 */
export function exponentialSmoothing(
  data: number[],
  alpha: number = 0.3
): number[] {
  if (data.length === 0) return [];

  const result: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1];
    result.push(smoothed);
  }

  return result;
}

/**
 * Seasonal Decomposition
 * Separates data into trend, seasonal, and residual components
 */
export function seasonalDecomposition(
  data: TimeSeriesData[],
  period: number = 7
): {
  trend: number[];
  seasonal: number[];
  residual: number[];
} {
  const values = data.map(d => d.value);

  // Calculate trend using moving average
  const trend = movingAverage(values, period);

  // Detrend the data
  const detrended = values.map((val, i) => val - trend[i]);

  // Calculate seasonal component
  const seasonal: number[] = new Array(values.length).fill(0);
  const seasonalAverages: number[] = new Array(period).fill(0);
  const seasonalCounts: number[] = new Array(period).fill(0);

  // Average each seasonal position
  for (let i = 0; i < detrended.length; i++) {
    const seasonIndex = i % period;
    seasonalAverages[seasonIndex] += detrended[i];
    seasonalCounts[seasonIndex]++;
  }

  for (let i = 0; i < period; i++) {
    if (seasonalCounts[i] > 0) {
      seasonalAverages[i] /= seasonalCounts[i];
    }
  }

  // Assign seasonal values
  for (let i = 0; i < values.length; i++) {
    seasonal[i] = seasonalAverages[i % period];
  }

  // Calculate residual
  const residual = values.map((val, i) => val - trend[i] - seasonal[i]);

  return { trend, seasonal, residual };
}

/**
 * Detect Seasonality
 * Determines if data exhibits seasonal patterns
 */
export function detectSeasonality(
  data: TimeSeriesData[]
): { detected: boolean; period?: number; strength?: number } {
  if (data.length < 14) {
    return { detected: false };
  }

  const values = data.map(d => d.value);

  // Test common periods (daily=7, monthly=30)
  const periodsToTest = [7, 14, 30];
  let bestPeriod = 0;
  let bestStrength = 0;

  for (const period of periodsToTest) {
    if (values.length < period * 2) continue;

    const { seasonal, residual } = seasonalDecomposition(data, period);

    // Calculate strength as variance ratio
    const seasonalVariance = variance(seasonal);
    const residualVariance = variance(residual);
    const totalVariance = seasonalVariance + residualVariance;

    const strength = totalVariance > 0 ? seasonalVariance / totalVariance : 0;

    if (strength > bestStrength) {
      bestStrength = strength;
      bestPeriod = period;
    }
  }

  const detected = bestStrength > 0.3; // Threshold for detecting seasonality

  return {
    detected,
    period: detected ? bestPeriod : undefined,
    strength: detected ? bestStrength : undefined
  };
}

/**
 * Forecast Demand
 * Predicts future values based on historical data
 */
export function forecastDemand(
  historicalData: TimeSeriesData[],
  periodsAhead: number = 7,
  confidenceLevel: number = 0.95
): ForecastResult {
  if (historicalData.length < 3) {
    // Not enough data for forecasting
    return {
      predicted: [],
      timestamps: [],
      confidenceIntervals: { lower: [], upper: [] },
      trend: 'stable'
    };
  }

  // Detect seasonality
  const seasonality = detectSeasonality(historicalData);

  // Fit regression model
  const regression = linearRegression(historicalData);

  // Generate future timestamps
  const lastTimestamp = historicalData[historicalData.length - 1].timestamp;
  const timestamps: Date[] = [];
  const avgInterval = calculateAverageInterval(historicalData);

  for (let i = 1; i <= periodsAhead; i++) {
    const newTimestamp = new Date(lastTimestamp.getTime() + avgInterval * i);
    timestamps.push(newTimestamp);
  }

  // Make predictions
  const startIndex = historicalData.length;
  const predicted: number[] = [];

  for (let i = 0; i < periodsAhead; i++) {
    const baseValue = regression.slope * (startIndex + i) + regression.intercept;

    // Add seasonal component if detected
    let forecastValue = baseValue;
    if (seasonality.detected && seasonality.period) {
      const { seasonal } = seasonalDecomposition(historicalData, seasonality.period);
      const seasonalIndex = (startIndex + i) % seasonality.period;
      forecastValue += seasonal[seasonalIndex] || 0;
    }

    predicted.push(Math.max(0, forecastValue)); // Ensure non-negative
  }

  // Calculate confidence intervals
  const residuals = historicalData.map((d, i) =>
    d.value - regression.predictions[i]
  );
  const stdDev = standardDeviation(residuals);
  const zScore = 1.96; // 95% confidence

  const lower = predicted.map(p => Math.max(0, p - zScore * stdDev));
  const upper = predicted.map(p => p + zScore * stdDev);

  // Determine trend
  const trend = regression.slope > 0.1 ? 'increasing'
    : regression.slope < -0.1 ? 'decreasing'
    : 'stable';

  return {
    predicted,
    timestamps,
    confidenceIntervals: { lower, upper },
    trend,
    seasonality
  };
}

/**
 * Forecast Task Completion
 * Predicts when tasks will be completed based on velocity
 */
export function forecastTaskCompletion(
  tasksRemaining: number,
  completionHistory: TimeSeriesData[],
  workingDaysPerWeek: number = 5
): {
  estimatedCompletionDate: Date;
  confidenceInterval: { earliest: Date; latest: Date };
  averageVelocity: number;
  projectedVelocity: number;
} {
  if (completionHistory.length === 0) {
    const today = new Date();
    return {
      estimatedCompletionDate: today,
      confidenceInterval: { earliest: today, latest: today },
      averageVelocity: 0,
      projectedVelocity: 0
    };
  }

  // Calculate velocity (tasks completed per day)
  const values = completionHistory.map(d => d.value);
  const averageVelocity = values.reduce((a, b) => a + b, 0) / values.length;

  // Use exponential smoothing for recent velocity
  const smoothed = exponentialSmoothing(values);
  const projectedVelocity = smoothed[smoothed.length - 1];

  // Calculate days needed
  const daysNeeded = projectedVelocity > 0
    ? Math.ceil(tasksRemaining / projectedVelocity)
    : 365; // Max 1 year if no velocity

  // Calculate completion date (accounting for working days)
  const today = new Date();
  const estimatedCompletionDate = addWorkingDays(today, daysNeeded, workingDaysPerWeek);

  // Confidence interval using std dev
  const stdDev = standardDeviation(values);
  const lowerVelocity = Math.max(0.1, projectedVelocity - stdDev);
  const upperVelocity = projectedVelocity + stdDev;

  const earliestDays = Math.ceil(tasksRemaining / upperVelocity);
  const latestDays = Math.ceil(tasksRemaining / lowerVelocity);

  const earliest = addWorkingDays(today, earliestDays, workingDaysPerWeek);
  const latest = addWorkingDays(today, latestDays, workingDaysPerWeek);

  return {
    estimatedCompletionDate,
    confidenceInterval: { earliest, latest },
    averageVelocity,
    projectedVelocity
  };
}

/**
 * Forecast Costs
 * Predicts future costs with risk analysis
 */
export function forecastCosts(
  historicalCosts: TimeSeriesData[],
  monthsAhead: number = 3
): {
  predicted: number[];
  months: Date[];
  riskAnalysis: {
    volatility: number;
    confidenceIntervals: { lower: number[]; upper: number[] };
  };
} {
  if (historicalCosts.length === 0) {
    return {
      predicted: [],
      months: [],
      riskAnalysis: {
        volatility: 0,
        confidenceIntervals: { lower: [], upper: [] }
      }
    };
  }

  // Forecast using linear regression
  const forecast = forecastDemand(historicalCosts, monthsAhead);

  // Calculate volatility (coefficient of variation)
  const values = historicalCosts.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = standardDeviation(values);
  const volatility = mean > 0 ? stdDev / mean : 0;

  return {
    predicted: forecast.predicted,
    months: forecast.timestamps,
    riskAnalysis: {
      volatility,
      confidenceIntervals: forecast.confidenceIntervals
    }
  };
}

/**
 * Detect Anomalies
 * Identifies unusual data points using statistical methods
 */
export function detectAnomalies(
  data: TimeSeriesData[],
  threshold: number = 2.5
): {
  anomalies: Array<{ index: number; timestamp: Date; value: number; score: number }>;
  summary: { total: number; percentage: number };
} {
  if (data.length < 3) {
    return { anomalies: [], summary: { total: 0, percentage: 0 } };
  }

  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = standardDeviation(values);

  const anomalies = data
    .map((d, i) => ({
      index: i,
      timestamp: d.timestamp,
      value: d.value,
      score: Math.abs(d.value - mean) / (stdDev || 1)
    }))
    .filter(item => item.score > threshold);

  return {
    anomalies,
    summary: {
      total: anomalies.length,
      percentage: (anomalies.length / data.length) * 100
    }
  };
}

/**
 * Identify Trends
 * Determines if data is trending up, down, or stable
 */
export function identifyTrends(
  data: TimeSeriesData[],
  windowSize: number = 7
): {
  currentTrend: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  changeRate: number;
} {
  if (data.length < windowSize) {
    return { currentTrend: 'stable', strength: 0, changeRate: 0 };
  }

  // Use recent data for trend
  const recentData = data.slice(-windowSize);
  const regression = linearRegression(recentData);

  const avgValue = recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;
  const changeRate = avgValue > 0 ? (regression.slope / avgValue) * 100 : 0;

  let currentTrend: 'increasing' | 'decreasing' | 'stable';
  if (Math.abs(changeRate) < 1) {
    currentTrend = 'stable';
  } else if (changeRate > 0) {
    currentTrend = 'increasing';
  } else {
    currentTrend = 'decreasing';
  }

  return {
    currentTrend,
    strength: Math.abs(regression.r2),
    changeRate
  };
}

// Helper Functions

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

function calculateAverageInterval(data: TimeSeriesData[]): number {
  if (data.length < 2) return 24 * 60 * 60 * 1000; // 1 day default

  const intervals: number[] = [];
  for (let i = 1; i < data.length; i++) {
    intervals.push(data[i].timestamp.getTime() - data[i - 1].timestamp.getTime());
  }

  return intervals.reduce((a, b) => a + b, 0) / intervals.length;
}

function addWorkingDays(
  startDate: Date,
  days: number,
  workingDaysPerWeek: number = 5
): Date {
  const result = new Date(startDate);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();

    // Count as working day if within working days
    if (workingDaysPerWeek === 7 || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      addedDays++;
    }
  }

  return result;
}
