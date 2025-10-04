// packages/api/src/changelog.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ChangeLogGetManyFormData,
  ChangeLogGetByIdFormData,
  ChangeLogCreateFormData,
  ChangeLogUpdateFormData,
  ChangeLogBatchCreateFormData,
  ChangeLogBatchUpdateFormData,
  ChangeLogBatchDeleteFormData,
  ChangeLogQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  ChangeLog,
  ChangeLogGetUniqueResponse,
  ChangeLogGetManyResponse,
  ChangeLogCreateResponse,
  ChangeLogUpdateResponse,
  ChangeLogDeleteResponse,
  ChangeLogBatchCreateResponse,
  ChangeLogBatchUpdateResponse,
  ChangeLogBatchDeleteResponse,
} from "../types";

// =====================
// ChangeLog Service Class
// =====================

export class ChangeLogService {
  private readonly basePath = "/changelogs";

  // =====================
  // Query Operations
  // =====================

  async getChangeLogs(params?: ChangeLogGetManyFormData): Promise<ChangeLogGetManyResponse> {
    const response = await apiClient.get<ChangeLogGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getChangeLogById(id: string, params?: Omit<ChangeLogGetByIdFormData, "id">): Promise<ChangeLogGetUniqueResponse> {
    const response = await apiClient.get<ChangeLogGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createChangeLog(data: ChangeLogCreateFormData, query?: ChangeLogQueryFormData): Promise<ChangeLogCreateResponse> {
    const response = await apiClient.post<ChangeLogCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateChangeLog(id: string, data: ChangeLogUpdateFormData, query?: ChangeLogQueryFormData): Promise<ChangeLogUpdateResponse> {
    const response = await apiClient.put<ChangeLogUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteChangeLog(id: string): Promise<ChangeLogDeleteResponse> {
    const response = await apiClient.delete<ChangeLogDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateChangeLogs(data: ChangeLogBatchCreateFormData, query?: ChangeLogQueryFormData): Promise<ChangeLogBatchCreateResponse<ChangeLog>> {
    const response = await apiClient.post<ChangeLogBatchCreateResponse<ChangeLog>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateChangeLogs(data: ChangeLogBatchUpdateFormData, query?: ChangeLogQueryFormData): Promise<ChangeLogBatchUpdateResponse<ChangeLog>> {
    const response = await apiClient.put<ChangeLogBatchUpdateResponse<ChangeLog>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteChangeLogs(data: ChangeLogBatchDeleteFormData, query?: ChangeLogQueryFormData): Promise<ChangeLogBatchDeleteResponse> {
    const response = await apiClient.delete<ChangeLogBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const changeLogService = new ChangeLogService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getChangeLogs = (params?: ChangeLogGetManyFormData) => changeLogService.getChangeLogs(params);
export const getChangeLogById = (id: string, params?: Omit<ChangeLogGetByIdFormData, "id">) => changeLogService.getChangeLogById(id, params);

// Mutation Operations
export const createChangeLog = (data: ChangeLogCreateFormData, query?: ChangeLogQueryFormData) => changeLogService.createChangeLog(data, query);
export const updateChangeLog = (id: string, data: ChangeLogUpdateFormData, query?: ChangeLogQueryFormData) => changeLogService.updateChangeLog(id, data, query);
export const deleteChangeLog = (id: string) => changeLogService.deleteChangeLog(id);

// Batch Operations
export const batchCreateChangeLogs = (data: ChangeLogBatchCreateFormData, query?: ChangeLogQueryFormData) => changeLogService.batchCreateChangeLogs(data, query);
export const batchUpdateChangeLogs = (data: ChangeLogBatchUpdateFormData, query?: ChangeLogQueryFormData) => changeLogService.batchUpdateChangeLogs(data, query);
export const batchDeleteChangeLogs = (data: ChangeLogBatchDeleteFormData, query?: ChangeLogQueryFormData) => changeLogService.batchDeleteChangeLogs(data, query);
