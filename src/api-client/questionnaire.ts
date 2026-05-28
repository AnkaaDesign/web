// api-client/questionnaire.ts
//
// Questionnaire catalogue (group / question / options) + campaign endpoints.
// See api/src/modules/questionnaire/questionnaire.controller.ts

import { apiClient } from "./axiosClient";
import type {
  QuestionnaireGroupGetManyFormData,
  QuestionnaireGroupQueryFormData,
  QuestionnaireGroupCreateFormData,
  QuestionnaireGroupUpdateFormData,
  QuestionnaireGroupGetManyResponse,
  QuestionnaireGroupGetUniqueResponse,
  QuestionnaireGroupCreateResponse,
  QuestionnaireGroupUpdateResponse,
  QuestionnaireGroupDeleteResponse,
  QuestionnaireQuestionGetManyFormData,
  QuestionnaireQuestionQueryFormData,
  QuestionnaireQuestionCreateFormData,
  QuestionnaireQuestionUpdateFormData,
  QuestionnaireOptionsUpsertFormData,
  QuestionnaireQuestionGetManyResponse,
  QuestionnaireQuestionGetUniqueResponse,
  QuestionnaireQuestionCreateResponse,
  QuestionnaireQuestionUpdateResponse,
  QuestionnaireQuestionDeleteResponse,
  QuestionnaireOptionsUpsertResponse,
  QuestionnaireGetManyFormData,
  QuestionnaireQueryFormData,
  QuestionnaireCreateFormData,
  QuestionnaireUpdateFormData,
  QuestionnaireGetManyResponse,
  QuestionnaireGetUniqueResponse,
  QuestionnaireCreateResponse,
  QuestionnaireUpdateResponse,
  QuestionnaireDeleteResponse,
  QuestionnaireResultsResponse,
} from "../types";

// ===== Group =====
class QuestionnaireGroupService {
  private readonly basePath = "/questionnaire-group";
  async getMany(params?: QuestionnaireGroupGetManyFormData) {
    return (await apiClient.get<QuestionnaireGroupGetManyResponse>(this.basePath, { params })).data;
  }
  async getById(id: string, params?: QuestionnaireGroupQueryFormData) {
    return (await apiClient.get<QuestionnaireGroupGetUniqueResponse>(`${this.basePath}/${id}`, { params })).data;
  }
  async create(data: QuestionnaireGroupCreateFormData, query?: QuestionnaireGroupQueryFormData) {
    return (await apiClient.post<QuestionnaireGroupCreateResponse>(this.basePath, data, { params: query })).data;
  }
  async update(id: string, data: QuestionnaireGroupUpdateFormData, query?: QuestionnaireGroupQueryFormData) {
    return (await apiClient.patch<QuestionnaireGroupUpdateResponse>(`${this.basePath}/${id}`, data, { params: query })).data;
  }
  async delete(id: string) {
    return (await apiClient.delete<QuestionnaireGroupDeleteResponse>(`${this.basePath}/${id}`)).data;
  }
}

// ===== Question + options =====
class QuestionnaireQuestionService {
  private readonly basePath = "/questionnaire-question";
  async getMany(params?: QuestionnaireQuestionGetManyFormData) {
    return (await apiClient.get<QuestionnaireQuestionGetManyResponse>(this.basePath, { params })).data;
  }
  async getById(id: string, params?: QuestionnaireQuestionQueryFormData) {
    return (await apiClient.get<QuestionnaireQuestionGetUniqueResponse>(`${this.basePath}/${id}`, { params })).data;
  }
  async create(data: QuestionnaireQuestionCreateFormData, query?: QuestionnaireQuestionQueryFormData) {
    return (await apiClient.post<QuestionnaireQuestionCreateResponse>(this.basePath, data, { params: query })).data;
  }
  async update(id: string, data: QuestionnaireQuestionUpdateFormData, query?: QuestionnaireQuestionQueryFormData) {
    return (await apiClient.patch<QuestionnaireQuestionUpdateResponse>(`${this.basePath}/${id}`, data, { params: query })).data;
  }
  async delete(id: string) {
    return (await apiClient.delete<QuestionnaireQuestionDeleteResponse>(`${this.basePath}/${id}`)).data;
  }
  async upsertOptions(id: string, data: QuestionnaireOptionsUpsertFormData) {
    return (await apiClient.put<QuestionnaireOptionsUpsertResponse>(`${this.basePath}/${id}/options`, data)).data;
  }
}

