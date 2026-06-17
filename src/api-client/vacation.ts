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
  VacationPeriodBalanceResponse,
} from "../types/vacation";

// =====================
// Secullum (ponto) sync visibility
// =====================

export interface VacationDateRange {
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD (inclusive)
}

export type VacationSecullumState = "NOT_LINKED" | "NOT_PUSHED" | "SYNCED" | "OUT_OF_SYNC" | "UNKNOWN";

export interface VacationSecullumStatusData {
  linked: boolean;
  secullumEmployeeId: number | null;
  expectedPeriods: VacationDateRange[];
  pushedAbsences: (VacationDateRange & { id: number })[];
  missing: VacationDateRange[];
  extra: (VacationDateRange & { id: number })[];
  inSync: boolean;
  state: VacationSecullumState;
  message: string;
}

export interface VacationSecullumStatusResponse {
  success: boolean;
  message: string;
  data: VacationSecullumStatusData;
}

export interface VacationSecullumSyncResponse {
  success: boolean;
  message: string;
  data: { success: boolean; message: string; created?: number; removed?: number; skipped?: boolean };
}

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

  // Period balance (remaining-days history across siblings). Keyed by vacation
  // id — the server reads the acquisitive dates from the row, so there's no
  // client date-serialization drift in the grouping.
  async getVacationPeriodBalance(vacationId: string): Promise<VacationPeriodBalanceResponse> {
    const response = await apiClient.get<VacationPeriodBalanceResponse>(`${this.basePath}/${vacationId}/period-balance`);
    return response.data;
  }

  // Status Machine / Calculation
  async calculateVacation(id: string): Promise<VacationCalculateResponse> {
    const response = await apiClient.post<VacationCalculateResponse>(`${this.basePath}/${id}/calculate`);
    return response.data;
  }

  async advanceVacation(id: string, data: VacationAdvanceFormData = {}, query?: any): Promise<VacationUpdateResponse> {
    const response = await apiClient.put<VacationUpdateResponse>(`${this.basePath}/${id}/advance`, data, { params: query });
    return response.data;
  }

  // Secullum (ponto) — read-derived status + manual (re)sync
  async getSecullumStatus(id: string): Promise<VacationSecullumStatusResponse> {
    const response = await apiClient.get<VacationSecullumStatusResponse>(`${this.basePath}/${id}/secullum-status`);
    return response.data;
  }

  async syncSecullum(id: string): Promise<VacationSecullumSyncResponse> {
    const response = await apiClient.post<VacationSecullumSyncResponse>(`${this.basePath}/${id}/sync`);
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

// Period balance / Status Machine / Calculation
export const getVacationPeriodBalance = (vacationId: string) => vacationService.getVacationPeriodBalance(vacationId);
export const calculateVacation = (id: string) => vacationService.calculateVacation(id);
export const advanceVacation = (id: string, data?: VacationAdvanceFormData, query?: any) => vacationService.advanceVacation(id, data, query);

// Secullum (ponto) sync visibility
export const getVacationSecullumStatus = (id: string) => vacationService.getSecullumStatus(id);
export const syncVacationSecullum = (id: string) => vacationService.syncSecullum(id);

// Batch Operations
export const batchCreateVacations = (data: VacationBatchCreateFormData, query?: any) => vacationService.batchCreateVacations(data, query);
export const batchUpdateVacations = (data: VacationBatchUpdateFormData, query?: any) => vacationService.batchUpdateVacations(data, query);
export const batchDeleteVacations = (data: VacationBatchDeleteFormData, query?: any) => vacationService.batchDeleteVacations(data, query);
