// packages/utils/src/file.ts

import type { File } from "../types";
import { FILE_ENTITY_TYPE, FILE_FORMAT } from "../constants";
import { FILE_ENTITY_TYPE_LABELS, FILE_FORMAT_LABELS } from "../constants";
import { getApiBaseUrl } from "@/config/api";

export function getFileEntityTypeLabel(type: FILE_ENTITY_TYPE): string {
  return FILE_ENTITY_TYPE_LABELS[type] || type;
}

export function getFileFormatLabel(format: FILE_FORMAT): string {
  return FILE_FORMAT_LABELS[format] || format;
}

// =====================
// File Size Utilities
// =====================

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatFileSizeCompact = (bytes: number): string => {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

export const bytesToMB = (bytes: number): number => bytes / (1024 * 1024);
export const bytesToKB = (bytes: number): number => bytes / 1024;
export const mbToBytes = (mb: number): number => mb * 1024 * 1024;
export const kbToBytes = (kb: number): number => kb * 1024;

// =====================
// File Type Detection
// =====================

export const getFileExtension = (filename: string | undefined | null): string => {
  if (!filename) return "";
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : "";
};

export const getFileNameWithoutExtension = (filename: string | undefined | null): string => {
  if (!filename) return "";
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
};

export const getFileCategory = (file: File): string => {
  if (!file || !file.filename) return "other";
  return getFileCategoryFromExtension(getFileExtension(file.filename));
};

export const getFileCategoryFromExtension = (extension: string): string => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"];
  const documentExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "ods", "odp"];
  const videoExtensions = ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v"];
  const audioExtensions = ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"];
  const archiveExtensions = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"];

  const ext = extension.toLowerCase();

  if (imageExtensions.includes(ext)) return "image";
  if (documentExtensions.includes(ext)) return "document";
  if (videoExtensions.includes(ext)) return "video";
  if (audioExtensions.includes(ext)) return "audio";
  if (archiveExtensions.includes(ext)) return "archive";

  return "other";
};

export const isImageFile = (file: File): boolean => getFileCategory(file) === "image";
export const isDocumentFile = (file: File): boolean => getFileCategory(file) === "document";
export const isVideoFile = (file: File): boolean => getFileCategory(file) === "video";
export const isAudioFile = (file: File): boolean => getFileCategory(file) === "audio";
export const isArchiveFile = (file: File): boolean => getFileCategory(file) === "archive";

// =====================
// File Icons
// =====================

export const getFileIcon = (file: File): string => {
  const category = getFileCategory(file);
  return getFileCategoryIcon(category);
};

export const getFileCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    image: "🖼️",
    document: "📄",
    video: "🎥",
    audio: "🎵",
    archive: "📦",
    other: "📎",
  };
  return icons[category] || icons.other;
};

export const getFileIconClass = (file: File): string => {
  const category = getFileCategory(file);
  const classes: Record<string, string> = {
    image: "file-image",
    document: "file-document",
    video: "file-video",
    audio: "file-audio",
    archive: "file-archive",
    other: "file-other",
  };
  return classes[category] || classes.other;
};

// =====================
// File Validation
// =====================

export const isFileSizeValid = (file: File, maxSizeMB: number = 10): boolean => {
  return bytesToMB(file.size) <= maxSizeMB;
};

export const isFileTypeAllowed = (file: File, allowedTypes: string[]): boolean => {
  if (!file || !file.filename) return false;
  const extension = getFileExtension(file.filename);
  return allowedTypes.includes(extension);
};

