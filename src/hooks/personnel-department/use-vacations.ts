// hooks/personnel-department/use-vacations.ts
// Férias (Departamento Pessoal) — Part C

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVacations,
  getVacationById,
  createVacation,
  updateVacation,
  deleteVacation,
  setVacationPeriods,
  calculateVacation,
  advanceVacation,
  batchCreateVacations,
  batchUpdateVacations,
  batchDeleteVacations,
} from "../../api-client/vacation";
import type {
  VacationGetManyFormData,
  VacationCreateFormData,
  VacationUpdateFormData,
  VacationBatchCreateFormData,
  VacationBatchUpdateFormData,
  VacationBatchDeleteFormData,
  VacationAdvanceFormData,
  VacationSetPeriodsFormData,
} from "../../schemas/vacation";
import type {
  VacationGetManyResponse,
  VacationGetUniqueResponse,
  VacationCreateResponse,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateResponse,
  VacationBatchUpdateResponse,
  VacationBatchDeleteResponse,
} from "../../types/vacation";
import { vacationKeys, userKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Vacation Service Adapter
// =====================================================

const vacationServiceAdapter = {
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

const baseHooks = createEntityHooks<
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
  VacationBatchUpdateResponse<VacationUpdateFormData & { id: string }>,
  VacationBatchDeleteFormData,
  VacationBatchDeleteResponse
>({
  queryKeys: vacationKeys,
  service: vacationServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, changeLogKeys],
});

export const useVacationsInfinite = baseHooks.useInfiniteList;
export const useVacations = baseHooks.useList;
export const useVacation = baseHooks.useDetail;
export const useVacationMutations = baseHooks.useMutations;
export const useVacationBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Mutations (periods, calculate, status machine)
// =====================================================

function useInvalidateVacations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: vacationKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

/** PUT /vacations/:id/periods — set fracionamento periods (≤3, one ≥14 dias). */
export function useVacationSetPeriods() {
  const invalidate = useInvalidateVacations();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VacationSetPeriodsFormData }) => setVacationPeriods(id, data),
    onSuccess: invalidate,
  });
}

/** POST /vacations/:id/calculate — compute férias + 1/3 + abono + INSS/IRRF (returns recibo). */
export function useVacationCalculate() {
  const invalidate = useInvalidateVacations();
  return useMutation({
    mutationFn: (id: string) => calculateVacation(id),
    onSuccess: invalidate,
  });
}

/** PUT /vacations/:id/advance — advance the status machine. */
export function useVacationAdvance() {
  const invalidate = useInvalidateVacations();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: VacationAdvanceFormData }) => advanceVacation(id, data ?? {}),
    onSuccess: invalidate,
  });
}
