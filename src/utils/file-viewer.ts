// apps/web/src/utils/file-viewer.ts

import type { File as AnkaaFile } from "../types";

// File type detection and security utilities
export interface FileViewerConfig {
  baseUrl?: string;
  allowedMimeTypes?: string[];
  maxFileSize?: number; // in bytes
  enableSecurity?: boolean;
  pdfViewMode?: "new-tab" | "modal" | "inline"; // How to open PDFs (default: new-tab)
  pdfMaxFileSize?: number; // Max PDF file size for inline viewing (default: 50MB)
}

export interface FileViewAction {
  type: "modal" | "new-tab" | "inline" | "download" | "not-supported";
  url?: string;
  component?: "image-modal" | "video-player" | "pdf-viewer";
  security?: {
    isSecure: boolean;
    warnings: string[];
  };
}

// MIME type categories for different viewing strategies
const MIME_TYPE_CATEGORIES = {
  // Images - should open in modal viewer
  images: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/ico", "image/tiff"],

  // PDFs - should open in new tab
  pdfs: ["application/pdf"],

  // Videos - should open in video player (modal or inline)
  videos: ["video/mp4", "video/avi", "video/mov", "video/wmv", "video/flv", "video/webm", "video/mkv", "video/m4v", "video/quicktime"],

  // Audio - should open in audio player (inline)
  audio: ["audio/mp3", "audio/wav", "audio/flac", "audio/aac", "audio/ogg", "audio/wma", "audio/m4a", "audio/mpeg"],

  // EPS files - special handling with preview if thumbnail available
  eps: ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"],

  // Documents - should be downloaded or opened in new tab if supported
  documents: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/rtf",
  ],

  // Archive - should be downloaded
  archives: ["application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/gzip", "application/x-tar"],
};

// Security validation for file types
const POTENTIALLY_DANGEROUS_EXTENSIONS = ["exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js", "jse", "wsf", "wsh", "msi", "dll"];

const XSS_DANGEROUS_TYPES = ["text/html", "application/xhtml+xml", "application/javascript", "text/javascript"];

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
 * Check if a file is a PDF
 */
export const isPDFFile = (file: AnkaaFile): boolean => {
  const mimeType = file.mimetype?.toLowerCase() || "";
  const filename = file.filename?.toLowerCase() || "";

  return (
    mimeType === "application/pdf" ||
    filename.endsWith(".pdf")
  );
};

/**
 * Detect file category based on MIME type and filename
 */
export const detectFileCategory = (file: AnkaaFile): string => {
  const mimeType = file.mimetype?.toLowerCase() || "";
  const filename = file.filename?.toLowerCase() || "";

  // Check MIME type first
  for (const [category, types] of Object.entries(MIME_TYPE_CATEGORIES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }

  // Fallback to extension-based detection
  const extension = filename.split(".").pop() || "";

  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"].includes(extension)) {
    return "images";
  }
  if (["pdf"].includes(extension)) {
    return "pdfs";
  }
  if (["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v"].includes(extension)) {
    return "videos";
  }
  if (["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"].includes(extension)) {
    return "audio";
  }
  if (["eps", "ai"].includes(extension)) {
    return "eps";
  }
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf"].includes(extension)) {
    return "documents";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return "archives";
  }

  return "other";
};

/**
 * Perform security validation on file
 */
export const validateFileSecurity = (file: AnkaaFile, config: FileViewerConfig = {}): { isSecure: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  const { enableSecurity = true, maxFileSize = 500 * 1024 * 1024 } = config; // 500MB default

  if (!enableSecurity) {
    return { isSecure: true, warnings: [] };
  }

  const mimeType = file.mimetype?.toLowerCase() || "";
  const filename = file.filename?.toLowerCase() || "";
  const extension = filename.split(".").pop() || "";

  // Check for dangerous extensions
  if (POTENTIALLY_DANGEROUS_EXTENSIONS.includes(extension)) {
    warnings.push(`Tipo de arquivo potencialmente perigoso: .${extension}`);
  }

  // Check for XSS dangerous types
  if (XSS_DANGEROUS_TYPES.includes(mimeType)) {
    warnings.push("Tipo MIME pode conter scripts maliciosos");
  }

  // File size validation
  if (file.size > maxFileSize) {
    warnings.push(`Arquivo muito grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB (máximo: ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB)`);
  }

  // Check for filename injection attempts
  if (filename.includes("../") || filename.includes("..\\")) {
    warnings.push("Nome do arquivo contém caracteres de navegação suspeitos");
  }

  const isSecure = warnings.length === 0;
  return { isSecure, warnings };
};

