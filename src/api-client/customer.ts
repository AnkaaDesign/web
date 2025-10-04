// packages/api-client/src/customer.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  CustomerGetManyFormData,
  CustomerCreateFormData,
  CustomerQuickCreateFormData,
  CustomerUpdateFormData,
  CustomerBatchCreateFormData,
  CustomerBatchUpdateFormData,
  CustomerBatchDeleteFormData,
  CustomerGetByIdFormData,
  CustomerQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  CustomerGetUniqueResponse,
  CustomerGetManyResponse,
  CustomerCreateResponse,
  CustomerUpdateResponse,
  CustomerDeleteResponse,
  CustomerBatchCreateResponse,
  CustomerBatchUpdateResponse,
  CustomerBatchDeleteResponse,
} from "../types";

// =====================
// Customer Service Class
// =====================

export class CustomerService {
  private readonly basePath = "/customers";

  // =====================
  // Query Operations
  // =====================

  async getCustomers(params?: CustomerGetManyFormData): Promise<CustomerGetManyResponse> {
    const response = await apiClient.get<CustomerGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getCustomerById(id: string, params?: Omit<CustomerGetByIdFormData, "id">): Promise<CustomerGetUniqueResponse> {
    const response = await apiClient.get<CustomerGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createCustomer(data: CustomerCreateFormData, query?: CustomerQueryFormData): Promise<CustomerCreateResponse> {
    const response = await apiClient.post<CustomerCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async quickCreateCustomer(data: CustomerQuickCreateFormData, query?: CustomerQueryFormData): Promise<CustomerCreateResponse> {
    const response = await apiClient.post<CustomerCreateResponse>(`${this.basePath}/quick`, data, {
      params: query,
    });
    return response.data;
  }

  async updateCustomer(id: string, data: CustomerUpdateFormData, query?: CustomerQueryFormData): Promise<CustomerUpdateResponse> {
    const response = await apiClient.put<CustomerUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteCustomer(id: string): Promise<CustomerDeleteResponse> {
    const response = await apiClient.delete<CustomerDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateCustomers(data: CustomerBatchCreateFormData, query?: CustomerQueryFormData): Promise<CustomerBatchCreateResponse> {
    const response = await apiClient.post<CustomerBatchCreateResponse>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateCustomers(data: CustomerBatchUpdateFormData, query?: CustomerQueryFormData): Promise<CustomerBatchUpdateResponse> {
    const response = await apiClient.put<CustomerBatchUpdateResponse>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteCustomers(data: CustomerBatchDeleteFormData, query?: CustomerQueryFormData): Promise<CustomerBatchDeleteResponse> {
    const response = await apiClient.delete<CustomerBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const customerService = new CustomerService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getCustomers = (params?: CustomerGetManyFormData) => customerService.getCustomers(params);
export const getCustomerById = (id: string, params?: Omit<CustomerGetByIdFormData, "id">) => customerService.getCustomerById(id, params);

// Mutation Operations
export const createCustomer = (data: CustomerCreateFormData, query?: CustomerQueryFormData) => customerService.createCustomer(data, query);
export const quickCreateCustomer = (data: CustomerQuickCreateFormData, query?: CustomerQueryFormData) => customerService.quickCreateCustomer(data, query);
export const updateCustomer = (id: string, data: CustomerUpdateFormData, query?: CustomerQueryFormData) => customerService.updateCustomer(id, data, query);
export const deleteCustomer = (id: string) => customerService.deleteCustomer(id);

// Batch Operations
export const batchCreateCustomers = (data: CustomerBatchCreateFormData, query?: CustomerQueryFormData) => customerService.batchCreateCustomers(data, query);
export const batchUpdateCustomers = (data: CustomerBatchUpdateFormData, query?: CustomerQueryFormData) => customerService.batchUpdateCustomers(data, query);
export const batchDeleteCustomers = (data: CustomerBatchDeleteFormData, query?: CustomerQueryFormData) => customerService.batchDeleteCustomers(data, query);
