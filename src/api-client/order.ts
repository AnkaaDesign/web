// packages/api-client/src/order.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  OrderGetManyFormData,
  OrderGetByIdFormData,
  OrderCreateFormData,
  OrderUpdateFormData,
  OrderBatchCreateFormData,
  OrderBatchUpdateFormData,
  OrderBatchDeleteFormData,
  OrderBatchPaymentFormData,
  OrderQueryFormData,
  OrderItemGetManyFormData,
  OrderItemGetByIdFormData,
  OrderItemCreateFormData,
  OrderItemUpdateFormData,
  OrderItemBatchCreateFormData,
  OrderItemBatchUpdateFormData,
  OrderItemBatchDeleteFormData,
  OrderItemQueryFormData,
  OrderScheduleGetManyFormData,
  OrderScheduleGetByIdFormData,
  OrderScheduleCreateFormData,
  OrderScheduleUpdateFormData,
  OrderScheduleBatchCreateFormData,
  OrderScheduleBatchUpdateFormData,
  OrderScheduleBatchDeleteFormData,
  OrderScheduleQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  OrderGetManyResponse,
  OrderGetUniqueResponse,
  OrderCreateResponse,
  OrderUpdateResponse,
  OrderDeleteResponse,
  OrderBatchCreateResponse,
  OrderBatchUpdateResponse,
  OrderBatchDeleteResponse,
  OrderItemGetManyResponse,
  OrderItemGetUniqueResponse,
  OrderItemCreateResponse,
  OrderItemUpdateResponse,
  OrderItemDeleteResponse,
  OrderItemBatchCreateResponse,
  OrderItemBatchUpdateResponse,
  OrderItemBatchDeleteResponse,
  OrderScheduleGetManyResponse,
  OrderScheduleGetUniqueResponse,
  OrderScheduleCreateResponse,
  OrderScheduleUpdateResponse,
  OrderScheduleDeleteResponse,
  OrderScheduleBatchCreateResponse,
  OrderScheduleBatchUpdateResponse,
  OrderScheduleBatchDeleteResponse,
  OrderScheduleProjectionResponse,
  OrderScheduleTriggerResponse,
  OrderScheduleExpectedTotalsResponse,
  OrderScheduleCascadeMode,
  OrderPaymentSummaryResponse,
  PayablesResponse,
} from "../types";

// =====================
// Order Service Class
// =====================

export class OrderService {
  private readonly basePath = "/orders";
  private readonly itemBasePath = "/order-items";
  private readonly schedulesBasePath = "/order-schedules";

  // =====================
  // Order Query Operations
  // =====================

