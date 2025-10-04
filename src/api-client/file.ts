// packages/api-client/src/file.ts

import { apiClient, axios } from "./axiosClient";
import type { AxiosRequestConfig, CancelTokenSource } from "axios";
import { safeFileDownload } from "./platform-utils";
import type {
  // Schema types (for parameters)
  FileGetManyFormData,
  FileGetByIdFormData,
  FileCreateFormData,
  FileUpdateFormData,
  FileBatchCreateFormData,
  FileBatchUpdateFormData,
  FileBatchDeleteFormData,
  FileQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  File,
  FileGetManyResponse,
  FileGetUniqueResponse,
  FileCreateResponse,
  FileUpdateResponse,
  FileDeleteResponse,
  FileBatchCreateResponse,
  FileBatchUpdateResponse,
  FileBatchDeleteResponse,
} from "../types";

// =====================
// File Upload Types
// =====================

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadOptions {
  onProgress?: (progress: FileUploadProgress) => void;
  signal?: AbortSignal;
  timeout?: number;
  // WebDAV context parameters
  fileContext?: string;
  entityId?: string;
  entityType?: string;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  data?: File;
  errors?: string[];
}

export interface BatchFileUploadResponse {
  success: boolean;
  message: string;
  data?: {
    successful: File[];
    failed: Array<{ file: string; error: string }>;
    totalSuccess: number;
    totalFailed: number;
  };
  errors?: string[];
}

export interface FileThumbnailResponse {
  success: boolean;
  data?: {
    url: string;
    size: "small" | "medium" | "large";
  };
  message?: string;
}

export interface FileDownloadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: FileUploadProgress) => void;
}

// =====================
// File Service Class
// =====================

export class FileService {
  private readonly basePath = "/files";
  private uploadCancelTokens = new Map<string, CancelTokenSource>();

  // =====================
  // Query Operations
  // =====================

