// packages/hooks/src/useItem.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createItem, deleteItem, getItemById, getItems, updateItem, batchCreateItems, batchUpdateItems, batchDeleteItems, mergeItems } from "../api-client";
import { ITEM_CATEGORY_TYPE } from "../constants";
import type {
  ItemCreateFormData,
  ItemUpdateFormData,
  ItemGetManyFormData,
  ItemBatchCreateFormData,
  ItemBatchUpdateFormData,
  ItemBatchDeleteFormData,
  ItemMergeFormData,
  ItemInclude,
} from "../schemas";
import type {
  ItemGetManyResponse,
  ItemGetUniqueResponse,
  ItemCreateResponse,
  ItemUpdateResponse,
  ItemDeleteResponse,
  ItemBatchCreateResponse,
  ItemBatchUpdateResponse,
  ItemBatchDeleteResponse,
} from "../types";
import {
  itemKeys,
  activityKeys,
  borrowKeys,
  orderItemKeys,
  ppeDeliveryKeys,
  paintFormulaComponentKeys,
  orderScheduleKeys,
  ppeDeliveryScheduleKeys,
  maintenanceKeys,
  maintenanceItemKeys,
  externalWithdrawalItemKeys,
  changeLogKeys,
} from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// Item Service Adapter
// =====================================================

const itemService = {
  getMany: (params?: ItemGetManyFormData) => {
    const paramsWithMeasures = {
      ...params,
      include: {
        measures: true,
        ...params?.include,
      },
    };
    return getItems(paramsWithMeasures);
  },
  getById: (id: string, params?: { include?: ItemInclude }) => {
    const includeWithMeasures = {
      measures: true,
      ...params?.include,
    };
    return getItemById(id, { include: includeWithMeasures });
  },
  create: (data: ItemCreateFormData, params?: { include?: ItemInclude }) => {
    const includeWithMeasures = {
      measures: true,
      ...params?.include,
    };
    return createItem(data, { include: includeWithMeasures });
  },
  update: (id: string, data: ItemUpdateFormData, params?: { include?: ItemInclude }) => {
    const includeWithMeasures = {
      measures: true,
      ...params?.include,
    };
    return updateItem(id, data, { include: includeWithMeasures });
  },
  delete: (id: string) => deleteItem(id),
  batchCreate: (data: ItemBatchCreateFormData, params?: { include?: ItemInclude }) => {
    const includeWithMeasures = {
      measures: true,
      ...params?.include,
    };
    return batchCreateItems(data, { include: includeWithMeasures });
  },
  batchUpdate: (data: ItemBatchUpdateFormData, params?: { include?: ItemInclude }) => {
    console.log("=== ITEM SERVICE ADAPTER DEBUGGING ===");
    console.log("Step 20 - Service adapter received data:", JSON.stringify(data, null, 2));
    console.log("Step 21 - Service adapter received params:", JSON.stringify(params, null, 2));

    const includeWithMeasures = {
      measures: true,
      ...params?.include,
    };

    console.log("Step 22 - Service adapter final include:", JSON.stringify(includeWithMeasures, null, 2));
    console.log("Step 23 - Calling batchUpdateItems...");

    return batchUpdateItems(data, { include: includeWithMeasures });
  },
  batchDelete: (data: ItemBatchDeleteFormData) => batchDeleteItems(data),
};

// =====================================================
// Base Item Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ItemGetManyFormData,
  ItemGetManyResponse,
  ItemGetUniqueResponse,
  ItemCreateFormData,
  ItemCreateResponse,
  ItemUpdateFormData,
  ItemUpdateResponse,
  ItemDeleteResponse,
  ItemBatchCreateFormData,
  ItemBatchCreateResponse<ItemCreateFormData>,
  ItemBatchUpdateFormData,
  ItemBatchUpdateResponse<ItemUpdateFormData>,
  ItemBatchDeleteFormData,
  ItemBatchDeleteResponse
>({
  queryKeys: itemKeys,
  service: itemService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [
    activityKeys,
    borrowKeys,
    orderItemKeys,
    ppeDeliveryKeys,
    paintFormulaComponentKeys,
    orderScheduleKeys,
    ppeDeliveryScheduleKeys,
    maintenanceKeys,
    maintenanceItemKeys,
    externalWithdrawalItemKeys,
    changeLogKeys,
  ], // Items affect many entities
});

