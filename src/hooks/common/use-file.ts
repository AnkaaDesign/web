// packages/hooks/src/useFile.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { fileKeys, taskKeys, customerKeys, supplierKeys, userKeys, activityKeys, itemKeys } from "./query-keys";
import { getFiles, getFileById, createFile, updateFile, deleteFile, batchCreateFiles, batchUpdateFiles, batchDeleteFiles, fileService, getFileSuggestions, createFileFromExisting } from "../../api-client";
// uploadSingleFile is deprecated - files should be submitted with forms using FormData
import type { FileUploadOptions as ApiFileUploadOptions, FileUploadProgress as ApiFileUploadProgress } from "../../api-client";
import type { FileGetManyFormData, FileCreateFormData, FileUpdateFormData, FileBatchCreateFormData, FileBatchUpdateFormData, FileBatchDeleteFormData } from "../../schemas";
import type {
  File,
  FileGetManyResponse,
  FileGetUniqueResponse,
  FileCreateResponse,
  FileUpdateResponse,
  FileDeleteResponse,
  FileBatchCreateResponse,
  FileBatchUpdateResponse,
  FileBatchDeleteResponse,
} from "../../types";
import { createEntityHooks } from "./create-entity-hooks";

// =====================================================
// Enhanced Upload Progress Types
// =====================================================

export interface UploadProgress extends ApiFileUploadProgress {
  fileId: string;
  _fileName: string;
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";
  error?: string;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

export interface FileUploadOptions extends Omit<ApiFileUploadOptions, "onProgress"> {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (file: File) => void;
  onError?: (error: Error) => void;
  retryAttempts?: number;
}

export interface MultiFileUploadOptions extends Omit<FileUploadOptions, "onProgress" | "onSuccess" | "onError"> {
  onProgress?: (fileId: string, progress: UploadProgress) => void;
  onFileSuccess?: (file: File) => void;
  onFileError?: (fileId: string, error: Error) => void;
  onAllComplete?: (_files: File[], errors: { fileId: string; error: Error }[]) => void;
  maxConcurrent?: number;
}

export interface FilePreviewOptions {
  quality?: "low" | "medium" | "high";
  width?: number;
  height?: number;
  format?: "webp" | "jpeg" | "png";
}

// =====================================================
// File Service Adapter
// =====================================================

const fileServiceAdapter = {
  getMany: getFiles,
  getById: getFileById,
  create: createFile,
  update: updateFile,
  delete: deleteFile,
  batchCreate: batchCreateFiles,
  batchUpdate: batchUpdateFiles,
  batchDelete: batchDeleteFiles,
};

// =====================================================
// Base File Hooks
// =====================================================

const baseHooks = createEntityHooks<
  FileGetManyFormData,
  FileGetManyResponse,
  FileGetUniqueResponse,
  FileCreateFormData,
  FileCreateResponse,
  FileUpdateFormData,
  FileUpdateResponse,
  FileDeleteResponse,
  FileBatchCreateFormData,
  FileBatchCreateResponse<FileCreateFormData>,
  FileBatchUpdateFormData,
  FileBatchUpdateResponse<FileUpdateFormData>,
  FileBatchDeleteFormData,
  FileBatchDeleteResponse
>({
  queryKeys: fileKeys,
  service: fileServiceAdapter,
  staleTime: 1000 * 60 * 10, // 10 minutes since files don't change often
  // Files can be associated with many entities
  relatedQueryKeys: [taskKeys, customerKeys, supplierKeys, userKeys, activityKeys, itemKeys],
});

// =====================================================
// File Upload Hook
// =====================================================

export const useFileUpload = (options: FileUploadOptions = {}) => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const calculateSpeed = useCallback((loaded: number, elapsed: number): number => {
    if (elapsed === 0) return 0;
    return loaded / (elapsed / 1000); // bytes per second
  }, []);

  const calculateTimeRemaining = useCallback((loaded: number, total: number, speed: number): number => {
    if (speed === 0) return Infinity;
    const remaining = total - loaded;
    return remaining / speed; // seconds
  }, []);

