// packages/hooks/src/useBorrow.ts

import {
  getBorrows,
  getBorrowById,
  createBorrow,
  updateBorrow,
  deleteBorrow,
  markAsLostBorrow,
  batchCreateBorrows,
  batchUpdateBorrows,
  batchDeleteBorrows,
} from "../api-client";
import type {
  BorrowGetManyFormData,
  BorrowCreateFormData,
  BorrowUpdateFormData,
  BorrowBatchCreateFormData,
  BorrowBatchUpdateFormData,
  BorrowBatchDeleteFormData,
  BorrowInclude,
} from "../schemas";
import type {
  BorrowGetManyResponse,
  BorrowGetUniqueResponse,
  BorrowCreateResponse,
  BorrowUpdateResponse,
  BorrowDeleteResponse,
  BorrowBatchCreateResponse,
  BorrowBatchUpdateResponse,
  BorrowBatchDeleteResponse,
} from "../types";
import { borrowKeys, activityKeys, itemKeys, userKeys, changeLogKeys } from "./queryKeys";
import { BORROW_STATUS } from "../constants";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// =====================================================
// Borrow Service Adapter
// =====================================================

const borrowService = {
  getMany: (params?: BorrowGetManyFormData) => getBorrows(params || {}),
  getById: (id: string, params?: any) => getBorrowById(id, params),
  create: (data: BorrowCreateFormData, include?: BorrowInclude) => createBorrow(data, include ? { include } : undefined),
  update: (id: string, data: BorrowUpdateFormData, include?: BorrowInclude) => updateBorrow(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteBorrow(id),
  markAsLost: (id: string, include?: BorrowInclude) => markAsLostBorrow(id, include ? { include } : undefined),
  batchCreate: (data: BorrowBatchCreateFormData, include?: BorrowInclude) => batchCreateBorrows(data, include ? { include } : undefined),
  batchUpdate: (data: BorrowBatchUpdateFormData, include?: BorrowInclude) => batchUpdateBorrows(data, include ? { include } : undefined),
  batchDelete: (data: BorrowBatchDeleteFormData) => batchDeleteBorrows(data),
};

// =====================================================
// Base Borrow Hooks
// =====================================================

const baseBorrowHooks = createEntityHooks<
  BorrowGetManyFormData,
  BorrowGetManyResponse,
  BorrowGetUniqueResponse,
  BorrowCreateFormData,
  BorrowCreateResponse,
  BorrowUpdateFormData,
  BorrowUpdateResponse,
  BorrowDeleteResponse,
  BorrowBatchCreateFormData,
  BorrowBatchCreateResponse<BorrowCreateFormData>,
  BorrowBatchUpdateFormData,
  BorrowBatchUpdateResponse<BorrowUpdateFormData>,
  BorrowBatchDeleteFormData,
  BorrowBatchDeleteResponse
>({
  queryKeys: borrowKeys,
  service: borrowService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [activityKeys, itemKeys, userKeys, changeLogKeys],
});

// Export base hooks with standard names
export const useBorrowsInfinite = baseBorrowHooks.useInfiniteList;
export const useBorrows = baseBorrowHooks.useList;
export const useBorrow = baseBorrowHooks.useDetail;
export const useBorrowBatchMutations = baseBorrowHooks.useBatchMutations;

// =====================================================
// Enhanced Borrow Mutations Hook
// =====================================================

export const useBorrowMutations = (options?: {
  onCreateSuccess?: (data: BorrowCreateResponse, variables: BorrowCreateFormData) => void;
  onUpdateSuccess?: (data: BorrowUpdateResponse, variables: { id: string; data: BorrowUpdateFormData }) => void;
  onDeleteSuccess?: (data: BorrowDeleteResponse, variables: string) => void;
  onMarkAsLostSuccess?: (data: BorrowUpdateResponse, variables: { id: string; include?: BorrowInclude }) => void;
}) => {
  const queryClient = useQueryClient();
  const baseMutations = baseBorrowHooks.useMutations(options);

  const invalidateQueries = () => {
    // Invalidate main entity queries
    queryClient.invalidateQueries({ queryKey: borrowKeys.all });
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
    queryClient.invalidateQueries({ queryKey: itemKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  const markAsLostMutation = useMutation({
    mutationFn: ({ id, include }: { id: string; include?: BorrowInclude }) => borrowService.markAsLost(id, include),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onMarkAsLostSuccess?.(data, variables);
    },
  });

  return {
    ...baseMutations,
    markAsLostMutation,
    markAsLost: markAsLostMutation.mutate,
    markAsLostAsync: markAsLostMutation.mutateAsync,
  };
};

// =====================================================
// Specialized Borrow Query Hooks
// =====================================================

// Active borrows (not returned)
export const useActiveBorrows = createSpecializedQueryHook<Partial<BorrowGetManyFormData>, BorrowGetManyResponse>({
  queryKeyFn: (filters) => borrowKeys.active(filters),
  queryFn: (filters) =>
    getBorrows({
      ...filters,
      where: {
        ...filters?.where,
        status: BORROW_STATUS.ACTIVE,
      },
    }),
  staleTime: 1000 * 60 * 3, // 3 minutes - active borrows are important
});

// Late borrows (overdue)
export const useLateBorrows = createSpecializedQueryHook<Partial<BorrowGetManyFormData>, BorrowGetManyResponse>({
  queryKeyFn: (filters) => borrowKeys.late(filters),
  queryFn: (filters) =>
    getBorrows({
      ...filters,
      where: {
        ...filters?.where,
        status: BORROW_STATUS.ACTIVE,
        expectedReturnAt: {
          lt: new Date().toISOString(),
        },
      },
    }),
  staleTime: 1000 * 60 * 3, // 3 minutes - late borrows need attention
});

// Borrows by item
export const useBorrowsByItem = createSpecializedQueryHook<{ itemId: string; filters?: Partial<BorrowGetManyFormData> }, BorrowGetManyResponse>({
  queryKeyFn: ({ itemId, filters }) => borrowKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) =>
    getBorrows({
      ...filters,
      where: {
        ...filters?.where,
        itemId,
      },
    }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Borrows by user (borrower)
export const useBorrowsByUser = createSpecializedQueryHook<{ userId: string; filters?: Partial<BorrowGetManyFormData> }, BorrowGetManyResponse>({
  queryKeyFn: ({ userId, filters }) => borrowKeys.byUser(userId, filters),
  queryFn: ({ userId, filters }) =>
    getBorrows({
      ...filters,
      where: {
        ...filters?.where,
        borrowedById: userId,
      },
    }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hook with old name
export { useBorrow as useBorrowDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateBorrow = () => {
  return baseBorrowHooks.useMutations().createMutation;
};

export const useUpdateBorrow = () => {
  return baseBorrowHooks.useMutations().updateMutation;
};

export const useDeleteBorrow = () => {
  return baseBorrowHooks.useMutations().deleteMutation;
};

export const useBatchCreateBorrows = () => {
  return baseBorrowHooks.useBatchMutations().batchCreateMutation;
};

export const useBatchUpdateBorrows = () => {
  return baseBorrowHooks.useBatchMutations().batchUpdateMutation;
};

export const useBatchDeleteBorrows = () => {
  return baseBorrowHooks.useBatchMutations().batchDeleteMutation;
};

// =====================================================
// Status Update Mutation Hooks
// =====================================================

// Mark borrow as lost
export const useMarkBorrowAsLost = () => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: borrowKeys.all });
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
    queryClient.invalidateQueries({ queryKey: itemKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  return useMutation({
    mutationFn: ({ id, include }: { id: string; include?: BorrowInclude }) => borrowService.markAsLost(id, include),
    onSuccess: () => {
      invalidateQueries();
    },
  });
};
