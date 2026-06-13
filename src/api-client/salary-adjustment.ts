// packages/api-client/src/salary-adjustment.ts
// Reajustes salariais (Departamento Pessoal)

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  SalaryAdjustmentGetManyFormData,
  SalaryAdjustmentGetByIdFormData,
  SalaryAdjustmentApplyFormData,
  SalaryAdjustmentUpdateFormData,
  SalaryAdjustmentQueryFormData,
} from "../schemas/salary-adjustment";
import type {
  // Interface types (for responses)
  SalaryAdjustmentGetUniqueResponse,
  SalaryAdjustmentGetManyResponse,
  SalaryAdjustmentUpdateResponse,
  SalaryAdjustmentDeleteResponse,
  SalaryAdjustmentApplyResponse,
} from "../types/salary-adjustment";

// =====================
// SalaryAdjustment Service Class
// =====================

export class SalaryAdjustmentService {
  private readonly basePath = "/salary-adjustments";

  // =====================
  // Query Operations
  // =====================

  async getSalaryAdjustments(params?: SalaryAdjustmentGetManyFormData): Promise<SalaryAdjustmentGetManyResponse> {
    const response = await apiClient.get<SalaryAdjustmentGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getSalaryAdjustmentById(id: string, params?: Omit<SalaryAdjustmentGetByIdFormData, "id">): Promise<SalaryAdjustmentGetUniqueResponse> {
    const response = await apiClient.get<SalaryAdjustmentGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async applySalaryAdjustment(data: SalaryAdjustmentApplyFormData, queryParams?: SalaryAdjustmentQueryFormData): Promise<SalaryAdjustmentApplyResponse> {
    const response = await apiClient.post<SalaryAdjustmentApplyResponse>(`${this.basePath}/apply`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateSalaryAdjustment(id: string, data: SalaryAdjustmentUpdateFormData, queryParams?: SalaryAdjustmentQueryFormData): Promise<SalaryAdjustmentUpdateResponse> {
    const response = await apiClient.put<SalaryAdjustmentUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteSalaryAdjustment(id: string): Promise<SalaryAdjustmentDeleteResponse> {
    const response = await apiClient.delete<SalaryAdjustmentDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }
}

// =====================
// Service Instance & Exports
// =====================

export const salaryAdjustmentService = new SalaryAdjustmentService();

// Query exports
export const getSalaryAdjustments = (params?: SalaryAdjustmentGetManyFormData) => salaryAdjustmentService.getSalaryAdjustments(params);
export const getSalaryAdjustmentById = (id: string, params?: Omit<SalaryAdjustmentGetByIdFormData, "id">) => salaryAdjustmentService.getSalaryAdjustmentById(id, params);

// Mutation exports
export const applySalaryAdjustment = (data: SalaryAdjustmentApplyFormData, queryParams?: SalaryAdjustmentQueryFormData) =>
  salaryAdjustmentService.applySalaryAdjustment(data, queryParams);
export const updateSalaryAdjustment = (id: string, data: SalaryAdjustmentUpdateFormData, queryParams?: SalaryAdjustmentQueryFormData) =>
  salaryAdjustmentService.updateSalaryAdjustment(id, data, queryParams);
export const deleteSalaryAdjustment = (id: string) => salaryAdjustmentService.deleteSalaryAdjustment(id);