  const upload = useCallback(
    async (file: globalThis.File): Promise<File> => {
      if (isUploading) {
        throw new Error("Já existe um upload em andamento");
      }

      setIsUploading(true);
      startTimeRef.current = Date.now();
      abortControllerRef.current = new AbortController();

      const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const _fileName = file.name;

      try {
        // Create initial progress
        const initialProgress: UploadProgress = {
          fileId,
          _fileName,
          loaded: 0,
          total: file.size,
          percentage: 0,
          status: "uploading",
        };
        setUploadProgress(initialProgress);
        options.onProgress?.(initialProgress);

        // DEPRECATED: Direct file upload is no longer supported
        // Files should be submitted with forms using FormData
        throw new Error(
          "Direct file upload is deprecated. Files should be submitted with forms using FormData. " +
          "Please update your code to store files in form state and submit them with the form data."
        );

        // Legacy code kept for reference (no longer executed)
        /* const response = await uploadSingleFile(file, {
          signal: options.signal || abortControllerRef.current.signal,
          timeout: options.timeout,
          onProgress: (progressEvent) => {
            const { loaded, total, percentage } = progressEvent;
            const elapsed = Date.now() - startTimeRef.current;
            const speed = calculateSpeed(loaded, elapsed);
            const timeRemaining = total ? calculateTimeRemaining(loaded, total, speed) : 0;

            const progress: UploadProgress = {
              fileId,
              _fileName,
              loaded,
              total,
              percentage,
              status: "uploading",
              speed,
              timeRemaining,
            };

            setUploadProgress(progress);
            options.onProgress?.(progress);
          },
        }); */
        const response = { data: null } as any; // Placeholder since code won't reach here

        // Complete progress
        const completedProgress: UploadProgress = {
          fileId,
          _fileName,
          loaded: file.size,
          total: file.size,
          percentage: 100,
          status: "completed",
        };
        setUploadProgress(completedProgress);
        options.onProgress?.(completedProgress);

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: fileKeys.all });

        if (!response.data) {
          throw new Error("Resposta do upload inválida");
        }

        const uploadedFile = response.data;
        options.onSuccess?.(uploadedFile);
        return uploadedFile;
      } catch (error) {
        // Extract more specific error message for rate limits
        let errorMessage = "Erro desconhecido no upload";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as any;
          if (axiosError.response?.status === 429) {
            errorMessage = "Limite de uploads excedido. Aguarde alguns momentos antes de tentar novamente.";
          } else if (axiosError.response?.data?.message) {
            errorMessage = axiosError.response.data.message;
          }
        }

        const errorProgress: UploadProgress = {
          fileId,
          _fileName,
          loaded: 0,
          total: file.size,
          percentage: 0,
          status: "error",
          error: errorMessage,
        };
        setUploadProgress(errorProgress);
        options.onProgress?.(errorProgress);
        options.onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    [isUploading, options, queryClient, calculateSpeed, calculateTimeRemaining],
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadProgress((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploadProgress(null);
    setIsUploading(false);
    abortControllerRef.current = null;
  }, []);

  return {
    upload,
    cancel,
    reset,
    progress: uploadProgress,
    isUploading,
    isCompleted: uploadProgress?.status === "completed",
    isError: uploadProgress?.status === "error",
    isCancelled: uploadProgress?.status === "cancelled",
  };
};

// =====================================================
// Multiple File Upload Hook
// =====================================================

