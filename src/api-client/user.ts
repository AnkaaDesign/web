// packages/api-client/src/user.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  UserGetManyFormData,
  UserGetByIdFormData,
  UserCreateFormData,
  UserUpdateFormData,
  UserBatchCreateFormData,
  UserBatchUpdateFormData,
  UserBatchDeleteFormData,
  UserQueryFormData,
  UserMergeFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  User,
  UserGetUniqueResponse,
  UserGetManyResponse,
  UserCreateResponse,
  UserUpdateResponse,
  UserDeleteResponse,
  UserBatchCreateResponse,
  UserBatchUpdateResponse,
  UserBatchDeleteResponse,
  UserMergeResponse,
} from "../types";

// =====================
// User Service Class
// =====================

export class UserService {
  private readonly basePath = "/users";

  // =====================
  // Query Operations
  // =====================

  async getUsers(params?: UserGetManyFormData): Promise<UserGetManyResponse> {
    const response = await apiClient.get<UserGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getUserById(id: string, params?: Omit<UserGetByIdFormData, "id">): Promise<UserGetUniqueResponse> {
    const response = await apiClient.get<UserGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createUser(data: UserCreateFormData | FormData, query?: UserQueryFormData): Promise<UserCreateResponse> {
    console.log('[UserService.createUser] Data type check:', {
      isFormData: data instanceof FormData,
      dataType: data?.constructor?.name,
      hasQuery: !!query,
    });

    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.post<UserCreateResponse>(this.basePath, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async updateUser(id: string, data: UserUpdateFormData | FormData, query?: UserQueryFormData): Promise<UserUpdateResponse> {
    console.log('[UserService.updateUser] Data type check:', {
      isFormData: data instanceof FormData,
      dataType: data?.constructor?.name,
      hasQuery: !!query,
      id,
    });

    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<UserUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async deleteUser(id: string): Promise<UserDeleteResponse> {
    const response = await apiClient.delete<UserDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateUsers(data: UserBatchCreateFormData, query?: UserQueryFormData): Promise<UserBatchCreateResponse<User>> {
    const response = await apiClient.post<UserBatchCreateResponse<User>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateUsers(data: UserBatchUpdateFormData, query?: UserQueryFormData): Promise<UserBatchUpdateResponse<User>> {
    const response = await apiClient.put<UserBatchUpdateResponse<User>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteUsers(data: UserBatchDeleteFormData, query?: UserQueryFormData): Promise<UserBatchDeleteResponse> {
    const response = await apiClient.delete<UserBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }

  // =====================
  // Merge Operations
  // =====================

  async mergeUsers(data: UserMergeFormData, query?: UserQueryFormData): Promise<UserMergeResponse> {
    const response = await apiClient.post<UserMergeResponse>(`${this.basePath}/merge`, data, {
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const userService = new UserService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getUsers = (params?: UserGetManyFormData) => userService.getUsers(params);
export const getUserById = (id: string, params?: Omit<UserGetByIdFormData, "id">) => userService.getUserById(id, params);

// Mutation Operations
export const createUser = (data: UserCreateFormData, query?: UserQueryFormData) => userService.createUser(data, query);
export const updateUser = (id: string, data: UserUpdateFormData, query?: UserQueryFormData) => userService.updateUser(id, data, query);
export const deleteUser = (id: string) => userService.deleteUser(id);

// Batch Operations
export const batchCreateUsers = (data: UserBatchCreateFormData, query?: UserQueryFormData) => userService.batchCreateUsers(data, query);
export const batchUpdateUsers = (data: UserBatchUpdateFormData, query?: UserQueryFormData) => userService.batchUpdateUsers(data, query);
export const batchDeleteUsers = (data: UserBatchDeleteFormData, query?: UserQueryFormData) => userService.batchDeleteUsers(data, query);

// Merge Operations
export const mergeUsers = (data: UserMergeFormData, query?: UserQueryFormData) => userService.mergeUsers(data, query);
