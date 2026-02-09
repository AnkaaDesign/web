/**
 * Comprehensive File Utilities Module
 *
 * Provides complete file handling utilities including:
 * - MIME type detection and mapping
 * - File category classification
 * - Thumbnail generation utilities
 * - File download helpers
 * - Size formatting and validation
 * - Security checks and validation
 * - Preview utilities
 * - URL generation for different storage types
 *
 * @module file-utilities
 */

// =====================================================
// Type Definitions
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

export interface DownloadOptions {
  filename?: string;
  inline?: boolean;
  headers?: Record<string, string>;
}

export interface StorageUrlOptions {
  storageType: 'local' | 's3' | 'remote' | 'azure' | 'gcs';
  baseUrl?: string;
  bucket?: string;
  path?: string;
  expiresIn?: number;
}

export type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
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

// =====================================================
// Constants
// =====================================================

/**
 * Comprehensive MIME type mappings
 */
export const MIME_TYPE_MAP: Record<string, string> = {
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'bmp': 'image/bmp',
  'ico': 'image/x-icon',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'avif': 'image/avif',
  'heic': 'image/heic',
  'heif': 'image/heif',

  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'rtf': 'application/rtf',
  'odt': 'application/vnd.oasis.opendocument.text',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  'csv': 'text/csv',

  // Videos
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  'm4v': 'video/x-m4v',
  '3gp': 'video/3gpp',
  'ogv': 'video/ogg',
  'mpg': 'video/mpeg',
  'mpeg': 'video/mpeg',

  // Audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'ogg': 'audio/ogg',
  'wma': 'audio/x-ms-wma',
  'm4a': 'audio/mp4',
  'opus': 'audio/opus',
  'aiff': 'audio/aiff',
  'au': 'audio/basic',

  // Archives
  'zip': 'application/zip',
  'rar': 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  'bz2': 'application/x-bzip2',
  'xz': 'application/x-xz',

  // Code
  'js': 'text/javascript',
  'mjs': 'text/javascript',
  'jsx': 'text/jsx',
  'ts': 'text/typescript',
  'tsx': 'text/tsx',
  'json': 'application/json',
  'xml': 'application/xml',
  'html': 'text/html',
  'htm': 'text/html',
  'css': 'text/css',
  'scss': 'text/x-scss',
  'sass': 'text/x-sass',
  'less': 'text/x-less',
  'py': 'text/x-python',
  'java': 'text/x-java',
  'php': 'text/x-php',
  'rb': 'text/x-ruby',
  'go': 'text/x-go',
  'rs': 'text/x-rust',
  'cpp': 'text/x-c++',
  'c': 'text/x-c',
  'cs': 'text/x-csharp',
  'swift': 'text/x-swift',
  'kt': 'text/x-kotlin',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  'toml': 'text/toml',
  'ini': 'text/plain',
  'conf': 'text/plain',
  'sh': 'text/x-shellscript',
  'bash': 'text/x-shellscript',

  // Fonts
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'eot': 'application/vnd.ms-fontobject',

  // Database
  'db': 'application/x-sqlite3',
  'sqlite': 'application/x-sqlite3',
  'sql': 'application/sql',
  'mdb': 'application/x-msaccess',

  // Executables
  'exe': 'application/x-msdownload',
  'msi': 'application/x-msi',
  'dmg': 'application/x-apple-diskimage',
  'pkg': 'application/x-newton-compatible-pkg',
  'deb': 'application/x-debian-package',
  'rpm': 'application/x-rpm',
  'apk': 'application/vnd.android.package-archive',
};

/**
 * File category mappings based on extension
 */