/**
 * Generate file URLs for different purposes
 */
export const generateFileUrls = (file: AnkaaFile, baseUrl?: string) => {
  const apiUrl = baseUrl || getApiBaseUrl();

  return {
    serve: `${apiUrl}/files/serve/${file.id}`,
    download: `${apiUrl}/files/${file.id}/download`,
    thumbnail: file.thumbnailUrl ? (file.thumbnailUrl.startsWith("http") ? file.thumbnailUrl : `${apiUrl}${file.thumbnailUrl}`) : null,
    thumbnailSmall: `${apiUrl}/files/thumbnail/${file.id}?size=small`,
    thumbnailMedium: `${apiUrl}/files/thumbnail/${file.id}?size=medium`,
    thumbnailLarge: `${apiUrl}/files/thumbnail/${file.id}?size=large`,
  };
};

/**
 * Validate PDF-specific requirements
 */
export const validatePDFFile = (file: AnkaaFile, config: FileViewerConfig = {}): { isValid: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  const { pdfMaxFileSize = 50 * 1024 * 1024 } = config; // 50MB default for inline viewing

  if (!isPDFFile(file)) {
    return { isValid: false, warnings: ["File is not a PDF"] };
  }

  // Check PDF size for inline viewing
  if (file.size > pdfMaxFileSize) {
    warnings.push(
      `PDF is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Files larger than ${(pdfMaxFileSize / (1024 * 1024)).toFixed(0)}MB may not load properly in inline viewer.`
    );
  }

  // Check for very large PDFs
  if (file.size > 100 * 1024 * 1024) {
    warnings.push("PDF is very large and may take time to load. Consider downloading instead.");
  }

  return {
    isValid: true,
    warnings,
  };
};

/**
 * Determine the appropriate viewing action for a file
 */
export const determineFileViewAction = (file: AnkaaFile, config: FileViewerConfig = {}): FileViewAction => {
  const category = detectFileCategory(file);
  const security = validateFileSecurity(file, config);
  const urls = generateFileUrls(file, config.baseUrl);

  // If file is not secure and security is enabled, force download
  if (!security.isSecure && config.enableSecurity !== false) {
    return {
      type: "download",
      url: urls.download,
      security,
    };
  }

  // Determine action based on file category
  switch (category) {
    case "images":
      return {
        type: "modal",
        url: urls.serve,
        component: "image-modal",
        security,
      };

    case "pdfs": {
      // PDFs should open in image modal showing thumbnail preview
      // Thumbnails are generated on-demand for all PDFs
      return {
        type: "modal",
        url: urls.thumbnailLarge, // Use large thumbnail for better preview
        component: "image-modal",
        security,
      };
    }

    case "videos":
      return {
        type: "modal", // Can be changed to 'inline' based on UI preference
        url: urls.serve,
        component: "video-player",
        security,
      };

    case "audio":
      return {
        type: "inline",
        url: urls.serve,
        component: "video-player", // Audio player component
        security,
      };

    case "eps":
      // EPS files with thumbnails can be previewed, otherwise download
      if (file.thumbnailUrl) {
        return {
          type: "modal",
          url: urls.thumbnail!,
          component: "image-modal",
          security,
        };
      } else {
        return {
          type: "download",
          url: urls.download,
          security,
        };
      }

    case "documents":
      // Most documents should be downloaded, PDFs handled above
      return {
        type: "download",
        url: urls.download,
        security,
      };

    case "archives":
      return {
        type: "download",
        url: urls.download,
        security,
      };

    default:
      return {
        type: "download",
        url: urls.download,
        security,
      };
  }
};

/**
 * Execute the determined file view action
 */