  async getFiles(params: FileGetManyFormData = {}): Promise<FileGetManyResponse> {
    const response = await apiClient.get<FileGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getFileById(id: string, params?: Omit<FileGetByIdFormData, "id">): Promise<FileGetUniqueResponse> {
    const response = await apiClient.get<FileGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createFile(data: FileCreateFormData, query?: FileQueryFormData): Promise<FileCreateResponse> {
    const response = await apiClient.post<FileCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateFile(id: string, data: FileUpdateFormData, query?: FileQueryFormData): Promise<FileUpdateResponse> {
    const response = await apiClient.put<FileUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteFile(id: string, deleteFromStorage = true): Promise<FileDeleteResponse> {
    const response = await apiClient.delete<FileDeleteResponse>(`${this.basePath}/${id}`, {
      params: { deleteFromStorage },
    });
    return response.data;
  }

  // =====================
  // File Upload Operations
  // =====================

  async uploadFiles(files: any[] | ArrayLike<any>, options: FileUploadOptions = {}): Promise<BatchFileUploadResponse> {
    const formData = new FormData();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert FileList to Array if needed
    const fileArray = Array.from(files);

    // Add files to FormData
    fileArray.forEach((file, _index) => {
      formData.append(`files`, file);
    });

    // Create cancel token for this upload
    const cancelTokenSource = axios.CancelToken.source();
    this.uploadCancelTokens.set(uploadId, cancelTokenSource);

    // Setup abort signal handling
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        this.cancelUpload(uploadId);
      });
    }

    try {
      const config: AxiosRequestConfig = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        cancelToken: cancelTokenSource.token,
        timeout: options.timeout || 300000, // 5 minutes default
        onUploadProgress: (progressEvent) => {
          if (options.onProgress && progressEvent.total) {
            const progress: FileUploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
            };
            options.onProgress(progress);
          }
        },
        // Add WebDAV context as query parameters
        params: {
          ...(options.fileContext && { fileContext: options.fileContext }),
          ...(options.entityId && { entityId: options.entityId }),
          ...(options.entityType && { entityType: options.entityType }),
        },
      };

      const response = await apiClient.post<BatchFileUploadResponse>(`${this.basePath}/upload/multiple`, formData, config);

      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error("Upload cancelado");
      }
      throw error;
    } finally {
      // Clean up cancel token
      this.uploadCancelTokens.delete(uploadId);
    }
  }

  async uploadSingleFile(file: any, options: FileUploadOptions = {}): Promise<FileUploadResponse> {
    const formData = new FormData();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add single file to FormData with field name 'file' (not 'files')
    formData.append("file", file);

    // Create cancel token for this upload
    const cancelTokenSource = axios.CancelToken.source();
    this.uploadCancelTokens.set(uploadId, cancelTokenSource);

    // Setup abort signal handling
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        this.cancelUpload(uploadId);
      });
    }

    try {
      const config: AxiosRequestConfig = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        cancelToken: cancelTokenSource.token,
        timeout: options.timeout || 180000, // 3 minutes for file uploads (EPS thumbnails can take time)
        onUploadProgress: options.onProgress
          ? (progressEvent) => {
              const loaded = progressEvent.loaded || 0;
              const total = progressEvent.total || 1;
              const percentage = Math.round((loaded * 100) / total);
              options.onProgress!({ loaded, total, percentage });
            }
          : undefined,
        // Add WebDAV context as query parameters
        params: {
          ...(options.fileContext && { fileContext: options.fileContext }),
          ...(options.entityId && { entityId: options.entityId }),
          ...(options.entityType && { entityType: options.entityType }),
        },
      };

      const response = await apiClient.post<FileUploadResponse>(`${this.basePath}/upload`, formData, config);

      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error("Upload cancelado");
      }
      throw error;
    } finally {
      // Clean up cancel token
      this.uploadCancelTokens.delete(uploadId);
    }
  }

  cancelUpload(uploadId: string): void {
    const cancelToken = this.uploadCancelTokens.get(uploadId);
    if (cancelToken) {
      cancelToken.cancel("Upload cancelado pelo usuário");
      this.uploadCancelTokens.delete(uploadId);
    }
  }

  cancelAllUploads(): void {
    for (const [, cancelToken] of this.uploadCancelTokens.entries()) {
      cancelToken.cancel("Todos os uploads cancelados");
    }
    this.uploadCancelTokens.clear();
  }

  // =====================
  // File Access Operations
  // =====================

  getFileUrl(fileId: string): string {
    return `${apiClient.defaults.baseURL}${this.basePath}/${fileId}/serve`;
  }

  getFileThumbnailUrl(fileId: string, size: "small" | "medium" | "large" = "medium"): string {
    return `${apiClient.defaults.baseURL}${this.basePath}/${fileId}/thumbnail?size=${size}`;
  }

  async getFileThumbnail(fileId: string, size: "small" | "medium" | "large" = "medium"): Promise<FileThumbnailResponse> {
    const response = await apiClient.get<FileThumbnailResponse>(`${this.basePath}/${fileId}/thumbnail`, {
      params: { size },
    });
    return response.data;
  }

  async downloadFile(fileId: string, options: FileDownloadOptions = {}): Promise<Blob> {
    const config: AxiosRequestConfig = {
      responseType: "blob",
      signal: options.signal,
      onDownloadProgress: (progressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress: FileUploadProgress = {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
          };
          options.onProgress(progress);
        }
      },
    };

    const response = await apiClient.get(`${this.basePath}/${fileId}/download`, config);

    return response.data;
  }

  async downloadFileByUrl(url: string, options: FileDownloadOptions = {}): Promise<Blob> {
    const config: AxiosRequestConfig = {
      responseType: "blob",
      signal: options.signal,
      onDownloadProgress: (progressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress: FileUploadProgress = {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
          };
          options.onProgress(progress);
        }
      },
    };

    const response = await apiClient.get(url, config);
    return response.data;
  }

  // Helper method to trigger file download in browser
  downloadFileInBrowser(blob: Blob, filename: string): boolean {
    return safeFileDownload(blob, filename);
  }

  // =====================
  // File Management Operations
  // =====================

  async moveFile(fileId: string, newPath: string): Promise<FileUpdateResponse> {
    const response = await apiClient.patch<FileUpdateResponse>(`${this.basePath}/${fileId}/move`, { newPath });
    return response.data;
  }

  async copyFile(fileId: string, newFilename?: string): Promise<FileCreateResponse> {
    const response = await apiClient.post<FileCreateResponse>(`${this.basePath}/${fileId}/copy`, { newFilename });
    return response.data;
  }

  async getFilesByMimeType(mimeType: string, params?: Omit<FileGetManyFormData, "mimetypes">): Promise<FileGetManyResponse> {
    return this.getFiles({ ...params, mimetypes: [mimeType] });
  }

  async getImageFiles(params?: FileGetManyFormData): Promise<FileGetManyResponse> {
    return this.getFiles({ ...params, isImage: true });
  }

  async getDocumentFiles(params?: FileGetManyFormData): Promise<FileGetManyResponse> {
    return this.getFiles({ ...params, isDocument: true });
  }

  async getOrphanedFiles(params?: FileGetManyFormData): Promise<FileGetManyResponse> {
    return this.getFiles({ ...params, isOrphaned: true });
  }

  async cleanupOrphanedFiles(): Promise<FileBatchDeleteResponse> {
    const response = await apiClient.delete<FileBatchDeleteResponse>(`${this.basePath}/cleanup/orphaned`);
    return response.data;
  }

  // =====================
  // File Validation & Utils
  // =====================

  isValidImageFile(file: globalThis.File): boolean {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
    return allowedTypes.includes(file.type);
  }

  isValidDocumentFile(file: globalThis.File): boolean {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];
    return allowedTypes.includes(file.type);
  }

  validateFileSize(file: globalThis.File, maxSizeMB = 500): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  validateFileName(filename: string): { valid: boolean; error?: string } {
    // Security validation for filename
    if (!filename || filename.trim().length === 0) {
      return { valid: false, error: "Nome do arquivo é obrigatório" };
    }

    if (filename.length > 255) {
      return { valid: false, error: "Nome do arquivo deve ter no máximo 255 caracteres" };
    }

    // Check for invalid characters
    if (!/^[^<>:"/\\|?*\x00-\x1f]+$/.test(filename)) {
      return { valid: false, error: "Nome do arquivo contém caracteres inválidos" };
    }

    // Check for directory traversal
    if (filename.includes("../") || filename.includes("..\\")) {
      return { valid: false, error: "Nome do arquivo contém caracteres de navegação não permitidos" };
    }

    // Ensure filename has extension
    if (!filename.includes(".") || filename.split(".").pop()!.length === 0) {
      return { valid: false, error: "Nome do arquivo deve ter uma extensão" };
    }

    return { valid: true };
  }

  validateFiles(files: globalThis.File[]): { valid: globalThis.File[]; invalid: Array<{ file: globalThis.File; error: string }> } {
    const valid: globalThis.File[] = [];
    const invalid: Array<{ file: globalThis.File; error: string }> = [];

    for (const file of files) {
      // Validate file size
      if (!this.validateFileSize(file)) {
        invalid.push({ file, error: "Arquivo muito grande (máximo 500MB)" });
        continue;
      }

      // Validate filename
      const filenameValidation = this.validateFileName(file.name);
      if (!filenameValidation.valid) {
        invalid.push({ file, error: filenameValidation.error! });
        continue;
      }

      valid.push(file);
    }

    return { valid, invalid };
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  getFileExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || "";
  }

  getMimeTypeFromExtension(extension: string): string | undefined {
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
      csv: "text/csv",
      // Video
      mp4: "video/mp4",
      mpeg: "video/mpeg",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      webm: "video/webm",
      // Audio
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
    };

    return mimeTypes[extension.toLowerCase()];
  }

  // =====================
  // Error Handling Helpers
  // =====================

  getUploadErrorMessage(error: any): string {
    if (error.code === "ERR_NETWORK") {
      return "Erro de conexão. Verifique sua internet e tente novamente.";
    }
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return "Upload demorou muito para ser concluído. Tente novamente.";
    }
    if (error.response?.status === 413) {
      return "Arquivo muito grande. Tamanho máximo permitido: 500MB.";
    }
    if (error.response?.status === 415) {
      return "Tipo de arquivo não suportado.";
    }
    if (error.response?.status === 429) {
      return "Muitos uploads em pouco tempo. Aguarde alguns momentos antes de tentar novamente.";
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    return "Erro inesperado durante o upload. Tente novamente.";
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateFiles(data: FileBatchCreateFormData, query?: FileQueryFormData): Promise<FileBatchCreateResponse<File>> {
    const response = await apiClient.post<FileBatchCreateResponse<File>>(`${this.basePath}/batch/create`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateFiles(data: FileBatchUpdateFormData, query?: FileQueryFormData): Promise<FileBatchUpdateResponse<File>> {
    // Use bulk rename endpoint for batch updates
    const response = await apiClient.post<FileBatchUpdateResponse<File>>(
      `${this.basePath}/bulk/rename`,
      {
        files: data.files.map((update) => ({
          id: update.id,
          newFilename: update.data.filename || "",
        })),
      },
      {
        params: query,
      },
    );
    return response.data;
  }

  async batchDeleteFiles(data: FileBatchDeleteFormData): Promise<FileBatchDeleteResponse> {
    const response = await apiClient.delete<FileBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}
// =====================
// Service Instance & Exports
// =====================

export const fileService = new FileService();

// =====================
// Query Operations Exports
// =====================

export const getFiles = (params: FileGetManyFormData = {}) => fileService.getFiles(params);
export const getFileById = (id: string, params?: Omit<FileGetByIdFormData, "id">) => fileService.getFileById(id, params);
export const getFilesByMimeType = (mimeType: string, params?: Omit<FileGetManyFormData, "mimetypes">) => fileService.getFilesByMimeType(mimeType, params);
export const getImageFiles = (params?: FileGetManyFormData) => fileService.getImageFiles(params);
export const getDocumentFiles = (params?: FileGetManyFormData) => fileService.getDocumentFiles(params);
export const getOrphanedFiles = (params?: FileGetManyFormData) => fileService.getOrphanedFiles(params);

// =====================
// CRUD Operations Exports
// =====================

export const createFile = (data: FileCreateFormData, query?: FileQueryFormData) => fileService.createFile(data, query);
export const updateFile = (id: string, data: FileUpdateFormData, query?: FileQueryFormData) => fileService.updateFile(id, data, query);
export const deleteFile = (id: string, deleteFromStorage = true) => fileService.deleteFile(id, deleteFromStorage);

// =====================
// File Upload Operations Exports
// =====================

export const uploadFiles = (files: any[] | ArrayLike<any>, options?: FileUploadOptions) => fileService.uploadFiles(files, options);
export const uploadSingleFile = (file: any, options?: FileUploadOptions) => fileService.uploadSingleFile(file, options);
export const cancelUpload = (uploadId: string) => fileService.cancelUpload(uploadId);
export const cancelAllUploads = () => fileService.cancelAllUploads();

// =====================
// File Access Operations Exports
// =====================

export const getFileUrl = (fileId: string) => fileService.getFileUrl(fileId);
export const getFileThumbnailUrl = (fileId: string, size?: "small" | "medium" | "large") => fileService.getFileThumbnailUrl(fileId, size);
export const getFileThumbnail = (fileId: string, size?: "small" | "medium" | "large") => fileService.getFileThumbnail(fileId, size);
export const downloadFile = (fileId: string, options?: FileDownloadOptions) => fileService.downloadFile(fileId, options);
export const downloadFileByUrl = (url: string, options?: FileDownloadOptions) => fileService.downloadFileByUrl(url, options);
export const downloadFileInBrowser = (blob: Blob, filename: string) => fileService.downloadFileInBrowser(blob, filename);

// =====================
// File Management Operations Exports
// =====================

export const moveFile = (fileId: string, newPath: string) => fileService.moveFile(fileId, newPath);
export const copyFile = (fileId: string, newFilename?: string) => fileService.copyFile(fileId, newFilename);
export const cleanupOrphanedFiles = () => fileService.cleanupOrphanedFiles();

// =====================
// File Validation & Utils Exports
// =====================

export const isValidImageFile = (file: globalThis.File) => fileService.isValidImageFile(file);
export const isValidDocumentFile = (file: globalThis.File) => fileService.isValidDocumentFile(file);
export const validateFileSize = (file: globalThis.File, maxSizeMB?: number) => fileService.validateFileSize(file, maxSizeMB);
export const validateFileName = (filename: string) => fileService.validateFileName(filename);
export const validateFiles = (files: globalThis.File[]) => fileService.validateFiles(files);
export const formatFileSize = (bytes: number) => fileService.formatFileSize(bytes);
export const getFileExtension = (filename: string) => fileService.getFileExtension(filename);
export const getMimeTypeFromExtension = (extension: string) => fileService.getMimeTypeFromExtension(extension);
export const getUploadErrorMessage = (error: any) => fileService.getUploadErrorMessage(error);

// =====================
// Batch Operations Exports
// =====================

export const batchCreateFiles = (data: FileBatchCreateFormData, query?: FileQueryFormData) => fileService.batchCreateFiles(data, query);
export const batchUpdateFiles = (data: FileBatchUpdateFormData, query?: FileQueryFormData) => fileService.batchUpdateFiles(data, query);
export const batchDeleteFiles = (data: FileBatchDeleteFormData) => fileService.batchDeleteFiles(data);
