/**
 * File Utilities Type Definitions
 *
 * TypeScript declarations for comprehensive file handling utilities
 */

// =====================================================
// Core Types
// =====================================================

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'font'
  | 'database'
  | 'executable'
  | 'other';

export type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type PreviewType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'none';

export type StorageType = 'local' | 's3' | 'remote' | 'azure' | 'gcs';

// =====================================================
// Interfaces
// =====================================================

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  category: FileCategory;
  extension: string;
  lastModified?: Date;
  isImage: boolean;
  isPdf: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
  isArchive: boolean;
  formattedSize: string;
  formattedSizeBrazilian: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FileValidationConstraints {
  maxSizeInMB?: number;
  minSizeInBytes?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  allowedCategories?: FileCategory[];
  useBrazilianFormat?: boolean;
}

export interface ThumbnailOptions {
  size?: ThumbnailSize;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fallbackIcon?: string;
}

export interface VideoThumbnailOptions extends ThumbnailOptions {
  timestamp?: number;
}

export interface PdfThumbnailOptions extends ThumbnailOptions {
  page?: number;
}

export interface DownloadOptions {
  filename?: string;
  inline?: boolean;
  headers?: Record<string, string>;
}

export interface StorageUrlOptions {
  storageType: StorageType;
  baseUrl?: string;
  bucket?: string;
  path?: string;
  expiresIn?: number;
}

export interface SanitizeOptions {
  removeSpaces?: boolean;
  preserveCase?: boolean;
  maxLength?: number;
  allowUnicode?: boolean;
  replacement?: string;
}

export interface UniqueFilenameOptions {
  preserveExtension?: boolean;
  separator?: string;
  maxLength?: number;
}

export interface SecurityCheck {
  safe: boolean;
  issues: string[];
}

export interface SizeValidation {
  valid: boolean;
  error?: string;
}

export interface TypeValidation {
  valid: boolean;
  error?: string;
}

export interface AllowedTypes {
  extensions?: string[];
  mimeTypes?: string[];
  categories?: FileCategory[];
}

export interface ThumbnailResult {
  type: 'url' | 'icon';
  value: string;
}

export interface PreviewResult {
  canPreview: boolean;
  previewUrl?: string;
  previewType?: PreviewType;
}

// =====================================================
// Constants Types
// =====================================================

export type MimeTypeMap = Record<string, string>;
export type ExtensionCategoryMap = Record<string, FileCategory>;
export type CategoryIconMap = Record<FileCategory, string>;
export type FileTypeIconMap = Record<string, string>;
export type ThumbnailSizeMap = Record<ThumbnailSize, { width: number; height: number }>;
export type MaxFileSizeMap = Record<FileCategory | 'default', number>;
export type PreviewableTypesMap = {
  image: string[];
  video: string[];
  audio: string[];
  document: string[];
  code: string[];
};

// =====================================================
// Function Signatures - Type Detection
// =====================================================

export function getFileExtension(filename: string): string;
export function getFileNameWithoutExtension(filename: string): string;
export function getMimeTypeFromExtension(extension: string): string;
export function getMimeTypeFromFilename(filename: string): string;
export function getCategoryFromMimeType(mimeType: string): FileCategory;
export function getCategoryFromExtension(extension: string): FileCategory;
export function getFileCategory(filename: string, mimeType?: string): FileCategory;
export function isImageFile(filename: string, mimeType?: string): boolean;
export function isVideoFile(filename: string, mimeType?: string): boolean;
export function isAudioFile(filename: string, mimeType?: string): boolean;
export function isDocumentFile(filename: string, mimeType?: string): boolean;
export function isArchiveFile(filename: string, mimeType?: string): boolean;
export function isCodeFile(filename: string, mimeType?: string): boolean;
export function isPdfFile(filename: string, mimeType?: string): boolean;

// =====================================================
// Function Signatures - Thumbnail Generation
// =====================================================

export function generateImageThumbnailUrl(
  fileId: string,
  options?: ThumbnailOptions,
  baseUrl?: string
): string;

export function generateVideoThumbnailUrl(
  fileId: string,
  options?: VideoThumbnailOptions,
  baseUrl?: string
): string;

export function generatePdfThumbnailUrl(
  fileId: string,
  options?: PdfThumbnailOptions,
  baseUrl?: string
): string;

export function getFallbackIcon(filename: string, mimeType?: string): string;

export function getThumbnailUrlOrFallback(
  fileId: string,
  filename: string,
  mimeType?: string,
  options?: ThumbnailOptions,
  baseUrl?: string
): ThumbnailResult;

// =====================================================
// Function Signatures - File Handling
// =====================================================

export function downloadFile(
  url: string,
  filename: string,
  options?: DownloadOptions
): Promise<void>;

export function formatFileSize(bytes: number): string;
export function formatFileSizeBrazilian(bytes: number): string;
export function formatFileSizeCompact(bytes: number): string;
export function truncateFilename(filename: string, maxLength?: number): string;

export function generateDownloadUrl(
  fileId: string,
  filename?: string,
  baseUrl?: string
): string;

export function generatePreviewUrl(fileId: string, baseUrl?: string): string;
export function generateFileUrl(fileId: string, baseUrl?: string): string;

