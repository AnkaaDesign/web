import { apiClient } from './axiosClient';
import type {
  CollectionAnalyticsResponse,
  BankSlipPerformanceResponse,
  FinancialAnalyticsFilters,
} from '../types/financial-analytics';

export class FinancialAnalyticsService {
  private readonly invoiceBasePath = '/invoices/analytics';
  private readonly bankSlipBasePath = '/invoices/analytics';

  async getCollectionAnalytics(filters: FinancialAnalyticsFilters): Promise<CollectionAnalyticsResponse> {
    const response = await apiClient.post<CollectionAnalyticsResponse>(
      `${this.invoiceBasePath}/collection`,
      filters,
    );
    return response.data;
  }

  async getBankSlipPerformance(filters: FinancialAnalyticsFilters): Promise<BankSlipPerformanceResponse> {
    const response = await apiClient.post<BankSlipPerformanceResponse>(
      `${this.bankSlipBasePath}/bank-slips`,
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