export const useMultiFileUpload = (options: MultiFileUploadOptions = {}) => {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const { maxConcurrent = 3 } = options;

  const _uploadFiles = useCallback(
    async (
      _files: globalThis.File[],
    ): Promise<{
      completed: File[];
      errors: { fileId: string; error: Error }[];
    }> => {
      if (isUploading) {
        throw new Error("Já existe um upload em andamento");
      }

      setIsUploading(true);
      const completedFiles: File[] = [];
      const errors: { fileId: string; error: Error }[] = [];

      // Initialize progress for all files
      const initialUploads = new Map<string, UploadProgress>();
      _files.forEach((file, index) => {
        const fileId = `multi-upload-${Date.now()}-${index}`;
        const progress: UploadProgress = {
          fileId,
          _fileName: file.name,
          loaded: 0,
          total: file.size,
          percentage: 0,
          status: "pending",
        };
        initialUploads.set(fileId, progress);
        options.onProgress?.(fileId, progress);
      });
      setUploads(initialUploads);

      try {
        // TODO: Fix file upload API mismatch - temporarily disabled
        // Use the existing API client batch upload method
        const response = { completed: [], errors: [] } as any; // await uploadFiles(_files, {
        // signal: options.signal,
        // timeout: options.timeout,
        // onProgress: (progressEvent) => {
        // For batch uploads, we get overall progress
        // We can estimate individual file progress
        // const overallLoaded = progressEvent.loaded;
        // const overallTotal = progressEvent.total;
        // const overallPercentage = progressEvent.percentage;

        // Update all pending/uploading files with estimated progress
        // setUploads(prev => {
        // const updated = new Map(prev);
        // let currentLoaded = 0;

        // updated.forEach((progress, fileId) => {
        // if (progress.status === 'uploading' || progress.status === 'pending') {
        // const estimatedLoaded = Math.min(
        // progress.total,
        // Math.max(0, overallLoaded - currentLoaded)
        // );
        // const estimatedPercentage = Math.round((estimatedLoaded / progress.total) * 100);

        // updated.set(fileId, {
        // ...progress,
        // status: 'uploading',
        // loaded: estimatedLoaded,
        // percentage: estimatedPercentage,
        // });

        // options.onProgress?.(fileId, {
        // ...progress,
        // status: 'uploading',
        // loaded: estimatedLoaded,
        // percentage: estimatedPercentage,
        // });
        // }

        // if (progress.status === 'completed') {
        // currentLoaded += progress.total;
        // }
        // });

        // return updated;
        // });
        // },
        // });

        // Mark all files as completed or failed based on response
        if (false) {
          // TODO: Fix response type mismatch
          response.data.successful.forEach((file: any, index: number) => {
            const fileId = `multi-upload-${Date.now()}-${index}`;
            const completedProgress: UploadProgress = {
              fileId,
              _fileName: file.filename,
              loaded: file.size,
              total: file.size,
              percentage: 100,
              status: "completed",
            };

            setUploads((prev) => {
              const updated = new Map(prev);
              updated.set(fileId, completedProgress);
              return updated;
            });

            options.onProgress?.(fileId, completedProgress);
            completedFiles.push(file);
            options.onFileSuccess?.(file);
          });
        }

        if (false) {
          // TODO: Fix response type mismatch
          response.data.failed.forEach(({ file: _fileName, error: errorMsg }: any, index: number) => {
            const fileId = `multi-upload-${Date.now()}-${index}`;
            const errorObj = new Error(errorMsg);
            errors.push({ fileId, error: errorObj });

            setUploads((prev) => {
              const updated = new Map(prev);
              const current = updated.get(fileId);
              if (current) {
                updated.set(fileId, {
                  ...current,
                  status: "error",
                  error: errorMsg,
                });
              }
              return updated;
            });

            options.onFileError?.(fileId, errorObj);
          });
        }
      } catch (error) {
        // Mark all pending files as failed
        setUploads((prev) => {
          const updated = new Map(prev);
          updated.forEach((progress, fileId) => {
            if (progress.status === "pending" || progress.status === "uploading") {
              const errorObj = error instanceof Error ? error : new Error("Erro desconhecido no upload");
              updated.set(fileId, {
                ...progress,
                status: "error",
                error: errorObj.message,
              });
              errors.push({ fileId, error: errorObj });
              options.onFileError?.(fileId, errorObj);
            }
          });
          return updated;
        });
      } finally {
        // Invalidate related queries if any files completed
        if (completedFiles.length > 0) {
          queryClient.invalidateQueries({ queryKey: fileKeys.all });
        }

        setIsUploading(false);
        options.onAllComplete?.(completedFiles, errors);
      }

      return { completed: completedFiles, errors };
    },
    [isUploading, maxConcurrent, options, queryClient],
  );

  const cancelAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    setUploads((prev) => {
      const updated = new Map(prev);
      updated.forEach((progress, fileId) => {
        if (progress.status === "uploading" || progress.status === "pending") {
          updated.set(fileId, { ...progress, status: "cancelled" });
        }
      });
      return updated;
    });
    setIsUploading(false);
  }, []);

  const reset = useCallback(() => {
    setUploads(new Map());
    setIsUploading(false);
    abortControllersRef.current.clear();
  }, []);

  const getOverallProgress = useCallback(() => {
    const uploadArray = Array.from(uploads.values());
    if (uploadArray.length === 0) return { percentage: 0, completed: 0, total: 0, failed: 0 };

    const completed = uploadArray.filter((u) => u.status === "completed").length;
    const failed = uploadArray.filter((u) => u.status === "error").length;
    const total = uploadArray.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { percentage, completed, total, failed };
  }, [uploads]);

  return {
    _uploadFiles,
    cancelAll,
    reset,
    uploads: Array.from(uploads.values()),
    isUploading,
    overallProgress: getOverallProgress(),
  };
};

