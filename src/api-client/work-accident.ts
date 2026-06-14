// api-client/work-accident.ts
// CAT — Comunicação de Acidente de Trabalho (Medicina do Trabalho, Part E)

import { apiClient } from "./axiosClient";
import type {
  WorkAccidentReportGetManyFormData,
  WorkAccidentReportCreateFormData,
  WorkAccidentReportUpdateFormData,
  WorkAccidentReportBatchCreateFormData,
  WorkAccidentReportBatchUpdateFormData,
  WorkAccidentReportBatchDeleteFormData,
} from "../schemas/work-accident";
import type {
  WorkAccidentReport,
  WorkAccidentReportGetUniqueResponse,
  WorkAccidentReportGetManyResponse,
  WorkAccidentReportCreateResponse,
  WorkAccidentReportUpdateResponse,
  WorkAccidentReportDeleteResponse,
  WorkAccidentReportBatchCreateResponse,
  WorkAccidentReportBatchUpdateResponse,
  WorkAccidentReportBatchDeleteResponse,
} from "../types/work-accident";

// =====================
// Work Accident (CAT) Service Class
// =====================

export class WorkAccidentReportService {
  private readonly basePath = "/work-accident-reports";

  // Query Operations
  async getWorkAccidentReports(params?: WorkAccidentReportGetManyFormData): Promise<WorkAccidentReportGetManyResponse> {
    const response = await apiClient.get<WorkAccidentReportGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getWorkAccidentReportById(id: string, params?: any): Promise<WorkAccidentReportGetUniqueResponse> {
    const response = await apiClient.get<WorkAccidentReportGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // Mutation Operations
  async createWorkAccidentReport(data: WorkAccidentReportCreateFormData, query?: any): Promise<WorkAccidentReportCreateResponse> {
    const response = await apiClient.post<WorkAccidentReportCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateWorkAccidentReport(id: string, data: WorkAccidentReportUpdateFormData, query?: any): Promise<WorkAccidentReportUpdateResponse> {
    const response = await apiClient.put<WorkAccidentReportUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteWorkAccidentReport(id: string): Promise<WorkAccidentReportDeleteResponse> {
    const response = await apiClient.delete<WorkAccidentReportDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Batch Operations
  async batchCreateWorkAccidentReports(data: WorkAccidentReportBatchCreateFormData, query?: any): Promise<WorkAccidentReportBatchCreateResponse<WorkAccidentReport>> {
    const response = await apiClient.post<WorkAccidentReportBatchCreateResponse<WorkAccidentReport>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateWorkAccidentReports(data: WorkAccidentReportBatchUpdateFormData, query?: any): Promise<WorkAccidentReportBatchUpdateResponse<WorkAccidentReport>> {
    const response = await apiClient.put<WorkAccidentReportBatchUpdateResponse<WorkAccidentReport>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteWorkAccidentReports(data: WorkAccidentReportBatchDeleteFormData, query?: any): Promise<WorkAccidentReportBatchDeleteResponse> {
    const response = await apiClient.delete<WorkAccidentReportBatchDeleteResponse>(`${this.basePath}/batch`, { data, params: query });
    return response.data;
  }
}

export const workAccidentReportService = new WorkAccidentReportService();

// Query Operations
export const getWorkAccidentReports = (params?: WorkAccidentReportGetManyFormData) => workAccidentReportService.getWorkAccidentReports(params);
export const getWorkAccidentReportById = (id: string, params?: any) => workAccidentReportService.getWorkAccidentReportById(id, params);

// Mutation Operations
export const createWorkAccidentReport = (data: WorkAccidentReportCreateFormData, query?: any) => workAccidentReportService.createWorkAccidentReport(data, query);
export const updateWorkAccidentReport = (id: string, data: WorkAccidentReportUpdateFormData, query?: any) => workAccidentReportService.updateWorkAccidentReport(id, data, query);
export const deleteWorkAccidentReport = (id: string) => workAccidentReportService.deleteWorkAccidentReport(id);

// Batch Operations
export const batchCreateWorkAccidentReports = (data: WorkAccidentReportBatchCreateFormData, query?: any) => workAccidentReportService.batchCreateWorkAccidentReports(data, query);
export const batchUpdateWorkAccidentReports = (data: WorkAccidentReportBatchUpdateFormData, query?: any) => workAccidentReportService.batchUpdateWorkAccidentReports(data, query);
export const batchDeleteWorkAccidentReports = (data: WorkAccidentReportBatchDeleteFormData, query?: any) => workAccidentReportService.batchDeleteWorkAccidentReports(data, query);
