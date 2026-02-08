// packages/hooks/src/useVacation.ts

import { getVacations, getMyVacations, getTeamVacations, getVacationById, createVacation, updateVacation, deleteVacation, batchCreateVacations, batchUpdateVacations, batchDeleteVacations } from "../../api-client";
import type {
  VacationGetManyFormData,
  VacationCreateFormData,
  VacationUpdateFormData,
  VacationBatchCreateFormData,
  VacationBatchUpdateFormData,
  VacationBatchDeleteFormData,
} from "../../schemas";
import type {
  VacationGetManyResponse,
  VacationGetUniqueResponse,
  VacationCreateResponse,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateResponse,
  VacationBatchUpdateResponse,
  VacationBatchDeleteResponse,
} from "../../types";
import { vacationKeys, userKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// Vacation Service Adapter
// =====================================================

const vacationService = {
  getMany: getVacations,
  getById: getVacationById,
  create: createVacation,
  update: updateVacation,
  delete: deleteVacation,
  batchCreate: batchCreateVacations,
  batchUpdate: batchUpdateVacations,
  batchDelete: batchDeleteVacations,
};

// =====================================================
// Base Vacation Hooks
// =====================================================

const baseVacationHooks = createEntityHooks<
  VacationGetManyFormData,
  VacationGetManyResponse,
  VacationGetUniqueResponse,
  VacationCreateFormData,
  VacationCreateResponse,
  VacationUpdateFormData,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateFormData,
  VacationBatchCreateResponse<VacationCreateFormData>,
  VacationBatchUpdateFormData,
  VacationBatchUpdateResponse<VacationUpdateFormData>,
  VacationBatchDeleteFormData,
  VacationBatchDeleteResponse
>({
  queryKeys: vacationKeys,
  service: vacationService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, changeLogKeys], // Invalidate users since vacations affect user availability
});

// Export base hooks with standard names
export const useVacationsInfinite = baseVacationHooks.useInfiniteList;
export const useVacations = baseVacationHooks.useList;
export const useVacation = baseVacationHooks.useDetail;
export const useVacationMutations = baseVacationHooks.useMutations;
export const useVacationBatchMutations = baseVacationHooks.useBatchMutations;

// =====================================================
// Specialized Vacation Hooks
// =====================================================

// Hook for vacations by user
export const useVacationsByUser = createSpecializedQueryHook<{ userId: string; filters?: Partial<VacationGetManyFormData> }, VacationGetManyResponse>({
  queryKeyFn: ({ userId, filters }) => vacationKeys.byUser(userId, filters),
  queryFn: ({ userId, filters }) => getVacations({ ...filters, where: { ...filters?.where, userId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for active vacations
export const useActiveVacations = createSpecializedQueryHook<{ filters?: Partial<VacationGetManyFormData> }, VacationGetManyResponse>({
  queryKeyFn: ({ filters }) => vacationKeys.active(filters),
  queryFn: ({ filters }) => {
    const now = new Date();
    return getVacations({
      ...filters,
      where: {
        ...filters?.where,
        startAt: { lte: now },
        endAt: { gte: now },
      },
    });
  },
  staleTime: 1000 * 60 * 5,
});

// Hook for upcoming vacations
export const useUpcomingVacations = createSpecializedQueryHook<{ filters?: Partial<VacationGetManyFormData> }, VacationGetManyResponse>({
  queryKeyFn: ({ filters }) => vacationKeys.upcoming(filters),
  queryFn: ({ filters }) => {
    const now = new Date();
    return getVacations({
      ...filters,
      where: {
        ...filters?.where,
        startAt: { gt: now },
      },
    });
  },
  staleTime: 1000 * 60 * 5,
});

// Hook for current user's vacations (uses /vacations/my-vacations endpoint)
export const useMyVacations = createSpecializedQueryHook<{ filters?: Partial<VacationGetManyFormData> }, VacationGetManyResponse>({
  queryKeyFn: ({ filters }) => [...vacationKeys.all, 'my-vacations', filters],
  queryFn: ({ filters }) => getMyVacations(filters),
  staleTime: 1000 * 60 * 5,
});

// Hook for team vacations (uses /vacations/team-vacations endpoint for team leaders)
export const useTeamVacations = createSpecializedQueryHook<{ filters?: Partial<VacationGetManyFormData> }, VacationGetManyResponse>({
  queryKeyFn: ({ filters }) => [...vacationKeys.all, 'team-vacations', filters],
  queryFn: ({ filters }) => getTeamVacations(filters),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { useVacation as useVacationDetail };
export { useVacationMutations as useCreateVacation };
export { useVacationMutations as useUpdateVacation };
export { useVacationMutations as useDeleteVacation };
export { useVacationBatchMutations as useBatchCreateVacations };
export { useVacationBatchMutations as useBatchUpdateVacations };
export { useVacationBatchMutations as useBatchDeleteVacations };
