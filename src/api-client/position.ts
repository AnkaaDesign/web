// packages/api-client/src/position.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  PositionGetManyFormData,
  PositionGetByIdFormData,
  PositionCreateFormData,
  PositionUpdateFormData,
  PositionBatchCreateFormData,
  PositionBatchUpdateFormData,
  PositionBatchDeleteFormData,
  PositionQueryFormData,
  PositionRemunerationGetManyFormData,
  PositionRemunerationGetByIdFormData,
  PositionRemunerationCreateFormData,
  PositionRemunerationUpdateFormData,
  PositionRemunerationBatchCreateFormData,
  PositionRemunerationBatchUpdateFormData,
  PositionRemunerationBatchDeleteFormData,
  PositionRemunerationQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  PositionGetUniqueResponse,
  PositionGetManyResponse,
  PositionCreateResponse,
  PositionUpdateResponse,
  PositionDeleteResponse,
  PositionBatchCreateResponse,
  PositionBatchUpdateResponse,
  PositionBatchDeleteResponse,
  PositionRemuneration,
  PositionRemunerationGetUniqueResponse,
  PositionRemunerationGetManyResponse,
  PositionRemunerationCreateResponse,
  PositionRemunerationUpdateResponse,
  PositionRemunerationDeleteResponse,
  PositionRemunerationBatchCreateResponse,
  PositionRemunerationBatchUpdateResponse,
  PositionRemunerationBatchDeleteResponse,
} from "../types";

// =====================
// Position Service Class
// =====================

export class PositionService {
  private readonly basePath = "/positions";

  // =====================
  // Query Operations
  // =====================

