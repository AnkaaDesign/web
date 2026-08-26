// packages/api-client/src/message-schedule.ts

import { apiClient } from "./axiosClient";
import type {
  MessageScheduleCreateFormData,
  MessageScheduleUpdateFormData,
  MessageScheduleGetManyFormData,
  MessageScheduleGetManyResponse,
  MessageScheduleGetUniqueResponse,
  MessageScheduleMutationResponse,
  MessageSchedulePreviewResponse,
} from "../schemas/message-schedule";

/**
 * Agendamentos de comunicado recorrente.
 *
 * Raiz `/message-schedules`, e não `/messages/schedules`: o controller de
 * mensagens tem um `@Get(':id')` que engoliria o sub-caminho.
 */
export class MessageScheduleService {
  private readonly basePath = "/message-schedules";

  async getSchedules(params: MessageScheduleGetManyFormData = {}): Promise<MessageScheduleGetManyResponse> {
    const response = await apiClient.get<MessageScheduleGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getScheduleById(id: string): Promise<MessageScheduleGetUniqueResponse> {
    const response = await apiClient.get<MessageScheduleGetUniqueResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async createSchedule(data: MessageScheduleCreateFormData): Promise<MessageScheduleMutationResponse> {
    const response = await apiClient.post<MessageScheduleMutationResponse>(this.basePath, data);
    return response.data;
  }

  async updateSchedule(id: string, data: MessageScheduleUpdateFormData): Promise<MessageScheduleMutationResponse> {
    const response = await apiClient.put<MessageScheduleMutationResponse>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  async deleteSchedule(id: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiClient.delete<{ success: boolean; message?: string }>(`${this.basePath}/${id}`);
    return response.data;
  }

  async pauseSchedule(id: string): Promise<MessageScheduleMutationResponse> {
    const response = await apiClient.patch<MessageScheduleMutationResponse>(`${this.basePath}/${id}/pause`);
    return response.data;
  }

  async resumeSchedule(id: string): Promise<MessageScheduleMutationResponse> {
    const response = await apiClient.patch<MessageScheduleMutationResponse>(`${this.basePath}/${id}/resume`);
    return response.data;
  }

  /** Publica a ocorrência de hoje sem mexer no ciclo. Idempotente por dia. */
  async runNow(id: string): Promise<{ success: boolean; data: any; message?: string }> {
    const response = await apiClient.post<{ success: boolean; data: any; message?: string }>(
      `${this.basePath}/${id}/run-now`,
    );
    return response.data;
  }

  /**
   * Próximas datas de disparo, sem gravar nada. É o que o compositor mostra ao
   * autor antes de salvar — erro de recorrência custa muito mais barato aqui do
   * que descoberto três semanas depois.
   */
  async previewOccurrences(
    data: MessageScheduleCreateFormData,
    count = 5,
  ): Promise<MessageSchedulePreviewResponse> {
    const response = await apiClient.post<MessageSchedulePreviewResponse>(
      `${this.basePath}/preview-occurrences`,
      data,
      { params: { count } },
    );
    return response.data;
  }
}

export const messageScheduleService = new MessageScheduleService();

export const getMessageSchedules = (params?: MessageScheduleGetManyFormData) =>
  messageScheduleService.getSchedules(params || {});
export const getMessageScheduleById = (id: string) => messageScheduleService.getScheduleById(id);
export const createMessageSchedule = (data: MessageScheduleCreateFormData) =>
  messageScheduleService.createSchedule(data);
export const updateMessageSchedule = (id: string, data: MessageScheduleUpdateFormData) =>
  messageScheduleService.updateSchedule(id, data);
export const deleteMessageSchedule = (id: string) => messageScheduleService.deleteSchedule(id);
export const previewMessageScheduleOccurrences = (
  data: MessageScheduleCreateFormData,
  count?: number,
) => messageScheduleService.previewOccurrences(data, count);
