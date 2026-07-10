import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import {
  calculateProductionAvailability,
  getPaintPlanDetail,
  getProductionScheduleDefaults,
} from "@/api-client";
import type { ProductionAvailabilitySelection } from "@/api-client/paint";

export const productionAvailabilityKeys = {
  all: ["paintProductions", "availability"] as const,
  scheduleDefaults: (forecastDate?: string) =>
    ["paintProductions", "schedule-defaults", forecastDate ?? null] as const,
  calc: (selections: ProductionAvailabilitySelection[]) =>
    ["paintProductions", "availability", selections] as const,
};

/**
 * Default paint selections derived from tasks currently in the schedule. The server
 * owns the "3 gallons (10.8 L) per task" rule and aggregates per paint, so a paint
 * used by N tasks comes back pre-filled with N × 10.8 L. When `forecastDate` is set,
 * only tasks forecast on or before that day are counted.
 */
export function useProductionScheduleDefaults(forecastDate?: string) {
  return useQuery({
    queryKey: productionAvailabilityKeys.scheduleDefaults(forecastDate),
    queryFn: () => getProductionScheduleDefaults(forecastDate),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Live availability calculation. Recomputes whenever `selections` change and keeps
 * the previous result on screen while refetching, so editing a volume doesn't make
 * the cards/table flicker back to an empty state.
 */
export function useProductionAvailability(
  selections: ProductionAvailabilitySelection[],
  enabled = true,
) {
  return useQuery({
    queryKey: productionAvailabilityKeys.calc(selections),
    queryFn: () => calculateProductionAvailability(selections),
    enabled: enabled && selections.length > 0,
    staleTime: 1000 * 30,
    placeholderData: keepPreviousData,
  });
}

/** Imperative variant for callers that prefer to trigger the calc on demand. */
export function useCalculateProductionAvailability() {
  return useMutation({
    mutationFn: (selections: ProductionAvailabilitySelection[]) =>
      calculateProductionAvailability(selections),
  });
}

/** Single-paint detail (tasks + formula + missing) for the planner modal. */
export function usePaintPlanDetail(
  paintId: string | null,
  volumeLiters: number,
  forecastDate?: string,
) {
  return useQuery({
    queryKey: ["paintProductions", "paint-plan-detail", paintId, volumeLiters, forecastDate ?? null],
    queryFn: () => getPaintPlanDetail(paintId as string, volumeLiters, forecastDate),
    enabled: !!paintId,
    staleTime: 1000 * 30,
  });
}
