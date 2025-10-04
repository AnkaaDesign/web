// packages/hooks/src/useWarning.ts

import { createWarning, deleteWarning, getWarningById, getWarnings, updateWarning, batchCreateWarnings, batchUpdateWarnings, batchDeleteWarnings } from "../api-client";
import type {
  WarningCreateFormData,
  WarningUpdateFormData,
  WarningGetManyFormData,
  WarningBatchCreateFormData,
  WarningBatchUpdateFormData,
  WarningBatchDeleteFormData,
} from "../schemas";
import type {
  WarningGetManyResponse,
  WarningGetUniqueResponse,
  WarningCreateResponse,
  WarningUpdateResponse,
  WarningDeleteResponse,
  WarningBatchCreateResponse,
  WarningBatchUpdateResponse,
  WarningBatchDeleteResponse,
} from "../types";
import { warningKeys, userKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

// =====================================================
// Warning Service Adapter
// =====================================================

const warningService = {
  getMany: getWarnings,
  getById: getWarningById,
  create: createWarning,
  update: updateWarning,
  delete: deleteWarning,
  batchCreate: batchCreateWarnings,
  batchUpdate: batchUpdateWarnings,
  batchDelete: batchDeleteWarnings,
};

// =====================================================
// Base Warning Hooks
// =====================================================

const baseHooks = createEntityHooks<
  WarningGetManyFormData,
  WarningGetManyResponse,
  WarningGetUniqueResponse,
  WarningCreateFormData,
  WarningCreateResponse,
  WarningUpdateFormData,
  WarningUpdateResponse,
  WarningDeleteResponse,
  WarningBatchCreateFormData,
  WarningBatchCreateResponse<WarningCreateFormData>,
  WarningBatchUpdateFormData,
  WarningBatchUpdateResponse<WarningUpdateFormData>,
  WarningBatchDeleteFormData,
  WarningBatchDeleteResponse
>({
  queryKeys: warningKeys,
  service: warningService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, changeLogKeys], // Warnings are related to users and tracked in changelogs
});

// Export base hooks with standard names
export const useWarningsInfinite = baseHooks.useInfiniteList;
export const useWarnings = baseHooks.useList;
export const useWarning = baseHooks.useDetail;
export const useWarningMutations = baseHooks.useMutations;
export const useWarningBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Warning Hooks
// =====================================================

// Hook for warnings by collaborator
export const useWarningsByCollaborator = createSpecializedQueryHook<{ collaboratorId: string; filters?: Partial<WarningGetManyFormData> }, WarningGetManyResponse>({
  queryKeyFn: ({ collaboratorId, filters }) => warningKeys.byCollaborator(collaboratorId, filters),
  queryFn: ({ collaboratorId, filters }) => getWarnings({ ...filters, collaboratorIds: [collaboratorId] }),
  staleTime: 1000 * 60 * 5,
});

// Hook for warnings by supervisor
export const useWarningsBySupervisor = createSpecializedQueryHook<{ supervisorId: string; filters?: Partial<WarningGetManyFormData> }, WarningGetManyResponse>({
  queryKeyFn: ({ supervisorId, filters }) => warningKeys.bySupervisor(supervisorId, filters),
  queryFn: ({ supervisorId, filters }) => getWarnings({ ...filters, supervisorIds: [supervisorId] }),
  staleTime: 1000 * 60 * 5,
});

// Hook for active warnings
export const useActiveWarnings = createSpecializedQueryHook<Partial<WarningGetManyFormData>, WarningGetManyResponse>({
  queryKeyFn: (filters) => warningKeys.active(filters),
  queryFn: (filters) => getWarnings({ ...filters, isActive: true }),
  staleTime: 1000 * 60 * 5,
});

// Hook for warnings with pending follow-ups
export const usePendingFollowUpWarnings = createSpecializedQueryHook<Partial<WarningGetManyFormData>, WarningGetManyResponse>({
  queryKeyFn: (filters) => warningKeys.pendingFollowUp(filters),
  queryFn: (filters) => getWarnings({ ...filters, hasFollowUp: true, isActive: true }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export mutations with legacy names if needed
export { useWarningMutations as useWarningCrud };
export { useWarningBatchMutations as useWarningBatchOperations };