  async getOrders(params: OrderGetManyFormData): Promise<OrderGetManyResponse> {
    const response = await apiClient.get<OrderGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getOrderById(id: string, params?: Omit<OrderGetByIdFormData, "id">): Promise<OrderGetUniqueResponse> {
    const response = await apiClient.get<OrderGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  /** Predicted next order number (highest saved + 1) — used to preview the order code before saving. */
  async getNextOrderNumber(): Promise<{ success: boolean; data: { nextOrderNumber: number } }> {
    const response = await apiClient.get<{ success: boolean; data: { nextOrderNumber: number } }>(`${this.basePath}/next-number`);
    return response.data;
  }

  /** Per-paymentStatus aggregates for the Contas a Pagar summary cards (PAID windowed to 90 days, server-side). */
  async getPaymentSummary(): Promise<OrderPaymentSummaryResponse> {
    const response = await apiClient.get<OrderPaymentSummaryResponse>(`${this.basePath}/payment-summary`);
    return response.data;
  }

  /** Unified Contas a Pagar list: open orders + airbrushing painter payments + scheduled/expected outflows, plus per-state summary. */
  async getPayables(): Promise<PayablesResponse> {
    const response = await apiClient.get<PayablesResponse>(`${this.basePath}/payables`);
    return response.data;
  }

  // =====================
  // Order CRUD Operations
  // =====================

  async createOrder(data: OrderCreateFormData, query?: OrderQueryFormData): Promise<OrderCreateResponse> {
    const response = await apiClient.post<OrderCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateOrder(id: string, data: OrderUpdateFormData, query?: OrderQueryFormData): Promise<OrderUpdateResponse> {
    const response = await apiClient.put<OrderUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteOrder(id: string): Promise<OrderDeleteResponse> {
    const response = await apiClient.delete<OrderDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Order Batch Operations
  // =====================

  async batchCreateOrders(data: OrderBatchCreateFormData, query?: OrderQueryFormData): Promise<OrderBatchCreateResponse<OrderCreateFormData>> {
    const response = await apiClient.post<OrderBatchCreateResponse<OrderCreateFormData>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateOrders(data: OrderBatchUpdateFormData, query?: OrderQueryFormData): Promise<OrderBatchUpdateResponse<OrderUpdateFormData>> {
    const response = await apiClient.put<OrderBatchUpdateResponse<OrderUpdateFormData>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteOrders(data: OrderBatchDeleteFormData): Promise<OrderBatchDeleteResponse> {
    const response = await apiClient.delete<OrderBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Order Payment Operations (contas a pagar)
  // =====================

  /** NOT_REQUESTED → REQUESTED (sets paymentRequestedAt). */
  async requestPayment(id: string, query?: OrderQueryFormData): Promise<OrderUpdateResponse> {
    const response = await apiClient.put<OrderUpdateResponse>(`${this.basePath}/${id}/request-payment`, undefined, { params: query });
    return response.data;
  }

  /** NOT_REQUESTED/REQUESTED → AWAITING_PAYMENT. */
  async markAwaitingPayment(id: string, query?: OrderQueryFormData): Promise<OrderUpdateResponse> {
    const response = await apiClient.put<OrderUpdateResponse>(`${this.basePath}/${id}/mark-awaiting-payment`, undefined, { params: query });
    return response.data;
  }

  /** Any non-PAID → PAID (sets paidAt). */
  async markPaid(id: string, query?: OrderQueryFormData): Promise<OrderUpdateResponse> {
    const response = await apiClient.put<OrderUpdateResponse>(`${this.basePath}/${id}/mark-paid`, undefined, { params: query });
    return response.data;
  }

  async batchRequestPayment(data: OrderBatchPaymentFormData, query?: OrderQueryFormData): Promise<OrderBatchUpdateResponse<OrderUpdateFormData>> {
    const response = await apiClient.put<OrderBatchUpdateResponse<OrderUpdateFormData>>(`${this.basePath}/batch/request-payment`, data, { params: query });
    return response.data;
  }

  async batchMarkAwaitingPayment(data: OrderBatchPaymentFormData, query?: OrderQueryFormData): Promise<OrderBatchUpdateResponse<OrderUpdateFormData>> {
    const response = await apiClient.put<OrderBatchUpdateResponse<OrderUpdateFormData>>(`${this.basePath}/batch/mark-awaiting-payment`, data, { params: query });
    return response.data;
  }

  async batchMarkPaid(data: OrderBatchPaymentFormData, query?: OrderQueryFormData): Promise<OrderBatchUpdateResponse<OrderUpdateFormData>> {
    const response = await apiClient.put<OrderBatchUpdateResponse<OrderUpdateFormData>>(`${this.basePath}/batch/mark-paid`, data, { params: query });
    return response.data;
  }

  // =====================
  // OrderItem Operations
  // =====================

  async getOrderItems(params: OrderItemGetManyFormData): Promise<OrderItemGetManyResponse> {
    const response = await apiClient.get<OrderItemGetManyResponse>(this.itemBasePath, { params });
    return response.data;
  }

  async getOrderItemById(id: string, params?: Omit<OrderItemGetByIdFormData, "id">): Promise<OrderItemGetUniqueResponse> {
    const response = await apiClient.get<OrderItemGetUniqueResponse>(`${this.itemBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  async createOrderItem(data: OrderItemCreateFormData, query?: OrderItemQueryFormData): Promise<OrderItemCreateResponse> {
    const response = await apiClient.post<OrderItemCreateResponse>(this.itemBasePath, data, { params: query });
    return response.data;
  }

  async updateOrderItem(id: string, data: OrderItemUpdateFormData, query?: OrderItemQueryFormData): Promise<OrderItemUpdateResponse> {
    const response = await apiClient.put<OrderItemUpdateResponse>(`${this.itemBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteOrderItem(id: string): Promise<OrderItemDeleteResponse> {
    const response = await apiClient.delete<OrderItemDeleteResponse>(`${this.itemBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // OrderItem Batch Operations
  // =====================

  async batchCreateOrderItems(data: OrderItemBatchCreateFormData, query?: OrderItemQueryFormData): Promise<OrderItemBatchCreateResponse<OrderItemCreateFormData>> {
    const response = await apiClient.post<OrderItemBatchCreateResponse<OrderItemCreateFormData>>(`${this.itemBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateOrderItems(data: OrderItemBatchUpdateFormData, query?: OrderItemQueryFormData): Promise<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>> {
    const response = await apiClient.put<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>>(`${this.itemBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteOrderItems(data: OrderItemBatchDeleteFormData): Promise<OrderItemBatchDeleteResponse> {
    const response = await apiClient.delete<OrderItemBatchDeleteResponse>(`${this.itemBasePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // OrderItem Specialized Batch Operations
  // =====================

  async batchMarkOrderItemsFulfilled(ids: string[], query?: OrderItemQueryFormData): Promise<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>> {
    const response = await apiClient.put<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>>(`${this.itemBasePath}/batch/mark-fulfilled`, { ids }, { params: query });
    return response.data;
  }

  async batchMarkOrderItemsReceived(
    items: Array<{ id: string; receivedQuantity: number }>,
    query?: OrderItemQueryFormData,
  ): Promise<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>> {
    const response = await apiClient.put<OrderItemBatchUpdateResponse<OrderItemUpdateFormData>>(`${this.itemBasePath}/batch/mark-received`, { items }, { params: query });
    return response.data;
  }

  // =====================
  // OrderSchedule Operations
  // =====================

  async getOrderSchedules(params: OrderScheduleGetManyFormData): Promise<OrderScheduleGetManyResponse> {
    const response = await apiClient.get<OrderScheduleGetManyResponse>(this.schedulesBasePath, { params });
    return response.data;
  }

  async getOrderScheduleById(id: string, params?: Omit<OrderScheduleGetByIdFormData, "id">): Promise<OrderScheduleGetUniqueResponse> {
    const response = await apiClient.get<OrderScheduleGetUniqueResponse>(`${this.schedulesBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  async createOrderSchedule(data: OrderScheduleCreateFormData, query?: OrderScheduleQueryFormData): Promise<OrderScheduleCreateResponse> {
    const response = await apiClient.post<OrderScheduleCreateResponse>(this.schedulesBasePath, data, { params: query });
    return response.data;
  }

  async updateOrderSchedule(id: string, data: OrderScheduleUpdateFormData, query?: OrderScheduleQueryFormData): Promise<OrderScheduleUpdateResponse> {
    const response = await apiClient.put<OrderScheduleUpdateResponse>(`${this.schedulesBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteOrderSchedule(id: string): Promise<OrderScheduleDeleteResponse> {
    const response = await apiClient.delete<OrderScheduleDeleteResponse>(`${this.schedulesBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // OrderSchedule Batch Operations
  // =====================

  async batchCreateOrderSchedules(
    data: OrderScheduleBatchCreateFormData,
    query?: OrderScheduleQueryFormData,
  ): Promise<OrderScheduleBatchCreateResponse<OrderScheduleCreateFormData>> {
    const response = await apiClient.post<OrderScheduleBatchCreateResponse<OrderScheduleCreateFormData>>(`${this.schedulesBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateOrderSchedules(
    data: OrderScheduleBatchUpdateFormData,
    query?: OrderScheduleQueryFormData,
  ): Promise<OrderScheduleBatchUpdateResponse<OrderScheduleUpdateFormData>> {
    const response = await apiClient.put<OrderScheduleBatchUpdateResponse<OrderScheduleUpdateFormData>>(`${this.schedulesBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteOrderSchedules(data: OrderScheduleBatchDeleteFormData): Promise<OrderScheduleBatchDeleteResponse> {
    const response = await apiClient.delete<OrderScheduleBatchDeleteResponse>(`${this.schedulesBasePath}/batch`, { data });
    return response.data;
  }

  async finishOrderSchedule(id: string): Promise<OrderScheduleUpdateResponse> {
    const response = await apiClient.put<OrderScheduleUpdateResponse>(`${this.schedulesBasePath}/${id}/finish`);
    return response.data;
  }

  async createOrderFromSchedule(id: string): Promise<any> {
    const response = await apiClient.post<any>(`${this.schedulesBasePath}/${id}/create-order`);
    return response.data;
  }

  async getOrderScheduleProjection(id: string): Promise<OrderScheduleProjectionResponse> {
    const response = await apiClient.get<OrderScheduleProjectionResponse>(`${this.schedulesBasePath}/${id}/projection`);
    return response.data;
  }

  async triggerOrderSchedule(
    id: string,
    data: { cascadeMode: OrderScheduleCascadeMode },
    options?: { suppressToast?: boolean },
  ): Promise<OrderScheduleTriggerResponse> {
    const config = options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : undefined;
    const response = await apiClient.post<OrderScheduleTriggerResponse>(`${this.schedulesBasePath}/${id}/trigger`, data, config);
    return response.data;
  }

  async getOrderScheduleExpectedTotals(
    scheduleIds: string[],
    options?: { suppressToast?: boolean },
  ): Promise<OrderScheduleExpectedTotalsResponse> {
    // Read-only batch lookup: suppress the interceptor's auto-toast by default.
    const config = ({ metadata: { suppressToast: options?.suppressToast ?? true } } as any);
    const response = await apiClient.post<OrderScheduleExpectedTotalsResponse>(
      `${this.schedulesBasePath}/expected-totals`,
      { scheduleIds },
      config,
    );
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const orderService = new OrderService();

// =====================
// Export individual functions (for backward compatibility)
// =====================

// Order exports
export const getOrders = (params: OrderGetManyFormData) => orderService.getOrders(params);
export const getOrder = (id: string, params?: Omit<OrderGetByIdFormData, "id">) => orderService.getOrderById(id, params);
export const getOrderById = (id: string, params?: Omit<OrderGetByIdFormData, "id">) => orderService.getOrderById(id, params);
export const getNextOrderNumber = () => orderService.getNextOrderNumber();
export const createOrder = (data: OrderCreateFormData, query?: OrderQueryFormData) => orderService.createOrder(data, query);
export const updateOrder = (id: string, data: OrderUpdateFormData, query?: OrderQueryFormData) => orderService.updateOrder(id, data, query);
export const deleteOrder = (id: string) => orderService.deleteOrder(id);
export const batchCreateOrders = (data: OrderBatchCreateFormData, query?: OrderQueryFormData) => orderService.batchCreateOrders(data, query);
export const batchUpdateOrders = (data: OrderBatchUpdateFormData, query?: OrderQueryFormData) => orderService.batchUpdateOrders(data, query);
export const batchDeleteOrders = (data: OrderBatchDeleteFormData) => orderService.batchDeleteOrders(data);

// Order payment exports (contas a pagar)
export const getOrderPaymentSummary = () => orderService.getPaymentSummary();
export const getOrderPayables = () => orderService.getPayables();
export const requestOrderPayment = (id: string, query?: OrderQueryFormData) => orderService.requestPayment(id, query);
export const markOrderAwaitingPayment = (id: string, query?: OrderQueryFormData) => orderService.markAwaitingPayment(id, query);
export const markOrderPaid = (id: string, query?: OrderQueryFormData) => orderService.markPaid(id, query);
export const batchRequestOrderPayment = (data: OrderBatchPaymentFormData, query?: OrderQueryFormData) => orderService.batchRequestPayment(data, query);
export const batchMarkOrdersAwaitingPayment = (data: OrderBatchPaymentFormData, query?: OrderQueryFormData) => orderService.batchMarkAwaitingPayment(data, query);
export const batchMarkOrdersPaid = (data: OrderBatchPaymentFormData, query?: OrderQueryFormData) => orderService.batchMarkPaid(data, query);

// OrderItem exports
export const getOrderItems = (params: OrderItemGetManyFormData) => orderService.getOrderItems(params);
export const getOrderItem = (id: string, params?: Omit<OrderItemGetByIdFormData, "id">) => orderService.getOrderItemById(id, params);
export const getOrderItemById = (id: string, params?: Omit<OrderItemGetByIdFormData, "id">) => orderService.getOrderItemById(id, params);
export const createOrderItem = (data: OrderItemCreateFormData, query?: OrderItemQueryFormData) => orderService.createOrderItem(data, query);
export const updateOrderItem = (id: string, data: OrderItemUpdateFormData, query?: OrderItemQueryFormData) => orderService.updateOrderItem(id, data, query);
export const deleteOrderItem = (id: string) => orderService.deleteOrderItem(id);
export const batchCreateOrderItems = (data: OrderItemBatchCreateFormData, query?: OrderItemQueryFormData) => orderService.batchCreateOrderItems(data, query);
export const batchUpdateOrderItems = (data: OrderItemBatchUpdateFormData, query?: OrderItemQueryFormData) => orderService.batchUpdateOrderItems(data, query);
export const batchDeleteOrderItems = (data: OrderItemBatchDeleteFormData) => orderService.batchDeleteOrderItems(data);
export const batchMarkOrderItemsFulfilled = (ids: string[], query?: OrderItemQueryFormData) => orderService.batchMarkOrderItemsFulfilled(ids, query);
export const batchMarkOrderItemsReceived = (items: Array<{ id: string; receivedQuantity: number }>, query?: OrderItemQueryFormData) =>
  orderService.batchMarkOrderItemsReceived(items, query);

// OrderSchedule exports
export const getOrderSchedules = (params: OrderScheduleGetManyFormData) => orderService.getOrderSchedules(params);
export const getOrderSchedule = (id: string, params?: Omit<OrderScheduleGetByIdFormData, "id">) => orderService.getOrderScheduleById(id, params);
export const getOrderScheduleById = (id: string, params?: Omit<OrderScheduleGetByIdFormData, "id">) => orderService.getOrderScheduleById(id, params);
export const createOrderSchedule = (data: OrderScheduleCreateFormData, query?: OrderScheduleQueryFormData) => orderService.createOrderSchedule(data, query);
export const updateOrderSchedule = (id: string, data: OrderScheduleUpdateFormData, query?: OrderScheduleQueryFormData) => orderService.updateOrderSchedule(id, data, query);
export const deleteOrderSchedule = (id: string) => orderService.deleteOrderSchedule(id);
export const batchCreateOrderSchedules = (data: OrderScheduleBatchCreateFormData, query?: OrderScheduleQueryFormData) => orderService.batchCreateOrderSchedules(data, query);
export const batchUpdateOrderSchedules = (data: OrderScheduleBatchUpdateFormData, query?: OrderScheduleQueryFormData) => orderService.batchUpdateOrderSchedules(data, query);
export const batchDeleteOrderSchedules = (data: OrderScheduleBatchDeleteFormData) => orderService.batchDeleteOrderSchedules(data);
export const finishOrderSchedule = (id: string) => orderService.finishOrderSchedule(id);
export const createOrderFromSchedule = (id: string) => orderService.createOrderFromSchedule(id);
export const getOrderScheduleProjection = (id: string) => orderService.getOrderScheduleProjection(id);
export const triggerOrderSchedule = (id: string, data: { cascadeMode: OrderScheduleCascadeMode }, options?: { suppressToast?: boolean }) =>
  orderService.triggerOrderSchedule(id, data, options);
export const getOrderScheduleExpectedTotals = (scheduleIds: string[], options?: { suppressToast?: boolean }) =>
  orderService.getOrderScheduleExpectedTotals(scheduleIds, options);
