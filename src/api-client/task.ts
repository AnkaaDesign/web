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
  ResponsibleCreateInlineFormData,
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
import { responsibleService } from "@/services/responsibleService";

// =====================
// Task Service Class
// =====================

export class TaskService {
  private readonly basePath = "/tasks";

  // =====================
  // Helper Methods
  // =====================

  /**
   * Process responsibles and create new ones if needed.
   * This should be called before creating or updating a task.
   *
   * @param customerId - The customer ID for the new responsibles (optional - can be empty/null)
   * @param responsibleIds - Array of responsible IDs (may include existing IDs)
   * @param newResponsibles - Array of new responsibles to create
   * @returns Updated array of responsible IDs with newly created ones
   */
  private async processResponsibles(
    customerId: string | null | undefined,
    responsibleIds: string[] = [],
    newResponsibles: ResponsibleCreateInlineFormData[] = []
  ): Promise<string[]> {
    if (!newResponsibles || newResponsibles.length === 0) {
      return responsibleIds;
    }

    const createdResponsibleIds: string[] = [];
    const errors: Array<{ responsible: ResponsibleCreateInlineFormData; error: any }> = [];

    // Create each new responsible
    for (const repData of newResponsibles) {
      try {
        // Use repData.customerId if available, otherwise use the passed customerId
        // Pass undefined if empty string to let backend handle optional field
        const effectiveCustomerId = repData.customerId || customerId || undefined;
        const created = await responsibleService.create({
          ...repData,
          customerId: effectiveCustomerId,
        });
        createdResponsibleIds.push(created.id);
      } catch (error) {
        errors.push({ responsible: repData, error });
      }
    }

    // If any responsible creation failed, throw an error
    if (errors.length > 0) {
      const errorMessages = errors.map(
        ({ responsible, error }) =>
          `${responsible.name} (${responsible.role}): ${error.message || 'Erro desconhecido'}`
      ).join('; ');

      throw new Error(`Falha ao criar responsáveis: ${errorMessages}`);
    }

    // Combine existing responsible IDs with newly created ones
    const existingIds = responsibleIds.filter(id => id && typeof id === 'string');
    return [...existingIds, ...createdResponsibleIds];
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
    // Handle responsible creation if needed
    let processedData = data;

    if (!(data instanceof FormData)) {
      // JSON payload - can directly access and modify properties
      if (data.newResponsibles && data.newResponsibles.length > 0) {
        // Get customerId from data or from the first newResponsible (they all have the same customerId)
        // customerId is now optional - responsibles can be created without a customer
        const customerId = data.customerId || data.newResponsibles[0]?.customerId;

        try {
          // Create responsibles and get their IDs
          const updatedRepIds = await this.processResponsibles(
            customerId || '', // Pass empty string if no customerId - backend handles optional
            data.responsibleIds,
            data.newResponsibles
          );

          // Update the data with the new responsible IDs
          processedData = {
            ...data,
            responsibleIds: updatedRepIds,
          };

          // Remove newResponsibles from the payload as they've been processed
          delete (processedData as any).newResponsibles;
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar responsáveis: ${error.message}`);
        }
      }
    } else {
      // FormData payload - need to extract and process
      // FormData arrays are serialized with indexed keys like newResponsibles[0], newResponsibles[1], etc.
      const newResponsibles: any[] = [];
      for (const [key, value] of data.entries()) {
        if (key.startsWith('newResponsibles[') && key.endsWith(']')) {
          try {
            newResponsibles.push(JSON.parse(value as string));
          } catch {
            // Skip invalid JSON entries
          }
        }
      }

      if (newResponsibles.length > 0) {
        try {
          // Get customerId from FormData OR from the first newResponsible (they all have the same customerId)
          const customerIdFromFormData = data.get('customerId') as string | null;
          const customerId = customerIdFromFormData || newResponsibles[0]?.customerId || '';

          // Get existing responsible IDs (also may be indexed)
          const existingRepIds: string[] = [];
          for (const [key, value] of data.entries()) {
            if (key.startsWith('responsibleIds[') && key.endsWith(']')) {
              existingRepIds.push(value as string);
            } else if (key === 'responsibleIds') {
              try {
                const parsed = JSON.parse(value as string);
                if (Array.isArray(parsed)) {
                  existingRepIds.push(...parsed);
                }
              } catch {
                // Single value
                if (value) existingRepIds.push(value as string);
              }
            }
          }

          // Create responsibles and get their IDs
          const updatedRepIds = await this.processResponsibles(
            customerId,
            existingRepIds,
            newResponsibles
          );

          // Create new FormData with updated responsible IDs
          processedData = new FormData();

          // Copy all existing entries except responsibleIds and newResponsibles
          for (const [key, value] of data.entries()) {
            if (!key.startsWith('responsibleIds') && !key.startsWith('newResponsibles')) {
              processedData.append(key, value);
            }
          }

          // Add updated responsible IDs as JSON array
          processedData.append('responsibleIds', JSON.stringify(updatedRepIds));
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar responsáveis: ${error.message}`);
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
    // Handle responsible creation if needed
    let processedData = data;

    if (!(data instanceof FormData)) {
      // JSON payload - can directly access and modify properties
      if (data.newResponsibles && data.newResponsibles.length > 0) {
        // Get customerId from data or from the first newResponsible (they all have the same customerId)
        // customerId is now optional - responsibles can be created without a customer
        const customerId = data.customerId || data.newResponsibles[0]?.customerId;

        try {
          // Create responsibles and get their IDs
          const updatedRepIds = await this.processResponsibles(
            customerId || '', // Pass empty string if no customerId - backend handles optional
            data.responsibleIds,
            data.newResponsibles
          );

          // Update the data with the new responsible IDs
          processedData = {
            ...data,
            responsibleIds: updatedRepIds,
          };

          // Remove newResponsibles from the payload as they've been processed
          delete (processedData as any).newResponsibles;
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar responsáveis: ${error.message}`);
        }
      }
    } else {
      // FormData payload - need to extract and process
      // FormData arrays are serialized with indexed keys like newResponsibles[0], newResponsibles[1], etc.
      const newResponsibles: any[] = [];
      for (const [key, value] of data.entries()) {
        if (key.startsWith('newResponsibles[') && key.endsWith(']')) {
          try {
            newResponsibles.push(JSON.parse(value as string));
          } catch {
            // Skip invalid JSON entries
          }
        }
      }

      if (newResponsibles.length > 0) {
        try {
          // Get customerId from FormData OR from the first newResponsible (they all have the same customerId)
          const customerIdFromFormData = data.get('customerId') as string | null;
          const customerId = customerIdFromFormData || newResponsibles[0]?.customerId || '';

          // Get existing responsible IDs (also may be indexed)
          const existingRepIds: string[] = [];
          for (const [key, value] of data.entries()) {
            if (key.startsWith('responsibleIds[') && key.endsWith(']')) {
              existingRepIds.push(value as string);
            } else if (key === 'responsibleIds') {
              try {
                const parsed = JSON.parse(value as string);
                if (Array.isArray(parsed)) {
                  existingRepIds.push(...parsed);
                }
              } catch {
                // Single value
                if (value) existingRepIds.push(value as string);
              }
            }
          }

          // Create responsibles and get their IDs
          const updatedRepIds = await this.processResponsibles(
            customerId,
            existingRepIds,
            newResponsibles
          );

          // Create new FormData with updated responsible IDs
          processedData = new FormData();

          // Copy all existing entries except responsibleIds and newResponsibles
          for (const [key, value] of data.entries()) {
            if (!key.startsWith('responsibleIds') && !key.startsWith('newResponsibles')) {
              processedData.append(key, value);
            }
          }

          // Add updated responsible IDs as JSON array
          processedData.append('responsibleIds', JSON.stringify(updatedRepIds));
        } catch (error: any) {
          // Re-throw with more context
          throw new Error(`Erro ao processar responsáveis: ${error.message}`);
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