export const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Images
  'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
  'svg': 'image', 'bmp': 'image', 'ico': 'image', 'tiff': 'image', 'tif': 'image',
  'avif': 'image', 'heic': 'image', 'heif': 'image', 'raw': 'image', 'cr2': 'image',
  'nef': 'image', 'arw': 'image', 'dng': 'image',

  // Videos
  'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'flv': 'video',
  'webm': 'video', 'mkv': 'video', 'm4v': 'video', '3gp': 'video', 'ogv': 'video',
  'mpg': 'video', 'mpeg': 'video', 'm2v': 'video',

  // Audio
  'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio', 'ogg': 'audio',
  'wma': 'audio', 'm4a': 'audio', 'opus': 'audio', 'aiff': 'audio', 'au': 'audio',

  // Documents
  'pdf': 'document', 'doc': 'document', 'docx': 'document', 'xls': 'document',
  'xlsx': 'document', 'ppt': 'document', 'pptx': 'document', 'txt': 'document',
  'rtf': 'document', 'odt': 'document', 'ods': 'document', 'odp': 'document',
  'csv': 'document', 'pages': 'document', 'numbers': 'document', 'key': 'document',

  // Archives
  'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive',
  'gz': 'archive', 'bz2': 'archive', 'xz': 'archive', 'lzma': 'archive', 'z': 'archive',

  // Code
  'js': 'code', 'mjs': 'code', 'jsx': 'code', 'ts': 'code', 'tsx': 'code',
  'json': 'code', 'xml': 'code', 'html': 'code', 'htm': 'code', 'css': 'code',
  'scss': 'code', 'sass': 'code', 'less': 'code', 'py': 'code', 'java': 'code',
  'php': 'code', 'rb': 'code', 'go': 'code', 'rs': 'code', 'cpp': 'code',
  'c': 'code', 'cs': 'code', 'swift': 'code', 'kt': 'code', 'yaml': 'code',
  'yml': 'code', 'toml': 'code', 'ini': 'code', 'conf': 'code', 'sh': 'code',

  // Fonts
  'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font', 'eot': 'font',

  // Database
  'db': 'database', 'sqlite': 'database', 'sql': 'database', 'mdb': 'database',

  // Executables
  'exe': 'executable', 'msi': 'executable', 'dmg': 'executable', 'pkg': 'executable',
  'deb': 'executable', 'rpm': 'executable', 'apk': 'executable', 'app': 'executable',
};

/**
 * Icon mappings for file categories (Tabler Icons)
 */
export const CATEGORY_ICON_MAP: Record<FileCategory, string> = {
  image: 'IconPhoto',
  video: 'IconVideo',
  audio: 'IconMusic',
  document: 'IconFileText',
  archive: 'IconFileZip',
  code: 'IconFileCode',
  font: 'IconTypography',
  database: 'IconDatabase',
  executable: 'IconBinary',
  other: 'IconFile',
};

/**
 * Fallback icons for specific file types
 */
export const FILE_TYPE_ICONS: Record<string, string> = {
  // Documents
  'pdf': 'IconFileTypePdf',
  'doc': 'IconFileTypeDoc',
  'docx': 'IconFileTypeDoc',
  'xls': 'IconFileTypeXls',
  'xlsx': 'IconFileTypeXls',
  'ppt': 'IconFileTypePpt',
  'pptx': 'IconFileTypePpt',

  // Code
  'js': 'IconBrandJavascript',
  'jsx': 'IconBrandJavascript',
  'ts': 'IconBrandTypescript',
  'tsx': 'IconBrandTypescript',
  'html': 'IconBrandHtml5',
  'css': 'IconBrandCss3',
  'py': 'IconBrandPython',

  // Archives
  'zip': 'IconFileZip',

  // Special
  'processing': 'IconLoader',
  'error': 'IconAlertCircle',
};

/**
 * Thumbnail size mappings (in pixels)
 */
export const THUMBNAIL_SIZES: Record<ThumbnailSize, { width: number; height: number }> = {
  xs: { width: 64, height: 64 },
  sm: { width: 128, height: 128 },
  md: { width: 256, height: 256 },
  lg: { width: 512, height: 512 },
  xl: { width: 1024, height: 1024 },
};

/**
 * Maximum file size limits by category (in MB)
 */
export const MAX_FILE_SIZES: Record<FileCategory | 'default', number> = {
  image: 10,
  video: 500,
  audio: 50,
  document: 50,
  archive: 100,
  code: 5,
  font: 5,
  database: 100,
  executable: 100,
  other: 50,
  default: 50,
};

/**
 * Allowed preview types
 */
export const PREVIEWABLE_TYPES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
  video: ['mp4', 'webm', 'ogv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
  document: ['pdf', 'txt'],
  code: ['js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'css', 'py', 'java', 'php', 'rb', 'go'],
};

// =====================================================
// 1. File Type Detection
// =====================================================

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Get filename without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase();
  return MIME_TYPE_MAP[ext] || 'application/octet-stream';
}

