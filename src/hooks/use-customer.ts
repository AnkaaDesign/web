// packages/hooks/src/useCustomer.ts

import { createCustomer, deleteCustomer, getCustomerById, getCustomers, updateCustomer, batchCreateCustomers, batchUpdateCustomers, batchDeleteCustomers } from "../api-client";
import type {
  CustomerCreateFormData,
  CustomerUpdateFormData,
  CustomerGetManyFormData,
  CustomerBatchCreateFormData,
  CustomerBatchUpdateFormData,
  CustomerBatchDeleteFormData,
} from "../schemas";
import type {
  CustomerGetManyResponse,
  CustomerGetUniqueResponse,
  CustomerCreateResponse,
  CustomerUpdateResponse,
  CustomerDeleteResponse,
  CustomerBatchCreateResponse,
  CustomerBatchUpdateResponse,
  CustomerBatchDeleteResponse,
} from "../types";
import { customerKeys, taskKeys, fileKeys, changeLogKeys } from "./query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "./create-entity-hooks";

// =====================================================
// Customer Service Adapter
// =====================================================

const customerService = {
  getMany: getCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
  batchCreate: batchCreateCustomers,
  batchUpdate: batchUpdateCustomers,
  batchDelete: batchDeleteCustomers,
};

// =====================================================
// Base Customer Hooks
// =====================================================

const baseHooks = createEntityHooks<
  CustomerGetManyFormData,
  CustomerGetManyResponse,
  CustomerGetUniqueResponse,
  CustomerCreateFormData,
  CustomerCreateResponse,
  CustomerUpdateFormData,
  CustomerUpdateResponse,
  CustomerDeleteResponse,
  CustomerBatchCreateFormData,
  CustomerBatchCreateResponse,
  CustomerBatchUpdateFormData,
  CustomerBatchUpdateResponse,
  CustomerBatchDeleteFormData,
  CustomerBatchDeleteResponse
>({
  queryKeys: customerKeys,
  service: customerService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [taskKeys, fileKeys, changeLogKeys], // Customers affect tasks and may have logo files
});

// Export base hooks with standard names
export const useCustomersInfinite = baseHooks.useInfiniteList;
export const useCustomers = baseHooks.useList;
export const useCustomer = baseHooks.useDetail;
export const useCustomerMutations = baseHooks.useMutations;
export const useCustomerBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Customer Hooks
// =====================================================

// Hook for customer statistics
export const useCustomerStatistics = createSpecializedQueryHook<
  void,
  any // CustomerStatisticsResponse when available
>({
  queryKeyFn: () => customerKeys.statistics(),
  queryFn: async () => {
    // Statistics endpoint not yet implemented in API client
    // When available, it should be: getCustomerStatistics()
    throw new Error("Customer statistics endpoint not yet implemented");
  },
  staleTime: 1000 * 60 * 10, // 10 minutes for statistics
});

// =====================================================
// Combined Operations Hook
// =====================================================

export function useCustomerOperations() {
  const mutations = useCustomerMutations();
  const batchMutations = useCustomerBatchMutations();

  return {
    // Single operations
    create: mutations.create,
    createAsync: mutations.createAsync,
    update: mutations.update,
    updateAsync: mutations.updateAsync,
    delete: mutations.delete,
    deleteAsync: mutations.deleteAsync,

    // Batch operations
    batchCreate: batchMutations.batchCreate,
    batchCreateAsync: batchMutations.batchCreateAsync,
    batchUpdate: batchMutations.batchUpdate,
    batchUpdateAsync: batchMutations.batchUpdateAsync,
    batchDelete: batchMutations.batchDelete,
    batchDeleteAsync: batchMutations.batchDeleteAsync,

    // Common
    isLoading: mutations.isLoading || batchMutations.isLoading,
    error: mutations.error || batchMutations.error,
    refresh: mutations.refresh,
  };
}

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerCreateFormData) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerUpdateFormData) => updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.byCustomer(id) });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useBatchCreateCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerBatchCreateFormData) => batchCreateCustomers(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useBatchUpdateCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerBatchUpdateFormData) => batchUpdateCustomers(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useBatchDeleteCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerBatchDeleteFormData) => batchDeleteCustomers(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}
