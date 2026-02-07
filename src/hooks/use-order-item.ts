// packages/hooks/src/useOrderItem.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrderItems,
  getOrderItem,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
  batchCreateOrderItems,
  batchUpdateOrderItems,
  batchDeleteOrderItems,
  batchMarkOrderItemsFulfilled,
  batchMarkOrderItemsReceived,
} from "../api-client";
import type {
  OrderItemGetManyFormData,
  OrderItemCreateFormData,
  OrderItemUpdateFormData,
  OrderItemBatchCreateFormData,
  OrderItemBatchUpdateFormData,
  OrderItemBatchDeleteFormData,
} from "../schemas";
import type {
  OrderItemGetManyResponse,
  OrderItemGetUniqueResponse,
  OrderItemCreateResponse,
  OrderItemUpdateResponse,
  OrderItemDeleteResponse,
  OrderItemBatchCreateResponse,
  OrderItemBatchUpdateResponse,
  OrderItemBatchDeleteResponse,
} from "../types";
import { orderItemKeys, orderKeys, itemKeys, activityKeys, changeLogKeys } from "./query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "./create-entity-hooks";

// =====================================================
// OrderItem Service Adapter
// =====================================================

const orderItemService = {
  getMany: getOrderItems,
  getById: getOrderItem,
  create: createOrderItem,
  update: updateOrderItem,
  delete: deleteOrderItem,
  batchCreate: batchCreateOrderItems,
  batchUpdate: batchUpdateOrderItems,
  batchDelete: batchDeleteOrderItems,
};

// =====================================================
// Base OrderItem Hooks
// =====================================================

const baseOrderItemHooks = createEntityHooks<
  OrderItemGetManyFormData,
  OrderItemGetManyResponse,
  OrderItemGetUniqueResponse,
  OrderItemCreateFormData,
  OrderItemCreateResponse,
  OrderItemUpdateFormData,
  OrderItemUpdateResponse,
  OrderItemDeleteResponse,
  OrderItemBatchCreateFormData,
  OrderItemBatchCreateResponse<OrderItemCreateFormData>,
  OrderItemBatchUpdateFormData,
  OrderItemBatchUpdateResponse<OrderItemUpdateFormData>,
  OrderItemBatchDeleteFormData,
  OrderItemBatchDeleteResponse
>({
  queryKeys: orderItemKeys,
  service: orderItemService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [orderKeys, itemKeys, activityKeys, changeLogKeys], // Order items affect orders, items, activities, and changelogs
});

// Export base hooks with standard names
export const useOrderItemsInfinite = baseOrderItemHooks.useInfiniteList;
export const useOrderItems = baseOrderItemHooks.useList;
export const useOrderItem = baseOrderItemHooks.useDetail;

// =====================================================
// Specialized OrderItem Query Hooks
// =====================================================

// Order items by order
export const useOrderItemsByOrder = createSpecializedQueryHook<{ orderId: string; filters?: Partial<OrderItemGetManyFormData> }, OrderItemGetManyResponse>({
  queryKeyFn: ({ orderId, filters }) => orderItemKeys.byOrder(orderId, filters),
  queryFn: ({ orderId, filters }) => getOrderItems({ ...filters, orderIds: [orderId] }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Order items by item
export const useOrderItemsByItem = createSpecializedQueryHook<{ itemId: string; filters?: Partial<OrderItemGetManyFormData> }, OrderItemGetManyResponse>({
  queryKeyFn: ({ itemId, filters }) => orderItemKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) => getOrderItems({ ...filters, itemIds: [itemId] }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// =====================================================
// Custom OrderItem Mutations with Enhanced Invalidation
// =====================================================

export const useOrderItemMutations = (options?: {
  onCreateSuccess?: (data: OrderItemCreateResponse, variables: OrderItemCreateFormData) => void;
  onUpdateSuccess?: (data: OrderItemUpdateResponse, variables: { id: string; data: OrderItemUpdateFormData }) => void;
  onDeleteSuccess?: (data: OrderItemDeleteResponse, variables: string) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = (orderId?: string, itemId?: string) => {
    // Invalidate order item queries
    queryClient.invalidateQueries({
      queryKey: orderItemKeys.all,
    });

    // Invalidate order queries
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
    if (orderId) {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(orderId),
      });
    }

    // Invalidate item queries
    queryClient.invalidateQueries({
      queryKey: itemKeys.all,
    });
    if (itemId) {
      queryClient.invalidateQueries({
        queryKey: itemKeys.detail(itemId),
      });
    }

    // Invalidate activity queries
    queryClient.invalidateQueries({
      queryKey: activityKeys.all,
    });
  };

  // CREATE
  const createMutation = useMutation({
    mutationFn: (data: OrderItemCreateFormData) => createOrderItem(data),
    onSuccess: (data, variables) => {
      invalidateQueries(data.data?.orderId, data.data?.itemId);
      options?.onCreateSuccess?.(data, variables);
    },
  });

  // UPDATE
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderItemUpdateFormData }) => updateOrderItem(id, data),
    onSuccess: (data, variables) => {
      invalidateQueries(data.data?.orderId, data.data?.itemId);

      // If received quantity changed, invalidate additional queries
      if (data.data?.receivedQuantity !== undefined) {
        queryClient.invalidateQueries({
          queryKey: activityKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: itemKeys.all,
        });
      }

      options?.onUpdateSuccess?.(data, variables);
    },
  });

  // DELETE
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrderItem(id),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onDeleteSuccess?.(data, variables);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const error = createMutation.error || updateMutation.error || deleteMutation.error;

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    isLoading,
    error,
    refresh: () => invalidateQueries(),
    // Individual mutation states
    createMutation,
    updateMutation,
    deleteMutation,
  };
};

