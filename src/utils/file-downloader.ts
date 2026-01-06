// apps/web/src/utils/file-downloader.ts

import type { File as AnkaaFile } from "../types";

export interface DownloadConfig {
  baseUrl?: string;
  validateBeforeDownload?: boolean;
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
  trackDownloads?: boolean;
  onProgress?: (progress: number, file: AnkaaFile) => void;
  onComplete?: (file: AnkaaFile) => void;
  onError?: (error: string, file: AnkaaFile) => void;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  downloadUrl?: string;
  fileName?: string;
}

/**
 * Get API base URL from environment or fallback
 */
const getApiBaseUrl = (): string => {
  if (typeof globalThis !== "undefined" && typeof globalThis.window !== "undefined") {
    const windowApiUrl = (globalThis.window as any).__ANKAA_API_URL__;
    if (windowApiUrl) return windowApiUrl;
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return "http://localhost:3030";
};

/**
 * Validate file before download
 */
const validateFileForDownload = (file: AnkaaFile, config: DownloadConfig): { valid: boolean; error?: string } => {
  if (!config.validateBeforeDownload) {
    return { valid: true };
  }

  // Check file size
  if (config.maxFileSize && file.size > config.maxFileSize) {
    const maxSizeMB = (config.maxFileSize / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Arquivo muito grande (${fileSizeMB}MB). Tamanho máximo permitido: ${maxSizeMB}MB`,
    };
  }

  // Check MIME type if allowed types are specified
  if (config.allowedMimeTypes && config.allowedMimeTypes.length > 0) {
    const mimeType = file.mimetype?.toLowerCase() || "";
    const isAllowed = config.allowedMimeTypes.some((allowed) => mimeType === allowed.toLowerCase() || mimeType.startsWith(allowed.toLowerCase().split("/")[0] + "/"));

    if (!isAllowed) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido para download: ${file.mimetype}`,
      };
    }
  }

  // Check filename for security
  const filename = file.filename || "";
  if (filename.includes("../") || filename.includes("..\\")) {
    return {
      valid: false,
      error: "Nome de arquivo contém caracteres suspeitos",
    };
  }

  return { valid: true };
};

/**
 * Track download analytics (if enabled)
 */
const trackDownload = (file: AnkaaFile, config: DownloadConfig) => {
  if (!config.trackDownloads) return;

  // Only track downloads in browser environment
  if (typeof window === "undefined" || typeof localStorage === "undefined" || typeof navigator === "undefined") {
    return;
  }

  // Store download info in localStorage for analytics
  try {
    const downloads = JSON.parse(localStorage.getItem("file_downloads") || "[]");
    downloads.push({
      fileId: file.id,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      downloadedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    // Keep only last 100 downloads
    const recentDownloads = downloads.slice(-100);
    localStorage.setItem("file_downloads", JSON.stringify(recentDownloads));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("Failed to track download:", error);
    }
  }
};

/**
 * Generate download URL with proper parameters
 */
const generateDownloadUrl = (file: AnkaaFile, baseUrl?: string): string => {
  const apiUrl = baseUrl || getApiBaseUrl();
  return `${apiUrl}/files/serve/${file.id}?download=true`;
};

/**
 * Download file using fetch API with progress tracking
 */
const downloadWithProgress = async (file: AnkaaFile, config: DownloadConfig): Promise<DownloadResult> => {
  // Check if we're in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    return {
      success: false,
      error: "Download com progresso não disponível em ambiente servidor",
    };
  }

  const url = generateDownloadUrl(file, config.baseUrl);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Erro no servidor: ${response.status} - ${errorText}`,
      };
    }

    // Get content length for progress tracking
    const contentLength = response.headers.get("Content-Length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : file.size;

    if (!response.body) {
      return {
        success: false,
        error: "Resposta do servidor não contém dados",
      };
    }

    // Create readable stream for progress tracking
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // Report progress
      if (config.onProgress && totalSize > 0) {
        const progress = (receivedLength / totalSize) * 100;
        config.onProgress(progress, file);
      }
    }

    // Combine chunks into blob
    const blob = new Blob(chunks as BlobPart[]);

    // Create download link
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = file.filename || "download";
    link.style.display = "none";

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

    return {
      success: true,
      downloadUrl,
      fileName: file.filename,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Download error:", error);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido durante o download",
    };
  }
};

/**
 * Simple download using browser default behavior
 */
const downloadSimple = (file: AnkaaFile, config: DownloadConfig): DownloadResult => {
  // Check if we're in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      success: false,
      error: "Download simples não disponível em ambiente servidor",
    };
  }

  const url = generateDownloadUrl(file, config.baseUrl);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename || "download";
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      downloadUrl: url,
      fileName: file.filename,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao iniciar download",
    };
  }
};

/**
 * Main download function
 */
export const downloadFile = async (file: AnkaaFile, config: DownloadConfig = {}): Promise<DownloadResult> => {
  // Validate file
  const validation = validateFileForDownload(file, config);
  if (!validation.valid) {
    const error = validation.error || "Arquivo não válido para download";
    if (config.onError) config.onError(error, file);
    return { success: false, error };
  }

  // Track download if enabled
  trackDownload(file, config);

  let result: DownloadResult;

  // Choose download method based on progress tracking needs
  if (config.onProgress) {
    result = await downloadWithProgress(file, config);
  } else {
    result = downloadSimple(file, config);
  }

  // Handle result
  if (result.success) {
    if (config.onComplete) config.onComplete(file);
  } else {
    if (config.onError) config.onError(result.error || "Download falhou", file);
  }

  return result;
};

/**
 * Batch download multiple files
 */
export const downloadMultipleFiles = async (files: AnkaaFile[], config: DownloadConfig = {}): Promise<{ successful: DownloadResult[]; failed: DownloadResult[] }> => {
  const results = await Promise.allSettled(files.map((file) => downloadFile(file, config)));

  const successful: DownloadResult[] = [];
  const failed: DownloadResult[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        successful.push(result.value);
      } else {
        failed.push(result.value);
      }
    } else {
      failed.push({
        success: false,
        error: result.reason?.message || "Download falhou",
        fileName: files[index]?.filename,
      });
    }
  });

  return { successful, failed };
};

/**
 * Get download analytics from localStorage
 */
export const getDownloadHistory = (): Array<{
  fileId: string;
  filename: string;
  size: number;
  mimetype: string;
  downloadedAt: string;
  userAgent: string;
}> => {
  // Only available in browser environment
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem("file_downloads") || "[]");
  } catch {
    return [];
  }
};

/**
 * Clear download history
 */
export const clearDownloadHistory = (): void => {
  // Only available in browser environment
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem("file_downloads");
};

/**
 * File downloader service with default configurations
 */
export const fileDownloaderService = {
  // Main functions
  downloadFile,
  downloadMultipleFiles,
  getDownloadHistory,
  clearDownloadHistory,

  // Utilities
  generateDownloadUrl,
  validateFileForDownload,

  // Configuration presets
  configs: {
    secure: {
      validateBeforeDownload: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      trackDownloads: true,
    } as DownloadConfig,

    permissive: {
      validateBeforeDownload: false,
      trackDownloads: false,
    } as DownloadConfig,

    tracked: {
      validateBeforeDownload: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      trackDownloads: true,
    } as DownloadConfig,

    default: {
      validateBeforeDownload: true,
      maxFileSize: 200 * 1024 * 1024, // 200MB
      trackDownloads: true,
    } as DownloadConfig,
  },
};
