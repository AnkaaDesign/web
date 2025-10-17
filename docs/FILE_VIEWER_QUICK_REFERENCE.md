# File Viewer Quick Reference

Quick reference guide for the File Viewer system.

## Installation & Setup

```typescript
// 1. Wrap your app
import { FileViewerProvider } from '@/components/file/file-viewer';

<FileViewerProvider baseUrl="https://api.example.com">
  <App />
</FileViewerProvider>

// 2. Use in components
import { FileViewerCard } from '@/components/file/file-viewer-card';
import { useFileViewer } from '@/components/file/file-viewer';
```

---

## Components

### FileViewerCard

Display file with automatic thumbnail and actions.

```typescript
<FileViewerCard
  file={file}
  size="sm" | "md" | "lg"
  showName={true}
  showSize={false}
  showType={false}
  enableHover={true}
  onClick={(file) => {}}
  onDownload={(file) => {}}
  disabled={false}
  baseUrl="https://api.example.com"
/>
```

### FileViewerButton

Simple button to view file.

```typescript
<FileViewerButton
  file={file}
  className="btn-primary"
  disabled={false}
>
  View File
</FileViewerButton>
```

---

## Hooks

### useFileViewer

Access file viewer context.

```typescript
const { state, actions } = useFileViewer();

// Actions
actions.viewFile(file);
actions.downloadFile(file);
actions.openImageModal(files, index);
actions.closeImageModal();
actions.openVideoModal(file, url);
actions.closeVideoModal();
```

### useFileViewerStandalone

Use without provider.

```typescript
const viewer = useFileViewerStandalone(config);

viewer.viewFile(file, options);
viewer.canPreview(file);
viewer.getFileAction(file);
viewer.downloadFile(file);
```

---

## Service Functions

```typescript
import { fileViewerService } from '@/utils/file-viewer';

// File type detection
fileViewerService.detectFileCategory(file);
// Returns: "images" | "pdfs" | "videos" | "documents" | etc.

// Security validation
fileViewerService.validateFileSecurity(file, config);
// Returns: { isSecure: boolean, warnings: string[] }

// URL generation
fileViewerService.generateFileUrls(file, baseUrl);
// Returns: { serve, download, thumbnail, thumbnailSmall, etc. }

// Determine action
fileViewerService.determineFileViewAction(file, config);
// Returns: { type, url, component, security }

// View file
fileViewerService.viewFile(file, config, options);
```

---

## Configuration

### Provider Config

```typescript
<FileViewerProvider
  config={{
    enableSecurity: true,
    maxFileSize: 200 * 1024 * 1024,
    pdfViewMode: "new-tab" | "modal" | "inline",
    pdfMaxFileSize: 50 * 1024 * 1024
  }}
  baseUrl="https://api.example.com"
  onDownload={(file, url) => {}}
  onSecurityWarning={(warnings, file) => {}}
/>
```

### Presets

```typescript
fileViewerService.configs.secure     // Production
fileViewerService.configs.permissive // Development
fileViewerService.configs.default    // Balanced
```

---

## File Type Support

| Type | Extensions | Preview | Thumbnail | Action |
|------|-----------|---------|-----------|--------|
| Images | jpg, png, gif, webp, svg | ✅ | ✅ | Modal |
| Videos | mp4, webm, mov | ✅ | ✅ | Modal |
| PDFs | pdf | ✅ | ✅ | New Tab |
| Docs | docx, txt | ❌ | ⚠️ | Download |
| Sheets | xlsx, csv | ❌ | ⚠️ | Download |
| Audio | mp3, wav | ⚠️ | ❌ | Download |
| Archives | zip, rar | ❌ | ❌ | Download |

---

## Common Patterns

### Simple Gallery

```typescript
const { actions } = useFileViewer();

images.map((img, i) => (
  <img
    src={img.thumbnailUrl}
    onClick={() => actions.openImageModal(images, i)}
  />
))
```

### File List

```typescript
<div className="grid grid-cols-4 gap-4">
  {files.map(file => (
    <FileViewerCard key={file.id} file={file} size="md" showName />
  ))}
</div>
```

### Custom Handler

```typescript
<FileViewerCard
  file={file}
  onClick={(file) => {
    console.log('Clicked:', file);
    // Custom logic
  }}
/>
```

---

## Keyboard Shortcuts

### Image Viewer
- `ESC` - Close
- `Arrow Left/Right` - Navigate
- `+/-` - Zoom
- `0` - Reset zoom

### Video Player
- `Space` - Play/Pause
- `ESC` - Close
- `Arrow Left/Right` - Seek
- `M` - Mute
- `F` - Fullscreen

---

## Testing

### Unit Test

```typescript
import { render } from '@testing-library/react';

render(
  <FileViewerProvider>
    <FileViewerCard file={mockFile} />
  </FileViewerProvider>
);
```

### Mock File

```typescript
const mockFile: AnkaaFile = {
  id: '1',
  filename: 'test.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  thumbnailUrl: '/thumb.jpg'
};
```

---

## Troubleshooting

### Provider Error

```
Error: useFileViewer must be used within FileViewerProvider
```

**Fix:** Wrap with `<FileViewerProvider>`

### No Preview

**Check:**
1. File type supported?
2. Thumbnail generated?
3. Network working?
4. Console errors?

### Slow Performance

**Solutions:**
1. Use virtual scrolling
2. Smaller thumbnails
3. Lazy loading
4. Code splitting

---

## API Endpoints

```bash
# Serve file
GET /files/serve/{id}

# Download file
GET /files/{id}/download

# Thumbnail
GET /files/thumbnail/{id}?size=small|medium|large
```

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Documentation

- [README](./FILE_VIEWER_README.md) - Overview and getting started
- [API Reference](./FILE_VIEWER_API.md) - Complete API documentation
- [Usage Examples](./FILE_VIEWER_USAGE_EXAMPLES.md) - Code examples
- [File Type Support](./FILE_VIEWER_FILE_TYPE_SUPPORT.md) - Supported formats
- [Testing Checklist](./FILE_VIEWER_TESTING_CHECKLIST.md) - Testing guide
- [Migration Guide](./FILE_VIEWER_MIGRATION_GUIDE.md) - Upgrade guide

---

## Cheat Sheet

```typescript
// SETUP
<FileViewerProvider baseUrl="...">
  <App />
</FileViewerProvider>

// DISPLAY
<FileViewerCard file={file} size="md" showName />

// ACTION
const { actions } = useFileViewer();
actions.viewFile(file);

// STANDALONE
const viewer = useFileViewerStandalone();
viewer.viewFile(file);

// SERVICE
import { fileViewerService } from '@/utils/file-viewer';
fileViewerService.viewFile(file);

// PRESETS
fileViewerService.configs.secure
fileViewerService.configs.permissive
fileViewerService.configs.default
```

---

**Version:** 1.0.0
**Last Updated:** 2025-10-16
