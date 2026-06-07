// Cross-campaign skill-assessment statistics types — mirrors
// api/src/schemas/skill-analytics.ts response shapes 1:1.

import type { BaseResponse } from './common';

// =====================
// Filters (request)
// =====================

export type SkillStatsComparisonMode = 'user' | 'sector' | 'campaign';
export type SkillStatsEvolutionMode = 'company' | 'sector' | 'user' | 'skill' | 'topic';

// Composition axes for the new statistics page. The page picks one endpoint
// (overview | comparison | evolution) based on the combination below, mirroring
// the productivity page's xAxis/yAxis/compareMode pattern.
export type SkillStatsXAxisMode  = 'skill' | 'topic' | 'sector' | 'user' | 'campaign';
export type SkillStatsYAxisMode  = 'averageScore' | 'volume' | 'distribution';
export type SkillStatsCompareMode = 'none' | 'sector' | 'user' | 'skill' | 'position' | 'campaign' | 'topic';
export type SkillStatsChartType =
  | 'bar'
  | 'bar-stacked'
  | 'line'
  | 'line-smooth'
  | 'area'
  | 'area-smooth'
  | 'radar-polygon'
  | 'radar-circle'
  | 'pie';

export interface SkillStatsBaseFilters {
  assessmentIds?: string[];
  sectorIds?: string[];
  /**
   * Client-only filter: the server doesn't accept positionIds yet. Used by the
   * web stats page to derive position comparisons (≥2) from overview.byUser, and
   * to cascade-narrow the Colaboradores picker. NOT serialized to API requests
   * (see apiFilters strip in the stats page).
   */
  positionIds?: string[];
  skillIds?: string[];
  topicIds?: string[];
  userIds?: string[];
  periodStart?: Date | string;
  periodEnd?: Date | string;
  includeInProgress?: boolean;
  assessmentStatuses?: Array<'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'>;
}

export type SkillStatsOverviewFilters = SkillStatsBaseFilters;

export interface SkillStatsComparisonFilters extends SkillStatsBaseFilters {
  mode: SkillStatsComparisonMode;
  entityIds: string[];
  includeCompanyAverage?: boolean;
}

export interface SkillStatsEvolutionFilters extends SkillStatsBaseFilters {
  mode: SkillStatsEvolutionMode;
  entityIds?: string[];
}

// =====================
// Response shapes
// =====================

export interface SkillStatsRadarPoint {
  skillId: string;
  skillName: string;
  skillOrder: number;
  average: number | null;
}

export interface SkillStatsTopicRadarPoint {
  topicId: string;
  topicTitle: string;
  skillId: string;
  skillName: string;
  average: number | null;
}

export interface SkillStatsTopicDistribution {
  topicId: string;
  topicTitle: string;
  skillId: string;
  skillName: string;
  counts: [number, number, number, number, number, number];
  average: number | null;
  totalResponses: number;
}

export interface SkillStatsBySector {
  sectorId: string;
  sectorName: string;
  evaluatedCount: number;
  overallAverage: number | null;
  perSkillAverage: SkillStatsRadarPoint[];
}

export interface SkillStatsByUser {
  userId: string;
  userName: string;
  sectorId: string | null;
  sectorName: string | null;
  positionId: string | null;
  positionName: string | null;
  submittedAt: string | null; // ISO string from API
  overallAverage: number | null;
  perSkillAverage: SkillStatsRadarPoint[];
}

export interface SkillStatsOverviewSummary {
  totalEvaluated: number;
  totalEntries: number;
  submittedEntries: number;
  /**
   * Entries that are effectively complete — status SUBMITTED *or* every topic
   * scored (the "Concluída" state shown on the campaign page). Lets the KPI
   * reflect finished evaluations on still-open campaigns where evaluators
   * answered everything but haven't pressed the final submit.
   */
  completedEntries: number;
  inProgressEntries: number;
  pendingEntries: number;
  submissionRate: number;
  overallAverage: number | null;
  bestSector: { sectorId: string; sectorName: string; average: number } | null;
  bestUser: { userId: string; userName: string; average: number } | null;
  weakestSkill: { skillId: string; skillName: string; average: number } | null;
  strongestSkill: { skillId: string; skillName: string; average: number } | null;
  assessmentsCount: number;
}

export interface SkillStatsOverviewData {
  summary: SkillStatsOverviewSummary;
  bySkill: SkillStatsRadarPoint[];
  byTopic: SkillStatsTopicRadarPoint[];
  topicDistribution: SkillStatsTopicDistribution[];
  bySector: SkillStatsBySector[];
  byUser: SkillStatsByUser[];
}

export interface SkillStatsOverviewResponse extends BaseResponse<SkillStatsOverviewData> {
  data: SkillStatsOverviewData;
}

export interface SkillStatsComparisonEntity {
  entityId: string;
  entityName: string;
  sectorName: string | null;
  evaluatedCount: number;
  overallAverage: number | null;
  perSkillAverage: SkillStatsRadarPoint[];
  perTopicAverage: SkillStatsTopicRadarPoint[];
}

export interface SkillStatsComparisonData {
  mode: SkillStatsComparisonMode;
  /** When mode==='campaign', `axis`/entities are keyed by campaign; the
   *  perSkillAverage/perTopicAverage arrays carry the skill/topic breakdown. */
  axis: { skillId: string; skillName: string; skillOrder: number }[];
  topicAxis: { topicId: string; topicTitle: string; skillId: string; skillName: string }[];
  entities: SkillStatsComparisonEntity[];
  companyAverage: {
    perSkillAverage: SkillStatsRadarPoint[];
    perTopicAverage: SkillStatsTopicRadarPoint[];
    overallAverage: number | null;
  } | null;
}

export interface SkillStatsComparisonResponse extends BaseResponse<SkillStatsComparisonData> {
  data: SkillStatsComparisonData;
}

export interface SkillStatsEvolutionPoint {
  assessmentId: string;
  assessmentName: string;
  periodStart: string;
  periodEnd: string;
  values: Record<string, number | null>;
}

export interface SkillStatsEvolutionData {
  mode: SkillStatsEvolutionMode;
  series: { id: string; name: string }[];
  points: SkillStatsEvolutionPoint[];
}

export interface SkillStatsEvolutionResponse extends BaseResponse<SkillStatsEvolutionData> {
  data: SkillStatsEvolutionData;
}
