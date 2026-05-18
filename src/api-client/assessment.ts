// packages/api-client/src/assessment.ts
//
// Assessment endpoints — /assessment (+ lifecycle /open, /close, /cancel and /analytics)
// See api/src/modules/skill/skill.controller.ts

import { apiClient } from "./axiosClient";
import type {
  AssessmentGetManyFormData,
  AssessmentQueryFormData,
  AssessmentCreateFormData,
  AssessmentUpdateFormData,
  AssessmentGetManyResponse,
  AssessmentGetUniqueResponse,
  AssessmentCreateResponse,
  AssessmentUpdateResponse,
  AssessmentDeleteResponse,
  AssessmentAnalyticsResponse,
} from "../types";

// =====================
// Assessment Service
// =====================

export class AssessmentService {
  private readonly basePath = "/assessment";

  // ---- Query ----
  async getAssessments(
    params?: AssessmentGetManyFormData,
  ): Promise<AssessmentGetManyResponse> {
    const response = await apiClient.get<AssessmentGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getAssessmentById(
    id: string,
    params?: AssessmentQueryFormData,
  ): Promise<AssessmentGetUniqueResponse> {
    const response = await apiClient.get<AssessmentGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // ---- CRUD ----
  async createAssessment(
    data: AssessmentCreateFormData,
    query?: AssessmentQueryFormData,
  ): Promise<AssessmentCreateResponse> {
    const response = await apiClient.post<AssessmentCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateAssessment(
    id: string,
    data: AssessmentUpdateFormData,
    query?: AssessmentQueryFormData,
  ): Promise<AssessmentUpdateResponse> {
    const response = await apiClient.patch<AssessmentUpdateResponse>(
      `${this.basePath}/${id}`,
      data,
      { params: query },
    );
    return response.data;
  }

  async deleteAssessment(id: string): Promise<AssessmentDeleteResponse> {
    const response = await apiClient.delete<AssessmentDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // ---- Lifecycle transitions ----
  /**
   * Opens the assessment: status moves DRAFT -> OPEN, spawns AssessmentEntry rows
   * (one per evaluatee × their sector leader).
   */
  async openAssessment(id: string): Promise<AssessmentGetUniqueResponse> {
    const response = await apiClient.post<AssessmentGetUniqueResponse>(
      `${this.basePath}/${id}/open`,
    );
    return response.data;
  }

  /**
   * Closes the assessment: status moves OPEN -> CLOSED. All pending entries remain
   * read-only.
   */
  async closeAssessment(id: string): Promise<AssessmentGetUniqueResponse> {
    const response = await apiClient.post<AssessmentGetUniqueResponse>(
      `${this.basePath}/${id}/close`,
    );
    return response.data;
  }

  /**
   * Cancels the assessment: status moves to CANCELLED. Entries no longer accept input.
   */
  async cancelAssessment(id: string): Promise<AssessmentGetUniqueResponse> {
    const response = await apiClient.post<AssessmentGetUniqueResponse>(
      `${this.basePath}/${id}/cancel`,
    );
    return response.data;
  }

  // ---- Analytics ----
  async getAssessmentAnalytics(id: string): Promise<AssessmentAnalyticsResponse> {
    const response = await apiClient.get<AssessmentAnalyticsResponse>(
      `${this.basePath}/${id}/analytics`,
    );
    return response.data;
  }
}

export const assessmentService = new AssessmentService();

// =====================
// Convenience exports
// =====================

export const getAssessments = (params?: AssessmentGetManyFormData) =>
  assessmentService.getAssessments(params);
export const getAssessmentById = (id: string, params?: AssessmentQueryFormData) =>
  assessmentService.getAssessmentById(id, params);
export const createAssessment = (
  data: AssessmentCreateFormData,
  query?: AssessmentQueryFormData,
) => assessmentService.createAssessment(data, query);
export const updateAssessment = (
  id: string,
  data: AssessmentUpdateFormData,
  query?: AssessmentQueryFormData,
) => assessmentService.updateAssessment(id, data, query);
export const deleteAssessment = (id: string) => assessmentService.deleteAssessment(id);
export const openAssessment = (id: string) => assessmentService.openAssessment(id);
export const closeAssessment = (id: string) => assessmentService.closeAssessment(id);
export const cancelAssessment = (id: string) => assessmentService.cancelAssessment(id);
export const getAssessmentAnalytics = (id: string) =>
  assessmentService.getAssessmentAnalytics(id);
