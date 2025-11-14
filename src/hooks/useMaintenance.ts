// packages/hooks/src/useMaintenance.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  // Maintenance functions
  getMaintenances,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  finishMaintenance,
  batchCreateMaintenances,
  batchUpdateMaintenances,
  batchDeleteMaintenances,
  batchFinishMaintenances,
  batchStartMaintenances,
  // MaintenanceItem functions
  getMaintenanceItems,
  getMaintenanceItemById,
  createMaintenanceItem,
  updateMaintenanceItem,
  deleteMaintenanceItem,
  batchCreateMaintenanceItems,
  batchUpdateMaintenanceItems,
  batchDeleteMaintenanceItems,
  // MaintenanceSchedule functions
  getMaintenanceSchedules,
  getMaintenanceScheduleById,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  batchCreateMaintenanceSchedules,
  batchUpdateMaintenanceSchedules,
  batchDeleteMaintenanceSchedules,
} from "../api-client";
import type {
  // Maintenance types
  MaintenanceGetManyFormData,
  MaintenanceCreateFormData,
  MaintenanceUpdateFormData,
  MaintenanceBatchCreateFormData,
  MaintenanceBatchUpdateFormData,
  MaintenanceBatchDeleteFormData,
  MaintenanceInclude,
  // MaintenanceItem types
  MaintenanceItemGetManyFormData,
  MaintenanceItemCreateFormData,
  MaintenanceItemUpdateFormData,
  MaintenanceItemBatchCreateFormData,
  MaintenanceItemBatchUpdateFormData,
  MaintenanceItemBatchDeleteFormData,
  MaintenanceItemInclude,
  // MaintenanceSchedule types
  MaintenanceScheduleGetManyFormData,
  MaintenanceScheduleCreateFormData,
  MaintenanceScheduleUpdateFormData,
  MaintenanceScheduleBatchCreateFormData,
  MaintenanceScheduleBatchUpdateFormData,
  MaintenanceScheduleBatchDeleteFormData,
  MaintenanceScheduleInclude,
} from "../schemas";
import type {
  // Entity types
  Maintenance,
  MaintenanceItem,
  // Maintenance Interface types
  MaintenanceGetUniqueResponse,
  MaintenanceGetManyResponse,
  MaintenanceCreateResponse,
  MaintenanceUpdateResponse,
  MaintenanceDeleteResponse,
  MaintenanceBatchCreateResponse,
  MaintenanceBatchUpdateResponse,
  MaintenanceBatchDeleteResponse,
  // MaintenanceItem Interface types
  MaintenanceItemGetUniqueResponse,
  MaintenanceItemGetManyResponse,
  MaintenanceItemCreateResponse,
  MaintenanceItemUpdateResponse,
  MaintenanceItemDeleteResponse,
  MaintenanceItemBatchCreateResponse,
  MaintenanceItemBatchUpdateResponse,
  MaintenanceItemBatchDeleteResponse,
  // MaintenanceSchedule Interface types
  MaintenanceSchedule,
  MaintenanceScheduleGetUniqueResponse,
  MaintenanceScheduleGetManyResponse,
  MaintenanceScheduleCreateResponse,
  MaintenanceScheduleUpdateResponse,
  MaintenanceScheduleDeleteResponse,
  MaintenanceScheduleBatchCreateResponse,
  MaintenanceScheduleBatchUpdateResponse,
  MaintenanceScheduleBatchDeleteResponse,
} from "../types";
import { maintenanceKeys, maintenanceItemKeys, maintenanceScheduleKeys, truckKeys, itemKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// Maintenance Service Adapter
// =====================================================

const maintenanceService = {
  getMany: (params: MaintenanceGetManyFormData) => getMaintenances(params || {}),
  getById: (id: string, params?: any) => getMaintenanceById(id, params),
  create: (data: MaintenanceCreateFormData, include?: MaintenanceInclude) => createMaintenance(data, include ? { include } : undefined),
  update: (id: string, data: MaintenanceUpdateFormData, include?: MaintenanceInclude) => updateMaintenance(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteMaintenance(id),
  batchCreate: (data: MaintenanceBatchCreateFormData, include?: MaintenanceInclude) => batchCreateMaintenances(data, include ? { include } : undefined),
  batchUpdate: (data: MaintenanceBatchUpdateFormData, include?: MaintenanceInclude) => batchUpdateMaintenances(data, include ? { include } : undefined),
  batchDelete: (data: MaintenanceBatchDeleteFormData) => batchDeleteMaintenances(data),
};

// =====================================================
// Base Maintenance Hooks
// =====================================================

const baseHooks = createEntityHooks<
  MaintenanceGetManyFormData,
  MaintenanceGetManyResponse,
  MaintenanceGetUniqueResponse,
  MaintenanceCreateFormData,
  MaintenanceCreateResponse,
  MaintenanceUpdateFormData,
  MaintenanceUpdateResponse,
  MaintenanceDeleteResponse,
  MaintenanceBatchCreateFormData,
  MaintenanceBatchCreateResponse<Maintenance>,
  MaintenanceBatchUpdateFormData,
  MaintenanceBatchUpdateResponse<Maintenance>,
  MaintenanceBatchDeleteFormData,
  MaintenanceBatchDeleteResponse
>({
  queryKeys: maintenanceKeys,
  service: maintenanceService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [truckKeys, itemKeys, maintenanceItemKeys, changeLogKeys], // Maintenances affect trucks, items, their items, and change logs
});

// Export base hooks with standard names
export const useMaintenancesInfinite = baseHooks.useInfiniteList;
export const useMaintenances = baseHooks.useList;
export const useMaintenance = baseHooks.useDetail;
export const useMaintenanceMutations = baseHooks.useMutations;
export const useMaintenanceBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// MaintenanceItem Service Adapter
// =====================================================

const maintenanceItemService = {
  getMany: (params: MaintenanceItemGetManyFormData) => getMaintenanceItems(params || {}),
  getById: (id: string, params?: any) => getMaintenanceItemById(id, params),
  create: (data: MaintenanceItemCreateFormData, include?: MaintenanceItemInclude) => createMaintenanceItem(data, include ? { include } : undefined),
  update: (id: string, data: MaintenanceItemUpdateFormData, include?: MaintenanceItemInclude) => updateMaintenanceItem(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteMaintenanceItem(id),
  batchCreate: (data: MaintenanceItemBatchCreateFormData, include?: MaintenanceItemInclude) => batchCreateMaintenanceItems(data, include ? { include } : undefined),
  batchUpdate: (data: MaintenanceItemBatchUpdateFormData, include?: MaintenanceItemInclude) => batchUpdateMaintenanceItems(data, include ? { include } : undefined),
  batchDelete: (data: MaintenanceItemBatchDeleteFormData) => batchDeleteMaintenanceItems(data),
};

// =====================================================
// Base MaintenanceItem Hooks
// =====================================================

const baseItemHooks = createEntityHooks<
  MaintenanceItemGetManyFormData,
  MaintenanceItemGetManyResponse,
  MaintenanceItemGetUniqueResponse,
  MaintenanceItemCreateFormData,
  MaintenanceItemCreateResponse,
  MaintenanceItemUpdateFormData,
  MaintenanceItemUpdateResponse,
  MaintenanceItemDeleteResponse,
  MaintenanceItemBatchCreateFormData,
  MaintenanceItemBatchCreateResponse<MaintenanceItem>,
  MaintenanceItemBatchUpdateFormData,
  MaintenanceItemBatchUpdateResponse<MaintenanceItem>,
  MaintenanceItemBatchDeleteFormData,
  MaintenanceItemBatchDeleteResponse
>({
  queryKeys: maintenanceItemKeys,
  service: maintenanceItemService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [maintenanceKeys, itemKeys, changeLogKeys], // Items affect maintenances, inventory, and change logs
});

// Export base hooks with standard names
export const useMaintenanceItemsInfinite = baseItemHooks.useInfiniteList;
export const useMaintenanceItems = baseItemHooks.useList;
export const useMaintenanceItem = baseItemHooks.useDetail;
export const useMaintenanceItemMutations = baseItemHooks.useMutations;
export const useMaintenanceItemBatchMutations = baseItemHooks.useBatchMutations;

// =====================================================
// Specialized Maintenance Hooks
// =====================================================

// Hook for upcoming maintenances
export const useUpcomingMaintenances = createSpecializedQueryHook<Partial<MaintenanceGetManyFormData>, MaintenanceGetManyResponse>({
  queryKeyFn: (filters) => maintenanceKeys.upcoming(filters),
  queryFn: (filters) => getMaintenances({ ...filters, isPending: true }),
  staleTime: 1000 * 60 * 3, // 3 minutes - upcoming maintenances are time-sensitive
});

// Hook for overdue maintenances
export const useOverdueMaintenances = createSpecializedQueryHook<Partial<MaintenanceGetManyFormData>, MaintenanceGetManyResponse>({
  queryKeyFn: (filters) => maintenanceKeys.overdue(filters),
  queryFn: (filters) => getMaintenances({ ...filters, isLate: true }),
  staleTime: 1000 * 60 * 3, // 3 minutes - overdue maintenances are critical
});

// Hook for maintenances by truck
export const useMaintenancesByTruck = createSpecializedQueryHook<{ truckId: string; filters?: Partial<MaintenanceGetManyFormData> }, MaintenanceGetManyResponse>({
  queryKeyFn: ({ truckId, filters }) => ["maintenances", "byTruck", truckId, filters] as const,
  queryFn: ({ truckId, filters }) => getMaintenances({ ...filters, where: { truckId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for maintenances by item
export const useMaintenancesByItem = createSpecializedQueryHook<{ itemId: string; filters?: Partial<MaintenanceGetManyFormData> }, MaintenanceGetManyResponse>({
  queryKeyFn: ({ itemId, filters }) => maintenanceKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) => getMaintenances({ ...filters, itemIds: [itemId] }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export detail hooks with old names
export { useMaintenance as useMaintenanceDetail };
export { useMaintenanceItem as useMaintenanceItemDetail };

// Create legacy mutation hooks for backwards compatibility
export const useCreateMaintenance = () => {
  const { createMutation } = useMaintenanceMutations();
  return createMutation;
};

export const useUpdateMaintenance = (id: string) => {
  const { updateMutation } = useMaintenanceMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteMaintenance = () => {
  const { deleteMutation } = useMaintenanceMutations();
  return deleteMutation;
};

export function useBatchCreateMaintenances() {
  const { batchCreateAsync } = useMaintenanceBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateMaintenances() {
  const { batchUpdateAsync } = useMaintenanceBatchMutations();
  return useMutation({
    mutationFn: batchUpdateAsync,
  });
}

export function useBatchDeleteMaintenances() {
  const { batchDeleteAsync } = useMaintenanceBatchMutations();
  return useMutation({
    mutationFn: (data: MaintenanceBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// MaintenanceItem legacy hooks
export const useCreateMaintenanceItem = () => {
  const { createMutation } = useMaintenanceItemMutations();
  return createMutation;
};

export const useUpdateMaintenanceItem = (id: string) => {
  const { updateMutation } = useMaintenanceItemMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteMaintenanceItem = () => {
  const { deleteMutation } = useMaintenanceItemMutations();
  return deleteMutation;
};

export function useBatchCreateMaintenanceItems() {
  const { batchCreateAsync } = useMaintenanceItemBatchMutations();
  return useMutation({
    mutationFn: batchCreateAsync,
  });
}

export function useBatchUpdateMaintenanceItems() {
  const { batchUpdateAsync } = useMaintenanceItemBatchMutations();
  return useMutation({
    mutationFn: batchUpdateAsync,
  });
}

export function useBatchDeleteMaintenanceItems() {
  const { batchDeleteAsync } = useMaintenanceItemBatchMutations();
  return useMutation({
    mutationFn: (data: MaintenanceItemBatchDeleteFormData) => batchDeleteAsync(data),
  });
}

// =====================================================
// Specialized Maintenance Finish Hook
// =====================================================

export function useFinishMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, include }: { id: string; include?: MaintenanceInclude }) => finishMaintenance(id, include ? { include } : undefined),
    onSuccess: () => {
      // Invalidate related queries to refresh data after finish
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      queryClient.invalidateQueries({ queryKey: maintenanceScheduleKeys.all }); // Schedules might be affected
      queryClient.invalidateQueries({ queryKey: itemKeys.all }); // Items might be affected by activity creation
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all }); // Change logs are affected by maintenance operations
    },
  });
}

// =====================================================
// Batch Finish and Start Hooks
// =====================================================

export function useBatchFinishMaintenances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ maintenanceIds, include }: { maintenanceIds: string[]; include?: MaintenanceInclude }) => {
      return batchFinishMaintenances({ maintenanceIds }, include ? { include } : undefined);
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data after batch finish
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all }); // Items might be affected by activity creation
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all }); // Change logs are affected by batch maintenance operations
    },
  });
}

export function useBatchStartMaintenances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ maintenanceIds, include }: { maintenanceIds: string[]; include?: MaintenanceInclude }) => {
      return batchStartMaintenances({ maintenanceIds }, include ? { include } : undefined);
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data after batch start
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all }); // Change logs are affected by batch start operations
    },
  });
}

