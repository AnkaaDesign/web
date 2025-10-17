# File Utilities - Quick Reference

## 🚀 Quick Start

```typescript
import { fileUtilities } from '@/lib/file-utilities';
```

## 📋 Common Use Cases

### 1. Validate File Before Upload

```typescript
const validation = fileUtilities.validateFile(file, {
  maxSizeInMB: 10,
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedCategories: ['image', 'document']
});

if (!validation.valid) {
  alert(validation.errors.join('\n'));
}
```

### 2. Get File Information

```typescript
const metadata = fileUtilities.getFileMetadata(file);
console.log(metadata.formattedSizeBrazilian); // "2,5 MB"
console.log(metadata.category); // "image"
console.log(metadata.isImage); // true
```

### 3. Generate Thumbnail

```typescript
const thumbnail = fileUtilities.getThumbnailUrlOrFallback(
  fileId,
  filename,
  mimeType,
  { size: 'md', quality: 85 }
);

if (thumbnail.type === 'url') {
  <img src={thumbnail.value} />
} else {
  <Icon name={thumbnail.value} />
}
```

### 4. Download File

```typescript
const url = fileUtilities.generateDownloadUrl(fileId, filename);
await fileUtilities.downloadFile(url, filename);
```

### 5. Sanitize Filename

```typescript
const safe = fileUtilities.sanitizeFilename(userFilename, {
  removeSpaces: true,
  preserveCase: false,
  allowUnicode: false
});
```

## 🎯 Function Categories

### File Type Detection
- `getFileExtension(filename)`
- `getFileCategory(filename, mimeType?)`
- `isImageFile(filename, mimeType?)`
- `isVideoFile(filename, mimeType?)`
- `isAudioFile(filename, mimeType?)`
- `isDocumentFile(filename, mimeType?)`
- `isPdfFile(filename, mimeType?)`

### Size Formatting
- `formatFileSize(bytes)` → "1.46 MB"
- `formatFileSizeBrazilian(bytes)` → "1,46 MB"
- `formatFileSizeCompact(bytes)` → "1.5MB"

### Validation
- `validateFile(file, constraints)`
- `validateFileSize(bytes, constraints)`
- `validateFileType(filename, mimeType, allowedTypes)`
- `checkFilenameSecurity(filename)`
- `sanitizeFilename(filename, options)`

### Thumbnails & Preview
- `generateImageThumbnailUrl(fileId, options)`
- `generateVideoThumbnailUrl(fileId, options)`
- `generatePdfThumbnailUrl(fileId, options)`
- `canPreview(filename, mimeType?)`
- `getPreviewType(filename, mimeType?)`

### File Handling
- `downloadFile(url, filename, options)`
- `truncateFilename(filename, maxLength)`
- `generateDownloadUrl(fileId, filename)`
- `generatePreviewUrl(fileId)`
- `generateStorageUrl(fileId, filename, options)`

### Metadata & Utilities
- `getFileMetadata(file)`
- `generateUniqueFilename(filename, existing, options)`
- `createFileHash(file)`
- `generateUploadId()`

## 📊 File Categories

| Category | Extensions |
|----------|-----------|
| **image** | jpg, jpeg, png, gif, webp, svg, bmp |
| **video** | mp4, avi, mov, webm, mkv |
| **audio** | mp3, wav, flac, aac, ogg |
| **document** | pdf, doc, docx, xls, xlsx, ppt, pptx, txt |
| **archive** | zip, rar, 7z, tar, gz |
| **code** | js, ts, jsx, tsx, py, java, json, xml |
| **font** | ttf, otf, woff, woff2 |
| **database** | db, sqlite, sql |
| **executable** | exe, msi, dmg, apk |

## 📐 Thumbnail Sizes

| Size | Dimensions |
|------|------------|
| **xs** | 64×64 |
| **sm** | 128×128 |
| **md** | 256×256 |
| **lg** | 512×512 |
| **xl** | 1024×1024 |

## ✅ Validation Constraints

```typescript
interface FileValidationConstraints {
  maxSizeInMB?: number;           // Default: 100
  minSizeInBytes?: number;        // Default: 1
  allowedExtensions?: string[];   // e.g., ['jpg', 'png']
  allowedMimeTypes?: string[];    // e.g., ['image/jpeg']
  allowedCategories?: string[];   // e.g., ['image', 'document']
  useBrazilianFormat?: boolean;   // Default: true
}
```

## 🔒 Security Checks

The `checkFilenameSecurity` function detects:
- ✓ Path traversal (`../`, `..\\`)
- ✓ Dangerous extensions (.exe, .bat, .cmd, .sh)
- ✓ Null bytes (`\0`)
- ✓ Control characters
- ✓ Excessive filename length (>255 chars)

## 🎨 Icons (Tabler Icons)

### Category Icons
- `image` → IconPhoto
- `video` → IconVideo
- `audio` → IconMusic
- `document` → IconFileText
- `archive` → IconFileZip
- `code` → IconFileCode

### Specific File Types
- `pdf` → IconFileTypePdf
- `docx` → IconFileTypeDoc
- `xlsx` → IconFileTypeXls
- `js` → IconBrandJavascript
- `ts` → IconBrandTypescript

