export * from "./activity";
export * from "./airbrushing";
export * from "./analyticsEnumGetters";
export * from "./auth";
export * from "./batch-toast";
export * from "./bonus";
export * from "./borrow";
export * from "./changelog";
export * from "./changelog-fields";
export * from "./cleaners";
export * from "./color";
export * from "./customer";
export * from "./dataOperationEnumGetters";
export * from "./date";
export * from "./enumLabelGetter";
export * from "./enumMappers";
export * from "./ppe";
export * from "./ppe-size-mapping";
export * from "./eventEnumGetters";
export * from "./favorites";
export * from "./favorite-pages";
export * from "./page-icons";
export * from "./file";
export * from "./file-relationship";
// Browser-only modules - these contain DOM API usage and should not be used server-side
// The modules themselves have environment checks, but for server safety, consider importing directly
// file-viewer moved to apps/web/src/utils/ due to DOM API usage
export * from "./file-type-icons";
export {
  fileUtilsEnhanced,
  getFileTypeFromMime,
  formatFileSizeBrazilian,
  formatFileSizeCompactBrazilian,
  buildThumbnailUrl,
  buildFileDownloadUrl,
  buildFilePreviewUrl,
  getFileMetadata,
  createFileHash,
  generateUploadId,
  validateFile,
  getFileIconFromMime,
  getFileColorFromType,
  getIconForMimeType,
  MIME_TYPE_ICONS,
} from "./file-utils";
export * from "./form";
export * from "./formatters";
export * from "./item";
export * from "./maintenance";
export * from "./task-measures";
export * from "./measure";
export * from "./maskings";
export * from "./validators";
export * from "./notification";
export * from "./navigation";
export * from "./number";
export * from "./observation";
export * from "./order";
export * from "./page-tracker";
export * from "./position";
export * from "./privilege";
export * from "./warning";
export * from "./routes";
export * from "./schedule";
export * from "./sector";
export * from "./serviceOrder";
export * from "./sortOrder";
export * from "./stock-health";
export * from "./stock-level";
export * from "./storage";
export * from "./supplier";
export * from "./task";
export * from "./truck";
export * from "./uiStateEnumGetters";
export * from "./user";
export * from "./vacation";
export * from "./verification-code";
export * from "./verification-errors";
export * from "./work";
// Re-export dashboard and chart types used by utility components
export type { ExportFormat, ExportOptions } from "../types/dashboard";
export type { ExportConfig, ChartExportData } from "./types";
// file-viewer-utils: exclude duplicates (formatFileSize, getFileExtension, getApiBaseUrl, isImageFile, isVideoFile, isDocumentFile, getFileTypeInfo, validateFile)
export {
  FileTypeEnum,
  type FileTypeInfo,
  type ThumbnailOptions,
  type FileUrlOptions,
  MIME_TYPE_MAP,
  EXTENSION_TYPE_MAP,
  FILE_TYPE_INFO,
  detectFileType,
  canPreviewFile,
  canGenerateThumbnail,
  generateThumbnailUrl,
  generateFileUrls,
  getFileIconColor,
  isPdfFile,
  fileViewerUtils,
} from "./file-viewer-utils";
// mediaHelpers: exclude duplicates (formatFileSize, getFileExtension)
export {
  isValidImageUrl,
  isValidVideoUrl,
  detectMediaType,
  formatDuration,
  createVideoThumbnail,
  downloadFile,
  preloadImage,
  preloadImages,
  getImageDimensions,
  getVideoMetadata,
  fileToMediaItem,
  filesToMediaItems,
  calculateFitZoom,
  clamp,
  isTouchDevice,
  supportsFullscreen,
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
  getOptimalThumbnailSize,
  generateMediaId,
  isValidMediaUrl,
  getMimeType,
  sortMediaItems,
  filterMediaByType,
  searchMediaItems,
} from "./mediaHelpers";
