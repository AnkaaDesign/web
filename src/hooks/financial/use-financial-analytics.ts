import { useQuery } from '@tanstack/react-query';
import { getCollectionAnalytics, getBankSlipPerformance } from '@/api-client/financial-analytics';
import type {
  FinancialAnalyticsFilters,
  CollectionAnalyticsResponse,
  BankSlipPerformanceResponse,
} from '@/types/financial-analytics';

export const financialAnalyticsKeys = {
  all: ['financial-analytics'] as const,
  collection: (filters: FinancialAnalyticsFilters) => [...financialAnalyticsKeys.all, 'collection', filters] as const,
  bankSlipPerformance: (filters: FinancialAnalyticsFilters) => [...financialAnalyticsKeys.all, 'bank-slip-performance', filters] as const,
};

export function useCollectionAnalytics(filters: FinancialAnalyticsFilters) {
  return useQuery<CollectionAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.collection(filters),
    queryFn: () => getCollectionAnalytics(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useBankSlipPerformance(filters: FinancialAnalyticsFilters) {
  return useQuery<BankSlipPerformanceResponse, Error>({
    queryKey: financialAnalyticsKeys.bankSlipPerformance(filters),
    queryFn: () => getBankSlipPerformance(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
