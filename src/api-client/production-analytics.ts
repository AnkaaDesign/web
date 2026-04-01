import { apiClient } from './axiosClient';
import type {
  ThroughputAnalyticsResponse,
  BottleneckAnalyticsResponse,
  RevenueAnalyticsResponse,
  ProductionAnalyticsFilters,
} from '../types/production-analytics';

export class ProductionAnalyticsService {
  private readonly basePath = '/tasks/analytics';

  async getThroughput(filters: ProductionAnalyticsFilters): Promise<ThroughputAnalyticsResponse> {
    const response = await apiClient.post<ThroughputAnalyticsResponse>(
      `${this.basePath}/throughput`,
      filters,
    );
    return response.data;
  }

  async getBottlenecks(filters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>): Promise<BottleneckAnalyticsResponse> {
    const response = await apiClient.post<BottleneckAnalyticsResponse>(
      `${this.basePath}/bottlenecks`,
      filters,
    );
    return response.data;
  }

  async getRevenue(filters: ProductionAnalyticsFilters): Promise<RevenueAnalyticsResponse> {
    const response = await apiClient.post<RevenueAnalyticsResponse>(
      `${this.basePath}/revenue`,
      filters,
    );
    return response.data;
  }
}

export const productionAnalyticsService = new ProductionAnalyticsService();

export const getProductionThroughput = (filters: ProductionAnalyticsFilters) =>
  productionAnalyticsService.getThroughput(filters);

export const getProductionBottlenecks = (filters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>) =>
  productionAnalyticsService.getBottlenecks(filters);

export const getProductionRevenue = (filters: ProductionAnalyticsFilters) =>
  productionAnalyticsService.getRevenue(filters);
