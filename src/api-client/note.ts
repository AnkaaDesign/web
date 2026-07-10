// note.ts
// Notas — feature unificada (antigo "Post-it" + rascunho "Anotações"). Cada nota
// pertence a um owner e pode ser compartilhada com outros usuários. O escopo de
// visibilidade (owner OU compartilhado) é aplicado no servidor.

import { apiClient } from "./axiosClient";
import type {
  NoteGetManyFormData,
  NoteCreateFormData,
  NoteUpdateFormData,
  NoteReorderFormData,
  NoteShareInput,
} from "../schemas/note";
import type {
  NoteGetUniqueResponse,
  NoteGetManyResponse,
  NoteCreateResponse,
  NoteUpdateResponse,
  NoteDeleteResponse,
  NoteReorderResponse,
  NoteShareResponse,
} from "../types/note";

// =====================
// Note Service Class
// =====================

export class NoteService {
  private readonly basePath = "/notes";

  // =====================
  // Query Operations
  // =====================

  async getNotes(params?: NoteGetManyFormData): Promise<NoteGetManyResponse> {
    const response = await apiClient.get<NoteGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getNoteById(id: string, params?: any): Promise<NoteGetUniqueResponse> {
    const response = await apiClient.get<NoteGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createNote(data: NoteCreateFormData, query?: any): Promise<NoteCreateResponse> {
    const response = await apiClient.post<NoteCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateNote(
    id: string,
    data: NoteUpdateFormData,
    query?: any,
    options?: { suppressToast?: boolean },
  ): Promise<NoteUpdateResponse> {
    // Saves de posição/tamanho do canvas são frequentes — silenciamos o toast.
    const config: any = { params: query };
    if (options?.suppressToast) config.metadata = { suppressToast: true };
    const response = await apiClient.put<NoteUpdateResponse>(`${this.basePath}/${id}`, data, config);
    return response.data;
  }

  async deleteNote(id: string): Promise<NoteDeleteResponse> {
    const response = await apiClient.delete<NoteDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Drag-and-drop: lista completa de IDs na nova ordem.
  async reorderNotes(data: NoteReorderFormData): Promise<NoteReorderResponse> {
    const response = await apiClient.put<NoteReorderResponse>(`${this.basePath}/reorder`, data);
    return response.data;
  }

  // Substitui o conjunto completo de compartilhamentos (owner only).
  async shareNote(id: string, data: { shares: NoteShareInput[] }): Promise<NoteShareResponse> {
    const response = await apiClient.put<NoteShareResponse>(`${this.basePath}/${id}/share`, data);
    return response.data;
  }

  // Remove um único compartilhamento (owner only).
  async removeNoteShare(id: string, userId: string): Promise<NoteShareResponse> {
    const response = await apiClient.delete<NoteShareResponse>(`${this.basePath}/${id}/share/${userId}`);
    return response.data;
  }

  // Arquiva a nota (owner ou editor).
  async archiveNote(id: string): Promise<NoteUpdateResponse> {
    const response = await apiClient.put<NoteUpdateResponse>(`${this.basePath}/${id}/archive`, {});
    return response.data;
  }

  // Restaura a nota (owner ou editor).
  async unarchiveNote(id: string): Promise<NoteUpdateResponse> {
    const response = await apiClient.put<NoteUpdateResponse>(`${this.basePath}/${id}/unarchive`, {});
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const noteService = new NoteService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getNotes = (params?: NoteGetManyFormData) => noteService.getNotes(params);
export const getNoteById = (id: string, params?: any) => noteService.getNoteById(id, params);

// Mutation Operations
export const createNote = (data: NoteCreateFormData, query?: any) => noteService.createNote(data, query);
export const updateNote = (id: string, data: NoteUpdateFormData, query?: any, options?: { suppressToast?: boolean }) =>
  noteService.updateNote(id, data, query, options);
export const deleteNote = (id: string) => noteService.deleteNote(id);
export const reorderNotes = (data: NoteReorderFormData) => noteService.reorderNotes(data);
export const shareNote = (id: string, data: { shares: NoteShareInput[] }) => noteService.shareNote(id, data);
export const removeNoteShare = (id: string, userId: string) => noteService.removeNoteShare(id, userId);
export const archiveNote = (id: string) => noteService.archiveNote(id);
export const unarchiveNote = (id: string) => noteService.unarchiveNote(id);
