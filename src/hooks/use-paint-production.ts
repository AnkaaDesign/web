// packages/hooks/src/paint/usePaintProduction.ts

import {
  createPaintProduction,
  deletePaintProduction,
  getPaintProductionById,
  getPaintProductions,
  updatePaintProduction,
  batchCreatePaintProductions,
  batchUpdatePaintProductions,
  batchDeletePaintProductions,
} from "../api-client";
import type {
  PaintProductionCreateFormData,
  PaintProductionUpdateFormData,
  PaintProductionGetManyFormData,
  PaintProductionBatchCreateFormData,
  PaintProductionBatchUpdateFormData,
  PaintProductionBatchDeleteFormData,
  PaintProductionInclude,
} from "../schemas";
import type {
  PaintProductionGetManyResponse,
  PaintProductionGetUniqueResponse,
  PaintProductionCreateResponse,
  PaintProductionUpdateResponse,
  PaintProductionDeleteResponse,
  PaintProductionBatchCreateResponse,
  PaintProductionBatchUpdateResponse,
  PaintProductionBatchDeleteResponse,
} from "../types";
import { paintProductionKeys, paintKeys, itemKeys, activityKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";

// =====================================================
// Paint Production Service Adapter
// =====================================================

const paintProductionService = {
  getMany: (params?: PaintProductionGetManyFormData) => getPaintProductions(params || {}),
  getById: (id: string, params?: any) => getPaintProductionById(id, params),
  create: (data: PaintProductionCreateFormData, include?: PaintProductionInclude) => createPaintProduction(data, include ? { include } : undefined),
  update: (id: string, data: PaintProductionUpdateFormData, include?: PaintProductionInclude) => updatePaintProduction(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintProduction(id),
  batchCreate: (data: PaintProductionBatchCreateFormData, include?: PaintProductionInclude) => batchCreatePaintProductions(data, include ? { include } : undefined),
  batchUpdate: (data: PaintProductionBatchUpdateFormData, include?: PaintProductionInclude) => batchUpdatePaintProductions(data, include ? { include } : undefined),
  batchDelete: (data: PaintProductionBatchDeleteFormData) => batchDeletePaintProductions(data),
};

// =====================================================
// Base Paint Production Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PaintProductionGetManyFormData,
  PaintProductionGetManyResponse,
  PaintProductionGetUniqueResponse,
  PaintProductionCreateFormData,
  PaintProductionCreateResponse,
  PaintProductionUpdateFormData,
  PaintProductionUpdateResponse,
  PaintProductionDeleteResponse,
  PaintProductionBatchCreateFormData,
  PaintProductionBatchCreateResponse<PaintProductionCreateFormData>,
  PaintProductionBatchUpdateFormData,
  PaintProductionBatchUpdateResponse<PaintProductionUpdateFormData & { id: string }>,
  PaintProductionBatchDeleteFormData,
  PaintProductionBatchDeleteResponse
>({
  queryKeys: paintProductionKeys,
  service: paintProductionService,
  staleTime: 1000 * 60 * 5, // 5 minutes - productions change more frequently
  relatedQueryKeys: [paintKeys, itemKeys, activityKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintProductionsInfinite = baseHooks.useInfiniteList;
export const usePaintProductions = baseHooks.useList;
export const usePaintProduction = baseHooks.useDetail;
export const usePaintProductionMutations = baseHooks.useMutations;
export const usePaintProductionBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hook with expected name
export { usePaintProduction as usePaintProductionDetail };

// Re-export mutations with legacy names if needed
export { usePaintProductionMutations as usePaintProductionCrud };
export { usePaintProductionBatchMutations as usePaintProductionBatchOperations };
