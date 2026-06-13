// packages/hooks/src/useBenefits.ts
// Benefícios (Departamento Pessoal)

import { getBenefits, getBenefitById, createBenefit, updateBenefit, deleteBenefit, batchCreateBenefits, batchUpdateBenefits, batchDeleteBenefits } from "../../api-client/benefit";
import type { BenefitGetManyFormData, BenefitCreateFormData, BenefitUpdateFormData, BenefitBatchCreateFormData, BenefitBatchUpdateFormData, BenefitBatchDeleteFormData } from "../../schemas/benefit";
import type {
  Benefit,
  BenefitGetManyResponse,
  BenefitGetUniqueResponse,
  BenefitCreateResponse,
  BenefitUpdateResponse,
  BenefitDeleteResponse,
  BenefitBatchCreateResponse,
  BenefitBatchUpdateResponse,
  BenefitBatchDeleteResponse,
} from "../../types/benefit";
import { benefitKeys, userBenefitKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Benefit Service Adapter
// =====================================================

const benefitServiceAdapter = {
  getMany: getBenefits,
  getById: getBenefitById,
  create: createBenefit,
  update: updateBenefit,
  delete: deleteBenefit,
  batchCreate: batchCreateBenefits,
  batchUpdate: batchUpdateBenefits,
  batchDelete: batchDeleteBenefits,
};

// =====================================================
// Base Benefit Hooks
// =====================================================

const baseHooks = createEntityHooks<
  BenefitGetManyFormData,
  BenefitGetManyResponse,
  BenefitGetUniqueResponse,
  BenefitCreateFormData,
  BenefitCreateResponse,
  BenefitUpdateFormData,
  BenefitUpdateResponse,
  BenefitDeleteResponse,
  BenefitBatchCreateFormData,
  BenefitBatchCreateResponse<Benefit>,
  BenefitBatchUpdateFormData,
  BenefitBatchUpdateResponse<Benefit>,
  BenefitBatchDeleteFormData,
  BenefitBatchDeleteResponse
>({
  queryKeys: benefitKeys,
  service: benefitServiceAdapter,
  staleTime: 1000 * 60 * 10, // 10 minutes - benefit catalog changes rarely
  relatedQueryKeys: [userBenefitKeys], // Benefit defaults affect enrollments
});

// Export base hooks with standard names
export const useBenefitsInfinite = baseHooks.useInfiniteList;
export const useBenefits = baseHooks.useList;
export const useBenefit = baseHooks.useDetail;
export const useBenefitMutations = baseHooks.useMutations;
export const useBenefitBatchMutations = baseHooks.useBatchMutations;

// Legacy alias
export { useBenefit as useBenefitDetail };
