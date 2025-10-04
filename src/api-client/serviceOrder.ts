// packages/api/src/serviceOrder.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ServiceOrderGetManyFormData,
  ServiceOrderGetByIdFormData,
  ServiceOrderCreateFormData,
  ServiceOrderUpdateFormData,
  ServiceOrderBatchCreateFormData,
  ServiceOrderBatchUpdateFormData,
  ServiceOrderBatchDeleteFormData,
  ServiceOrderQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  ServiceOrderGetUniqueResponse,
  ServiceOrderGetManyResponse,
  ServiceOrderCreateResponse,
  ServiceOrderUpdateResponse,
  ServiceOrderDeleteResponse,
  ServiceOrderBatchCreateResponse,
  ServiceOrderBatchUpdateResponse,
  ServiceOrderBatchDeleteResponse,
} from "../types";

// =====================
// ServiceOrder Class
// =====================

export class ServiceOrderService {
  private readonly basePath = "/service-orders";

  // =====================
  // Query Operations
  // =====================

  async getServiceOrders(params: ServiceOrderGetManyFormData = {}): Promise<ServiceOrderGetManyResponse> {
    const response = await apiClient.get<ServiceOrderGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getServiceOrder(params: ServiceOrderGetByIdFormData): Promise<ServiceOrderGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<ServiceOrderGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createServiceOrder(data: ServiceOrderCreateFormData, query?: ServiceOrderQueryFormData): Promise<ServiceOrderCreateResponse> {
    const response = await apiClient.post<ServiceOrderCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateServiceOrder(id: string, data: ServiceOrderUpdateFormData, query?: ServiceOrderQueryFormData): Promise<ServiceOrderUpdateResponse> {
    const response = await apiClient.put<ServiceOrderUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteServiceOrder(id: string): Promise<ServiceOrderDeleteResponse> {
    const response = await apiClient.delete<ServiceOrderDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateServiceOrders(data: ServiceOrderBatchCreateFormData, query?: ServiceOrderQueryFormData): Promise<ServiceOrderBatchCreateResponse<ServiceOrderCreateFormData>> {
    const response = await apiClient.post<ServiceOrderBatchCreateResponse<ServiceOrderCreateFormData>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateServiceOrders(data: ServiceOrderBatchUpdateFormData, query?: ServiceOrderQueryFormData): Promise<ServiceOrderBatchUpdateResponse<ServiceOrderUpdateFormData>> {
    const response = await apiClient.put<ServiceOrderBatchUpdateResponse<ServiceOrderUpdateFormData>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteServiceOrders(data: ServiceOrderBatchDeleteFormData): Promise<ServiceOrderBatchDeleteResponse> {
    const response = await apiClient.delete<ServiceOrderBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const serviceOrderService = new ServiceOrderService();

// ServiceOrder exports
export const getServiceOrders = (params: ServiceOrderGetManyFormData = {}) => serviceOrderService.getServiceOrders(params);
export const getServiceOrderById = (params: ServiceOrderGetByIdFormData) => serviceOrderService.getServiceOrder(params);
export const createServiceOrder = (data: ServiceOrderCreateFormData, query?: ServiceOrderQueryFormData) => serviceOrderService.createServiceOrder(data, query);
export const updateServiceOrder = (id: string, data: ServiceOrderUpdateFormData, query?: ServiceOrderQueryFormData) => serviceOrderService.updateServiceOrder(id, data, query);
export const deleteServiceOrder = (id: string) => serviceOrderService.deleteServiceOrder(id);
export const batchCreateServiceOrders = (data: ServiceOrderBatchCreateFormData, query?: ServiceOrderQueryFormData) => serviceOrderService.batchCreateServiceOrders(data, query);
export const batchUpdateServiceOrders = (data: ServiceOrderBatchUpdateFormData, query?: ServiceOrderQueryFormData) => serviceOrderService.batchUpdateServiceOrders(data, query);
export const batchDeleteServiceOrders = (data: ServiceOrderBatchDeleteFormData) => serviceOrderService.batchDeleteServiceOrders(data);
