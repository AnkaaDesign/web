// web/src/api-client/order-analytics.ts

import { apiClient } from './axiosClient';
import type { OrderAnalyticsFilters, OrderAnalyticsResponse } from '../types/order-analytics';

export class OrderAnalyticsService {
  private readonly basePath = '/orders/analytics';

  async getOrderAnalytics(filters: OrderAnalyticsFilters): Promise<OrderAnalyticsResponse> {
    const response = await apiClient.post<OrderAnalyticsResponse>(this.basePath, filters);
    return response.data;
  }
}

export const orderAnalyticsService = new OrderAnalyticsService();

export const getOrderAnalytics = (filters: OrderAnalyticsFilters) =>
  orderAnalyticsService.getOrderAnalytics(filters);
