import type { BaseResponse } from './common';

// Payroll Trends
export interface PayrollTrendItem {
  period: string;
  label: string;
  grossSalary: number;
  netSalary: number;
  totalDiscounts: number;
  inssAmount: number;
  irrfAmount: number;
  fgtsAmount: number;
  overtime50Amount: number;
  overtime100Amount: number;
  nightDifferentialAmount: number;
  bonusTotal: number;
  headcount: number;
}

export interface PayrollTrendsSummary {
  totalGrossSalary: number;
  avgGrossSalary: number;
  taxBurdenPercent: number;
  totalBonuses: number;
  monthOverMonthGrowth: number;
}

export interface PayrollSectorComparison {
  sectorId: string;
  sectorName: string;
  totalGrossSalary: number;
  totalNetSalary: number;
  totalDiscounts: number;
  totalBonuses: number;
  headcount: number;
  avgGrossSalary: number;
}

export interface PayrollTrendsData {
  summary: PayrollTrendsSummary;
  items: PayrollTrendItem[];
  comparison?: PayrollSectorComparison[];
}

export interface PayrollTrendsResponse extends BaseResponse {
  data: PayrollTrendsData;
}

// Team Performance
export interface TeamPerformanceItem {
  period: string;
  label: string;
  headcount: number;
  newHires: number;
  dismissals: number;
  turnoverRate: number;
  performanceDistribution: Record<number, number>;
  warningsByCategory: Record<string, number>;
  totalWarnings: number;
  vacationCount: number;
}

export interface TeamPerformanceSummary {
  currentHeadcount: number;
  avgPerformanceLevel: number;
  totalWarnings: number;
  onVacationCount: number;
  turnoverRate: number;
}

export interface TeamSectorComparison {
  sectorId: string;
  sectorName: string;
  headcount: number;
  avgPerformanceLevel: number;
  totalWarnings: number;
  onVacationCount: number;
}

export interface TeamPerformanceData {
  summary: TeamPerformanceSummary;
  items: TeamPerformanceItem[];
  comparison?: TeamSectorComparison[];
}

export interface TeamPerformanceResponse extends BaseResponse {
  data: TeamPerformanceData;
}

// Shared filter types
export interface HrAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  sectorIds?: string[];
  positionIds?: string[];
  periods?: Array<{ id: string; label: string; startDate: Date; endDate: Date }>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  groupBy?: string;
}

export type HrChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';