export function generateStorageUrl(
  fileId: string,
  filename: string,
  options: StorageUrlOptions
): string;

// =====================================================
// Function Signatures - Validation
// =====================================================

export function validateFileSize(
  sizeInBytes: number,
  constraints?: {
    maxSizeInMB?: number;
    minSizeInBytes?: number;
    useBrazilianFormat?: boolean;
  }
): SizeValidation;

export function validateFileType(
  filename: string,
  mimeType: string,
  allowedTypes: AllowedTypes
): TypeValidation;

export function checkFilenameSecurity(filename: string): SecurityCheck;

export function sanitizeFilename(
  filename: string,
  options?: SanitizeOptions
): string;

export function validateFile(
  file: File,
  constraints?: FileValidationConstraints
): ValidationResult;

// =====================================================
// Function Signatures - Preview
// =====================================================

export function canPreview(filename: string, mimeType?: string): boolean;
export function getPreviewType(filename: string, mimeType?: string): PreviewType;

export function getPreviewUrlWithFallback(
  fileId: string,
  filename: string,
  mimeType?: string,
  baseUrl?: string
): PreviewResult;

// =====================================================
// Function Signatures - Metadata
// =====================================================

export function getFileMetadata(file: File): FileMetadata;

export function generateUniqueFilename(
  originalFilename: string,
  existingFilenames?: string[],
  options?: UniqueFilenameOptions
): string;

export function createFileHash(file: File): Promise<string>;
export function generateUploadId(): string;

// =====================================================
// Constants Exports
// =====================================================

export const MIME_TYPE_MAP: MimeTypeMap;
export const EXTENSION_CATEGORY_MAP: ExtensionCategoryMap;
export const CATEGORY_ICON_MAP: CategoryIconMap;
export const FILE_TYPE_ICONS: FileTypeIconMap;
export const THUMBNAIL_SIZES: ThumbnailSizeMap;
export const MAX_FILE_SIZES: MaxFileSizeMap;
export const PREVIEWABLE_TYPES: PreviewableTypesMap;

// =====================================================
// Utility Object Export
// =====================================================

export interface FileUtilities {
  // Type Detection
  getFileExtension: typeof getFileExtension;
  getFileNameWithoutExtension: typeof getFileNameWithoutExtension;
  getMimeTypeFromExtension: typeof getMimeTypeFromExtension;
  getMimeTypeFromFilename: typeof getMimeTypeFromFilename;
  getCategoryFromMimeType: typeof getCategoryFromMimeType;
  getCategoryFromExtension: typeof getCategoryFromExtension;
  getFileCategory: typeof getFileCategory;
  isImageFile: typeof isImageFile;
  isVideoFile: typeof isVideoFile;
  isAudioFile: typeof isAudioFile;
  isDocumentFile: typeof isDocumentFile;
  isArchiveFile: typeof isArchiveFile;
  isCodeFile: typeof isCodeFile;
  isPdfFile: typeof isPdfFile;

  // Thumbnail Generation
  generateImageThumbnailUrl: typeof generateImageThumbnailUrl;
  generateVideoThumbnailUrl: typeof generateVideoThumbnailUrl;
  generatePdfThumbnailUrl: typeof generatePdfThumbnailUrl;
  getFallbackIcon: typeof getFallbackIcon;
  getThumbnailUrlOrFallback: typeof getThumbnailUrlOrFallback;

  // File Handling
  downloadFile: typeof downloadFile;
  formatFileSize: typeof formatFileSize;
  formatFileSizeBrazilian: typeof formatFileSizeBrazilian;
  formatFileSizeCompact: typeof formatFileSizeCompact;
  truncateFilename: typeof truncateFilename;
  generateDownloadUrl: typeof generateDownloadUrl;
  generatePreviewUrl: typeof generatePreviewUrl;
  generateFileUrl: typeof generateFileUrl;
  generateStorageUrl: typeof generateStorageUrl;

  // Validation
  validateFileSize: typeof validateFileSize;
  validateFileType: typeof validateFileType;
  checkFilenameSecurity: typeof checkFilenameSecurity;
  sanitizeFilename: typeof sanitizeFilename;
  validateFile: typeof validateFile;

  // Preview
  canPreview: typeof canPreview;
  getPreviewType: typeof getPreviewType;
  getPreviewUrlWithFallback: typeof getPreviewUrlWithFallback;

  // Metadata
  getFileMetadata: typeof getFileMetadata;
  generateUniqueFilename: typeof generateUniqueFilename;
  createFileHash: typeof createFileHash;
  generateUploadId: typeof generateUploadId;

  // Constants
  MIME_TYPE_MAP: MimeTypeMap;
  EXTENSION_CATEGORY_MAP: ExtensionCategoryMap;
  CATEGORY_ICON_MAP: CategoryIconMap;
  FILE_TYPE_ICONS: FileTypeIconMap;
  THUMBNAIL_SIZES: ThumbnailSizeMap;
  MAX_FILE_SIZES: MaxFileSizeMap;
  PREVIEWABLE_TYPES: PreviewableTypesMap;
}

export const fileUtilities: FileUtilities;
export default fileUtilities;
