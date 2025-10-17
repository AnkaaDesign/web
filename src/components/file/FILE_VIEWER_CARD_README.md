# FileViewerCard Component

A comprehensive React component for displaying file thumbnails with interactive features, automatic file type detection, and built-in error handling.

## Features

- **Automatic File Type Detection**: Intelligently detects file types from MIME types and extensions
- **Thumbnail Generation**: Supports thumbnails for:
  - Images (jpg, png, gif, webp, svg, bmp, ico, tiff)
  - Videos (mp4, webm, avi, mov, wmv, flv, mkv)
  - PDFs
  - Documents (doc, docx, xls, xlsx, ppt, pptx)
  - Other file types (fallback to icon)
- **Hover Effects**: Smooth hover animations with action buttons
- **Click Handlers**: Smart click handling based on file type
- **Error Handling**: Graceful fallback for failed thumbnails
- **Loading States**: Beautiful loading animations
- **Responsive Design**: Works on all screen sizes
- **TypeScript**: Full type safety

## Installation

The component is already integrated into the project. No installation needed.

## Basic Usage

```tsx
import { FileViewerCard } from "@/components/file/file-viewer-card";
import type { File as AnkaaFile } from "@/types";

function MyComponent() {
  const file: AnkaaFile = {
    id: "1",
    filename: "photo.jpg",
    originalName: "photo.jpg",
    mimetype: "image/jpeg",
    path: "/uploads/photo.jpg",
    size: 2457600,
    thumbnailUrl: "/thumbnails/photo.jpg",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return <FileViewerCard file={file} />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `file` | `AnkaaFile` | Required | The file object to display |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size of the card |
| `showName` | `boolean` | `true` | Whether to show file name |
| `showSize` | `boolean` | `false` | Whether to show file size |
| `showType` | `boolean` | `false` | Whether to show file type badge |
| `enableHover` | `boolean` | `true` | Whether to enable hover effects |
| `className` | `string` | `undefined` | Custom CSS classes |
| `onClick` | `(file: AnkaaFile) => void` | `undefined` | Custom click handler |
| `onDownload` | `(file: AnkaaFile) => void` | `undefined` | Custom download handler |
| `disabled` | `boolean` | `false` | Whether the card is disabled |
| `baseUrl` | `string` | `undefined` | Base URL for file serving |

## Advanced Usage

### With FileViewerProvider

For best results, wrap your component tree with `FileViewerProvider`:

```tsx
import { FileViewerProvider } from "@/components/file/file-viewer";
import { FileViewerCard } from "@/components/file/file-viewer-card";

function App() {
  return (
    <FileViewerProvider baseUrl="https://api.example.com">
      <FileViewerCard file={file} />
    </FileViewerProvider>
  );
}
```

### Custom Click Handler

```tsx
<FileViewerCard
  file={file}
  onClick={(file) => {
    console.log("File clicked:", file.filename);
    // Your custom logic here
  }}
/>
```

### Custom Download Handler

```tsx
<FileViewerCard
  file={file}
  onDownload={(file) => {
    // Custom download logic
    const link = document.createElement("a");
    link.href = `/api/files/${file.id}/download`;
    link.download = file.filename;
    link.click();
  }}
/>
```

### Different Sizes

```tsx
{/* Small */}
<FileViewerCard file={file} size="sm" />

{/* Medium (default) */}
<FileViewerCard file={file} size="md" />

{/* Large */}
<FileViewerCard file={file} size="lg" />
```

### With File Information

```tsx
<FileViewerCard
  file={file}
  showName={true}
  showSize={true}
  showType={true}
