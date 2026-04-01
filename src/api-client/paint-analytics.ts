import { apiClient } from './axiosClient';
import type {
  PaintAnalyticsResponse,
  PaintAnalyticsFilters,
} from '../types/paint-analytics';

export class PaintAnalyticsService {
  private readonly basePath = '/paints/analytics';

  async getOverview(filters: PaintAnalyticsFilters): Promise<PaintAnalyticsResponse> {
    const response = await apiClient.post<PaintAnalyticsResponse>(
      `${this.basePath}/overview`,
      filters,
    );
    return response.data;
  }
}

export const paintAnalyticsService = new PaintAnalyticsService();

export const getPaintAnalyticsOverview = (filters: PaintAnalyticsFilters) =>
  paintAnalyticsService.getOverview(filters);
