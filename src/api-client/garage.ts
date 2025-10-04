// packages/api/src/garage.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  GarageGetManyFormData,
  GarageGetByIdFormData,
  GarageCreateFormData,
  GarageUpdateFormData,
  GarageBatchCreateFormData,
  GarageBatchUpdateFormData,
  GarageBatchDeleteFormData,
  GarageQueryFormData,
  GarageLaneGetManyFormData,
  GarageLaneGetByIdFormData,
  GarageLaneCreateFormData,
  GarageLaneUpdateFormData,
  GarageLaneBatchCreateFormData,
  GarageLaneBatchUpdateFormData,
  GarageLaneBatchDeleteFormData,
  GarageLaneQueryFormData,
  ParkingSpotGetManyFormData,
  ParkingSpotGetByIdFormData,
  ParkingSpotCreateFormData,
  ParkingSpotUpdateFormData,
  ParkingSpotBatchCreateFormData,
  ParkingSpotBatchUpdateFormData,
  ParkingSpotBatchDeleteFormData,
  ParkingSpotQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Garage,
  GarageLane,
  ParkingSpot,
  GarageGetUniqueResponse,
  GarageGetManyResponse,
  GarageCreateResponse,
  GarageUpdateResponse,
  GarageDeleteResponse,
  GarageBatchCreateResponse,
  GarageBatchUpdateResponse,
  GarageBatchDeleteResponse,
  GarageLaneGetUniqueResponse,
  GarageLaneGetManyResponse,
  GarageLaneCreateResponse,
  GarageLaneUpdateResponse,
  GarageLaneDeleteResponse,
  GarageLaneBatchCreateResponse,
  GarageLaneBatchUpdateResponse,
  GarageLaneBatchDeleteResponse,
  ParkingSpotGetUniqueResponse,
  ParkingSpotGetManyResponse,
  ParkingSpotCreateResponse,
  ParkingSpotUpdateResponse,
  ParkingSpotDeleteResponse,
  ParkingSpotBatchCreateResponse,
  ParkingSpotBatchUpdateResponse,
  ParkingSpotBatchDeleteResponse,
} from "../types";

// =====================
// Garage Service Class
// =====================

export class GarageService {
  private readonly basePath = "/garages";

  // =====================
  // Garage Query Operations
  // =====================

