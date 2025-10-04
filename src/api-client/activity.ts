// packages/api-client/src/activity.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ActivityGetManyFormData,
  ActivityGetByIdFormData,
  ActivityCreateFormData,
  ActivityUpdateFormData,
  ActivityBatchCreateFormData,
  ActivityBatchUpdateFormData,
  ActivityBatchDeleteFormData,
  ActivityQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Activity,
  ActivityGetUniqueResponse,
  ActivityGetManyResponse,
  ActivityCreateResponse,
  ActivityUpdateResponse,
  ActivityDeleteResponse,
  ActivityBatchCreateResponse,
  ActivityBatchUpdateResponse,
  ActivityBatchDeleteResponse,
} from "../types";

// =====================
// Activity Service Class
// =====================

export class ActivityService {
  private readonly basePath = "/activities";

  // =====================
  // Query Operations
  // =====================

  async getActivities(params?: ActivityGetManyFormData): Promise<ActivityGetManyResponse> {
    const response = await apiClient.get<ActivityGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getActivityById(id: string, params?: Omit<ActivityGetByIdFormData, "id">): Promise<ActivityGetUniqueResponse> {
    const response = await apiClient.get<ActivityGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createActivity(data: ActivityCreateFormData, query?: ActivityQueryFormData): Promise<ActivityCreateResponse> {
    const response = await apiClient.post<ActivityCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateActivity(id: string, data: ActivityUpdateFormData, query?: ActivityQueryFormData): Promise<ActivityUpdateResponse> {
    const response = await apiClient.put<ActivityUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteActivity(id: string): Promise<ActivityDeleteResponse> {
    const response = await apiClient.delete<ActivityDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateActivities(data: ActivityBatchCreateFormData, query?: ActivityQueryFormData): Promise<ActivityBatchCreateResponse<Activity>> {
    const response = await apiClient.post<ActivityBatchCreateResponse<Activity>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateActivities(data: ActivityBatchUpdateFormData, query?: ActivityQueryFormData): Promise<ActivityBatchUpdateResponse<Activity>> {
    const response = await apiClient.put<ActivityBatchUpdateResponse<Activity>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteActivities(data: ActivityBatchDeleteFormData, query?: ActivityQueryFormData): Promise<ActivityBatchDeleteResponse> {
    const response = await apiClient.delete<ActivityBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const activityService = new ActivityService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getActivities = (params?: ActivityGetManyFormData) => activityService.getActivities(params);
export const getActivityById = (id: string, params?: Omit<ActivityGetByIdFormData, "id">) => activityService.getActivityById(id, params);

// Mutation Operations
export const createActivity = (data: ActivityCreateFormData, query?: ActivityQueryFormData) => activityService.createActivity(data, query);
export const updateActivity = (id: string, data: ActivityUpdateFormData, query?: ActivityQueryFormData) => activityService.updateActivity(id, data, query);
export const deleteActivity = (id: string) => activityService.deleteActivity(id);

// Batch Operations
export const batchCreateActivities = (data: ActivityBatchCreateFormData, query?: ActivityQueryFormData) => activityService.batchCreateActivities(data, query);
export const batchUpdateActivities = (data: ActivityBatchUpdateFormData, query?: ActivityQueryFormData) => activityService.batchUpdateActivities(data, query);
export const batchDeleteActivities = (data: ActivityBatchDeleteFormData, query?: ActivityQueryFormData) => activityService.batchDeleteActivities(data, query);
