// hooks/personnel-department/use-employment-contracts.ts
// Vínculos empregatícios (EmploymentContract)

import {
  getEmploymentContracts,
  getEmploymentContractById,
  createEmploymentContract,
  updateEmploymentContract,
  deleteEmploymentContract,
  batchCreateEmploymentContracts,
  batchUpdateEmploymentContracts,
  batchDeleteEmploymentContracts,
} from "../../api-client/employment-contract";
import type {
  EmploymentContractGetManyFormData,
  EmploymentContractCreateFormData,
  EmploymentContractUpdateFormData,
  EmploymentContractBatchCreateFormData,
  EmploymentContractBatchUpdateFormData,
  EmploymentContractBatchDeleteFormData,
} from "../../schemas/employment-contract";
import type {
  EmploymentContractGetManyResponse,
  EmploymentContractGetUniqueResponse,
  EmploymentContractCreateResponse,
  EmploymentContractUpdateResponse,
  EmploymentContractDeleteResponse,
  EmploymentContractBatchCreateResponse,
  EmploymentContractBatchUpdateResponse,
  EmploymentContractBatchDeleteResponse,
} from "../../types/employment-contract";
import { employmentContractKeys, userKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// EmploymentContract Service Adapter
// =====================================================

const employmentContractServiceAdapter = {
  getMany: getEmploymentContracts,
  getById: getEmploymentContractById,
  create: createEmploymentContract,
  update: updateEmploymentContract,
  delete: deleteEmploymentContract,
  batchCreate: batchCreateEmploymentContracts,
  batchUpdate: batchUpdateEmploymentContracts,
  batchDelete: batchDeleteEmploymentContracts,
};

// =====================================================
// Base EmploymentContract Hooks
// =====================================================

const baseHooks = createEntityHooks<
  EmploymentContractGetManyFormData,
  EmploymentContractGetManyResponse,
  EmploymentContractGetUniqueResponse,
  EmploymentContractCreateFormData,
  EmploymentContractCreateResponse,
  EmploymentContractUpdateFormData,
  EmploymentContractUpdateResponse,
  EmploymentContractDeleteResponse,
  EmploymentContractBatchCreateFormData,
  EmploymentContractBatchCreateResponse<EmploymentContractCreateFormData>,
  EmploymentContractBatchUpdateFormData,
  EmploymentContractBatchUpdateResponse<EmploymentContractUpdateFormData & { id: string }>,
  EmploymentContractBatchDeleteFormData,
  EmploymentContractBatchDeleteResponse
>({
  queryKeys: employmentContractKeys,
  service: employmentContractServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  // Creating/updating/terminating a contract re-syncs the owning user cache.
  relatedQueryKeys: [userKeys, changeLogKeys],
});

// Export base hooks with standard names
export const useEmploymentContractsInfinite = baseHooks.useInfiniteList;
export const useEmploymentContracts = baseHooks.useList;
export const useEmploymentContract = baseHooks.useDetail;
export const useEmploymentContractMutations = baseHooks.useMutations;
export const useEmploymentContractBatchMutations = baseHooks.useBatchMutations;
