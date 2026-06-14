// packages/api-client/src/user-position-history.ts
// Histórico de cargos (Departamento Pessoal)

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  UserPositionHistoryGetManyFormData,
  UserPositionHistoryGetByIdFormData,
  UserPositionHistoryPromoteFormData,
  UserPositionHistoryQueryFormData,
} from "../schemas/user-position-history";
import type {
  // Interface types (for responses)
  UserPositionHistoryGetUniqueResponse,
  UserPositionHistoryGetManyResponse,
  UserPositionHistoryPromoteResponse,
  UserSalaryAtResponse,
} from "../types/user-position-history";

// =====================
// UserPositionHistory Service Class
// =====================

export class UserPositionHistoryService {
  private readonly basePath = "/user-position-history";

  // =====================
  // Query Operations
  // =====================

  async getUserPositionHistories(params?: UserPositionHistoryGetManyFormData): Promise<UserPositionHistoryGetManyResponse> {
    const response = await apiClient.get<UserPositionHistoryGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getUserPositionHistoryById(id: string, params?: Omit<UserPositionHistoryGetByIdFormData, "id">): Promise<UserPositionHistoryGetUniqueResponse> {
    const response = await apiClient.get<UserPositionHistoryGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  /**
   * GET /user-position-history/salary-at — resolve the salary a user (or users)
   * had at a given date, composed from UserPositionHistory × position value
   * history. Pass `userId` OR `userIds` (comma-separated) + `date`.
   */
  async getSalaryAt(params: { userId?: string; userIds?: string; date?: string }): Promise<UserSalaryAtResponse> {
    const response = await apiClient.get<UserSalaryAtResponse>(`${this.basePath}/salary-at`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async promoteUser(data: UserPositionHistoryPromoteFormData, queryParams?: UserPositionHistoryQueryFormData): Promise<UserPositionHistoryPromoteResponse> {
    const response = await apiClient.post<UserPositionHistoryPromoteResponse>(`${this.basePath}/promote`, data, {
      params: queryParams,
    });
    return response.data;
  }
}

// =====================
// Service Instance & Exports
// =====================

export const userPositionHistoryService = new UserPositionHistoryService();

// Query exports
export const getUserPositionHistories = (params?: UserPositionHistoryGetManyFormData) => userPositionHistoryService.getUserPositionHistories(params);
export const getUserPositionHistoryById = (id: string, params?: Omit<UserPositionHistoryGetByIdFormData, "id">) =>
  userPositionHistoryService.getUserPositionHistoryById(id, params);

export const getUserSalaryAt = (params: { userId?: string; userIds?: string; date?: string }) => userPositionHistoryService.getSalaryAt(params);

// Mutation exports
export const promoteUser = (data: UserPositionHistoryPromoteFormData, queryParams?: UserPositionHistoryQueryFormData) =>
  userPositionHistoryService.promoteUser(data, queryParams);
