import { apiClient } from './axiosClient';
import type {
  CollectionAnalyticsResponse,
  BankSlipPerformanceResponse,
  FinancialAnalyticsFilters,
  QuoteFunnelAnalyticsFilters,
  QuoteFunnelAnalyticsResponse,
  ReceivablesAnalyticsFilters,
  ReceivablesAnalyticsResponse,
  SicrediWebhookAnalyticsFilters,
  SicrediWebhookAnalyticsResponse,
  NfseAnalyticsFilters,
  NfseAnalyticsResponse,
} from '../types/financial-analytics';

export class FinancialAnalyticsService {
  private readonly basePath = '/invoices/analytics';

  async getCollectionAnalytics(filters: FinancialAnalyticsFilters): Promise<CollectionAnalyticsResponse> {
    const response = await apiClient.post<CollectionAnalyticsResponse>(
      `${this.basePath}/collection`,
      filters,
    );
    return response.data;
  }

  async getBankSlipPerformance(filters: FinancialAnalyticsFilters): Promise<BankSlipPerformanceResponse> {
    const response = await apiClient.post<BankSlipPerformanceResponse>(
      `${this.basePath}/bank-slips`,
      filters,
    );
    return response.data;
  }

  async getQuoteFunnelAnalytics(filters: QuoteFunnelAnalyticsFilters): Promise<QuoteFunnelAnalyticsResponse> {
    const response = await apiClient.post<QuoteFunnelAnalyticsResponse>(
      `${this.basePath}/quote-funnel`,
      filters,
    );
    return response.data;
  }

  async getReceivablesAnalytics(filters: ReceivablesAnalyticsFilters): Promise<ReceivablesAnalyticsResponse> {
    const response = await apiClient.post<ReceivablesAnalyticsResponse>(
      `${this.basePath}/receivables`,
      filters,
    );
    return response.data;
  }

  async getSicrediWebhookAnalytics(filters: SicrediWebhookAnalyticsFilters): Promise<SicrediWebhookAnalyticsResponse> {
    const response = await apiClient.post<SicrediWebhookAnalyticsResponse>(
      `${this.basePath}/sicredi-webhooks`,
      filters,
    );
    return response.data;
  }

  async getNfseAnalytics(filters: NfseAnalyticsFilters): Promise<NfseAnalyticsResponse> {
    const response = await apiClient.post<NfseAnalyticsResponse>(
      `${this.basePath}/nfse`,
      filters,
    );
    return response.data;
  }
}

export const financialAnalyticsService = new FinancialAnalyticsService();

export const getCollectionAnalytics = (filters: FinancialAnalyticsFilters) =>
  financialAnalyticsService.getCollectionAnalytics(filters);

export const getBankSlipPerformance = (filters: FinancialAnalyticsFilters) =>
  financialAnalyticsService.getBankSlipPerformance(filters);

export const getQuoteFunnelAnalytics = (filters: QuoteFunnelAnalyticsFilters) =>
  financialAnalyticsService.getQuoteFunnelAnalytics(filters);

export const getReceivablesAnalytics = (filters: ReceivablesAnalyticsFilters) =>
  financialAnalyticsService.getReceivablesAnalytics(filters);

export const getSicrediWebhookAnalytics = (filters: SicrediWebhookAnalyticsFilters) =>
  financialAnalyticsService.getSicrediWebhookAnalytics(filters);

export const getNfseAnalytics = (filters: NfseAnalyticsFilters) =>
  financialAnalyticsService.getNfseAnalytics(filters);