/**
 * Get MIME type from filename
 */
export function getMimeTypeFromFilename(filename: string): string {
  const extension = getFileExtension(filename);
  return getMimeTypeFromExtension(extension);
}

/**
 * Get file category from MIME type
 */
export function getCategoryFromMimeType(mimeType: string): FileCategory {
  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('font/')) return 'font';

  if (type.includes('pdf') ||
      type.includes('word') ||
      type.includes('excel') ||
      type.includes('powerpoint') ||
      type.includes('document') ||
      type.includes('opendocument') ||
      type === 'text/plain' ||
      type === 'text/csv') {
    return 'document';
  }

  if (type.includes('zip') ||
      type.includes('rar') ||
      type.includes('7z') ||
      type.includes('tar') ||
      type.includes('gzip') ||
      type.includes('compressed')) {
    return 'archive';
  }

  if (type.includes('javascript') ||
      type.includes('typescript') ||
      type.includes('json') ||
      type.includes('xml') ||
      type.includes('html') ||
      type.includes('css') ||
      type === 'text/x-python' ||
      type === 'text/x-java') {
    return 'code';
  }

  if (type.includes('database') || type.includes('sqlite') || type.includes('sql')) {
    return 'database';
  }

  if (type.includes('executable') ||
      type.includes('msdownload') ||
      type.includes('x-deb') ||
      type.includes('x-rpm')) {
    return 'executable';
  }

  return 'other';
}

/**
 * Get file category from extension
 */
export function getCategoryFromExtension(extension: string): FileCategory {
  const ext = extension.toLowerCase();
  return EXTENSION_CATEGORY_MAP[ext] || 'other';
}

/**
 * Get file category from filename
 */
export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  // Try extension first (more reliable)
  const extension = getFileExtension(filename);
  const categoryFromExt = getCategoryFromExtension(extension);

  if (categoryFromExt !== 'other') {
    return categoryFromExt;
  }

  // Fallback to MIME type
  if (mimeType) {
    return getCategoryFromMimeType(mimeType);
  }

  return 'other';
}

/**
 * Type checking utilities
 */
export function isImageFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'image';
}

export function isVideoFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'video';
}

export function isAudioFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'audio';
}

export function isDocumentFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'document';
}

export function isArchiveFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'archive';
}

export function isCodeFile(filename: string, mimeType?: string): boolean {
  return getFileCategory(filename, mimeType) === 'code';
}

export function isPdfFile(filename: string, mimeType?: string): boolean {
  if (mimeType) {
    return mimeType.toLowerCase().includes('pdf');
  }
  return getFileExtension(filename) === 'pdf';
}

// =====================================================
// 2. Thumbnail Generation Utilities
// =====================================================

/**
 * Generate thumbnail URL for an image
 */
export function generateImageThumbnailUrl(
  fileId: string,
  options: ThumbnailOptions = {},
  baseUrl: string = '/api'
): string {
  const { size = 'md', quality = 80, format = 'jpeg' } = options;
  const dimensions = THUMBNAIL_SIZES[size];

  const params = new URLSearchParams({
    width: dimensions.width.toString(),
    height: dimensions.height.toString(),
    quality: quality.toString(),
    format,
  });

  return `${baseUrl}/files/${fileId}/thumbnail?${params.toString()}`;
}

/**
 * Generate thumbnail URL for a video (extracts first frame)
 */
export function generateVideoThumbnailUrl(
  fileId: string,
  options: ThumbnailOptions & { timestamp?: number } = {},
  baseUrl: string = '/api'
): string {
  const { size = 'md', quality = 80, timestamp = 0 } = options;
  const dimensions = THUMBNAIL_SIZES[size];

  const params = new URLSearchParams({
    width: dimensions.width.toString(),
    height: dimensions.height.toString(),
    quality: quality.toString(),
    timestamp: timestamp.toString(),
  });

  return `${baseUrl}/files/${fileId}/video-thumbnail?${params.toString()}`;
}

/**
 * Generate thumbnail URL for a PDF (first page)
 */