  async getPositions(params?: PositionGetManyFormData): Promise<PositionGetManyResponse> {
    const response = await apiClient.get<PositionGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getPositionById(id: string, params?: Omit<PositionGetByIdFormData, "id">): Promise<PositionGetUniqueResponse> {
    const response = await apiClient.get<PositionGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createPosition(data: PositionCreateFormData, queryParams?: PositionQueryFormData): Promise<PositionCreateResponse> {
    const response = await apiClient.post<PositionCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updatePosition(id: string, data: PositionUpdateFormData, queryParams?: PositionQueryFormData): Promise<PositionUpdateResponse> {
    const response = await apiClient.put<PositionUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deletePosition(id: string): Promise<PositionDeleteResponse> {
    const response = await apiClient.delete<PositionDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePositions(data: PositionBatchCreateFormData, queryParams?: PositionQueryFormData): Promise<PositionBatchCreateResponse<PositionCreateFormData>> {
    const response = await apiClient.post<PositionBatchCreateResponse<PositionCreateFormData>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdatePositions(data: PositionBatchUpdateFormData, queryParams?: PositionQueryFormData): Promise<PositionBatchUpdateResponse<PositionUpdateFormData>> {
    const response = await apiClient.put<PositionBatchUpdateResponse<PositionUpdateFormData>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeletePositions(data: PositionBatchDeleteFormData): Promise<PositionBatchDeleteResponse> {
    const response = await apiClient.delete<PositionBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
    });
    return response.data;
  }
}

// =====================
// Position Remuneration Service Class
// =====================

export class PositionRemunerationService {
  private readonly basePath = "/position-remunerations";

  // =====================
  // Query Operations
  // =====================

  async getPositionRemunerations(params?: PositionRemunerationGetManyFormData): Promise<PositionRemunerationGetManyResponse> {
    const response = await apiClient.get<PositionRemunerationGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getPositionRemunerationById(params: PositionRemunerationGetByIdFormData): Promise<PositionRemunerationGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<PositionRemunerationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createPositionRemuneration(data: PositionRemunerationCreateFormData, queryParams?: PositionRemunerationQueryFormData): Promise<PositionRemunerationCreateResponse> {
    const response = await apiClient.post<PositionRemunerationCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updatePositionRemuneration(
    id: string,
    data: PositionRemunerationUpdateFormData,
    queryParams?: PositionRemunerationQueryFormData,
  ): Promise<PositionRemunerationUpdateResponse> {
    const response = await apiClient.put<PositionRemunerationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deletePositionRemuneration(id: string): Promise<PositionRemunerationDeleteResponse> {
    const response = await apiClient.delete<PositionRemunerationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePositionRemunerations(
    data: PositionRemunerationBatchCreateFormData,
    queryParams?: PositionRemunerationQueryFormData,
  ): Promise<PositionRemunerationBatchCreateResponse<PositionRemuneration>> {
    const response = await apiClient.post<PositionRemunerationBatchCreateResponse<PositionRemuneration>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdatePositionRemunerations(
    data: PositionRemunerationBatchUpdateFormData,
    queryParams?: PositionRemunerationQueryFormData,
  ): Promise<PositionRemunerationBatchUpdateResponse<PositionRemuneration>> {
    const response = await apiClient.put<PositionRemunerationBatchUpdateResponse<PositionRemuneration>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeletePositionRemunerations(data: PositionRemunerationBatchDeleteFormData): Promise<PositionRemunerationBatchDeleteResponse> {
    const response = await apiClient.delete<PositionRemunerationBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
    });
    return response.data;
  }

  // =====================
  // Specialized Operations
  // =====================

  async findByPositionId(positionId: string): Promise<PositionRemunerationGetManyResponse> {
    const response = await apiClient.get<PositionRemunerationGetManyResponse>(`${this.basePath}/position/${positionId}`);
    return response.data;
  }

  async getCurrentByPositionId(positionId: string): Promise<PositionRemunerationGetUniqueResponse> {
    const response = await apiClient.get<PositionRemunerationGetUniqueResponse>(`${this.basePath}/position/${positionId}/current`);
    return response.data;
  }

  async deleteByPositionId(positionId: string): Promise<PositionRemunerationDeleteResponse> {
    const response = await apiClient.delete<PositionRemunerationDeleteResponse>(`${this.basePath}/position/${positionId}`);
    return response.data;
  }

  async findByValueRange(min: number, max: number): Promise<PositionRemunerationGetManyResponse> {
    const response = await apiClient.get<PositionRemunerationGetManyResponse>(`${this.basePath}/value-range/${min}/${max}`);
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const positionService = new PositionService();
export const positionRemunerationService = new PositionRemunerationService();

// Position query exports
export const getPositions = (params?: PositionGetManyFormData) => positionService.getPositions(params);
export const getPositionById = (id: string, params?: Omit<PositionGetByIdFormData, "id">) => positionService.getPositionById(id, params);

// Position mutation exports
export const createPosition = (data: PositionCreateFormData, queryParams?: PositionQueryFormData) => positionService.createPosition(data, queryParams);
export const updatePosition = (id: string, data: PositionUpdateFormData, queryParams?: PositionQueryFormData) => positionService.updatePosition(id, data, queryParams);
export const deletePosition = (id: string) => positionService.deletePosition(id);

// Position batch exports
export const batchCreatePositions = (data: PositionBatchCreateFormData, queryParams?: PositionQueryFormData) => positionService.batchCreatePositions(data, queryParams);
export const batchUpdatePositions = (data: PositionBatchUpdateFormData, queryParams?: PositionQueryFormData) => positionService.batchUpdatePositions(data, queryParams);
export const batchDeletePositions = (data: PositionBatchDeleteFormData) => positionService.batchDeletePositions(data);

// Position Remuneration query exports
export const getPositionRemunerations = (params?: PositionRemunerationGetManyFormData) => positionRemunerationService.getPositionRemunerations(params);
export const getPositionRemunerationById = (params: PositionRemunerationGetByIdFormData) => positionRemunerationService.getPositionRemunerationById(params);

// Position Remuneration mutation exports
export const createPositionRemuneration = (data: PositionRemunerationCreateFormData, queryParams?: PositionRemunerationQueryFormData) =>
  positionRemunerationService.createPositionRemuneration(data, queryParams);
export const updatePositionRemuneration = (id: string, data: PositionRemunerationUpdateFormData, queryParams?: PositionRemunerationQueryFormData) =>
  positionRemunerationService.updatePositionRemuneration(id, data, queryParams);
export const deletePositionRemuneration = (id: string) => positionRemunerationService.deletePositionRemuneration(id);

// Position Remuneration batch exports
export const batchCreatePositionRemunerations = (data: PositionRemunerationBatchCreateFormData, queryParams?: PositionRemunerationQueryFormData) =>
  positionRemunerationService.batchCreatePositionRemunerations(data, queryParams);
export const batchUpdatePositionRemunerations = (data: PositionRemunerationBatchUpdateFormData, queryParams?: PositionRemunerationQueryFormData) =>
  positionRemunerationService.batchUpdatePositionRemunerations(data, queryParams);
export const batchDeletePositionRemunerations = (data: PositionRemunerationBatchDeleteFormData) => positionRemunerationService.batchDeletePositionRemunerations(data);

// Position Remuneration specialized exports
export const findPositionRemunerationsByPositionId = (positionId: string) => positionRemunerationService.findByPositionId(positionId);
export const getCurrentPositionRemunerationByPositionId = (positionId: string) => positionRemunerationService.getCurrentByPositionId(positionId);
export const deletePositionRemunerationsByPositionId = (positionId: string) => positionRemunerationService.deleteByPositionId(positionId);
export const findPositionRemunerationsByValueRange = (min: number, max: number) => positionRemunerationService.findByValueRange(min, max);
