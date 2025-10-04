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
export const createOrder = (data: OrderCreateFormData, query?: OrderQueryFormData) => orderService.createOrder(data, query);
export const updateOrder = (id: string, data: OrderUpdateFormData, query?: OrderQueryFormData) => orderService.updateOrder(id, data, query);
export const deleteOrder = (id: string) => orderService.deleteOrder(id);
export const batchCreateOrders = (data: OrderBatchCreateFormData, query?: OrderQueryFormData) => orderService.batchCreateOrders(data, query);
export const batchUpdateOrders = (data: OrderBatchUpdateFormData, query?: OrderQueryFormData) => orderService.batchUpdateOrders(data, query);
export const batchDeleteOrders = (data: OrderBatchDeleteFormData) => orderService.batchDeleteOrders(data);

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
