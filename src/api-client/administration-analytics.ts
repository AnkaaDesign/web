import { apiClient } from './axiosClient';
import type {
  AdministrationAnalyticsResponse,
  AdministrationAnalyticsFilters,
} from '../types/administration-analytics';

export class AdministrationAnalyticsService {
  private readonly basePath = '/users/analytics';

  async getOverview(filters: AdministrationAnalyticsFilters): Promise<AdministrationAnalyticsResponse> {
    const response = await apiClient.post<AdministrationAnalyticsResponse>(
      `${this.basePath}/administration-overview`,
      filters,
    );
    return response.data;
  }
}

export const administrationAnalyticsService = new AdministrationAnalyticsService();

export const getAdministrationOverview = (filters: AdministrationAnalyticsFilters) =>
  administrationAnalyticsService.getOverview(filters);
