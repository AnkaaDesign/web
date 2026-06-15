// packages/api/src/termination.ts
// Rescisões (Departamento Pessoal)

import { apiClient } from "./axiosClient";
import type {
  TerminationGetManyFormData,
  TerminationCreateFormData,
  TerminationUpdateFormData,
  TerminationBatchCreateFormData,
  TerminationBatchUpdateFormData,
  TerminationBatchDeleteFormData,
  TerminationAdvanceFormData,
  TerminationDocumentUploadFormData,
  TerminationDocumentUpdateFormData,
  TerminationItemCreateFormData,
  TerminationItemUpdateFormData,
} from "../schemas/termination";
import type {
  Termination,
  TerminationGetUniqueResponse,
  TerminationGetManyResponse,
  TerminationCreateResponse,
  TerminationUpdateResponse,
  TerminationDeleteResponse,
  TerminationBatchCreateResponse,
  TerminationBatchUpdateResponse,
  TerminationBatchDeleteResponse,
  TerminationCalculateResponse,
  TerminationComputeTaxesResponse,
  TerminationDocumentUpdateResponse,
  TerminationItemCreateResponse,
  TerminationItemUpdateResponse,
  TerminationItemDeleteResponse,
} from "../types/termination";

// =====================
// Termination Service Class
// =====================

export class TerminationService {
  private readonly basePath = "/terminations";

  // =====================
  // Query Operations
  // =====================

  async getTerminations(params?: TerminationGetManyFormData): Promise<TerminationGetManyResponse> {
    const response = await apiClient.get<TerminationGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getTerminationById(id: string, params?: any): Promise<TerminationGetUniqueResponse> {
    const response = await apiClient.get<TerminationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createTermination(data: TerminationCreateFormData, query?: any): Promise<TerminationCreateResponse> {
    const response = await apiClient.post<TerminationCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateTermination(id: string, data: TerminationUpdateFormData, query?: any): Promise<TerminationUpdateResponse> {
    const response = await apiClient.put<TerminationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteTermination(id: string): Promise<TerminationDeleteResponse> {
    const response = await apiClient.delete<TerminationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Verbas Engine / Status Machine
  // =====================

  async calculateTermination(id: string): Promise<TerminationCalculateResponse> {
    const response = await apiClient.post<TerminationCalculateResponse>(`${this.basePath}/${id}/calculate`);
    return response.data;
  }

  async advanceTermination(id: string, data: TerminationAdvanceFormData = {}, query?: any): Promise<TerminationUpdateResponse> {
    const response = await apiClient.put<TerminationUpdateResponse>(`${this.basePath}/${id}/advance`, data, {
      params: query,
    });
    return response.data;
  }

  async regressTermination(id: string, query?: any): Promise<TerminationUpdateResponse> {
    const response = await apiClient.put<TerminationUpdateResponse>(`${this.basePath}/${id}/regress`, undefined, {
      params: query,
    });
    return response.data;
  }

  /** POST /terminations/:id/compute-taxes — auto-compute INSS/IRRF + FGTS-multa base. */
  async computeTerminationTaxes(id: string): Promise<TerminationComputeTaxesResponse> {
    const response = await apiClient.post<TerminationComputeTaxesResponse>(`${this.basePath}/${id}/compute-taxes`);
    return response.data;
  }

  // =====================
  // Document Operations
  // =====================

  async uploadTerminationDocument(id: string, data: TerminationDocumentUploadFormData, file: File): Promise<TerminationDocumentUpdateResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", data.type);
    if (data.note) {
      formData.append("note", data.note);
    }

    const response = await apiClient.post<TerminationDocumentUpdateResponse>(`${this.basePath}/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  async updateTerminationDocument(documentId: string, data: TerminationDocumentUpdateFormData): Promise<TerminationDocumentUpdateResponse> {
    const response = await apiClient.put<TerminationDocumentUpdateResponse>(`${this.basePath}/documents/${documentId}`, data);
    return response.data;
  }

  // =====================
  // Custom Item Operations (verbas)
  // =====================

  async addTerminationItem(id: string, data: TerminationItemCreateFormData): Promise<TerminationItemCreateResponse> {
    const response = await apiClient.post<TerminationItemCreateResponse>(`${this.basePath}/${id}/items`, data);
    return response.data;
  }

  async updateTerminationItem(itemId: string, data: TerminationItemUpdateFormData): Promise<TerminationItemUpdateResponse> {
    const response = await apiClient.put<TerminationItemUpdateResponse>(`${this.basePath}/items/${itemId}`, data);
    return response.data;
  }

  async deleteTerminationItem(itemId: string): Promise<TerminationItemDeleteResponse> {
    const response = await apiClient.delete<TerminationItemDeleteResponse>(`${this.basePath}/items/${itemId}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateTerminations(data: TerminationBatchCreateFormData, query?: any): Promise<TerminationBatchCreateResponse<Termination>> {
    const response = await apiClient.post<TerminationBatchCreateResponse<Termination>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateTerminations(data: TerminationBatchUpdateFormData, query?: any): Promise<TerminationBatchUpdateResponse<Termination>> {
    const response = await apiClient.put<TerminationBatchUpdateResponse<Termination>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteTerminations(data: TerminationBatchDeleteFormData, query?: any): Promise<TerminationBatchDeleteResponse> {
    const response = await apiClient.delete<TerminationBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const terminationService = new TerminationService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getTerminations = (params?: TerminationGetManyFormData) => terminationService.getTerminations(params);
export const getTerminationById = (id: string, params?: any) => terminationService.getTerminationById(id, params);

// Mutation Operations
export const createTermination = (data: TerminationCreateFormData, query?: any) => terminationService.createTermination(data, query);
export const updateTermination = (id: string, data: TerminationUpdateFormData, query?: any) => terminationService.updateTermination(id, data, query);
export const deleteTermination = (id: string) => terminationService.deleteTermination(id);

// Verbas Engine / Status Machine
export const calculateTermination = (id: string) => terminationService.calculateTermination(id);
export const advanceTermination = (id: string, data?: TerminationAdvanceFormData, query?: any) => terminationService.advanceTermination(id, data, query);
export const regressTermination = (id: string, query?: any) => terminationService.regressTermination(id, query);
export const computeTerminationTaxes = (id: string) => terminationService.computeTerminationTaxes(id);

// Document Operations
export const uploadTerminationDocument = (id: string, data: TerminationDocumentUploadFormData, file: File) => terminationService.uploadTerminationDocument(id, data, file);
export const updateTerminationDocument = (documentId: string, data: TerminationDocumentUpdateFormData) => terminationService.updateTerminationDocument(documentId, data);

// Custom Item Operations
export const addTerminationItem = (id: string, data: TerminationItemCreateFormData) => terminationService.addTerminationItem(id, data);
export const updateTerminationItem = (itemId: string, data: TerminationItemUpdateFormData) => terminationService.updateTerminationItem(itemId, data);
export const deleteTerminationItem = (itemId: string) => terminationService.deleteTerminationItem(itemId);

// Batch Operations
export const batchCreateTerminations = (data: TerminationBatchCreateFormData, query?: any) => terminationService.batchCreateTerminations(data, query);
export const batchUpdateTerminations = (data: TerminationBatchUpdateFormData, query?: any) => terminationService.batchUpdateTerminations(data, query);
export const batchDeleteTerminations = (data: TerminationBatchDeleteFormData, query?: any) => terminationService.batchDeleteTerminations(data, query);
