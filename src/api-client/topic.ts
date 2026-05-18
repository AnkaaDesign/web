// packages/api-client/src/topic.ts
//
// Topic endpoints — /topic (+ /topic/:id/levels for the per-topic level upsert)
// See api/src/modules/skill/skill.controller.ts

import { apiClient } from "./axiosClient";
import type {
  TopicGetManyFormData,
  TopicQueryFormData,
  TopicCreateFormData,
  TopicUpdateFormData,
  TopicLevelsUpsertFormData,
  TopicBatchCreateFormData,
  TopicBatchUpdateFormData,
  TopicBatchDeleteFormData,
  TopicGetManyResponse,
  TopicGetUniqueResponse,
  TopicCreateResponse,
  TopicUpdateResponse,
  TopicDeleteResponse,
  TopicLevelsUpsertResponse,
  TopicBatchCreateResponse,
  TopicBatchUpdateResponse,
  TopicBatchDeleteResponse,
  Topic,
} from "../types";

// =====================
// Topic Service
// =====================

export class TopicService {
  private readonly basePath = "/topic";

  // ---- Query ----
  async getTopics(params?: TopicGetManyFormData): Promise<TopicGetManyResponse> {
    const response = await apiClient.get<TopicGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getTopicById(id: string, params?: TopicQueryFormData): Promise<TopicGetUniqueResponse> {
    const response = await apiClient.get<TopicGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // ---- CRUD ----
  async createTopic(
    data: TopicCreateFormData,
    query?: TopicQueryFormData,
  ): Promise<TopicCreateResponse> {
    const response = await apiClient.post<TopicCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateTopic(
    id: string,
    data: TopicUpdateFormData,
    query?: TopicQueryFormData,
  ): Promise<TopicUpdateResponse> {
    const response = await apiClient.patch<TopicUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteTopic(id: string): Promise<TopicDeleteResponse> {
    const response = await apiClient.delete<TopicDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // ---- TopicLevels upsert ----
  /**
   * Upserts all TopicLevel rows (score 0..5) for a given topic in one PUT call.
   * Mirrors /topic/:id/levels in the API.
   */
  async upsertTopicLevels(
    topicId: string,
    data: TopicLevelsUpsertFormData,
  ): Promise<TopicLevelsUpsertResponse> {
    const response = await apiClient.put<TopicLevelsUpsertResponse>(
      `${this.basePath}/${topicId}/levels`,
      data,
    );
    return response.data;
  }

  // ---- Batch ----
  async batchCreateTopics(
    data: TopicBatchCreateFormData,
    query?: TopicQueryFormData,
  ): Promise<TopicBatchCreateResponse<Topic>> {
    const response = await apiClient.post<TopicBatchCreateResponse<Topic>>(
      `${this.basePath}/batch`,
      data,
      { params: query },
    );
    return response.data;
  }

  async batchUpdateTopics(
    data: TopicBatchUpdateFormData,
    query?: TopicQueryFormData,
  ): Promise<TopicBatchUpdateResponse<Topic>> {
    const response = await apiClient.patch<TopicBatchUpdateResponse<Topic>>(
      `${this.basePath}/batch`,
      data,
      { params: query },
    );
    return response.data;
  }

  async batchDeleteTopics(
    data: TopicBatchDeleteFormData,
  ): Promise<TopicBatchDeleteResponse> {
    const response = await apiClient.delete<TopicBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
    });
    return response.data;
  }
}

export const topicService = new TopicService();

// =====================
// Convenience exports
// =====================

export const getTopics = (params?: TopicGetManyFormData) => topicService.getTopics(params);
export const getTopicById = (id: string, params?: TopicQueryFormData) =>
  topicService.getTopicById(id, params);
export const createTopic = (data: TopicCreateFormData, query?: TopicQueryFormData) =>
  topicService.createTopic(data, query);
export const updateTopic = (id: string, data: TopicUpdateFormData, query?: TopicQueryFormData) =>
  topicService.updateTopic(id, data, query);
export const deleteTopic = (id: string) => topicService.deleteTopic(id);
export const upsertTopicLevels = (topicId: string, data: TopicLevelsUpsertFormData) =>
  topicService.upsertTopicLevels(topicId, data);
export const batchCreateTopics = (data: TopicBatchCreateFormData, query?: TopicQueryFormData) =>
  topicService.batchCreateTopics(data, query);
export const batchUpdateTopics = (data: TopicBatchUpdateFormData, query?: TopicQueryFormData) =>
  topicService.batchUpdateTopics(data, query);
export const batchDeleteTopics = (data: TopicBatchDeleteFormData) =>
  topicService.batchDeleteTopics(data);
