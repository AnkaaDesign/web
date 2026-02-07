// packages/hooks/src/paint/usePaintFormula.ts

import {
  createPaintFormula,
  deletePaintFormula,
  getPaintFormulaById,
  getPaintFormulas,
  getPaintFormulasByPaintId,
  updatePaintFormula,
  batchCreatePaintFormulas,
  batchUpdatePaintFormulas,
  batchDeletePaintFormulas,
} from "../api-client";
import type {
  PaintFormulaCreateFormData,
  PaintFormulaUpdateFormData,
  PaintFormulaGetManyFormData,
  PaintFormulaBatchCreateFormData,
  PaintFormulaBatchUpdateFormData,
  PaintFormulaBatchDeleteFormData,
  PaintFormulaInclude,
} from "../schemas";
import type {
  PaintFormulaGetManyResponse,
  PaintFormulaGetUniqueResponse,
  PaintFormulaCreateResponse,
  PaintFormulaUpdateResponse,
  PaintFormulaDeleteResponse,
  PaintFormulaBatchCreateResponse,
  PaintFormulaBatchUpdateResponse,
  PaintFormulaBatchDeleteResponse,
} from "../types";
import { paintFormulaKeys, paintKeys, paintFormulaComponentKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

// =====================================================
// Paint Formula Service Adapter
// =====================================================

const paintFormulaService = {
  getMany: (params?: PaintFormulaGetManyFormData) => getPaintFormulas(params || {}),
  getManyByPaintId: (paintId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">) => getPaintFormulasByPaintId(paintId, params),
  getById: (id: string, params?: any) => getPaintFormulaById(id, params),
  create: (data: PaintFormulaCreateFormData, include?: PaintFormulaInclude) => createPaintFormula(data, include ? { include } : undefined),
  update: (id: string, data: PaintFormulaUpdateFormData, include?: PaintFormulaInclude) => updatePaintFormula(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintFormula(id),
  batchCreate: async (data: PaintFormulaBatchCreateFormData, include?: PaintFormulaInclude) => {
    // The API returns PaintFormulaBatchCreateResponse<PaintFormula> but we need to adapt it
    const response = await batchCreatePaintFormulas(data, include ? { include } : undefined);
    return response as any; // Type assertion to bypass the mismatch
  },
  batchUpdate: async (data: PaintFormulaBatchUpdateFormData, include?: PaintFormulaInclude) => {
    // The API returns PaintFormulaBatchUpdateResponse<PaintFormula> but we need to adapt it
    const response = await batchUpdatePaintFormulas(data, include ? { include } : undefined);
    return response as any; // Type assertion to bypass the mismatch
  },
  batchDelete: (data: PaintFormulaBatchDeleteFormData) => batchDeletePaintFormulas(data),
};

// =====================================================
// Base Paint Formula Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PaintFormulaGetManyFormData,
  PaintFormulaGetManyResponse,
  PaintFormulaGetUniqueResponse,
  PaintFormulaCreateFormData,
  PaintFormulaCreateResponse,
  PaintFormulaUpdateFormData,
  PaintFormulaUpdateResponse,
  PaintFormulaDeleteResponse,
  PaintFormulaBatchCreateFormData,
  PaintFormulaBatchCreateResponse<any>,
  PaintFormulaBatchUpdateFormData,
  PaintFormulaBatchUpdateResponse<any>,
  PaintFormulaBatchDeleteFormData,
  PaintFormulaBatchDeleteResponse
>({
  queryKeys: paintFormulaKeys,
  service: paintFormulaService,
  staleTime: 1000 * 60 * 10, // 10 minutes
  relatedQueryKeys: [paintKeys, paintFormulaComponentKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintFormulasInfinite = baseHooks.useInfiniteList;
export const usePaintFormulas = baseHooks.useList;
export const usePaintFormula = baseHooks.useDetail;
export const usePaintFormulaMutations = baseHooks.useMutations;
export const usePaintFormulaBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Paint-Specific Formula Hooks
// =====================================================

/**
 * Hook to fetch formulas filtered by a specific paint ID
 * @param paintId - The paint ID to filter formulas by
 * @param params - Additional query parameters (excluding paintIds)
 * @param options - Query options including enabled flag
 */
export function usePaintFormulasByPaintId(paintId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { enabled = true } = options || {};

  const query = useQuery({
    queryKey: [...paintFormulaKeys.lists(), "byPaintId", paintId, params],
    queryFn: () => paintFormulaService.getManyByPaintId(paintId, params),
    enabled: enabled && !!paintId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [...paintFormulaKeys.lists(), "byPaintId", paintId],
    });
  };

  return {
    ...query,
    refresh,
  };
}

/**
 * Hook to fetch formulas for a specific paint ID with infinite scrolling
 * @param paintId - The paint ID to filter formulas by
 * @param params - Additional query parameters (excluding paintIds)
 * @param options - Query options including enabled flag
 */
export function usePaintFormulasByPaintIdInfinite(paintId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { enabled = true } = options || {};

  const query = useInfiniteQuery({
    queryKey: [...paintFormulaKeys.lists(), "byPaintId", "infinite", paintId, params],
    queryFn: async ({ pageParam = 1 }) => {
      const requestParams = {
        ...params,
        page: pageParam,
        limit: (params as any)?.limit || 40,
      };
      return paintFormulaService.getManyByPaintId(paintId, requestParams);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta) return undefined;
      return lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: enabled && !!paintId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [...paintFormulaKeys.lists(), "byPaintId", "infinite", paintId],
    });
  };

  return {
    ...query,
    refresh,
  };
}

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export mutations with legacy names if needed
export { usePaintFormulaMutations as usePaintFormulaCrud };
export { usePaintFormulaBatchMutations as usePaintFormulaBatchOperations };
