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
  TaskCopyRequest,
  RepresentativeCreateInlineFormData,
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
  Representative,
} from "../types";
import { representativeService } from "@/services/representativeService";

// =====================
// Task Service Class
// =====================

export class TaskService {
  private readonly basePath = "/tasks";

  // =====================
  // Helper Methods
  // =====================

  /**
   * Process representatives and create new ones if needed.
   * This should be called before creating or updating a task.
   *
   * @param customerId - The customer ID for the new representatives
   * @param representativeIds - Array of representative IDs (may include existing IDs)
   * @param newRepresentatives - Array of new representatives to create
   * @returns Updated array of representative IDs with newly created ones
   */
  private async processRepresentatives(
    customerId: string,
    representativeIds: string[] = [],
    newRepresentatives: RepresentativeCreateInlineFormData[] = []
  ): Promise<string[]> {
    if (!newRepresentatives || newRepresentatives.length === 0) {
      return representativeIds;
    }

    const createdRepresentativeIds: string[] = [];
    const errors: Array<{ representative: RepresentativeCreateInlineFormData; error: any }> = [];

    // Create each new representative
    for (const repData of newRepresentatives) {
      try {
        const created = await representativeService.create({
          ...repData,
          customerId,
        });
        createdRepresentativeIds.push(created.id);
      } catch (error) {
        errors.push({ representative: repData, error });
      }
    }

    // If any representative creation failed, throw an error
    if (errors.length > 0) {
      const errorMessages = errors.map(
        ({ representative, error }) =>
          `${representative.name} (${representative.role}): ${error.message || 'Erro desconhecido'}`
      ).join('; ');

      throw new Error(`Falha ao criar representantes: ${errorMessages}`);
    }

    // Combine existing representative IDs with newly created ones
    const existingIds = representativeIds.filter(id => id && typeof id === 'string');
    return [...existingIds, ...createdRepresentativeIds];
  }

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
    // Handle representative creation if needed
    let processedData = data;