export const validateFileUpload = (
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
    allowedCategories?: string[];
  } = {},
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const { maxSizeMB = 10, allowedTypes, allowedCategories } = options;

  // Size validation
  if (!isFileSizeValid(file, maxSizeMB)) {
    errors.push(`Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`);
  }

  // Type validation
  if (allowedTypes && !isFileTypeAllowed(file, allowedTypes)) {
    errors.push(`Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(", ")}`);
  }

  // Category validation
  if (allowedCategories) {
    const category = getFileCategory(file);
    if (!allowedCategories.includes(category)) {
      errors.push(`Categoria de arquivo não permitida. Categorias aceitas: ${allowedCategories.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const sanitizeFilename = (filename: string | undefined | null): string => {
  if (!filename) return "";
  // Remove or replace invalid characters
  return filename
    .replace(/[^\w\s.-]/gi, "") // Remove special characters except word chars, spaces, dots, and hyphens
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .toLowerCase();
};

// =====================
// File URLs
// =====================

// Re-export centralized API URL resolver
export { getApiBaseUrl };

// =====================
// CDN URL Rewriting for Offline/LAN Mode
// =====================

/** CDN domains that serve files (won't resolve on LAN without internet) */
const CDN_DOMAINS = ['arquivos.ankaadesign.com.br', 'arquivos.ankaa.app'];

// Production API domains — thumbnailUrl and other API links stored in the DB point here.
// On LAN these must be rewritten to the local API proxy (no internet/NAT hairpinning needed).
const API_DOMAINS = ['api.ankaadesign.com.br', 'api.ankaa.live', 'test.api.ankaadesign.com.br'];

/**
 * Check if a URL points to a CDN domain that may not resolve on LAN
 */
const isCdnUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return CDN_DOMAINS.some(d => hostname === d);
  } catch {
    return false;
  }
};

/**
 * Check if a URL points to a production API domain stored in the DB
 * (e.g. thumbnailUrl = "https://api.ankaadesign.com.br/files/thumbnail/...")
 */
const isProductionApiUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return API_DOMAINS.some(d => hostname === d);
  } catch {
    return false;
  }
};

/**
 * Check if the app is currently accessed from a private/local network.
 * When true, CDN URLs should be rewritten to use the local API server.
 */
const isOnLocalNetwork = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
};

/**
 * Rewrite a CDN URL to use the local API's static file serving route.
 * CDN URL: https://arquivos.ankaadesign.com.br/24/3/12/uuid.jpg
 * Local:   http://192.168.10.180/api/files/storage/24/3/12/uuid.jpg
 *
 * Also rewrites production API URLs (thumbnailUrl, etc.) to the local proxy:
 * API URL: https://api.ankaadesign.com.br/files/thumbnail/uuid
 * Local:   http://192.168.10.180/api/files/thumbnail/uuid
 *
 * Returns the original URL if not applicable or not on local network.
 */
export const rewriteCdnUrl = (url: string): string => {
  if (!isOnLocalNetwork()) return url;
  try {
    const parsed = new URL(url);
    const apiUrl = getApiBaseUrl();
    if (isCdnUrl(url)) {
      // CDN files are served via the static /files/storage/ route on the API
      // ?v=2 busts any 404s previously cached when the nginx X-Accel-Redirect was misconfigured
      return `${apiUrl}/files/storage${parsed.pathname}?v=2`;
    }
    if (isProductionApiUrl(url)) {
      // Production API paths (thumbnails, serve, etc.) map directly to the local proxy
      // ?v=2 busts any 404s previously cached when the nginx X-Accel-Redirect was misconfigured
      const sep = parsed.search ? '&' : '?';
      return `${apiUrl}${parsed.pathname}${parsed.search}${sep}v=2`;
    }
    return url;
  } catch {
    return url;
  }
};

/**
 * Normalizes a thumbnail URL to ensure it's a complete URL
 * If the URL is relative (starts with /api/files or /files), it prepends the API base URL
 * If it's already a complete URL (starts with http), it rewrites CDN URLs when on LAN
 */
export const normalizeThumbnailUrl = (thumbnailUrl: string | undefined | null): string | undefined => {
  if (!thumbnailUrl) return undefined;

  // If already a complete URL, rewrite CDN URLs when on LAN
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return rewriteCdnUrl(thumbnailUrl);
  }

  const apiBaseUrl = getApiBaseUrl();

  // Remove leading /api if present (old format)
  const cleanPath = thumbnailUrl.startsWith('/api/')
    ? thumbnailUrl.substring(4) // Remove '/api'
    : thumbnailUrl;

  // Ensure path starts with /
  const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  return `${apiBaseUrl}${path}`;
};

export const getFileUrl = (file: File, baseUrl?: string): string => {
  if (!file || !file.id) return "";

  // Check if this is a remote storage file (path starts with http)
  // Rewrite CDN URLs when on LAN so files are served by the local API
  if (file.path && file.path.startsWith("http")) {
    return rewriteCdnUrl(file.path);
  }

  // Database file - use API endpoint
  const apiUrl = baseUrl || getApiBaseUrl();
  // ?v=2 on LAN: busts 404s cached when nginx X-Accel-Redirect locations were missing
  const bust = isOnLocalNetwork() ? '?v=2' : '';
  return `${apiUrl}/files/serve/${file.id}${bust}`;
};

export const getFileDownloadUrl = (file: File, baseUrl?: string): string => {
  // Check if this is a remote storage file (path starts with http)
  if (file.path && file.path.startsWith("http")) {
    return rewriteCdnUrl(file.path);
  }

  // Database file - use API endpoint
  const apiUrl = baseUrl || getApiBaseUrl();
  return `${apiUrl}/files/${file.id}/download`;
};

export const getFileThumbnailUrl = (file: File, size: "small" | "medium" | "large" = "medium", baseUrl?: string): string => {
  if (!isImageFile(file)) return "";

  // Check if this is a remote storage file with thumbnailUrl (images only)
  // Rewrite CDN URLs when on LAN
  if (file.thumbnailUrl && file.thumbnailUrl.startsWith("http")) {
    return rewriteCdnUrl(file.thumbnailUrl);
  }

  // Database file - use API endpoint
  const apiUrl = baseUrl || getApiBaseUrl();
  return `${apiUrl}/files/thumbnail/${file.id}?size=${size}&v=2`;
};

// =====================
// File Display
// =====================

export const formatFileDisplay = (file: File): string => {
  if (!file) return "";
  const filename = file.filename || "unnamed";
  const size = file.size || 0;
  return `${filename} (${formatFileSize(size)})`;
};

export const formatFileFullDisplay = (file: File): string => {
  if (!file) return "";
  const category = getFileCategory(file);
  const icon = getFileIcon(file);
  const filename = file.filename || "unnamed";
  const size = file.size || 0;
  return `${icon} ${filename} - ${formatFileSize(size)} - ${category}`;
};

export const formatFileInfo = (file: File): { name: string; size: string; type: string; category: string; icon: string } => {
  if (!file) return { name: "unnamed", size: "0 Bytes", type: "unknown", category: "other", icon: "📎" };
  return {
    name: file.filename || "unnamed",
    size: formatFileSize(file.size || 0),
    type: file.mimetype || "unknown",
    category: getFileCategory(file),
    icon: getFileIcon(file),
  };
};

export const getFileDisplayName = (file: File, maxLength: number = 50): string => {
  if (!file || !file.filename) return "unnamed";
  if (file.filename.length <= maxLength) return file.filename;
  const extension = getFileExtension(file.filename);
  const nameWithoutExt = getFileNameWithoutExtension(file.filename);
  const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + "...";
  return extension ? `${truncatedName}.${extension}` : truncatedName;
};

// =====================
// File Operations
// =====================

export const generateUniqueFilename = (filename: string | undefined | null, existingFilenames: string[]): string => {
  if (!filename) return `unnamed_${Date.now()}`;

  if (!existingFilenames.includes(filename)) {
    return filename;
  }

  const extensionIndex = filename.lastIndexOf(".");
  const nameWithoutExt = extensionIndex !== -1 ? filename.substring(0, extensionIndex) : filename;
  const extension = extensionIndex !== -1 ? filename.substring(extensionIndex + 1) : "";

  let counter = 1;
  while (true) {
    const newFilename = extension ? `${nameWithoutExt}_${counter}.${extension}` : `${nameWithoutExt}_${counter}`;
    if (!existingFilenames.includes(newFilename)) {
      return newFilename;
    }
    counter++;
  }
};

export const groupFilesByDate = (files: File[], groupBy: "day" | "week" | "month" = "day"): Record<string, File[]> => {
  const grouped: Record<string, File[]> = {};

  files.forEach((file) => {
    const date = new Date(file.createdAt);
    let key: string;

    switch (groupBy) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(file);
  });

  return grouped;
};

// =====================
// Export all utilities as a single object
// =====================

export const fileUtils = {
  // Size formatting
  formatFileSize,
  formatFileSizeCompact,
  bytesToMB,
  bytesToKB,
  mbToBytes,
  kbToBytes,

  // File type detection
  getFileExtension,
  getFileNameWithoutExtension,
  getFileCategory,
  getFileCategoryFromExtension,
  isImageFile,
  isDocumentFile,
  isVideoFile,
  isAudioFile,
  isArchiveFile,

  // Icons
  getFileIcon,
  getFileCategoryIcon,
  getFileIconClass,

  // Validation
  isFileSizeValid,
  isFileTypeAllowed,
  validateFileUpload,
  sanitizeFilename,

  // URLs
  getFileUrl,
  getFileDownloadUrl,
  getFileThumbnailUrl,

  // Display
  formatFileDisplay,
  formatFileFullDisplay,
  formatFileInfo,
  getFileDisplayName,

  // Operations
  generateUniqueFilename,
  groupFilesByDate,
};
