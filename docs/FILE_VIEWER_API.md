# File Viewer API Documentation

Complete API reference for the File Viewer system components.

## Table of Contents
- [Core Services](#core-services)
- [React Components](#react-components)
- [React Hooks](#react-hooks)
- [Type Definitions](#type-definitions)
- [Configuration](#configuration)
- [Utility Functions](#utility-functions)

---

## Core Services

### `fileViewerService`

The main service object that provides all file viewing functionality.

```typescript
import { fileViewerService } from '@/utils/file-viewer';
```

#### Methods

##### `detectFileCategory(file: AnkaaFile): string`

Detects the category of a file based on MIME type and filename extension.

**Parameters:**
- `file` - File object with mimetype and filename properties

**Returns:** One of: `"images"`, `"pdfs"`, `"videos"`, `"audio"`, `"eps"`, `"documents"`, `"archives"`, `"other"`

**Example:**
```typescript
const category = fileViewerService.detectFileCategory({
  filename: 'photo.jpg',
  mimetype: 'image/jpeg',
  // ... other properties
});
// Returns: "images"
```

---

##### `validateFileSecurity(file: AnkaaFile, config?: FileViewerConfig): SecurityResult`

Validates file security and returns warnings for potentially dangerous files.

**Parameters:**
- `file` - File object to validate
- `config` - Optional configuration object

**Returns:** Object with `isSecure: boolean` and `warnings: string[]`

**Example:**
```typescript
const security = fileViewerService.validateFileSecurity(file, {
  enableSecurity: true,
  maxFileSize: 100 * 1024 * 1024 // 100MB
});

if (!security.isSecure) {
  console.log('Security warnings:', security.warnings);
}
```

---

##### `validatePDFFile(file: AnkaaFile, config?: FileViewerConfig): PDFValidationResult`

Validates PDF-specific requirements like file size limits.

**Parameters:**
- `file` - PDF file object
- `config` - Optional configuration with `pdfMaxFileSize`

**Returns:** Object with `isValid: boolean` and `warnings: string[]`

**Example:**
```typescript
const pdfValidation = fileViewerService.validatePDFFile(pdfFile, {
  pdfMaxFileSize: 50 * 1024 * 1024 // 50MB
});
```

---

##### `generateFileUrls(file: AnkaaFile, baseUrl?: string): FileUrls`

Generates all relevant URLs for a file (serve, download, thumbnails).

**Parameters:**
- `file` - File object with id
- `baseUrl` - Optional API base URL (defaults to environment config)

**Returns:** Object with URL properties:
```typescript
{
  serve: string;           // Direct file serving URL
  download: string;        // Force download URL
  thumbnail: string | null;// Existing thumbnail URL
  thumbnailSmall: string;  // Small thumbnail URL
  thumbnailMedium: string; // Medium thumbnail URL
  thumbnailLarge: string;  // Large thumbnail URL
}
```

**Example:**
```typescript
const urls = fileViewerService.generateFileUrls(file, 'https://api.example.com');
console.log(urls.serve);    // https://api.example.com/files/serve/123
console.log(urls.download); // https://api.example.com/files/123/download
```

---

##### `determineFileViewAction(file: AnkaaFile, config?: FileViewerConfig): FileViewAction`

Determines the appropriate viewing action for a file based on its type and security.

**Parameters:**
- `file` - File to analyze
- `config` - Optional configuration

**Returns:** Action object with:
```typescript
{
  type: "modal" | "new-tab" | "inline" | "download" | "not-supported";
  url?: string;
  component?: "image-modal" | "video-player" | "pdf-viewer";
  security: {
    isSecure: boolean;
    warnings: string[];
  };
}
```

**Example:**
```typescript
const action = fileViewerService.determineFileViewAction(file);

if (action.type === 'modal') {
  // Open in modal viewer
  openModal(action.component, action.url);
} else if (action.type === 'download') {
  // Trigger download
  downloadFile(action.url);
}
```

---

##### `executeFileViewAction(action: FileViewAction, options?: ExecuteOptions): void`

Executes the determined file view action with callbacks.

**Parameters:**
- `action` - Action object from `determineFileViewAction`
- `options` - Optional callbacks:
  - `onModalOpen?: (component: string, url: string, file?: AnkaaFile) => void`
  - `onInlinePlayer?: (url: string, file?: AnkaaFile) => void`
  - `onDownload?: (url: string, file?: AnkaaFile) => void`
  - `onSecurityWarning?: (warnings: string[]) => void`

**Example:**
```typescript
fileViewerService.executeFileViewAction(action, {
  onModalOpen: (component, url) => {
    console.log(`Opening ${component} with ${url}`);
  },
  onDownload: (url) => {
    console.log(`Downloading ${url}`);
  },
  onSecurityWarning: (warnings) => {
    alert(`Security warning: ${warnings.join(', ')}`);
  }
});
```

---

##### `viewFile(file: AnkaaFile, config?: FileViewerConfig, options?: ExecuteOptions): FileViewAction`

Main convenience method that combines `determineFileViewAction` and `executeFileViewAction`.

**Parameters:**
- `file` - File to view
- `config` - Optional configuration
- `options` - Optional callbacks (same as `executeFileViewAction`)

**Returns:** The determined action

**Example:**
```typescript
const action = fileViewerService.viewFile(file,
  { enableSecurity: true },
  {
    onModalOpen: (component, url) => {
      // Handle modal opening
    }
  }
);
```

---

##### `canPreviewFile(file: AnkaaFile): boolean`

Checks if a file can be previewed (has viewer support).

**Parameters:**
- `file` - File to check

**Returns:** `true` if file can be previewed, `false` otherwise

**Example:**
```typescript
if (fileViewerService.canPreviewFile(file)) {
  showPreviewButton();
} else {
  showDownloadButton();
}
```

---

##### `getFileTypeIcon(file: AnkaaFile): string`

Gets the appropriate icon name for a file type.

**Parameters:**
- `file` - File object

**Returns:** Icon name (string)

**Example:**
```typescript
const iconName = fileViewerService.getFileTypeIcon(file);
// Returns: "IconPhoto", "IconFileTypePdf", etc.
```

---

##### `isPDFFile(file: AnkaaFile): boolean`

Checks if a file is a PDF.

**Parameters:**
- `file` - File to check

**Returns:** `true` if PDF, `false` otherwise

**Example:**
```typescript
if (fileViewerService.isPDFFile(file)) {
  // Handle PDF-specific logic
}
```

---

#### Configuration Presets

The service provides three configuration presets:

```typescript
fileViewerService.configs.secure
fileViewerService.configs.permissive
fileViewerService.configs.default
```

**Secure:**
```typescript
{
  enableSecurity: true,
  maxFileSize: 100 * 1024 * 1024,      // 100MB
  pdfViewMode: "new-tab",
  pdfMaxFileSize: 50 * 1024 * 1024     // 50MB
}
```

**Permissive:**
```typescript
{
  enableSecurity: false,
  maxFileSize: 500 * 1024 * 1024,      // 500MB
  pdfViewMode: "modal",
  pdfMaxFileSize: 100 * 1024 * 1024    // 100MB
}
```

**Default:**
```typescript
{
  enableSecurity: true,
  maxFileSize: 200 * 1024 * 1024,      // 200MB
  pdfViewMode: "new-tab",
  pdfMaxFileSize: 50 * 1024 * 1024     // 50MB
}
```

---

## React Components

### `FileViewerProvider`

Context provider that manages global file viewer state and modals.

**Props:**
```typescript
interface FileViewerProps {
  config?: FileViewerConfig;
  baseUrl?: string;
  onDownload?: (file: AnkaaFile, url: string) => void;
  onSecurityWarning?: (warnings: string[], file: AnkaaFile) => void;
  children: ReactNode;
}
```

**Usage:**
```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';

function App() {
  return (
    <FileViewerProvider
      config={{
        enableSecurity: true,
        pdfViewMode: "modal"
      }}
      baseUrl="https://api.example.com"
      onDownload={(file, url) => {
        console.log(`Downloading: ${file.filename}`);
      }}
      onSecurityWarning={(warnings, file) => {
        toast.warning(`Security issue with ${file.filename}`);
      }}
    >
      {/* Your app */}
    </FileViewerProvider>
  );
}
```

**Features:**
- Manages image modal state
- Manages video modal state
- Manages PDF modal state
- Coordinates file viewing actions
- Provides context to child components

---

### `FileViewerCard`

Display component for file thumbnails with interactive features.

**Props:**
```typescript
interface FileViewerCardProps {
  file: AnkaaFile;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showSize?: boolean;
  showType?: boolean;
  enableHover?: boolean;
  className?: string;
  onClick?: (file: AnkaaFile) => void;
  onDownload?: (file: AnkaaFile) => void;
  disabled?: boolean;
  baseUrl?: string;
}
```

**Default Values:**
- `size`: `"md"`
- `showName`: `true`
- `showSize`: `false`
- `showType`: `false`
- `enableHover`: `true`
- `disabled`: `false`

**Usage:**
```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';

function FileList({ files }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {files.map(file => (
        <FileViewerCard
          key={file.id}
          file={file}
          size="md"
          showName
          showSize
          enableHover
          onClick={(file) => console.log('Clicked:', file.filename)}
        />
      ))}
    </div>
  );
}
```

**Size Variants:**

| Size | Container | Icon | Text |
|------|-----------|------|------|
| sm   | 80x80px   | 16px | xs   |
| md   | 128x128px | 24px | sm   |
| lg   | 192x192px | 32px | base |

**Features:**
- Automatic thumbnail generation
- File type detection and icons
- Hover effects with action buttons
- Loading and error states
- Responsive sizing
- Accessibility support

---

### `FileViewerButton`

Simple button component for triggering file viewer.

**Props:**
```typescript
interface FileViewerButtonProps {
  file: AnkaaFile;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  config?: FileViewerConfig;
}
```

**Usage:**
```typescript
import { FileViewerButton } from '@/components/file/file-viewer';

function FileRow({ file }) {
  return (
    <FileViewerButton file={file} className="btn-primary">
      View {file.filename}
    </FileViewerButton>
  );
}
```

**Features:**
- Works with or without `FileViewerProvider`
- Automatically determines appropriate action
- Handles all file types
- Accessible button implementation

---

### `FilePreview`

Modal component for viewing images and image galleries.

**Props:**
```typescript
interface FilePreviewProps {
  files: AnkaaFile[];
  initialFileIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseUrl?: string;
}
```

**Default Values:**
- `initialFileIndex`: `0`
- `baseUrl`: `""`

**Usage:**
```typescript
import { FilePreview } from '@/components/file/file-preview';

function ImageGallery({ images }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  return (
    <>
      {/* Thumbnails */}
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.thumbnailUrl}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
          />
        ))}
      </div>

      {/* Preview Modal */}
      <FilePreview
        files={images}
        initialFileIndex={index}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

**Features:**
- Image gallery navigation
- Zoom controls
- Keyboard shortcuts
- Touch gestures (mobile)
- EPS file support (with thumbnails)
- PDF display option
- Responsive design

**Keyboard Shortcuts:**
- `ESC` - Close modal
- `Arrow Left` - Previous image
- `Arrow Right` - Next image
- `+` / `=` - Zoom in
- `-` - Zoom out
- `0` - Reset zoom

---

### `VideoPlayer`

Modal or inline video player component.

**Props:**
```typescript
interface VideoPlayerProps {
  file: AnkaaFile;
  url: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "modal" | "inline";
  className?: string;
  onDownload?: (file: AnkaaFile) => void;
}
```

**Default Values:**
- `open`: `true`
- `mode`: `"modal"`

**Usage (Modal):**
```typescript
import { VideoPlayer } from '@/components/file/video-player';

function VideoModal({ video, isOpen, onClose }) {
  return (
    <VideoPlayer
      file={video}
      url={`https://api.example.com/files/serve/${video.id}`}
      open={isOpen}
      onOpenChange={onClose}
      mode="modal"
    />
  );
}
```

**Usage (Inline):**
```typescript
function VideoEmbed({ video }) {
  return (
    <VideoPlayer
      file={video}
      url={`https://api.example.com/files/serve/${video.id}`}
      mode="inline"
      className="w-full"
    />
  );
}
```

**Features:**
- Play/pause controls
- Volume controls
- Seek bar
- Fullscreen mode
- Keyboard shortcuts
- Auto-hide controls
- Error handling
- Loading states

**Keyboard Shortcuts:**
- `Space` - Play/pause
- `ESC` - Close modal (modal mode only)
- `Arrow Left` - Seek backward 10s
- `Arrow Right` - Seek forward 10s
- `M` - Toggle mute
- `F` - Toggle fullscreen

---

### `PDFViewer`

PDF viewer component (if implemented).

**Props:**
```typescript
interface PDFViewerProps {
  file: AnkaaFile;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "modal" | "new-tab" | "inline";
  onDownload?: (file: AnkaaFile) => void;
  maxFileSize?: number;
  showToolbar?: boolean;
}
```

---

## React Hooks

### `useFileViewer()`

Hook to access the file viewer context.

**Returns:**
```typescript
{
  state: FileViewerState;
  actions: {
    openImageModal: (files: AnkaaFile[], initialIndex?: number) => void;
    closeImageModal: () => void;
    openVideoModal: (file: AnkaaFile, url: string) => void;
    closeVideoModal: () => void;
    openPdfModal: (file: AnkaaFile, url: string) => void;
    closePdfModal: () => void;
    viewFile: (file: AnkaaFile) => void;
    downloadFile: (file: AnkaaFile) => void;
  };
}
```

**Usage:**
```typescript
import { useFileViewer } from '@/components/file/file-viewer';

function FileActions({ file }) {
  const { actions } = useFileViewer();

  return (
    <div>
      <button onClick={() => actions.viewFile(file)}>
        View
      </button>
      <button onClick={() => actions.downloadFile(file)}>
        Download
      </button>
    </div>
  );
}
```

**Throws:** Error if used outside `FileViewerProvider`

---

### `useFileViewerStandalone(config?: FileViewerConfig)`

Hook for standalone file viewing without context provider.

**Parameters:**
- `config` - Optional configuration

**Returns:**
```typescript
{
  viewFile: (file: AnkaaFile, options?: ExecuteOptions) => FileViewAction;
  canPreview: (file: AnkaaFile) => boolean;
  getFileAction: (file: AnkaaFile) => FileViewAction;
  downloadFile: (file: AnkaaFile) => void;
  config: FileViewerConfig;
}
```

**Usage:**
```typescript
import { useFileViewerStandalone } from '@/components/file/file-viewer';

function StandaloneFileViewer({ file }) {
  const viewer = useFileViewerStandalone({
    enableSecurity: true
  });

  const handleView = () => {
    viewer.viewFile(file, {
      onModalOpen: (component, url) => {
        // Custom modal handling
      }
    });
  };

  return (
    <button onClick={handleView} disabled={!viewer.canPreview(file)}>
      {viewer.canPreview(file) ? 'Preview' : 'Download'}
    </button>
  );
}
```

---

## Type Definitions

### `AnkaaFile`

```typescript
interface AnkaaFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  thumbnailUrl?: string;
  // ... other properties
}
```

---

### `FileViewerConfig`

```typescript
interface FileViewerConfig {
  baseUrl?: string;
  allowedMimeTypes?: string[];
  maxFileSize?: number;           // in bytes
  enableSecurity?: boolean;
  pdfViewMode?: "new-tab" | "modal" | "inline";
  pdfMaxFileSize?: number;        // in bytes
}
```

---

### `FileViewAction`

```typescript
interface FileViewAction {
  type: "modal" | "new-tab" | "inline" | "download" | "not-supported";
  url?: string;
  component?: "image-modal" | "video-player" | "pdf-viewer";
  security?: {
    isSecure: boolean;
    warnings: string[];
  };
}
```

---

### `FileType`

```typescript
type FileType =
  | "image"
  | "video"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "audio"
  | "archive"
  | "vector"
  | "other";
```

---

### `FileUrls`

```typescript
interface FileUrls {
  serve: string;
  download: string;
  thumbnail: string | null;
  thumbnailSmall: string;
  thumbnailMedium: string;
  thumbnailLarge: string;
}
```

---

### `SecurityResult`

```typescript
interface SecurityResult {
  isSecure: boolean;
  warnings: string[];
}
```

---

### `PDFValidationResult`

```typescript
interface PDFValidationResult {
  isValid: boolean;
  warnings: string[];
}
```

---

## Configuration

### Default Configuration

```typescript
const defaultConfig: FileViewerConfig = {
  enableSecurity: true,
  maxFileSize: 200 * 1024 * 1024,      // 200MB
  pdfViewMode: "new-tab",
  pdfMaxFileSize: 50 * 1024 * 1024     // 50MB
};
```

### Environment Variables

The file viewer uses the following environment variables (in order of precedence):

1. `window.__ANKAA_API_URL__` (runtime)
2. `process.env.VITE_API_URL` (build-time)
3. `"http://localhost:3030"` (fallback)

**Setting at runtime:**
```html
<script>
  window.__ANKAA_API_URL__ = 'https://api.example.com';
</script>
```

**Setting in .env:**
```
VITE_API_URL=https://api.example.com
```

---

## Utility Functions

### File Type Detection

```typescript
import {
  detectFileType,
  getFileTypeIcon,
  getFileTypeLabel
} from '@/components/file/file-viewer-card';

const type = detectFileType(file);
const icon = getFileTypeIcon(type, 24);
const label = getFileTypeLabel(type);
```

---

### Thumbnail Generation

```typescript
import { generateThumbnailUrl } from '@/components/file/file-viewer-card';

const thumbnailUrl = generateThumbnailUrl(file, fileType, baseUrl);
```

---

### File Size Formatting

```typescript
import { formatFileSize } from '@/components/file/file-viewer-card';

const formatted = formatFileSize(1024 * 1024); // "1.00 MB"
```

---

### Preview Capability Check

```typescript
import { canPreviewFile } from '@/components/file/file-viewer-card';

const canPreview = canPreviewFile(fileType);
```

---

## Best Practices

### 1. Always Use Provider for Multiple Components

```typescript
// Good
<FileViewerProvider>
  <FileList />
  <FileGallery />
  <FileDetails />
</FileViewerProvider>

// Not ideal (creates separate contexts)
<FileList />
<FileGallery />
<FileDetails />
```

---

### 2. Handle Security Warnings

```typescript
<FileViewerProvider
  onSecurityWarning={(warnings, file) => {
    // Log for security audit
    logSecurityEvent({ file, warnings });

    // Show user-friendly warning
    toast.warning('Security Warning', {
      description: warnings[0]
    });
  }}
>
```

---

### 3. Customize Download Behavior

```typescript
<FileViewerProvider
  onDownload={async (file, url) => {
    // Track download
    analytics.track('file_download', { fileId: file.id });

    // Custom download logic
    const response = await fetch(url);
    const blob = await response.blob();
    saveAs(blob, file.filename);
  }}
>
```

---

### 4. Use Standalone Hook for Simple Cases

```typescript
// For simple, one-off file viewing without global state
function SimpleFileViewer({ file }) {
  const { viewFile, canPreview } = useFileViewerStandalone();

  return (
    <button onClick={() => viewFile(file)}>
      {canPreview(file) ? 'Preview' : 'Download'}
    </button>
  );
}
```

---

### 5. Configure Per Environment

```typescript
// development
const config = fileViewerService.configs.permissive;

// production
const config = fileViewerService.configs.secure;

<FileViewerProvider config={config}>
```

---

## Migration Guide

See [MIGRATION_GUIDE.md](./FILE_VIEWER_MIGRATION_GUIDE.md) for detailed migration instructions from old components.

---

## Performance Considerations

### Lazy Loading
All modals and viewers use code splitting and lazy loading:
```typescript
const FilePreview = lazy(() => import('./file-preview'));
```

### Thumbnail Optimization
- Small: 150x150px
- Medium: 300x300px
- Large: 600x600px

Use appropriate size based on display context.

### Memory Management
- Modals unmount when closed (don't keep in DOM)
- Video elements cleaned up on unmount
- Image references released

---

## Error Handling

All components handle errors gracefully:

```typescript
try {
  fileViewerService.viewFile(file);
} catch (error) {
  console.error('Failed to view file:', error);
  toast.error('Could not open file');
}
```

Common errors:
- Network failures
- Unsupported file types
- Permission denied
- File not found
- Corrupted files

---

## Accessibility

All components follow WCAG 2.1 AA guidelines:
- Keyboard navigation
- Screen reader support
- Focus management
- ARIA attributes
- Color contrast

See [TESTING_CHECKLIST.md](./FILE_VIEWER_TESTING_CHECKLIST.md#accessibility-testing) for details.
