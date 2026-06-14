// packages/hooks/src/useUserBenefits.ts
// Adesões de benefícios (Departamento Pessoal)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserBenefits,
  getUserBenefitById,
  createUserBenefit,
  updateUserBenefit,
  deleteUserBenefit,
  suspendUserBenefit,
  reactivateUserBenefit,
  terminateUserBenefit,
  advanceUserBenefitInstallment,
  uploadUserBenefitDeclaration,
  batchCreateUserBenefits,
  batchUpdateUserBenefits,
  batchDeleteUserBenefits,
} from "../../api-client/benefit";
import type { UserBenefitGetManyFormData, UserBenefitCreateFormData, UserBenefitUpdateFormData, UserBenefitBatchCreateFormData, UserBenefitBatchUpdateFormData, UserBenefitBatchDeleteFormData } from "../../schemas/benefit";
import type {
  UserBenefit,
  UserBenefitGetManyResponse,
  UserBenefitGetUniqueResponse,
  UserBenefitCreateResponse,
  UserBenefitUpdateResponse,
  UserBenefitDeleteResponse,
  UserBenefitBatchCreateResponse,
  UserBenefitBatchUpdateResponse,
  UserBenefitBatchDeleteResponse,
} from "../../types/benefit";
import { userBenefitKeys, benefitKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// UserBenefit Service Adapter
// =====================================================

const userBenefitServiceAdapter = {
  getMany: getUserBenefits,
  getById: getUserBenefitById,
  create: createUserBenefit,
  update: updateUserBenefit,
  delete: deleteUserBenefit,
  batchCreate: batchCreateUserBenefits,
  batchUpdate: batchUpdateUserBenefits,
  batchDelete: batchDeleteUserBenefits,
};

// =====================================================
// Base UserBenefit Hooks
// =====================================================

const baseHooks = createEntityHooks<
  UserBenefitGetManyFormData,
  UserBenefitGetManyResponse,
  UserBenefitGetUniqueResponse,
  UserBenefitCreateFormData,
  UserBenefitCreateResponse,
  UserBenefitUpdateFormData,
  UserBenefitUpdateResponse,
  UserBenefitDeleteResponse,
  UserBenefitBatchCreateFormData,
  UserBenefitBatchCreateResponse<UserBenefit>,
  UserBenefitBatchUpdateFormData,
  UserBenefitBatchUpdateResponse<UserBenefit>,
  UserBenefitBatchDeleteFormData,
  UserBenefitBatchDeleteResponse
>({
  queryKeys: userBenefitKeys,
  service: userBenefitServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [benefitKeys], // Enrollment counts shown on benefit lists/details
});

// Export base hooks with standard names
export const useUserBenefitsInfinite = baseHooks.useInfiniteList;
export const useUserBenefits = baseHooks.useList;
export const useUserBenefit = baseHooks.useDetail;
export const useUserBenefitMutations = baseHooks.useMutations;
export const useUserBenefitBatchMutations = baseHooks.useBatchMutations;

// Legacy alias
export { useUserBenefit as useUserBenefitDetail };

// =====================================================
// Specialized Hooks — status machine + declaration upload
// =====================================================

function useInvalidateUserBenefits() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: userBenefitKeys.all });
    queryClient.invalidateQueries({ queryKey: benefitKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

export function useSuspendUserBenefit() {
  const invalidate = useInvalidateUserBenefits();
  return useMutation({
    mutationFn: ({ id, include }: { id: string; include?: any }) => suspendUserBenefit(id, include ? { include } : undefined),
    onSuccess: invalidate,
  });
}

export function useReactivateUserBenefit() {
  const invalidate = useInvalidateUserBenefits();
  return useMutation({
    mutationFn: ({ id, include }: { id: string; include?: any }) => reactivateUserBenefit(id, include ? { include } : undefined),
    onSuccess: invalidate,
  });
}

export function useTerminateUserBenefit() {
  const invalidate = useInvalidateUserBenefits();
  return useMutation({
    mutationFn: ({ id, endDate, include }: { id: string; endDate: Date; include?: any }) => terminateUserBenefit(id, { endDate }, include ? { include } : undefined),
    onSuccess: invalidate,
  });
}

export function useUploadUserBenefitDeclaration() {
  const invalidate = useInvalidateUserBenefits();
  return useMutation({
    mutationFn: ({ id, file, include }: { id: string; file: globalThis.File; include?: any }) => uploadUserBenefitDeclaration(id, file, include ? { include } : undefined),
    onSuccess: invalidate,
  });
}

/** PUT /user-benefits/:id/advance-installment — convênios parcelados (Part H). */
export function useAdvanceUserBenefitInstallment() {
  const invalidate = useInvalidateUserBenefits();
  return useMutation({
    mutationFn: ({ id, include }: { id: string; include?: any }) => advanceUserBenefitInstallment(id, include ? { include } : undefined),
    onSuccess: invalidate,
  });
}
