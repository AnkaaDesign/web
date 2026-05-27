// packages/hooks/src/useOrderSchedule.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import {
  getOrderSchedules,
  getOrderSchedule,
  createOrderSchedule,
  updateOrderSchedule,
  deleteOrderSchedule,
  batchCreateOrderSchedules,
  batchUpdateOrderSchedules,
  batchDeleteOrderSchedules,
  finishOrderSchedule,
  createOrderFromSchedule,
  getOrderScheduleProjection,
  triggerOrderSchedule,
  getOrderScheduleExpectedTotals,
} from "../../api-client";
import type {
  OrderScheduleGetManyFormData,
  OrderScheduleCreateFormData,
  OrderScheduleUpdateFormData,
  OrderScheduleBatchCreateFormData,
  OrderScheduleBatchUpdateFormData,
  OrderScheduleBatchDeleteFormData,
} from "../../schemas";
import type {
  OrderScheduleGetManyResponse,
  OrderScheduleGetUniqueResponse,
  OrderScheduleCreateResponse,
  OrderScheduleUpdateResponse,
  OrderScheduleDeleteResponse,
  OrderScheduleBatchCreateResponse,
  OrderScheduleBatchUpdateResponse,
  OrderScheduleBatchDeleteResponse,
  OrderScheduleProjectionResponse,
  OrderScheduleTriggerResponse,
  OrderScheduleExpectedTotalsResponse,
  OrderScheduleCascadeMode,
} from "../../types";
import { orderScheduleKeys, orderKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// OrderSchedule Service Adapter
// =====================================================

const orderScheduleService = {
  getMany: getOrderSchedules,
  getById: getOrderSchedule,
  create: createOrderSchedule,
  update: updateOrderSchedule,
  delete: deleteOrderSchedule,
  batchCreate: batchCreateOrderSchedules,
  batchUpdate: batchUpdateOrderSchedules,
  batchDelete: batchDeleteOrderSchedules,
};

// =====================================================
// Base OrderSchedule Hooks
// =====================================================

const baseOrderScheduleHooks = createEntityHooks<
  OrderScheduleGetManyFormData,
  OrderScheduleGetManyResponse,
  OrderScheduleGetUniqueResponse,
  OrderScheduleCreateFormData,
  OrderScheduleCreateResponse,
  OrderScheduleUpdateFormData,
  OrderScheduleUpdateResponse,
  OrderScheduleDeleteResponse,
  OrderScheduleBatchCreateFormData,
  OrderScheduleBatchCreateResponse<OrderScheduleCreateFormData>,
  OrderScheduleBatchUpdateFormData,
  OrderScheduleBatchUpdateResponse<OrderScheduleUpdateFormData>,
  OrderScheduleBatchDeleteFormData,
  OrderScheduleBatchDeleteResponse
>({
  queryKeys: orderScheduleKeys,
  service: orderScheduleService,
  staleTime: 1000 * 60 * 10, // 10 minutes - schedules don't change often
  relatedQueryKeys: [orderKeys], // Order schedules affect orders
});

// Export base hooks with standard names
export const useOrderSchedulesInfinite = baseOrderScheduleHooks.useInfiniteList;
export const useOrderSchedules = baseOrderScheduleHooks.useList;
export const useOrderSchedule = baseOrderScheduleHooks.useDetail;

// =====================================================
// Specialized OrderSchedule Query Hooks
// =====================================================

// Active order schedules
export const useActiveOrderSchedules = createSpecializedQueryHook<Partial<OrderScheduleGetManyFormData>, OrderScheduleGetManyResponse>({
  queryKeyFn: (filters) => orderScheduleKeys.active(filters),
  queryFn: (filters) => getOrderSchedules({ ...filters, isActive: true }),
  staleTime: 1000 * 60 * 10, // 10 minutes
});

// Inactive order schedules
export const useInactiveOrderSchedules = createSpecializedQueryHook<Partial<OrderScheduleGetManyFormData>, OrderScheduleGetManyResponse>({
  queryKeyFn: (filters) => orderScheduleKeys.inactive(filters),
  queryFn: (filters) => getOrderSchedules({ ...filters, isActive: false }),
  staleTime: 1000 * 60 * 10, // 10 minutes
});

// =====================================================
// Custom OrderSchedule Mutations with Enhanced Invalidation
// =====================================================

export const useOrderScheduleMutations = (options?: {
  onCreateSuccess?: (data: OrderScheduleCreateResponse, variables: OrderScheduleCreateFormData) => void;
  onUpdateSuccess?: (data: OrderScheduleUpdateResponse, variables: { id: string; data: OrderScheduleUpdateFormData }) => void;
  onDeleteSuccess?: (data: OrderScheduleDeleteResponse, variables: string) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    // Invalidate order schedule queries
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.all,
    });

    // Invalidate active schedules
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.active(),
    });

    // Invalidate inactive schedules
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.inactive(),
    });

    // Invalidate order queries
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
  };

  // CREATE
  const createMutation = useMutation({
    mutationFn: (data: OrderScheduleCreateFormData) => createOrderSchedule(data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onCreateSuccess?.(data, variables);
    },
  });

  // UPDATE
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderScheduleUpdateFormData }) => updateOrderSchedule(id, data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onUpdateSuccess?.(data, variables);
    },
  });

  // DELETE
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrderSchedule(id),
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

