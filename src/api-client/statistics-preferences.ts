// packages/api-client/src/statistics-preferences.ts

import { apiClient } from "./axiosClient";
import type {
  StatisticsPageConfigUpsertFormData,
  StatisticsPresetCreateFormData,
  StatisticsPresetUpdateFormData,
} from "../schemas";
import type {
  StatisticsPreferencesGetResponse,
  StatisticsPageConfigUpsertResponse,
  StatisticsPresetCreateResponse,
  StatisticsPresetUpdateResponse,
  StatisticsPresetDeleteResponse,
} from "../types";

// =====================
// StatisticsPreferences Service Class
// =====================

export class StatisticsPreferencesService {
  private readonly basePath = "/statistics-preferences";

  /**
   * Get the current user's statistics preferences (last-seen configs + presets),
   * optionally scoped to a single page.
   */
  async getMine(pageKey?: string): Promise<StatisticsPreferencesGetResponse> {
    const response = await apiClient.get<StatisticsPreferencesGetResponse>(`${this.basePath}/me`, {
      params: pageKey ? { pageKey } : undefined,
    });
    return response.data;
  }

  /**
   * Upsert the last-seen config for a statistics page.
   * High-frequency auto-persist — toast suppressed.
   */
  async upsertPageConfig(data: StatisticsPageConfigUpsertFormData): Promise<StatisticsPageConfigUpsertResponse> {
    const response = await apiClient.put<StatisticsPageConfigUpsertResponse>(`${this.basePath}/me/page-config`, data, {
      metadata: { suppressToast: true },
    } as any);
    return response.data;
  }

  /**
   * Create a named preset for a statistics page.
   */
  async createPreset(data: StatisticsPresetCreateFormData): Promise<StatisticsPresetCreateResponse> {
    const response = await apiClient.post<StatisticsPresetCreateResponse>(`${this.basePath}/me/presets`, data);
    return response.data;
  }

  /**
   * Update a preset (rename and/or overwrite its config).
   */
  async updatePreset(id: string, data: StatisticsPresetUpdateFormData): Promise<StatisticsPresetUpdateResponse> {
    const response = await apiClient.put<StatisticsPresetUpdateResponse>(`${this.basePath}/me/presets/${id}`, data);
    return response.data;
  }

  /**
   * Delete a preset.
   */
  async deletePreset(id: string): Promise<StatisticsPresetDeleteResponse> {
    const response = await apiClient.delete<StatisticsPresetDeleteResponse>(`${this.basePath}/me/presets/${id}`);
    return response.data;
  }
}

// =====================
// Service Instance & Exports
// =====================

export const statisticsPreferencesService = new StatisticsPreferencesService();

export const getMyStatisticsPreferences = (pageKey?: string) => statisticsPreferencesService.getMine(pageKey);
export const upsertStatisticsPageConfig = (data: StatisticsPageConfigUpsertFormData) =>
  statisticsPreferencesService.upsertPageConfig(data);
export const createStatisticsPreset = (data: StatisticsPresetCreateFormData) =>
  statisticsPreferencesService.createPreset(data);
export const updateStatisticsPreset = (id: string, data: StatisticsPresetUpdateFormData) =>
  statisticsPreferencesService.updatePreset(id, data);
export const deleteStatisticsPreset = (id: string) => statisticsPreferencesService.deletePreset(id);