// =====================================================
// File Delete Hook with Enhanced Options
// =====================================================

export const useFileDelete = (
  options: {
    onSuccess?: (deletedFile: { _id: string; deleted: boolean }) => void;
    onError?: (error: Error) => void;
    optimisticUpdate?: boolean;
  } = {},
) => {
  const queryClient = useQueryClient();
  const { optimisticUpdate = true } = options;

  return useMutation({
    mutationFn: async ({ _id, deleteFromStorage = true }: { _id: string; deleteFromStorage?: boolean }) => {
      const response = await deleteFile(_id, deleteFromStorage);
      return { _id, deleted: true, response };
    },
    onMutate: async ({ _id }) => {
      if (!optimisticUpdate) return;

      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: fileKeys.all });

      // Get previous state
      const previousFiles = queryClient.getQueriesData({ queryKey: fileKeys.all });

      // Optimistically update cache
      queryClient.setQueriesData<FileGetManyResponse>({ queryKey: fileKeys.lists() }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((file) => file.id !== _id),
        };
      });

      // Remove from individual queries
      queryClient.removeQueries({ queryKey: fileKeys.detail(_id) });

      return { previousFiles };
    },
    onError: (error, _variables, context) => {
      // Restore previous state on error
      if (context?.previousFiles && optimisticUpdate) {
        context.previousFiles.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options.onError?.(error instanceof Error ? error : new Error("Erro ao deletar arquivo"));
    },
    onSuccess: (data) => {
      // Ensure cache is updated
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
      // Invalidate related entity queries that might reference this file
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });

      options.onSuccess?.(data);
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Retry up to 2 times for server errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};

// =====================================================
// File Preview URL Generator
// =====================================================

export const useFilePreview = () => {
  const generatePreviewUrl = useCallback((file: File, options: FilePreviewOptions = {}): string => {
    const { quality = "medium", width, height, format = "webp" } = options;

    // If file already has a thumbnail URL, use it
    if (file.thumbnailUrl) {
      const url = new URL(file.thumbnailUrl, window.location.origin);

      // Add query parameters for customization
      if (width) url.searchParams.set("w", width.toString());
      if (height) url.searchParams.set("h", height.toString());
      if (quality !== "medium") url.searchParams.set("q", quality);
      if (format !== "webp") url.searchParams.set("f", format);

      return url.toString();
    }

    // For images, use the service method
    if (file.mimetype.startsWith("image/")) {
      return fileService.getFileUrl(file.id);
    }

    // For videos, use the file serving URL (supports range requests for streaming)
    if (file.mimetype.startsWith("video/")) {
      return fileService.getFileUrl(file.id);
    }

    // For PDFs, use thumbnail service
    if (file.mimetype === "application/pdf") {
      return fileService.getFileThumbnailUrl(file.id, "medium");
    }

    // Return the file serving URL for other types
    return `/api/files/serve/${file.id}`;
  }, []);

  const generateDownloadUrl = useCallback((file: File, filename?: string): string => {
    const url = new URL(`/api/files/${file.id}/download`, window.location.origin);

    if (filename) {
      url.searchParams.set("filename", filename);
    }

    return url.toString();
  }, []);

  return {
    generatePreviewUrl,
    generateDownloadUrl,
  };
};

// =====================================================
// Smart File Loading Hook
// =====================================================

