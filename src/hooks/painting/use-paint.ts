// packages/hooks/src/paint/usePaint.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPaint, deletePaint, getPaintById, getPaints, updatePaint, batchCreatePaints, batchUpdatePaints, batchDeletePaints, mergePaints } from "../../api-client";
import type {
  PaintCreateFormData,
  PaintUpdateFormData,
  PaintGetManyFormData,
  PaintBatchCreateFormData,
  PaintBatchUpdateFormData,
  PaintBatchDeleteFormData,
  PaintMergeFormData,
} from "../../schemas";
import type {
  PaintGetManyResponse,
  PaintGetUniqueResponse,
  PaintCreateResponse,
  PaintUpdateResponse,
  PaintDeleteResponse,
  PaintBatchCreateResponse,
  PaintBatchUpdateResponse,
  PaintBatchDeleteResponse,
} from "../../types";
import { paintKeys, paintFormulaKeys, paintProductionKeys, taskKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Paint Service Adapter
// =====================================================

const paintService = {
  getMany: (params?: PaintGetManyFormData) => getPaints(params || {}),
  getById: (id: string, params?: any) => getPaintById(id, params),
  create: (data: PaintCreateFormData, params?: any) => createPaint(data, params),
  update: (id: string, data: PaintUpdateFormData, params?: any) => updatePaint(id, data, params),
  delete: (id: string) => deletePaint(id),
  batchCreate: (data: PaintBatchCreateFormData, params?: any) => batchCreatePaints(data, params),
  batchUpdate: (data: PaintBatchUpdateFormData, params?: any) => batchUpdatePaints(data, params),
  batchDelete: (data: PaintBatchDeleteFormData) => batchDeletePaints(data),
};

// =====================================================
// Base Paint Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PaintGetManyFormData,
  PaintGetManyResponse,
  PaintGetUniqueResponse,
  PaintCreateFormData,
  PaintCreateResponse,
  PaintUpdateFormData,
  PaintUpdateResponse,
  PaintDeleteResponse,
  PaintBatchCreateFormData,
  PaintBatchCreateResponse<PaintCreateFormData>,
  PaintBatchUpdateFormData,
  PaintBatchUpdateResponse<PaintUpdateFormData & { id: string }>,
  PaintBatchDeleteFormData,
  PaintBatchDeleteResponse
>({
  queryKeys: paintKeys,
  service: paintService,
  staleTime: 1000 * 60 * 10, // 10 minutes - paints don't change often
  relatedQueryKeys: [taskKeys, paintFormulaKeys, paintProductionKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintsInfinite = baseHooks.useInfiniteList;
export const usePaints = baseHooks.useList;
export const usePaint = baseHooks.useDetail;
export const usePaintMutations = baseHooks.useMutations;
export const usePaintBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hook with expected name
export { usePaint as usePaintDetail };

// Re-export mutations with legacy names if needed
export { usePaintMutations as usePaintCrud };
export { usePaintBatchMutations as usePaintBatchOperations };

// =====================================================
// Paint Merge Hook
// =====================================================

export function usePaintMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PaintMergeFormData) => mergePaints(data),
    onSuccess: () => {
      // Invalidate paint-related queries
      queryClient.invalidateQueries({ queryKey: paintKeys.all });
      queryClient.invalidateQueries({ queryKey: paintFormulaKeys.all });
      queryClient.invalidateQueries({ queryKey: paintProductionKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}
