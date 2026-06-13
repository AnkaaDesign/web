// packages/api/src/dependent.ts
// Dependentes do colaborador (dedução IRRF / salário-família)

import { apiClient } from "./axiosClient";
import type { DependentGetManyFormData, DependentCreateFormData, DependentUpdateFormData, DependentBatchCreateFormData, DependentBatchUpdateFormData, DependentBatchDeleteFormData } from "../schemas/dependent";
import type {
  Dependent,
  DependentGetUniqueResponse,
  DependentGetManyResponse,
  DependentCreateResponse,
  DependentUpdateResponse,
  DependentDeleteResponse,
  DependentBatchCreateResponse,
  DependentBatchUpdateResponse,
  DependentBatchDeleteResponse,
} from "../types/dependent";

// =====================
// Dependent Service Class
// =====================

export class DependentService {
  private readonly basePath = "/dependents";

  // =====================
  // Query Operations
  // =====================

  async getDependents(params?: DependentGetManyFormData): Promise<DependentGetManyResponse> {
    const response = await apiClient.get<DependentGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getDependentById(id: string, params?: any): Promise<DependentGetUniqueResponse> {
    const response = await apiClient.get<DependentGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createDependent(data: DependentCreateFormData, query?: any): Promise<DependentCreateResponse> {
    const response = await apiClient.post<DependentCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateDependent(id: string, data: DependentUpdateFormData, query?: any): Promise<DependentUpdateResponse> {
    const response = await apiClient.put<DependentUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteDependent(id: string): Promise<DependentDeleteResponse> {
    const response = await apiClient.delete<DependentDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateDependents(data: DependentBatchCreateFormData, query?: any): Promise<DependentBatchCreateResponse<Dependent>> {
    const response = await apiClient.post<DependentBatchCreateResponse<Dependent>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateDependents(data: DependentBatchUpdateFormData, query?: any): Promise<DependentBatchUpdateResponse<Dependent>> {
    const response = await apiClient.put<DependentBatchUpdateResponse<Dependent>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteDependents(data: DependentBatchDeleteFormData, query?: any): Promise<DependentBatchDeleteResponse> {
    const response = await apiClient.delete<DependentBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const dependentService = new DependentService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getDependents = (params?: DependentGetManyFormData) => dependentService.getDependents(params);
export const getDependentById = (id: string, params?: any) => dependentService.getDependentById(id, params);

// Mutation Operations
export const createDependent = (data: DependentCreateFormData, query?: any) => dependentService.createDependent(data, query);
export const updateDependent = (id: string, data: DependentUpdateFormData, query?: any) => dependentService.updateDependent(id, data, query);
export const deleteDependent = (id: string) => dependentService.deleteDependent(id);

// Batch Operations
export const batchCreateDependents = (data: DependentBatchCreateFormData, query?: any) => dependentService.batchCreateDependents(data, query);
export const batchUpdateDependents = (data: DependentBatchUpdateFormData, query?: any) => dependentService.batchUpdateDependents(data, query);
export const batchDeleteDependents = (data: DependentBatchDeleteFormData, query?: any) => dependentService.batchDeleteDependents(data, query);