// Export base hooks with standard names
export const useItemsInfinite = baseHooks.useInfiniteList;
export const useItems = baseHooks.useList;
export const useItem = baseHooks.useDetail;
export const useItemMutations = baseHooks.useMutations;
export const useItemBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Item Hooks
// =====================================================

// Hook for items by supplier
export const useItemsBySupplier = createSpecializedQueryHook<{ supplierId: string; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ supplierId, filters }) => itemKeys.bySupplier(supplierId, filters),
  queryFn: ({ supplierId, filters }) => getItems({ ...filters, where: { supplierId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for items by category
export const useItemsByCategory = createSpecializedQueryHook<{ categoryId: string; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ categoryId, filters }) => itemKeys.byCategory(categoryId, filters),
  queryFn: ({ categoryId, filters }) => getItems({ ...filters, where: { categoryId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for items by brand
export const useItemsByBrand = createSpecializedQueryHook<{ brandId: string; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ brandId, filters }) => itemKeys.byBrand(brandId, filters),
  queryFn: ({ brandId, filters }) => getItems({ ...filters, where: { brandId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for low stock items
export const useLowStockItems = createSpecializedQueryHook<Partial<ItemGetManyFormData>, ItemGetManyResponse>({
  queryKeyFn: (filters) => itemKeys.lowStock(filters),
  queryFn: (filters) => getItems({ ...filters, where: { ...filters?.where, quantity: { lte: 10 } } }), // Assuming low stock threshold
  staleTime: 1000 * 60 * 3, // 3 minutes - low stock is important
});

// Hook for PPE items only
export const usePpeItems = createSpecializedQueryHook<Partial<ItemGetManyFormData>, ItemGetManyResponse>({
  queryKeyFn: (filters) => itemKeys.ppe(filters),
  queryFn: (filters) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        category: {
          type: {
            equals: ITEM_CATEGORY_TYPE.PPE,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// Hook for PPE items by type
export const usePpeItemsByType = createSpecializedQueryHook<{ ppeType: string; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ ppeType, filters }) => itemKeys.ppeByType(ppeType, filters),
  queryFn: ({ ppeType, filters }) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        ppeType,
        category: {
          type: {
            equals: ITEM_CATEGORY_TYPE.PPE,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// Hook for PPE items by type and size
export const usePpeItemsByTypeAndSize = createSpecializedQueryHook<{ ppeType: string; ppeSize: string; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ ppeType, ppeSize, filters }) => itemKeys.ppeByTypeAndSize(ppeType, ppeSize, filters),
  queryFn: ({ ppeType, ppeSize, filters }) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        ppeType,
        ppeSize,
        category: {
          type: {
            equals: ITEM_CATEGORY_TYPE.PPE,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// Generic hook for items by category type
export const useItemsByType = createSpecializedQueryHook<{ type: ITEM_CATEGORY_TYPE; filters?: Partial<ItemGetManyFormData> }, ItemGetManyResponse>({
  queryKeyFn: ({ type, filters }) => itemKeys.byType(type, filters),
  queryFn: ({ type, filters }) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        category: {
          type: {
            equals: type,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// Hook for Tool items only
export const useToolItems = createSpecializedQueryHook<Partial<ItemGetManyFormData>, ItemGetManyResponse>({
  queryKeyFn: (filters) => itemKeys.byType("TOOL", filters),
  queryFn: (filters) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        category: {
          type: {
            equals: ITEM_CATEGORY_TYPE.TOOL,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// Hook for Regular items only
export const useRegularItems = createSpecializedQueryHook<Partial<ItemGetManyFormData>, ItemGetManyResponse>({
  queryKeyFn: (filters) => itemKeys.byType("REGULAR", filters),
  queryFn: (filters) =>
    getItems({
      ...filters,
      where: {
        ...filters?.where,
        category: {
          type: {
            equals: ITEM_CATEGORY_TYPE.REGULAR,
          },
        },
      },
    }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Item Merge Hook
// =====================================================

export function useItemMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ItemMergeFormData) => mergeItems(data),
    onSuccess: () => {
      // Invalidate item-related queries
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: borrowKeys.all });
      queryClient.invalidateQueries({ queryKey: orderItemKeys.all });
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.all });
      queryClient.invalidateQueries({ queryKey: paintFormulaComponentKeys.all });
      queryClient.invalidateQueries({ queryKey: orderScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: ppeDeliveryScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      queryClient.invalidateQueries({ queryKey: maintenanceItemKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalItemKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}