## 🌐 Storage Types

```typescript
// Local Storage
generateStorageUrl(fileId, filename, { storageType: 'local' })

// AWS S3
generateStorageUrl(fileId, filename, {
  storageType: 's3',
  bucket: 'my-bucket',
  path: 'uploads',
  expiresIn: 3600
})

// WebDAV
generateStorageUrl(fileId, filename, { storageType: 'webdav' })

// Azure Blob Storage
generateStorageUrl(fileId, filename, {
  storageType: 'azure',
  container: 'files'
})

// Google Cloud Storage
generateStorageUrl(fileId, filename, {
  storageType: 'gcs',
  bucket: 'my-bucket'
})
```

## 🎬 Preview Types

| Type | Extensions | Example |
|------|-----------|---------|
| **image** | jpg, png, gif, webp, svg | `<img src={url} />` |
| **video** | mp4, webm, ogv | `<video src={url} controls />` |
| **audio** | mp3, wav, ogg | `<audio src={url} controls />` |
| **pdf** | pdf | `<iframe src={url} />` |
| **text** | txt | Text viewer |
| **code** | js, ts, json, xml | Code viewer |
| **none** | exe, zip, etc. | Not previewable |

## 💡 Tips & Best Practices

### 1. Always Validate Files
```typescript
// ❌ Bad
uploadFile(file);

// ✅ Good
const validation = fileUtilities.validateFile(file, constraints);
if (validation.valid) {
  uploadFile(file);
} else {
  showErrors(validation.errors);
}
```

### 2. Sanitize User Input
```typescript
// ❌ Bad
const filename = userInput;

// ✅ Good
const filename = fileUtilities.sanitizeFilename(userInput);
```

### 3. Use Brazilian Formatting for UI
```typescript
// ❌ Bad
const size = formatFileSize(bytes); // "1.46 MB"

// ✅ Good
const size = formatFileSizeBrazilian(bytes); // "1,46 MB"
```

### 4. Check Security Before Processing
```typescript
// ✅ Good
const security = fileUtilities.checkFilenameSecurity(filename);
if (!security.safe) {
  throw new Error(`Security issues: ${security.issues.join(', ')}`);
}
```

### 5. Generate Unique Names to Avoid Collisions
```typescript
// ✅ Good
const uniqueName = fileUtilities.generateUniqueFilename(
  file.name,
  existingFiles.map(f => f.name)
);
```

## 🔍 Debugging

### Check File Category
```typescript
const category = fileUtilities.getFileCategory(filename, mimeType);
console.log(`File category: ${category}`);
```

### Validate Step by Step
```typescript
// Size
const sizeCheck = fileUtilities.validateFileSize(file.size, { maxSizeInMB: 10 });
console.log('Size valid:', sizeCheck.valid);

// Type
const typeCheck = fileUtilities.validateFileType(file.name, file.type, {
  extensions: ['jpg', 'png']
});
console.log('Type valid:', typeCheck.valid);

// Security
const securityCheck = fileUtilities.checkFilenameSecurity(file.name);
console.log('Security safe:', securityCheck.safe, securityCheck.issues);
```

### Test MIME Type Detection
```typescript
const mimeType = fileUtilities.getMimeTypeFromFilename(filename);
console.log(`Detected MIME type: ${mimeType}`);
```

## 📦 Example Constraints

### Images Only (Max 5MB)
```typescript
{
  maxSizeInMB: 5,
  allowedCategories: ['image'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']
}
```

### Documents (Max 20MB)
```typescript
{
  maxSizeInMB: 20,
  allowedCategories: ['document'],
  allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx']
}
```

### Media Files (Max 100MB)
```typescript
{
  maxSizeInMB: 100,
  allowedCategories: ['image', 'video', 'audio']
}
```

### Code Files (Max 1MB)
```typescript
{
  maxSizeInMB: 1,
  allowedCategories: ['code'],
  allowedExtensions: ['js', 'ts', 'jsx', 'tsx', 'json']
}
```

## 🐛 Common Issues

### Issue: File validation fails with valid file
**Solution:** Check if MIME type is being passed correctly
```typescript
// ❌ May fail
validateFile(file, { allowedMimeTypes: ['image/jpeg'] });

// ✅ Better
const metadata = getFileMetadata(file);
console.log('Actual MIME type:', metadata.type);
```

### Issue: Thumbnail not loading
**Solution:** Check if file is previewable
```typescript
const canShow = fileUtilities.canPreview(filename, mimeType);
if (!canShow) {
  // Use fallback icon instead
  const icon = fileUtilities.getFallbackIcon(filename, mimeType);
}
```

### Issue: Download not working in browser
**Solution:** Ensure CORS is configured correctly
```typescript
await fileUtilities.downloadFile(url, filename, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 📚 Additional Resources

- **Full Documentation**: `FILE_UTILITIES_README.md`
- **Examples**: `file-utilities.example.tsx`
- **Tests**: `file-utilities.test.ts`
- **Main Module**: `file-utilities.ts`

## 🆘 Support

For issues or questions:
1. Check the full documentation
2. Review the example components
3. Run the test suite
4. Check existing file utilities in the project