export const useOrderItemBatchMutations = (options?: {
  onBatchCreateSuccess?: (data: OrderItemBatchCreateResponse<OrderItemCreateFormData>, variables: OrderItemBatchCreateFormData) => void;
  onBatchUpdateSuccess?: (data: OrderItemBatchUpdateResponse<OrderItemUpdateFormData>, variables: OrderItemBatchUpdateFormData) => void;
  onBatchDeleteSuccess?: (data: OrderItemBatchDeleteResponse, variables: OrderItemBatchDeleteFormData) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: orderItemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: itemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: activityKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: changeLogKeys.all,
    });
  };

  // BATCH CREATE
  const batchCreateMutation = useMutation({
    mutationFn: (data: OrderItemBatchCreateFormData) => batchCreateOrderItems(data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchCreateSuccess?.(data, variables);
    },
  });

  // BATCH UPDATE
  const batchUpdateMutation = useMutation({
    mutationFn: (data: OrderItemBatchUpdateFormData) => batchUpdateOrderItems(data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchUpdateSuccess?.(data, variables);
    },
  });

  // BATCH DELETE
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteOrderItems,
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchDeleteSuccess?.(data, variables);
    },
  });

  const isLoading = batchCreateMutation.isPending || batchUpdateMutation.isPending || batchDeleteMutation.isPending;

  const error = batchCreateMutation.error || batchUpdateMutation.error || batchDeleteMutation.error;

  return {
    batchCreate: batchCreateMutation.mutate,
    batchCreateAsync: batchCreateMutation.mutateAsync,
    batchUpdate: batchUpdateMutation.mutate,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchDelete: batchDeleteMutation.mutate,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
    isLoading,
    error,
    refresh: invalidateQueries,
    // Individual mutation states
    batchCreateMutation,
    batchUpdateMutation,
    batchDeleteMutation,
  };
};

// =====================================================
// Specialized Batch Operations
// =====================================================

export const useOrderItemSpecializedBatchMutations = (options?: {
  onMarkFulfilledSuccess?: (data: OrderItemBatchUpdateResponse<OrderItemUpdateFormData>, variables: string[]) => void;
  onMarkReceivedSuccess?: (data: OrderItemBatchUpdateResponse<OrderItemUpdateFormData>, variables: Array<{ id: string; receivedQuantity: number }>) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: orderItemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: itemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: activityKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: changeLogKeys.all,
    });
  };

  // BATCH MARK FULFILLED
  const markFulfilledMutation = useMutation({
    mutationFn: (ids: string[]) => batchMarkOrderItemsFulfilled(ids),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onMarkFulfilledSuccess?.(data, variables);
    },
  });

  // BATCH MARK RECEIVED
  const markReceivedMutation = useMutation({
    mutationFn: (items: Array<{ id: string; receivedQuantity: number }>) => batchMarkOrderItemsReceived(items),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onMarkReceivedSuccess?.(data, variables);
    },
  });

  const isLoading = markFulfilledMutation.isPending || markReceivedMutation.isPending;
  const error = markFulfilledMutation.error || markReceivedMutation.error;

  return {
    markFulfilled: markFulfilledMutation.mutate,
    markFulfilledAsync: markFulfilledMutation.mutateAsync,
    markReceived: markReceivedMutation.mutate,
    markReceivedAsync: markReceivedMutation.mutateAsync,
    isLoading,
    error,
    refresh: invalidateQueries,
    // Individual mutation states
    markFulfilledMutation,
    markReceivedMutation,
  };
};

// =====================================================
// Backward Compatibility Exports
// =====================================================

export const useCreateOrderItem = () => {
  const mutations = useOrderItemMutations();
  return {
    ...mutations.createMutation,
    mutate: mutations.create,
    mutateAsync: mutations.createAsync,
  };
};

export const useUpdateOrderItem = (id: string) => {
  const mutations = useOrderItemMutations();
  return {
    mutate: (data: OrderItemUpdateFormData) => mutations.update({ id, data }),
    mutateAsync: (data: OrderItemUpdateFormData) => mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeleteOrderItem = () => {
  const mutations = useOrderItemMutations();
  return {
    ...mutations.deleteMutation,
    mutate: mutations.delete,
    mutateAsync: mutations.deleteAsync,
  };
};
