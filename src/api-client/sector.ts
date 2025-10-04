// packages/api/src/sector.ts

import { apiClient } from "./axiosClient";
import type {
  // FormData types (parameters and responses)
  SectorGetManyFormData,
  SectorCreateFormData,
  SectorUpdateFormData,
  SectorBatchCreateFormData,
  SectorBatchUpdateFormData,
  SectorBatchDeleteFormData,
  Sector,
  SectorGetUniqueResponse,
  SectorGetManyResponse,
  SectorCreateResponse,
  SectorUpdateResponse,
  SectorDeleteResponse,
  SectorBatchCreateResponse,
  SectorBatchUpdateResponse,
  SectorBatchDeleteResponse,
} from "../types";

// =====================
// Sector Service Class
// =====================

export class SectorService {
  private readonly basePath = "/sectors";

  // =====================
  // Query Operations
  // =====================

  async getSectors(params?: SectorGetManyFormData): Promise<SectorGetManyResponse> {
    const response = await apiClient.get<SectorGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getSectorById(id: string, params?: any): Promise<SectorGetUniqueResponse> {
    const response = await apiClient.get<SectorGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createSector(data: SectorCreateFormData, query?: any): Promise<SectorCreateResponse> {
    const response = await apiClient.post<SectorCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateSector(id: string, data: SectorUpdateFormData, query?: any): Promise<SectorUpdateResponse> {
    const response = await apiClient.put<SectorUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteSector(id: string): Promise<SectorDeleteResponse> {
    const response = await apiClient.delete<SectorDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateSectors(data: SectorBatchCreateFormData, query?: any): Promise<SectorBatchCreateResponse<Sector>> {
    const response = await apiClient.post<SectorBatchCreateResponse<Sector>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateSectors(data: SectorBatchUpdateFormData, query?: any): Promise<SectorBatchUpdateResponse<Sector>> {
    const response = await apiClient.put<SectorBatchUpdateResponse<Sector>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteSectors(data: SectorBatchDeleteFormData, query?: any): Promise<SectorBatchDeleteResponse> {
    const response = await apiClient.delete<SectorBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const sectorService = new SectorService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getSectors = (params?: SectorGetManyFormData) => sectorService.getSectors(params);
export const getSectorById = (id: string, params?: any) => sectorService.getSectorById(id, params);

// Mutation Operations
export const createSector = (data: SectorCreateFormData, query?: any) => sectorService.createSector(data, query);
export const updateSector = (id: string, data: SectorUpdateFormData, query?: any) => sectorService.updateSector(id, data, query);
export const deleteSector = (id: string) => sectorService.deleteSector(id);

// Batch Operations
export const batchCreateSectors = (data: SectorBatchCreateFormData, query?: any) => sectorService.batchCreateSectors(data, query);
export const batchUpdateSectors = (data: SectorBatchUpdateFormData, query?: any) => sectorService.batchUpdateSectors(data, query);
export const batchDeleteSectors = (data: SectorBatchDeleteFormData, query?: any) => sectorService.batchDeleteSectors(data, query);
