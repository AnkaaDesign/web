import { apiClient } from './axiosClient';
import type {
  SkillStatsOverviewFilters,
  SkillStatsOverviewResponse,
  SkillStatsComparisonFilters,
  SkillStatsComparisonResponse,
  SkillStatsEvolutionFilters,
  SkillStatsEvolutionResponse,
} from '../types/skill-analytics';

export class SkillAnalyticsService {
  async getOverview(filters: SkillStatsOverviewFilters): Promise<SkillStatsOverviewResponse> {
    const response = await apiClient.post<SkillStatsOverviewResponse>(
      '/skill/analytics/overview',
      filters,
    );
    return response.data;
  }

  async getComparison(
    filters: SkillStatsComparisonFilters,
  ): Promise<SkillStatsComparisonResponse> {
    const response = await apiClient.post<SkillStatsComparisonResponse>(
      '/skill/analytics/comparison',
      filters,
    );
    return response.data;
  }

  async getEvolution(
    filters: SkillStatsEvolutionFilters,
  ): Promise<SkillStatsEvolutionResponse> {
    const response = await apiClient.post<SkillStatsEvolutionResponse>(
      '/skill/analytics/evolution',
      filters,
    );
    return response.data;
  }
}

export const skillAnalyticsService = new SkillAnalyticsService();

export const getSkillStatsOverview = (filters: SkillStatsOverviewFilters) =>
  skillAnalyticsService.getOverview(filters);

export const getSkillStatsComparison = (filters: SkillStatsComparisonFilters) =>
  skillAnalyticsService.getComparison(filters);

export const getSkillStatsEvolution = (filters: SkillStatsEvolutionFilters) =>
  skillAnalyticsService.getEvolution(filters);
