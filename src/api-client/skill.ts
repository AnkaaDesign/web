// packages/api-client/src/skill.ts
//
// Skill catalogue endpoints — /skill
// See api/src/modules/skill/skill.controller.ts

import { apiClient } from "./axiosClient";
import type {
  SkillGetManyFormData,
  SkillQueryFormData,
  SkillCreateFormData,
  SkillUpdateFormData,
  SkillBatchCreateFormData,
  SkillBatchUpdateFormData,
  SkillBatchDeleteFormData,
  SkillGetManyResponse,
  SkillGetUniqueResponse,
  SkillCreateResponse,
  SkillUpdateResponse,
  SkillDeleteResponse,
  SkillBatchCreateResponse,
  SkillBatchUpdateResponse,
  SkillBatchDeleteResponse,
  Skill,
} from "../types";

// =====================
// Skill Service
// =====================

export class SkillService {
  private readonly basePath = "/skill";

  // ---- Query ----
  async getSkills(params?: SkillGetManyFormData): Promise<SkillGetManyResponse> {
    const response = await apiClient.get<SkillGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getSkillById(id: string, params?: SkillQueryFormData): Promise<SkillGetUniqueResponse> {
    const response = await apiClient.get<SkillGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // ---- CRUD ----
  async createSkill(
    data: SkillCreateFormData,
    query?: SkillQueryFormData,
  ): Promise<SkillCreateResponse> {
    const response = await apiClient.post<SkillCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateSkill(
    id: string,
    data: SkillUpdateFormData,
    query?: SkillQueryFormData,
  ): Promise<SkillUpdateResponse> {
    const response = await apiClient.patch<SkillUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteSkill(id: string): Promise<SkillDeleteResponse> {
    const response = await apiClient.delete<SkillDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // ---- Batch ----
  async batchCreateSkills(
    data: SkillBatchCreateFormData,
    query?: SkillQueryFormData,
  ): Promise<SkillBatchCreateResponse<Skill>> {
    const response = await apiClient.post<SkillBatchCreateResponse<Skill>>(
      `${this.basePath}/batch`,
      data,
      { params: query },
    );
    return response.data;
  }

  async batchUpdateSkills(
    data: SkillBatchUpdateFormData,
    query?: SkillQueryFormData,
  ): Promise<SkillBatchUpdateResponse<Skill>> {
    const response = await apiClient.patch<SkillBatchUpdateResponse<Skill>>(
      `${this.basePath}/batch`,
      data,
      { params: query },
    );
    return response.data;
  }

  async batchDeleteSkills(
    data: SkillBatchDeleteFormData,
  ): Promise<SkillBatchDeleteResponse> {
    const response = await apiClient.delete<SkillBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
    });
    return response.data;
  }
}

export const skillService = new SkillService();

// =====================
// Convenience exports (parity with item.ts style)
// =====================

export const getSkills = (params?: SkillGetManyFormData) => skillService.getSkills(params);
export const getSkillById = (id: string, params?: SkillQueryFormData) =>
  skillService.getSkillById(id, params);
export const createSkill = (data: SkillCreateFormData, query?: SkillQueryFormData) =>
  skillService.createSkill(data, query);
export const updateSkill = (id: string, data: SkillUpdateFormData, query?: SkillQueryFormData) =>
  skillService.updateSkill(id, data, query);
export const deleteSkill = (id: string) => skillService.deleteSkill(id);
export const batchCreateSkills = (data: SkillBatchCreateFormData, query?: SkillQueryFormData) =>
  skillService.batchCreateSkills(data, query);
export const batchUpdateSkills = (data: SkillBatchUpdateFormData, query?: SkillQueryFormData) =>
  skillService.batchUpdateSkills(data, query);
export const batchDeleteSkills = (data: SkillBatchDeleteFormData) =>
  skillService.batchDeleteSkills(data);
