import type { BaseResponse } from './common';

// Throughput Analytics
export interface ThroughputItem {
  period: string;
  periodLabel: string;
  completedCount: number;
  plannedCount: number;
  avgCompletionDays: number;
  forecastAccuracy: number;
  comparisons?: Array<{
    entityId: string;
    entityName: string;
    completedCount: number;
    plannedCount: number;
    avgCompletionDays: number;
  }>;
}

export interface ThroughputSummary {
  totalCompleted: number;
  avgCompletionDays: number;
  onTimeDeliveryRate: number;
  tasksPerWeek: number;
}

export interface ThroughputAnalyticsData {
  summary: ThroughputSummary;
  items: ThroughputItem[];
  pagination: { hasMore: boolean; offset: number; limit: number; total: number };
}

export interface ThroughputAnalyticsResponse extends BaseResponse {
  data: ThroughputAnalyticsData;
}

// Bottleneck Analytics
export interface StageDistributionItem {
  stage: string;
  stageLabel: string;
  count: number;
  avgDays: number;
}

export interface GarageUtilizationItem {
  period: string;
  periodLabel: string;
  utilizationPercent: number;
  occupiedSpots: number;
  totalSpots: number;
  byGarage?: Array<{ garage: string; occupied: number }>;
}

export interface RecutTrendItem {
  period: string;
  periodLabel: string;
  totalCuts: number;
  recuts: number;
  recutRate: number;
}

export interface BottleneckSummary {
  currentUtilization: number;
  avgQueueDays: number;
  bottleneckStage: string;
  recutRate: number;
}

export interface BottleneckAnalyticsData {
  summary: BottleneckSummary;
  stageDistribution: StageDistributionItem[];
  garageUtilization: GarageUtilizationItem[];
  recutTrend: RecutTrendItem[];
}

export interface BottleneckAnalyticsResponse extends BaseResponse {
  data: BottleneckAnalyticsData;
}

// Revenue Analytics
export interface RevenueItem {
  id: string;
  name: string;
  revenue: number;
  taskCount: number;
  avgValue: number;
  comparisons?: Array<{
    entityId: string;
    entityName: string;
    revenue: number;
    taskCount: number;
  }>;
}

export interface RevenueSummary {
  totalRevenue: number;
  avgTaskValue: number;
  monthOverMonthGrowth: number;
  topCustomer: string;
}

export interface RevenueAnalyticsData {
  summary: RevenueSummary;
  items: RevenueItem[];
  pagination: { hasMore: boolean; offset: number; limit: number; total: number };
}

export interface RevenueAnalyticsResponse extends BaseResponse {
  data: RevenueAnalyticsData;
}

// Shared filter types
export interface ProductionAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  sectorIds?: string[];
  customerIds?: string[];
  periods?: Array<{ id: string; label: string; startDate: Date; endDate: Date }>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  groupBy?: string;
}

export type ProductionChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';

// Task Production Statistics
export type TaskProductionXAxisMode = 'month' | 'year';
export type TaskProductionYAxisMode = 'count' | 'avgPerUser' | 'both';
export type TaskProductionCompareMode = 'combined' | 'separated' | 'separatedWithTotal';
export type TaskProductionChartType = 'bar' | 'bar-stacked' | 'line' | 'line-stacked' | 'area';

export interface TaskProductionFilters {
  startDate?: Date;
  endDate?: Date;
  sectorIds?: string[];
  xAxisMode?: TaskProductionXAxisMode;
  yAxisMode?: TaskProductionYAxisMode;
  compareMode?: TaskProductionCompareMode;
}

export interface TaskProductionSectorComparison {
  sectorId: string;
  sectorName: string;
  count: number;
  activeUsers: number;
  avgPerUser: number;
}

export interface TaskProductionItem {
  period: string;
  periodLabel: string;
  totalCount: number;
  activeUsers: number;
  avgPerUser: number;
  comparisons?: TaskProductionSectorComparison[];
}

export interface TaskProductionSummary {
  totalCompleted: number;
  avgPerUser: number;
  totalActiveUsers: number;
  avgTasksPerPeriod: number;
}

export interface TaskProductionData {
  summary: TaskProductionSummary;
  items: TaskProductionItem[];
}

export interface TaskProductionResponse {
  success: boolean;
  message: string;
  data: TaskProductionData;
}
