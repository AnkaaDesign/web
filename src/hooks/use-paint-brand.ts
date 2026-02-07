// packages/hooks/src/usePaintBrand.ts

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
  PaintBrandGetManyResponse,
  PaintBrandGetUniqueResponse,
  PaintBrandCreateResponse,
  PaintBrandUpdateResponse,
  PaintBrandDeleteResponse,
  PaintBrandBatchCreateResponse,
  PaintBrandBatchUpdateResponse,
  PaintBrandBatchDeleteResponse,
} from "../types";
import type {
  PaintBrandGetManyFormData,
  PaintBrandCreateFormData,
  PaintBrandUpdateFormData,
  PaintBrandBatchCreateFormData,
  PaintBrandBatchUpdateFormData,
  PaintBrandBatchDeleteFormData,
  PaintBrandInclude,
} from "../schemas";
import { createEntityHooks } from "./create-entity-hooks";
import { paintBrandKeys, paintKeys, paintTypeKeys, paintFormulaKeys } from "./query-keys";
import {
  getPaintBrands,
  getPaintBrandById,
  createPaintBrand,
  updatePaintBrand,
  deletePaintBrand,
  batchCreatePaintBrands,
  batchUpdatePaintBrands,
  batchDeletePaintBrands,
  getAvailableComponents,
} from "../api-client";

// =====================================================
// PaintBrand Service Adapter
// =====================================================

