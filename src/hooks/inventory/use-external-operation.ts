// packages/hooks/src/useExternalOperation.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  // ExternalOperation functions
  getExternalOperations,
  getExternalOperationById,
  createExternalOperation,
  updateExternalOperation,
  deleteExternalOperation,
  batchCreateExternalOperations,
  batchUpdateExternalOperations,
  batchDeleteExternalOperations,
  // Status transition functions
  markExternalOperationAsPartiallyReturned,
  markExternalOperationAsFullyReturned,
  markExternalOperationAsCharged,
  markExternalOperationAsLiquidated,
  markExternalOperationAsDelivered,
  cancelExternalOperation,
  generateExternalOperationBilling,
  // ExternalOperationItem functions
  getExternalOperationItems,
  getExternalOperationItemById,
  createExternalOperationItem,
  updateExternalOperationItem,
  deleteExternalOperationItem,
  batchCreateExternalOperationItems,
  batchUpdateExternalOperationItems,
  batchDeleteExternalOperationItems,
} from "../../api-client";
import type {
  // ExternalOperation types
  ExternalOperationGetManyFormData,
  ExternalOperationCreateFormData,
  ExternalOperationUpdateFormData,
  ExternalOperationBatchCreateFormData,
  ExternalOperationBatchUpdateFormData,
  ExternalOperationBatchDeleteFormData,
  ExternalOperationInclude,
  // ExternalOperationItem types
  ExternalOperationItemGetManyFormData,
  ExternalOperationItemCreateFormData,
  ExternalOperationItemUpdateFormData,
  ExternalOperationItemBatchCreateFormData,
  ExternalOperationItemBatchUpdateFormData,
  ExternalOperationItemBatchDeleteFormData,
  ExternalOperationItemInclude,
} from "../../schemas";
import type {
  // ExternalOperation Interface types
  ExternalOperationGetUniqueResponse,
  ExternalOperationGetManyResponse,
  ExternalOperationCreateResponse,
  ExternalOperationUpdateResponse,
  ExternalOperationDeleteResponse,
  ExternalOperationBatchCreateResponse,
  ExternalOperationBatchUpdateResponse,
  ExternalOperationBatchDeleteResponse,
  // ExternalOperationItem Interface types
  ExternalOperationItemGetUniqueResponse,
  ExternalOperationItemGetManyResponse,
  ExternalOperationItemCreateResponse,
  ExternalOperationItemUpdateResponse,
  ExternalOperationItemDeleteResponse,
  ExternalOperationItemBatchCreateResponse,
  ExternalOperationItemBatchUpdateResponse,
  ExternalOperationItemBatchDeleteResponse,
} from "../../types";
import { externalOperationKeys, externalOperationItemKeys, itemKeys, activityKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// ExternalOperation Service Adapter
// =====================================================

const externalOperationService = {
  getMany: (params: ExternalOperationGetManyFormData) => getExternalOperations(params || {}),
  getById: (id: string, params?: any) => getExternalOperationById(id, params),
  create: (data: ExternalOperationCreateFormData, include?: ExternalOperationInclude) => createExternalOperation(data, include ? { include } : undefined),
  update: (id: string, data: ExternalOperationUpdateFormData, include?: ExternalOperationInclude) => updateExternalOperation(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteExternalOperation(id),
  batchCreate: (data: ExternalOperationBatchCreateFormData, include?: ExternalOperationInclude) => batchCreateExternalOperations(data, include ? { include } : undefined),
  batchUpdate: (data: ExternalOperationBatchUpdateFormData, include?: ExternalOperationInclude) => batchUpdateExternalOperations(data, include ? { include } : undefined),
  batchDelete: (data: ExternalOperationBatchDeleteFormData) => batchDeleteExternalOperations(data),
};

// =====================================================
// Base ExternalOperation Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ExternalOperationGetManyFormData,
  ExternalOperationGetManyResponse,
  ExternalOperationGetUniqueResponse,
  ExternalOperationCreateFormData,
  ExternalOperationCreateResponse,
  ExternalOperationUpdateFormData,
  ExternalOperationUpdateResponse,
  ExternalOperationDeleteResponse,
  ExternalOperationBatchCreateFormData,
  ExternalOperationBatchCreateResponse<ExternalOperationCreateFormData>,
  ExternalOperationBatchUpdateFormData,
  ExternalOperationBatchUpdateResponse<ExternalOperationUpdateFormData>,
  ExternalOperationBatchDeleteFormData,
  ExternalOperationBatchDeleteResponse
>({
  queryKeys: externalOperationKeys,
  service: externalOperationService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [itemKeys, activityKeys, externalOperationItemKeys, changeLogKeys], // External withdrawals affect items, activities, their items, and changelog
});

// Export base hooks with standard names
export const useExternalOperationsInfinite = baseHooks.useInfiniteList;
export const useExternalOperations = baseHooks.useList;
export const useExternalOperation = baseHooks.useDetail;
export const useExternalOperationMutations = baseHooks.useMutations;
export const useExternalOperationBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// ExternalOperationItem Service Adapter
// =====================================================

const externalOperationItemService = {
  getMany: (params: ExternalOperationItemGetManyFormData) => getExternalOperationItems(params || {}),
  getById: (id: string, params?: any) => getExternalOperationItemById(id, params),
  create: (data: ExternalOperationItemCreateFormData, include?: ExternalOperationItemInclude) => createExternalOperationItem(data, include ? { include } : undefined),
  update: (id: string, data: ExternalOperationItemUpdateFormData, include?: ExternalOperationItemInclude) =>
    updateExternalOperationItem(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteExternalOperationItem(id),
  batchCreate: (data: ExternalOperationItemBatchCreateFormData, include?: ExternalOperationItemInclude) =>
    batchCreateExternalOperationItems(data, include ? { include } : undefined),
  batchUpdate: (data: ExternalOperationItemBatchUpdateFormData, include?: ExternalOperationItemInclude) =>
    batchUpdateExternalOperationItems(data, include ? { include } : undefined),
  batchDelete: (data: ExternalOperationItemBatchDeleteFormData) => batchDeleteExternalOperationItems(data),
};

// =====================================================
// Base ExternalOperationItem Hooks
// =====================================================

const baseItemHooks = createEntityHooks<
  ExternalOperationItemGetManyFormData,
  ExternalOperationItemGetManyResponse,
  ExternalOperationItemGetUniqueResponse,
  ExternalOperationItemCreateFormData,
  ExternalOperationItemCreateResponse,
  ExternalOperationItemUpdateFormData,
  ExternalOperationItemUpdateResponse,
  ExternalOperationItemDeleteResponse,
  ExternalOperationItemBatchCreateFormData,
  ExternalOperationItemBatchCreateResponse<ExternalOperationItemCreateFormData>,
  ExternalOperationItemBatchUpdateFormData,
  ExternalOperationItemBatchUpdateResponse<ExternalOperationItemUpdateFormData>,
  ExternalOperationItemBatchDeleteFormData,
  ExternalOperationItemBatchDeleteResponse
>({
  queryKeys: externalOperationItemKeys,
  service: externalOperationItemService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [externalOperationKeys, itemKeys, changeLogKeys], // Items affect withdrawals, inventory, and changelog
});

// Export base hooks with standard names
export const useExternalOperationItemsInfinite = baseItemHooks.useInfiniteList;
export const useExternalOperationItems = baseItemHooks.useList;
export const useExternalOperationItem = baseItemHooks.useDetail;
export const useExternalOperationItemMutations = baseItemHooks.useMutations;
export const useExternalOperationItemBatchMutations = baseItemHooks.useBatchMutations;

// =====================================================
// Specialized ExternalOperationItem Hooks
// =====================================================

// Hook for items by withdrawal
export const useExternalOperationItemsByWithdrawal = createSpecializedQueryHook<
  { withdrawalId: string; filters?: Partial<ExternalOperationItemGetManyFormData> },
  ExternalOperationItemGetManyResponse
>({
  queryKeyFn: ({ withdrawalId, filters }) => externalOperationItemKeys.byWithdrawal(withdrawalId, filters),
  queryFn: ({ withdrawalId, filters }) => getExternalOperationItems({ ...filters, where: { externalOperationId: withdrawalId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for items by item
export const useExternalOperationItemsByItem = createSpecializedQueryHook<
  { itemId: string; filters?: Partial<ExternalOperationItemGetManyFormData> },
  ExternalOperationItemGetManyResponse
>({
  queryKeyFn: ({ itemId, filters }) => externalOperationItemKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) => getExternalOperationItems({ ...filters, where: { itemId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hooks with old names
export { useExternalOperation as useExternalOperationDetail };
export { useExternalOperationItem as useExternalOperationItemDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateExternalOperation = () => {
  const { createMutation } = useExternalOperationMutations();
  return createMutation;
};

export const useUpdateExternalOperation = (id: string) => {
  const { updateMutation } = useExternalOperationMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteExternalOperation = () => {
  const { deleteMutation } = useExternalOperationMutations();
  return deleteMutation;
};

export function useBatchCreateExternalOperations() {
  const { batchCreateAsync } = useExternalOperationBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateExternalOperations() {
  const { batchUpdateAsync } = useExternalOperationBatchMutations();
  return useMutation({
    mutationFn: batchUpdateAsync,
  });
}

export function useBatchDeleteExternalOperations() {
  const { batchDeleteAsync } = useExternalOperationBatchMutations();
  return useMutation({
    mutationFn: (data: ExternalOperationBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// ExternalOperationItem legacy hooks
export const useCreateExternalOperationItem = () => {
  const { createMutation } = useExternalOperationItemMutations();
  return createMutation;
};

export const useUpdateExternalOperationItem = (id: string) => {
  const { updateMutation } = useExternalOperationItemMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteExternalOperationItem = () => {
  const { deleteMutation } = useExternalOperationItemMutations();
  return deleteMutation;
};

export function useBatchCreateExternalOperationItems() {
  const { batchCreateAsync } = useExternalOperationItemBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateExternalOperationItems() {
  const { batchUpdateAsync } = useExternalOperationItemBatchMutations();
  return useMutation({
    mutationFn: (data: any) => {
      // Fix array serialization issue at the hook level
      let fixedData = data;
      if (data.externalOperationItems && typeof data.externalOperationItems === "object" && !Array.isArray(data.externalOperationItems)) {
        fixedData = {
          ...data,
          externalOperationItems: Object.values(data.externalOperationItems),
        };
      }
      return batchUpdateAsync(fixedData);
    },
  });
}

export function useBatchDeleteExternalOperationItems() {
  const { batchDeleteAsync } = useExternalOperationItemBatchMutations();
  return useMutation({
    mutationFn: (data: ExternalOperationItemBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// =====================================================
// Status Transition Hooks (Devolution/Charging Workflow)
// =====================================================

export function useExternalOperationStatusMutations() {
  const queryClient = useQueryClient();

  const markAsPartiallyReturnedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalOperationAsPartiallyReturned(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsFullyReturnedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalOperationAsFullyReturned(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsChargedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalOperationAsCharged(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsLiquidatedMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalOperationAsLiquidated(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const markAsDeliveredMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      markExternalOperationAsDelivered(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, data, queryParams }: { id: string; data?: Pick<ExternalOperationUpdateFormData, "notes">; queryParams?: any }) =>
      cancelExternalOperation(id, data, queryParams),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
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

// =====================================================
// Billing Hooks
// =====================================================

/**
 * Manual (re)trigger of the billing pipeline for a CHARGED withdrawal
 * (ADMIN/FINANCIAL). Invalidates the withdrawal detail + list queries.
 */
export function useGenerateExternalOperationBilling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => generateExternalOperationBilling(id),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.all });
      queryClient.invalidateQueries({ queryKey: externalOperationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// Individual status transition hooks for legacy compatibility
export function useMarkExternalOperationAsPartiallyReturned() {
  const { markAsPartiallyReturned } = useExternalOperationStatusMutations();
  return markAsPartiallyReturned;
}

export function useMarkExternalOperationAsFullyReturned() {
  const { markAsFullyReturned } = useExternalOperationStatusMutations();
  return markAsFullyReturned;
}

export function useMarkExternalOperationAsCharged() {
  const { markAsCharged } = useExternalOperationStatusMutations();
  return markAsCharged;
}

export function useMarkExternalOperationAsLiquidated() {
  const { markAsLiquidated } = useExternalOperationStatusMutations();
  return markAsLiquidated;
}

export function useMarkExternalOperationAsDelivered() {
  const { markAsDelivered } = useExternalOperationStatusMutations();
  return markAsDelivered;
}

export function useCancelExternalOperation() {
  const { cancel } = useExternalOperationStatusMutations();
  return cancel;
}
