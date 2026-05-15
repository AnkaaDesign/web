import {
  createGoal,
  deleteGoal,
  getGoalById,
  getGoals,
  updateGoal,
  upsertGoalYear,
  deleteGoalRow,
  goalService,
} from "../../api-client";
import type {
  GoalCreateFormData,
  GoalUpdateFormData,
  GoalGetManyFormData,
  GoalBatchCreateFormData,
  GoalBatchUpdateFormData,
  GoalBatchDeleteFormData,
  GoalGetManyResponse,
  GoalGetUniqueResponse,
  GoalCreateResponse,
  GoalUpdateResponse,
  GoalDeleteResponse,
  GoalBatchCreateResponse,
  GoalBatchUpdateResponse,
  GoalBatchDeleteResponse,
} from "../../types";
import { goalKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const goalServiceAdapter = {
  getMany: getGoals,
  getById: getGoalById,
  create: createGoal,
  update: updateGoal,
  delete: deleteGoal,
  batchCreate: goalService.batchCreateGoals.bind(goalService),
  batchUpdate: goalService.batchUpdateGoals.bind(goalService),
  batchDelete: goalService.batchDeleteGoals.bind(goalService),
};

const baseHooks = createEntityHooks<
  GoalGetManyFormData,
  GoalGetManyResponse,
  GoalGetUniqueResponse,
  GoalCreateFormData,
  GoalCreateResponse,
  GoalUpdateFormData,
  GoalUpdateResponse,
  GoalDeleteResponse,
  GoalBatchCreateFormData,
  GoalBatchCreateResponse<GoalCreateFormData>,
  GoalBatchUpdateFormData,
  GoalBatchUpdateResponse<GoalUpdateFormData & { id: string }>,
  GoalBatchDeleteFormData,
  GoalBatchDeleteResponse
>({
  queryKeys: goalKeys,
  service: goalServiceAdapter,
  staleTime: 1000 * 60 * 5,
});

export const useGoals = baseHooks.useList;
export const useGoal = baseHooks.useDetail;
export const useGoalMutations = baseHooks.useMutations;

/**
 * Bulk upsert the 12 monthly targets for one (metric, year, sectorId) row.
 * Used by the "create/edit goal row" modal. Invalidates the goals query so the
 * grid re-renders with the saved values.
 */
export function useUpsertGoalYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertGoalYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * Delete every goal that belongs to a single (metric, year, sectorId) row.
 */
export function useDeleteGoalRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGoalRow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}
