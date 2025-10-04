// packages/hooks/src/useObservation.ts

import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";
import { observationService } from "../api-client";
import type {
  ObservationGetManyFormData,
  ObservationCreateFormData,
  ObservationUpdateFormData,
  ObservationBatchCreateFormData,
  ObservationBatchUpdateFormData,
  ObservationBatchDeleteFormData,
} from "../schemas";
import type {
  ObservationGetManyResponse,
  ObservationGetUniqueResponse,
  ObservationCreateResponse,
  ObservationUpdateResponse,
  ObservationDeleteResponse,
  ObservationBatchCreateResponse,
  ObservationBatchUpdateResponse,
  ObservationBatchDeleteResponse,
} from "../types";
import { observationKeys, taskKeys, fileKeys } from "./queryKeys";

// =====================================================
// Create Observation Hooks using Factory
// =====================================================

const observationHooks = createEntityHooks<
  ObservationGetManyFormData,
  ObservationGetManyResponse,
  ObservationGetUniqueResponse,
  ObservationCreateFormData,
  ObservationCreateResponse,
  ObservationUpdateFormData,
  ObservationUpdateResponse,
  ObservationDeleteResponse,
  ObservationBatchCreateFormData,
  ObservationBatchCreateResponse<ObservationCreateFormData>,
  ObservationBatchUpdateFormData,
  ObservationBatchUpdateResponse<ObservationUpdateFormData>,
  ObservationBatchDeleteFormData,
  ObservationBatchDeleteResponse
>({
  queryKeys: observationKeys,
  service: {
    getMany: (params) => observationService.getObservations(params),
    getById: (id: string, params?: any) => observationService.getObservationById(id, params),
    create: (data, include) => observationService.createObservation(data, include ? { include } : undefined),
    update: (id, data, include) => observationService.updateObservation(id, data, include ? { include } : undefined),
    delete: (id) => observationService.deleteObservation(id),
    batchCreate: (data, include) => observationService.batchCreateObservations(data, include ? { include } : undefined),
    batchUpdate: (data, include) => observationService.batchUpdateObservations(data, include ? { include } : undefined),
    batchDelete: (data) => observationService.batchDeleteObservations(data),
  },
  relatedQueryKeys: [taskKeys, fileKeys],
});

// =====================================================
// Export Standard Hooks
// =====================================================

export const useObservationsInfinite = observationHooks.useInfiniteList;
export const useObservations = observationHooks.useList;
export const useObservationDetail = observationHooks.useDetail;
export const useObservationMutations = observationHooks.useMutations;
export const useObservationBatchMutations = observationHooks.useBatchMutations;

// =====================================================
// Specialized Hooks
// =====================================================

// Hook for getting observations by task
export const useObservationsByTask = createSpecializedQueryHook<{ taskId: string; params?: Partial<ObservationGetManyFormData> }, ObservationGetManyResponse>({
  queryKeyFn: ({ taskId, params }) => observationKeys.byTask(taskId, params),
  queryFn: ({ taskId, params }) =>
    observationService.getObservations({
      ...params,
      taskIds: [taskId],
    }),
});

// =====================================================
// Backward Compatibility Exports
// =====================================================

// Alias for useObservationDetail
export const useObservation = useObservationDetail;

export const useCreateObservation = () => {
  const { createMutation } = useObservationMutations();
  return createMutation;
};

export const useUpdateObservation = (id: string) => {
  const { update, updateAsync } = useObservationMutations();
  return {
    mutate: (data: any) => update({ id, data }),
    mutateAsync: (data: any) => updateAsync({ id, data }),
  };
};

export function useBatchCreateObservations() {
  const { batchCreate } = useObservationBatchMutations();
  return { mutate: batchCreate, mutateAsync: batchCreate };
}

export function useBatchUpdateObservations() {
  const { batchUpdate } = useObservationBatchMutations();
  return { mutate: batchUpdate, mutateAsync: batchUpdate };
}

export function useBatchDeleteObservations() {
  const { batchDelete } = useObservationBatchMutations();
  return { mutate: batchDelete, mutateAsync: batchDelete };
}
