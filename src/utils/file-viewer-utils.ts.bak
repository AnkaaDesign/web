/**
 * File Viewer Utilities
 *
 * Comprehensive utility functions for file type detection, thumbnail generation,
 * and file handling operations.
 *
 * @module FileViewerUtils
 */

import type { File as AnkaaFile } from "../types";

// =====================
// Type Definitions
// =====================

export enum FileTypeEnum {
  IMAGE = "image",
  VIDEO = "video",
  PDF = "pdf",
  DOCUMENT = "document",
  SPREADSHEET = "spreadsheet",
  PRESENTATION = "presentation",
  AUDIO = "audio",
  ARCHIVE = "archive",
  VECTOR = "vector",
  CODE = "code",
  OTHER = "other",
}

export interface FileTypeInfo {
  type: FileTypeEnum;
  extension: string;
  mimeType: string;
  category: string;
  canPreview: boolean;
  canThumbnail: boolean;
  icon: string;
  color: string;
  label: string;
}

export interface ThumbnailOptions {
  size?: "small" | "medium" | "large";
  quality?: number;
  format?: "jpeg" | "png" | "webp";
}

export interface FileUrlOptions {
  baseUrl?: string;
  download?: boolean;
  inline?: boolean;
}

// =====================
// MIME Type Mappings
// =====================

/**
 * Comprehensive MIME type to file type mapping
 */
export const MIME_TYPE_MAP: Record<string, FileTypeEnum> = {
  // Images
  "image/jpeg": FileTypeEnum.IMAGE,
  "image/jpg": FileTypeEnum.IMAGE,
  "image/png": FileTypeEnum.IMAGE,
  "image/gif": FileTypeEnum.IMAGE,
  "image/webp": FileTypeEnum.IMAGE,
  "image/svg+xml": FileTypeEnum.VECTOR,
  "image/bmp": FileTypeEnum.IMAGE,
  "image/ico": FileTypeEnum.IMAGE,
  "image/x-icon": FileTypeEnum.IMAGE,
  "image/tiff": FileTypeEnum.IMAGE,
  "image/heic": FileTypeEnum.IMAGE,
  "image/heif": FileTypeEnum.IMAGE,

  // Videos
  "video/mp4": FileTypeEnum.VIDEO,
  "video/webm": FileTypeEnum.VIDEO,
  "video/avi": FileTypeEnum.VIDEO,
  "video/x-msvideo": FileTypeEnum.VIDEO,
  "video/quicktime": FileTypeEnum.VIDEO,
  "video/x-ms-wmv": FileTypeEnum.VIDEO,
  "video/x-flv": FileTypeEnum.VIDEO,
  "video/x-matroska": FileTypeEnum.VIDEO,
  "video/3gpp": FileTypeEnum.VIDEO,
  "video/3gpp2": FileTypeEnum.VIDEO,

  // PDFs
  "application/pdf": FileTypeEnum.PDF,

  // Documents
  "application/msword": FileTypeEnum.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileTypeEnum.DOCUMENT,
  "application/vnd.oasis.opendocument.text": FileTypeEnum.DOCUMENT,
  "application/rtf": FileTypeEnum.DOCUMENT,
  "text/plain": FileTypeEnum.DOCUMENT,
  "text/rtf": FileTypeEnum.DOCUMENT,

  // Spreadsheets
  "application/vnd.ms-excel": FileTypeEnum.SPREADSHEET,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileTypeEnum.SPREADSHEET,
  "application/vnd.oasis.opendocument.spreadsheet": FileTypeEnum.SPREADSHEET,
  "text/csv": FileTypeEnum.SPREADSHEET,

  // Presentations
  "application/vnd.ms-powerpoint": FileTypeEnum.PRESENTATION,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": FileTypeEnum.PRESENTATION,
  "application/vnd.oasis.opendocument.presentation": FileTypeEnum.PRESENTATION,

  // Audio
  "audio/mpeg": FileTypeEnum.AUDIO,
  "audio/mp3": FileTypeEnum.AUDIO,
  "audio/wav": FileTypeEnum.AUDIO,
  "audio/x-wav": FileTypeEnum.AUDIO,
  "audio/flac": FileTypeEnum.AUDIO,
  "audio/aac": FileTypeEnum.AUDIO,
  "audio/ogg": FileTypeEnum.AUDIO,
  "audio/x-ms-wma": FileTypeEnum.AUDIO,
  "audio/m4a": FileTypeEnum.AUDIO,
  "audio/x-m4a": FileTypeEnum.AUDIO,

  // Archives
  "application/zip": FileTypeEnum.ARCHIVE,
  "application/x-zip-compressed": FileTypeEnum.ARCHIVE,
  "application/x-rar-compressed": FileTypeEnum.ARCHIVE,
  "application/x-7z-compressed": FileTypeEnum.ARCHIVE,
  "application/gzip": FileTypeEnum.ARCHIVE,
  "application/x-gzip": FileTypeEnum.ARCHIVE,
  "application/x-tar": FileTypeEnum.ARCHIVE,
  "application/x-bzip2": FileTypeEnum.ARCHIVE,

  // Vector Graphics
  "application/postscript": FileTypeEnum.VECTOR,
  "application/x-eps": FileTypeEnum.VECTOR,
  "application/eps": FileTypeEnum.VECTOR,
  "image/eps": FileTypeEnum.VECTOR,
  "image/x-eps": FileTypeEnum.VECTOR,

  // Code
  "text/html": FileTypeEnum.CODE,
  "text/css": FileTypeEnum.CODE,
  "text/javascript": FileTypeEnum.CODE,
  "application/javascript": FileTypeEnum.CODE,
  "application/json": FileTypeEnum.CODE,
  "text/xml": FileTypeEnum.CODE,
  "application/xml": FileTypeEnum.CODE,
};

