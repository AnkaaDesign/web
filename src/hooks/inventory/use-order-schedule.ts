// packages/hooks/src/useOrderSchedule.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrderSchedules,
  getOrderSchedule,
  createOrderSchedule,
  updateOrderSchedule,
  deleteOrderSchedule,
  batchCreateOrderSchedules,
  batchUpdateOrderSchedules,
  batchDeleteOrderSchedules,
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
