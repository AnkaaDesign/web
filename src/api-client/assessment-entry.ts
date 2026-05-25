// packages/api-client/src/assessment-entry.ts
//
// AssessmentEntry endpoints — /assessment-entry (queue, detail, /responses, /submit, /reopen).
// See api/src/modules/skill/skill.controller.ts

import { apiClient } from "./axiosClient";
import type {
  AssessmentEntryGetManyFormData,
  AssessmentEntryQueryFormData,
  AssessmentEntryUpdateFormData,
  AssessmentEntryResponsesUpsertFormData,
  AssessmentEntryGetManyResponse,
  AssessmentEntryGetUniqueResponse,
  AssessmentEntryUpdateResponse,
} from "../types";

// =====================
// AssessmentEntry Service
// =====================

export class AssessmentEntryService {
  private readonly basePath = "/assessment-entry";

  // ---- Queue / detail ----
  /**
   * Lists assessment entries.
   * Use `evaluatorId: 'me'` to get the leader's pending queue (API resolves
   * to current user id).
   */
  async getEntries(
    params?: AssessmentEntryGetManyFormData,
  ): Promise<AssessmentEntryGetManyResponse> {
    const response = await apiClient.get<AssessmentEntryGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getEntryById(
    id: string,
    params?: AssessmentEntryQueryFormData,
  ): Promise<AssessmentEntryGetUniqueResponse> {
    const response = await apiClient.get<AssessmentEntryGetUniqueResponse>(
      `${this.basePath}/${id}`,
      { params },
    );
    return response.data;
  }

  // ---- Responses upsert ----
  /**
   * Replaces (upsert by topicId) all responses for the entry. Server-side this
   * also flips status PENDING -> IN_PROGRESS if applicable.
   */
  async upsertResponses(
    entryId: string,
    data: AssessmentEntryResponsesUpsertFormData,
    options?: { suppressToast?: boolean },
  ): Promise<AssessmentEntryGetUniqueResponse> {
    const config = options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : undefined;
    const response = await apiClient.put<AssessmentEntryGetUniqueResponse>(
      `${this.basePath}/${entryId}/responses`,
      data,
      config,
    );
    return response.data;
  }

  // ---- Metadata patch ----
  async updateEntryMeta(
    id: string,
    data: AssessmentEntryUpdateFormData,
    options?: { suppressToast?: boolean },
  ): Promise<AssessmentEntryUpdateResponse> {
    const config = options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : undefined;
    const response = await apiClient.patch<AssessmentEntryUpdateResponse>(
      `${this.basePath}/${id}`,
      data,
      config,
    );
    return response.data;
  }

  // ---- Submit / reopen ----
  /**
   * Marks the entry SUBMITTED. Validates all topics answered.
   */
  async submitEntry(id: string): Promise<AssessmentEntryGetUniqueResponse> {
    const response = await apiClient.post<AssessmentEntryGetUniqueResponse>(
      `${this.basePath}/${id}/submit`,
    );
    return response.data;
  }

  /**
   * Admin-only: reopens a SUBMITTED entry back to IN_PROGRESS.
   */
  async reopenEntry(id: string): Promise<AssessmentEntryGetUniqueResponse> {
    const response = await apiClient.post<AssessmentEntryGetUniqueResponse>(
      `${this.basePath}/${id}/reopen`,
    );
    return response.data;
  }
}

export const assessmentEntryService = new AssessmentEntryService();

// =====================
// Convenience exports
// =====================

export const getAssessmentEntries = (params?: AssessmentEntryGetManyFormData) =>
  assessmentEntryService.getEntries(params);
export const getAssessmentEntryById = (id: string, params?: AssessmentEntryQueryFormData) =>
  assessmentEntryService.getEntryById(id, params);
export const upsertAssessmentEntryResponses = (
  entryId: string,
  data: AssessmentEntryResponsesUpsertFormData,
  options?: { suppressToast?: boolean },
) => assessmentEntryService.upsertResponses(entryId, data, options);
export const updateAssessmentEntryMeta = (
  id: string,
  data: AssessmentEntryUpdateFormData,
  options?: { suppressToast?: boolean },
) => assessmentEntryService.updateEntryMeta(id, data, options);
export const submitAssessmentEntry = (id: string) => assessmentEntryService.submitEntry(id);
export const reopenAssessmentEntry = (id: string) => assessmentEntryService.reopenEntry(id);