/**
 * File extension to file type mapping
 */
export const EXTENSION_TYPE_MAP: Record<string, FileTypeEnum> = {
  // Images
  jpg: FileTypeEnum.IMAGE,
  jpeg: FileTypeEnum.IMAGE,
  png: FileTypeEnum.IMAGE,
  gif: FileTypeEnum.IMAGE,
  webp: FileTypeEnum.IMAGE,
  bmp: FileTypeEnum.IMAGE,
  ico: FileTypeEnum.IMAGE,
  tiff: FileTypeEnum.IMAGE,
  tif: FileTypeEnum.IMAGE,
  heic: FileTypeEnum.IMAGE,
  heif: FileTypeEnum.IMAGE,

  // Videos
  mp4: FileTypeEnum.VIDEO,
  webm: FileTypeEnum.VIDEO,
  avi: FileTypeEnum.VIDEO,
  mov: FileTypeEnum.VIDEO,
  wmv: FileTypeEnum.VIDEO,
  flv: FileTypeEnum.VIDEO,
  mkv: FileTypeEnum.VIDEO,
  m4v: FileTypeEnum.VIDEO,
  "3gp": FileTypeEnum.VIDEO,

  // PDFs
  pdf: FileTypeEnum.PDF,

  // Documents
  doc: FileTypeEnum.DOCUMENT,
  docx: FileTypeEnum.DOCUMENT,
  txt: FileTypeEnum.DOCUMENT,
  rtf: FileTypeEnum.DOCUMENT,
  odt: FileTypeEnum.DOCUMENT,

  // Spreadsheets
  xls: FileTypeEnum.SPREADSHEET,
  xlsx: FileTypeEnum.SPREADSHEET,
  csv: FileTypeEnum.SPREADSHEET,
  ods: FileTypeEnum.SPREADSHEET,

  // Presentations
  ppt: FileTypeEnum.PRESENTATION,
  pptx: FileTypeEnum.PRESENTATION,
  odp: FileTypeEnum.PRESENTATION,

  // Audio
  mp3: FileTypeEnum.AUDIO,
  wav: FileTypeEnum.AUDIO,
  flac: FileTypeEnum.AUDIO,
  aac: FileTypeEnum.AUDIO,
  ogg: FileTypeEnum.AUDIO,
  wma: FileTypeEnum.AUDIO,
  m4a: FileTypeEnum.AUDIO,

  // Archives
  zip: FileTypeEnum.ARCHIVE,
  rar: FileTypeEnum.ARCHIVE,
  "7z": FileTypeEnum.ARCHIVE,
  tar: FileTypeEnum.ARCHIVE,
  gz: FileTypeEnum.ARCHIVE,
  bz2: FileTypeEnum.ARCHIVE,

  // Vector
  eps: FileTypeEnum.VECTOR,
  ai: FileTypeEnum.VECTOR,
  svg: FileTypeEnum.VECTOR,

  // Code
  html: FileTypeEnum.CODE,
  htm: FileTypeEnum.CODE,
  css: FileTypeEnum.CODE,
  js: FileTypeEnum.CODE,
  ts: FileTypeEnum.CODE,
  jsx: FileTypeEnum.CODE,
  tsx: FileTypeEnum.CODE,
  json: FileTypeEnum.CODE,
  xml: FileTypeEnum.CODE,
  py: FileTypeEnum.CODE,
  java: FileTypeEnum.CODE,
  cpp: FileTypeEnum.CODE,
  c: FileTypeEnum.CODE,
  php: FileTypeEnum.CODE,
  rb: FileTypeEnum.CODE,
  go: FileTypeEnum.CODE,
  rs: FileTypeEnum.CODE,
};

