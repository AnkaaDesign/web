// packages/hooks/src/useTruck.ts

import { getTrucks, getTruckById, createTruck, updateTruck, deleteTruck, batchCreateTrucks, batchUpdateTrucks, batchDeleteTrucks } from "../api-client";
import type { TruckGetManyFormData, TruckCreateFormData, TruckUpdateFormData, TruckBatchCreateFormData, TruckBatchUpdateFormData, TruckBatchDeleteFormData } from "../schemas";
import type {
  TruckGetManyResponse,
  TruckGetUniqueResponse,
  TruckCreateResponse,
  TruckUpdateResponse,
  TruckDeleteResponse,
  TruckBatchCreateResponse,
  TruckBatchUpdateResponse,
  TruckBatchDeleteResponse,
} from "../types";
import { truckKeys, taskKeys, maintenanceKeys, garageKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// Truck Service Adapter
// =====================================================

const truckService = {
  getMany: getTrucks,
  getById: getTruckById,
  create: createTruck,
  update: updateTruck,
  delete: deleteTruck,
  batchCreate: batchCreateTrucks,
  batchUpdate: batchUpdateTrucks,
  batchDelete: batchDeleteTrucks,
};

// =====================================================
// Base Truck Hooks
// =====================================================

const baseHooks = createEntityHooks<
  TruckGetManyFormData,
  TruckGetManyResponse,
  TruckGetUniqueResponse,
  TruckCreateFormData,
  TruckCreateResponse,
  TruckUpdateFormData,
  TruckUpdateResponse,
  TruckDeleteResponse,
  TruckBatchCreateFormData,
  TruckBatchCreateResponse<TruckCreateFormData>,
  TruckBatchUpdateFormData,
  TruckBatchUpdateResponse<TruckUpdateFormData & { id: string }>,
  TruckBatchDeleteFormData,
  TruckBatchDeleteResponse
>({
  queryKeys: truckKeys,
  service: truckService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [taskKeys, maintenanceKeys, garageKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useTrucksInfinite = baseHooks.useInfiniteList;
export const useTrucks = baseHooks.useList;
export const useTruck = baseHooks.useDetail;
export const useTruckMutations = baseHooks.useMutations;
export const useTruckBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Truck Hooks
// =====================================================

// Hook for trucks by garage
export const useTrucksByGarage = createSpecializedQueryHook<{ garageId: string; filters?: Partial<TruckGetManyFormData> }, TruckGetManyResponse>({
  queryKeyFn: ({ garageId, filters }) => ["trucks", "byGarage", garageId, ...(filters ? [filters] : [])] as const,
  queryFn: ({ garageId, filters }) => getTrucks({ ...filters, where: { ...filters?.where, garageId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { useTruckMutations as useTruckCrud };
export { useTruckBatchMutations as useTruckBatchOperations };
