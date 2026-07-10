// packages/hooks/src/useOrder.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  // Order functions
  getOrders,
  getOrder,
  getNextOrderNumber,
  createOrder,
  updateOrder,
  deleteOrder,
  batchCreateOrders,
  batchUpdateOrders,
  batchDeleteOrders,
  getOrderPaymentSummary,
  getOrderPayables,
  settlePayrollMonth,
  markOrderAwaitingPayment,
  markOrderPaid,
  markOrderInstallmentPaid,
  attachOrderReceipts,
  batchMarkOrdersAwaitingPayment,
  batchMarkOrdersPaid,
  requestOrderPayment,
  cancelOrderPaymentRequest,
  batchRequestOrdersPayment,
  batchCancelOrdersPaymentRequest,
} from "../../api-client";
import type {
  // Order types
  OrderGetManyFormData,
  OrderCreateFormData,
  OrderUpdateFormData,
  OrderBatchCreateFormData,
  OrderBatchUpdateFormData,
  OrderBatchDeleteFormData,
  OrderBatchPaymentFormData,
  OrderInclude,
} from "../../schemas";
import type {
  OrderGetManyResponse,
  OrderGetUniqueResponse,
  OrderCreateResponse,
  OrderUpdateResponse,
  OrderDeleteResponse,
  OrderBatchCreateResponse,
  OrderBatchUpdateResponse,
  OrderBatchDeleteResponse,
} from "../../types";
import {
  orderKeys,
  orderItemKeys,
  orderScheduleKeys,
  activityKeys,
  itemKeys,
  supplierKeys,
  changeLogKeys,
} from "../common/query-keys";
import { ORDER_STATUS } from "../../constants";
import {
  createEntityHooks,
  createSpecializedQueryHook,
} from "../common/create-entity-hooks";

// =====================================================
// Order Service Adapter
// =====================================================

const orderService = {
  getMany: (params?: OrderGetManyFormData) => getOrders(params || {}),
  getById: (id: string, params?: any) => getOrder(id, params),
  create: (data: OrderCreateFormData, include?: OrderInclude) =>
    createOrder(data, include ? { include } : undefined),
  update: (id: string, data: OrderUpdateFormData, include?: OrderInclude) =>
    updateOrder(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteOrder(id),
  batchCreate: (data: OrderBatchCreateFormData, include?: OrderInclude) =>
    batchCreateOrders(data, include ? { include } : undefined),
  batchUpdate: (data: OrderBatchUpdateFormData, include?: OrderInclude) =>
    batchUpdateOrders(data, include ? { include } : undefined),
  batchDelete: (data: OrderBatchDeleteFormData) => batchDeleteOrders(data),
};

// =====================================================
// Base Order Hooks
// =====================================================

const baseOrderHooks = createEntityHooks<
  OrderGetManyFormData,
  OrderGetManyResponse,
  OrderGetUniqueResponse,
  OrderCreateFormData,
  OrderCreateResponse,
  OrderUpdateFormData,
  OrderUpdateResponse,
  OrderDeleteResponse,
  OrderBatchCreateFormData,
  OrderBatchCreateResponse<OrderCreateFormData>,
  OrderBatchUpdateFormData,
  OrderBatchUpdateResponse<OrderUpdateFormData>,
  OrderBatchDeleteFormData,
  OrderBatchDeleteResponse
>({
  queryKeys: orderKeys,
  service: orderService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [
    orderItemKeys,
    orderScheduleKeys,
    activityKeys,
    itemKeys,
    supplierKeys,
    changeLogKeys,
  ],
});

// Export base hooks with standard names
export const useOrdersInfinite = baseOrderHooks.useInfiniteList;
export const useOrders = baseOrderHooks.useList;
export const useOrder = baseOrderHooks.useDetail;

/**
 * Predicted next order number (highest saved + 1), for previewing the order code in
 * the create form's PDF before saving. staleTime 0 so it reflects the latest order.
 */
export const useNextOrderNumber = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...orderKeys.all, "next-number"] as const,
    queryFn: getNextOrderNumber,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });

/**
 * Per-paymentStatus aggregates for the Contas a Pagar summary cards
 * (count + payable total per bucket; PAID windowed to 90 days server-side).
 * Keyed under orderKeys.all so payment mutations invalidate it automatically.
 */
export const useOrderPaymentSummary = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...orderKeys.all, "payment-summary"] as const,
    queryFn: getOrderPaymentSummary,
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? true,
  });

/**
 * Unified Contas a Pagar list: open orders + airbrushing painter payments +
 * scheduled/expected outflows, each carrying its own payment state, plus a
 * per-state summary. Keyed under orderKeys.all so payment mutations invalidate it.
 */