export function generatePdfThumbnailUrl(
  fileId: string,
  options: ThumbnailOptions & { page?: number } = {},
  baseUrl: string = '/api'
): string {
  const { size = 'md', quality = 80, page = 1 } = options;
  const dimensions = THUMBNAIL_SIZES[size];

  const params = new URLSearchParams({
    width: dimensions.width.toString(),
    height: dimensions.height.toString(),
    quality: quality.toString(),
    page: page.toString(),
  });

  return `${baseUrl}/files/${fileId}/pdf-thumbnail?${params.toString()}`;
}

/**
 * Get fallback icon for file type
 */
export function getFallbackIcon(filename: string, mimeType?: string): string {
  const extension = getFileExtension(filename);

  // Check specific file type icons
  if (FILE_TYPE_ICONS[extension]) {
    return FILE_TYPE_ICONS[extension];
  }

  // Check category icons
  const category = getFileCategory(filename, mimeType);
  return CATEGORY_ICON_MAP[category];
}

/**
 * Get thumbnail URL with fallback to icon
 */
export function getThumbnailUrlOrFallback(
  fileId: string,
  filename: string,
  mimeType?: string,
  options: ThumbnailOptions = {},
  baseUrl: string = '/api'
): { type: 'url' | 'icon'; value: string } {
  const extension = getFileExtension(filename);

  // Check if file type supports thumbnails
  if (PREVIEWABLE_TYPES.image.includes(extension)) {
    return {
      type: 'url',
      value: generateImageThumbnailUrl(fileId, options, baseUrl),
    };
  }

  if (PREVIEWABLE_TYPES.video.includes(extension)) {
    return {
      type: 'url',
      value: generateVideoThumbnailUrl(fileId, options, baseUrl),
    };
  }

  if (extension === 'pdf') {
    return {
      type: 'url',
      value: generatePdfThumbnailUrl(fileId, options, baseUrl),
    };
  }

  // Return icon fallback
  return {
    type: 'icon',
    value: options.fallbackIcon || getFallbackIcon(filename, mimeType),
  };
}

// =====================================================
// 3. File Handling Utilities
// =====================================================

/**
 * Download file helper (browser only)
 */
export function downloadFile(
  url: string,
  filename: string,
  options: DownloadOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const link = document.createElement('a');
      link.href = url;

      if (!options.inline) {
        link.download = options.filename || filename;
      }

      // Add custom headers if needed (via fetch)
      if (options.headers) {
        fetch(url, { headers: options.headers })
          .then(response => response.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            resolve();
          })
          .catch(reject);
      } else {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Format file size (English)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(2)} ${sizes[i]}`;
}

/**
 * Format file size (Brazilian Portuguese)
 */
export function formatFileSizeBrazilian(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Use Brazilian number formatting (comma as decimal separator)
  const formattedValue = value.toFixed(2).replace('.', ',');
  return `${formattedValue} ${sizes[i]}`;
}

/**
 * Format file size (compact)
 */
export function formatFileSizeCompact(bytes: number): string {
  if (bytes === 0) return '0B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(1)}${sizes[i]}`;
}

/**
 * Truncate filename with extension preservation
 */
export function truncateFilename(filename: string, maxLength: number = 50): string {
  if (filename.length <= maxLength) return filename;

  const extension = getFileExtension(filename);
  const nameWithoutExt = getFileNameWithoutExtension(filename);

  const ellipsis = '...';
  const availableLength = maxLength - ellipsis.length - (extension ? extension.length + 1 : 0);

  if (availableLength <= 0) {
    return filename.substring(0, maxLength);
  }

  const truncatedName = nameWithoutExt.substring(0, availableLength);
  return extension ? `${truncatedName}${ellipsis}.${extension}` : `${truncatedName}${ellipsis}`;
}

/**
 * Generate URL for file download
 */
export function generateDownloadUrl(
  fileId: string,
  filename?: string,
  baseUrl: string = '/api'
): string {
  const downloadUrl = `${baseUrl}/files/${fileId}/download`;
  return filename ? `${downloadUrl}?filename=${encodeURIComponent(filename)}` : downloadUrl;
}

/**
 * Generate URL for file preview
 */
export function generatePreviewUrl(
  fileId: string,
  baseUrl: string = '/api'
): string {
  return `${baseUrl}/files/${fileId}/preview`;
}

/**
 * Generate URL for file serving (direct access)
 */
