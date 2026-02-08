// packages/hooks/src/useCut.ts

import { getCuts, getCutById, createCut, updateCut, deleteCut, batchCreateCuts, batchUpdateCuts, batchDeleteCuts } from "../../api-client";
import type { CutGetManyFormData, CutCreateFormData, CutUpdateFormData, CutBatchCreateFormData, CutBatchUpdateFormData, CutBatchDeleteFormData, CutInclude } from "../../schemas";
import type {
  Cut,
  CutGetManyResponse,
  CutGetUniqueResponse,
  CutCreateResponse,
  CutUpdateResponse,
  CutDeleteResponse,
  CutBatchCreateResponse,
  CutBatchUpdateResponse,
  CutBatchDeleteResponse,
} from "../../types";
import { cutKeys, taskKeys, fileKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// Cut Service Adapter
// =====================================================

const cutServiceAdapter = {
  getMany: (params: CutGetManyFormData) => getCuts(params || {}),
  getById: (id: string, params?: any) => getCutById(id, params),
  create: (data: CutCreateFormData, include?: CutInclude) => createCut(data, include ? { include } : undefined),
  update: (id: string, data: CutUpdateFormData, include?: CutInclude) => updateCut(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteCut(id),
  batchCreate: (data: CutBatchCreateFormData, include?: CutInclude) => batchCreateCuts(data, include ? { include } : undefined),
  batchUpdate: (data: CutBatchUpdateFormData, include?: CutInclude) => batchUpdateCuts(data, include ? { include } : undefined),
  batchDelete: (data: CutBatchDeleteFormData) => batchDeleteCuts(data),
};

// =====================================================
// Base Cut Hooks
// =====================================================

const baseCutHooks = createEntityHooks<
  CutGetManyFormData,
  CutGetManyResponse,
  CutGetUniqueResponse,
  CutCreateFormData,
  CutCreateResponse,
  CutUpdateFormData,
  CutUpdateResponse,
  CutDeleteResponse,
  CutBatchCreateFormData,
  CutBatchCreateResponse<Cut>,
  CutBatchUpdateFormData,
  CutBatchUpdateResponse<Cut>,
  CutBatchDeleteFormData,
  CutBatchDeleteResponse
>({
  queryKeys: cutKeys,
  service: cutServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [
    fileKeys,
    changeLogKeys,
    taskKeys, // Cuts can be related to tasks
  ],
});

// Export base hooks with standard names
export const useCutsInfinite = baseCutHooks.useInfiniteList;
export const useCuts = baseCutHooks.useList;
export const useCut = baseCutHooks.useDetail;
export const useCutMutations = baseCutHooks.useMutations;
export const useCutBatchMutations = baseCutHooks.useBatchMutations;

// Destructure individual mutations for backward compatibility
export const useCreateCut = () => {
  const mutations = useCutMutations();
  return mutations.create;
};

export const useUpdateCut = () => {
  const mutations = useCutMutations();
  return mutations.update;
};

export const useDeleteCut = () => {
  const mutations = useCutMutations();
  return mutations.delete;
};

export const useBatchCreateCuts = () => {
  const mutations = useCutBatchMutations();
  return mutations.batchCreate;
};

export const useBatchUpdateCuts = () => {
  const mutations = useCutBatchMutations();
  return mutations.batchUpdate;
};

export const useBatchDeleteCuts = () => {
  const mutations = useCutBatchMutations();
  return mutations.batchDelete;
};

// =====================================================
// Specialized Cut Hooks
// =====================================================

// Hook for cuts by origin (PLAN or REQUEST)
export const useCutsByOrigin = createSpecializedQueryHook<{ origin: string; filters?: Partial<CutGetManyFormData> }, CutGetManyResponse>({
  queryKeyFn: ({ origin, filters }) => cutKeys.byOrigin(origin, filters),
  queryFn: ({ origin, filters }) => getCuts({ ...filters, where: { origin } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for cuts by file
export const useCutsByFile = createSpecializedQueryHook<{ fileId: string; filters?: Partial<CutGetManyFormData> }, CutGetManyResponse>({
  queryKeyFn: ({ fileId, filters }) => cutKeys.byFile(fileId, filters),
  queryFn: ({ fileId, filters }) => getCuts({ ...filters, where: { fileId } }),
  staleTime: 1000 * 60 * 5,
});

// Hook for cuts by task
export const useCutsByTask = createSpecializedQueryHook<{ taskId: string; filters?: Partial<CutGetManyFormData> }, CutGetManyResponse>({
  queryKeyFn: ({ taskId, filters }) => cutKeys.byTask(taskId, filters),
  queryFn: ({ taskId, filters }) => getCuts({ ...filters, where: { taskId } }),
  staleTime: 1000 * 60 * 5,
});
