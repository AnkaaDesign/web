// packages/api-client/src/maintenance.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  MaintenanceGetManyFormData,
  MaintenanceCreateFormData,
  MaintenanceUpdateFormData,
  MaintenanceBatchCreateFormData,
  MaintenanceBatchUpdateFormData,
  MaintenanceBatchDeleteFormData,
  MaintenanceItemGetManyFormData,
  MaintenanceItemCreateFormData,
  MaintenanceItemUpdateFormData,
  MaintenanceItemBatchCreateFormData,
  MaintenanceItemBatchUpdateFormData,
  MaintenanceItemBatchDeleteFormData,
  MaintenanceGetByIdFormData,
  MaintenanceItemGetByIdFormData,
  MaintenanceQueryFormData,
  MaintenanceItemQueryFormData,
  MaintenanceScheduleGetManyFormData,
  MaintenanceScheduleCreateFormData,
  MaintenanceScheduleUpdateFormData,
  MaintenanceScheduleBatchCreateFormData,
  MaintenanceScheduleBatchUpdateFormData,
  MaintenanceScheduleBatchDeleteFormData,
  MaintenanceScheduleGetByIdFormData,
  MaintenanceScheduleQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Maintenance,
  MaintenanceItem,
  MaintenanceGetUniqueResponse,
  MaintenanceGetManyResponse,
  MaintenanceCreateResponse,
  MaintenanceUpdateResponse,
  MaintenanceDeleteResponse,
  MaintenanceBatchCreateResponse,
  MaintenanceBatchUpdateResponse,
  MaintenanceBatchDeleteResponse,
  MaintenanceItemGetUniqueResponse,
  MaintenanceItemGetManyResponse,
  MaintenanceItemCreateResponse,
  MaintenanceItemUpdateResponse,
  MaintenanceItemDeleteResponse,
  MaintenanceItemBatchCreateResponse,
  MaintenanceItemBatchUpdateResponse,
  MaintenanceItemBatchDeleteResponse,
  MaintenanceSchedule,
  MaintenanceScheduleGetUniqueResponse,
  MaintenanceScheduleGetManyResponse,
  MaintenanceScheduleCreateResponse,
  MaintenanceScheduleUpdateResponse,
  MaintenanceScheduleDeleteResponse,
  MaintenanceScheduleBatchCreateResponse,
  MaintenanceScheduleBatchUpdateResponse,
  MaintenanceScheduleBatchDeleteResponse,
} from "../types";

// =====================
// Maintenance Service Class
// =====================

export class MaintenanceService {
  private readonly maintenanceBasePath = "/maintenance";
  private readonly itemBasePath = "/maintenance-items";
  private readonly scheduleBasePath = "/maintenance-schedules";

  // =====================
  // Query Operations
  // =====================

  async getMaintenances(params?: MaintenanceGetManyFormData): Promise<MaintenanceGetManyResponse> {
    const response = await apiClient.get<MaintenanceGetManyResponse>(this.maintenanceBasePath, {
      params,
    });
    return response.data;
  }

