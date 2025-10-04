// packages/hooks/src/useVacation.ts

import { getVacations, getVacationById, createVacation, updateVacation, deleteVacation, batchCreateVacations, batchUpdateVacations, batchDeleteVacations } from "../api-client";
import type {
  VacationGetManyFormData,
  VacationCreateFormData,
  VacationUpdateFormData,
  VacationBatchCreateFormData,
  VacationBatchUpdateFormData,
  VacationBatchDeleteFormData,
} from "../schemas";
import type {
  VacationGetManyResponse,
  VacationGetUniqueResponse,
  VacationCreateResponse,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateResponse,
  VacationBatchUpdateResponse,
  VacationBatchDeleteResponse,
} from "../types";
import { vacationKeys, userKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";

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
