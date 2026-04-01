import type { BaseResponse } from './common';

export interface PaintProductionItem {
  period: string;
  periodLabel: string;
  productionCount: number;
  totalVolumeLiters: number;
  avgCostPerLiter: number;
}

export interface PopularPaintItem {
  paintId: string;
  paintName: string;
  hex: string;
  finish: string;
  productionCount: number;
  totalVolumeLiters: number;
}

export interface PaintAnalyticsSummary {
  totalProductions: number;
  totalVolumeLiters: number;
  avgCostPerLiter: number;
  mostUsedPaint: string;
}

export interface PaintAnalyticsData {
  summary: PaintAnalyticsSummary;
  items: PaintProductionItem[];
  popularPaints: PopularPaintItem[];
}

export interface PaintAnalyticsResponse extends BaseResponse {
  data: PaintAnalyticsData;
}

export interface PaintAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  paintTypeIds?: string[];
  paintBrandIds?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  groupBy?: string;
}

export type PaintChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';
