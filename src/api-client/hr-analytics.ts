import { apiClient } from './axiosClient';
import type {
  PayrollTrendsResponse,
  TeamPerformanceResponse,
  HrAnalyticsFilters,
} from '../types/hr-analytics';

export class HrAnalyticsService {
  async getPayrollTrends(filters: HrAnalyticsFilters): Promise<PayrollTrendsResponse> {
    const response = await apiClient.post<PayrollTrendsResponse>(
      '/payroll/analytics/trends',
      filters,
    );
    return response.data;
  }

  async getTeamPerformance(filters: HrAnalyticsFilters): Promise<TeamPerformanceResponse> {
    const response = await apiClient.post<TeamPerformanceResponse>(
      '/users/analytics/team-performance',
      filters,
    );
    return response.data;
  }
}

export const hrAnalyticsService = new HrAnalyticsService();

export const getPayrollTrends = (filters: HrAnalyticsFilters) =>
  hrAnalyticsService.getPayrollTrends(filters);

export const getTeamPerformance = (filters: HrAnalyticsFilters) =>
  hrAnalyticsService.getTeamPerformance(filters);
