// web/src/api-client/consumption-analytics.ts

import { apiClient } from './axiosClient';
import type { ConsumptionAnalyticsFilters, ConsumptionAnalyticsResponse } from '../types/consumption-analytics';

export class ConsumptionAnalyticsService {
  private readonly basePath = '/activities/analytics';

  async getConsumptionComparison(filters: ConsumptionAnalyticsFilters): Promise<ConsumptionAnalyticsResponse> {
    const response = await apiClient.post<ConsumptionAnalyticsResponse>(
      `${this.basePath}/consumption-comparison`,
      filters,
    );
    return response.data;
  }
}

export const consumptionAnalyticsService = new ConsumptionAnalyticsService();

export const getConsumptionComparison = (filters: ConsumptionAnalyticsFilters) =>
  consumptionAnalyticsService.getConsumptionComparison(filters);
