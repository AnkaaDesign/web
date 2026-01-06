/**
 * Library Index
 *
 * Central export point for all library utilities
 */

// Export all file utilities
export * from './file-utilities';
export { default as fileUtilities } from './file-utilities';

// Re-export types for convenience
export type {
  FileCategory,
  FileMetadata,
  ValidationResult,
  FileValidationConstraints,
  ThumbnailOptions,
  DownloadOptions,
  StorageUrlOptions,
  ThumbnailSize,
  PreviewType,
  StorageType,
} from './file-utilities';

// Export push notification utilities
export * from './push-notifications';
export * from './firebase';
export * from './register-service-worker';
