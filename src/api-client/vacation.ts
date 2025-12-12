// packages/api-client/src/vacation.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  VacationGetManyFormData,
  VacationGetByIdFormData,
  VacationCreateFormData,
  VacationUpdateFormData,
  VacationBatchCreateFormData,
  VacationBatchUpdateFormData,
  VacationBatchDeleteFormData,
  VacationQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Vacation,
  VacationGetUniqueResponse,
  VacationGetManyResponse,
  VacationCreateResponse,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateResponse,
  VacationBatchUpdateResponse,
  VacationBatchDeleteResponse,
} from "../types";

// =====================
// Vacation Service Class
// =====================

export class VacationService {
  private readonly basePath = "/vacations";

  // =====================
  // Query Operations
  // =====================

  async getVacations(params?: VacationGetManyFormData): Promise<VacationGetManyResponse> {
    const response = await apiClient.get<VacationGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getMyVacations(params?: VacationGetManyFormData): Promise<VacationGetManyResponse> {
    const response = await apiClient.get<VacationGetManyResponse>(`${this.basePath}/my-vacations`, {
      params,
    });
    return response.data;
  }

  async getTeamVacations(params?: VacationGetManyFormData): Promise<VacationGetManyResponse> {
    const response = await apiClient.get<VacationGetManyResponse>(`${this.basePath}/team-vacations`, {
      params,
    });
    return response.data;
  }

  async getVacationById(id: string, params?: Omit<VacationGetByIdFormData, "id">): Promise<VacationGetUniqueResponse> {
    const response = await apiClient.get<VacationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createVacation(data: VacationCreateFormData, query?: VacationQueryFormData): Promise<VacationCreateResponse> {
    const response = await apiClient.post<VacationCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateVacation(id: string, data: VacationUpdateFormData, query?: VacationQueryFormData): Promise<VacationUpdateResponse> {
    const response = await apiClient.put<VacationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteVacation(id: string): Promise<VacationDeleteResponse> {
    const response = await apiClient.delete<VacationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateVacations(data: VacationBatchCreateFormData, query?: VacationQueryFormData): Promise<VacationBatchCreateResponse<Vacation>> {
    const response = await apiClient.post<VacationBatchCreateResponse<Vacation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateVacations(data: VacationBatchUpdateFormData, query?: VacationQueryFormData): Promise<VacationBatchUpdateResponse<Vacation>> {
    const response = await apiClient.put<VacationBatchUpdateResponse<Vacation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteVacations(data: VacationBatchDeleteFormData, query?: VacationQueryFormData): Promise<VacationBatchDeleteResponse> {
    const response = await apiClient.delete<VacationBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const vacationService = new VacationService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getVacations = (params?: VacationGetManyFormData) => vacationService.getVacations(params);
export const getMyVacations = (params?: VacationGetManyFormData) => vacationService.getMyVacations(params);
export const getTeamVacations = (params?: VacationGetManyFormData) => vacationService.getTeamVacations(params);
export const getVacationById = (id: string, params?: Omit<VacationGetByIdFormData, "id">) => vacationService.getVacationById(id, params);

// Mutation Operations
export const createVacation = (data: VacationCreateFormData, query?: VacationQueryFormData) => vacationService.createVacation(data, query);
export const updateVacation = (id: string, data: VacationUpdateFormData, query?: VacationQueryFormData) => vacationService.updateVacation(id, data, query);
export const deleteVacation = (id: string) => vacationService.deleteVacation(id);

// Batch Operations
export const batchCreateVacations = (data: VacationBatchCreateFormData, query?: VacationQueryFormData) => vacationService.batchCreateVacations(data, query);
export const batchUpdateVacations = (data: VacationBatchUpdateFormData, query?: VacationQueryFormData) => vacationService.batchUpdateVacations(data, query);
export const batchDeleteVacations = (data: VacationBatchDeleteFormData, query?: VacationQueryFormData) => vacationService.batchDeleteVacations(data, query);
