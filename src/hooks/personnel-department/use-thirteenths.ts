// hooks/personnel-department/use-thirteenths.ts
// 13º salário (gratificação natalina) — Part D
//
// The thirteenth module has NO batch endpoints, so the standard
// createEntityHooks (which requires batch services) is not used. List/detail +
// CRUD + generate/pay/document are wired manually with react-query.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getThirteenths,
  getThirteenthById,
  createThirteenth,
  updateThirteenth,
  deleteThirteenth,
  generateThirteenths,
  payFirstInstallment,
  paySecondInstallment,
} from "../../api-client/thirteenth";
import type {
  ThirteenthGetManyFormData,
  ThirteenthCreateFormData,
  ThirteenthUpdateFormData,
  ThirteenthPayInstallmentFormData,
  ThirteenthGenerateFormData,
} from "../../schemas/thirteenth";
import { thirteenthKeys, userKeys, changeLogKeys } from "../common/query-keys";

// =====================================================
// Query Hooks
// =====================================================

export function useThirteenths(filters?: ThirteenthGetManyFormData, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: thirteenthKeys.list(filters),
    queryFn: () => getThirteenths(filters),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
}

export function useThirteenth(id: string, params?: any, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: thirteenthKeys.detail(id, params),
    queryFn: () => getThirteenthById(id, params),
    staleTime: 1000 * 60 * 5,
    enabled: (options?.enabled ?? true) && !!id,
  });
}

// =====================================================
// Mutations
// =====================================================

function useInvalidateThirteenths() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: thirteenthKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

/** Bundled CRUD mutations (create/update/delete). */
export function useThirteenthMutations() {
  const invalidate = useInvalidateThirteenths();

  const createMutation = useMutation({
    mutationFn: ({ data, query }: { data: ThirteenthCreateFormData; query?: any }) => createThirteenth(data, query),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, query }: { id: string; data: ThirteenthUpdateFormData; query?: any }) => updateThirteenth(id, data, query),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteThirteenth(id),
    onSuccess: invalidate,
  });

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    createMutation,
    updateMutation,
    deleteMutation,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

/** POST /thirteenths/generate — whole-year generation for eligible CLT. */
export function useThirteenthGenerate() {
  const invalidate = useInvalidateThirteenths();
  return useMutation({
    mutationFn: (data: ThirteenthGenerateFormData) => generateThirteenths(data),
    onSuccess: invalidate,
  });
}

/** POST /thirteenths/:id/pay/first — mark 1ª parcela paid. */
export function useThirteenthPayFirst() {
  const invalidate = useInvalidateThirteenths();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ThirteenthPayInstallmentFormData }) => payFirstInstallment(id, data),
    onSuccess: invalidate,
  });
}

/** POST /thirteenths/:id/pay/second — mark 2ª parcela paid. */
export function useThirteenthPaySecond() {
  const invalidate = useInvalidateThirteenths();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ThirteenthPayInstallmentFormData }) => paySecondInstallment(id, data),
    onSuccess: invalidate,
  });
}
