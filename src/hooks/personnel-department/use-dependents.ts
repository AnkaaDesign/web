// packages/hooks/src/useDependents.ts
// Dependentes do colaborador (dedução IRRF / salário-família)

import { getDependents, getDependentById, createDependent, updateDependent, deleteDependent, batchCreateDependents, batchUpdateDependents, batchDeleteDependents } from "../../api-client/dependent";
import type { DependentGetManyFormData, DependentCreateFormData, DependentUpdateFormData, DependentBatchCreateFormData, DependentBatchUpdateFormData, DependentBatchDeleteFormData } from "../../schemas/dependent";
import type {
  Dependent,
  DependentGetManyResponse,
  DependentGetUniqueResponse,
  DependentCreateResponse,
  DependentUpdateResponse,
  DependentDeleteResponse,
  DependentBatchCreateResponse,
  DependentBatchUpdateResponse,
  DependentBatchDeleteResponse,
} from "../../types/dependent";
import { dependentKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Dependent Service Adapter
// =====================================================

const dependentServiceAdapter = {
  getMany: getDependents,
  getById: getDependentById,
  create: createDependent,
  update: updateDependent,
  delete: deleteDependent,
  batchCreate: batchCreateDependents,
  batchUpdate: batchUpdateDependents,
  batchDelete: batchDeleteDependents,
};

// =====================================================
// Base Dependent Hooks
// =====================================================

const baseHooks = createEntityHooks<
  DependentGetManyFormData,
  DependentGetManyResponse,
  DependentGetUniqueResponse,
  DependentCreateFormData,
  DependentCreateResponse,
  DependentUpdateFormData,
  DependentUpdateResponse,
  DependentDeleteResponse,
  DependentBatchCreateFormData,
  DependentBatchCreateResponse<Dependent>,
  DependentBatchUpdateFormData,
  DependentBatchUpdateResponse<Dependent>,
  DependentBatchDeleteFormData,
  DependentBatchDeleteResponse
>({
  queryKeys: dependentKeys,
  service: dependentServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Export base hooks with standard names
export const useDependentsInfinite = baseHooks.useInfiniteList;
export const useDependents = baseHooks.useList;
export const useDependent = baseHooks.useDetail;
export const useDependentMutations = baseHooks.useMutations;
export const useDependentBatchMutations = baseHooks.useBatchMutations;

// Legacy alias
export { useDependent as useDependentDetail };