export const executeFileViewAction = (
  action: FileViewAction,
  options: {
    onModalOpen?: (component: string, url: string, file?: AnkaaFile) => void;
    onInlinePlayer?: (url: string, file?: AnkaaFile) => void;
    onDownload?: (url: string, file?: AnkaaFile) => void;
    onSecurityWarning?: (warnings: string[]) => void;
  } = {},
) => {
  const { onModalOpen, onInlinePlayer, onDownload, onSecurityWarning } = options;

  // Show security warnings if present
  if (action.security && action.security.warnings.length > 0 && onSecurityWarning) {
    onSecurityWarning(action.security.warnings);
  }

  // Execute action
  switch (action.type) {
    case "modal":
      if (onModalOpen && action.component && action.url) {
        onModalOpen(action.component, action.url);
      }
      break;

    case "new-tab":
      if (action.url) {
        // Only create links in browser environment
        if (typeof window !== "undefined" && typeof document !== "undefined") {
          // Open PDF with proper headers to prevent download dialog
          const link = document.createElement("a");
          link.href = action.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      break;

    case "inline":
      if (onInlinePlayer && action.url) {
        onInlinePlayer(action.url);
      }
      break;

    case "download":
      if (action.url) {
        if (onDownload) {
          onDownload(action.url);
        } else {
          // Only create download links in browser environment
          if (typeof window !== "undefined" && typeof document !== "undefined") {
            // Default download behavior
            const link = document.createElement("a");
            link.href = action.url;
            link.download = "";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      }
      break;

    case "not-supported":
      console.warn("File type not supported for viewing");
      break;
  }
};

/**
 * Main file viewer function - determines and executes appropriate action
 */
export const viewFile = (
  file: AnkaaFile,
  config: FileViewerConfig = {},
  options: {
    onModalOpen?: (component: string, url: string, file?: AnkaaFile) => void;
    onInlinePlayer?: (url: string, file?: AnkaaFile) => void;
    onDownload?: (url: string, file?: AnkaaFile) => void;
    onSecurityWarning?: (warnings: string[]) => void;
  } = {},
) => {
  const action = determineFileViewAction(file, config);
  executeFileViewAction(action, options);
  return action;
};

/**
 * Check if file can be previewed (has thumbnail or is viewable)
 */
export const canPreviewFile = (file: AnkaaFile): boolean => {
  const category = detectFileCategory(file);

  switch (category) {
    case "images":
    case "videos":
      return true;
    case "pdfs":
      return true; // PDFs open in new tab
    case "eps":
      return !!file.thumbnailUrl; // Only if thumbnail available
    default:
      return false;
  }
};

/**
 * Get appropriate icon class for file type
 */
export const getFileTypeIcon = (file: AnkaaFile): string => {
  const category = detectFileCategory(file);

  const iconMap: Record<string, string> = {
    images: "IconPhoto",
    pdfs: "IconFileTypePdf",
    videos: "IconVideo",
    audio: "IconMusic",
    eps: "IconVectorBezier",
    documents: "IconFileText",
    archives: "IconFileZip",
    other: "IconFile",
  };

  return iconMap[category] || iconMap.other;
};

// Export everything as a unified service
export const fileViewerService = {
  detectFileCategory,
  validateFileSecurity,
  validatePDFFile,
  isPDFFile,
  generateFileUrls,
  determineFileViewAction,
  executeFileViewAction,
  viewFile,
  canPreviewFile,
  getFileTypeIcon,

  // Configuration presets
  configs: {
    secure: {
      enableSecurity: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      pdfViewMode: "new-tab" as const,
      pdfMaxFileSize: 50 * 1024 * 1024, // 50MB
    },
    permissive: {
      enableSecurity: false,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      pdfViewMode: "modal" as const,
      pdfMaxFileSize: 100 * 1024 * 1024, // 100MB
    },
    default: {
      enableSecurity: true,
      maxFileSize: 200 * 1024 * 1024, // 200MB
      pdfViewMode: "new-tab" as const,
      pdfMaxFileSize: 50 * 1024 * 1024, // 50MB
    },
  },
};