  async getGarages(params?: GarageGetManyFormData): Promise<GarageGetManyResponse> {
    const response = await apiClient.get<GarageGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getGarageById(id: string, params?: Omit<GarageGetByIdFormData, "id">): Promise<GarageGetUniqueResponse> {
    const response = await apiClient.get<GarageGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Garage CRUD Operations
  // =====================

  async createGarage(data: GarageCreateFormData, params?: GarageQueryFormData): Promise<GarageCreateResponse> {
    const response = await apiClient.post<GarageCreateResponse>(this.basePath, data, {
      params,
    });
    return response.data;
  }

  async updateGarage(id: string, data: GarageUpdateFormData, params?: GarageQueryFormData): Promise<GarageUpdateResponse> {
    const response = await apiClient.put<GarageUpdateResponse>(`${this.basePath}/${id}`, data, {
      params,
    });
    return response.data;
  }

  async deleteGarage(id: string): Promise<GarageDeleteResponse> {
    const response = await apiClient.delete<GarageDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Garage Batch Operations
  // =====================

  async batchCreateGarages(data: GarageBatchCreateFormData, params?: GarageQueryFormData): Promise<GarageBatchCreateResponse<Garage>> {
    const response = await apiClient.post<GarageBatchCreateResponse<Garage>>(`${this.basePath}/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchUpdateGarages(data: GarageBatchUpdateFormData, params?: GarageQueryFormData): Promise<GarageBatchUpdateResponse<Garage>> {
    const response = await apiClient.put<GarageBatchUpdateResponse<Garage>>(`${this.basePath}/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchDeleteGarages(data: GarageBatchDeleteFormData): Promise<GarageBatchDeleteResponse> {
    const response = await apiClient.delete<GarageBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
    });
    return response.data;
  }

  // =====================
  // GarageLane Query Operations
  // =====================

  async getGarageLanes(params?: GarageLaneGetManyFormData): Promise<GarageLaneGetManyResponse> {
    const response = await apiClient.get<GarageLaneGetManyResponse>(`${this.basePath}/lanes`, {
      params,
    });
    return response.data;
  }

  async getGarageLaneById(params: GarageLaneGetByIdFormData): Promise<GarageLaneGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<GarageLaneGetUniqueResponse>(`${this.basePath}/lanes/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // GarageLane CRUD Operations
  // =====================

  async createGarageLane(data: GarageLaneCreateFormData, params?: GarageLaneQueryFormData): Promise<GarageLaneCreateResponse> {
    const response = await apiClient.post<GarageLaneCreateResponse>(`${this.basePath}/lanes`, data, {
      params,
    });
    return response.data;
  }

  async updateGarageLane(id: string, data: GarageLaneUpdateFormData, params?: GarageLaneQueryFormData): Promise<GarageLaneUpdateResponse> {
    const response = await apiClient.put<GarageLaneUpdateResponse>(`${this.basePath}/lanes/${id}`, data, {
      params,
    });
    return response.data;
  }

  async deleteGarageLane(id: string): Promise<GarageLaneDeleteResponse> {
    const response = await apiClient.delete<GarageLaneDeleteResponse>(`${this.basePath}/lanes/${id}`);
    return response.data;
  }

  // =====================
  // GarageLane Batch Operations
  // =====================

  async batchCreateGarageLanes(data: GarageLaneBatchCreateFormData, params?: GarageLaneQueryFormData): Promise<GarageLaneBatchCreateResponse<GarageLane>> {
    const response = await apiClient.post<GarageLaneBatchCreateResponse<GarageLane>>(`${this.basePath}/lanes/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchUpdateGarageLanes(data: GarageLaneBatchUpdateFormData, params?: GarageLaneQueryFormData): Promise<GarageLaneBatchUpdateResponse<GarageLane>> {
    const response = await apiClient.put<GarageLaneBatchUpdateResponse<GarageLane>>(`${this.basePath}/lanes/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchDeleteGarageLanes(data: GarageLaneBatchDeleteFormData): Promise<GarageLaneBatchDeleteResponse> {
    const response = await apiClient.delete<GarageLaneBatchDeleteResponse>(`${this.basePath}/lanes/batch`, {
      data,
    });
    return response.data;
  }

  // =====================
  // ParkingSpot Query Operations
  // =====================

  async getParkingSpots(params?: ParkingSpotGetManyFormData): Promise<ParkingSpotGetManyResponse> {
    const response = await apiClient.get<ParkingSpotGetManyResponse>(`${this.basePath}/spots`, {
      params,
    });
    return response.data;
  }

  async getParkingSpotById(params: ParkingSpotGetByIdFormData): Promise<ParkingSpotGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<ParkingSpotGetUniqueResponse>(`${this.basePath}/spots/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // ParkingSpot CRUD Operations
  // =====================

  async createParkingSpot(data: ParkingSpotCreateFormData, params?: ParkingSpotQueryFormData): Promise<ParkingSpotCreateResponse> {
    const response = await apiClient.post<ParkingSpotCreateResponse>(`${this.basePath}/spots`, data, {
      params,
    });
    return response.data;
  }

  async updateParkingSpot(id: string, data: ParkingSpotUpdateFormData, params?: ParkingSpotQueryFormData): Promise<ParkingSpotUpdateResponse> {
    const response = await apiClient.put<ParkingSpotUpdateResponse>(`${this.basePath}/spots/${id}`, data, {
      params,
    });
    return response.data;
  }

  async deleteParkingSpot(id: string): Promise<ParkingSpotDeleteResponse> {
    const response = await apiClient.delete<ParkingSpotDeleteResponse>(`${this.basePath}/spots/${id}`);
    return response.data;
  }

  // =====================
  // ParkingSpot Batch Operations
  // =====================

  async batchCreateParkingSpots(data: ParkingSpotBatchCreateFormData, params?: ParkingSpotQueryFormData): Promise<ParkingSpotBatchCreateResponse<ParkingSpot>> {
    const response = await apiClient.post<ParkingSpotBatchCreateResponse<ParkingSpot>>(`${this.basePath}/spots/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchUpdateParkingSpots(data: ParkingSpotBatchUpdateFormData, params?: ParkingSpotQueryFormData): Promise<ParkingSpotBatchUpdateResponse<ParkingSpot>> {
    const response = await apiClient.put<ParkingSpotBatchUpdateResponse<ParkingSpot>>(`${this.basePath}/spots/batch`, data, {
      params,
    });
    return response.data;
  }

  async batchDeleteParkingSpots(data: ParkingSpotBatchDeleteFormData): Promise<ParkingSpotBatchDeleteResponse> {
    const response = await apiClient.delete<ParkingSpotBatchDeleteResponse>(`${this.basePath}/spots/batch`, {
      data,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const garageService = new GarageService();

// =====================
// Export individual functions (for backward compatibility)
// =====================

// Garage functions
export const getGarages = (params?: GarageGetManyFormData) => garageService.getGarages(params);
export const getGarageById = (id: string, params?: Omit<GarageGetByIdFormData, "id">) => garageService.getGarageById(id, params);
export const createGarage = (data: GarageCreateFormData, params?: GarageQueryFormData) => garageService.createGarage(data, params);
export const updateGarage = (id: string, data: GarageUpdateFormData, params?: GarageQueryFormData) => garageService.updateGarage(id, data, params);
export const deleteGarage = (id: string) => garageService.deleteGarage(id);
export const batchCreateGarages = (data: GarageBatchCreateFormData, params?: GarageQueryFormData) => garageService.batchCreateGarages(data, params);
export const batchUpdateGarages = (data: GarageBatchUpdateFormData, params?: GarageQueryFormData) => garageService.batchUpdateGarages(data, params);
export const batchDeleteGarages = (data: GarageBatchDeleteFormData) => garageService.batchDeleteGarages(data);

// GarageLane functions
export const getGarageLanes = (params?: GarageLaneGetManyFormData) => garageService.getGarageLanes(params);
export const getGarageLaneById = (id: string, params?: Omit<GarageLaneGetByIdFormData, "id">) => garageService.getGarageLaneById({ id, ...params });
export const createGarageLane = (data: GarageLaneCreateFormData, params?: GarageLaneQueryFormData) => garageService.createGarageLane(data, params);
export const updateGarageLane = (id: string, data: GarageLaneUpdateFormData, params?: GarageLaneQueryFormData) => garageService.updateGarageLane(id, data, params);
export const deleteGarageLane = (id: string) => garageService.deleteGarageLane(id);
export const batchCreateGarageLanes = (data: GarageLaneBatchCreateFormData, params?: GarageLaneQueryFormData) => garageService.batchCreateGarageLanes(data, params);
export const batchUpdateGarageLanes = (data: GarageLaneBatchUpdateFormData, params?: GarageLaneQueryFormData) => garageService.batchUpdateGarageLanes(data, params);
export const batchDeleteGarageLanes = (data: GarageLaneBatchDeleteFormData) => garageService.batchDeleteGarageLanes(data);

// ParkingSpot functions
export const getParkingSpots = (params?: ParkingSpotGetManyFormData) => garageService.getParkingSpots(params);
export const getParkingSpotById = (id: string, params?: Omit<ParkingSpotGetByIdFormData, "id">) => garageService.getParkingSpotById({ id, ...params });
export const createParkingSpot = (data: ParkingSpotCreateFormData, params?: ParkingSpotQueryFormData) => garageService.createParkingSpot(data, params);
export const updateParkingSpot = (id: string, data: ParkingSpotUpdateFormData, params?: ParkingSpotQueryFormData) => garageService.updateParkingSpot(id, data, params);
export const deleteParkingSpot = (id: string) => garageService.deleteParkingSpot(id);
export const batchCreateParkingSpots = (data: ParkingSpotBatchCreateFormData, params?: ParkingSpotQueryFormData) => garageService.batchCreateParkingSpots(data, params);
export const batchUpdateParkingSpots = (data: ParkingSpotBatchUpdateFormData, params?: ParkingSpotQueryFormData) => garageService.batchUpdateParkingSpots(data, params);
export const batchDeleteParkingSpots = (data: ParkingSpotBatchDeleteFormData) => garageService.batchDeleteParkingSpots(data);
