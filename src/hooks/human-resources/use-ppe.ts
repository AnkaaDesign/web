// packages/frontend/src/hooks/usePpe.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  // PpeSize
  createPpeSize,
  deletePpeSize,
  getPpeSizeById,
  getPpeSizes,
  updatePpeSize,
  batchCreatePpeSizes,
  batchUpdatePpeSizes,
  batchDeletePpeSizes,
  // PpeDelivery
  createPpeDelivery,
  deletePpeDelivery,
  getPpeDeliveryById,
  getPpeDeliveries,
  updatePpeDelivery,
  batchCreatePpeDeliveries,
  batchUpdatePpeDeliveries,
  batchDeletePpeDeliveries,
  markPpeDeliveryAsDelivered,
  batchMarkPpeDeliveriesAsDelivered,
  batchApprovePpeDeliveries,
  batchRejectPpeDeliveries,
  // PpeDeliverySchedule
  createPpeDeliverySchedule,
  deletePpeDeliverySchedule,
  getPpeDeliveryScheduleById,
  getPpeDeliverySchedules,
  updatePpeDeliverySchedule,
  batchCreatePpeDeliverySchedules,
  batchUpdatePpeDeliverySchedules,
  batchDeletePpeDeliverySchedules,
  executePpeDeliveryScheduleNow,
} from "../../api-client";
import type {
  // PpeSize types
  PpeSizeCreateFormData,
  PpeSizeUpdateFormData,
  PpeSizeGetManyFormData,
  PpeSizeBatchCreateFormData,
  PpeSizeBatchUpdateFormData,
  PpeSizeBatchDeleteFormData,
  // PpeDelivery types
  PpeDeliveryCreateFormData,
  PpeDeliveryUpdateFormData,
  PpeDeliveryGetManyFormData,
  PpeDeliveryBatchCreateFormData,
  PpeDeliveryBatchUpdateFormData,
  PpeDeliveryBatchDeleteFormData,
  // PpeDeliverySchedule types
  PpeDeliveryScheduleCreateFormData,
  PpeDeliveryScheduleUpdateFormData,
  PpeDeliveryScheduleGetManyFormData,
  PpeDeliveryScheduleBatchCreateFormData,
  PpeDeliveryScheduleBatchUpdateFormData,
  PpeDeliveryScheduleBatchDeleteFormData,
} from "../../schemas";
import type {
  // PpeSize response types
  PpeSizeGetManyResponse,
  PpeSizeGetUniqueResponse,
  PpeSizeCreateResponse,
  PpeSizeUpdateResponse,
  PpeSizeDeleteResponse,
  PpeSizeBatchCreateResponse,
  PpeSizeBatchUpdateResponse,
  PpeSizeBatchDeleteResponse,
  // PpeDelivery response types
  PpeDeliveryGetManyResponse,
  PpeDeliveryGetUniqueResponse,
  PpeDeliveryCreateResponse,
  PpeDeliveryUpdateResponse,
  PpeDeliveryDeleteResponse,
  PpeDeliveryBatchCreateResponse,
  PpeDeliveryBatchUpdateResponse,
  PpeDeliveryBatchDeleteResponse,
  // PpeDeliverySchedule response types
  PpeDeliveryScheduleGetManyResponse,
  PpeDeliveryScheduleGetUniqueResponse,
  PpeDeliveryScheduleCreateResponse,
  PpeDeliveryScheduleUpdateResponse,
  PpeDeliveryScheduleDeleteResponse,
  PpeDeliveryScheduleBatchCreateResponse,
  PpeDeliveryScheduleBatchUpdateResponse,
  PpeDeliveryScheduleBatchDeleteResponse,
  // Batch operation types
  BatchOperationResult,
  BatchOperationError,
} from "../../types";
import { ppeSizeKeys, ppeDeliveryKeys, ppeDeliveryScheduleKeys, userKeys, itemKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// PPE Size Service Adapter
// =====================================================

const ppeSizeService = {
  getMany: getPpeSizes,
  getById: getPpeSizeById,
  create: createPpeSize,
  update: updatePpeSize,
  delete: deletePpeSize,
  batchCreate: batchCreatePpeSizes,
  batchUpdate: batchUpdatePpeSizes,
  batchDelete: batchDeletePpeSizes,
};

// =====================================================
// Base PPE Size Hooks
// =====================================================

const basePpeSizeHooks = createEntityHooks<
  PpeSizeGetManyFormData,
  PpeSizeGetManyResponse,
  PpeSizeGetUniqueResponse,
  PpeSizeCreateFormData,
  PpeSizeCreateResponse,
  PpeSizeUpdateFormData,
  PpeSizeUpdateResponse,
  PpeSizeDeleteResponse,
  PpeSizeBatchCreateFormData,
  PpeSizeBatchCreateResponse<PpeSizeCreateFormData>,
  PpeSizeBatchUpdateFormData,
  PpeSizeBatchUpdateResponse<PpeSizeUpdateFormData>,
  PpeSizeBatchDeleteFormData,
  PpeSizeBatchDeleteResponse
>({
  queryKeys: ppeSizeKeys,
  service: ppeSizeService,
  staleTime: 1000 * 60 * 10, // 10 minutes - sizes don't change often
  relatedQueryKeys: [userKeys], // Invalidate users since they have PPE sizes
});

// Export base hooks with standard names
export const usePpeSizesInfinite = basePpeSizeHooks.useInfiniteList;
export const usePpeSizes = basePpeSizeHooks.useList;
export const usePpeSize = basePpeSizeHooks.useDetail;
export const usePpeSizeMutations = basePpeSizeHooks.useMutations;
export const usePpeSizeBatchMutations = basePpeSizeHooks.useBatchMutations;

// =====================================================
// PPE Delivery Service Adapter
// =====================================================

const ppeDeliveryService = {
  getMany: getPpeDeliveries,
  getById: getPpeDeliveryById,
  create: createPpeDelivery,
  update: updatePpeDelivery,
  delete: deletePpeDelivery,
  batchCreate: batchCreatePpeDeliveries,
  batchUpdate: batchUpdatePpeDeliveries,
  batchDelete: batchDeletePpeDeliveries,
};

// =====================================================
// Base PPE Delivery Hooks
// =====================================================

const basePpeDeliveryHooks = createEntityHooks<
  PpeDeliveryGetManyFormData,
  PpeDeliveryGetManyResponse,
  PpeDeliveryGetUniqueResponse,
  PpeDeliveryCreateFormData,
  PpeDeliveryCreateResponse,
  PpeDeliveryUpdateFormData,
  PpeDeliveryUpdateResponse,
  PpeDeliveryDeleteResponse,
  PpeDeliveryBatchCreateFormData,
  PpeDeliveryBatchCreateResponse<PpeDeliveryCreateFormData>,
  PpeDeliveryBatchUpdateFormData,
  PpeDeliveryBatchUpdateResponse<PpeDeliveryUpdateFormData>,
  PpeDeliveryBatchDeleteFormData,
  PpeDeliveryBatchDeleteResponse
>({
  queryKeys: ppeDeliveryKeys,
  service: ppeDeliveryService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, itemKeys, ppeDeliveryScheduleKeys, changeLogKeys], // Invalidate related entities - items for stock updates, users for delivery history, changelogs
});

