import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';
import type { StatisticsFilters, ApiResponse } from './statistics-inventory.service';

// =====================
// Types
// =====================

export interface FinancialOverview {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  netProfit: number;
  grossProfit: number;
  operatingExpenses: number;
  cashFlow: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  bySource: Array<{
    source: string;
    amount: number;
    percentage: number;
    growth: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    percentage: number;
    averageMargin: number;
  }>;
  byCustomer: Array<{
    customerId: string;
    customerName: string;
    revenue: number;
    percentage: number;
    orderCount: number;
  }>;
  trends: Array<{
    date: string;
    revenue: number;
    orderCount: number;
    averageOrderValue: number;
  }>;
}

export interface CostAnalysis {
  totalCosts: number;
  costOfGoodsSold: number;
  operatingCosts: number;
  laborCosts: number;
  overheadCosts: number;
  otherCosts: number;
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  costPerUnit: {
    average: number;
    byProduct: Array<{
      itemId: string;
      itemName: string;
      unitCost: number;
      totalCost: number;
      volume: number;
    }>;
  };
  trends: Array<{
    date: string;
    totalCosts: number;
    costOfGoodsSold: number;
    operatingCosts: number;
  }>;
}

export interface ProfitabilityAnalysis {
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  byProduct: Array<{
    itemId: string;
    itemName: string;
    categoryName: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    volume: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }>;
  trends: Array<{
    date: string;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
  }>;
}

export interface CashFlowMetrics {
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number;
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  daysReceivable: number;
  daysPayable: number;
  cashConversionCycle: number;
  trends: Array<{
    date: string;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
  }>;
  projections: Array<{
    date: string;
    projectedCashFlow: number;
    confidence: number;
  }>;
}

export interface InvestmentMetrics {
  totalInvestments: number;
  capitalExpenditures: number;
  returnOnInvestment: number;
  paybackPeriod: number;
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
    roi: number;
  }>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    investmentAmount: number;
    currentValue: number;
    roi: number;
    status: string;
  }>;
  performanceMetrics: {
    totalReturn: number;
    averageRoi: number;
    bestPerforming: string;
    worstPerforming: string;
  };
}

export interface BudgetAnalysis {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  utilizationRate: number;
  byDepartment: Array<{
    department: string;
    budget: number;
    spent: number;
    remaining: number;
    utilizationRate: number;
    variance: number;
  }>;
  byCategory: Array<{
    category: string;
    budget: number;
    spent: number;
    remaining: number;
    utilizationRate: number;
  }>;
  variances: Array<{
    item: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercentage: number;
    reason: string;
  }>;
  alerts: Array<{
    type: 'over_budget' | 'under_budget' | 'on_track';
    department: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export interface FinancialRatios {
  liquidityRatios: {
    currentRatio: number;
    quickRatio: number;
    cashRatio: number;
  };
  profitabilityRatios: {
    grossProfitMargin: number;
    netProfitMargin: number;
    returnOnAssets: number;
    returnOnEquity: number;
  };
  efficiencyRatios: {
    assetTurnover: number;
    inventoryTurnover: number;
    receivablesTurnover: number;
    payablesTurnover: number;
  };
  leverageRatios: {
    debtToEquity: number;
    debtRatio: number;
    equityRatio: number;
  };
  trends: {
    currentPeriod: Record<string, number>;
    previousPeriod: Record<string, number>;
    changes: Record<string, number>;
  };
}

// =====================
// Helper Functions
// =====================

const buildQueryParams = (filters: StatisticsFilters): Record<string, any> => {
  const params: Record<string, any> = {};

  if (filters.dateRange) {
    params.dateFrom = filters.dateRange.from.toISOString();
    params.dateTo = filters.dateRange.to.toISOString();
  }

  if (filters.period && filters.period !== 'custom') {
    params.period = filters.period;
  }

  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.supplierId) params.supplierId = filters.supplierId;

  return params;
};

// =====================
// Statistics Financial Service
// =====================

/**
 * Statistics Financial Service
 * Handles all financial-related statistics API calls
 */
export const statisticsFinancialService = {
  /**
   * Get financial overview statistics
   */
  getOverview: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<FinancialOverview>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<FinancialOverview>>(
      '/statistics/financial/overview',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get revenue metrics and analysis
   */
  getRevenueMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<RevenueMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<RevenueMetrics>>(
      '/statistics/financial/revenue',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get cost analysis
   */
  getCostAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<CostAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<CostAnalysis>>(
      '/statistics/financial/costs',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get profitability analysis
   */
  getProfitabilityAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProfitabilityAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ProfitabilityAnalysis>>(
      '/statistics/financial/profitability',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get cash flow metrics
   */
  getCashFlowMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<CashFlowMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<CashFlowMetrics>>(
      '/statistics/financial/cash-flow',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get investment metrics
   */
  getInvestmentMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<InvestmentMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<InvestmentMetrics>>(
      '/statistics/financial/investments',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get budget analysis
   */
  getBudgetAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<BudgetAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<BudgetAnalysis>>(
      '/statistics/financial/budget',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get financial ratios
   */
  getFinancialRatios: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<FinancialRatios>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<FinancialRatios>>(
      '/statistics/financial/ratios',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Export financial statistics
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/financial/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  FinancialOverview,
  RevenueMetrics,
  CostAnalysis,
  ProfitabilityAnalysis,
  CashFlowMetrics,
  InvestmentMetrics,
  BudgetAnalysis,
  FinancialRatios,
};