// ===== Questionnaire (campaign) =====
class QuestionnaireService {
  private readonly basePath = "/questionnaire";
  async getMany(params?: QuestionnaireGetManyFormData) {
    return (await apiClient.get<QuestionnaireGetManyResponse>(this.basePath, { params })).data;
  }
  async getById(id: string, params?: QuestionnaireQueryFormData) {
    return (await apiClient.get<QuestionnaireGetUniqueResponse>(`${this.basePath}/${id}`, { params })).data;
  }
  async create(data: QuestionnaireCreateFormData, query?: QuestionnaireQueryFormData) {
    return (await apiClient.post<QuestionnaireCreateResponse>(this.basePath, data, { params: query })).data;
  }
  async update(id: string, data: QuestionnaireUpdateFormData, query?: QuestionnaireQueryFormData) {
    return (await apiClient.patch<QuestionnaireUpdateResponse>(`${this.basePath}/${id}`, data, { params: query })).data;
  }
  async delete(id: string) {
    return (await apiClient.delete<QuestionnaireDeleteResponse>(`${this.basePath}/${id}`)).data;
  }
  async open(id: string) {
    return (await apiClient.post<QuestionnaireGetUniqueResponse>(`${this.basePath}/${id}/open`)).data;
  }
  async close(id: string) {
    return (await apiClient.post<QuestionnaireGetUniqueResponse>(`${this.basePath}/${id}/close`)).data;
  }
  async cancel(id: string) {
    return (await apiClient.post<QuestionnaireGetUniqueResponse>(`${this.basePath}/${id}/cancel`)).data;
  }
  // Aggregated, identity-free results. Safe for anonymous questionnaires.
  async getResults(id: string) {
    return (await apiClient.get<QuestionnaireResultsResponse>(`${this.basePath}/${id}/results`)).data;
  }
}

export const questionnaireGroupService = new QuestionnaireGroupService();
export const questionnaireQuestionService = new QuestionnaireQuestionService();
export const questionnaireService = new QuestionnaireService();

// ===== Convenience exports =====
export const getQuestionnaireGroups = (p?: QuestionnaireGroupGetManyFormData) => questionnaireGroupService.getMany(p);
export const getQuestionnaireGroupById = (id: string, p?: QuestionnaireGroupQueryFormData) => questionnaireGroupService.getById(id, p);
export const createQuestionnaireGroup = (d: QuestionnaireGroupCreateFormData, q?: QuestionnaireGroupQueryFormData) => questionnaireGroupService.create(d, q);
export const updateQuestionnaireGroup = (id: string, d: QuestionnaireGroupUpdateFormData, q?: QuestionnaireGroupQueryFormData) => questionnaireGroupService.update(id, d, q);
export const deleteQuestionnaireGroup = (id: string) => questionnaireGroupService.delete(id);

export const getQuestionnaireQuestions = (p?: QuestionnaireQuestionGetManyFormData) => questionnaireQuestionService.getMany(p);
export const getQuestionnaireQuestionById = (id: string, p?: QuestionnaireQuestionQueryFormData) => questionnaireQuestionService.getById(id, p);
export const createQuestionnaireQuestion = (d: QuestionnaireQuestionCreateFormData, q?: QuestionnaireQuestionQueryFormData) => questionnaireQuestionService.create(d, q);
export const updateQuestionnaireQuestion = (id: string, d: QuestionnaireQuestionUpdateFormData, q?: QuestionnaireQuestionQueryFormData) => questionnaireQuestionService.update(id, d, q);
export const deleteQuestionnaireQuestion = (id: string) => questionnaireQuestionService.delete(id);
export const upsertQuestionnaireQuestionOptions = (id: string, d: QuestionnaireOptionsUpsertFormData) => questionnaireQuestionService.upsertOptions(id, d);

export const getQuestionnaires = (p?: QuestionnaireGetManyFormData) => questionnaireService.getMany(p);
export const getQuestionnaireById = (id: string, p?: QuestionnaireQueryFormData) => questionnaireService.getById(id, p);
export const createQuestionnaire = (d: QuestionnaireCreateFormData, q?: QuestionnaireQueryFormData) => questionnaireService.create(d, q);
export const updateQuestionnaire = (id: string, d: QuestionnaireUpdateFormData, q?: QuestionnaireQueryFormData) => questionnaireService.update(id, d, q);
export const deleteQuestionnaire = (id: string) => questionnaireService.delete(id);
export const openQuestionnaire = (id: string) => questionnaireService.open(id);
export const closeQuestionnaire = (id: string) => questionnaireService.close(id);
export const cancelQuestionnaire = (id: string) => questionnaireService.cancel(id);
export const getQuestionnaireResults = (id: string) => questionnaireService.getResults(id);