// =====================================================
// MaintenanceSchedule Service Adapter
// =====================================================

const maintenanceScheduleService = {
  getMany: (params: MaintenanceScheduleGetManyFormData) => getMaintenanceSchedules(params || {}),
  getById: (id: string, params?: any) => getMaintenanceScheduleById(id, params),
  create: (data: MaintenanceScheduleCreateFormData, include?: MaintenanceScheduleInclude) => createMaintenanceSchedule(data, include ? { include } : undefined),
  update: (id: string, data: MaintenanceScheduleUpdateFormData, include?: MaintenanceScheduleInclude) => updateMaintenanceSchedule(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteMaintenanceSchedule(id),
  batchCreate: (data: MaintenanceScheduleBatchCreateFormData, include?: MaintenanceScheduleInclude) => batchCreateMaintenanceSchedules(data, include ? { include } : undefined),
  batchUpdate: (data: MaintenanceScheduleBatchUpdateFormData, include?: MaintenanceScheduleInclude) => batchUpdateMaintenanceSchedules(data, include ? { include } : undefined),
  batchDelete: (data: MaintenanceScheduleBatchDeleteFormData) => batchDeleteMaintenanceSchedules(data),
};

// =====================================================
// Base MaintenanceSchedule Hooks
// =====================================================

const baseScheduleHooks = createEntityHooks<
  MaintenanceScheduleGetManyFormData,
  MaintenanceScheduleGetManyResponse,
  MaintenanceScheduleGetUniqueResponse,
  MaintenanceScheduleCreateFormData,
  MaintenanceScheduleCreateResponse,
  MaintenanceScheduleUpdateFormData,
  MaintenanceScheduleUpdateResponse,
  MaintenanceScheduleDeleteResponse,
  MaintenanceScheduleBatchCreateFormData,
  MaintenanceScheduleBatchCreateResponse<MaintenanceSchedule>,
  MaintenanceScheduleBatchUpdateFormData,
  MaintenanceScheduleBatchUpdateResponse<MaintenanceSchedule>,
  MaintenanceScheduleBatchDeleteFormData,
  MaintenanceScheduleBatchDeleteResponse
>({
  queryKeys: maintenanceScheduleKeys,
  service: maintenanceScheduleService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [maintenanceKeys, itemKeys, changeLogKeys], // Schedules affect maintenances, items, and change logs
});

// Export base hooks with standard names
export const useMaintenanceSchedulesInfinite = baseScheduleHooks.useInfiniteList;
export const useMaintenanceSchedules = baseScheduleHooks.useList;
export const useMaintenanceSchedule = baseScheduleHooks.useDetail;
export const useMaintenanceScheduleMutations = baseScheduleHooks.useMutations;
export const useMaintenanceScheduleBatchMutations = baseScheduleHooks.useBatchMutations;

// =====================================================
// Specialized MaintenanceSchedule Hooks
// =====================================================

// Hook for active schedules
export const useActiveMaintenanceSchedules = createSpecializedQueryHook<Partial<MaintenanceScheduleGetManyFormData>, MaintenanceScheduleGetManyResponse>({
  queryKeyFn: (filters) => maintenanceScheduleKeys.active(filters),
  queryFn: (filters) => getMaintenanceSchedules({ ...filters, where: { isActive: true } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for inactive schedules
export const useInactiveMaintenanceSchedules = createSpecializedQueryHook<Partial<MaintenanceScheduleGetManyFormData>, MaintenanceScheduleGetManyResponse>({
  queryKeyFn: (filters) => maintenanceScheduleKeys.inactive(filters),
  queryFn: (filters) => getMaintenanceSchedules({ ...filters, where: { isActive: false } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for schedules by item
export const useMaintenanceSchedulesByItem = createSpecializedQueryHook<
  { itemId: string; filters?: Partial<MaintenanceScheduleGetManyFormData> },
  MaintenanceScheduleGetManyResponse
>({
  queryKeyFn: ({ itemId, filters }) => maintenanceScheduleKeys.byItem(itemId, filters),
  queryFn: ({ itemId, filters }) => getMaintenanceSchedules({ ...filters, where: { itemId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy MaintenanceSchedule Exports
// =====================================================

export const useCreateMaintenanceSchedule = () => {
  const { createMutation } = useMaintenanceScheduleMutations();
  return createMutation;
};

export const useUpdateMaintenanceSchedule = (id: string) => {
  const { updateMutation } = useMaintenanceScheduleMutations();
  return useMutation({
    mutationFn: (data: any) => updateMutation.mutateAsync({ id, data }),
  });
};

export const useDeleteMaintenanceSchedule = () => {
  const { deleteMutation } = useMaintenanceScheduleMutations();
  return deleteMutation;
};

