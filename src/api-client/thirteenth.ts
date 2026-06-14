// api-client/thirteenth.ts
// 13º salário (gratificação natalina) — Part D

import { apiClient } from "./axiosClient";
import type {
  ThirteenthGetManyFormData,
  ThirteenthCreateFormData,
  ThirteenthUpdateFormData,
  ThirteenthPayInstallmentFormData,
  ThirteenthGenerateFormData,
} from "../schemas/thirteenth";
import type {
  ThirteenthGetUniqueResponse,
  ThirteenthGetManyResponse,
  ThirteenthCreateResponse,
  ThirteenthMutationResponse,
  ThirteenthDeleteResponse,
  ThirteenthDocumentResponse,
  ThirteenthGenerateResponse,
} from "../types/thirteenth";

// =====================
// Thirteenth Service Class
// =====================

export class ThirteenthService {
  private readonly basePath = "/thirteenths";

  // Query Operations
  async getThirteenths(params?: ThirteenthGetManyFormData): Promise<ThirteenthGetManyResponse> {
    const response = await apiClient.get<ThirteenthGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getThirteenthById(id: string, params?: any): Promise<ThirteenthGetUniqueResponse> {
    const response = await apiClient.get<ThirteenthGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // Mutation Operations
  async createThirteenth(data: ThirteenthCreateFormData, query?: any): Promise<ThirteenthCreateResponse> {
    const response = await apiClient.post<ThirteenthCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateThirteenth(id: string, data: ThirteenthUpdateFormData, query?: any): Promise<ThirteenthMutationResponse> {
    const response = await apiClient.put<ThirteenthMutationResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteThirteenth(id: string): Promise<ThirteenthDeleteResponse> {
    const response = await apiClient.delete<ThirteenthDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Batch generation (whole-year for eligible CLT)
  async generateThirteenths(data: ThirteenthGenerateFormData): Promise<ThirteenthGenerateResponse> {
    const response = await apiClient.post<ThirteenthGenerateResponse>(`${this.basePath}/generate`, data);
    return response.data;
  }

  // Pay installments (status transitions)
  async payFirstInstallment(id: string, data: ThirteenthPayInstallmentFormData = {}): Promise<ThirteenthMutationResponse> {
    const response = await apiClient.post<ThirteenthMutationResponse>(`${this.basePath}/${id}/pay/first`, data);
    return response.data;
  }

  async paySecondInstallment(id: string, data: ThirteenthPayInstallmentFormData = {}): Promise<ThirteenthMutationResponse> {
    const response = await apiClient.post<ThirteenthMutationResponse>(`${this.basePath}/${id}/pay/second`, data);
    return response.data;
  }

  // Payable installment documents
  async getFirstInstallmentDocument(id: string): Promise<ThirteenthDocumentResponse> {
    const response = await apiClient.get<ThirteenthDocumentResponse>(`${this.basePath}/${id}/document/first`);
    return response.data;
  }

  async getSecondInstallmentDocument(id: string): Promise<ThirteenthDocumentResponse> {
    const response = await apiClient.get<ThirteenthDocumentResponse>(`${this.basePath}/${id}/document/second`);
    return response.data;
  }
}

export const thirteenthService = new ThirteenthService();

// Query Operations
export const getThirteenths = (params?: ThirteenthGetManyFormData) => thirteenthService.getThirteenths(params);
export const getThirteenthById = (id: string, params?: any) => thirteenthService.getThirteenthById(id, params);

// Mutation Operations
export const createThirteenth = (data: ThirteenthCreateFormData, query?: any) => thirteenthService.createThirteenth(data, query);
export const updateThirteenth = (id: string, data: ThirteenthUpdateFormData, query?: any) => thirteenthService.updateThirteenth(id, data, query);
export const deleteThirteenth = (id: string) => thirteenthService.deleteThirteenth(id);

// Batch generation
export const generateThirteenths = (data: ThirteenthGenerateFormData) => thirteenthService.generateThirteenths(data);

// Pay installments
export const payFirstInstallment = (id: string, data?: ThirteenthPayInstallmentFormData) => thirteenthService.payFirstInstallment(id, data);
export const paySecondInstallment = (id: string, data?: ThirteenthPayInstallmentFormData) => thirteenthService.paySecondInstallment(id, data);

// Documents
export const getThirteenthFirstDocument = (id: string) => thirteenthService.getFirstInstallmentDocument(id);
export const getThirteenthSecondDocument = (id: string) => thirteenthService.getSecondInstallmentDocument(id);