const paintBrandServiceAdapter = {
  getMany: (params?: PaintBrandGetManyFormData) => getPaintBrands(params || {}),
  getById: (id: string, params?: any) => getPaintBrandById(id, params),
  create: (data: PaintBrandCreateFormData, include?: PaintBrandInclude) => createPaintBrand(data, include ? { include } : undefined),
  update: (id: string, data: PaintBrandUpdateFormData, include?: PaintBrandInclude) => updatePaintBrand(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintBrand(id),
  batchCreate: (data: PaintBrandBatchCreateFormData, include?: PaintBrandInclude) => batchCreatePaintBrands(data, include ? { include } : undefined),
  batchUpdate: (data: PaintBrandBatchUpdateFormData, include?: PaintBrandInclude) => batchUpdatePaintBrands(data, include ? { include } : undefined),
  batchDelete: (data: PaintBrandBatchDeleteFormData) => batchDeletePaintBrands(data),
};

// =====================================================
// Base PaintBrand Hooks using createEntityHooks
// =====================================================

const baseHooks = createEntityHooks<
  PaintBrandGetManyFormData,
  PaintBrandGetManyResponse,
  PaintBrandGetUniqueResponse,
  PaintBrandCreateFormData,
  PaintBrandCreateResponse,
  PaintBrandUpdateFormData,
  PaintBrandUpdateResponse,
  PaintBrandDeleteResponse,
  PaintBrandBatchCreateFormData,
  PaintBrandBatchCreateResponse<PaintBrandCreateFormData>,
  PaintBrandBatchUpdateFormData,
  PaintBrandBatchUpdateResponse<PaintBrandUpdateFormData & { id: string }>,
  PaintBrandBatchDeleteFormData,
  PaintBrandBatchDeleteResponse
>({
  queryKeys: paintBrandKeys,
  service: paintBrandServiceAdapter,
  staleTime: 1000 * 60 * 10, // 10 minutes - paint brands don't change often
  relatedQueryKeys: [paintKeys, paintTypeKeys, paintFormulaKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const usePaintBrandsInfinite = baseHooks.useInfiniteList;
export const usePaintBrands = baseHooks.useList;
export const usePaintBrand = baseHooks.useDetail;
export const usePaintBrandMutations = baseHooks.useMutations;
export const usePaintBrandBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized PaintBrand Hooks for Component Filtering
// =====================================================

/**
 * Hook for getting paint brands filtered by paint type and brand
 * Useful for component filtering that considers both paintType and paintBrand
 */
export function usePaintBrandsForComponents(options?: { paintTypeId?: string; paintBrand?: string; includeInactive?: boolean; enabled?: boolean }) {
  const { paintTypeId, paintBrand, includeInactive = false, enabled = true } = options || {};

  return useQuery({
    queryKey: paintBrandKeys.forComponents(paintTypeId, paintBrand, includeInactive),
    queryFn: async () => {
      const params: PaintBrandGetManyFormData = {
        include: {
          paints: {
            include: {
              paintType: true,
            },
          },
        },
        where: {},
      };

      // No status filtering needed since PaintBrand doesn't have status

      // Filter paints by paintType if specified
      if (paintTypeId) {
        params.where = {
          ...params.where,
          paints: {
            some: {
              paintTypeId,
            },
          },
        };
      }

      // Filter paints by brand if specified
      if (paintBrand) {
        params.where = {
          ...params.where,
          paints: {
            some: {
              brand: paintBrand,
            },
          },
        };
      }

      const response = await getPaintBrands(params);
      return response;
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes for component filtering
  });
}

/**
 * Hook for getting active paint brands for form selection
 */
export function usePaintBrandsForSelection(options?: { searchTerm?: string; enabled?: boolean }) {
  const { searchTerm, enabled = true } = options || {};

  return useQuery({
    queryKey: paintBrandKeys.forSelection(searchTerm),
    queryFn: async () => {
      const params: PaintBrandGetManyFormData = {
        where: {},
        orderBy: {
          name: "asc",
        },
      };

      if (searchTerm) {
        params.searchingFor = searchTerm;
      }

      const response = await getPaintBrands(params);
      return response;
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes for selection lists
  });
}

/**
 * Hook for getting paint brands with paint counts
 * Useful for analytics and dashboard displays
 */
export function usePaintBrandsWithCounts(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery({
    queryKey: paintBrandKeys.withCounts(),
    queryFn: async () => {
      const params: PaintBrandGetManyFormData = {
        include: {
          _count: {
            select: {
              paints: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      };

      const response = await getPaintBrands(params);
      return response;
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 15, // 15 minutes for analytics data
  });
}

/**
 * Hook for getting available components based on paint brand and paint type intersection
 * Returns only components that exist in BOTH the selected paint brand AND paint type
 * This is the correct hook for paint formulation component selection
 */
export function useAvailableComponents(options?: { paintBrandId?: string; paintTypeId?: string; enabled?: boolean }) {
  const { paintBrandId, paintTypeId, enabled = true } = options || {};

  return useQuery({
    queryKey: ['paint', 'components', 'available', paintBrandId, paintTypeId],
    queryFn: async () => {
      if (!paintBrandId || !paintTypeId) {
        return { success: true, data: [], message: 'Paint brand and paint type are required' };
      }

      const response = await getAvailableComponents(paintBrandId, paintTypeId);
      return response;
    },
    enabled: enabled && !!paintBrandId && !!paintTypeId,
    staleTime: 1000 * 60 * 5, // 5 minutes - component intersection doesn't change often
  });
}

// =====================================================
// Dual Filtering Hooks (PaintType + PaintBrand)
// =====================================================

/**
 * Hook that provides filtered options based on both paint type and paint brand
 * This is the core hook for the dual filtering system
 */
export function useDualFilteredPaintBrands(options?: { paintTypeId?: string; paintBrand?: string; enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { paintTypeId, paintBrand, enabled = true } = options || {};

  // Get all paint brands that have paints matching the filters
  const brandsQuery = useQuery({
    queryKey: paintBrandKeys.dualFiltered(paintTypeId, paintBrand),
    queryFn: async () => {
      const params: PaintBrandGetManyFormData = {
        include: {
          paints: {
            include: {
              paintType: true,
            },
            where: {},
          },
        },
        where: {},
      };

      // Build paint filters
      const paintFilters: any = {};

      if (paintTypeId) {
        paintFilters.paintTypeId = paintTypeId;
      }

      if (paintBrand) {
        paintFilters.brand = paintBrand;
      }

      // Only include paint brands that have paints matching the filters
      if (Object.keys(paintFilters).length > 0) {
        params.where = {
          ...params.where,
          paints: {
            some: paintFilters,
          },
        };
      }

      const response = await getPaintBrands(params);
      return response;
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 5,
  });

  // Invalidation helper for dual filtering
  const invalidateDualFiltered = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: paintBrandKeys.dualFiltered(),
    });
  }, [queryClient]);

  return {
    ...brandsQuery,
    invalidateDualFiltered,
  };
}

/**
 * Hook for managing paint brand selection in forms with dual filtering
 */
export function usePaintBrandFormSelection(options?: { paintTypeId?: string; initialBrandId?: string; onBrandChange?: (brandId: string | null) => void }) {
  const { paintTypeId, initialBrandId, onBrandChange } = options || {};

  // Get available brands for the selected paint type
  const { data: availableBrands, isLoading } = usePaintBrandsForComponents({
    paintTypeId,
    enabled: true,
  });

  // Memoized brand options
  const brandOptions = useMemo(() => {
    if (!availableBrands?.data) return [];

    return availableBrands.data.map((brand) => ({
      value: brand.id,
      label: brand.name,
      paintCount: brand._count?.paints || 0,
    }));
  }, [availableBrands?.data]);

  // Check if initial brand is still valid
  const isInitialBrandValid = useMemo(() => {
    if (!initialBrandId || !availableBrands?.data) return false;
    return availableBrands.data.some((brand) => brand.id === initialBrandId);
  }, [initialBrandId, availableBrands?.data]);

  // Helper to handle brand changes
  const handleBrandChange = useCallback(
    (brandId: string | null) => {
      onBrandChange?.(brandId);
    },
    [onBrandChange],
  );

  return {
    brandOptions,
    isLoading,
    isInitialBrandValid,
    handleBrandChange,
    availableBrands: availableBrands?.data || [],
  };
}

// =====================================================
// Query Invalidation Helpers
// =====================================================

/**
 * Hook for invalidating paint brand queries with proper dependency management
 */
export function usePaintBrandInvalidation() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: paintBrandKeys.all });
  }, [queryClient]);

  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: paintBrandKeys.lists() });
  }, [queryClient]);

  const invalidateDetail = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: paintBrandKeys.detail(id) });
    },
    [queryClient],
  );

  const invalidateRelated = useCallback(() => {
    // Invalidate related paint entities
    queryClient.invalidateQueries({ queryKey: paintKeys.all });
    queryClient.invalidateQueries({ queryKey: paintTypeKeys.all });
    queryClient.invalidateQueries({ queryKey: paintFormulaKeys.all });
  }, [queryClient]);

  const invalidateComponentFilters = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: paintBrandKeys.forComponents() });
    queryClient.invalidateQueries({ queryKey: paintBrandKeys.dualFiltered() });
  }, [queryClient]);

  return {
    invalidateAll,
    invalidateLists,
    invalidateDetail,
    invalidateRelated,
    invalidateComponentFilters,
  };
}

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { usePaintBrandMutations as usePaintBrandCrud };
export { usePaintBrandBatchMutations as usePaintBrandBatchOperations };

// =====================================================
// Type Re-exports for convenience
// =====================================================

export type { PaintBrand, PaintBrandGetManyResponse, PaintBrandCreateResponse, PaintBrandUpdateResponse } from "../types";

export type { PaintBrandGetManyFormData, PaintBrandGetByIdFormData, PaintBrandCreateFormData, PaintBrandUpdateFormData } from "../schemas";
