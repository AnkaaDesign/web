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
} from "../schemas";
import type {
  // Entity types
  Garage,
  GarageLane,
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
} from "../types";
import { garageKeys, garageLaneKeys, truckKeys, changeLogKeys } from "./queryKeys";
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
  relatedQueryKeys: [garageKeys, changeLogKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useGarageLanesInfinite = baseGarageLaneHooks.useInfiniteList;
export const useGarageLanes = baseGarageLaneHooks.useList;
export const useGarageLane = baseGarageLaneHooks.useDetail;
export const useGarageLaneMutations = baseGarageLaneHooks.useMutations;
export const useGarageLaneBatchMutations = baseGarageLaneHooks.useBatchMutations;

// =====================================================
// Specialized Garage Hooks
// =====================================================

// Hook for garage lanes by garage
export const useGarageLanesByGarage = createSpecializedQueryHook<{ garageId: string; filters?: Partial<GarageLaneGetManyFormData> }, GarageLaneGetManyResponse>({
  queryKeyFn: ({ garageId, filters }) => ["garageLanes", "byGarage", garageId, ...(filters ? [filters] : [])] as const,
  queryFn: ({ garageId, filters }) => getGarageLanes({ ...filters, where: { ...filters?.where, garageId } }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { useGarageMutations as useGarageCrud };
export { useGarageBatchMutations as useGarageBatchOperations };
export { useGarageLaneMutations as useGarageLaneCrud };
export { useGarageLaneBatchMutations as useGarageLaneBatchOperations };
