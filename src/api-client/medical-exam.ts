// packages/api/src/medical-exam.ts
// ASO / Exames ocupacionais (Medicina do Trabalho)

import { apiClient } from "./axiosClient";
import type { MedicalExamGetManyFormData, MedicalExamCreateFormData, MedicalExamUpdateFormData, MedicalExamCompleteFormData, MedicalExamBatchCreateFormData, MedicalExamBatchUpdateFormData, MedicalExamBatchDeleteFormData } from "../schemas/medical-exam";
import type {
  MedicalExam,
  MedicalExamGetUniqueResponse,
  MedicalExamGetManyResponse,
  MedicalExamCreateResponse,
  MedicalExamUpdateResponse,
  MedicalExamDeleteResponse,
  MedicalExamBatchCreateResponse,
  MedicalExamBatchUpdateResponse,
  MedicalExamBatchDeleteResponse,
} from "../types/medical-exam";

// =====================
// MedicalExam Service Class
// =====================

export class MedicalExamService {
  private readonly basePath = "/medical-exams";

  // =====================
  // Query Operations
  // =====================

  async getMedicalExams(params?: MedicalExamGetManyFormData): Promise<MedicalExamGetManyResponse> {
    const response = await apiClient.get<MedicalExamGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getMedicalExamById(id: string, params?: any): Promise<MedicalExamGetUniqueResponse> {
    const response = await apiClient.get<MedicalExamGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // Exames Periódicos dashboard: COMPLETED exams expiring within N days (or already overdue)
  async getExpiringMedicalExams(days?: number): Promise<MedicalExamGetManyResponse> {
    const response = await apiClient.get<MedicalExamGetManyResponse>(`${this.basePath}/expiring`, {
      params: days !== undefined ? { days } : undefined,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createMedicalExam(data: MedicalExamCreateFormData, query?: any): Promise<MedicalExamCreateResponse> {
    const response = await apiClient.post<MedicalExamCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateMedicalExam(id: string, data: MedicalExamUpdateFormData, query?: any): Promise<MedicalExamUpdateResponse> {
    const response = await apiClient.put<MedicalExamUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteMedicalExam(id: string): Promise<MedicalExamDeleteResponse> {
    const response = await apiClient.delete<MedicalExamDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Conclusão do exame (SCHEDULED → COMPLETED)
  async completeMedicalExam(id: string, data: MedicalExamCompleteFormData, query?: any): Promise<MedicalExamUpdateResponse> {
    const response = await apiClient.put<MedicalExamUpdateResponse>(`${this.basePath}/${id}/complete`, data, {
      params: query,
    });
    return response.data;
  }

  // Upload do documento ASO (multipart, field "document")
  async uploadMedicalExamDocument(id: string, file: globalThis.File, query?: any): Promise<MedicalExamUpdateResponse> {
    const formData = new FormData();
    formData.append("document", file);
    const response = await apiClient.post<MedicalExamUpdateResponse>(`${this.basePath}/${id}/document`, formData, {
      params: query,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateMedicalExams(data: MedicalExamBatchCreateFormData, query?: any): Promise<MedicalExamBatchCreateResponse<MedicalExam>> {
    const response = await apiClient.post<MedicalExamBatchCreateResponse<MedicalExam>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateMedicalExams(data: MedicalExamBatchUpdateFormData, query?: any): Promise<MedicalExamBatchUpdateResponse<MedicalExam>> {
    const response = await apiClient.put<MedicalExamBatchUpdateResponse<MedicalExam>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteMedicalExams(data: MedicalExamBatchDeleteFormData, query?: any): Promise<MedicalExamBatchDeleteResponse> {
    const response = await apiClient.delete<MedicalExamBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const medicalExamService = new MedicalExamService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getMedicalExams = (params?: MedicalExamGetManyFormData) => medicalExamService.getMedicalExams(params);
export const getMedicalExamById = (id: string, params?: any) => medicalExamService.getMedicalExamById(id, params);
export const getExpiringMedicalExams = (days?: number) => medicalExamService.getExpiringMedicalExams(days);

// Mutation Operations
export const createMedicalExam = (data: MedicalExamCreateFormData, query?: any) => medicalExamService.createMedicalExam(data, query);
export const updateMedicalExam = (id: string, data: MedicalExamUpdateFormData, query?: any) => medicalExamService.updateMedicalExam(id, data, query);
export const deleteMedicalExam = (id: string) => medicalExamService.deleteMedicalExam(id);
export const completeMedicalExam = (id: string, data: MedicalExamCompleteFormData, query?: any) => medicalExamService.completeMedicalExam(id, data, query);
export const uploadMedicalExamDocument = (id: string, file: globalThis.File, query?: any) => medicalExamService.uploadMedicalExamDocument(id, file, query);

// Batch Operations
export const batchCreateMedicalExams = (data: MedicalExamBatchCreateFormData, query?: any) => medicalExamService.batchCreateMedicalExams(data, query);
export const batchUpdateMedicalExams = (data: MedicalExamBatchUpdateFormData, query?: any) => medicalExamService.batchUpdateMedicalExams(data, query);
export const batchDeleteMedicalExams = (data: MedicalExamBatchDeleteFormData, query?: any) => medicalExamService.batchDeleteMedicalExams(data, query);