/**
 * File type display information
 */
export const FILE_TYPE_INFO: Record<FileTypeEnum, Omit<FileTypeInfo, "extension" | "mimeType">> = {
  [FileTypeEnum.IMAGE]: {
    type: FileTypeEnum.IMAGE,
    category: "Imagem",
    canPreview: true,
    canThumbnail: true,
    icon: "IconPhoto",
    color: "blue",
    label: "Imagem",
  },
  [FileTypeEnum.VIDEO]: {
    type: FileTypeEnum.VIDEO,
    category: "Vídeo",
    canPreview: true,
    canThumbnail: true,
    icon: "IconVideo",
    color: "purple",
    label: "Vídeo",
  },
  [FileTypeEnum.PDF]: {
    type: FileTypeEnum.PDF,
    category: "PDF",
    canPreview: true,
    canThumbnail: true,
    icon: "IconFileTypePdf",
    color: "red",
    label: "PDF",
  },
  [FileTypeEnum.DOCUMENT]: {
    type: FileTypeEnum.DOCUMENT,
    category: "Documento",
    canPreview: false,
    canThumbnail: true,
    icon: "IconFileTypeDoc",
    color: "blue",
    label: "Documento",
  },
  [FileTypeEnum.SPREADSHEET]: {
    type: FileTypeEnum.SPREADSHEET,
    category: "Planilha",
    canPreview: false,
    canThumbnail: true,
    icon: "IconFileTypeXls",
    color: "green",
    label: "Planilha",
  },
  [FileTypeEnum.PRESENTATION]: {
    type: FileTypeEnum.PRESENTATION,
    category: "Apresentação",
    canPreview: false,
    canThumbnail: true,
    icon: "IconFileTypePpt",
    color: "orange",
    label: "Apresentação",
  },
  [FileTypeEnum.AUDIO]: {
    type: FileTypeEnum.AUDIO,
    category: "Áudio",
    canPreview: true,
    canThumbnail: false,
    icon: "IconMusic",
    color: "pink",
    label: "Áudio",
  },
  [FileTypeEnum.ARCHIVE]: {
    type: FileTypeEnum.ARCHIVE,
    category: "Arquivo Compactado",
    canPreview: false,
    canThumbnail: false,
    icon: "IconFileZip",
    color: "yellow",
    label: "Arquivo",
  },
  [FileTypeEnum.VECTOR]: {
    type: FileTypeEnum.VECTOR,
    category: "Vetor",
    canPreview: false,
    canThumbnail: true,
    icon: "IconVectorBezier",
    color: "indigo",
    label: "Vetor",
  },
  [FileTypeEnum.CODE]: {
    type: FileTypeEnum.CODE,
    category: "Código",
    canPreview: false,
    canThumbnail: false,
    icon: "IconCode",
    color: "gray",
    label: "Código",
  },
  [FileTypeEnum.OTHER]: {
    type: FileTypeEnum.OTHER,
    category: "Outro",
    canPreview: false,
    canThumbnail: false,
    icon: "IconFile",
    color: "gray",
    label: "Arquivo",
  },
};

