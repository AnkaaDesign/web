import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsFinancialService } from '../../api-client/statistics-financial.service';
import type {
  FinancialOverview,
  RevenueMetrics,
  CostAnalysis,
  ProfitabilityAnalysis,
  CashFlowMetrics,
  InvestmentMetrics,
  BudgetAnalysis,
  FinancialRatios,
  ApiResponse,
} from '../../api-client/statistics-financial.service';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

export const financialStatisticsKeys = {
  all: ['statistics', 'financial'] as const,
  overview: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'overview', filters] as const,
  revenue: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'revenue', filters] as const,
  costs: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'costs', filters] as const,
  profitability: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'profitability', filters] as const,
  cashFlow: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'cash-flow', filters] as const,
  investments: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'investments', filters] as const,
  budget: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'budget', filters] as const,
  ratios: (filters: StatisticsFilters) => [...financialStatisticsKeys.all, 'ratios', filters] as const,
};

export const useFinancialOverview = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<FinancialOverview>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.overview(filters),
    queryFn: () => statisticsFinancialService.getOverview(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useRevenueMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<RevenueMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.revenue(filters),
    queryFn: () => statisticsFinancialService.getRevenueMetrics(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useCostAnalysis = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<CostAnalysis>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.costs(filters),
    queryFn: () => statisticsFinancialService.getCostAnalysis(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useProfitabilityAnalysis = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<ProfitabilityAnalysis>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.profitability(filters),
    queryFn: () => statisticsFinancialService.getProfitabilityAnalysis(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useCashFlowMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<CashFlowMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.cashFlow(filters),
    queryFn: () => statisticsFinancialService.getCashFlowMetrics(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useInvestmentMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<InvestmentMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.investments(filters),
    queryFn: () => statisticsFinancialService.getInvestmentMetrics(filters),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useBudgetAnalysis = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<BudgetAnalysis>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.budget(filters),
    queryFn: () => statisticsFinancialService.getBudgetAnalysis(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useFinancialRatios = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<FinancialRatios>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: financialStatisticsKeys.ratios(filters),
    queryFn: () => statisticsFinancialService.getFinancialRatios(filters),
    staleTime: 20 * 60 * 1000,
    ...options,
  });
};

export const useExportFinancialStatistics = () => {
  return useMutation({
    mutationFn: ({ filters, format = 'xlsx' }: { filters: StatisticsFilters; format?: 'csv' | 'xlsx' | 'pdf' }) =>
      statisticsFinancialService.exportStatistics(filters, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financial-statistics-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useFinancialStatistics = (filters: StatisticsFilters) => {
  const overview = useFinancialOverview(filters);
  const revenue = useRevenueMetrics(filters);
  const costs = useCostAnalysis(filters);
  const profitability = useProfitabilityAnalysis(filters);

  return {
    overview,
    revenue,
    costs,
    profitability,
    isLoading: overview.isLoading || revenue.isLoading || costs.isLoading || profitability.isLoading,
    isError: overview.isError || revenue.isError || costs.isError || profitability.isError,
  };
};
