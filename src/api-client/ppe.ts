// packages/api-client/src/ppe.ts

import { apiClient } from "./axiosClient";
import type {
  // PpeSize Schema types
  PpeSizeGetManyFormData,
  PpeSizeGetByIdFormData,
  PpeSizeCreateFormData,
  PpeSizeUpdateFormData,
  PpeSizeBatchCreateFormData,
  PpeSizeBatchUpdateFormData,
  PpeSizeBatchDeleteFormData,
  // PpeDelivery Schema types
  PpeDeliveryGetManyFormData,
  PpeDeliveryGetByIdFormData,
  PpeDeliveryCreateFormData,
  PpeDeliveryUpdateFormData,
  PpeDeliveryBatchCreateFormData,
  PpeDeliveryBatchUpdateFormData,
  PpeDeliveryBatchDeleteFormData,
  // PpeDeliverySchedule Schema types
  PpeDeliveryScheduleGetManyFormData,
  PpeDeliveryScheduleGetByIdFormData,
  PpeDeliveryScheduleCreateFormData,
  PpeDeliveryScheduleUpdateFormData,
  PpeDeliveryScheduleBatchCreateFormData,
  PpeDeliveryScheduleBatchUpdateFormData,
  PpeDeliveryScheduleBatchDeleteFormData,
  // Query types
  PpeSizeQueryFormData,
  PpeDeliveryQueryFormData,
  PpeDeliveryScheduleQueryFormData,
} from "../schemas";
import type {
  // Entity types
  PpeSize,
  PpeDelivery,
  PpeDeliverySchedule,
  // PpeSize Interface types
  PpeSizeGetUniqueResponse,
  PpeSizeGetManyResponse,
  PpeSizeCreateResponse,
  PpeSizeUpdateResponse,
  PpeSizeDeleteResponse,
  PpeSizeBatchCreateResponse,
  PpeSizeBatchUpdateResponse,
  PpeSizeBatchDeleteResponse,
  // PpeDelivery Interface types
  PpeDeliveryGetUniqueResponse,
  PpeDeliveryGetManyResponse,
  PpeDeliveryCreateResponse,
  PpeDeliveryUpdateResponse,
  PpeDeliveryDeleteResponse,
  PpeDeliveryBatchCreateResponse,
  PpeDeliveryBatchUpdateResponse,
  PpeDeliveryBatchDeleteResponse,
  // PpeDeliverySchedule Interface types
  PpeDeliveryScheduleGetUniqueResponse,
  PpeDeliveryScheduleGetManyResponse,
  PpeDeliveryScheduleCreateResponse,
  PpeDeliveryScheduleUpdateResponse,
  PpeDeliveryScheduleDeleteResponse,
  PpeDeliveryScheduleBatchCreateResponse,
  PpeDeliveryScheduleBatchUpdateResponse,
  PpeDeliveryScheduleBatchDeleteResponse,
} from "../types";
import { PPE_TYPE } from "../constants";

// =====================
// PpeSize Service Class
// =====================

export class PpeSizeService {
  private readonly basePath = "/ppe/sizes";

  // =====================
  // Query Operations
  // =====================

