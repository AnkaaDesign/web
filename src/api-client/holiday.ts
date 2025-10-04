// packages/api-client/src/holiday.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  HolidayGetManyFormData,
  HolidayGetByIdFormData,
  HolidayCreateFormData,
  HolidayUpdateFormData,
  HolidayBatchCreateFormData,
  HolidayBatchUpdateFormData,
  HolidayBatchDeleteFormData,
  HolidayQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Holiday,
  HolidayGetUniqueResponse,
  HolidayGetManyResponse,
  HolidayCreateResponse,
  HolidayUpdateResponse,
  HolidayDeleteResponse,
  HolidayBatchCreateResponse,
  HolidayBatchUpdateResponse,
  HolidayBatchDeleteResponse,
} from "../types";

// =====================
// Holiday Service Class
// =====================

export class HolidayService {
  private readonly basePath = "/holidays";

  // =====================
  // Query Operations
  // =====================

  async getHolidays(params?: HolidayGetManyFormData): Promise<HolidayGetManyResponse> {
    const response = await apiClient.get<HolidayGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getHolidayById(id: string, params?: Omit<HolidayGetByIdFormData, "id">): Promise<HolidayGetUniqueResponse> {
    const response = await apiClient.get<HolidayGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createHoliday(data: HolidayCreateFormData, query?: HolidayQueryFormData): Promise<HolidayCreateResponse> {
    const response = await apiClient.post<HolidayCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateHoliday(id: string, data: HolidayUpdateFormData, query?: HolidayQueryFormData): Promise<HolidayUpdateResponse> {
    const response = await apiClient.put<HolidayUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteHoliday(id: string): Promise<HolidayDeleteResponse> {
    const response = await apiClient.delete<HolidayDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateHolidays(data: HolidayBatchCreateFormData, query?: HolidayQueryFormData): Promise<HolidayBatchCreateResponse<Holiday>> {
    const response = await apiClient.post<HolidayBatchCreateResponse<Holiday>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateHolidays(data: HolidayBatchUpdateFormData, query?: HolidayQueryFormData): Promise<HolidayBatchUpdateResponse<Holiday>> {
    const response = await apiClient.put<HolidayBatchUpdateResponse<Holiday>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteHolidays(data: HolidayBatchDeleteFormData, query?: HolidayQueryFormData): Promise<HolidayBatchDeleteResponse> {
    const response = await apiClient.delete<HolidayBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const holidayService = new HolidayService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getHolidays = (params?: HolidayGetManyFormData) => holidayService.getHolidays(params);
export const getHolidayById = (id: string, params?: Omit<HolidayGetByIdFormData, "id">) => holidayService.getHolidayById(id, params);

// Mutation Operations
export const createHoliday = (data: HolidayCreateFormData, query?: HolidayQueryFormData) => holidayService.createHoliday(data, query);
export const updateHoliday = (id: string, data: HolidayUpdateFormData, query?: HolidayQueryFormData) => holidayService.updateHoliday(id, data, query);
export const deleteHoliday = (id: string) => holidayService.deleteHoliday(id);

// Batch Operations
export const batchCreateHolidays = (data: HolidayBatchCreateFormData, query?: HolidayQueryFormData) => holidayService.batchCreateHolidays(data, query);
export const batchUpdateHolidays = (data: HolidayBatchUpdateFormData, query?: HolidayQueryFormData) => holidayService.batchUpdateHolidays(data, query);
export const batchDeleteHolidays = (data: HolidayBatchDeleteFormData, query?: HolidayQueryFormData) => holidayService.batchDeleteHolidays(data, query);
