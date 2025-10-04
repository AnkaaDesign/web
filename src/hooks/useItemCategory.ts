// packages/hooks/src/useItemCategory.ts

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createItemCategory,
  deleteItemCategory,
  getItemCategoryById,
  getItemCategories,
  getPpeCategories,
  getRegularCategories,
  getToolCategories,
  getCategoriesByType,
  updateItemCategory,
  batchCreateItemCategories,
  batchUpdateItemCategories,
  batchDeleteItemCategories,
} from "../api-client";
import { ITEM_CATEGORY_TYPE } from "../constants";
import type {
  ItemCategoryCreateFormData,
  ItemCategoryUpdateFormData,
  ItemCategoryGetManyFormData,
  ItemCategoryBatchCreateFormData,
  ItemCategoryBatchUpdateFormData,
  ItemCategoryBatchDeleteFormData,
  ItemCategoryInclude,
} from "../schemas";
import type {
  ItemCategoryGetManyResponse,
  ItemCategoryGetUniqueResponse,
  ItemCategoryCreateResponse,
  ItemCategoryUpdateResponse,
  ItemCategoryDeleteResponse,
  ItemCategoryBatchCreateResponse,
  ItemCategoryBatchUpdateResponse,
  ItemCategoryBatchDeleteResponse,
} from "../types";
import { itemCategoryKeys, itemKeys, orderScheduleKeys } from "./queryKeys";
import { createEntityHooks } from "./createEntityHooks";

// =====================================================
// ItemCategory Service Adapter
// =====================================================

const itemCategoryService = {
  getMany: (params: ItemCategoryGetManyFormData) => getItemCategories(params || {}),
  getById: (id: string, params?: any) => getItemCategoryById(id, params),
  create: (data: ItemCategoryCreateFormData, include?: ItemCategoryInclude) => createItemCategory(data, include ? { include } : undefined),
  update: (id: string, data: ItemCategoryUpdateFormData, include?: ItemCategoryInclude) => updateItemCategory(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteItemCategory(id),
  batchCreate: (data: ItemCategoryBatchCreateFormData, include?: ItemCategoryInclude) => batchCreateItemCategories(data, include ? { include } : undefined),
  batchUpdate: (data: ItemCategoryBatchUpdateFormData, include?: ItemCategoryInclude) => batchUpdateItemCategories(data, include ? { include } : undefined),
  batchDelete: (data: ItemCategoryBatchDeleteFormData) => batchDeleteItemCategories(data),
};

// =====================================================
// Base ItemCategory Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ItemCategoryGetManyFormData,
  ItemCategoryGetManyResponse,
  ItemCategoryGetUniqueResponse,
  ItemCategoryCreateFormData,
  ItemCategoryCreateResponse,
  ItemCategoryUpdateFormData,
  ItemCategoryUpdateResponse,
  ItemCategoryDeleteResponse,
  ItemCategoryBatchCreateFormData,
  ItemCategoryBatchCreateResponse<ItemCategoryCreateFormData>,
  ItemCategoryBatchUpdateFormData,
  ItemCategoryBatchUpdateResponse<ItemCategoryUpdateFormData>,
  ItemCategoryBatchDeleteFormData,
  ItemCategoryBatchDeleteResponse
>({
  queryKeys: itemCategoryKeys,
  service: itemCategoryService,
  staleTime: 1000 * 60 * 10, // 10 minutes - categories don't change often
  relatedQueryKeys: [itemKeys, orderScheduleKeys], // Categories affect items and order schedules
});

// Export base hooks with standard names
export const useItemCategoriesInfinite = baseHooks.useInfiniteList;
export const useItemCategories = baseHooks.useList;
export const useItemCategory = baseHooks.useDetail;
export const useItemCategoryMutations = baseHooks.useMutations;
export const useItemCategoryBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hook with old name
export { useItemCategory as useItemCategoryDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateItemCategory = () => {
  const { createMutation } = useItemCategoryMutations();
  return createMutation;
};

export const useUpdateItemCategory = (id: string) => {
  const { updateMutation } = useItemCategoryMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteItemCategory = () => {
  const { deleteMutation } = useItemCategoryMutations();
  return deleteMutation;
};

// =====================================================
// Type-Specific Category Hooks
// =====================================================

/**
 * Hook to fetch PPE (Personal Protective Equipment) categories
 */
export const usePpeCategories = (options?: { enabled?: boolean; staleTime?: number }) => {
  return useQuery({
    queryKey: itemCategoryKeys.ppe(),
    queryFn: () => getPpeCategories(),
    staleTime: options?.staleTime ?? 1000 * 60 * 10, // 10 minutes
    enabled: options?.enabled,
  });
};

/**
 * Hook to fetch regular item categories
 */
export const useRegularCategories = (options?: { enabled?: boolean; staleTime?: number }) => {
  return useQuery({
    queryKey: itemCategoryKeys.regular(),
    queryFn: () => getRegularCategories(),
    staleTime: options?.staleTime ?? 1000 * 60 * 10, // 10 minutes
    enabled: options?.enabled,
  });
};

/**
 * Hook to fetch tool categories
 */
export const useToolCategories = (options?: { enabled?: boolean; staleTime?: number }) => {
  return useQuery({
    queryKey: itemCategoryKeys.tool(),
    queryFn: () => getToolCategories(),
    staleTime: options?.staleTime ?? 1000 * 60 * 10, // 10 minutes
    enabled: options?.enabled,
  });
};

/**
 * Hook to fetch categories by type
 */
export const useCategoriesByType = (
  type: ITEM_CATEGORY_TYPE,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) => {
  return useQuery({
    queryKey: itemCategoryKeys.byType(type),
    queryFn: () => getCategoriesByType(type),
    staleTime: options?.staleTime ?? 1000 * 60 * 10, // 10 minutes
    enabled: options?.enabled,
  });
};
