// packages/hooks/src/paint.ts

// =====================================================
// This file consolidates all paint-related hooks
// =====================================================

// Re-export paint hooks
export * from "./usePaint";

// Re-export paint type hooks
export { useInfinitePaintTypes, usePaintTypes, usePaintType, usePaintTypeMutations, usePaintTypeBatchMutations } from "./paintType";

// Re-export paint formula hooks
export * from "./usePaintFormula";

// Re-export paint formula component hooks
export * from "./usePaintFormulaComponent";

// Re-export paint production hooks
export * from "./usePaintProduction";

// Paint ground hooks
import {
  createPaintGround,
  deletePaintGround,
  getPaintGroundById,
  getPaintGrounds,
  updatePaintGround,
  batchCreatePaintGrounds,
  batchUpdatePaintGrounds,
  batchDeletePaintGrounds,
} from "../api-client";
import type {
  PaintGroundCreateFormData,
  PaintGroundUpdateFormData,
  PaintGroundGetManyFormData,
  PaintGroundBatchCreateFormData,
  PaintGroundBatchUpdateFormData,
  PaintGroundBatchDeleteFormData,
  PaintGroundInclude,
} from "../schemas";
import type {
  PaintGroundGetManyResponse,
  PaintGroundGetUniqueResponse,
  PaintGroundCreateResponse,
  PaintGroundUpdateResponse,
  PaintGroundDeleteResponse,
  PaintGroundBatchCreateResponse,
  PaintGroundBatchUpdateResponse,
  PaintGroundBatchDeleteResponse,
} from "../types";
import { paintGroundKeys, paintKeys } from "./queryKeys";
import { createEntityHooks } from "./createEntityHooks";

// =====================================================
// Paint Ground Service Adapter
// =====================================================

const paintGroundService = {
  getMany: (params?: PaintGroundGetManyFormData) => getPaintGrounds(params || {}),
  getById: (id: string, params?: any) => getPaintGroundById(id, params),
  create: (data: PaintGroundCreateFormData, include?: PaintGroundInclude) => createPaintGround(data, include ? { include } : undefined),
  update: (id: string, data: PaintGroundUpdateFormData, include?: PaintGroundInclude) => updatePaintGround(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintGround(id),
  batchCreate: (data: PaintGroundBatchCreateFormData, include?: PaintGroundInclude) => batchCreatePaintGrounds(data, include ? { include } : undefined),
  batchUpdate: (data: PaintGroundBatchUpdateFormData, include?: PaintGroundInclude) => batchUpdatePaintGrounds(data, include ? { include } : undefined),
  batchDelete: (data: PaintGroundBatchDeleteFormData) => batchDeletePaintGrounds(data),
};

// =====================================================
// Base Paint Ground Hooks
// =====================================================

const basePaintGroundHooks = createEntityHooks<
  PaintGroundGetManyFormData,
  PaintGroundGetManyResponse,
  PaintGroundGetUniqueResponse,
  PaintGroundCreateFormData,
  PaintGroundCreateResponse,
  PaintGroundUpdateFormData,
  PaintGroundUpdateResponse,
  PaintGroundDeleteResponse,
  PaintGroundBatchCreateFormData,
  PaintGroundBatchCreateResponse<PaintGroundCreateFormData>,
  PaintGroundBatchUpdateFormData,
  PaintGroundBatchUpdateResponse<PaintGroundUpdateFormData & { id: string }>,
  PaintGroundBatchDeleteFormData,
  PaintGroundBatchDeleteResponse
>({
  queryKeys: paintGroundKeys,
  service: paintGroundService,
  staleTime: 1000 * 60 * 10, // 10 minutes - paint grounds don't change often
  relatedQueryKeys: [paintKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintGroundsInfinite = basePaintGroundHooks.useInfiniteList;
export const usePaintGrounds = basePaintGroundHooks.useList;
export const usePaintGround = basePaintGroundHooks.useDetail;
export const usePaintGroundMutations = basePaintGroundHooks.useMutations;
export const usePaintGroundBatchMutations = basePaintGroundHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export mutations with legacy names if needed
export { usePaintGroundMutations as usePaintGroundCrud };
export { usePaintGroundBatchMutations as usePaintGroundBatchOperations };
