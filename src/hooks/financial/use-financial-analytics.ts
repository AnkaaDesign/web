import { useQuery } from '@tanstack/react-query';
import {
  getCollectionAnalytics,
  getBankSlipPerformance,
  getQuoteFunnelAnalytics,
  getReceivablesAnalytics,
  getSicrediWebhookAnalytics,
  getNfseAnalytics,
} from '@/api-client/financial-analytics';
import type {
  FinancialAnalyticsFilters,
  CollectionAnalyticsResponse,
  BankSlipPerformanceResponse,
  QuoteFunnelAnalyticsFilters,
  QuoteFunnelAnalyticsResponse,
  ReceivablesAnalyticsFilters,
  ReceivablesAnalyticsResponse,
  SicrediWebhookAnalyticsFilters,
  SicrediWebhookAnalyticsResponse,
  NfseAnalyticsFilters,
  NfseAnalyticsResponse,
} from '@/types/financial-analytics';

export const financialAnalyticsKeys = {
  all: ['financial-analytics'] as const,
  collection: (filters: FinancialAnalyticsFilters) =>
    [...financialAnalyticsKeys.all, 'collection', filters] as const,
  bankSlipPerformance: (filters: FinancialAnalyticsFilters) =>
    [...financialAnalyticsKeys.all, 'bank-slip-performance', filters] as const,
  quoteFunnel: (filters: QuoteFunnelAnalyticsFilters) =>
    [...financialAnalyticsKeys.all, 'quote-funnel', filters] as const,
  receivables: (filters: ReceivablesAnalyticsFilters) =>
    [...financialAnalyticsKeys.all, 'receivables', filters] as const,
  sicrediWebhooks: (filters: SicrediWebhookAnalyticsFilters) =>
    [...financialAnalyticsKeys.all, 'sicredi-webhooks', filters] as const,
  nfse: (filters: NfseAnalyticsFilters) => [...financialAnalyticsKeys.all, 'nfse', filters] as const,
};

const SHARED_QUERY_OPTIONS = {
  staleTime: 3 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
};

export function useCollectionAnalytics(filters: FinancialAnalyticsFilters) {
  return useQuery<CollectionAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.collection(filters),
    queryFn: () => getCollectionAnalytics(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useBankSlipPerformance(filters: FinancialAnalyticsFilters) {
  return useQuery<BankSlipPerformanceResponse, Error>({
    queryKey: financialAnalyticsKeys.bankSlipPerformance(filters),
    queryFn: () => getBankSlipPerformance(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useQuoteFunnelAnalytics(filters: QuoteFunnelAnalyticsFilters) {
  return useQuery<QuoteFunnelAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.quoteFunnel(filters),
    queryFn: () => getQuoteFunnelAnalytics(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useReceivablesAnalytics(filters: ReceivablesAnalyticsFilters) {
  return useQuery<ReceivablesAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.receivables(filters),
    queryFn: () => getReceivablesAnalytics(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useSicrediWebhookAnalytics(filters: SicrediWebhookAnalyticsFilters) {
  return useQuery<SicrediWebhookAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.sicrediWebhooks(filters),
    queryFn: () => getSicrediWebhookAnalytics(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useNfseAnalytics(filters: NfseAnalyticsFilters) {
  return useQuery<NfseAnalyticsResponse, Error>({
    queryKey: financialAnalyticsKeys.nfse(filters),
    queryFn: () => getNfseAnalytics(filters),
    ...SHARED_QUERY_OPTIONS,
  });
}
