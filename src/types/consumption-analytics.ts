// web/src/types/consumption-analytics.ts

import type { BaseResponse } from './common';

// =====================
// Consumption Analytics Types
// =====================

export type ConsumptionComparisonMode = 'items' | 'sectors' | 'users';

export interface ConsumptionEntityComparison {
  entityId: string;
  entityName: string;
  quantity: number;
  value: number;
  percentage: number;
  movementCount: number;
}

export interface ConsumptionItemSimple {
  itemId: string;
  itemName: string;
  itemUniCode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  totalQuantity: number;
  totalValue: number;
  movementCount: number;
  currentStock: number;
  averagePrice: number;
}

export interface ConsumptionItemComparison extends Omit<ConsumptionItemSimple, 'totalQuantity' | 'totalValue' | 'movementCount'> {
  totalQuantity: number;
  totalValue: number;
  comparisons: ConsumptionEntityComparison[];
  currentStock: number;
  averagePrice: number;
}

export type ConsumptionItem = ConsumptionItemSimple | ConsumptionItemComparison;

export interface ConsumptionSummary {
  totalQuantity: number;
  totalValue: number;
  itemCount: number;
  entityCount?: number;
  averageConsumptionPerItem: number;
  averageValuePerItem: number;
}

export interface ConsumptionPagination {
  hasMore: boolean;
  offset: number;
  limit: number;
  total: number;
}

export interface ConsumptionAnalyticsData {
  mode: ConsumptionComparisonMode;
  items: ConsumptionItem[];
  summary: ConsumptionSummary;
  pagination: ConsumptionPagination;
}

export interface ConsumptionAnalyticsResponse extends BaseResponse {
  data: ConsumptionAnalyticsData;
}

export interface ConsumptionAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  sectorIds?: string[];
  userIds?: string[];
  itemIds?: string[];
  brandIds?: string[];
  categoryIds?: string[];
  offset?: number;
  limit?: number;
  sortBy?: 'quantity' | 'value' | 'name';
  sortOrder?: 'asc' | 'desc';
  operation?: 'OUTBOUND' | 'INBOUND' | 'ALL';
}

export type ConsumptionChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';

export function isComparisonItem(item: ConsumptionItem): item is ConsumptionItemComparison {
  return 'comparisons' in item;
}
