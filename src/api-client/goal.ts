import { apiClient } from "./axiosClient";
import type {
  Goal,
  GoalGetManyFormData,
  GoalCreateFormData,
  GoalUpdateFormData,
  GoalUpsertYearFormData,
  GoalDeleteRowFormData,
  GoalGetUniqueResponse,
  GoalGetManyResponse,
  GoalCreateResponse,
  GoalUpdateResponse,
  GoalDeleteResponse,
  GoalUpsertYearResponse,
  GoalBatchCreateFormData,
  GoalBatchUpdateFormData,
  GoalBatchDeleteFormData,
  GoalBatchCreateResponse,
  GoalBatchUpdateResponse,
  GoalBatchDeleteResponse,
} from "../types";

export class GoalService {
  private readonly basePath = "/goals";

  async getGoals(params?: GoalGetManyFormData): Promise<GoalGetManyResponse> {
    const response = await apiClient.get<GoalGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getGoalById(id: string, params?: any): Promise<GoalGetUniqueResponse> {
    const response = await apiClient.get<GoalGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  async createGoal(data: GoalCreateFormData, query?: any): Promise<GoalCreateResponse> {
    const response = await apiClient.post<GoalCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updateGoal(id: string, data: GoalUpdateFormData, query?: any): Promise<GoalUpdateResponse> {
    const response = await apiClient.put<GoalUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteGoal(id: string): Promise<GoalDeleteResponse> {
    const response = await apiClient.delete<GoalDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async upsertGoalYear(data: GoalUpsertYearFormData): Promise<GoalUpsertYearResponse> {
    const response = await apiClient.post<GoalUpsertYearResponse>(`${this.basePath}/upsert-year`, data);
    return response.data;
  }

  async deleteGoalRow(data: GoalDeleteRowFormData): Promise<GoalDeleteResponse> {
    const response = await apiClient.delete<GoalDeleteResponse>(`${this.basePath}/row`, { data });
    return response.data;
  }

  // Batch (stubs — backend doesn't expose batch endpoints; provided for hook
  // signature parity with createEntityHooks).
  async batchCreateGoals(_data: GoalBatchCreateFormData): Promise<GoalBatchCreateResponse<Goal>> {
    throw new Error("Batch create not supported for goals");
  }
  async batchUpdateGoals(_data: GoalBatchUpdateFormData): Promise<GoalBatchUpdateResponse<Goal>> {
    throw new Error("Batch update not supported for goals");
  }
  async batchDeleteGoals(_data: GoalBatchDeleteFormData): Promise<GoalBatchDeleteResponse> {
    throw new Error("Batch delete not supported for goals");
  }
}

export const goalService = new GoalService();

export const getGoals = (params?: GoalGetManyFormData) => goalService.getGoals(params);
export const getGoalById = (id: string, params?: any) => goalService.getGoalById(id, params);
export const createGoal = (data: GoalCreateFormData, query?: any) => goalService.createGoal(data, query);
export const updateGoal = (id: string, data: GoalUpdateFormData, query?: any) => goalService.updateGoal(id, data, query);
export const deleteGoal = (id: string) => goalService.deleteGoal(id);
export const upsertGoalYear = (data: GoalUpsertYearFormData) => goalService.upsertGoalYear(data);
export const deleteGoalRow = (data: GoalDeleteRowFormData) => goalService.deleteGoalRow(data);