  async getMaintenanceById(id: string, params?: Omit<MaintenanceGetByIdFormData, "id">): Promise<MaintenanceGetUniqueResponse> {
    const response = await apiClient.get<MaintenanceGetUniqueResponse>(`${this.maintenanceBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createMaintenance(data: MaintenanceCreateFormData, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceCreateResponse> {
    const response = await apiClient.post<MaintenanceCreateResponse>(this.maintenanceBasePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateMaintenance(id: string, data: MaintenanceUpdateFormData, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceUpdateResponse> {
    const response = await apiClient.put<MaintenanceUpdateResponse>(`${this.maintenanceBasePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteMaintenance(id: string): Promise<MaintenanceDeleteResponse> {
    const response = await apiClient.delete<MaintenanceDeleteResponse>(`${this.maintenanceBasePath}/${id}`);
    return response.data;
  }

  async finishMaintenance(id: string, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceUpdateResponse> {
    const response = await apiClient.post<MaintenanceUpdateResponse>(
      `${this.maintenanceBasePath}/${id}/finish`,
      {},
      {
        params: queryParams,
      },
    );
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateMaintenances(data: MaintenanceBatchCreateFormData, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceBatchCreateResponse<Maintenance>> {
    const response = await apiClient.post<MaintenanceBatchCreateResponse<Maintenance>>(`${this.maintenanceBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateMaintenances(data: MaintenanceBatchUpdateFormData, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceBatchUpdateResponse<Maintenance>> {
    const response = await apiClient.put<MaintenanceBatchUpdateResponse<Maintenance>>(`${this.maintenanceBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteMaintenances(data: MaintenanceBatchDeleteFormData): Promise<MaintenanceBatchDeleteResponse> {
    const response = await apiClient.delete<MaintenanceBatchDeleteResponse>(`${this.maintenanceBasePath}/batch`, {
      data,
    });
    return response.data;
  }

  async batchFinishMaintenances(data: { maintenanceIds: string[] }, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceBatchUpdateResponse<Maintenance>> {
    const response = await apiClient.post<MaintenanceBatchUpdateResponse<Maintenance>>(`${this.maintenanceBasePath}/batch/finish`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchStartMaintenances(data: { maintenanceIds: string[] }, queryParams?: MaintenanceQueryFormData): Promise<MaintenanceBatchUpdateResponse<Maintenance>> {
    const response = await apiClient.post<MaintenanceBatchUpdateResponse<Maintenance>>(`${this.maintenanceBasePath}/batch/start`, data, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // MaintenanceItem Query Operations
  // =====================

  async getMaintenanceItems(params?: MaintenanceItemGetManyFormData): Promise<MaintenanceItemGetManyResponse> {
    const response = await apiClient.get<MaintenanceItemGetManyResponse>(this.itemBasePath, {
      params,
    });
    return response.data;
  }

  async getMaintenanceItemById(params: MaintenanceItemGetByIdFormData): Promise<MaintenanceItemGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<MaintenanceItemGetUniqueResponse>(`${this.itemBasePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // MaintenanceItem Mutation Operations
  // =====================

  async createMaintenanceItem(data: MaintenanceItemCreateFormData, queryParams?: MaintenanceItemQueryFormData): Promise<MaintenanceItemCreateResponse> {
    const response = await apiClient.post<MaintenanceItemCreateResponse>(this.itemBasePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateMaintenanceItem(id: string, data: MaintenanceItemUpdateFormData, queryParams?: MaintenanceItemQueryFormData): Promise<MaintenanceItemUpdateResponse> {
    const response = await apiClient.put<MaintenanceItemUpdateResponse>(`${this.itemBasePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteMaintenanceItem(id: string): Promise<MaintenanceItemDeleteResponse> {
    const response = await apiClient.delete<MaintenanceItemDeleteResponse>(`${this.itemBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // MaintenanceItem Batch Operations
  // =====================

  async batchCreateMaintenanceItems(
    data: MaintenanceItemBatchCreateFormData,
    queryParams?: MaintenanceItemQueryFormData,
  ): Promise<MaintenanceItemBatchCreateResponse<MaintenanceItem>> {
    const response = await apiClient.post<MaintenanceItemBatchCreateResponse<MaintenanceItem>>(`${this.itemBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateMaintenanceItems(
    data: MaintenanceItemBatchUpdateFormData,
    queryParams?: MaintenanceItemQueryFormData,
  ): Promise<MaintenanceItemBatchUpdateResponse<MaintenanceItem>> {
    const response = await apiClient.put<MaintenanceItemBatchUpdateResponse<MaintenanceItem>>(`${this.itemBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteMaintenanceItems(data: MaintenanceItemBatchDeleteFormData): Promise<MaintenanceItemBatchDeleteResponse> {
    const response = await apiClient.delete<MaintenanceItemBatchDeleteResponse>(`${this.itemBasePath}/batch`, {
      data,
    });
    return response.data;
  }

  // =====================
  // MaintenanceSchedule Query Operations
  // =====================

  async getMaintenanceSchedules(params?: MaintenanceScheduleGetManyFormData): Promise<MaintenanceScheduleGetManyResponse> {
    const response = await apiClient.get<MaintenanceScheduleGetManyResponse>(this.scheduleBasePath, {
      params,
    });
    return response.data;
  }

  async getMaintenanceScheduleById(params: MaintenanceScheduleGetByIdFormData): Promise<MaintenanceScheduleGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<MaintenanceScheduleGetUniqueResponse>(`${this.scheduleBasePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // MaintenanceSchedule Mutation Operations
  // =====================

  async createMaintenanceSchedule(data: MaintenanceScheduleCreateFormData, queryParams?: MaintenanceScheduleQueryFormData): Promise<MaintenanceScheduleCreateResponse> {
    const response = await apiClient.post<MaintenanceScheduleCreateResponse>(this.scheduleBasePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateMaintenanceSchedule(id: string, data: MaintenanceScheduleUpdateFormData, queryParams?: MaintenanceScheduleQueryFormData): Promise<MaintenanceScheduleUpdateResponse> {
    const response = await apiClient.put<MaintenanceScheduleUpdateResponse>(`${this.scheduleBasePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteMaintenanceSchedule(id: string): Promise<MaintenanceScheduleDeleteResponse> {
    const response = await apiClient.delete<MaintenanceScheduleDeleteResponse>(`${this.scheduleBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // MaintenanceSchedule Batch Operations
  // =====================

  async batchCreateMaintenanceSchedules(
    data: MaintenanceScheduleBatchCreateFormData,
    queryParams?: MaintenanceScheduleQueryFormData,
  ): Promise<MaintenanceScheduleBatchCreateResponse<MaintenanceSchedule>> {
    const response = await apiClient.post<MaintenanceScheduleBatchCreateResponse<MaintenanceSchedule>>(`${this.scheduleBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateMaintenanceSchedules(
    data: MaintenanceScheduleBatchUpdateFormData,
    queryParams?: MaintenanceScheduleQueryFormData,
  ): Promise<MaintenanceScheduleBatchUpdateResponse<MaintenanceSchedule>> {
    const response = await apiClient.put<MaintenanceScheduleBatchUpdateResponse<MaintenanceSchedule>>(`${this.scheduleBasePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteMaintenanceSchedules(data: MaintenanceScheduleBatchDeleteFormData): Promise<MaintenanceScheduleBatchDeleteResponse> {
    const response = await apiClient.delete<MaintenanceScheduleBatchDeleteResponse>(`${this.scheduleBasePath}/batch`, {
      data,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const maintenanceService = new MaintenanceService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getMaintenances = (params?: MaintenanceGetManyFormData) => maintenanceService.getMaintenances(params);
export const getMaintenanceById = (id: string, params?: Omit<MaintenanceGetByIdFormData, "id">) => maintenanceService.getMaintenanceById(id, params);
export const getMaintenanceItems = (params?: MaintenanceItemGetManyFormData) => maintenanceService.getMaintenanceItems(params);
export const getMaintenanceItemById = (id: string, params?: Omit<MaintenanceItemGetByIdFormData, "id">) => maintenanceService.getMaintenanceItemById({ id, ...params });

// Mutation Operations
export const createMaintenance = (data: MaintenanceCreateFormData, queryParams?: MaintenanceQueryFormData) => maintenanceService.createMaintenance(data, queryParams);
export const updateMaintenance = (id: string, data: MaintenanceUpdateFormData, queryParams?: MaintenanceQueryFormData) =>
  maintenanceService.updateMaintenance(id, data, queryParams);
export const deleteMaintenance = (id: string) => maintenanceService.deleteMaintenance(id);
export const finishMaintenance = (id: string, queryParams?: MaintenanceQueryFormData) => maintenanceService.finishMaintenance(id, queryParams);
export const createMaintenanceItem = (data: MaintenanceItemCreateFormData, queryParams?: MaintenanceItemQueryFormData) =>
  maintenanceService.createMaintenanceItem(data, queryParams);
export const updateMaintenanceItem = (id: string, data: MaintenanceItemUpdateFormData, queryParams?: MaintenanceItemQueryFormData) =>
  maintenanceService.updateMaintenanceItem(id, data, queryParams);
export const deleteMaintenanceItem = (id: string) => maintenanceService.deleteMaintenanceItem(id);

// Batch Operations
export const batchCreateMaintenances = (data: MaintenanceBatchCreateFormData, queryParams?: MaintenanceQueryFormData) =>
  maintenanceService.batchCreateMaintenances(data, queryParams);
export const batchUpdateMaintenances = (data: MaintenanceBatchUpdateFormData, queryParams?: MaintenanceQueryFormData) =>
  maintenanceService.batchUpdateMaintenances(data, queryParams);
export const batchDeleteMaintenances = (data: MaintenanceBatchDeleteFormData) => maintenanceService.batchDeleteMaintenances(data);
export const batchFinishMaintenances = (data: { maintenanceIds: string[] }, queryParams?: MaintenanceQueryFormData) =>
  maintenanceService.batchFinishMaintenances(data, queryParams);
export const batchStartMaintenances = (data: { maintenanceIds: string[] }, queryParams?: MaintenanceQueryFormData) => maintenanceService.batchStartMaintenances(data, queryParams);
export const batchCreateMaintenanceItems = (data: MaintenanceItemBatchCreateFormData, queryParams?: MaintenanceItemQueryFormData) =>
  maintenanceService.batchCreateMaintenanceItems(data, queryParams);
export const batchUpdateMaintenanceItems = (data: MaintenanceItemBatchUpdateFormData, queryParams?: MaintenanceItemQueryFormData) =>
  maintenanceService.batchUpdateMaintenanceItems(data, queryParams);
export const batchDeleteMaintenanceItems = (data: MaintenanceItemBatchDeleteFormData) => maintenanceService.batchDeleteMaintenanceItems(data);

// MaintenanceSchedule Operations
export const getMaintenanceSchedules = (params?: MaintenanceScheduleGetManyFormData) => maintenanceService.getMaintenanceSchedules(params);
export const getMaintenanceScheduleById = (id: string, params?: Omit<MaintenanceScheduleGetByIdFormData, "id">) => maintenanceService.getMaintenanceScheduleById({ id, ...params });
export const createMaintenanceSchedule = (data: MaintenanceScheduleCreateFormData, queryParams?: MaintenanceScheduleQueryFormData) =>
  maintenanceService.createMaintenanceSchedule(data, queryParams);
export const updateMaintenanceSchedule = (id: string, data: MaintenanceScheduleUpdateFormData, queryParams?: MaintenanceScheduleQueryFormData) =>
  maintenanceService.updateMaintenanceSchedule(id, data, queryParams);
export const deleteMaintenanceSchedule = (id: string) => maintenanceService.deleteMaintenanceSchedule(id);
export const batchCreateMaintenanceSchedules = (data: MaintenanceScheduleBatchCreateFormData, queryParams?: MaintenanceScheduleQueryFormData) =>
  maintenanceService.batchCreateMaintenanceSchedules(data, queryParams);
export const batchUpdateMaintenanceSchedules = (data: MaintenanceScheduleBatchUpdateFormData, queryParams?: MaintenanceScheduleQueryFormData) =>
  maintenanceService.batchUpdateMaintenanceSchedules(data, queryParams);
export const batchDeleteMaintenanceSchedules = (data: MaintenanceScheduleBatchDeleteFormData) => maintenanceService.batchDeleteMaintenanceSchedules(data);