export function generateFileUrl(
  fileId: string,
  baseUrl: string = '/api'
): string {
  return `${baseUrl}/files/${fileId}`;
}

/**
 * Generate URL based on storage type
 */
export function generateStorageUrl(
  fileId: string,
  filename: string,
  options: StorageUrlOptions
): string {
  const { storageType, baseUrl = '/api', bucket, path, expiresIn } = options;

  switch (storageType) {
    case 'local':
      return generateFileUrl(fileId, baseUrl);

    case 's3':
      // S3 presigned URL (would need backend support)
      const s3Params = new URLSearchParams({
        bucket: bucket || 'default',
        key: `${path || ''}/${fileId}/${filename}`,
        ...(expiresIn && { expiresIn: expiresIn.toString() }),
      });
      return `${baseUrl}/files/s3?${s3Params.toString()}`;

    case 'remote':
      return `${baseUrl}/files/remote/${fileId}/${encodeURIComponent(filename)}`;

    case 'azure':
      const azureParams = new URLSearchParams({
        container: bucket || 'default',
        blob: `${path || ''}/${fileId}/${filename}`,
        ...(expiresIn && { expiresIn: expiresIn.toString() }),
      });
      return `${baseUrl}/files/azure?${azureParams.toString()}`;

    case 'gcs':
      const gcsParams = new URLSearchParams({
        bucket: bucket || 'default',
        object: `${path || ''}/${fileId}/${filename}`,
        ...(expiresIn && { expiresIn: expiresIn.toString() }),
      });
      return `${baseUrl}/files/gcs?${gcsParams.toString()}`;

    default:
      return generateFileUrl(fileId, baseUrl);
  }
}

// =====================================================
// 4. Validation Utilities
// =====================================================

/**
 * Validate file size
 */
