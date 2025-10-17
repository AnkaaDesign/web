# FileViewerCard - Quick Start Guide

## Installation

The component is already integrated. No installation needed.

## 5-Minute Quick Start

### 1. Basic Usage

```tsx
import { FileViewerCard, FileViewerProvider } from "@/components/file";
import type { File as AnkaaFile } from "@/types";

function MyComponent({ file }: { file: AnkaaFile }) {
  return (
    <FileViewerProvider>
      <FileViewerCard file={file} />
    </FileViewerProvider>
  );
}
```

### 2. File Grid

```tsx
function FileGrid({ files }: { files: AnkaaFile[] }) {
  return (
    <FileViewerProvider>
      <div className="grid grid-cols-4 gap-4">
        {files.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            showName={true}
            showSize={true}
          />
        ))}
      </div>
    </FileViewerProvider>
  );
}
```

### 3. With Custom Click Handler

```tsx
function Gallery({ files }: { files: AnkaaFile[] }) {
  const handleClick = (file: AnkaaFile) => {
    console.log("Clicked:", file.filename);
    // Your custom logic
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map((file) => (
        <FileViewerCard
          key={file.id}
          file={file}
          onClick={handleClick}
        />
      ))}
    </div>
  );
}
```

### 4. Different Sizes

```tsx
// Small
<FileViewerCard file={file} size="sm" />

// Medium (default)
<FileViewerCard file={file} size="md" />

// Large
<FileViewerCard file={file} size="lg" />
```

### 5. Show File Info

```tsx
<FileViewerCard
  file={file}
  showName={true}    // Show filename
  showSize={true}    // Show file size
  showType={true}    // Show file type badge
/>
```

## Common Use Cases

### Image Gallery
```tsx
<div className="grid grid-cols-3 gap-4">
  {images.map((file) => (
    <FileViewerCard key={file.id} file={file} size="lg" />
  ))}
</div>
```

### Document List
```tsx
<div className="space-y-2">
  {documents.map((file) => (
    <FileViewerCard
      key={file.id}
      file={file}
      size="sm"
      showName={true}
      showSize={true}
    />
  ))}
</div>
```

### Attachment Section
```tsx
<div>
  <h3>Attachments</h3>
  <div className="grid grid-cols-4 gap-3">
    {attachments.map((file) => (
      <FileViewerCard key={file.id} file={file} />
    ))}
  </div>
</div>
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `file` | `AnkaaFile` | Required | File to display |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Card size |
| `showName` | `boolean` | `true` | Show filename |
| `showSize` | `boolean` | `false` | Show file size |
| `showType` | `boolean` | `false` | Show type badge |
| `enableHover` | `boolean` | `true` | Enable hover effects |
| `onClick` | `function` | - | Custom click handler |
| `onDownload` | `function` | - | Custom download handler |
| `disabled` | `boolean` | `false` | Disable interaction |

## Supported File Types

✅ Images (jpg, png, gif, webp, svg)
✅ Videos (mp4, webm, avi, mov)
✅ PDFs
✅ Documents (doc, docx, xls, xlsx, ppt, pptx)
✅ Audio (mp3, wav, flac)
✅ Archives (zip, rar, 7z)
✅ Vectors (eps, ai, svg)
✅ Other files (default icon)

## Examples

See `/src/components/file/FILE_VIEWER_USAGE_EXAMPLES.tsx` for 12 complete examples.

## Demo

Run the demo component:
```tsx
import { FileViewerCardDemo } from "@/components/file";

function Page() {
  return <FileViewerCardDemo />;
}
```

## Need Help?

- Full Documentation: `/src/components/file/FILE_VIEWER_CARD_README.md`
- Usage Examples: `/src/components/file/FILE_VIEWER_USAGE_EXAMPLES.tsx`
- Implementation Details: `/src/components/file/FILE_VIEWER_IMPLEMENTATION_SUMMARY.md`

## Utilities

```tsx
// File type detection
import { detectFileType } from "@/components/file";
const type = detectFileType(file);

// Format file size
import { formatFileSize } from "@/components/file";
const formatted = formatFileSize(file.size);

// Generate thumbnail
import { generateThumbnailUrl } from "@/components/file";
const url = generateThumbnailUrl(file, "image", baseUrl);

// Check if can preview
import { canPreviewFile } from "@/components/file";
const canPreview = canPreviewFile("image");
```

## Tips

1. **Always wrap with FileViewerProvider** for full functionality
2. **Use size variants** based on your layout
3. **Enable hover effects** for better UX
4. **Show file info** for clarity
5. **Handle errors** with custom handlers
6. **Test with different file types**
7. **Optimize for mobile** with responsive grids

## Troubleshooting

### Thumbnails not showing
- Check `baseUrl` configuration
- Verify file paths are correct
- Check network requests in DevTools

### Click not working
- Ensure FileViewerProvider is wrapping component
- Check if `disabled` prop is set
- Verify custom `onClick` handler

### Styling issues
- Use `className` prop for custom styles
- Check Tailwind CSS configuration
- Inspect with browser DevTools

## Next Steps

1. Read full documentation
2. Check usage examples
3. Run the demo component
4. Integrate into your project
5. Customize as needed
