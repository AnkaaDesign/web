// packages/api/src/task.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  TaskGetManyFormData,
  TaskGetByIdFormData,
  TaskCreateFormData,
  TaskUpdateFormData,
  TaskBatchCreateFormData,
  TaskBatchUpdateFormData,
  TaskBatchDeleteFormData,
  TaskDuplicateFormData,
  TaskQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Task,
  TaskGetUniqueResponse,
  TaskGetManyResponse,
  TaskCreateResponse,
  TaskUpdateResponse,
  TaskDeleteResponse,
  TaskBatchCreateResponse,
  TaskBatchUpdateResponse,
  TaskBatchDeleteResponse,
} from "../types";

// =====================
// Task Service Class
// =====================

export class TaskService {
  private readonly basePath = "/tasks";

  // =====================
  // Query Operations
  // =====================

  async getTasks(params: TaskGetManyFormData = {}): Promise<TaskGetManyResponse> {
    const response = await apiClient.get<TaskGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getTaskById(id: string, params?: Omit<TaskGetByIdFormData, "id">): Promise<TaskGetUniqueResponse> {
    const response = await apiClient.get<TaskGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createTask(data: TaskCreateFormData | FormData, query?: TaskQueryFormData): Promise<TaskCreateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.post<TaskCreateResponse>(this.basePath, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async updateTask(id: string, data: TaskUpdateFormData | FormData, query?: TaskQueryFormData): Promise<TaskUpdateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<TaskUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async deleteTask(id: string): Promise<TaskDeleteResponse> {
    const response = await apiClient.delete<TaskDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateTasks(data: TaskBatchCreateFormData, query?: TaskQueryFormData): Promise<TaskBatchCreateResponse<Task>> {
    const response = await apiClient.post<TaskBatchCreateResponse<Task>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateTasks(data: TaskBatchUpdateFormData, query?: TaskQueryFormData): Promise<TaskBatchUpdateResponse<Task>> {
    const response = await apiClient.put<TaskBatchUpdateResponse<Task>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteTasks(data: TaskBatchDeleteFormData, query?: TaskQueryFormData): Promise<TaskBatchDeleteResponse> {
    const response = await apiClient.delete<TaskBatchDeleteResponse>(`${this.basePath}/batch`, { data, params: query });
    return response.data;
  }

  // =====================
  // Special Operations
  // =====================

  async duplicateTask(data: TaskDuplicateFormData, query?: TaskQueryFormData): Promise<TaskBatchCreateResponse<Task>> {
    const response = await apiClient.post<TaskBatchCreateResponse<Task>>(`${this.basePath}/duplicate`, data, { params: query });
    return response.data;
  }

  async rollbackFieldChange(data: { changeLogId: string }): Promise<TaskUpdateResponse> {
    const response = await apiClient.post<TaskUpdateResponse>(`${this.basePath}/rollback-field`, data);
    return response.data;
  }

  // =====================
  // Positioning Operations
  // =====================

  async getInProductionTasks(query?: TaskQueryFormData): Promise<TaskGetManyResponse> {
    const response = await apiClient.get<TaskGetManyResponse>(`${this.basePath}/in-production`, {
      params: query,
    });
    return response.data;
  }

  async updateTaskPosition(
    id: string,
    data: {
      xPosition?: number | null;
      yPosition?: number | null;
      garageId?: string | null;
      laneId?: string | null;
    },
    query?: TaskQueryFormData
  ): Promise<TaskUpdateResponse> {
    const response = await apiClient.put<TaskUpdateResponse>(`${this.basePath}/${id}/position`, data, {
      params: query,
    });
    return response.data;
  }

  async bulkUpdatePositions(
    data: {
      updates: Array<{
        taskId: string;
        xPosition?: number | null;
        yPosition?: number | null;
        garageId?: string | null;
        laneId?: string | null;
      }>;
    },
    query?: TaskQueryFormData
  ): Promise<TaskBatchUpdateResponse<Task>> {
    const response = await apiClient.post<TaskBatchUpdateResponse<Task>>(`${this.basePath}/bulk-position`, data, {
      params: query,
    });
    return response.data;
  }

  async swapTaskPositions(
    id: string,
    targetTaskId: string,
    query?: TaskQueryFormData
  ): Promise<{ success: boolean; message: string; data: { task1: Task; task2: Task } }> {
    const response = await apiClient.post<{ success: boolean; message: string; data: { task1: Task; task2: Task } }>(
      `${this.basePath}/${id}/swap`,
      { targetTaskId },
      { params: query }
    );
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const taskService = new TaskService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getTasks = (params: TaskGetManyFormData = {}) => taskService.getTasks(params);
export const getTaskById = (id: string, params?: Omit<TaskGetByIdFormData, "id">) => taskService.getTaskById(id, params);

// Mutation Operations
export const createTask = (data: TaskCreateFormData | FormData, query?: TaskQueryFormData) => taskService.createTask(data, query);
export const updateTask = (id: string, data: TaskUpdateFormData | FormData, query?: TaskQueryFormData) => taskService.updateTask(id, data, query);
export const deleteTask = (id: string) => taskService.deleteTask(id);

// Batch Operations
export const batchCreateTasks = (data: TaskBatchCreateFormData, query?: TaskQueryFormData) => taskService.batchCreateTasks(data, query);
export const batchUpdateTasks = (data: TaskBatchUpdateFormData, query?: TaskQueryFormData) => taskService.batchUpdateTasks(data, query);
export const batchDeleteTasks = (data: TaskBatchDeleteFormData, query?: TaskQueryFormData) => taskService.batchDeleteTasks(data, query);

// Special operation exports
export const duplicateTask = (data: TaskDuplicateFormData, query?: TaskQueryFormData) => taskService.duplicateTask(data, query);
export const rollbackFieldChange = (data: { changeLogId: string }) => taskService.rollbackFieldChange(data);

// Positioning operation exports
export const getInProductionTasks = (query?: TaskQueryFormData) => taskService.getInProductionTasks(query);
export const updateTaskPosition = (
  id: string,
  data: { xPosition?: number | null; yPosition?: number | null; garageId?: string | null; laneId?: string | null },
  query?: TaskQueryFormData
) => taskService.updateTaskPosition(id, data, query);
export const bulkUpdatePositions = (
  data: {
    updates: Array<{
      taskId: string;
      xPosition?: number | null;
      yPosition?: number | null;
      garageId?: string | null;
      laneId?: string | null;
    }>;
  },
  query?: TaskQueryFormData
) => taskService.bulkUpdatePositions(data, query);
export const swapTaskPositions = (id: string, targetTaskId: string, query?: TaskQueryFormData) =>
  taskService.swapTaskPositions(id, targetTaskId, query);
