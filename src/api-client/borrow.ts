// packages/api-client/src/borrow.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  BorrowGetManyFormData,
  BorrowGetByIdFormData,
  BorrowCreateFormData,
  BorrowUpdateFormData,
  BorrowBatchCreateFormData,
  BorrowBatchUpdateFormData,
  BorrowBatchDeleteFormData,
  BorrowQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Borrow,
  BorrowGetUniqueResponse,
  BorrowGetManyResponse,
  BorrowCreateResponse,
  BorrowUpdateResponse,
  BorrowDeleteResponse,
  BorrowBatchCreateResponse,
  BorrowBatchUpdateResponse,
  BorrowBatchDeleteResponse,
} from "../types";

// =====================
// Borrow Service Class
// =====================

export class BorrowService {
  private readonly basePath = "/borrows";

  // =====================
  // Query Operations
  // =====================

  async getBorrows(params?: BorrowGetManyFormData): Promise<BorrowGetManyResponse> {
    const response = await apiClient.get<BorrowGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getBorrowById(id: string, params?: Omit<BorrowGetByIdFormData, "id">): Promise<BorrowGetUniqueResponse> {
    const response = await apiClient.get<BorrowGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createBorrow(data: BorrowCreateFormData, query?: BorrowQueryFormData): Promise<BorrowCreateResponse> {
    const response = await apiClient.post<BorrowCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateBorrow(id: string, data: BorrowUpdateFormData, query?: BorrowQueryFormData): Promise<BorrowUpdateResponse> {
    const response = await apiClient.put<BorrowUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteBorrow(id: string): Promise<BorrowDeleteResponse> {
    const response = await apiClient.delete<BorrowDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Status Update Operations
  // =====================

  async markAsLost(id: string, query?: BorrowQueryFormData): Promise<BorrowUpdateResponse> {
    const response = await apiClient.put<BorrowUpdateResponse>(
      `${this.basePath}/${id}/lost`,
      {},
      {
        params: query,
      },
    );
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateBorrows(data: BorrowBatchCreateFormData, query?: BorrowQueryFormData): Promise<BorrowBatchCreateResponse<Borrow>> {
    const response = await apiClient.post<BorrowBatchCreateResponse<Borrow>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateBorrows(data: BorrowBatchUpdateFormData, query?: BorrowQueryFormData): Promise<BorrowBatchUpdateResponse<Borrow>> {
    const response = await apiClient.put<BorrowBatchUpdateResponse<Borrow>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteBorrows(data: BorrowBatchDeleteFormData, query?: BorrowQueryFormData): Promise<BorrowBatchDeleteResponse> {
    const response = await apiClient.delete<BorrowBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}
// =====================
// Export service instance
// =====================

export const borrowService = new BorrowService();

// =====================
// Export individual functions (for backward compatibility)
// =====================

export const getBorrows = (params?: BorrowGetManyFormData) => borrowService.getBorrows(params);
export const getBorrowById = (id: string, params?: Omit<BorrowGetByIdFormData, "id">) => borrowService.getBorrowById(id, params);
export const createBorrow = (data: BorrowCreateFormData, query?: BorrowQueryFormData) => borrowService.createBorrow(data, query);
export const updateBorrow = (id: string, data: BorrowUpdateFormData, query?: BorrowQueryFormData) => borrowService.updateBorrow(id, data, query);
export const deleteBorrow = (id: string) => borrowService.deleteBorrow(id);
export const markAsLostBorrow = (id: string, query?: BorrowQueryFormData) => borrowService.markAsLost(id, query);
export const batchCreateBorrows = (data: BorrowBatchCreateFormData, query?: BorrowQueryFormData) => borrowService.batchCreateBorrows(data, query);
export const batchUpdateBorrows = (data: BorrowBatchUpdateFormData, query?: BorrowQueryFormData) => borrowService.batchUpdateBorrows(data, query);
export const batchDeleteBorrows = (data: BorrowBatchDeleteFormData, query?: BorrowQueryFormData) => borrowService.batchDeleteBorrows(data, query);
