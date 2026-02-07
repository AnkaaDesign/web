// packages/hooks/src/usePositionRemuneration.ts

import {
  getPositionRemunerations,
  getPositionRemunerationById,
  createPositionRemuneration,
  updatePositionRemuneration,
  deletePositionRemuneration,
  batchCreatePositionRemunerations,
  batchUpdatePositionRemunerations,
  batchDeletePositionRemunerations,
  findPositionRemunerationsByPositionId,
  getCurrentPositionRemunerationByPositionId,
  deletePositionRemunerationsByPositionId,
  findPositionRemunerationsByValueRange,
} from "../api-client";
import type {
  PositionRemunerationGetManyFormData,
  PositionRemunerationCreateFormData,
  PositionRemunerationUpdateFormData,
  PositionRemunerationBatchCreateFormData,
  PositionRemunerationBatchUpdateFormData,
  PositionRemunerationBatchDeleteFormData,
  PositionRemunerationInclude,
} from "../schemas";
import type {
  PositionRemunerationGetUniqueResponse,
  PositionRemunerationGetManyResponse,
  PositionRemunerationCreateResponse,
  PositionRemunerationUpdateResponse,
  PositionRemunerationDeleteResponse,
  PositionRemunerationBatchCreateResponse,
  PositionRemunerationBatchUpdateResponse,
  PositionRemunerationBatchDeleteResponse,
  PositionRemuneration,
} from "../types";
import { positionRemunerationKeys, positionKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// =====================================================
// Position Remuneration Service Adapter
// =====================================================

const positionRemunerationService = {
  getMany: (params?: PositionRemunerationGetManyFormData) => getPositionRemunerations(params),
  getById: (id: string, include?: PositionRemunerationInclude) => getPositionRemunerationById({ id, include }),
  create: (data: PositionRemunerationCreateFormData, include?: PositionRemunerationInclude) => createPositionRemuneration(data, include ? { include } : undefined),
  update: (id: string, data: PositionRemunerationUpdateFormData, include?: PositionRemunerationInclude) => updatePositionRemuneration(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePositionRemuneration(id),
  batchCreate: (data: PositionRemunerationBatchCreateFormData, include?: PositionRemunerationInclude) => batchCreatePositionRemunerations(data, include ? { include } : undefined),
  batchUpdate: (data: PositionRemunerationBatchUpdateFormData, include?: PositionRemunerationInclude) => batchUpdatePositionRemunerations(data, include ? { include } : undefined),
  batchDelete: (data: PositionRemunerationBatchDeleteFormData) => batchDeletePositionRemunerations(data),
};

// =====================================================
// Base Position Remuneration Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PositionRemunerationGetManyFormData,
  PositionRemunerationGetManyResponse,
  PositionRemunerationGetUniqueResponse,
  PositionRemunerationCreateFormData,
  PositionRemunerationCreateResponse,
  PositionRemunerationUpdateFormData,
  PositionRemunerationUpdateResponse,
  PositionRemunerationDeleteResponse,
  PositionRemunerationBatchCreateFormData,
  PositionRemunerationBatchCreateResponse<PositionRemuneration>,
  PositionRemunerationBatchUpdateFormData,
  PositionRemunerationBatchUpdateResponse<PositionRemuneration>,
  PositionRemunerationBatchDeleteFormData,
  PositionRemunerationBatchDeleteResponse
>({
  queryKeys: positionRemunerationKeys,
  service: positionRemunerationService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [positionKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePositionRemunerationsInfinite = baseHooks.useInfiniteList;
export const usePositionRemunerations = baseHooks.useList;
export const usePositionRemuneration = baseHooks.useDetail;
export const usePositionRemunerationMutations = baseHooks.useMutations;
export const usePositionRemunerationBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Position Remuneration Hooks
// =====================================================

export function usePositionRemunerationsByPositionId(positionId: string) {
  return useQuery({
    queryKey: positionRemunerationKeys.byPosition(positionId),
    queryFn: () => findPositionRemunerationsByPositionId(positionId),
    enabled: !!positionId,
  });
}

export function useCurrentPositionRemunerationByPositionId(positionId: string) {
  return useQuery({
    queryKey: positionRemunerationKeys.currentByPosition(positionId),
    queryFn: () => getCurrentPositionRemunerationByPositionId(positionId),
    enabled: !!positionId,
  });
}

export function usePositionRemunerationsByValueRange(min: number, max: number) {
  return useQuery({
    queryKey: positionRemunerationKeys.byValueRange(min, max),
    queryFn: () => findPositionRemunerationsByValueRange(min, max),
    enabled: min !== undefined && max !== undefined,
  });
}

export function useDeletePositionRemunerationsByPositionId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionId: string) => deletePositionRemunerationsByPositionId(positionId),
    onSuccess: (_, positionId) => {
      queryClient.invalidateQueries({ queryKey: positionRemunerationKeys.all });
      queryClient.invalidateQueries({ queryKey: positionRemunerationKeys.byPosition(positionId) });
      queryClient.invalidateQueries({ queryKey: positionRemunerationKeys.currentByPosition(positionId) });
      queryClient.invalidateQueries({ queryKey: positionKeys.all });
    },
  });
}

// =====================================================
// Legacy Exports (for backward compatibility)
// =====================================================

// Single mutations (now use usePositionRemunerationMutations() and destructure)
export function useCreatePositionRemuneration() {
  const { create } = usePositionRemunerationMutations();
  return create;
}

export function useUpdatePositionRemuneration() {
  const { update } = usePositionRemunerationMutations();
  return update;
}

export function useDeletePositionRemuneration() {
  const { deleteMutation } = usePositionRemunerationMutations();
  return deleteMutation;
}

// Batch mutations (now use usePositionRemunerationBatchMutations() and destructure)
export function useBatchCreatePositionRemunerations() {
  const { batchCreate } = usePositionRemunerationBatchMutations();
  return batchCreate;
}

export function useBatchUpdatePositionRemunerations() {
  const { batchUpdate } = usePositionRemunerationBatchMutations();
  return batchUpdate;
}

export function useBatchDeletePositionRemunerations() {
  const { batchDelete } = usePositionRemunerationBatchMutations();
  return batchDelete;
}