export const useOrderPayables = (competence?: string, options?: { enabled?: boolean }) =>
  useQuery({
    // Keyed by competence so navigating months in Contas a Pagar refetches the
    // selected month server-side (past-month recurrent occurrences aren't preloaded).
    queryKey: [...orderKeys.all, "payables", competence ?? "current"] as const,
    queryFn: () => getOrderPayables(competence),
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? true,
  });

/** Settle the payroll competence month (folha batch) from Contas a Pagar. */
export const useSettlePayrollMonth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, amount }: { year: number; month: number; amount: number | null }) => settlePayrollMonth(year, month, amount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
};

// =====================================================
// Specialized Order Query Hooks
// =====================================================

// Pending orders
export const usePendingOrders = createSpecializedQueryHook<
  Partial<OrderGetManyFormData>,
  OrderGetManyResponse
>({
  queryKeyFn: (filters) => orderKeys.pending(filters),
  queryFn: (filters) =>
    getOrders({ ...filters, status: [ORDER_STATUS.CREATED] }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Completed orders
export const useCompletedOrders = createSpecializedQueryHook<
  Partial<OrderGetManyFormData>,
  OrderGetManyResponse
>({
  queryKeyFn: (filters) =>
    orderKeys.list({ ...filters, status: [ORDER_STATUS.RECEIVED] }),
  queryFn: (filters) =>
    getOrders({ ...filters, status: [ORDER_STATUS.RECEIVED] }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Orders by supplier
export const useOrdersBySupplier = createSpecializedQueryHook<
  { supplierId: string; filters?: Partial<OrderGetManyFormData> },
  OrderGetManyResponse
>({
  queryKeyFn: ({ supplierId, filters }) =>
    orderKeys.bySupplier(supplierId, filters),
  queryFn: ({ supplierId, filters }) =>
    getOrders({ ...filters, supplierIds: [supplierId] }),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// =====================================================
// Custom Order Mutations with Enhanced Invalidation
// =====================================================

export const useOrderMutations = (options?: {
  onCreateSuccess?: (
    data: OrderCreateResponse,
    variables: OrderCreateFormData,
  ) => void;
  onUpdateSuccess?: (
    data: OrderUpdateResponse,
    variables: { id: string; data: OrderUpdateFormData },
  ) => void;
  onDeleteSuccess?: (data: OrderDeleteResponse, variables: string) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = (supplierId?: string, orderScheduleId?: string) => {
    // Invalidate order queries
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });

    // Invalidate statistics
    queryClient.invalidateQueries({
      queryKey: orderKeys.statistics(),
    });

    // Invalidate pending orders
    queryClient.invalidateQueries({
      queryKey: orderKeys.pending(),
    });

    // Invalidate supplier-specific queries
    if (supplierId) {
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySupplier(supplierId),
      });
      queryClient.invalidateQueries({
        queryKey: supplierKeys.detail(supplierId),
      });
    }

    // Invalidate order schedule
    if (orderScheduleId) {
      queryClient.invalidateQueries({
        queryKey: orderScheduleKeys.detail(orderScheduleId),
      });
    }

    // Invalidate related entities
    queryClient.invalidateQueries({
      queryKey: orderItemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: activityKeys.all,
    });
  };

  // CREATE
  const createMutation = useMutation({
    mutationFn: (data: OrderCreateFormData) => createOrder(data),
    onSuccess: (data, variables) => {
      invalidateQueries(
        data.data?.supplierId || undefined,
        data.data?.orderScheduleId || undefined,
      );
      options?.onCreateSuccess?.(data, variables);
    },
  });

  // UPDATE
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderUpdateFormData }) =>
      updateOrder(id, data),
    onSuccess: (data, variables) => {
      invalidateQueries(data.data?.supplierId || undefined);

      // If order status changed to received, invalidate item quantities
      if (data.data?.status === ORDER_STATUS.RECEIVED) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: activityKeys.all,
        });
      }

      options?.onUpdateSuccess?.(data, variables);
    },
  });

  // DELETE
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onDeleteSuccess?.(data, variables);
    },
  });

  // PAYMENT STATUS (contas a pagar) — single-order transitions
  const markAwaitingPaymentMutation = useMutation({
    mutationFn: (id: string) => markOrderAwaitingPayment(id),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markOrderPaid(id),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  const markInstallmentPaidMutation = useMutation({
    mutationFn: (installmentId: string) => markOrderInstallmentPaid(installmentId),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  // Attach comprovante(s) to an order — payment-side endpoint so accounting can
  // index a receipt when settling a payable without full order-edit rights.
  const attachReceiptsMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => attachOrderReceipts(id, data),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  // ADMIN: PENDING → AWAITING_PAYMENT (Requisitar Pagamento) and its reverse.
  const requestPaymentMutation = useMutation({
    mutationFn: (id: string) => requestOrderPayment(id),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  const cancelPaymentRequestMutation = useMutation({
    mutationFn: (id: string) => cancelOrderPaymentRequest(id),
    onSuccess: (data) => {
      invalidateQueries(data.data?.supplierId || undefined);
    },
  });

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    markAwaitingPaymentMutation.isPending ||
    markPaidMutation.isPending ||
    markInstallmentPaidMutation.isPending ||
    attachReceiptsMutation.isPending ||
    requestPaymentMutation.isPending ||
    cancelPaymentRequestMutation.isPending;

  const error =
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error ||
    markAwaitingPaymentMutation.error ||
    markPaidMutation.error ||
    markInstallmentPaidMutation.error ||
    attachReceiptsMutation.error ||
    requestPaymentMutation.error ||
    cancelPaymentRequestMutation.error;

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    markAwaitingPayment: markAwaitingPaymentMutation.mutate,
    markAwaitingPaymentAsync: markAwaitingPaymentMutation.mutateAsync,
    markPaid: markPaidMutation.mutate,
    markPaidAsync: markPaidMutation.mutateAsync,
    markInstallmentPaid: markInstallmentPaidMutation.mutate,
    markInstallmentPaidAsync: markInstallmentPaidMutation.mutateAsync,
    attachReceipts: attachReceiptsMutation.mutate,
    attachReceiptsAsync: attachReceiptsMutation.mutateAsync,
    requestPayment: requestPaymentMutation.mutate,
    requestPaymentAsync: requestPaymentMutation.mutateAsync,
    cancelPaymentRequest: cancelPaymentRequestMutation.mutate,
    cancelPaymentRequestAsync: cancelPaymentRequestMutation.mutateAsync,
    isLoading,
    error,
    refresh: () => invalidateQueries(),
    // Individual mutation states
    createMutation,
    updateMutation,
    deleteMutation,
    markAwaitingPaymentMutation,
    markPaidMutation,
    markInstallmentPaidMutation,
    attachReceiptsMutation,
    requestPaymentMutation,
    cancelPaymentRequestMutation,
  };
};

export const useOrderBatchMutations = (options?: {
  onBatchCreateSuccess?: (
    data: OrderBatchCreateResponse<OrderCreateFormData>,
    variables: OrderBatchCreateFormData,
  ) => void;
  onBatchUpdateSuccess?: (
    data: OrderBatchUpdateResponse<OrderUpdateFormData>,
    variables: OrderBatchUpdateFormData,
  ) => void;
  onBatchDeleteSuccess?: (
    data: OrderBatchDeleteResponse,
    variables: OrderBatchDeleteFormData,
  ) => void;
}) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: orderKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: orderKeys.statistics(),
    });
    queryClient.invalidateQueries({
      queryKey: orderKeys.pending(),
    });
    queryClient.invalidateQueries({
      queryKey: orderItemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: activityKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: itemKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: supplierKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: orderScheduleKeys.all,
    });
  };

  // BATCH CREATE
  const batchCreateMutation = useMutation({
    mutationFn: (data: OrderBatchCreateFormData) => batchCreateOrders(data),
    onSuccess: (response, variables) => {
      invalidateQueries();

      // Invalidate specific supplier and schedule queries
      if (response.data?.success) {
        const supplierIds = new Set(
          response.data.success
            .map((order) => order.supplierId)
            .filter((id): id is string => !!id),
        );
        const scheduleIds = new Set(
          response.data.success
            .map((order) => order.orderScheduleId)
            .filter((id): id is string => !!id),
        );

        supplierIds.forEach((supplierId) => {
          queryClient.invalidateQueries({
            queryKey: orderKeys.bySupplier(supplierId),
          });
        });

        scheduleIds.forEach((scheduleId) => {
          queryClient.invalidateQueries({
            queryKey: orderScheduleKeys.detail(scheduleId),
          });
        });
      }

      options?.onBatchCreateSuccess?.(response, variables);
    },
  });

  // BATCH UPDATE
  const batchUpdateMutation = useMutation({
    mutationFn: (data: OrderBatchUpdateFormData) => batchUpdateOrders(data),
    onSuccess: (response, variables) => {
      invalidateQueries();

      // Check for received orders and invalidate accordingly
      if (response.data?.success) {
        const receivedOrders = response.data.success.filter(
          (order) => order.status === ORDER_STATUS.RECEIVED,
        );
        if (receivedOrders.length > 0) {
          queryClient.invalidateQueries({
            queryKey: itemKeys.all,
          });
        }
      }

      options?.onBatchUpdateSuccess?.(response, variables);
    },
  });

  // BATCH DELETE
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteOrders,
    onSuccess: (data, variables) => {
      invalidateQueries();
      options?.onBatchDeleteSuccess?.(data, variables);
    },
  });

  // BATCH PAYMENT STATUS (contas a pagar) — single API call per batch, so the
  // axios interceptor emits exactly one toast for the whole operation.
  const batchMarkAwaitingPaymentMutation = useMutation({
    mutationFn: (data: OrderBatchPaymentFormData) => batchMarkOrdersAwaitingPayment(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  const batchMarkPaidMutation = useMutation({
    mutationFn: (data: OrderBatchPaymentFormData) => batchMarkOrdersPaid(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  const batchRequestPaymentMutation = useMutation({
    mutationFn: (data: OrderBatchPaymentFormData) => batchRequestOrdersPayment(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  const batchCancelPaymentRequestMutation = useMutation({
    mutationFn: (data: OrderBatchPaymentFormData) => batchCancelOrdersPaymentRequest(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  const isLoading =
    batchCreateMutation.isPending ||
    batchUpdateMutation.isPending ||
    batchDeleteMutation.isPending ||
    batchMarkAwaitingPaymentMutation.isPending ||
    batchMarkPaidMutation.isPending ||
    batchRequestPaymentMutation.isPending ||
    batchCancelPaymentRequestMutation.isPending;

  const error =
    batchCreateMutation.error ||
    batchUpdateMutation.error ||
    batchDeleteMutation.error ||
    batchMarkAwaitingPaymentMutation.error ||
    batchMarkPaidMutation.error ||
    batchRequestPaymentMutation.error ||
    batchCancelPaymentRequestMutation.error;

  return {
    batchCreate: batchCreateMutation.mutate,
    batchCreateAsync: batchCreateMutation.mutateAsync,
    batchUpdate: batchUpdateMutation.mutate,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchDelete: batchDeleteMutation.mutate,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
    batchMarkAwaitingPayment: batchMarkAwaitingPaymentMutation.mutate,
    batchMarkAwaitingPaymentAsync: batchMarkAwaitingPaymentMutation.mutateAsync,
    batchMarkPaid: batchMarkPaidMutation.mutate,
    batchMarkPaidAsync: batchMarkPaidMutation.mutateAsync,
    batchRequestPayment: batchRequestPaymentMutation.mutate,
    batchRequestPaymentAsync: batchRequestPaymentMutation.mutateAsync,
    batchCancelPaymentRequest: batchCancelPaymentRequestMutation.mutate,
    batchCancelPaymentRequestAsync: batchCancelPaymentRequestMutation.mutateAsync,
    isLoading,
    error,
    refresh: invalidateQueries,
    // Individual mutation states
    batchCreateMutation,
    batchUpdateMutation,
    batchDeleteMutation,
    batchMarkAwaitingPaymentMutation,
    batchMarkPaidMutation,
    batchRequestPaymentMutation,
    batchCancelPaymentRequestMutation,
  };
};

// =====================================================
// Backward Compatibility Exports
// =====================================================

export const useCreateOrder = () => {
  const mutations = useOrderMutations();
  return {
    ...mutations.createMutation,
    mutate: mutations.create,
    mutateAsync: mutations.createAsync,
  };
};

export const useUpdateOrder = (id: string) => {
  const mutations = useOrderMutations();
  return {
    mutate: (data: OrderUpdateFormData) => mutations.update({ id, data }),
    mutateAsync: (data: OrderUpdateFormData) =>
      mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeleteOrder = () => {
  const mutations = useOrderMutations();
  return {
    ...mutations.deleteMutation,
    mutate: mutations.delete,
    mutateAsync: mutations.deleteAsync,
  };
};

export const useBatchCreateOrders = () => {
  const mutations = useOrderBatchMutations();
  return {
    ...mutations.batchCreateMutation,
    mutate: mutations.batchCreate,
    mutateAsync: mutations.batchCreateAsync,
  };
};

export const useBatchUpdateOrders = () => {
  const mutations = useOrderBatchMutations();
  return {
    ...mutations.batchUpdateMutation,
    mutate: mutations.batchUpdate,
    mutateAsync: mutations.batchUpdateAsync,
  };
};

export const useBatchDeleteOrders = () => {
  const mutations = useOrderBatchMutations();
  return {
    ...mutations.batchDeleteMutation,
    mutate: mutations.batchDelete,
    mutateAsync: mutations.batchDeleteAsync,
  };
};

// Re-export OrderItem and OrderSchedule hooks for backward compatibility
export {
  // OrderItem hooks
  useOrderItems,
  useOrderItem,
  useOrderItemsByOrder,
  useCreateOrderItem,
  useUpdateOrderItem,
  useDeleteOrderItem,
} from "./use-order-item";

export {
  // OrderSchedule hooks
  useOrderSchedules,
  useOrderSchedule,
  useActiveOrderSchedules,
  useInactiveOrderSchedules,
  useCreateOrderSchedule,
  useUpdateOrderSchedule,
  useDeleteOrderSchedule,
} from "./use-order-schedule";
