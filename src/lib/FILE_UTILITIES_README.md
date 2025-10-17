# File Utilities Module

A comprehensive, production-ready file handling utility library for TypeScript/JavaScript applications.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [API Reference](#api-reference)
  - [File Type Detection](#file-type-detection)
  - [Thumbnail Generation](#thumbnail-generation)
  - [File Handling](#file-handling)
  - [Validation](#validation)
  - [Preview Utilities](#preview-utilities)
  - [Metadata](#metadata)
- [Usage Examples](#usage-examples)
- [Type Definitions](#type-definitions)
- [Constants](#constants)

## Installation

```typescript
import { fileUtilities } from '@/lib/file-utilities';
// or import individual functions
import {
  getFileCategory,
  formatFileSizeBrazilian,
  validateFile
} from '@/lib/file-utilities';
```

## Quick Start

```typescript
// Get file metadata
const metadata = fileUtilities.getFileMetadata(file);
console.log(metadata.category); // 'image', 'video', 'document', etc.
console.log(metadata.formattedSizeBrazilian); // '2,5 MB'

// Validate file
const validation = fileUtilities.validateFile(file, {
  maxSizeInMB: 10,
  allowedCategories: ['image', 'document'],
  allowedExtensions: ['jpg', 'png', 'pdf']
});

if (!validation.valid) {
  console.error(validation.errors);
}

// Generate thumbnail URL
const thumbnail = fileUtilities.generateImageThumbnailUrl(
  fileId,
  { size: 'md', quality: 85 }
);

// Download file
await fileUtilities.downloadFile(fileUrl, 'document.pdf');
```

## Features

### 1. File Type Detection

- **MIME type detection** - 100+ file type mappings
- **Extension mapping** - Automatic MIME type from extension
- **Category classification** - Smart categorization into:
  - Images (photos, vectors, icons, raw)
  - Videos (standard, HD, web formats)
  - Audio (music, podcasts, raw)
  - Documents (PDF, Office, text)
  - Archives (ZIP, RAR, 7z, etc.)
  - Code (JavaScript, TypeScript, Python, etc.)
  - Fonts (TTF, OTF, WOFF)
  - Databases (SQLite, SQL)
  - Executables

### 2. Thumbnail Generation

- **Image thumbnails** - Configurable size and quality
- **Video thumbnails** - Extract frames at specific timestamps
- **PDF previews** - Generate thumbnails from PDF pages
- **Fallback icons** - Tabler Icons fallbacks for non-previewable types
- **Multiple sizes** - xs, sm, md, lg, xl (64px to 1024px)

### 3. File Handling

- **Download helper** - Browser-compatible file downloads
- **Size formatting** - English and Brazilian Portuguese formats
- **Filename truncation** - Smart truncation preserving extensions
- **URL generation** - Support for multiple storage types:
  - Local storage
  - AWS S3
  - WebDAV
  - Azure Blob Storage
  - Google Cloud Storage

### 4. Validation

- **Size limits** - Configurable min/max sizes
- **Type validation** - Extension, MIME type, and category checks
- **Security checks** - Path traversal, dangerous extensions, null bytes
- **Filename sanitization** - Remove dangerous characters
- **Comprehensive validation** - All-in-one file validation

### 5. Preview Utilities

- **Preview detection** - Check if file can be previewed
- **Preview type** - Determine preview method (image, video, PDF, etc.)
- **Preview URLs** - Generate preview URLs with fallbacks

## API Reference

### File Type Detection

#### `getFileExtension(filename: string): string`
Extract file extension from filename.

```typescript
const ext = getFileExtension('document.pdf'); // 'pdf'
```

#### `getMimeTypeFromFilename(filename: string): string`
Get MIME type from filename.

```typescript
const mime = getMimeTypeFromFilename('photo.jpg'); // 'image/jpeg'
```

#### `getFileCategory(filename: string, mimeType?: string): FileCategory`
Determine file category.

```typescript
const category = getFileCategory('video.mp4'); // 'video'
```

#### Type Checkers

```typescript
isImageFile(filename: string, mimeType?: string): boolean
isVideoFile(filename: string, mimeType?: string): boolean
isAudioFile(filename: string, mimeType?: string): boolean
isDocumentFile(filename: string, mimeType?: string): boolean
isArchiveFile(filename: string, mimeType?: string): boolean
isCodeFile(filename: string, mimeType?: string): boolean
isPdfFile(filename: string, mimeType?: string): boolean
```

### Thumbnail Generation

#### `generateImageThumbnailUrl(fileId, options?, baseUrl?): string`
Generate thumbnail URL for images.

```typescript
const url = generateImageThumbnailUrl('file-123', {
  size: 'md',      // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  quality: 85,     // 0-100
  format: 'jpeg'   // 'jpeg' | 'png' | 'webp'
});
```

#### `generateVideoThumbnailUrl(fileId, options?, baseUrl?): string`
Extract thumbnail from video.

```typescript
const url = generateVideoThumbnailUrl('video-123', {
  size: 'lg',
  timestamp: 5000  // milliseconds
});
```

#### `generatePdfThumbnailUrl(fileId, options?, baseUrl?): string`
Generate PDF page thumbnail.

```typescript
const url = generatePdfThumbnailUrl('pdf-123', {
  size: 'md',
  page: 1  // page number
});
```

#### `getThumbnailUrlOrFallback(fileId, filename, mimeType?, options?, baseUrl?)`
Get thumbnail URL or fallback icon.

```typescript
const result = getThumbnailUrlOrFallback('file-123', 'document.pdf');
// { type: 'url' | 'icon', value: string }

if (result.type === 'url') {
  <img src={result.value} />
} else {
  <Icon name={result.value} />
}
```

### File Handling

#### `formatFileSize(bytes: number): string`
Format size in English.

```typescript
formatFileSize(1536000); // '1.46 MB'
```

#### `formatFileSizeBrazilian(bytes: number): string`
Format size in Brazilian Portuguese.

```typescript
formatFileSizeBrazilian(1536000); // '1,46 MB'
```

#### `formatFileSizeCompact(bytes: number): string`
Compact format.

```typescript
formatFileSizeCompact(1536000); // '1.5MB'
```

#### `truncateFilename(filename: string, maxLength?: number): string`
Truncate filename preserving extension.

```typescript
truncateFilename('very-long-document-name.pdf', 20);
// 'very-long-do....pdf'
```

#### `downloadFile(url: string, filename: string, options?): Promise<void>`
Download file in browser.

```typescript
await downloadFile(
  'https://example.com/file.pdf',
  'document.pdf',
  { inline: false }
);
```

#### `generateDownloadUrl(fileId, filename?, baseUrl?): string`
Generate download URL.

```typescript
const url = generateDownloadUrl('file-123', 'report.pdf');
// '/api/files/file-123/download?filename=report.pdf'
```

#### `generateStorageUrl(fileId, filename, options): string`
Generate URL for different storage types.

```typescript
const url = generateStorageUrl('file-123', 'photo.jpg', {
  storageType: 's3',
  bucket: 'my-bucket',
  path: 'uploads',
  expiresIn: 3600
});
```

### Validation

#### `validateFileSize(sizeInBytes, constraints?): { valid: boolean; error?: string }`
Validate file size.

```typescript
const result = validateFileSize(5000000, {
  maxSizeInMB: 10,
  minSizeInBytes: 1,
  useBrazilianFormat: true
});

if (!result.valid) {
  console.error(result.error);
}
```

#### `validateFileType(filename, mimeType, allowedTypes): { valid: boolean; error?: string }`
Validate file type.

```typescript
const result = validateFileType('document.pdf', 'application/pdf', {
  extensions: ['pdf', 'doc', 'docx'],
  mimeTypes: ['application/pdf'],
  categories: ['document']
});
```

#### `checkFilenameSecurity(filename): { safe: boolean; issues: string[] }`
Check filename for security issues.

```typescript
const check = checkFilenameSecurity('../../../etc/passwd');
// { safe: false, issues: ['Nome de arquivo contém caracteres de navegação de diretório'] }
```

#### `sanitizeFilename(filename, options?): string`
Sanitize filename.

```typescript
const safe = sanitizeFilename('My Document!@#$.pdf', {
  removeSpaces: true,
  preserveCase: false,
  maxLength: 255,
  allowUnicode: true,
  replacement: '_'
});
// 'my_document_.pdf'
```

#### `validateFile(file, constraints?): ValidationResult`
Comprehensive file validation.

```typescript
const result = validateFile(file, {
  maxSizeInMB: 10,
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedCategories: ['image', 'document'],
  useBrazilianFormat: true
});

if (!result.valid) {
  result.errors.forEach(error => console.error(error));
}
```

### Preview Utilities

#### `canPreview(filename, mimeType?): boolean`
Check if file can be previewed.

```typescript
const previewable = canPreview('document.pdf'); // true
```

#### `getPreviewType(filename, mimeType?): PreviewType`
Get preview type.

```typescript
const type = getPreviewType('video.mp4');
// 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'none'
```

#### `getPreviewUrlWithFallback(fileId, filename, mimeType?, baseUrl?)`
Get preview URL with fallback.

```typescript
const preview = getPreviewUrlWithFallback('file-123', 'report.pdf');
// { canPreview: true, previewUrl: '/api/files/file-123/preview', previewType: 'pdf' }
```

### Metadata

#### `getFileMetadata(file: File): FileMetadata`
Get comprehensive file metadata.

```typescript
const metadata = getFileMetadata(file);
/*
{
  name: 'photo.jpg',
  size: 1536000,
  type: 'image/jpeg',
  category: 'image',
  extension: 'jpg',
  lastModified: Date,
  isImage: true,
  isPdf: false,
  isVideo: false,
  isAudio: false,
  isDocument: false,
  isArchive: false,
  formattedSize: '1.46 MB',
  formattedSizeBrazilian: '1,46 MB'
}
*/
```

#### `generateUniqueFilename(originalFilename, existingFilenames?, options?): string`
Generate unique filename avoiding collisions.

```typescript
const unique = generateUniqueFilename('document.pdf', ['document.pdf', 'document_1.pdf']);
// 'document_2.pdf'
```

#### `createFileHash(file: File): Promise<string>`
Create SHA-256 hash of file.

```typescript
const hash = await createFileHash(file);
// 'a3c5f8d9e2b1...'
```

#### `generateUploadId(): string`
Generate unique upload ID.

```typescript
const uploadId = generateUploadId();
// 'upload_1634567890123_x7k9m2p4'
```

## Usage Examples

### Example 1: File Upload with Validation

```typescript
import { fileUtilities } from '@/lib/file-utilities';

function handleFileUpload(file: File) {
  // Validate file
  const validation = fileUtilities.validateFile(file, {
    maxSizeInMB: 10,
    allowedCategories: ['image', 'document'],
    allowedExtensions: ['jpg', 'png', 'pdf', 'docx']
  });

  if (!validation.valid) {
    alert(validation.errors.join('\n'));
    return;
  }

  // Get metadata
  const metadata = fileUtilities.getFileMetadata(file);
  console.log(`Uploading ${metadata.name} (${metadata.formattedSizeBrazilian})`);

  // Generate unique filename
  const uniqueName = fileUtilities.generateUniqueFilename(
    file.name,
    existingFiles.map(f => f.name)
  );

  // Upload file...
}
```

### Example 2: File Gallery with Thumbnails

```typescript
import { fileUtilities } from '@/lib/file-utilities';

function FileGallery({ files }: { files: Array<{ id: string; name: string; type: string }> }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map(file => {
        const thumbnail = fileUtilities.getThumbnailUrlOrFallback(
          file.id,
          file.name,
          file.type,
          { size: 'md' }
        );

        return (
          <div key={file.id}>
            {thumbnail.type === 'url' ? (
              <img src={thumbnail.value} alt={file.name} />
            ) : (
              <Icon name={thumbnail.value} size={64} />
            )}
            <p>{fileUtilities.truncateFilename(file.name, 20)}</p>
          </div>
        );
      })}
    </div>
  );
}
```

### Example 3: File Preview Modal

```typescript
import { fileUtilities } from '@/lib/file-utilities';

function FilePreview({ fileId, filename, mimeType }: Props) {
  const preview = fileUtilities.getPreviewUrlWithFallback(
    fileId,
    filename,
    mimeType
  );

  if (!preview.canPreview) {
    return <div>Preview not available</div>;
  }

  switch (preview.previewType) {
    case 'image':
      return <img src={preview.previewUrl} alt={filename} />;

    case 'video':
      return <video src={preview.previewUrl} controls />;

    case 'audio':
      return <audio src={preview.previewUrl} controls />;

    case 'pdf':
      return <iframe src={preview.previewUrl} />;

    case 'code':
      return <CodeViewer url={preview.previewUrl} />;

    default:
      return <div>Unknown preview type</div>;
  }
}
```

### Example 4: Bulk File Download

```typescript
import { fileUtilities } from '@/lib/file-utilities';

async function downloadFiles(files: Array<{ id: string; name: string }>) {
  for (const file of files) {
    const url = fileUtilities.generateDownloadUrl(file.id, file.name);

    try {
      await fileUtilities.downloadFile(url, file.name);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
    } catch (error) {
      console.error(`Failed to download ${file.name}:`, error);
    }
  }
}
```

### Example 5: File Sanitization

```typescript
import { fileUtilities } from '@/lib/file-utilities';

function sanitizeUserUpload(file: File): File | null {
  // Check security
  const security = fileUtilities.checkFilenameSecurity(file.name);

  if (!security.safe) {
    console.error('Security issues:', security.issues);
    return null;
  }

  // Sanitize filename
  const safeName = fileUtilities.sanitizeFilename(file.name, {
    removeSpaces: true,
    preserveCase: false,
    allowUnicode: false
  });

  // Create new file with safe name
  return new File([file], safeName, { type: file.type });
}
```

## Type Definitions

```typescript
type FileCategory =
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

type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface FileMetadata {
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

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface FileValidationConstraints {
  maxSizeInMB?: number;
  minSizeInBytes?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  allowedCategories?: FileCategory[];
  useBrazilianFormat?: boolean;
}
```

## Constants

### MIME_TYPE_MAP
Complete mapping of file extensions to MIME types (100+ types).

### EXTENSION_CATEGORY_MAP
Mapping of file extensions to categories.

### CATEGORY_ICON_MAP
Tabler Icon names for each category.

### FILE_TYPE_ICONS
Specific icons for common file types.

### THUMBNAIL_SIZES
Size mappings for thumbnails (xs to xl).

### MAX_FILE_SIZES
Recommended maximum file sizes by category.

### PREVIEWABLE_TYPES
List of file types that support preview.

## Best Practices

1. **Always validate files** before upload
2. **Sanitize filenames** from user input
3. **Use Brazilian formatting** for user-facing sizes
4. **Implement security checks** for dangerous file types
5. **Generate unique filenames** to avoid collisions
6. **Use thumbnails** for better UX with images/videos
7. **Check preview capability** before showing preview UI
8. **Handle validation errors** gracefully

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `crypto.subtle` API for file hashing
- Download functionality requires DOM API

## License

MIT
