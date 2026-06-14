// postit.ts
// Post-its pessoais — cada usuário vê e gerencia somente os próprios.

import { apiClient } from "./axiosClient";
import type {
  PostitGetManyFormData,
  PostitCreateFormData,
  PostitUpdateFormData,
  PostitReorderFormData,
} from "../schemas/postit";
import type {
  PostitGetUniqueResponse,
  PostitGetManyResponse,
  PostitCreateResponse,
  PostitUpdateResponse,
  PostitDeleteResponse,
  PostitReorderResponse,
} from "../types/postit";

// =====================
// Postit Service Class
// =====================

export class PostitService {
  private readonly basePath = "/postits";

  // =====================
  // Query Operations
  // =====================

  async getPostits(params?: PostitGetManyFormData): Promise<PostitGetManyResponse> {
    const response = await apiClient.get<PostitGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getPostitById(id: string, params?: any): Promise<PostitGetUniqueResponse> {
    const response = await apiClient.get<PostitGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createPostit(data: PostitCreateFormData, query?: any): Promise<PostitCreateResponse> {
    const response = await apiClient.post<PostitCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updatePostit(
    id: string,
    data: PostitUpdateFormData,
    query?: any,
    options?: { suppressToast?: boolean },
  ): Promise<PostitUpdateResponse> {
    // Saves de posição/tamanho do canvas são frequentes — silenciamos o toast.
    const config: any = { params: query };
    if (options?.suppressToast) config.metadata = { suppressToast: true };
    const response = await apiClient.put<PostitUpdateResponse>(`${this.basePath}/${id}`, data, config);
    return response.data;
  }

  async deletePostit(id: string): Promise<PostitDeleteResponse> {
    const response = await apiClient.delete<PostitDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Drag-and-drop: lista completa de IDs na nova ordem.
  async reorderPostits(data: PostitReorderFormData): Promise<PostitReorderResponse> {
    const response = await apiClient.put<PostitReorderResponse>(`${this.basePath}/reorder`, data);
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const postitService = new PostitService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getPostits = (params?: PostitGetManyFormData) => postitService.getPostits(params);
export const getPostitById = (id: string, params?: any) => postitService.getPostitById(id, params);

// Mutation Operations
export const createPostit = (data: PostitCreateFormData, query?: any) => postitService.createPostit(data, query);
export const updatePostit = (id: string, data: PostitUpdateFormData, query?: any, options?: { suppressToast?: boolean }) =>
  postitService.updatePostit(id, data, query, options);
export const deletePostit = (id: string) => postitService.deletePostit(id);
export const reorderPostits = (data: PostitReorderFormData) => postitService.reorderPostits(data);
