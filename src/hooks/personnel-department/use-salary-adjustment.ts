// packages/hooks/src/useSalaryAdjustment.ts
// Reajustes salariais (Departamento Pessoal)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import {
  getSalaryAdjustments,
  getSalaryAdjustmentById,
  applySalaryAdjustment,
  updateSalaryAdjustment,
  deleteSalaryAdjustment,
} from "../../api-client/salary-adjustment";
import type {
  SalaryAdjustmentGetManyFormData,
  SalaryAdjustmentApplyFormData,
  SalaryAdjustmentUpdateFormData,
} from "../../schemas/salary-adjustment";
import type {
  SalaryAdjustmentGetManyResponse,
  SalaryAdjustmentGetUniqueResponse,
} from "../../types/salary-adjustment";
import { salaryAdjustmentKeys, positionKeys, changeLogKeys } from "../common/query-keys";

// =====================================================
// Query Hooks
// =====================================================

export function useSalaryAdjustments(
  params?: Partial<SalaryAdjustmentGetManyFormData>,
  options?: Omit<UseQueryOptions<SalaryAdjustmentGetManyResponse>, "queryKey" | "queryFn">,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: salaryAdjustmentKeys.list(params),
    queryFn: () => getSalaryAdjustments(params as SalaryAdjustmentGetManyFormData),
    staleTime: 1000 * 60 * 5,
    retry: 2,
    ...options,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: salaryAdjustmentKeys.list(params) });
  };

  return { ...query, refresh };
}

export function useSalaryAdjustment(
  id: string,
  options?: { enabled?: boolean; include?: any } & Omit<UseQueryOptions<SalaryAdjustmentGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  const queryClient = useQueryClient();
  const { enabled = true, include, ...queryOptions } = options || {};

  const query = useQuery({
    queryKey: salaryAdjustmentKeys.detail(id, include),
    queryFn: () => getSalaryAdjustmentById(id, include ? { include } : undefined),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    ...queryOptions,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: salaryAdjustmentKeys.detail(id, include) });
  };

  return { ...query, refresh };
}

// =====================================================
// Mutation Hooks
// =====================================================

export function useSalaryAdjustmentMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: salaryAdjustmentKeys.all });
    // Applying/deleting adjustments changes position remunerations
    queryClient.invalidateQueries({ queryKey: positionKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  // APPLY — POST /salary-adjustments/apply
  const applyMutation = useMutation({
    mutationFn: (data: SalaryAdjustmentApplyFormData) => applySalaryAdjustment(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  // UPDATE — note only
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SalaryAdjustmentUpdateFormData }) => updateSalaryAdjustment(id, data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  // DELETE — ADMIN only
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSalaryAdjustment(id),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  const isLoading = applyMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = applyMutation.error || updateMutation.error || deleteMutation.error;

  return {
    apply: applyMutation.mutate,
    applyAsync: applyMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    isLoading,
    isApplying: applyMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error,
    refresh: invalidateQueries,
    // Individual mutation states
    applyMutation,
    updateMutation,
    deleteMutation,
  };
}