// =====================
// Core Functions
// =====================

/**
 * Gets the file extension from a filename
 */
export const getFileExtension = (filename: string): string => {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

/**
 * Detects file type from file metadata
 *
 * @param file - File object
 * @returns FileTypeEnum
 */
export const detectFileType = (file: AnkaaFile): FileTypeEnum => {
  // Try MIME type first (more reliable)
  const mimeType = file.mimetype?.toLowerCase() || "";
  if (mimeType && MIME_TYPE_MAP[mimeType]) {
    return MIME_TYPE_MAP[mimeType];
  }

  // Fallback to extension
  const extension = getFileExtension(file.filename);
  if (extension && EXTENSION_TYPE_MAP[extension]) {
    return EXTENSION_TYPE_MAP[extension];
  }

  // Check for partial MIME type matches
  if (mimeType.startsWith("image/")) return FileTypeEnum.IMAGE;
  if (mimeType.startsWith("video/")) return FileTypeEnum.VIDEO;
  if (mimeType.startsWith("audio/")) return FileTypeEnum.AUDIO;
  if (mimeType.includes("pdf")) return FileTypeEnum.PDF;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileTypeEnum.DOCUMENT;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return FileTypeEnum.SPREADSHEET;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return FileTypeEnum.PRESENTATION;
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileTypeEnum.ARCHIVE;

  return FileTypeEnum.OTHER;
};

/**
 * Gets complete file type information
 *
 * @param file - File object
 * @returns FileTypeInfo
 */
export const getFileTypeInfo = (file: AnkaaFile): FileTypeInfo => {
  const fileType = detectFileType(file);
  const extension = getFileExtension(file.filename);
  const info = FILE_TYPE_INFO[fileType];

  return {
    ...info,
    extension,
    mimeType: file.mimetype,
  };
};

/**
 * Checks if a file can be previewed
 *
 * @param file - File object
 * @returns boolean
 */
export const canPreviewFile = (file: AnkaaFile): boolean => {
  const fileType = detectFileType(file);
  return FILE_TYPE_INFO[fileType].canPreview;
};

/**
 * Checks if a file can have a thumbnail generated
 *
 * @param file - File object
 * @returns boolean
 */
export const canGenerateThumbnail = (file: AnkaaFile): boolean => {
  const fileType = detectFileType(file);
  return FILE_TYPE_INFO[fileType].canThumbnail;
};

/**
 * Gets the API base URL
 */
export const getApiBaseUrl = (): string => {
  // Check window global
  if (typeof window !== "undefined" && (window as any).__ANKAA_API_URL__) {
    return (window as any).__ANKAA_API_URL__;
  }

  // Check environment variable (Vite build-time replacement)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Fallback
  return "http://localhost:3030";
};

/**
 * Generates thumbnail URL for a file
 *
 * @param file - File object
 * @param options - Thumbnail options
 * @returns Thumbnail URL or null
 */
export const generateThumbnailUrl = (
  file: AnkaaFile,
  options: ThumbnailOptions = {}
): string | null => {
  const { size = "medium" } = options;
  const baseUrl = getApiBaseUrl();
  const fileType = detectFileType(file);

  // If file has a thumbnail URL, use it
  if (file.thumbnailUrl) {
    return file.thumbnailUrl.startsWith("http")
      ? file.thumbnailUrl
      : `${baseUrl}${file.thumbnailUrl}`;
  }

  // For images, serve directly
  if (fileType === FileTypeEnum.IMAGE) {
    return `${baseUrl}/files/serve/${file.id}`;
  }

  // For files that can have thumbnails generated
  if (canGenerateThumbnail(file)) {
    return `${baseUrl}/files/thumbnail/${file.id}?size=${size}`;
  }

  return null;
};

/**
 * Generates file URLs for different purposes
 *
 * @param file - File object
 * @param options - URL options
 * @returns Object with different URL types
 */
export const generateFileUrls = (file: AnkaaFile, options: FileUrlOptions = {}) => {
  const { baseUrl } = options;
  const apiUrl = baseUrl || getApiBaseUrl();

  return {
    /** URL to serve the file */
    serve: `${apiUrl}/files/serve/${file.id}`,

    /** URL to download the file */
    download: `${apiUrl}/files/${file.id}/download`,

    /** URL to preview the file (inline) */
    preview: `${apiUrl}/files/serve/${file.id}?inline=true`,

    /** Thumbnail URLs */
    thumbnail: {
      small: `${apiUrl}/files/thumbnail/${file.id}?size=small`,
      medium: `${apiUrl}/files/thumbnail/${file.id}?size=medium`,
      large: `${apiUrl}/files/thumbnail/${file.id}?size=large`,
    },

    /** Custom thumbnail if available */
    customThumbnail: file.thumbnailUrl
      ? file.thumbnailUrl.startsWith("http")
        ? file.thumbnailUrl
        : `${apiUrl}${file.thumbnailUrl}`
      : null,
  };
};

/**
 * Formats file size to human-readable format
 *
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Validates file against constraints
 *
 * @param file - File object
 * @param constraints - Validation constraints
 * @returns Validation result
 */
export const validateFile = (
  file: AnkaaFile,
  constraints: {
    maxSize?: number;
    allowedTypes?: FileTypeEnum[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const { maxSize, allowedTypes, allowedExtensions } = constraints;

  // Size validation
  if (maxSize && file.size > maxSize) {
    errors.push(
      `Arquivo muito grande. Máximo: ${formatFileSize(maxSize)}, atual: ${formatFileSize(file.size)}`
    );
  }

  // Type validation
  if (allowedTypes && allowedTypes.length > 0) {
    const fileType = detectFileType(file);
    if (!allowedTypes.includes(fileType)) {
      errors.push(`Tipo de arquivo não permitido: ${FILE_TYPE_INFO[fileType].label}`);
    }
  }

  // Extension validation
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = getFileExtension(file.filename);
    if (!allowedExtensions.includes(extension)) {
      errors.push(`Extensão de arquivo não permitida: .${extension}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Gets file icon color class
 *
 * @param file - File object
 * @returns Tailwind color class
 */
export const getFileIconColor = (file: AnkaaFile): string => {
  const fileType = detectFileType(file);
  const color = FILE_TYPE_INFO[fileType].color;

  const colorMap: Record<string, string> = {
    blue: "text-blue-500",
    purple: "text-purple-500",
    red: "text-red-500",
    green: "text-green-500",
    orange: "text-orange-500",
    pink: "text-pink-500",
    yellow: "text-yellow-500",
    indigo: "text-indigo-500",
    gray: "text-gray-400",
  };

  return colorMap[color] || colorMap.gray;
};

/**
 * Checks if file is an image
 */
export const isImageFile = (file: AnkaaFile): boolean => {
  return detectFileType(file) === FileTypeEnum.IMAGE;
};

/**
 * Checks if file is a video
 */
export const isVideoFile = (file: AnkaaFile): boolean => {
  return detectFileType(file) === FileTypeEnum.VIDEO;
};

/**
 * Checks if file is a PDF
 */
export const isPdfFile = (file: AnkaaFile): boolean => {
  return detectFileType(file) === FileTypeEnum.PDF;
};

/**
 * Checks if file is a document
 */
export const isDocumentFile = (file: AnkaaFile): boolean => {
  const type = detectFileType(file);
  return [FileTypeEnum.DOCUMENT, FileTypeEnum.SPREADSHEET, FileTypeEnum.PRESENTATION].includes(type);
};

// =====================
// Export all utilities
// =====================

export const fileViewerUtils = {
  // Type detection
  detectFileType,
  getFileTypeInfo,
  getFileExtension,
  canPreviewFile,
  canGenerateThumbnail,

  // URL generation
  generateThumbnailUrl,
  generateFileUrls,
  getApiBaseUrl,

  // Formatting
  formatFileSize,

  // Validation
  validateFile,

  // Helpers
  getFileIconColor,
  isImageFile,
  isVideoFile,
  isPdfFile,
  isDocumentFile,

  // Constants
  FileTypeEnum,
  MIME_TYPE_MAP,
  EXTENSION_TYPE_MAP,
  FILE_TYPE_INFO,
};

export default fileViewerUtils;