export const useOrderScheduleBatchMutations = (options?: {
  onBatchCreateSuccess?: (data: OrderScheduleBatchCreateResponse<OrderScheduleCreateFormData>, variables: OrderScheduleBatchCreateFormData) => void;
  onBatchUpdateSuccess?: (data: OrderScheduleBatchUpdateResponse<OrderScheduleUpdateFormData>, variables: OrderScheduleBatchUpdateFormData) => void;
  onBatchDeleteSuccess?: (data: OrderScheduleBatchDeleteResponse, variables: OrderScheduleBatchDeleteFormData) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.active(),
    });
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.inactive(),
    });
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
  };

  // BATCH CREATE
  const batchCreateMutation = useMutation({
    mutationFn: (data: OrderScheduleBatchCreateFormData) => batchCreateOrderSchedules(data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchCreateSuccess?.(data, variables);
    },
  });

  // BATCH UPDATE
  const batchUpdateMutation = useMutation({
    mutationFn: (data: OrderScheduleBatchUpdateFormData) => batchUpdateOrderSchedules(data),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchUpdateSuccess?.(data, variables);
    },
  });

  // BATCH DELETE
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteOrderSchedules,
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
// Backward Compatibility Exports
// =====================================================

export const useCreateOrderSchedule = () => {
  const mutations = useOrderScheduleMutations();
  return {
    ...mutations.createMutation,
    mutate: mutations.create,
    mutateAsync: mutations.createAsync,
  };
};

export const useUpdateOrderSchedule = (id: string) => {
  const mutations = useOrderScheduleMutations();
  return {
    mutate: (data: OrderScheduleUpdateFormData) => mutations.update({ id, data }),
    mutateAsync: (data: OrderScheduleUpdateFormData) => mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeleteOrderSchedule = () => {
  const mutations = useOrderScheduleMutations();
  return {
    ...mutations.deleteMutation,
    mutate: mutations.delete,
    mutateAsync: mutations.deleteAsync,
  };
};

// =====================================================
// Schedule Action Hooks
// =====================================================

export const useFinishOrderSchedule = (options?: {
  onSuccess?: (data: OrderScheduleUpdateResponse) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => finishOrderSchedule(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: orderScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      options?.onSuccess?.(data);
    },
  });
};

export const useCreateOrderFromSchedule = (options?: {
  onSuccess?: (data: any) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => createOrderFromSchedule(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: orderScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      options?.onSuccess?.(data);
    },
  });
};

// =====================================================
// Projection & Trigger Hooks
// =====================================================

export const useOrderScheduleProjection = (
  id: string,
  options?: { enabled?: boolean } & Omit<UseQueryOptions<OrderScheduleProjectionResponse>, "queryKey" | "queryFn">,
) => {
  const { enabled = true, ...queryOptions } = options || {};

  return useQuery<OrderScheduleProjectionResponse>({
    queryKey: [...orderScheduleKeys.detail(id), "projection"],
    queryFn: () => getOrderScheduleProjection(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...queryOptions,
  });
};

/**
 * Batch lookup of the projected total order cost for each schedule when it next
 * fires on its scheduled date. Issues a SINGLE POST for all provided ids.
 * Disabled when there are no ids. Toast is suppressed (read-only request).
 */
export const useOrderScheduleExpectedTotals = (
  scheduleIds: string[],
  options?: { enabled?: boolean } & Omit<UseQueryOptions<OrderScheduleExpectedTotalsResponse>, "queryKey" | "queryFn">,
) => {
  const { enabled = true, ...queryOptions } = options || {};
  // Stable key regardless of input order — the visible ids are the same set.
  const sortedIds = [...scheduleIds].sort();

  return useQuery<OrderScheduleExpectedTotalsResponse>({
    queryKey: [...orderScheduleKeys.all, "expected-totals", sortedIds],
    queryFn: () => getOrderScheduleExpectedTotals(scheduleIds, { suppressToast: true }),
    enabled: enabled && scheduleIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...queryOptions,
  });
};

export const useTriggerOrderSchedule = (options?: {
  onSuccess?: (data: OrderScheduleTriggerResponse, variables: { id: string; cascadeMode: OrderScheduleCascadeMode }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    // Suppress the interceptor's auto-toast: the caller shows its own contextual
    // toast (differentiating "order created → navigate" vs "nothing to order").
    mutationFn: ({ id, cascadeMode }: { id: string; cascadeMode: OrderScheduleCascadeMode }) =>
      triggerOrderSchedule(id, { cascadeMode }, { suppressToast: true }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: orderScheduleKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: [...orderScheduleKeys.detail(variables.id), "projection"] });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      options?.onSuccess?.(data, variables);
    },
  });
};
