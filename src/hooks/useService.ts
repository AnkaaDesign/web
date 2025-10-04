// packages/hooks/src/useService.ts

import { createEntityHooks } from "./createEntityHooks";
import { serviceService } from "../api-client";
import type {
  ServiceGetManyFormData,
  ServiceCreateFormData,
  ServiceUpdateFormData,
  ServiceBatchCreateFormData,
  ServiceBatchUpdateFormData,
  ServiceBatchDeleteFormData,
} from "../schemas";
import type {
  ServiceGetManyResponse,
  ServiceGetUniqueResponse,
  ServiceCreateResponse,
  ServiceUpdateResponse,
  ServiceDeleteResponse,
  ServiceBatchCreateResponse,
  ServiceBatchUpdateResponse,
  ServiceBatchDeleteResponse,
} from "../types";
import { serviceKeys, serviceOrderKeys, taskKeys, changeLogKeys } from "./queryKeys";

// =====================================================
// Create Service Hooks using Factory
// =====================================================

const serviceHooks = createEntityHooks<
  ServiceGetManyFormData,
  ServiceGetManyResponse,
  ServiceGetUniqueResponse,
  ServiceCreateFormData,
  ServiceCreateResponse,
  ServiceUpdateFormData,
  ServiceUpdateResponse,
  ServiceDeleteResponse,
  ServiceBatchCreateFormData,
  ServiceBatchCreateResponse<ServiceCreateFormData>,
  ServiceBatchUpdateFormData,
  ServiceBatchUpdateResponse<ServiceUpdateFormData>,
  ServiceBatchDeleteFormData,
  ServiceBatchDeleteResponse
>({
  queryKeys: serviceKeys,
  service: {
    getMany: (params) => serviceService.getServices(params),
    getById: (id, include) => serviceService.getService({ id, include }),
    create: (data, include) => serviceService.createService(data, include ? { include } : undefined),
    update: (id, data, include) => serviceService.updateService(id, data, include ? { include } : undefined),
    delete: (id) => serviceService.deleteService(id),
    batchCreate: (data, include) => serviceService.batchCreateServices(data, include ? { include } : undefined),
    batchUpdate: (data, include) => serviceService.batchUpdateServices(data, include ? { include } : undefined),
    batchDelete: (data) => serviceService.batchDeleteServices(data),
  },
  relatedQueryKeys: [serviceOrderKeys, taskKeys, changeLogKeys],
});

// =====================================================
// Export Standard Hooks
// =====================================================

export const useServicesInfinite = serviceHooks.useInfiniteList;
export const useServices = serviceHooks.useList;
export const useServiceDetail = serviceHooks.useDetail;
export const useServiceMutations = serviceHooks.useMutations;
export const useServiceBatchMutations = serviceHooks.useBatchMutations;

// =====================================================
// Backward Compatibility Exports
// =====================================================

export const useCreateService = () => {
  const { createMutation } = useServiceMutations();
  return createMutation;
};

export const useUpdateService = (id: string) => {
  const { update } = useServiceMutations();
  return {
    mutate: (data: any) => update({ id, data }),
    mutateAsync: (data: any) => useServiceMutations().updateAsync({ id, data }),
  };
};

export function useBatchCreateServices() {
  const { batchCreate } = useServiceBatchMutations();
  return { mutate: batchCreate, mutateAsync: batchCreate };
}

export function useBatchUpdateServices() {
  const { batchUpdate } = useServiceBatchMutations();
  return { mutate: batchUpdate, mutateAsync: batchUpdate };
}

export function useBatchDeleteServices() {
  const { batchDelete } = useServiceBatchMutations();
  return { mutate: batchDelete, mutateAsync: batchDelete };
}
