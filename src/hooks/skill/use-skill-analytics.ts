// Cross-campaign skill-assessment analytics hooks.
//
// Three views power the /estatisticas/recursos-humanos/competencias page:
//   - useSkillStatsOverview     → KPIs + radar + ranking + topic histogram
//   - useSkillStatsComparison   → multi-entity radar (user|sector vs company)
//   - useSkillStatsEvolution    → per-assessment time series across campaigns
//
// The `enabled` flag lets the page suppress comparison/evolution queries
// when the user is on the Overview tab (or hasn't picked entities yet).

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getSkillStatsOverview,
  getSkillStatsComparison,
  getSkillStatsEvolution,
} from "../../api-client";
import type {
  SkillStatsOverviewFilters,
  SkillStatsOverviewResponse,
  SkillStatsComparisonFilters,
  SkillStatsComparisonResponse,
  SkillStatsEvolutionFilters,
  SkillStatsEvolutionResponse,
} from "../../types/skill-analytics";
import { skillAnalyticsKeys } from "../common/query-keys";

const STALE_TIME = 3 * 60 * 1000; // 3 min — mirrors useTaskProductionStats
const GC_TIME = 10 * 60 * 1000;

export function useSkillStatsOverview(
  filters: SkillStatsOverviewFilters,
  options?: Omit<
    UseQueryOptions<SkillStatsOverviewResponse, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<SkillStatsOverviewResponse, Error>({
    queryKey: skillAnalyticsKeys.overview(filters),
    queryFn: () => getSkillStatsOverview(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    ...options,
  });
}

export function useSkillStatsComparison(
  filters: SkillStatsComparisonFilters,
  options?: Omit<
    UseQueryOptions<SkillStatsComparisonResponse, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<SkillStatsComparisonResponse, Error>({
    queryKey: skillAnalyticsKeys.comparison(filters),
    queryFn: () => getSkillStatsComparison(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    // The API requires entityIds.length >= 1 — gate the query on that so the
    // page doesn't make a useless request before the user picks entities.
    enabled: (filters.entityIds?.length ?? 0) > 0,
    ...options,
  });
}

export function useSkillStatsEvolution(
  filters: SkillStatsEvolutionFilters,
  options?: Omit<
    UseQueryOptions<SkillStatsEvolutionResponse, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<SkillStatsEvolutionResponse, Error>({
    queryKey: skillAnalyticsKeys.evolution(filters),
    queryFn: () => getSkillStatsEvolution(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    // For sector|user modes we need entityIds; for company mode it's optional.
    enabled:
      filters.mode === "company" || (filters.entityIds?.length ?? 0) > 0,
    ...options,
  });
}
