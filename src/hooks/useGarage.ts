// packages/hooks/src/useGarage.ts

import {
  // Garage
  createGarage,
  deleteGarage,
  getGarageById,
  getGarages,
  updateGarage,
  batchCreateGarages,
  batchUpdateGarages,
  batchDeleteGarages,
  // GarageLane
  createGarageLane,
  deleteGarageLane,
  getGarageLaneById,
  getGarageLanes,
  updateGarageLane,
  batchCreateGarageLanes,
  batchUpdateGarageLanes,
  batchDeleteGarageLanes,
  // ParkingSpot
  createParkingSpot,
  deleteParkingSpot,
  getParkingSpotById,
  getParkingSpots,
  updateParkingSpot,
  batchCreateParkingSpots,
  batchUpdateParkingSpots,
  batchDeleteParkingSpots,
} from "../api-client";
import type {
  // Garage types
  GarageCreateFormData,
  GarageUpdateFormData,
  GarageGetManyFormData,
  GarageBatchCreateFormData,
  GarageBatchUpdateFormData,
  GarageBatchDeleteFormData,
  GarageInclude,
  // GarageLane types
  GarageLaneCreateFormData,
  GarageLaneUpdateFormData,
  GarageLaneGetManyFormData,
  GarageLaneBatchCreateFormData,
  GarageLaneBatchUpdateFormData,
  GarageLaneBatchDeleteFormData,
  GarageLaneInclude,
  // ParkingSpot types
  ParkingSpotCreateFormData,
  ParkingSpotUpdateFormData,
  ParkingSpotGetManyFormData,
  ParkingSpotBatchCreateFormData,
  ParkingSpotBatchUpdateFormData,
  ParkingSpotBatchDeleteFormData,
  ParkingSpotInclude,
} from "../schemas";
import type {
  // Entity types
  Garage,
  GarageLane,
  ParkingSpot,
  // Garage response types
  GarageGetManyResponse,
  GarageGetUniqueResponse,
  GarageCreateResponse,
  GarageUpdateResponse,
  GarageDeleteResponse,
  GarageBatchCreateResponse,
  GarageBatchUpdateResponse,
  GarageBatchDeleteResponse,
  // GarageLane response types
  GarageLaneGetManyResponse,
  GarageLaneGetUniqueResponse,
  GarageLaneCreateResponse,
  GarageLaneUpdateResponse,
  GarageLaneDeleteResponse,
  GarageLaneBatchCreateResponse,
  GarageLaneBatchUpdateResponse,
  GarageLaneBatchDeleteResponse,
  // ParkingSpot response types
  ParkingSpotGetManyResponse,
  ParkingSpotGetUniqueResponse,
  ParkingSpotCreateResponse,
  ParkingSpotUpdateResponse,
  ParkingSpotDeleteResponse,
  ParkingSpotBatchCreateResponse,
  ParkingSpotBatchUpdateResponse,
  ParkingSpotBatchDeleteResponse,
} from "../types";
import { garageKeys, garageLaneKeys, parkingSpotKeys, truckKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// Garage Service Adapter
// =====================================================

const garageService = {
  getMany: (params?: GarageGetManyFormData) => getGarages(params || {}),
  getById: (id: string, params?: any) => getGarageById(id, params),
  create: (data: GarageCreateFormData, include?: GarageInclude) => createGarage(data, include ? { include } : undefined),
  update: (id: string, data: GarageUpdateFormData, include?: GarageInclude) => updateGarage(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteGarage(id),
  batchCreate: (data: GarageBatchCreateFormData, include?: GarageInclude) => batchCreateGarages(data, include ? { include } : undefined),
  batchUpdate: (data: GarageBatchUpdateFormData, include?: GarageInclude) => batchUpdateGarages(data, include ? { include } : undefined),
  batchDelete: (data: GarageBatchDeleteFormData) => batchDeleteGarages(data),
};

// =====================================================
// Base Garage Hooks
// =====================================================

const baseGarageHooks = createEntityHooks<
  GarageGetManyFormData,
  GarageGetManyResponse,
  GarageGetUniqueResponse,
  GarageCreateFormData,
  GarageCreateResponse,
  GarageUpdateFormData,
  GarageUpdateResponse,
  GarageDeleteResponse,
  GarageBatchCreateFormData,
  GarageBatchCreateResponse<Garage>,
  GarageBatchUpdateFormData,
  GarageBatchUpdateResponse<Garage>,
  GarageBatchDeleteFormData,
  GarageBatchDeleteResponse
>({
  queryKeys: garageKeys,
  service: garageService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [truckKeys, garageLaneKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useGaragesInfinite = baseGarageHooks.useInfiniteList;
export const useGarages = baseGarageHooks.useList;
export const useGarage = baseGarageHooks.useDetail;
export const useGarageMutations = baseGarageHooks.useMutations;
export const useGarageBatchMutations = baseGarageHooks.useBatchMutations;

// =====================================================
// Garage Lane Service Adapter
// =====================================================

const garageLaneService = {
  getMany: (params?: GarageLaneGetManyFormData) => getGarageLanes(params || {}),
  getById: (id: string, params?: any) => getGarageLaneById(id, params),
  create: (data: GarageLaneCreateFormData, include?: GarageLaneInclude) => createGarageLane(data, include ? { include } : undefined),
  update: (id: string, data: GarageLaneUpdateFormData, include?: GarageLaneInclude) => updateGarageLane(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteGarageLane(id),
  batchCreate: (data: GarageLaneBatchCreateFormData, include?: GarageLaneInclude) => batchCreateGarageLanes(data, include ? { include } : undefined),
  batchUpdate: (data: GarageLaneBatchUpdateFormData, include?: GarageLaneInclude) => batchUpdateGarageLanes(data, include ? { include } : undefined),
  batchDelete: (data: GarageLaneBatchDeleteFormData) => batchDeleteGarageLanes(data),
};

// =====================================================
// Base Garage Lane Hooks
// =====================================================

const baseGarageLaneHooks = createEntityHooks<
  GarageLaneGetManyFormData,
  GarageLaneGetManyResponse,
  GarageLaneGetUniqueResponse,
  GarageLaneCreateFormData,
  GarageLaneCreateResponse,
  GarageLaneUpdateFormData,
  GarageLaneUpdateResponse,
  GarageLaneDeleteResponse,
  GarageLaneBatchCreateFormData,
  GarageLaneBatchCreateResponse<GarageLane>,
  GarageLaneBatchUpdateFormData,
  GarageLaneBatchUpdateResponse<GarageLane>,
  GarageLaneBatchDeleteFormData,
  GarageLaneBatchDeleteResponse
>({
  queryKeys: garageLaneKeys,
  service: garageLaneService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [garageKeys, parkingSpotKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useGarageLanesInfinite = baseGarageLaneHooks.useInfiniteList;
export const useGarageLanes = baseGarageLaneHooks.useList;
export const useGarageLane = baseGarageLaneHooks.useDetail;
export const useGarageLaneMutations = baseGarageLaneHooks.useMutations;
export const useGarageLaneBatchMutations = baseGarageLaneHooks.useBatchMutations;

// =====================================================
// Parking Spot Service Adapter
// =====================================================

const parkingSpotService = {
  getMany: (params?: ParkingSpotGetManyFormData) => getParkingSpots(params || {}),
  getById: (id: string, params?: any) => getParkingSpotById(id, params),
  create: (data: ParkingSpotCreateFormData, include?: ParkingSpotInclude) => createParkingSpot(data, include ? { include } : undefined),
  update: (id: string, data: ParkingSpotUpdateFormData, include?: ParkingSpotInclude) => updateParkingSpot(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteParkingSpot(id),
  batchCreate: (data: ParkingSpotBatchCreateFormData, include?: ParkingSpotInclude) => batchCreateParkingSpots(data, include ? { include } : undefined),
  batchUpdate: (data: ParkingSpotBatchUpdateFormData, include?: ParkingSpotInclude) => batchUpdateParkingSpots(data, include ? { include } : undefined),
  batchDelete: (data: ParkingSpotBatchDeleteFormData) => batchDeleteParkingSpots(data),
};

// =====================================================
// Base Parking Spot Hooks
// =====================================================

const baseParkingSpotHooks = createEntityHooks<
  ParkingSpotGetManyFormData,
  ParkingSpotGetManyResponse,
  ParkingSpotGetUniqueResponse,
  ParkingSpotCreateFormData,
  ParkingSpotCreateResponse,
  ParkingSpotUpdateFormData,
  ParkingSpotUpdateResponse,
  ParkingSpotDeleteResponse,
  ParkingSpotBatchCreateFormData,
  ParkingSpotBatchCreateResponse<ParkingSpot>,
  ParkingSpotBatchUpdateFormData,
  ParkingSpotBatchUpdateResponse<ParkingSpot>,
  ParkingSpotBatchDeleteFormData,
  ParkingSpotBatchDeleteResponse
>({
  queryKeys: parkingSpotKeys,
  service: parkingSpotService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [garageLaneKeys, garageKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useParkingSpotsInfinite = baseParkingSpotHooks.useInfiniteList;
export const useParkingSpots = baseParkingSpotHooks.useList;
export const useParkingSpot = baseParkingSpotHooks.useDetail;
export const useParkingSpotMutations = baseParkingSpotHooks.useMutations;
export const useParkingSpotBatchMutations = baseParkingSpotHooks.useBatchMutations;

// =====================================================
// Specialized Garage Hooks
// =====================================================

// Hook for garage lanes by garage
export const useGarageLanesByGarage = createSpecializedQueryHook<{ garageId: string; filters?: Partial<GarageLaneGetManyFormData> }, GarageLaneGetManyResponse>({
  queryKeyFn: ({ garageId, filters }) => ["garageLanes", "byGarage", garageId, ...(filters ? [filters] : [])] as const,
  queryFn: ({ garageId, filters }) => getGarageLanes({ ...filters, where: { ...filters?.where, garageId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for parking spots by lane
export const useParkingSpotsByLane = createSpecializedQueryHook<{ laneId: string; filters?: Partial<ParkingSpotGetManyFormData> }, ParkingSpotGetManyResponse>({
  queryKeyFn: ({ laneId, filters }) => ["parkingSpots", "byLane", laneId, ...(filters ? [filters] : [])] as const,
  queryFn: ({ laneId, filters }) => getParkingSpots({ ...filters, where: { ...filters?.where, laneId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { useGarageMutations as useGarageCrud };
export { useGarageBatchMutations as useGarageBatchOperations };
export { useGarageLaneMutations as useGarageLaneCrud };
export { useGarageLaneBatchMutations as useGarageLaneBatchOperations };
export { useParkingSpotMutations as useParkingSpotCrud };
export { useParkingSpotBatchMutations as useParkingSpotBatchOperations };