export function validateFileSize(
  sizeInBytes: number,
  constraints: {
    maxSizeInMB?: number;
    minSizeInBytes?: number;
    useBrazilianFormat?: boolean;
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSizeInMB = 100,
    minSizeInBytes = 1,
    useBrazilianFormat = true
  } = constraints;

  if (sizeInBytes < minSizeInBytes) {
    const minSizeFormatted = useBrazilianFormat
      ? formatFileSizeBrazilian(minSizeInBytes)
      : formatFileSize(minSizeInBytes);

    return {
      valid: false,
      error: `Arquivo muito pequeno. Tamanho mínimo: ${minSizeFormatted}`,
    };
  }

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  if (sizeInBytes > maxSizeInBytes) {
    const maxSizeFormatted = useBrazilianFormat
      ? formatFileSizeBrazilian(maxSizeInBytes)
      : formatFileSize(maxSizeInBytes);

    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxSizeFormatted}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file type
 */
export function validateFileType(
  filename: string,
  mimeType: string,
  allowedTypes: {
    extensions?: string[];
    mimeTypes?: string[];
    categories?: FileCategory[];
  }
): { valid: boolean; error?: string } {
  const extension = getFileExtension(filename);
  const category = getFileCategory(filename, mimeType);

  // Check extensions
  if (allowedTypes.extensions && allowedTypes.extensions.length > 0) {
    if (!allowedTypes.extensions.includes(extension)) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido. Extensões aceitas: ${allowedTypes.extensions.join(', ')}`,
      };
    }
  }

  // Check MIME types
  if (allowedTypes.mimeTypes && allowedTypes.mimeTypes.length > 0) {
    const isAllowed = allowedTypes.mimeTypes.some(allowed =>
      mimeType.toLowerCase().includes(allowed.toLowerCase())
    );

    if (!isAllowed) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.mimeTypes.join(', ')}`,
      };
    }
  }

  // Check categories
  if (allowedTypes.categories && allowedTypes.categories.length > 0) {
    if (!allowedTypes.categories.includes(category)) {
      return {
        valid: false,
        error: `Categoria de arquivo não permitida. Categorias aceitas: ${allowedTypes.categories.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Security check for dangerous file types
 */
export function checkFilenameSecurity(filename: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    issues.push('Nome de arquivo contém caracteres de navegação de diretório');
  }

  // Check for dangerous extensions
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'ps1', 'psm1', 'sh', 'bash', 'zsh'
  ];
  const extension = getFileExtension(filename);
  if (dangerousExtensions.includes(extension)) {
    issues.push('Extensão de arquivo potencialmente perigosa');
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    issues.push('Nome de arquivo contém bytes nulos');
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(filename)) {
    issues.push('Nome de arquivo contém caracteres de controle');
  }

  // Check length
  if (filename.length > 255) {
    issues.push('Nome de arquivo muito longo (máximo 255 caracteres)');
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(
  filename: string,
  options: {
    removeSpaces?: boolean;
    preserveCase?: boolean;
    maxLength?: number;
    allowUnicode?: boolean;
    replacement?: string;
  } = {}
): string {
  const {
    removeSpaces = true,
    preserveCase = false,
    maxLength = 255,
    allowUnicode = true,
    replacement = '_',
  } = options;

  let sanitized = filename.trim();

  // Remove or replace dangerous characters
  if (allowUnicode) {
    // Allow Unicode but remove dangerous ones for file systems
    sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, replacement);
  } else {
    // Only allow ASCII alphanumeric, dots, hyphens, and underscores
    sanitized = sanitized.replace(/[^\w\s.-]/gi, replacement);
  }

  // Handle spaces
  if (removeSpaces) {
    sanitized = sanitized.replace(/\s+/g, replacement);
  } else {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  // Remove multiple consecutive separators
  const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const multipleReplacementRegex = new RegExp(`${escapedReplacement}{2,}`, 'g');
  sanitized = sanitized
    .replace(multipleReplacementRegex, replacement)
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.');

  // Remove leading/trailing separators
  const leadingTrailingRegex = new RegExp(`^[${escapedReplacement}.-]+|[${escapedReplacement}.-]+$`, 'g');
  sanitized = sanitized.replace(leadingTrailingRegex, '');

  // Handle case
  if (!preserveCase) {
    sanitized = sanitized.toLowerCase();
  }

  // Truncate if necessary while preserving extension
  if (sanitized.length > maxLength) {
    const extension = getFileExtension(sanitized);
    if (extension) {
      const nameWithoutExt = getFileNameWithoutExtension(sanitized);
      const maxNameLength = maxLength - extension.length - 1;

      if (maxNameLength > 0) {
        sanitized = `${nameWithoutExt.substring(0, maxNameLength)}.${extension}`;
      } else {
        sanitized = sanitized.substring(0, maxLength);
      }
    } else {
      sanitized = sanitized.substring(0, maxLength);
    }
  }

  return sanitized || 'arquivo';
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  file: File,
  constraints: FileValidationConstraints = {}
): ValidationResult {
  const errors: string[] = [];

  // Security check
  const securityCheck = checkFilenameSecurity(file.name);
  if (!securityCheck.safe) {
    errors.push(...securityCheck.issues);
  }

  // Size validation
  const sizeValidation = validateFileSize(file.size, constraints);
  if (!sizeValidation.valid && sizeValidation.error) {
    errors.push(sizeValidation.error);
  }

  // Type validation
  const typeValidation = validateFileType(file.name, file.type, {
    extensions: constraints.allowedExtensions,
    mimeTypes: constraints.allowedMimeTypes,
    categories: constraints.allowedCategories,
  });
  if (!typeValidation.valid && typeValidation.error) {
    errors.push(typeValidation.error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =====================================================
// 5. Preview Utilities
// =====================================================

/**
 * Check if file can be previewed
 */
export function canPreview(filename: string, _mimeType?: string): boolean {
  const extension = getFileExtension(filename);

  // Check if extension is in previewable types
  for (const [_cat, extensions] of Object.entries(PREVIEWABLE_TYPES)) {
    if (extensions.includes(extension)) {
      return true;
    }
  }

  return false;
}

/**
 * Get preview type
 */
export function getPreviewType(
  filename: string,
  _mimeType?: string
): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'none' {
  const extension = getFileExtension(filename);

  if (PREVIEWABLE_TYPES.image.includes(extension)) return 'image';
  if (PREVIEWABLE_TYPES.video.includes(extension)) return 'video';
  if (PREVIEWABLE_TYPES.audio.includes(extension)) return 'audio';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'txt') return 'text';
  if (PREVIEWABLE_TYPES.code.includes(extension)) return 'code';

  return 'none';
}

/**
 * Generate preview URL with fallback
 */
export function getPreviewUrlWithFallback(
  fileId: string,
  filename: string,
  mimeType?: string,
  baseUrl: string = '/api'
): { canPreview: boolean; previewUrl?: string; previewType?: string } {
  if (!canPreview(filename, mimeType)) {
    return { canPreview: false };
  }

  const previewType = getPreviewType(filename, mimeType);

  return {
    canPreview: true,
    previewUrl: generatePreviewUrl(fileId, baseUrl),
    previewType,
  };
}

// =====================================================
// 6. File Metadata Utilities
// =====================================================

/**
 * Get comprehensive file metadata
 */
export function getFileMetadata(file: File): FileMetadata {
  const extension = getFileExtension(file.name);
  const category = getFileCategory(file.name, file.type);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    category,
    extension,
    lastModified: new Date(file.lastModified),
    isImage: isImageFile(file.name, file.type),
    isPdf: isPdfFile(file.name, file.type),
    isVideo: isVideoFile(file.name, file.type),
    isAudio: isAudioFile(file.name, file.type),
    isDocument: isDocumentFile(file.name, file.type),
    isArchive: isArchiveFile(file.name, file.type),
    formattedSize: formatFileSize(file.size),
    formattedSizeBrazilian: formatFileSizeBrazilian(file.size),
  };
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(
  originalFilename: string,
  existingFilenames: string[] = [],
  options: {
    preserveExtension?: boolean;
    separator?: string;
    maxLength?: number;
  } = {}
): string {
  const { preserveExtension = true, separator = '_', maxLength = 255 } = options;

  const extension = preserveExtension ? getFileExtension(originalFilename) : '';
  const nameWithoutExt = preserveExtension && extension
    ? getFileNameWithoutExtension(originalFilename)
    : originalFilename;

  let uniqueName = originalFilename;
  let counter = 1;

  while (existingFilenames.includes(uniqueName)) {
    const suffix = `${separator}${counter}`;

    if (preserveExtension && extension) {
      uniqueName = `${nameWithoutExt}${suffix}.${extension}`;
    } else {
      uniqueName = `${nameWithoutExt}${suffix}`;
    }

    // Check if name exceeds max length
    if (uniqueName.length > maxLength) {
      const maxNameLength = maxLength - suffix.length - (extension ? extension.length + 1 : 0);
      const truncatedName = nameWithoutExt.substring(0, maxNameLength);

      if (preserveExtension && extension) {
        uniqueName = `${truncatedName}${suffix}.${extension}`;
      } else {
        uniqueName = `${truncatedName}${suffix}`;
      }
    }

    counter++;
  }

  return uniqueName;
}

/**
 * Create file hash (SHA-256)
 */
export async function createFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate upload ID
 */
export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// =====================================================
// Exports
// =====================================================

export const fileUtilities = {
  // Type Detection
  getFileExtension,
  getFileNameWithoutExtension,
  getMimeTypeFromExtension,
  getMimeTypeFromFilename,
  getCategoryFromMimeType,
  getCategoryFromExtension,
  getFileCategory,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDocumentFile,
  isArchiveFile,
  isCodeFile,
  isPdfFile,

  // Thumbnail Generation
  generateImageThumbnailUrl,
  generateVideoThumbnailUrl,
  generatePdfThumbnailUrl,
  getFallbackIcon,
  getThumbnailUrlOrFallback,

  // File Handling
  downloadFile,
  formatFileSize,
  formatFileSizeBrazilian,
  formatFileSizeCompact,
  truncateFilename,
  generateDownloadUrl,
  generatePreviewUrl,
  generateFileUrl,
  generateStorageUrl,

  // Validation
  validateFileSize,
  validateFileType,
  checkFilenameSecurity,
  sanitizeFilename,
  validateFile,

  // Preview
  canPreview,
  getPreviewType,
  getPreviewUrlWithFallback,

  // Metadata
  getFileMetadata,
  generateUniqueFilename,
  createFileHash,
  generateUploadId,

  // Constants
  MIME_TYPE_MAP,
  EXTENSION_CATEGORY_MAP,
  CATEGORY_ICON_MAP,
  FILE_TYPE_ICONS,
  THUMBNAIL_SIZES,
  MAX_FILE_SIZES,
  PREVIEWABLE_TYPES,
};

export default fileUtilities;
