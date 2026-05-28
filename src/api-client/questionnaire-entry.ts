// api-client/questionnaire-entry.ts
//
// QuestionnaireEntry endpoints — /questionnaire-entry (self-fill queue, detail,
// /answers, /submit, /reopen). See api/src/modules/questionnaire/questionnaire.controller.ts

import { apiClient } from "./axiosClient";
import type {
  QuestionnaireEntryGetManyFormData,
  QuestionnaireEntryQueryFormData,
  QuestionnaireEntryUpdateFormData,
  QuestionnaireEntryAnswersUpsertFormData,
  QuestionnaireEntryGetManyResponse,
  QuestionnaireEntryGetUniqueResponse,
  QuestionnaireEntryUpdateResponse,
} from "../types";

export class QuestionnaireEntryService {
  private readonly basePath = "/questionnaire-entry";

  /** Lists entries. Use `respondentId: 'me'` for the current user's queue. */
  async getEntries(params?: QuestionnaireEntryGetManyFormData): Promise<QuestionnaireEntryGetManyResponse> {
    return (await apiClient.get<QuestionnaireEntryGetManyResponse>(this.basePath, { params })).data;
  }

  async getEntryById(id: string, params?: QuestionnaireEntryQueryFormData): Promise<QuestionnaireEntryGetUniqueResponse> {
    return (await apiClient.get<QuestionnaireEntryGetUniqueResponse>(`${this.basePath}/${id}`, { params })).data;
  }

  async upsertAnswers(
    entryId: string,
    data: QuestionnaireEntryAnswersUpsertFormData,
    options?: { suppressToast?: boolean },
  ): Promise<QuestionnaireEntryGetUniqueResponse> {
    const config = options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : undefined;
    return (await apiClient.put<QuestionnaireEntryGetUniqueResponse>(`${this.basePath}/${entryId}/answers`, data, config)).data;
  }

  async updateEntryMeta(
    id: string,
    data: QuestionnaireEntryUpdateFormData,
    options?: { suppressToast?: boolean },
  ): Promise<QuestionnaireEntryUpdateResponse> {
    const config = options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : undefined;
    return (await apiClient.patch<QuestionnaireEntryUpdateResponse>(`${this.basePath}/${id}`, data, config)).data;
  }

  async submitEntry(id: string): Promise<QuestionnaireEntryGetUniqueResponse> {
    return (await apiClient.post<QuestionnaireEntryGetUniqueResponse>(`${this.basePath}/${id}/submit`)).data;
  }

  async reopenEntry(id: string): Promise<QuestionnaireEntryGetUniqueResponse> {
    return (await apiClient.post<QuestionnaireEntryGetUniqueResponse>(`${this.basePath}/${id}/reopen`)).data;
  }
}

export const questionnaireEntryService = new QuestionnaireEntryService();

export const getQuestionnaireEntries = (params?: QuestionnaireEntryGetManyFormData) =>
  questionnaireEntryService.getEntries(params);
export const getQuestionnaireEntryById = (id: string, params?: QuestionnaireEntryQueryFormData) =>
  questionnaireEntryService.getEntryById(id, params);
export const upsertQuestionnaireEntryAnswers = (
  entryId: string,
  data: QuestionnaireEntryAnswersUpsertFormData,
  options?: { suppressToast?: boolean },
) => questionnaireEntryService.upsertAnswers(entryId, data, options);
export const updateQuestionnaireEntryMeta = (
  id: string,
  data: QuestionnaireEntryUpdateFormData,
  options?: { suppressToast?: boolean },
) => questionnaireEntryService.updateEntryMeta(id, data, options);
export const submitQuestionnaireEntry = (id: string) => questionnaireEntryService.submitEntry(id);
export const reopenQuestionnaireEntry = (id: string) => questionnaireEntryService.reopenEntry(id);
