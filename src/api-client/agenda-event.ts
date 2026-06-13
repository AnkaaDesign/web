// agenda-event.ts
// Agenda com avisos — eventos do calendário com lembretes configuráveis.

import { apiClient } from "./axiosClient";
import type {
  AgendaEventGetManyFormData,
  AgendaEventCreateFormData,
  AgendaEventUpdateFormData,
  AgendaEventBatchCreateFormData,
  AgendaEventBatchUpdateFormData,
  AgendaEventBatchDeleteFormData,
} from "../schemas/agenda-event";
import type {
  AgendaEvent,
  AgendaEventGetUniqueResponse,
  AgendaEventGetManyResponse,
  AgendaEventCreateResponse,
  AgendaEventUpdateResponse,
  AgendaEventDeleteResponse,
  AgendaEventBatchCreateResponse,
  AgendaEventBatchUpdateResponse,
  AgendaEventBatchDeleteResponse,
} from "../types/agenda-event";

// =====================
// AgendaEvent Service Class
// =====================

export class AgendaEventService {
  private readonly basePath = "/agenda-events";

  // =====================
  // Query Operations
  // =====================

  async getAgendaEvents(params?: AgendaEventGetManyFormData): Promise<AgendaEventGetManyResponse> {
    const response = await apiClient.get<AgendaEventGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getAgendaEventById(id: string, params?: any): Promise<AgendaEventGetUniqueResponse> {
    const response = await apiClient.get<AgendaEventGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createAgendaEvent(data: AgendaEventCreateFormData, query?: any): Promise<AgendaEventCreateResponse> {
    const response = await apiClient.post<AgendaEventCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateAgendaEvent(id: string, data: AgendaEventUpdateFormData, query?: any): Promise<AgendaEventUpdateResponse> {
    const response = await apiClient.put<AgendaEventUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteAgendaEvent(id: string): Promise<AgendaEventDeleteResponse> {
    const response = await apiClient.delete<AgendaEventDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateAgendaEvents(data: AgendaEventBatchCreateFormData, query?: any): Promise<AgendaEventBatchCreateResponse<AgendaEvent>> {
    const response = await apiClient.post<AgendaEventBatchCreateResponse<AgendaEvent>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateAgendaEvents(data: AgendaEventBatchUpdateFormData, query?: any): Promise<AgendaEventBatchUpdateResponse<AgendaEvent>> {
    const response = await apiClient.put<AgendaEventBatchUpdateResponse<AgendaEvent>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteAgendaEvents(data: AgendaEventBatchDeleteFormData, query?: any): Promise<AgendaEventBatchDeleteResponse> {
    const response = await apiClient.delete<AgendaEventBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const agendaEventService = new AgendaEventService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getAgendaEvents = (params?: AgendaEventGetManyFormData) => agendaEventService.getAgendaEvents(params);
export const getAgendaEventById = (id: string, params?: any) => agendaEventService.getAgendaEventById(id, params);

// Mutation Operations
export const createAgendaEvent = (data: AgendaEventCreateFormData, query?: any) => agendaEventService.createAgendaEvent(data, query);
export const updateAgendaEvent = (id: string, data: AgendaEventUpdateFormData, query?: any) => agendaEventService.updateAgendaEvent(id, data, query);
export const deleteAgendaEvent = (id: string) => agendaEventService.deleteAgendaEvent(id);

// Batch Operations
export const batchCreateAgendaEvents = (data: AgendaEventBatchCreateFormData, query?: any) => agendaEventService.batchCreateAgendaEvents(data, query);
export const batchUpdateAgendaEvents = (data: AgendaEventBatchUpdateFormData, query?: any) => agendaEventService.batchUpdateAgendaEvents(data, query);
export const batchDeleteAgendaEvents = (data: AgendaEventBatchDeleteFormData, query?: any) => agendaEventService.batchDeleteAgendaEvents(data, query);
