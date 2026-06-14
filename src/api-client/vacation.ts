// api-client/vacation.ts
// Férias (Departamento Pessoal) — Part C

import { apiClient } from "./axiosClient";
import type {
  VacationGetManyFormData,
  VacationCreateFormData,
  VacationUpdateFormData,
  VacationBatchCreateFormData,
  VacationBatchUpdateFormData,
  VacationBatchDeleteFormData,
  VacationAdvanceFormData,
  VacationSetPeriodsFormData,
} from "../schemas/vacation";
import type {
  Vacation,
  VacationGetUniqueResponse,
  VacationGetManyResponse,
  VacationCreateResponse,
  VacationUpdateResponse,
  VacationDeleteResponse,
  VacationBatchCreateResponse,
  VacationBatchUpdateResponse,
  VacationBatchDeleteResponse,
  VacationCalculateResponse,
} from "../types/vacation";

// =====================
// Vacation Service Class
// =====================

export class VacationService {
  private readonly basePath = "/vacations";

  // Query Operations
  async getVacations(params?: VacationGetManyFormData): Promise<VacationGetManyResponse> {
    const response = await apiClient.get<VacationGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getVacationById(id: string, params?: any): Promise<VacationGetUniqueResponse> {
    const response = await apiClient.get<VacationGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // Mutation Operations
  async createVacation(data: VacationCreateFormData, query?: any): Promise<VacationCreateResponse> {
    const response = await apiClient.post<VacationCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateVacation(id: string, data: VacationUpdateFormData, query?: any): Promise<VacationUpdateResponse> {
    const response = await apiClient.put<VacationUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteVacation(id: string): Promise<VacationDeleteResponse> {
    const response = await apiClient.delete<VacationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Periods / Status Machine / Calculation
  async setVacationPeriods(id: string, data: VacationSetPeriodsFormData): Promise<VacationUpdateResponse> {
    const response = await apiClient.put<VacationUpdateResponse>(`${this.basePath}/${id}/periods`, data);
    return response.data;
  }

  async calculateVacation(id: string): Promise<VacationCalculateResponse> {
    const response = await apiClient.post<VacationCalculateResponse>(`${this.basePath}/${id}/calculate`);
    return response.data;
  }

  async advanceVacation(id: string, data: VacationAdvanceFormData = {}, query?: any): Promise<VacationUpdateResponse> {
    const response = await apiClient.put<VacationUpdateResponse>(`${this.basePath}/${id}/advance`, data, { params: query });
    return response.data;
  }

  // Batch Operations
  async batchCreateVacations(data: VacationBatchCreateFormData, query?: any): Promise<VacationBatchCreateResponse<Vacation>> {
    const response = await apiClient.post<VacationBatchCreateResponse<Vacation>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateVacations(data: VacationBatchUpdateFormData, query?: any): Promise<VacationBatchUpdateResponse<Vacation>> {
    const response = await apiClient.put<VacationBatchUpdateResponse<Vacation>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteVacations(data: VacationBatchDeleteFormData, query?: any): Promise<VacationBatchDeleteResponse> {
    const response = await apiClient.delete<VacationBatchDeleteResponse>(`${this.basePath}/batch`, { data, params: query });
    return response.data;
  }
}

export const vacationService = new VacationService();

// Query Operations
export const getVacations = (params?: VacationGetManyFormData) => vacationService.getVacations(params);
export const getVacationById = (id: string, params?: any) => vacationService.getVacationById(id, params);

// Mutation Operations
export const createVacation = (data: VacationCreateFormData, query?: any) => vacationService.createVacation(data, query);
export const updateVacation = (id: string, data: VacationUpdateFormData, query?: any) => vacationService.updateVacation(id, data, query);
export const deleteVacation = (id: string) => vacationService.deleteVacation(id);

// Periods / Status Machine / Calculation
export const setVacationPeriods = (id: string, data: VacationSetPeriodsFormData) => vacationService.setVacationPeriods(id, data);
export const calculateVacation = (id: string) => vacationService.calculateVacation(id);
export const advanceVacation = (id: string, data?: VacationAdvanceFormData, query?: any) => vacationService.advanceVacation(id, data, query);

// Batch Operations
export const batchCreateVacations = (data: VacationBatchCreateFormData, query?: any) => vacationService.batchCreateVacations(data, query);
export const batchUpdateVacations = (data: VacationBatchUpdateFormData, query?: any) => vacationService.batchUpdateVacations(data, query);
export const batchDeleteVacations = (data: VacationBatchDeleteFormData, query?: any) => vacationService.batchDeleteVacations(data, query);
