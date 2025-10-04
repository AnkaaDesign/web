// packages/api-client/src/service.ts

import { apiClient } from "./axiosClient";
import type {
  ServiceGetManyFormData,
  ServiceGetByIdFormData,
  ServiceCreateFormData,
  ServiceUpdateFormData,
  ServiceBatchCreateFormData,
  ServiceBatchUpdateFormData,
  ServiceBatchDeleteFormData,
  ServiceQueryFormData,
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

export const serviceService = {
  // =====================
  // Standard CRUD Operations
  // =====================

  getServices: async (params?: ServiceGetManyFormData) => {
    const response = await apiClient.get<ServiceGetManyResponse>("/services", { params });
    return response.data;
  },

  getService: async ({ id, include }: ServiceGetByIdFormData) => {
    const response = await apiClient.get<ServiceGetUniqueResponse>(`/services/${id}`, { params: { include } });
    return response.data;
  },

  createService: async (data: ServiceCreateFormData, params?: ServiceQueryFormData) => {
    const response = await apiClient.post<ServiceCreateResponse>("/services", data, { params });
    return response.data;
  },

  updateService: async (id: string, data: ServiceUpdateFormData, params?: ServiceQueryFormData) => {
    const response = await apiClient.put<ServiceUpdateResponse>(`/services/${id}`, data, { params });
    return response.data;
  },

  deleteService: async (id: string) => {
    const response = await apiClient.delete<ServiceDeleteResponse>(`/services/${id}`);
    return response.data;
  },

  // =====================
  // Batch Operations
  // =====================

  batchCreateServices: async (data: ServiceBatchCreateFormData, params?: ServiceQueryFormData) => {
    const response = await apiClient.post<ServiceBatchCreateResponse<ServiceCreateFormData>>("/services/batch", data, { params });
    return response.data;
  },

  batchUpdateServices: async (data: ServiceBatchUpdateFormData, params?: ServiceQueryFormData) => {
    const response = await apiClient.put<ServiceBatchUpdateResponse<ServiceUpdateFormData>>("/services/batch", data, { params });
    return response.data;
  },

  batchDeleteServices: async (data: ServiceBatchDeleteFormData) => {
    const response = await apiClient.delete<ServiceBatchDeleteResponse>("/services/batch", { data });
    return response.data;
  },
};
