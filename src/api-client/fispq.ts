// packages/api-client/src/fispq.ts
// FISPQ / FDS — Ficha de Informações de Segurança de Produtos Químicos / Safety Data Sheet

import { apiClient } from "./axiosClient";
import type {
  FispqGetManyFormData,
  FispqCreateFormData,
  FispqUpdateFormData,
  FispqBatchCreateFormData,
  FispqBatchUpdateFormData,
  FispqBatchDeleteFormData,
  FispqExportFormData,
} from "../schemas/fispq";
import type {
  Fispq,
  FispqGetUniqueResponse,
  FispqGetManyResponse,
  FispqCreateResponse,
  FispqUpdateResponse,
  FispqDeleteResponse,
  FispqBatchCreateResponse,
  FispqBatchUpdateResponse,
  FispqBatchDeleteResponse,
} from "../types/fispq";

// =====================
// Fispq Service Class
// =====================

export class FispqService {
  private readonly basePath = "/fispq";

  // =====================
  // Query Operations
  // =====================

  async getFispqs(params?: FispqGetManyFormData): Promise<FispqGetManyResponse> {
    const response = await apiClient.get<FispqGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getFispqById(id: string, params?: any): Promise<FispqGetUniqueResponse> {
    const response = await apiClient.get<FispqGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createFispq(data: FispqCreateFormData, query?: any): Promise<FispqCreateResponse> {
    const response = await apiClient.post<FispqCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateFispq(id: string, data: FispqUpdateFormData, query?: any): Promise<FispqUpdateResponse> {
    const response = await apiClient.put<FispqUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteFispq(id: string): Promise<FispqDeleteResponse> {
    const response = await apiClient.delete<FispqDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Upload do PDF oficial da FDS (multipart, field "document")
  async uploadFispqDocument(id: string, file: globalThis.File, query?: any): Promise<FispqUpdateResponse> {
    const formData = new FormData();
    formData.append("document", file);
    const response = await apiClient.post<FispqUpdateResponse>(`${this.basePath}/${id}/document`, formData, {
      params: query,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  // Inventário de produtos químicos — exportação oficial (server pdfkit / xlsx)
  async exportFispq(params?: FispqExportFormData): Promise<Blob> {
    const response = await apiClient.get(`${this.basePath}/export`, {
      params,
      responseType: "blob",
    });
    return response.data as Blob;
  }

  // PDF de referência rápida por item (perigos + primeiros socorros + EPI)
  async getFispqReport(id: string): Promise<Blob> {
    const response = await apiClient.get(`${this.basePath}/${id}/report`, {
      responseType: "blob",
    });
    return response.data as Blob;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateFispqs(data: FispqBatchCreateFormData, query?: any): Promise<FispqBatchCreateResponse<Fispq>> {
    const response = await apiClient.post<FispqBatchCreateResponse<Fispq>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateFispqs(data: FispqBatchUpdateFormData, query?: any): Promise<FispqBatchUpdateResponse<Fispq>> {
    const response = await apiClient.put<FispqBatchUpdateResponse<Fispq>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteFispqs(data: FispqBatchDeleteFormData, query?: any): Promise<FispqBatchDeleteResponse> {
    const response = await apiClient.delete<FispqBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const fispqService = new FispqService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getFispqs = (params?: FispqGetManyFormData) => fispqService.getFispqs(params);
export const getFispqById = (id: string, params?: any) => fispqService.getFispqById(id, params);

// Mutation Operations
export const createFispq = (data: FispqCreateFormData, query?: any) => fispqService.createFispq(data, query);
export const updateFispq = (id: string, data: FispqUpdateFormData, query?: any) => fispqService.updateFispq(id, data, query);
export const deleteFispq = (id: string) => fispqService.deleteFispq(id);
export const uploadFispqDocument = (id: string, file: globalThis.File, query?: any) => fispqService.uploadFispqDocument(id, file, query);
export const exportFispq = (params?: FispqExportFormData) => fispqService.exportFispq(params);
export const getFispqReport = (id: string) => fispqService.getFispqReport(id);

// Batch Operations
export const batchCreateFispqs = (data: FispqBatchCreateFormData, query?: any) => fispqService.batchCreateFispqs(data, query);
export const batchUpdateFispqs = (data: FispqBatchUpdateFormData, query?: any) => fispqService.batchUpdateFispqs(data, query);
export const batchDeleteFispqs = (data: FispqBatchDeleteFormData, query?: any) => fispqService.batchDeleteFispqs(data, query);
