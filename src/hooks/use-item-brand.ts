// packages/hooks/src/useItemBrand.ts

import { useMutation } from "@tanstack/react-query";
import {
  createItemBrand,
  deleteItemBrand,
  getItemBrandById,
  getItemBrands,
  updateItemBrand,
  batchCreateItemBrands,
  batchUpdateItemBrands,
  batchDeleteItemBrands,
} from "../api-client";
import type {
  ItemBrandCreateFormData,
  ItemBrandUpdateFormData,
  ItemBrandGetManyFormData,
  ItemBrandBatchCreateFormData,
  ItemBrandBatchUpdateFormData,
  ItemBrandBatchDeleteFormData,
  ItemBrandInclude,
} from "../schemas";
import type {
  ItemBrandGetManyResponse,
  ItemBrandGetUniqueResponse,
  ItemBrandCreateResponse,
  ItemBrandUpdateResponse,
  ItemBrandDeleteResponse,
  ItemBrandBatchCreateResponse,
  ItemBrandBatchUpdateResponse,
  ItemBrandBatchDeleteResponse,
} from "../types";
import { itemBrandKeys, itemKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";

// =====================================================
// ItemBrand Service Adapter
// =====================================================

const itemBrandService = {
  getMany: (params: ItemBrandGetManyFormData) => getItemBrands(params || {}),
  getById: (id: string, params?: any) => getItemBrandById(id, params),
  create: (data: ItemBrandCreateFormData, include?: ItemBrandInclude) => createItemBrand(data, include ? { include } : undefined),
  update: (id: string, data: ItemBrandUpdateFormData, include?: ItemBrandInclude) => updateItemBrand(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteItemBrand(id),
  batchCreate: (data: ItemBrandBatchCreateFormData, include?: ItemBrandInclude) => batchCreateItemBrands(data, include ? { include } : undefined),
  batchUpdate: (data: ItemBrandBatchUpdateFormData, include?: ItemBrandInclude) => batchUpdateItemBrands(data, include ? { include } : undefined),
  batchDelete: (data: ItemBrandBatchDeleteFormData) => batchDeleteItemBrands(data),
};

// =====================================================
// Base ItemBrand Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ItemBrandGetManyFormData,
  ItemBrandGetManyResponse,
  ItemBrandGetUniqueResponse,
  ItemBrandCreateFormData,
  ItemBrandCreateResponse,
  ItemBrandUpdateFormData,
  ItemBrandUpdateResponse,
  ItemBrandDeleteResponse,
  ItemBrandBatchCreateFormData,
  ItemBrandBatchCreateResponse<ItemBrandCreateFormData>,
  ItemBrandBatchUpdateFormData,
  ItemBrandBatchUpdateResponse<ItemBrandUpdateFormData>,
  ItemBrandBatchDeleteFormData,
  ItemBrandBatchDeleteResponse
>({
  queryKeys: itemBrandKeys,
  service: itemBrandService,
  staleTime: 1000 * 60 * 10, // 10 minutes - brands don't change often
  relatedQueryKeys: [itemKeys], // Brands affect items
});

// Export base hooks with standard names
export const useItemBrandsInfinite = baseHooks.useInfiniteList;
export const useItemBrands = baseHooks.useList;
export const useItemBrand = baseHooks.useDetail;
export const useItemBrandMutations = baseHooks.useMutations;
export const useItemBrandBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hook with old name
export { useItemBrand as useItemBrandDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateItemBrand = () => {
  const { createMutation } = useItemBrandMutations();
  return createMutation;
};

export const useUpdateItemBrand = (id: string) => {
  const { updateMutation } = useItemBrandMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteItemBrand = () => {
  const { deleteMutation } = useItemBrandMutations();
  return deleteMutation;
};
