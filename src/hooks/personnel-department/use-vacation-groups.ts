// hooks/personnel-department/use-vacation-groups.ts
// Férias Coletivas (Departamento Pessoal)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getVacationGroups,
  getVacationGroupById,
  createVacationGroup,
  updateVacationGroup,
  deleteVacationGroup,
  previewVacationGroupMembers,
  expandVacationGroup,
  syncVacationGroup,
  advanceVacationGroup,
} from "../../api-client/vacation-group";
import type {
  VacationGroupGetManyFormData,
  VacationGroupCreateFormData,
  VacationGroupUpdateFormData,
  VacationGroupAdvanceFormData,
} from "../../schemas/vacation-group";
import type {
  VacationGroupGetManyResponse,
  VacationGroupGetUniqueResponse,
  VacationGroupCreateResponse,
  VacationGroupUpdateResponse,
  VacationGroupDeleteResponse,
} from "../../types/vacation-group";
import { vacationGroupKeys, vacationKeys, userKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// VacationGroup Service Adapter
// =====================================================

const notImplemented = async (): Promise<never> => {
  throw new Error("Operação em lote não suportada para férias coletivas");
};

const vacationGroupServiceAdapter = {
  getMany: getVacationGroups,
  getById: getVacationGroupById,
  create: createVacationGroup,
  update: updateVacationGroup,
  delete: deleteVacationGroup,
  batchCreate: notImplemented,
  batchUpdate: notImplemented,
  batchDelete: notImplemented,
};

// =====================================================
// Base VacationGroup Hooks
// =====================================================

const baseHooks = createEntityHooks<
  VacationGroupGetManyFormData,
  VacationGroupGetManyResponse,
  VacationGroupGetUniqueResponse,
  VacationGroupCreateFormData,
  VacationGroupCreateResponse,
  VacationGroupUpdateFormData,
  VacationGroupUpdateResponse,
  VacationGroupDeleteResponse,
  never,
  never,
  never,
  never,
  never,
  never
>({
  queryKeys: vacationGroupKeys,
  service: vacationGroupServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [vacationKeys, userKeys, changeLogKeys],
});

export const useVacationGroupsInfinite = baseHooks.useInfiniteList;
export const useVacationGroups = baseHooks.useList;
export const useVacationGroup = baseHooks.useDetail;
export const useVacationGroupMutations = baseHooks.useMutations;

// =====================================================
// Specialized queries / mutations
// =====================================================

function useInvalidateVacationGroups() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: vacationGroupKeys.all });
    queryClient.invalidateQueries({ queryKey: vacationKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

/** GET /vacation-groups/:id/members — live preview of target colaboradores. */
export function useVacationGroupMembers(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...vacationGroupKeys.detail(id), "members"],
    queryFn: () => previewVacationGroupMembers(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 1000 * 30,
  });
}

/** POST /vacation-groups/:id/expand — generate one individual Vacation per eligible member. */
export function useExpandVacationGroup() {
  const invalidate = useInvalidateVacationGroups();
  return useMutation({
    mutationFn: (id: string) => expandVacationGroup(id),
    onSuccess: invalidate,
  });
}

/** POST /vacation-groups/:id/sync — re-sync collective to Secullum (ponto). */
export function useSyncVacationGroup() {
  const invalidate = useInvalidateVacationGroups();
  return useMutation({
    mutationFn: (id: string) => syncVacationGroup(id),
    onSuccess: invalidate,
  });
}

/** PUT /vacation-groups/:id/advance — advance the status machine. */
export function useAdvanceVacationGroup() {
  const invalidate = useInvalidateVacationGroups();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: VacationGroupAdvanceFormData }) => advanceVacationGroup(id, data ?? {}),
    onSuccess: invalidate,
  });
}