export const useSmartFileLoader = (_files: File[]) => {
  const { generatePreviewUrl } = useFilePreview();
  const [loadedPreviews, setLoadedPreviews] = useState<Set<string>>(new Set());
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());

  const preloadPreview = useCallback(
    async (file: File): Promise<string> => {
      if (loadedPreviews.has(file.id)) {
        return generatePreviewUrl(file);
      }

      if (failedPreviews.has(file.id)) {
        return `/api/files/serve/${file.id}`; // Fallback to file serving URL
      }

      try {
        const previewUrl = generatePreviewUrl(file);

        // Preload the image
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            setLoadedPreviews((prev) => new Set(prev).add(file.id));
            resolve(previewUrl);
          };
          img.onerror = () => {
            setFailedPreviews((prev) => new Set(prev).add(file.id));
            reject(new Error(`Failed to load preview for ${file.filename}`));
          };
          img.src = previewUrl;
        });
      } catch (error) {
        setFailedPreviews((prev) => new Set(prev).add(file.id));
        return `/api/files/serve/${file.id}`;
      }
    },
    [generatePreviewUrl, loadedPreviews, failedPreviews],
  );

  const getOptimizedUrl = useCallback(
    (file: File): string => {
      if (failedPreviews.has(file.id)) {
        return `/api/files/serve/${file.id}`;
      }
      return generatePreviewUrl(file);
    },
    [generatePreviewUrl, failedPreviews],
  );

  return {
    preloadPreview,
    getOptimizedUrl,
    isLoaded: (fileId: string) => loadedPreviews.has(fileId),
    hasFailed: (fileId: string) => failedPreviews.has(fileId),
  };
};

// =====================================================
// File Validation Hooks
// =====================================================

export const useFileValidation = () => {
  const validateFile = useCallback((file: globalThis.File) => {
    return {
      isValidSize: fileService.validateFileSize(file),
      isValidName: fileService.validateFileName(file.name),
      isValidImage: fileService.isValidImageFile(file),
      isValidDocument: fileService.isValidDocumentFile(file),
      formattedSize: fileService.formatFileSize(file.size),
      extension: fileService.getFileExtension(file.name),
      mimeType: fileService.getMimeTypeFromExtension(fileService.getFileExtension(file.name)),
    };
  }, []);

  const validateFiles = useCallback((_files: globalThis.File[]) => {
    return fileService.validateFiles(_files);
  }, []);

  return {
    validateFile,
    validateFiles,
  };
};

// =====================================================
// File Suggestions Hooks
// =====================================================

export const useFileSuggestions = (params: {
  customerId?: string;
  fileContext: string;
  excludeIds?: string[];
  enabled?: boolean;
}) => {
  const { customerId, fileContext, excludeIds, enabled = true } = params;

  return useQuery({
    queryKey: fileKeys.suggestions(customerId || '', fileContext, excludeIds),
    queryFn: () => getFileSuggestions({
      customerId: customerId!,
      fileContext,
      excludeIds,
    }),
    enabled: enabled && !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.data,
  });
};

export const useCreateFileFromExisting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceFileId: string) => createFileFromExisting(sourceFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", "suggestions"] });
    },
  });
};

// =====================================================
// Export Standard Hooks
// =====================================================

// Export base hooks with standard names
export const useFilesInfinite = baseHooks.useInfiniteList;
export const useFiles = baseHooks.useList;
export const useFile = baseHooks.useDetail;
export const useFileMutations = baseHooks.useMutations;
export const useFileBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Backward Compatibility Exports
// =====================================================

// Legacy mutation hooks (extract from the mutations object)
export const useCreateFile = () => {
  const mutations = useFileMutations();
  return mutations.createMutation;
};

export const useUpdateFile = () => {
  const mutations = useFileMutations();
  return mutations.updateMutation;
};

// Legacy delete hook - redirects to new enhanced version
export const useDeleteFile = () => {
  return useFileDelete();
};

// Legacy batch mutation hooks
export const useBatchCreateFiles = () => {
  const mutations = useFileBatchMutations();
  return mutations.batchCreateMutation;
};

export const useBatchUpdateFiles = () => {
  const mutations = useFileBatchMutations();
  return mutations.batchUpdateMutation;
};

export const useBatchDeleteFiles = () => {
  const mutations = useFileBatchMutations();
  return mutations.batchDeleteMutation;
};