// Export base hooks with standard names
export const usePpeDeliveriesInfinite = basePpeDeliveryHooks.useInfiniteList;
export const usePpeDeliveries = basePpeDeliveryHooks.useList;
export const usePpeDelivery = basePpeDeliveryHooks.useDetail;
export const usePpeDeliveryMutations = basePpeDeliveryHooks.useMutations;
export const usePpeDeliveryBatchMutations = basePpeDeliveryHooks.useBatchMutations;

// Custom batch approve hook - returns BatchOperationResult format
export const useBatchApprovePpeDeliveries = () => {
  const queryClient = useQueryClient();

  return useMutation<BatchOperationResult<any, any>, Error, { deliveryIds: string[]; approvedBy?: string }>({
    mutationFn: async ({ deliveryIds, approvedBy }) => {
      const apiResult = await batchApprovePpeDeliveries(deliveryIds, approvedBy);

      // Transform API response to BatchOperationResult format
      const success: any[] = [];
      const failed: BatchOperationError[] = [];

      apiResult.results.forEach((result: any, index: number) => {
        if (result.success) {
          success.push(result.data);
        } else {
          failed.push({
            index,
            id: deliveryIds[index],
            error: String(result.error || "Erro desconhecido"),
          } as BatchOperationError<unknown>);
        }
      });

      const batchResult: BatchOperationResult<any, any> = {
        success,
        failed,
        totalProcessed: apiResult.results.length,
        totalSuccess: apiResult.success,
        totalFailed: apiResult.failed,
        partialSuccess: apiResult.success > 0 && apiResult.failed > 0,
      };

      return batchResult;
    },
    onSuccess: () => {
      // Invalidate PPE delivery queries
      queryClient.invalidateQueries({
        queryKey: ppeDeliveryKeys.all,
      });

      // Invalidate changelog queries
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Related queries to invalidate
      queryClient.invalidateQueries({
        queryKey: userKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: itemKeys.all,
      });
    },
  });
};

