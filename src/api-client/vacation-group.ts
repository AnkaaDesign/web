// api-client/vacation-group.ts
// Férias Coletivas (Departamento Pessoal)

import { apiClient } from "./axiosClient";
import type {
  VacationGroupGetManyFormData,
  VacationGroupCreateFormData,
  VacationGroupUpdateFormData,
  VacationGroupAdvanceFormData,
} from "../schemas/vacation-group";
import type {
  VacationGroupGetUniqueResponse,
  VacationGroupGetManyResponse,
  VacationGroupCreateResponse,
  VacationGroupUpdateResponse,
  VacationGroupDeleteResponse,
  VacationGroupMembersResponse,
  VacationGroupExpandResponse,
  VacationGroupSyncResponse,
} from "../types/vacation-group";

// =====================
// VacationGroup Service Class
// =====================

export class VacationGroupService {
  private readonly basePath = "/vacation-groups";

  // Query Operations
  async getVacationGroups(params?: VacationGroupGetManyFormData): Promise<VacationGroupGetManyResponse> {
    const response = await apiClient.get<VacationGroupGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getVacationGroupById(id: string, params?: any): Promise<VacationGroupGetUniqueResponse> {
    const response = await apiClient.get<VacationGroupGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // Mutation Operations
  async createVacationGroup(data: VacationGroupCreateFormData, query?: any): Promise<VacationGroupCreateResponse> {
    const response = await apiClient.post<VacationGroupCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateVacationGroup(id: string, data: VacationGroupUpdateFormData, query?: any): Promise<VacationGroupUpdateResponse> {
    const response = await apiClient.put<VacationGroupUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteVacationGroup(id: string): Promise<VacationGroupDeleteResponse> {
    const response = await apiClient.delete<VacationGroupDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Members preview / Expand / Sync / Status machine
  async previewVacationGroupMembers(id: string): Promise<VacationGroupMembersResponse> {
    const response = await apiClient.get<VacationGroupMembersResponse>(`${this.basePath}/${id}/members`);
    return response.data;
  }

  async expandVacationGroup(id: string): Promise<VacationGroupExpandResponse> {
    const response = await apiClient.post<VacationGroupExpandResponse>(`${this.basePath}/${id}/expand`);
    return response.data;
  }

  async syncVacationGroup(id: string): Promise<VacationGroupSyncResponse> {
    const response = await apiClient.post<VacationGroupSyncResponse>(`${this.basePath}/${id}/sync`);
    return response.data;
  }

  async advanceVacationGroup(id: string, data: VacationGroupAdvanceFormData = {}, query?: any): Promise<VacationGroupUpdateResponse> {
    const response = await apiClient.put<VacationGroupUpdateResponse>(`${this.basePath}/${id}/advance`, data, { params: query });
    return response.data;
  }
}

export const vacationGroupService = new VacationGroupService();

// Query Operations
export const getVacationGroups = (params?: VacationGroupGetManyFormData) => vacationGroupService.getVacationGroups(params);
export const getVacationGroupById = (id: string, params?: any) => vacationGroupService.getVacationGroupById(id, params);

// Mutation Operations
export const createVacationGroup = (data: VacationGroupCreateFormData, query?: any) => vacationGroupService.createVacationGroup(data, query);
export const updateVacationGroup = (id: string, data: VacationGroupUpdateFormData, query?: any) => vacationGroupService.updateVacationGroup(id, data, query);
export const deleteVacationGroup = (id: string) => vacationGroupService.deleteVacationGroup(id);

// Members preview / Expand / Sync / Status machine
export const previewVacationGroupMembers = (id: string) => vacationGroupService.previewVacationGroupMembers(id);
export const expandVacationGroup = (id: string) => vacationGroupService.expandVacationGroup(id);
export const syncVacationGroup = (id: string) => vacationGroupService.syncVacationGroup(id);
export const advanceVacationGroup = (id: string, data?: VacationGroupAdvanceFormData, query?: any) => vacationGroupService.advanceVacationGroup(id, data, query);
