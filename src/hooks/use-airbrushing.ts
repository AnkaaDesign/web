// packages/hooks/src/useAirbrushing.ts

import { createEntityHooks, createSpecializedQueryHook } from "./create-entity-hooks";
import { airbrushingService } from "../api-client";
import type {
  AirbrushingGetManyFormData,
  AirbrushingCreateFormData,
  AirbrushingUpdateFormData,
  AirbrushingBatchCreateFormData,
  AirbrushingBatchUpdateFormData,
  AirbrushingBatchDeleteFormData,
} from "../schemas";
import type {
  AirbrushingGetManyResponse,
  AirbrushingGetUniqueResponse,
  AirbrushingCreateResponse,
  AirbrushingUpdateResponse,
  AirbrushingDeleteResponse,
  AirbrushingBatchCreateResponse,
  AirbrushingBatchUpdateResponse,
  AirbrushingBatchDeleteResponse,
} from "../types";
import { airbrushingKeys, taskKeys, fileKeys } from "./query-keys";

// =====================================================
// Create Airbrushing Hooks using Factory
// =====================================================

const airbrushingHooks = createEntityHooks<
  AirbrushingGetManyFormData,
  AirbrushingGetManyResponse,
  AirbrushingGetUniqueResponse,
  AirbrushingCreateFormData,
  AirbrushingCreateResponse,
  AirbrushingUpdateFormData,
  AirbrushingUpdateResponse,
  AirbrushingDeleteResponse,
  AirbrushingBatchCreateFormData,
  AirbrushingBatchCreateResponse<AirbrushingCreateFormData>,
  AirbrushingBatchUpdateFormData,
  AirbrushingBatchUpdateResponse<AirbrushingUpdateFormData>,
  AirbrushingBatchDeleteFormData,
  AirbrushingBatchDeleteResponse
>({
  queryKeys: airbrushingKeys,
  service: {
    getMany: (params) => airbrushingService.getAirbrushings(params),
    getById: (id: string, params?: any) => airbrushingService.getAirbrushingById(id, params),
    create: (data, include) => airbrushingService.createAirbrushing(data, include ? { include } : undefined),
    update: (id, data, include) => airbrushingService.updateAirbrushing(id, data, include ? { include } : undefined),
    delete: (id) => airbrushingService.deleteAirbrushing(id),
    batchCreate: (data, include) => airbrushingService.batchCreateAirbrushings(data, include ? { include } : undefined),
    batchUpdate: (data, include) => airbrushingService.batchUpdateAirbrushings(data, include ? { include } : undefined),
    batchDelete: (data) => airbrushingService.batchDeleteAirbrushings(data),
  },
  relatedQueryKeys: [taskKeys, fileKeys],
});

// =====================================================
// Export Standard Hooks
// =====================================================

export const useAirbrushingsInfinite = airbrushingHooks.useInfiniteList;
export const useAirbrushings = airbrushingHooks.useList;
export const useAirbrushingDetail = airbrushingHooks.useDetail;
export const useAirbrushingMutations = airbrushingHooks.useMutations;
export const useAirbrushingBatchMutations = airbrushingHooks.useBatchMutations;

// =====================================================
// Specialized Hooks
// =====================================================

// Hook for getting airbrushings by task
export const useAirbrushingsByTask = createSpecializedQueryHook<{ taskId: string; params?: Partial<AirbrushingGetManyFormData> }, AirbrushingGetManyResponse>({
  queryKeyFn: ({ taskId, params }) => airbrushingKeys.byTask(taskId, params),
  queryFn: ({ taskId, params }) =>
    airbrushingService.getAirbrushings({
      ...params,
      taskIds: [taskId],
    }),
});

// =====================================================
// Backward Compatibility Exports
// =====================================================

// Alias for useAirbrushingDetail
export const useAirbrushing = useAirbrushingDetail;

export const useCreateAirbrushing = () => {
  const { createMutation } = useAirbrushingMutations();
  return createMutation;
};

export const useUpdateAirbrushing = (id: string) => {
  const { update } = useAirbrushingMutations();
  return {
    mutate: (data: any) => update({ id, data }),
    mutateAsync: (data: any) => useAirbrushingMutations().updateAsync({ id, data }),
  };
};

export function useBatchCreateAirbrushings() {
  const { batchCreate } = useAirbrushingBatchMutations();
  return { mutate: batchCreate, mutateAsync: batchCreate };
}

export function useBatchUpdateAirbrushings() {
  const { batchUpdate } = useAirbrushingBatchMutations();
  return { mutate: batchUpdate, mutateAsync: batchUpdate };
}

export function useBatchDeleteAirbrushings() {
  const { batchDelete } = useAirbrushingBatchMutations();
  return { mutate: batchDelete, mutateAsync: batchDelete };
}