    if (!(data instanceof FormData)) {
      // JSON payload - can directly access and modify properties
      if (data.newRepresentatives && data.newRepresentatives.length > 0) {
        if (!data.customerId) {
          throw new Error('customerId is required when creating new representatives');
        }

        try {
          // Create representatives and get their IDs
          const updatedRepIds = await this.processRepresentatives(
            data.customerId,
            data.representativeIds,
            data.newRepresentatives
          );

          // Update the data with the new representative IDs
          processedData = {
            ...data,
            representativeIds: updatedRepIds,
          };

          // Remove newRepresentatives from the payload as they've been processed
          delete (processedData as any).newRepresentatives;
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar representantes: ${error.message}`);
        }
      }
    } else {
      // FormData payload - need to extract and process
      const newRepresentativesJson = data.get('newRepresentatives');
      const customerIdValue = data.get('customerId');

      if (newRepresentativesJson && customerIdValue) {
        try {
          const newRepresentatives = JSON.parse(newRepresentativesJson as string);
          const representativeIdsJson = data.get('representativeIds');
          const existingRepIds = representativeIdsJson ? JSON.parse(representativeIdsJson as string) : [];

          // Create representatives and get their IDs
          const updatedRepIds = await this.processRepresentatives(
            customerIdValue as string,
            existingRepIds,
            newRepresentatives
          );

          // Create new FormData with updated representative IDs
          processedData = new FormData();

          // Copy all existing entries except representativeIds and newRepresentatives
          for (const [key, value] of data.entries()) {
            if (key !== 'representativeIds' && key !== 'newRepresentatives') {
              processedData.append(key, value);
            }
          }

          // Add updated representative IDs
          processedData.append('representativeIds', JSON.stringify(updatedRepIds));
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar representantes: ${error.message}`);
        }
      }
    }

    // Don't set Content-Type for FormData - let axios handle it automatically
    const response = await apiClient.post<TaskCreateResponse>(this.basePath, processedData, {
      params: query,
    });
    return response.data;
  }

  async updateTask(id: string, data: TaskUpdateFormData | FormData, query?: TaskQueryFormData): Promise<TaskUpdateResponse> {
    // Handle representative creation if needed
    let processedData = data;

    if (!(data instanceof FormData)) {
      // JSON payload - can directly access and modify properties
      if (data.newRepresentatives && data.newRepresentatives.length > 0) {
        if (!data.customerId) {
          throw new Error('customerId is required when creating new representatives');
        }

        try {
          // Create representatives and get their IDs
          const updatedRepIds = await this.processRepresentatives(
            data.customerId,
            data.representativeIds,
            data.newRepresentatives
          );

          // Update the data with the new representative IDs
          processedData = {
            ...data,
            representativeIds: updatedRepIds,
          };

          // Remove newRepresentatives from the payload as they've been processed
          delete (processedData as any).newRepresentatives;
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar representantes: ${error.message}`);
        }
      }
    } else {
      // FormData payload - need to extract and process
      const newRepresentativesJson = data.get('newRepresentatives');
      const customerIdValue = data.get('customerId');

      if (newRepresentativesJson && customerIdValue) {
        try {
          const newRepresentatives = JSON.parse(newRepresentativesJson as string);
          const representativeIdsJson = data.get('representativeIds');
          const existingRepIds = representativeIdsJson ? JSON.parse(representativeIdsJson as string) : [];

          // Create representatives and get their IDs
          const updatedRepIds = await this.processRepresentatives(
            customerIdValue as string,
            existingRepIds,
            newRepresentatives
          );

          // Create new FormData with updated representative IDs
          processedData = new FormData();

          // Copy all existing entries except representativeIds and newRepresentatives
          for (const [key, value] of data.entries()) {
            if (key !== 'representativeIds' && key !== 'newRepresentatives') {
              processedData.append(key, value);
            }
          }

          // Add updated representative IDs
          processedData.append('representativeIds', JSON.stringify(updatedRepIds));
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar representantes: ${error.message}`);
        }
      }
    }

    // Don't set Content-Type for FormData - let axios handle it automatically
    const response = await apiClient.put<TaskUpdateResponse>(`${this.basePath}/${id}`, processedData, {
      params: query,
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

  async batchUpdateTasks(data: TaskBatchUpdateFormData | FormData, query?: TaskQueryFormData): Promise<TaskBatchUpdateResponse<Task>> {
    // Don't set Content-Type for FormData - let axios handle it automatically
    const headers = data instanceof FormData ? {} : {};
    const response = await apiClient.put<TaskBatchUpdateResponse<Task>>(`${this.basePath}/batch`, data, {
      params: query,
      headers,
    });
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

  // =====================
  // Copy Operations
  // =====================

  async copyFromTask(destinationTaskId: string, data: TaskCopyRequest, query?: TaskQueryFormData): Promise<TaskUpdateResponse> {
    const response = await apiClient.put<TaskUpdateResponse>(`${this.basePath}/${destinationTaskId}/copy-from`, data, {
      params: query,
    });
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
export const batchUpdateTasks = (data: TaskBatchUpdateFormData | FormData, query?: TaskQueryFormData) => taskService.batchUpdateTasks(data, query);
export const batchDeleteTasks = (data: TaskBatchDeleteFormData, query?: TaskQueryFormData) => taskService.batchDeleteTasks(data, query);

// Special operation exports
export const duplicateTask = (data: TaskDuplicateFormData, query?: TaskQueryFormData) => taskService.duplicateTask(data, query);
export const rollbackFieldChange = (data: { changeLogId: string }) => taskService.rollbackFieldChange(data);

// Positioning operation exports
export const getInProductionTasks = (query?: TaskQueryFormData) => taskService.getInProductionTasks(query);
export const updateTaskPosition = (
  id: string,
  data: { xPosition?: number | null; yPosition?: number | null; laneId?: string | null },
  query?: TaskQueryFormData
) => taskService.updateTaskPosition(id, data, query);
export const bulkUpdatePositions = (
  data: {
    updates: Array<{
      taskId: string;
      xPosition?: number | null;
      yPosition?: number | null;
      laneId?: string | null;
    }>;
  },
  query?: TaskQueryFormData
) => taskService.bulkUpdatePositions(data, query);
export const swapTaskPositions = (id: string, targetTaskId: string, query?: TaskQueryFormData) =>
  taskService.swapTaskPositions(id, targetTaskId, query);

// Copy operation exports
export const copyFromTask = (destinationTaskId: string, data: TaskCopyRequest, query?: TaskQueryFormData) =>
  taskService.copyFromTask(destinationTaskId, data, query);
