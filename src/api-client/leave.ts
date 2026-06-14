// packages/api/src/leave.ts
// Afastamentos (Medicina do Trabalho)

import { apiClient } from "./axiosClient";
import type { LeaveGetManyFormData, LeaveCreateFormData, LeaveUpdateFormData, LeaveBatchCreateFormData, LeaveBatchUpdateFormData, LeaveBatchDeleteFormData } from "../schemas/leave";
import type {
  Leave,
  LeaveGetUniqueResponse,
  LeaveGetManyResponse,
  LeaveCreateResponse,
  LeaveUpdateResponse,
  LeaveDeleteResponse,
  LeaveBatchCreateResponse,
  LeaveBatchUpdateResponse,
  LeaveBatchDeleteResponse,
  LeavePayrollSplitResponse,
} from "../types/leave";

// =====================
// Leave Service Class
// =====================

export class LeaveService {
  private readonly basePath = "/leaves";

  // =====================
  // Query Operations
  // =====================

  async getLeaves(params?: LeaveGetManyFormData): Promise<LeaveGetManyResponse> {
    const response = await apiClient.get<LeaveGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getLeaveById(id: string, params?: any): Promise<LeaveGetUniqueResponse> {
    const response = await apiClient.get<LeaveGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createLeave(data: LeaveCreateFormData, query?: any): Promise<LeaveCreateResponse> {
    const response = await apiClient.post<LeaveCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateLeave(id: string, data: LeaveUpdateFormData, query?: any): Promise<LeaveUpdateResponse> {
    const response = await apiClient.put<LeaveUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteLeave(id: string): Promise<LeaveDeleteResponse> {
    const response = await apiClient.delete<LeaveDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Finalização do afastamento (→ COMPLETED, data de retorno efetiva)
  async finishLeave(id: string, data: { actualEndDate: Date }, query?: any): Promise<LeaveUpdateResponse> {
    const response = await apiClient.put<LeaveUpdateResponse>(`${this.basePath}/${id}/finish`, data, {
      params: query,
    });
    return response.data;
  }

  // GET :id/payroll-split — first-15-days-employer / 16th-day-INSS split for folha.
  async getLeavePayrollSplit(id: string): Promise<LeavePayrollSplitResponse> {
    const response = await apiClient.get<LeavePayrollSplitResponse>(`${this.basePath}/${id}/payroll-split`);
    return response.data;
  }

  // Upload de arquivos (atestados etc.) — multipart, field "files", até 10 por requisição
  async uploadLeaveFiles(id: string, files: globalThis.File[], query?: any): Promise<LeaveUpdateResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    const response = await apiClient.post<LeaveUpdateResponse>(`${this.basePath}/${id}/files`, formData, {
      params: query,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateLeaves(data: LeaveBatchCreateFormData, query?: any): Promise<LeaveBatchCreateResponse<Leave>> {
    const response = await apiClient.post<LeaveBatchCreateResponse<Leave>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateLeaves(data: LeaveBatchUpdateFormData, query?: any): Promise<LeaveBatchUpdateResponse<Leave>> {
    const response = await apiClient.put<LeaveBatchUpdateResponse<Leave>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteLeaves(data: LeaveBatchDeleteFormData, query?: any): Promise<LeaveBatchDeleteResponse> {
    const response = await apiClient.delete<LeaveBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const leaveService = new LeaveService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getLeaves = (params?: LeaveGetManyFormData) => leaveService.getLeaves(params);
export const getLeaveById = (id: string, params?: any) => leaveService.getLeaveById(id, params);

// Mutation Operations
export const createLeave = (data: LeaveCreateFormData, query?: any) => leaveService.createLeave(data, query);
export const updateLeave = (id: string, data: LeaveUpdateFormData, query?: any) => leaveService.updateLeave(id, data, query);
export const deleteLeave = (id: string) => leaveService.deleteLeave(id);
export const finishLeave = (id: string, data: { actualEndDate: Date }, query?: any) => leaveService.finishLeave(id, data, query);
export const getLeavePayrollSplit = (id: string) => leaveService.getLeavePayrollSplit(id);
export const uploadLeaveFiles = (id: string, files: globalThis.File[], query?: any) => leaveService.uploadLeaveFiles(id, files, query);

// Batch Operations
export const batchCreateLeaves = (data: LeaveBatchCreateFormData, query?: any) => leaveService.batchCreateLeaves(data, query);
export const batchUpdateLeaves = (data: LeaveBatchUpdateFormData, query?: any) => leaveService.batchUpdateLeaves(data, query);
export const batchDeleteLeaves = (data: LeaveBatchDeleteFormData, query?: any) => leaveService.batchDeleteLeaves(data, query);
