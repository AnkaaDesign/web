// packages/hooks/src/useSector.ts

import { createSector, deleteSector, getSectorById, getSectors, updateSector, batchCreateSectors, batchUpdateSectors, batchDeleteSectors } from "../../api-client";
import type {
  SectorCreateFormData,
  SectorUpdateFormData,
  SectorGetManyFormData,
  SectorBatchCreateFormData,
  SectorBatchUpdateFormData,
  SectorBatchDeleteFormData,
} from "../../types";
import type {
  SectorGetManyResponse,
  SectorGetUniqueResponse,
  SectorCreateResponse,
  SectorUpdateResponse,
  SectorDeleteResponse,
  SectorBatchCreateResponse,
  SectorBatchUpdateResponse,
  SectorBatchDeleteResponse,
} from "../../types";
import { sectorKeys, userKeys, taskKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Sector Service Adapter
// =====================================================

const sectorService = {
  getMany: getSectors,
  getById: getSectorById,
  create: createSector,
  update: updateSector,
  delete: deleteSector,
  batchCreate: batchCreateSectors,
  batchUpdate: batchUpdateSectors,
  batchDelete: batchDeleteSectors,
};

// =====================================================
// Base Sector Hooks
// =====================================================

const baseHooks = createEntityHooks<
  SectorGetManyFormData,
  SectorGetManyResponse,
  SectorGetUniqueResponse,
  SectorCreateFormData,
  SectorCreateResponse,
  SectorUpdateFormData,
  SectorUpdateResponse,
  SectorDeleteResponse,
  SectorBatchCreateFormData,
  SectorBatchCreateResponse<SectorCreateFormData>,
  SectorBatchUpdateFormData,
  SectorBatchUpdateResponse<SectorUpdateFormData & { id: string }>,
  SectorBatchDeleteFormData,
  SectorBatchDeleteResponse
>({
  queryKeys: sectorKeys,
  service: sectorService,
  staleTime: 1000 * 60 * 10, // 10 minutes - sectors don't change often
  relatedQueryKeys: [userKeys, taskKeys], // Sectors affect users and tasks
});

// Export base hooks with standard names
export const useSectorsInfinite = baseHooks.useInfiniteList;
export const useSectors = baseHooks.useList;
export const useSector = baseHooks.useDetail;
export const useSectorMutations = baseHooks.useMutations;
export const useSectorBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Legacy hook names
export { useSector as useSectorDetail };

// Individual mutation hooks for backwards compatibility
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateSector(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SectorUpdateFormData) => updateSector(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useBatchCreateSectors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchCreateSectors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
    },
  });
}

export function useBatchUpdateSectors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchUpdateSectors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
    },
  });
}

export function useBatchDeleteSectors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchDeleteSectors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectorKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