// Custom batch reject hook - returns BatchOperationResult format
export const useBatchRejectPpeDeliveries = () => {
  const queryClient = useQueryClient();

  return useMutation<BatchOperationResult<any, any>, Error, { deliveryIds: string[]; reviewedBy?: string; reason?: string }>({
    mutationFn: async ({ deliveryIds, reviewedBy, reason }) => {
      const apiResult = await batchRejectPpeDeliveries(deliveryIds, reviewedBy, reason);

      // Transform API response to BatchOperationResult format
      const success: any[] = [];
      const failed: BatchOperationError[] = [];

      apiResult.results.forEach((result: any, index: number) => {
        if (result.success) {
          success.push(result.data);
        } else {
          failed.push({
            index,
            id: deliveryIds[index],
            error: String(result.error || "Erro desconhecido"),
          } as BatchOperationError<unknown>);
        }
      });

      const batchResult: BatchOperationResult<any, any> = {
        success,
        failed,
        totalProcessed: apiResult.results.length,
        totalSuccess: apiResult.success,
        totalFailed: apiResult.failed,
        partialSuccess: apiResult.success > 0 && apiResult.failed > 0,
      };

      return batchResult;
    },
    onSuccess: () => {
      // Invalidate PPE delivery queries
      queryClient.invalidateQueries({
        queryKey: ppeDeliveryKeys.all,
      });

      // Invalidate changelog queries
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Related queries to invalidate
      queryClient.invalidateQueries({
        queryKey: userKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: itemKeys.all,
      });
    },
  });
};


// =====================================================
// PPE Schedule Service Adapter
// =====================================================

const ppeDeliveryScheduleService = {
  getMany: getPpeDeliverySchedules,
  getById: getPpeDeliveryScheduleById,
  create: createPpeDeliverySchedule,
  update: updatePpeDeliverySchedule,
  delete: deletePpeDeliverySchedule,
  batchCreate: batchCreatePpeDeliverySchedules,
  batchUpdate: batchUpdatePpeDeliverySchedules,
  batchDelete: batchDeletePpeDeliverySchedules,
};

// =====================================================
// Base PPE Schedule Hooks
// =====================================================

const basePpeDeliveryScheduleHooks = createEntityHooks<
  PpeDeliveryScheduleGetManyFormData,
  PpeDeliveryScheduleGetManyResponse,
  PpeDeliveryScheduleGetUniqueResponse,
  PpeDeliveryScheduleCreateFormData,
  PpeDeliveryScheduleCreateResponse,
  PpeDeliveryScheduleUpdateFormData,
  PpeDeliveryScheduleUpdateResponse,
  PpeDeliveryScheduleDeleteResponse,
  PpeDeliveryScheduleBatchCreateFormData,
  PpeDeliveryScheduleBatchCreateResponse<any>,
  PpeDeliveryScheduleBatchUpdateFormData,
  PpeDeliveryScheduleBatchUpdateResponse<any>,
  PpeDeliveryScheduleBatchDeleteFormData,
  PpeDeliveryScheduleBatchDeleteResponse
>({
  queryKeys: ppeDeliveryScheduleKeys,
  service: ppeDeliveryScheduleService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, itemKeys, ppeDeliveryKeys], // Invalidate related entities - users for assignment changes, items for PPE type matching
});

// Export base hooks with standard names
export const usePpeDeliverySchedulesInfinite = basePpeDeliveryScheduleHooks.useInfiniteList;
export const usePpeDeliverySchedules = basePpeDeliveryScheduleHooks.useList;
export const usePpeDeliverySchedule = basePpeDeliveryScheduleHooks.useDetail;
export const usePpeDeliveryScheduleMutations = basePpeDeliveryScheduleHooks.useMutations;
export const usePpeDeliveryScheduleBatchMutations = basePpeDeliveryScheduleHooks.useBatchMutations;

// Legacy individual mutation exports for backward compatibility
export function useCreatePpeDeliverySchedule() {
  const { createMutation } = usePpeDeliveryScheduleMutations();
  return createMutation;
}

export function useUpdatePpeDeliverySchedule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (_data: PpeDeliveryScheduleUpdateFormData) => updatePpeDeliverySchedule(id, _data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ppeDeliveryScheduleKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: ppeDeliveryScheduleKeys.all,
      });
    },
  });
}

export function useDeletePpeDeliverySchedule() {
  const { deleteMutation } = usePpeDeliveryScheduleMutations();
  return deleteMutation;
}

