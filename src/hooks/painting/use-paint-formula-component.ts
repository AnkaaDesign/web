// packages/hooks/src/paint/usePaintFormulaComponent.ts

import {
  createPaintFormulaComponent,
  deletePaintFormulaComponent,
  getPaintFormulaComponentById,
  getPaintFormulaComponents,
  updatePaintFormulaComponent,
  batchCreatePaintFormulaComponents,
  batchUpdatePaintFormulaComponents,
  batchDeletePaintFormulaComponents,
} from "../../api-client";
import type {
  PaintFormulaComponentCreateFormData,
  PaintFormulaComponentUpdateFormData,
  PaintFormulaComponentGetManyFormData,
  PaintFormulaComponentBatchCreateFormData,
  PaintFormulaComponentBatchUpdateFormData,
  PaintFormulaComponentBatchDeleteFormData,
  PaintFormulaComponentInclude,
} from "../../schemas";
import type {
  PaintFormulaComponentGetManyResponse,
  PaintFormulaComponentGetUniqueResponse,
  PaintFormulaComponentCreateResponse,
  PaintFormulaComponentUpdateResponse,
  PaintFormulaComponentDeleteResponse,
  PaintFormulaComponentBatchCreateResponse,
  PaintFormulaComponentBatchUpdateResponse,
  PaintFormulaComponentBatchDeleteResponse,
} from "../../types";
import { paintFormulaComponentKeys, paintFormulaKeys, itemKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Paint Formula Component Service Adapter
// =====================================================

const paintFormulaComponentService = {
  getMany: (params?: PaintFormulaComponentGetManyFormData) => getPaintFormulaComponents(params || {}),
  getById: (id: string, params?: any) => getPaintFormulaComponentById(id, params),
  create: (data: PaintFormulaComponentCreateFormData, include?: PaintFormulaComponentInclude) => createPaintFormulaComponent(data, include ? { include } : undefined),
  update: (id: string, data: PaintFormulaComponentUpdateFormData, include?: PaintFormulaComponentInclude) =>
    updatePaintFormulaComponent(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintFormulaComponent(id),
  batchCreate: async (data: PaintFormulaComponentBatchCreateFormData, include?: PaintFormulaComponentInclude) => {
    // The API returns PaintFormulaComponentBatchCreateResponse<PaintFormulaComponent> but we need to adapt it
    const response = await batchCreatePaintFormulaComponents(data, include ? { include } : undefined);
    return response as any; // Type assertion to bypass the mismatch
  },
  batchUpdate: async (data: PaintFormulaComponentBatchUpdateFormData, include?: PaintFormulaComponentInclude) => {
    // The API returns PaintFormulaComponentBatchUpdateResponse<PaintFormulaComponent> but we need to adapt it
    const response = await batchUpdatePaintFormulaComponents(data, include ? { include } : undefined);
    return response as any; // Type assertion to bypass the mismatch
  },
  batchDelete: (data: PaintFormulaComponentBatchDeleteFormData) => batchDeletePaintFormulaComponents(data),
};

// =====================================================
// Base Paint Formula Component Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PaintFormulaComponentGetManyFormData,
  PaintFormulaComponentGetManyResponse,
  PaintFormulaComponentGetUniqueResponse,
  PaintFormulaComponentCreateFormData,
  PaintFormulaComponentCreateResponse,
  PaintFormulaComponentUpdateFormData,
  PaintFormulaComponentUpdateResponse,
  PaintFormulaComponentDeleteResponse,
  PaintFormulaComponentBatchCreateFormData,
  PaintFormulaComponentBatchCreateResponse<any>,
  PaintFormulaComponentBatchUpdateFormData,
  PaintFormulaComponentBatchUpdateResponse<any>,
  PaintFormulaComponentBatchDeleteFormData,
  PaintFormulaComponentBatchDeleteResponse
>({
  queryKeys: paintFormulaComponentKeys,
  service: paintFormulaComponentService,
  staleTime: 1000 * 60 * 10, // 10 minutes
  relatedQueryKeys: [paintFormulaKeys, itemKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintFormulaComponentsInfinite = baseHooks.useInfiniteList;
export const usePaintFormulaComponents = baseHooks.useList;
export const usePaintFormulaComponent = baseHooks.useDetail;
export const usePaintFormulaComponentMutations = baseHooks.useMutations;
export const usePaintFormulaComponentBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export mutations with legacy names if needed
export { usePaintFormulaComponentMutations as usePaintFormulaComponentCrud };
export { usePaintFormulaComponentBatchMutations as usePaintFormulaComponentBatchOperations };