  async getPpeSizes(params: PpeSizeGetManyFormData = {}): Promise<PpeSizeGetManyResponse> {
    const response = await apiClient.get<PpeSizeGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPpeSizeById(id: string, params?: Omit<PpeSizeGetByIdFormData, "id">): Promise<PpeSizeGetUniqueResponse> {
    const response = await apiClient.get<PpeSizeGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPpeSize(data: PpeSizeCreateFormData, query?: PpeSizeQueryFormData): Promise<PpeSizeCreateResponse> {
    const response = await apiClient.post<PpeSizeCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updatePpeSize(id: string, data: PpeSizeUpdateFormData, query?: PpeSizeQueryFormData): Promise<PpeSizeUpdateResponse> {
    const response = await apiClient.put<PpeSizeUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deletePpeSize(id: string): Promise<PpeSizeDeleteResponse> {
    const response = await apiClient.delete<PpeSizeDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePpeSizes(data: PpeSizeBatchCreateFormData, query?: PpeSizeQueryFormData): Promise<PpeSizeBatchCreateResponse<PpeSize>> {
    const response = await apiClient.post<PpeSizeBatchCreateResponse<PpeSize>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdatePpeSizes(data: PpeSizeBatchUpdateFormData, query?: PpeSizeQueryFormData): Promise<PpeSizeBatchUpdateResponse<PpeSize>> {
    const response = await apiClient.put<PpeSizeBatchUpdateResponse<PpeSize>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeletePpeSizes(data: PpeSizeBatchDeleteFormData, query?: PpeSizeQueryFormData): Promise<PpeSizeBatchDeleteResponse> {
    const response = await apiClient.delete<PpeSizeBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }

  // =====================
  // Custom Endpoints
  // =====================

  async getPpeSizesByMask(maskSize: string, query?: PpeSizeQueryFormData): Promise<PpeSizeGetManyResponse> {
    const response = await apiClient.get<PpeSizeGetManyResponse>(`${this.basePath}/by-mask/${maskSize}`, {
      params: query,
    });
    return response.data;
  }

  async getPpeSizeByUserId(userId: string, query?: PpeSizeQueryFormData): Promise<PpeSizeGetUniqueResponse> {
    const response = await apiClient.get<PpeSizeGetUniqueResponse>(`${this.basePath}/user/${userId}`, {
      params: query,
    });
    return response.data;
  }
}

// =====================
// PpeDelivery Service Class
// =====================

export class PpeDeliveryService {
  private readonly basePath = "/ppe/deliveries";

  // =====================
  // Query Operations
  // =====================

  async getPpeDeliveries(params: PpeDeliveryGetManyFormData = {}): Promise<PpeDeliveryGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPpeDeliveryById(id: string, params?: Omit<PpeDeliveryGetByIdFormData, "id">): Promise<PpeDeliveryGetUniqueResponse> {
    const response = await apiClient.get<PpeDeliveryGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPpeDelivery(data: PpeDeliveryCreateFormData, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryCreateResponse> {
    const response = await apiClient.post<PpeDeliveryCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updatePpeDelivery(id: string, data: PpeDeliveryUpdateFormData, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryUpdateResponse> {
    const response = await apiClient.put<PpeDeliveryUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deletePpeDelivery(id: string): Promise<PpeDeliveryDeleteResponse> {
    const response = await apiClient.delete<PpeDeliveryDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePpeDeliveries(data: PpeDeliveryBatchCreateFormData, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryBatchCreateResponse<PpeDelivery>> {
    const response = await apiClient.post<PpeDeliveryBatchCreateResponse<PpeDelivery>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdatePpeDeliveries(data: PpeDeliveryBatchUpdateFormData, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryBatchUpdateResponse<PpeDelivery>> {
    const response = await apiClient.put<PpeDeliveryBatchUpdateResponse<PpeDelivery>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeletePpeDeliveries(data: PpeDeliveryBatchDeleteFormData, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryBatchDeleteResponse> {
    const response = await apiClient.delete<PpeDeliveryBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }

  // =====================
  // Custom Endpoints
  // =====================

  async markAsDelivered(id: string, deliveryDate?: Date): Promise<PpeDeliveryUpdateResponse> {
    const response = await apiClient.post<PpeDeliveryUpdateResponse>(`${this.basePath}/mark-delivered/${id}`, {
      deliveryDate,
    });
    return response.data;
  }

  async requestPpeDelivery(data: Omit<PpeDeliveryCreateFormData, "userId" | "status" | "statusOrder">, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryCreateResponse> {
    const response = await apiClient.post<PpeDeliveryCreateResponse>(`${this.basePath}/request`, data, {
      params: query,
    });
    return response.data;
  }

  async getMyPpeDeliveries(params?: PpeDeliveryGetManyFormData): Promise<PpeDeliveryGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryGetManyResponse>(`${this.basePath}/my-requests`, { params });
    return response.data;
  }

  async getAvailablePpeForUser(userId: string, ppeType?: PPE_TYPE, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryGetManyResponse>(`${this.basePath}/available-for-user/${userId}`, {
      params: {
        ...query,
        ppeType,
      },
    });
    return response.data;
  }

  async getMyAvailablePpe(ppeType?: PPE_TYPE, query?: PpeDeliveryQueryFormData): Promise<PpeDeliveryGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryGetManyResponse>(`${this.basePath}/my-available`, {
      params: {
        ...query,
        ppeType,
      },
    });
    return response.data;
  }

  async batchApprove(
    deliveryIds: string[],
    approvedBy?: string,
  ): Promise<{
    success: number;
    failed: number;
    results: any[];
  }> {
    const response = await apiClient.post<{
      success: number;
      failed: number;
      results: any[];
    }>(`${this.basePath}/batch-approve`, {
      deliveryIds,
      approvedBy,
    });
    return response.data;
  }

  async batchReject(
    deliveryIds: string[],
    reviewedBy?: string,
    reason?: string,
  ): Promise<{
    success: number;
    failed: number;
    results: any[];
  }> {
    const response = await apiClient.post<{
      success: number;
      failed: number;
      results: any[];
    }>(`${this.basePath}/batch-reject`, {
      deliveryIds,
      reviewedBy,
      reason,
    });
    return response.data;
  }
}

// =====================
// PpeDeliverySchedule Service Class
// =====================

export class PpeDeliveryScheduleService {
  private readonly basePath = "/ppe/schedules";

  // =====================
  // Query Operations
  // =====================

  async getPpeDeliverySchedules(params: PpeDeliveryScheduleGetManyFormData = {}): Promise<PpeDeliveryScheduleGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryScheduleGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPpeDeliveryScheduleById(id: string, params?: Omit<PpeDeliveryScheduleGetByIdFormData, "id">): Promise<PpeDeliveryScheduleGetUniqueResponse> {
    const response = await apiClient.get<PpeDeliveryScheduleGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPpeDeliverySchedule(data: PpeDeliveryScheduleCreateFormData, query?: PpeDeliveryScheduleQueryFormData): Promise<PpeDeliveryScheduleCreateResponse> {
    const response = await apiClient.post<PpeDeliveryScheduleCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updatePpeDeliverySchedule(id: string, data: PpeDeliveryScheduleUpdateFormData, query?: PpeDeliveryScheduleQueryFormData): Promise<PpeDeliveryScheduleUpdateResponse> {
    const response = await apiClient.put<PpeDeliveryScheduleUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deletePpeDeliverySchedule(id: string): Promise<PpeDeliveryScheduleDeleteResponse> {
    const response = await apiClient.delete<PpeDeliveryScheduleDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePpeDeliverySchedules(
    data: PpeDeliveryScheduleBatchCreateFormData,
    query?: PpeDeliveryScheduleQueryFormData,
  ): Promise<PpeDeliveryScheduleBatchCreateResponse<PpeDeliverySchedule>> {
    const response = await apiClient.post<PpeDeliveryScheduleBatchCreateResponse<PpeDeliverySchedule>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdatePpeDeliverySchedules(
    data: PpeDeliveryScheduleBatchUpdateFormData,
    query?: PpeDeliveryScheduleQueryFormData,
  ): Promise<PpeDeliveryScheduleBatchUpdateResponse<PpeDeliverySchedule>> {
    const response = await apiClient.put<PpeDeliveryScheduleBatchUpdateResponse<PpeDeliverySchedule>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeletePpeDeliverySchedules(data: PpeDeliveryScheduleBatchDeleteFormData, query?: PpeDeliveryScheduleQueryFormData): Promise<PpeDeliveryScheduleBatchDeleteResponse> {
    const response = await apiClient.delete<PpeDeliveryScheduleBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const ppeSizeService = new PpeSizeService();
export const ppeDeliveryService = new PpeDeliveryService();
export const ppeDeliveryScheduleService = new PpeDeliveryScheduleService();

// PpeSize exports
export const getPpeSizes = (params?: PpeSizeGetManyFormData) => ppeSizeService.getPpeSizes(params);
export const getPpeSizeById = (id: string, params?: Omit<PpeSizeGetByIdFormData, "id">) => ppeSizeService.getPpeSizeById(id, params);
export const createPpeSize = (data: PpeSizeCreateFormData, query?: PpeSizeQueryFormData) => ppeSizeService.createPpeSize(data, query);
export const updatePpeSize = (id: string, data: PpeSizeUpdateFormData, query?: PpeSizeQueryFormData) => ppeSizeService.updatePpeSize(id, data, query);
export const deletePpeSize = (id: string) => ppeSizeService.deletePpeSize(id);
export const batchCreatePpeSizes = (data: PpeSizeBatchCreateFormData, query?: PpeSizeQueryFormData) => ppeSizeService.batchCreatePpeSizes(data, query);
export const batchUpdatePpeSizes = (data: PpeSizeBatchUpdateFormData, query?: PpeSizeQueryFormData) => ppeSizeService.batchUpdatePpeSizes(data, query);
export const batchDeletePpeSizes = (data: PpeSizeBatchDeleteFormData, query?: PpeSizeQueryFormData) => ppeSizeService.batchDeletePpeSizes(data, query);
export const getPpeSizesByMask = (maskSize: string, query?: PpeSizeQueryFormData) => ppeSizeService.getPpeSizesByMask(maskSize, query);
export const getPpeSizeByUserId = (userId: string, query?: PpeSizeQueryFormData) => ppeSizeService.getPpeSizeByUserId(userId, query);

// PpeDelivery exports
export const getPpeDeliveries = (params?: PpeDeliveryGetManyFormData) => ppeDeliveryService.getPpeDeliveries(params);
export const getPpeDeliveryById = (id: string, params?: Omit<PpeDeliveryGetByIdFormData, "id">) => ppeDeliveryService.getPpeDeliveryById(id, params);
export const createPpeDelivery = (data: PpeDeliveryCreateFormData, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.createPpeDelivery(data, query);
export const updatePpeDelivery = (id: string, data: PpeDeliveryUpdateFormData, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.updatePpeDelivery(id, data, query);
export const deletePpeDelivery = (id: string) => ppeDeliveryService.deletePpeDelivery(id);
export const batchCreatePpeDeliveries = (data: PpeDeliveryBatchCreateFormData, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.batchCreatePpeDeliveries(data, query);
export const batchUpdatePpeDeliveries = (data: PpeDeliveryBatchUpdateFormData, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.batchUpdatePpeDeliveries(data, query);
export const batchDeletePpeDeliveries = (data: PpeDeliveryBatchDeleteFormData, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.batchDeletePpeDeliveries(data, query);
export const markPpeDeliveryAsDelivered = (id: string, deliveryDate?: Date) => ppeDeliveryService.markAsDelivered(id, deliveryDate);
export const requestPpeDelivery = (data: Omit<PpeDeliveryCreateFormData, "userId" | "status" | "statusOrder">, query?: PpeDeliveryQueryFormData) =>
  ppeDeliveryService.requestPpeDelivery(data, query);
export const getMyPpeDeliveries = (params?: PpeDeliveryGetManyFormData) => ppeDeliveryService.getMyPpeDeliveries(params);
export const getAvailablePpeForUser = (userId: string, ppeType?: PPE_TYPE, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.getAvailablePpeForUser(userId, ppeType, query);
export const getMyAvailablePpe = (ppeType?: PPE_TYPE, query?: PpeDeliveryQueryFormData) => ppeDeliveryService.getMyAvailablePpe(ppeType, query);
export const batchApprovePpeDeliveries = (deliveryIds: string[], approvedBy?: string) => ppeDeliveryService.batchApprove(deliveryIds, approvedBy);
export const batchRejectPpeDeliveries = (deliveryIds: string[], reviewedBy?: string, reason?: string) => ppeDeliveryService.batchReject(deliveryIds, reviewedBy, reason);

// PpeDeliverySchedule exports
export const getPpeDeliverySchedules = (params?: PpeDeliveryScheduleGetManyFormData) => ppeDeliveryScheduleService.getPpeDeliverySchedules(params);
export const getPpeDeliveryScheduleById = (id: string, params?: Omit<PpeDeliveryScheduleGetByIdFormData, "id">) =>
  ppeDeliveryScheduleService.getPpeDeliveryScheduleById(id, params);
export const createPpeDeliverySchedule = (data: PpeDeliveryScheduleCreateFormData, query?: PpeDeliveryScheduleQueryFormData) =>
  ppeDeliveryScheduleService.createPpeDeliverySchedule(data, query);
export const updatePpeDeliverySchedule = (id: string, data: PpeDeliveryScheduleUpdateFormData, query?: PpeDeliveryScheduleQueryFormData) =>
  ppeDeliveryScheduleService.updatePpeDeliverySchedule(id, data, query);
export const deletePpeDeliverySchedule = (id: string) => ppeDeliveryScheduleService.deletePpeDeliverySchedule(id);
export const batchCreatePpeDeliverySchedules = (data: PpeDeliveryScheduleBatchCreateFormData, query?: PpeDeliveryScheduleQueryFormData) =>
  ppeDeliveryScheduleService.batchCreatePpeDeliverySchedules(data, query);
export const batchUpdatePpeDeliverySchedules = (data: PpeDeliveryScheduleBatchUpdateFormData, query?: PpeDeliveryScheduleQueryFormData) =>
  ppeDeliveryScheduleService.batchUpdatePpeDeliverySchedules(data, query);
export const batchDeletePpeDeliverySchedules = (data: PpeDeliveryScheduleBatchDeleteFormData, query?: PpeDeliveryScheduleQueryFormData) =>
  ppeDeliveryScheduleService.batchDeletePpeDeliverySchedules(data, query);
