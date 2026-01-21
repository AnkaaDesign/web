// packages/hooks/src/useServiceOrder.ts

import { createEntityHooks, createSpecializedQueryHook } from "./createEntityHooks";
import { serviceOrderService } from "../api-client";
import type {
  ServiceOrderGetManyFormData,
  ServiceOrderCreateFormData,
  ServiceOrderUpdateFormData,
  ServiceOrderBatchCreateFormData,
  ServiceOrderBatchUpdateFormData,
  ServiceOrderBatchDeleteFormData,
} from "../schemas";
import type {
  ServiceOrderGetManyResponse,
  ServiceOrderGetUniqueResponse,
  ServiceOrderCreateResponse,
  ServiceOrderUpdateResponse,
  ServiceOrderDeleteResponse,
  ServiceOrderBatchCreateResponse,
  ServiceOrderBatchUpdateResponse,
  ServiceOrderBatchDeleteResponse,
} from "../types";
import { serviceOrderKeys, taskKeys, changeLogKeys } from "./queryKeys";

// =====================================================
// Create ServiceOrder Hooks using Factory
// =====================================================

const serviceOrderHooks = createEntityHooks<
  ServiceOrderGetManyFormData,
  ServiceOrderGetManyResponse,
  ServiceOrderGetUniqueResponse,
  ServiceOrderCreateFormData,
  ServiceOrderCreateResponse,
  ServiceOrderUpdateFormData,
  ServiceOrderUpdateResponse,
  ServiceOrderDeleteResponse,
  ServiceOrderBatchCreateFormData,
  ServiceOrderBatchCreateResponse<ServiceOrderCreateFormData>,
  ServiceOrderBatchUpdateFormData,
  ServiceOrderBatchUpdateResponse<ServiceOrderUpdateFormData>,
  ServiceOrderBatchDeleteFormData,
  ServiceOrderBatchDeleteResponse
>({
  queryKeys: serviceOrderKeys,
  service: {
    getMany: (params) => serviceOrderService.getServiceOrders(params),
    getById: (id, include) => serviceOrderService.getServiceOrder({ id, include }),
    create: (data, include) => serviceOrderService.createServiceOrder(data, include ? { include } : undefined),
    update: (id, data, include) => serviceOrderService.updateServiceOrder(id, data, include ? { include } : undefined),
    delete: (id) => serviceOrderService.deleteServiceOrder(id),
    batchCreate: (data, include) => serviceOrderService.batchCreateServiceOrders(data, include ? { include } : undefined),
    batchUpdate: (data, include) => serviceOrderService.batchUpdateServiceOrders(data, include ? { include } : undefined),
    batchDelete: (data) => serviceOrderService.batchDeleteServiceOrders(data),
  },
  relatedQueryKeys: [taskKeys, changeLogKeys],
});

// =====================================================
// Export Standard Hooks
// =====================================================

export const useServiceOrdersInfinite = serviceOrderHooks.useInfiniteList;
export const useServiceOrders = serviceOrderHooks.useList;
export const useServiceOrderDetail = serviceOrderHooks.useDetail;
export const useServiceOrderMutations = serviceOrderHooks.useMutations;
export const useServiceOrderBatchMutations = serviceOrderHooks.useBatchMutations;

// =====================================================
// Specialized Hooks
// =====================================================

// Hook for getting service orders by task
export const useServiceOrdersByTask = createSpecializedQueryHook<{ taskId: string; params?: Partial<ServiceOrderGetManyFormData> }, ServiceOrderGetManyResponse>({
  queryKeyFn: ({ taskId, params }) => ["serviceOrders", "byTask", taskId, params] as const,
  queryFn: ({ taskId, params }) =>
    serviceOrderService.getServiceOrders({
      ...params,
      taskIds: [taskId],
    }),
});

// =====================================================
// Backward Compatibility Exports
// =====================================================

export const useCreateServiceOrder = () => {
  const { createMutation } = useServiceOrderMutations();
  return createMutation;
};

export const useUpdateServiceOrder = (id: string) => {
  const { update } = useServiceOrderMutations();
  return {
    mutate: (data: any) => update({ id, data }),
    mutateAsync: (data: any) => useServiceOrderMutations().updateAsync({ id, data }),
  };
};

export function useBatchCreateServiceOrders() {
  const { batchCreate } = useServiceOrderBatchMutations();
  return { mutate: batchCreate, mutateAsync: batchCreate };
}

export function useBatchUpdateServiceOrders() {
  const { batchUpdate } = useServiceOrderBatchMutations();
  return { mutate: batchUpdate, mutateAsync: batchUpdate };
}

export function useBatchDeleteServiceOrders() {
  const { batchDelete } = useServiceOrderBatchMutations();
  return { mutate: batchDelete, mutateAsync: batchDelete };
}
