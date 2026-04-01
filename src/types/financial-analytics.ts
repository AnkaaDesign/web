import type { BaseResponse } from './common';

// Collection Analytics
export interface CollectionItem {
  period: string;
  periodLabel: string;
  invoicedAmount: number;
  paidAmount: number;
  collectionRate: number;
  overdueAmount: number;
}

export interface AgingBand {
  band: string;
  bandLabel: string;
  count: number;
  amount: number;
}

export interface RevenueFunnel {
  invoiced: number;
  billed: number;
  collected: number;
  outstanding: number;
}

export interface CollectionSummary {
  collectionRate: number;
  avgDaysToPayment: number;
  totalOverdue: number;
  overdueRate: number;
}

export interface CollectionAnalyticsData {
  summary: CollectionSummary;
  items: CollectionItem[];
  agingAnalysis: AgingBand[];
  revenueFunnel: RevenueFunnel;
}

export interface CollectionAnalyticsResponse extends BaseResponse {
  data: CollectionAnalyticsData;
}

// Bank Slip Performance
export interface BankSlipPerformanceItem {
  period: string;
  periodLabel: string;
  totalSlips: number;
  paidSlips: number;
  conversionRate: number;
  avgDelay: number;
}

export interface StatusDistributionItem {
  status: string;
  statusLabel: string;
  count: number;
  amount: number;
}

export interface TypeDistributionItem {
  type: string;
  typeLabel: string;
  count: number;
  amount: number;
  paidCount: number;
  conversionRate: number;
}

export interface BankSlipPerformanceSummary {
  conversionRate: number;
  avgDelayDays: number;
  errorRate: number;
  activeSlips: number;
}

export interface BankSlipPerformanceData {
  summary: BankSlipPerformanceSummary;
  items: BankSlipPerformanceItem[];
  statusDistribution: StatusDistributionItem[];
  typeDistribution: TypeDistributionItem[];
}

export interface BankSlipPerformanceResponse extends BaseResponse {
  data: BankSlipPerformanceData;
}

// Shared filter types
export interface FinancialAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  customerIds?: string[];
  status?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  groupBy?: string;
}

export type FinancialChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';