// =====================================================
// Legacy Batch Mutation Exports (for backwards compatibility)
// =====================================================

// PpeSize Batch Mutations
export function useBatchCreatePpeSizes() {
  const { batchCreateMutation } = usePpeSizeBatchMutations();
  return batchCreateMutation;
}

export function useBatchUpdatePpeSizes() {
  const { batchUpdateMutation } = usePpeSizeBatchMutations();
  return batchUpdateMutation;
}

export function useBatchDeletePpeSizes() {
  const { batchDeleteMutation } = usePpeSizeBatchMutations();
  return batchDeleteMutation;
}

// PpeDelivery Batch Mutations
export function useBatchCreatePpeDeliveries() {
  const { batchCreateMutation } = usePpeDeliveryBatchMutations();
  return batchCreateMutation;
}

export function useBatchUpdatePpeDeliveries() {
  const { batchUpdateMutation } = usePpeDeliveryBatchMutations();
  return batchUpdateMutation;
}

export function useBatchDeletePpeDeliveries() {
  const { batchDeleteMutation } = usePpeDeliveryBatchMutations();
  return batchDeleteMutation;
}

// PpeDeliverySchedule Batch Mutations
export function useBatchCreatePpeDeliverySchedules() {
  const { batchCreateMutation } = usePpeDeliveryScheduleBatchMutations();
  return batchCreateMutation;
}

export function useBatchUpdatePpeDeliverySchedules() {
  const { batchUpdateMutation } = usePpeDeliveryScheduleBatchMutations();
  return batchUpdateMutation;
}

export function useBatchDeletePpeDeliverySchedules() {
  const { batchDeleteMutation } = usePpeDeliveryScheduleBatchMutations();
  return batchDeleteMutation;
}

// Execute schedule now (create deliveries immediately)
export function useExecutePpeDeliverySchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      return executePpeDeliveryScheduleNow(scheduleId);
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.all });
      queryClient.invalidateQueries({ queryKey: ppeDeliveryScheduleKeys.all });
    },
  });
}

// =====================================================
// Additional PPE Delivery Operations
// =====================================================

// Hook for creating deliveries from schedule (bulk creation with itemId and quantity)
export function useCreatePpeDeliveriesFromSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      deliveries,
    }: {
      scheduleId: string;
      deliveries: Array<{
        userId: string;
        itemId: string;
        quantity: number;
        scheduledDate?: Date;
      }>;
    }) => {
      // Create multiple deliveries with direct itemId and quantity
      const createPromises = deliveries.map((delivery) =>
        ppeDeliveryService.create({
          ...delivery,
          ppeScheduleId: scheduleId,
          status: "PENDING",
          statusOrder: 1,
        }),
      );
      return Promise.all(createPromises);
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.all });
      queryClient.invalidateQueries({ queryKey: ppeDeliveryScheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all }); // Items for stock tracking
      queryClient.invalidateQueries({ queryKey: userKeys.all }); // Users for delivery history
    },
  });
}

export function useMarkPpeDeliveryAsDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deliveryDate }: { id: string; deliveryDate?: Date }) => markPpeDeliveryAsDelivered(id, deliveryDate),
    onSuccess: (_data, variables) => {
      // Invalidate PPE delivery queries using correct key structure
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.all });
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.detail(variables.id) });

      // Invalidate changelog queries
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
    onError: (error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Mark as delivered failed:", error);
      }
    },
  });
}

export function useBatchMarkPpeDeliveriesAsDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deliveryIds, deliveryDate }: { deliveryIds: string[]; deliveryDate?: Date }) =>
      batchMarkPpeDeliveriesAsDelivered(deliveryIds, deliveryDate),
    onSuccess: (_data, variables) => {
      // Invalidate PPE delivery queries
      queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.all });
      // Invalidate each delivery detail
      variables.deliveryIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: ppeDeliveryKeys.detail(id) });
      });

      // Invalidate changelog queries
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
    onError: (error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Batch mark as delivered failed:", error);
      }
    },
  });
}

// =====================================================
// Legacy Named Exports (for backwards compatibility)
// =====================================================

export { usePpeSizeMutations as usePpeSizeCrud };
export { usePpeSizeBatchMutations as usePpeSizeBatchOperations };
export { usePpeDeliveryMutations as usePpeDeliveryCrud };
export { usePpeDeliveryBatchMutations as usePpeDeliveryBatchOperations };
export { usePpeDeliveryScheduleMutations as usePpeDeliveryScheduleCrud };
export { usePpeDeliveryScheduleBatchMutations as usePpeDeliveryScheduleBatchOperations };
