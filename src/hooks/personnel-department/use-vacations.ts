// hooks/personnel-department/use-vacations.ts
// Férias (Departamento Pessoal) — Part C

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getVacations,
  getVacationById,
  createVacation,
  updateVacation,
  deleteVacation,
  getVacationPeriodBalance,
  calculateVacation,
  advanceVacation,
  getVacationSecullumStatus,
  syncVacationSecullum,
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
// Specialized Hooks (period balance, calculate, status machine)
// =====================================================

function useInvalidateVacations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: vacationKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

/** GET /vacations/:id/period-balance — remaining gozo days + sibling takings for the acquisitive period. */
export function useVacationPeriodBalance(vacationId: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...vacationKeys.all, "period-balance", vacationId],
    queryFn: () => getVacationPeriodBalance(vacationId as string),
    enabled: (options?.enabled ?? true) && !!vacationId,
    staleTime: 1000 * 30,
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

/** GET /vacations/:id/secullum-status — read-derived ponto sync status. */
export function useVacationSecullumStatus(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...vacationKeys.detail(id), "secullum-status"],
    queryFn: () => getVacationSecullumStatus(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 1000 * 30,
  });
}

/** POST /vacations/:id/sync — manually (re)push gozo períodos to the ponto. */
export function useVacationSyncSecullum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => syncVacationSecullum(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [...vacationKeys.detail(id), "secullum-status"] });
    },
  });
}