/>
```

### Disabled State

```tsx
<FileViewerCard file={file} disabled={true} />
```

## File Type Support

### Images
- **Formats**: JPG, PNG, GIF, WebP, BMP, ICO, TIFF, HEIC
- **Preview**: Yes
- **Thumbnail**: Direct image
- **Click Action**: Opens in image modal

### Videos
- **Formats**: MP4, WebM, AVI, MOV, WMV, FLV, MKV, M4V
- **Preview**: Yes
- **Thumbnail**: Generated thumbnail
- **Click Action**: Opens in video player modal

### PDFs
- **Formats**: PDF
- **Preview**: Yes
- **Thumbnail**: First page preview
- **Click Action**: Opens in new tab

### Documents
- **Formats**: DOC, DOCX, TXT, RTF, ODT
- **Preview**: No
- **Thumbnail**: Generated preview
- **Click Action**: Downloads file

### Spreadsheets
- **Formats**: XLS, XLSX, CSV, ODS
- **Preview**: No
- **Thumbnail**: Generated preview
- **Click Action**: Downloads file

### Presentations
- **Formats**: PPT, PPTX, ODP
- **Preview**: No
- **Thumbnail**: Generated preview
- **Click Action**: Downloads file

### Audio
- **Formats**: MP3, WAV, FLAC, AAC, OGG, WMA, M4A
- **Preview**: Yes (inline player)
- **Thumbnail**: Icon
- **Click Action**: Opens in audio player

### Archives
- **Formats**: ZIP, RAR, 7Z, TAR, GZ, BZ2
- **Preview**: No
- **Thumbnail**: Icon
- **Click Action**: Downloads file

### Vector Graphics
- **Formats**: EPS, AI, SVG
- **Preview**: Limited (if thumbnail available)
- **Thumbnail**: Generated or icon
- **Click Action**: Downloads file

### Other
- **Formats**: All other file types
- **Preview**: No
- **Thumbnail**: Generic file icon
- **Click Action**: Downloads file

## Utility Functions

The component includes several utility functions available for import:

```tsx
import {
  detectFileType,
  getFileTypeIcon,
  generateThumbnailUrl,
  formatFileSize,
  getFileTypeLabel,
  canPreviewFile,
} from "@/components/file/file-viewer-card";
```

### detectFileType

```tsx
const fileType = detectFileType(file);
// Returns: "image" | "video" | "pdf" | "document" | etc.
```

### getFileTypeIcon

```tsx
const icon = getFileTypeIcon(fileType, 24);
// Returns: React icon component
```

### generateThumbnailUrl

```tsx
const thumbnailUrl = generateThumbnailUrl(file, fileType, baseUrl);
// Returns: string | null
```

### formatFileSize

```tsx
const formatted = formatFileSize(2457600);
// Returns: "2.34 MB"
```

### canPreviewFile

```tsx
const canPreview = canPreviewFile(fileType);
// Returns: boolean
```

## Styling

The component uses Tailwind CSS and can be customized with the `className` prop:

```tsx
<FileViewerCard
  file={file}
  className="shadow-lg border-2 border-blue-500"
/>
```

### Custom Hover Effects

Disable default hover effects and add your own:

```tsx
<FileViewerCard
  file={file}
  enableHover={false}
  className="hover:bg-blue-50 transition-colors"
/>
```

## Error Handling

The component gracefully handles errors:

- **Thumbnail Loading Failure**: Shows file type icon instead
- **Missing File Data**: Displays warning icon
- **Network Errors**: Falls back to icon display
- **Invalid File Types**: Shows generic file icon

## Performance

- **Lazy Loading**: Images use native lazy loading
- **Optimized Rendering**: Uses React.memo internally
- **Efficient State Management**: Minimal re-renders
- **Thumbnail Caching**: Browser caching for thumbnails

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels
- **Focus Indicators**: Clear focus states
- **Alt Text**: Descriptive alt text for images

## Examples

### File Grid

```tsx
function FileGrid({ files }: { files: AnkaaFile[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {files.map((file) => (
        <FileViewerCard
          key={file.id}
          file={file}
          showName={true}
          showSize={true}
        />
      ))}
    </div>
  );
}
```

### With Loading State

```tsx
function FileList({ files, isLoading }: Props) {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map((file) => (
        <FileViewerCard key={file.id} file={file} />
      ))}
    </div>
  );
}
```

### With Selection

```tsx
function SelectableFiles() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map((file) => (
        <FileViewerCard
          key={file.id}
          file={file}
          className={selected.includes(file.id) ? "ring-2 ring-blue-500" : ""}
          onClick={(file) => {
            setSelected((prev) =>
              prev.includes(file.id)
                ? prev.filter((id) => id !== file.id)
                : [...prev, file.id]
            );
          }}
        />
      ))}
    </div>
  );
}
```

## Related Components

- **FileViewerProvider**: Context provider for file viewer functionality
- **FilePreview**: Full-screen file preview modal
- **VideoPlayer**: Video player component
- **FileThumbnail**: Simpler thumbnail-only component
- **FileList**: List view for files

## Utilities Module

For more advanced file handling, see:
- `/src/utils/file-viewer-utils.ts` - Comprehensive utility functions
- `/src/utils/file-viewer.ts` - File viewer service

## Demo

See `/src/components/file/file-viewer-card-demo.tsx` for a complete interactive demo.

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 14+, Chrome Android 90+

## License

Part of the Ankaa project. Internal use only.
