// packages/api/src/employment-contract.ts
// Vínculos empregatícios (EmploymentContract)

import { apiClient } from "./axiosClient";
import type {
  EmploymentContractGetManyFormData,
  EmploymentContractCreateFormData,
  EmploymentContractUpdateFormData,
  EmploymentContractBatchCreateFormData,
  EmploymentContractBatchUpdateFormData,
  EmploymentContractBatchDeleteFormData,
} from "../schemas/employment-contract";
import type {
  EmploymentContract,
  EmploymentContractGetUniqueResponse,
  EmploymentContractGetManyResponse,
  EmploymentContractCreateResponse,
  EmploymentContractUpdateResponse,
  EmploymentContractDeleteResponse,
  EmploymentContractBatchCreateResponse,
  EmploymentContractBatchUpdateResponse,
  EmploymentContractBatchDeleteResponse,
} from "../types/employment-contract";

// =====================
// EmploymentContract Service Class
// =====================

export class EmploymentContractService {
  private readonly basePath = "/employment-contracts";

  // =====================
  // Query Operations
  // =====================

  async getEmploymentContracts(params?: EmploymentContractGetManyFormData): Promise<EmploymentContractGetManyResponse> {
    const response = await apiClient.get<EmploymentContractGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getEmploymentContractById(id: string, params?: any): Promise<EmploymentContractGetUniqueResponse> {
    const response = await apiClient.get<EmploymentContractGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createEmploymentContract(data: EmploymentContractCreateFormData, query?: any): Promise<EmploymentContractCreateResponse> {
    const response = await apiClient.post<EmploymentContractCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateEmploymentContract(id: string, data: EmploymentContractUpdateFormData, query?: any): Promise<EmploymentContractUpdateResponse> {
    const response = await apiClient.put<EmploymentContractUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteEmploymentContract(id: string): Promise<EmploymentContractDeleteResponse> {
    const response = await apiClient.delete<EmploymentContractDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateEmploymentContracts(data: EmploymentContractBatchCreateFormData, query?: any): Promise<EmploymentContractBatchCreateResponse<EmploymentContract>> {
    const response = await apiClient.post<EmploymentContractBatchCreateResponse<EmploymentContract>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateEmploymentContracts(data: EmploymentContractBatchUpdateFormData, query?: any): Promise<EmploymentContractBatchUpdateResponse<EmploymentContract>> {
    const response = await apiClient.put<EmploymentContractBatchUpdateResponse<EmploymentContract>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteEmploymentContracts(data: EmploymentContractBatchDeleteFormData, query?: any): Promise<EmploymentContractBatchDeleteResponse> {
    const response = await apiClient.delete<EmploymentContractBatchDeleteResponse>(`${this.basePath}/batch`, { data, params: query });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const employmentContractService = new EmploymentContractService();

// =====================
// Export individual functions
// =====================

export const getEmploymentContracts = (params?: EmploymentContractGetManyFormData) => employmentContractService.getEmploymentContracts(params);
export const getEmploymentContractById = (id: string, params?: any) => employmentContractService.getEmploymentContractById(id, params);

export const createEmploymentContract = (data: EmploymentContractCreateFormData, query?: any) => employmentContractService.createEmploymentContract(data, query);
export const updateEmploymentContract = (id: string, data: EmploymentContractUpdateFormData, query?: any) => employmentContractService.updateEmploymentContract(id, data, query);
export const deleteEmploymentContract = (id: string) => employmentContractService.deleteEmploymentContract(id);

export const batchCreateEmploymentContracts = (data: EmploymentContractBatchCreateFormData, query?: any) => employmentContractService.batchCreateEmploymentContracts(data, query);
export const batchUpdateEmploymentContracts = (data: EmploymentContractBatchUpdateFormData, query?: any) => employmentContractService.batchUpdateEmploymentContracts(data, query);
export const batchDeleteEmploymentContracts = (data: EmploymentContractBatchDeleteFormData, query?: any) => employmentContractService.batchDeleteEmploymentContracts(data, query);
