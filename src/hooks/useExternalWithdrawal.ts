// packages/hooks/src/useExternalWithdrawal.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  // ExternalWithdrawal functions
  getExternalWithdrawals,
  getExternalWithdrawalById,
  createExternalWithdrawal,
  updateExternalWithdrawal,
  deleteExternalWithdrawal,
  batchCreateExternalWithdrawals,
  batchUpdateExternalWithdrawals,
  batchDeleteExternalWithdrawals,
  // Status transition functions
  markExternalWithdrawalAsPartiallyReturned,
  markExternalWithdrawalAsFullyReturned,
  markExternalWithdrawalAsCharged,
  markExternalWithdrawalAsLiquidated,
  markExternalWithdrawalAsDelivered,
  cancelExternalWithdrawal,
  // ExternalWithdrawalItem functions
  getExternalWithdrawalItems,
  getExternalWithdrawalItemById,
  createExternalWithdrawalItem,
  updateExternalWithdrawalItem,
  deleteExternalWithdrawalItem,
  batchCreateExternalWithdrawalItems,
  batchUpdateExternalWithdrawalItems,
  batchDeleteExternalWithdrawalItems,
} from "../api-client";
import type {
  // ExternalWithdrawal types
  ExternalWithdrawalGetManyFormData,
  ExternalWithdrawalCreateFormData,
  ExternalWithdrawalUpdateFormData,
  ExternalWithdrawalBatchCreateFormData,
  ExternalWithdrawalBatchUpdateFormData,
  ExternalWithdrawalBatchDeleteFormData,
  ExternalWithdrawalInclude,
  // ExternalWithdrawalItem types
  ExternalWithdrawalItemGetManyFormData,
  ExternalWithdrawalItemCreateFormData,
  ExternalWithdrawalItemUpdateFormData,
  ExternalWithdrawalItemBatchCreateFormData,
  ExternalWithdrawalItemBatchUpdateFormData,
  ExternalWithdrawalItemBatchDeleteFormData,
  ExternalWithdrawalItemInclude,
} from "../schemas";
import type {
  // ExternalWithdrawal Interface types
  ExternalWithdrawalGetUniqueResponse,
  ExternalWithdrawalGetManyResponse,
  ExternalWithdrawalCreateResponse,
  ExternalWithdrawalUpdateResponse,
  ExternalWithdrawalDeleteResponse,
  ExternalWithdrawalBatchCreateResponse,
  ExternalWithdrawalBatchUpdateResponse,
  ExternalWithdrawalBatchDeleteResponse,
  // ExternalWithdrawalItem Interface types
  ExternalWithdrawalItemGetUniqueResponse,
  ExternalWithdrawalItemGetManyResponse,
  ExternalWithdrawalItemCreateResponse,
  ExternalWithdrawalItemUpdateResponse,
  ExternalWithdrawalItemDeleteResponse,
  ExternalWithdrawalItemBatchCreateResponse,
  ExternalWithdrawalItemBatchUpdateResponse,
  ExternalWithdrawalItemBatchDeleteResponse,
} from "../types";
import { externalWithdrawalKeys, externalWithdrawalItemKeys, itemKeys, activityKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// ExternalWithdrawal Service Adapter
// =====================================================

const externalWithdrawalService = {
  getMany: (params: ExternalWithdrawalGetManyFormData) => getExternalWithdrawals(params || {}),
  getById: (id: string, params?: any) => getExternalWithdrawalById(id, params),
  create: (data: ExternalWithdrawalCreateFormData, include?: ExternalWithdrawalInclude) => createExternalWithdrawal(data, include ? { include } : undefined),
  update: (id: string, data: ExternalWithdrawalUpdateFormData, include?: ExternalWithdrawalInclude) => updateExternalWithdrawal(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteExternalWithdrawal(id),
  batchCreate: (data: ExternalWithdrawalBatchCreateFormData, include?: ExternalWithdrawalInclude) => batchCreateExternalWithdrawals(data, include ? { include } : undefined),
  batchUpdate: (data: ExternalWithdrawalBatchUpdateFormData, include?: ExternalWithdrawalInclude) => batchUpdateExternalWithdrawals(data, include ? { include } : undefined),
  batchDelete: (data: ExternalWithdrawalBatchDeleteFormData) => batchDeleteExternalWithdrawals(data),
};

// =====================================================
// Base ExternalWithdrawal Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ExternalWithdrawalGetManyFormData,
  ExternalWithdrawalGetManyResponse,
  ExternalWithdrawalGetUniqueResponse,
  ExternalWithdrawalCreateFormData,
  ExternalWithdrawalCreateResponse,
  ExternalWithdrawalUpdateFormData,
  ExternalWithdrawalUpdateResponse,
  ExternalWithdrawalDeleteResponse,
  ExternalWithdrawalBatchCreateFormData,
  ExternalWithdrawalBatchCreateResponse<ExternalWithdrawalCreateFormData>,
  ExternalWithdrawalBatchUpdateFormData,
  ExternalWithdrawalBatchUpdateResponse<ExternalWithdrawalUpdateFormData>,
  ExternalWithdrawalBatchDeleteFormData,
  ExternalWithdrawalBatchDeleteResponse
>({
  queryKeys: externalWithdrawalKeys,
  service: externalWithdrawalService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [itemKeys, activityKeys, externalWithdrawalItemKeys, changeLogKeys], // External withdrawals affect items, activities, their items, and changelog
});

// Export base hooks with standard names
export const useExternalWithdrawalsInfinite = baseHooks.useInfiniteList;
export const useExternalWithdrawals = baseHooks.useList;
export const useExternalWithdrawal = baseHooks.useDetail;
export const useExternalWithdrawalMutations = baseHooks.useMutations;
export const useExternalWithdrawalBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// ExternalWithdrawalItem Service Adapter
// =====================================================

const externalWithdrawalItemService = {
  getMany: (params: ExternalWithdrawalItemGetManyFormData) => getExternalWithdrawalItems(params || {}),
  getById: (id: string, params?: any) => getExternalWithdrawalItemById(id, params),
  create: (data: ExternalWithdrawalItemCreateFormData, include?: ExternalWithdrawalItemInclude) => createExternalWithdrawalItem(data, include ? { include } : undefined),
  update: (id: string, data: ExternalWithdrawalItemUpdateFormData, include?: ExternalWithdrawalItemInclude) =>
    updateExternalWithdrawalItem(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteExternalWithdrawalItem(id),
  batchCreate: (data: ExternalWithdrawalItemBatchCreateFormData, include?: ExternalWithdrawalItemInclude) =>
    batchCreateExternalWithdrawalItems(data, include ? { include } : undefined),
  batchUpdate: (data: ExternalWithdrawalItemBatchUpdateFormData, include?: ExternalWithdrawalItemInclude) =>
    batchUpdateExternalWithdrawalItems(data, include ? { include } : undefined),
  batchDelete: (data: ExternalWithdrawalItemBatchDeleteFormData) => batchDeleteExternalWithdrawalItems(data),
};

// =====================================================
// Base ExternalWithdrawalItem Hooks
// =====================================================

const baseItemHooks = createEntityHooks<
  ExternalWithdrawalItemGetManyFormData,
  ExternalWithdrawalItemGetManyResponse,
  ExternalWithdrawalItemGetUniqueResponse,
  ExternalWithdrawalItemCreateFormData,
  ExternalWithdrawalItemCreateResponse,
  ExternalWithdrawalItemUpdateFormData,
  ExternalWithdrawalItemUpdateResponse,
  ExternalWithdrawalItemDeleteResponse,
  ExternalWithdrawalItemBatchCreateFormData,
  ExternalWithdrawalItemBatchCreateResponse<ExternalWithdrawalItemCreateFormData>,
  ExternalWithdrawalItemBatchUpdateFormData,
  ExternalWithdrawalItemBatchUpdateResponse<ExternalWithdrawalItemUpdateFormData>,
  ExternalWithdrawalItemBatchDeleteFormData,
  ExternalWithdrawalItemBatchDeleteResponse
>({
  queryKeys: externalWithdrawalItemKeys,
  service: externalWithdrawalItemService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [externalWithdrawalKeys, itemKeys, changeLogKeys], // Items affect withdrawals, inventory, and changelog
});

// Export base hooks with standard names
export const useExternalWithdrawalItemsInfinite = baseItemHooks.useInfiniteList;
export const useExternalWithdrawalItems = baseItemHooks.useList;
export const useExternalWithdrawalItem = baseItemHooks.useDetail;
export const useExternalWithdrawalItemMutations = baseItemHooks.useMutations;
export const useExternalWithdrawalItemBatchMutations = baseItemHooks.useBatchMutations;

// =====================================================
// Specialized ExternalWithdrawalItem Hooks
// =====================================================

// Hook for items by withdrawal
export const useExternalWithdrawalItemsByWithdrawal = createSpecializedQueryHook<
  { withdrawalId: string; filters?: Partial<ExternalWithdrawalItemGetManyFormData> },
  ExternalWithdrawalItemGetManyResponse
>({
  queryKeyFn: ({ withdrawalId, filters }) => externalWithdrawalItemKeys.byWithdrawal(withdrawalId, filters),
  queryFn: ({ withdrawalId, filters }) => getExternalWithdrawalItems({ ...filters, where: { externalWithdrawalId: withdrawalId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for items by item
export const useExternalWithdrawalItemsByItem = createSpecializedQueryHook<
  { itemId: string; filters?: Partial<ExternalWithdrawalItemGetManyFormData> },
  ExternalWithdrawalItemGetManyResponse
>({
  queryKeyFn: ({ itemId, filters }) => externalWithdrawalItemKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) => getExternalWithdrawalItems({ ...filters, where: { itemId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hooks with old names
export { useExternalWithdrawal as useExternalWithdrawalDetail };
export { useExternalWithdrawalItem as useExternalWithdrawalItemDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateExternalWithdrawal = () => {
  const { createMutation } = useExternalWithdrawalMutations();
  return createMutation;
};

export const useUpdateExternalWithdrawal = (id: string) => {
  const { updateMutation } = useExternalWithdrawalMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteExternalWithdrawal = () => {
  const { deleteMutation } = useExternalWithdrawalMutations();
  return deleteMutation;
};

export function useBatchCreateExternalWithdrawals() {
  const { batchCreateAsync } = useExternalWithdrawalBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateExternalWithdrawals() {
  const { batchUpdateAsync } = useExternalWithdrawalBatchMutations();
  return useMutation({
    mutationFn: batchUpdateAsync,
  });
}

export function useBatchDeleteExternalWithdrawals() {
  const { batchDeleteAsync } = useExternalWithdrawalBatchMutations();
  return useMutation({
    mutationFn: (data: ExternalWithdrawalBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// ExternalWithdrawalItem legacy hooks
export const useCreateExternalWithdrawalItem = () => {
  const { createMutation } = useExternalWithdrawalItemMutations();
  return createMutation;
};

export const useUpdateExternalWithdrawalItem = (id: string) => {
  const { updateMutation } = useExternalWithdrawalItemMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteExternalWithdrawalItem = () => {
  const { deleteMutation } = useExternalWithdrawalItemMutations();
  return deleteMutation;
};

export function useBatchCreateExternalWithdrawalItems() {
  const { batchCreateAsync } = useExternalWithdrawalItemBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateExternalWithdrawalItems() {
  const { batchUpdateAsync } = useExternalWithdrawalItemBatchMutations();
  return useMutation({
    mutationFn: (data: any) => {
      // Fix array serialization issue at the hook level
      let fixedData = data;
      if (data.externalWithdrawalItems && typeof data.externalWithdrawalItems === "object" && !Array.isArray(data.externalWithdrawalItems)) {
        console.log("[Hook] Converting externalWithdrawalItems from object to array");
        fixedData = {
          ...data,
          externalWithdrawalItems: Object.values(data.externalWithdrawalItems),
        };
      }
      return batchUpdateAsync(fixedData);
    },
  });
}

export function useBatchDeleteExternalWithdrawalItems() {
  const { batchDeleteAsync } = useExternalWithdrawalItemBatchMutations();
  return useMutation({
    mutationFn: (data: ExternalWithdrawalItemBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// =====================================================
// Status Transition Hooks (Devolution/Charging Workflow)
// =====================================================

export function useExternalWithdrawalStatusMutations() {
  const queryClient = useQueryClient();

  const markAsPartiallyReturnedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalWithdrawalAsPartiallyReturned(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsFullyReturnedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalWithdrawalAsFullyReturned(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsChargedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalWithdrawalAsCharged(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsLiquidatedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalWithdrawalAsLiquidated(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsDeliveredMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalWithdrawalAsDelivered(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalWithdrawalUpdateFormData, "notes">; queryParams?: any }) =>
      cancelExternalWithdrawal(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: externalWithdrawalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  return {
    markAsPartiallyReturned: markAsPartiallyReturnedMutation,
    markAsFullyReturned: markAsFullyReturnedMutation,
    markAsCharged: markAsChargedMutation,
    markAsLiquidated: markAsLiquidatedMutation,
    markAsDelivered: markAsDeliveredMutation,
    cancel: cancelMutation,
  };
}

// Individual status transition hooks for legacy compatibility
export function useMarkExternalWithdrawalAsPartiallyReturned() {
  const { markAsPartiallyReturned } = useExternalWithdrawalStatusMutations();
  return markAsPartiallyReturned;
}

export function useMarkExternalWithdrawalAsFullyReturned() {
  const { markAsFullyReturned } = useExternalWithdrawalStatusMutations();
  return markAsFullyReturned;
}

export function useMarkExternalWithdrawalAsCharged() {
  const { markAsCharged } = useExternalWithdrawalStatusMutations();
  return markAsCharged;
}

export function useMarkExternalWithdrawalAsLiquidated() {
  const { markAsLiquidated } = useExternalWithdrawalStatusMutations();
  return markAsLiquidated;
}

export function useMarkExternalWithdrawalAsDelivered() {
  const { markAsDelivered } = useExternalWithdrawalStatusMutations();
  return markAsDelivered;
}

export function useCancelExternalWithdrawal() {
  const { cancel } = useExternalWithdrawalStatusMutations();
  return cancel;
}
