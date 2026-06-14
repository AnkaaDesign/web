import { apiClient } from './axiosClient';
import type {
  PayrollTrendsResponse,
  TeamPerformanceResponse,
  HrAnalyticsFilters,
  HeadcountFilters,
  HeadcountResponse,
  TurnoverFilters,
  TurnoverResponse,
  AbsenteeismFilters,
  AbsenteeismResponse,
  SalaryCostResponse,
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

  async getHeadcount(filters: HeadcountFilters): Promise<HeadcountResponse> {
    const response = await apiClient.post<HeadcountResponse>(
      '/human-resources/analytics/headcount',
      filters,
    );
    return response.data;
  }

  async getTurnover(filters: TurnoverFilters): Promise<TurnoverResponse> {
    const response = await apiClient.post<TurnoverResponse>(
      '/human-resources/analytics/turnover',
      filters,
    );
    return response.data;
  }

  async getAbsenteeism(filters: AbsenteeismFilters): Promise<AbsenteeismResponse> {
    const response = await apiClient.post<AbsenteeismResponse>(
      '/human-resources/analytics/absenteeism',
      filters,
    );
    return response.data;
  }

  async getSalaryCost(filters: HeadcountFilters): Promise<SalaryCostResponse> {
    const response = await apiClient.post<SalaryCostResponse>(
      '/human-resources/analytics/salary-cost',
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

export const getHeadcount = (filters: HeadcountFilters) =>
  hrAnalyticsService.getHeadcount(filters);

export const getTurnover = (filters: TurnoverFilters) =>
  hrAnalyticsService.getTurnover(filters);

export const getAbsenteeism = (filters: AbsenteeismFilters) =>
  hrAnalyticsService.getAbsenteeism(filters);

export const getSalaryCost = (filters: HeadcountFilters) =>
  hrAnalyticsService.getSalaryCost(filters);
