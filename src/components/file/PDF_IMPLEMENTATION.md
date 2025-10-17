# PDF Viewing Implementation Guide

Complete implementation of PDF viewing functionality integrated with the FileViewer system.

## Features

### Core Functionality
- ✅ **PDF Detection Logic** - Automatic detection via MIME type and file extension
- ✅ **Open in New Tab** - Leverages native browser PDF support (default and recommended)
- ✅ **PDF Thumbnail Generation** - First page preview with configurable sizes
- ✅ **Browser Fallback** - Graceful handling for browsers without inline PDF support
- ✅ **PDF-Specific Icons** - Red PDF icon with proper styling
- ✅ **Download Option** - Always available download functionality
- ✅ **Large File Handling** - Automatic optimizations for files > 100MB

### Advanced Features
- Modal viewing mode with zoom controls
- Inline viewing mode for embedded use
- Security validation and warnings
- Loading states and error handling
- Progress indicators for large files
- Configurable view modes
- Multiple thumbnail sizes (small, medium, large)

## File Structure

```
/home/kennedy/repositories/web/src/
├── components/file/
│   ├── pdf-viewer.tsx           # Main PDF viewer component
│   ├── pdf-viewer-demo.tsx      # Demo and usage examples
│   ├── file-viewer.tsx          # Updated with PDF modal support
│   ├── file-thumbnail.tsx       # Updated with PDF thumbnail support
│   └── file-item.tsx            # Updated with PDF handling
├── utils/
│   ├── file-viewer.ts           # Updated with PDF detection and validation
│   └── pdf-thumbnail.ts         # PDF thumbnail utilities
└── types/
    └── file.ts                  # File type definitions
```

## Components

### PDFViewer

Main component for displaying PDFs with three viewing modes.

**Props:**
```typescript
interface PDFViewerProps {
  file: AnkaaFile;              // File metadata
  url: string;                  // URL to PDF file
  open: boolean;                // Modal open state
  onOpenChange: (open: boolean) => void;
  mode?: "modal" | "new-tab" | "inline";  // Default: "new-tab"
  onDownload?: (file: AnkaaFile) => void;
  maxFileSize?: number;         // In bytes, default 50MB
  showToolbar?: boolean;        // Default: true
  className?: string;
}
```

**Modes:**

1. **new-tab** (Recommended)
   - Opens PDF in new browser tab
   - Uses native browser PDF viewer
   - Best performance and UX
   - Popup blocker friendly

2. **modal**
   - Opens PDF in modal dialog
   - Includes zoom controls
   - Good for quick previews
   - May struggle with large files

3. **inline**
   - Embeds PDF directly in page
   - No modal overlay
   - Useful for dedicated PDF pages

**Usage:**
```tsx
import { PDFViewer } from "@/components/file";

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <PDFViewer
      file={pdfFile}
      url={pdfUrl}
      open={open}
      onOpenChange={setOpen}
      mode="new-tab"
      onDownload={handleDownload}
    />
  );
}
```

### PDF Thumbnail Utilities

Helper functions for generating and managing PDF thumbnails.

**Functions:**

```typescript
// Get PDF thumbnail URL
getPDFThumbnailUrl(file: AnkaaFile, options?: {
  size?: "small" | "medium" | "large";
  page?: number;  // Default: 1
  width?: number;
  height?: number;
  quality?: number;  // 0-100, default: 85
}): string

// Check if file is a PDF
isPDFFile(file: AnkaaFile): boolean

// Validate PDF file
validatePDFFile(file: AnkaaFile, options?: {
  maxFileSize?: number;
  requireThumbnail?: boolean;
}): PDFValidationResult

// Get PDF metadata
getPDFMetadata(file: AnkaaFile): Promise<PDFMetadata | null>

// Preload thumbnail
preloadPDFThumbnail(file: AnkaaFile, options?: PDFThumbnailOptions): Promise<void>
```

**Usage:**
```typescript
import { getPDFThumbnailUrl, isPDFFile } from "@/utils/pdf-thumbnail";

// Get thumbnail for display
const thumbnailUrl = getPDFThumbnailUrl(file, { size: "medium" });

// Check if PDF
if (isPDFFile(file)) {
  // Handle PDF-specific logic
}
```

## Integration with FileViewer

The PDF functionality is fully integrated with the FileViewer system.

### Configuration

```typescript
import { FileViewerProvider } from "@/components/file";

function App() {
  return (
    <FileViewerProvider
      config={{
        pdfViewMode: "new-tab",           // Default: "new-tab"
        pdfMaxFileSize: 50 * 1024 * 1024, // 50MB
        enableSecurity: true,
      }}
      baseUrl="http://localhost:3030"
    >
      {children}
    </FileViewerProvider>
  );
}
```

### Using Context

```typescript
import { useFileViewer } from "@/components/file";

function FileButton({ file }: { file: AnkaaFile }) {
  const { actions } = useFileViewer();

  return (
    <button onClick={() => actions.viewFile(file)}>
      View File
    </button>
  );
}
```

The `viewFile` action automatically:
- Detects if file is a PDF
- Validates file size and security
- Opens in appropriate mode
- Shows warnings if needed
- Handles errors gracefully

## PDF Detection Logic

PDFs are detected using multiple strategies:

1. **MIME Type Check**
   ```typescript
   file.mimetype === "application/pdf"
   ```

2. **Extension Check**
   ```typescript
   file.filename.endsWith(".pdf")
   ```

3. **Category Detection**
   ```typescript
   detectFileCategory(file) === "pdfs"
   ```

The system prioritizes MIME type but falls back to extension if needed.

## Error Handling

The PDF viewer includes comprehensive error handling:

### Browser Support
```typescript
// Checks for native PDF support
const supportsInlineViewing = checkBrowserPDFSupport();

if (!supportsInlineViewing) {
  // Shows fallback UI with download/new-tab options
}
```

### File Size Warnings
- Files > 50MB: Warning about inline viewing
- Files > 100MB: Automatically opens in new tab
- Configurable limits via `pdfMaxFileSize`

### Load Failures
```typescript
// iframe error handling
onError={() => {
  setLoadState({
    status: "error",
    error: "Failed to load PDF"
  });
  // Shows retry, new-tab, and download options
}}
```

### Security Validation
```typescript
const validation = validatePDFFile(file, config);

if (!validation.isValid) {
  // Force download mode
  return {
    type: "download",
    warnings: validation.warnings
  };
}
```

## Large File Handling

Special optimizations for large PDFs:

1. **Automatic Mode Selection**
   - Files > 100MB always open in new tab
   - Overrides config settings
   - Prevents browser crashes

2. **Progress Indicators**
   - Loading spinner while PDF loads
   - Smooth opacity transition on load
   - Timeout handling

3. **Performance Optimizations**
   - Lazy loading of thumbnails
   - Debounced zoom controls
   - Efficient iframe refresh

## Thumbnail Generation

### Size Presets
```typescript
const sizes = {
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 }
};
```

### API Endpoints
```
GET /files/thumbnail/:id?size=medium&page=1&quality=85
```

### Caching Strategy
- Browser-side caching via standard HTTP headers
- Thumbnail URLs include file ID for cache busting
- Optional client-side preloading

## Styling

PDF-specific styling conventions:

```tsx
// Icon
<IconFileTypePdf className="h-5 w-5 text-red-500" />

// Thumbnail border
<img className="border-2 border-red-200" />

// Container background
<div className="bg-white" /> // For PDF thumbnails
```

## Configuration Presets

Three built-in configuration presets:

### Secure (Default)
```typescript
{
  enableSecurity: true,
  maxFileSize: 100 * 1024 * 1024,      // 100MB
  pdfViewMode: "new-tab",
  pdfMaxFileSize: 50 * 1024 * 1024     // 50MB
}
```

### Permissive
```typescript
{
  enableSecurity: false,
  maxFileSize: 500 * 1024 * 1024,      // 500MB
  pdfViewMode: "modal",
  pdfMaxFileSize: 100 * 1024 * 1024    // 100MB
}
```

### Custom
```typescript
{
  enableSecurity: true,
  maxFileSize: 200 * 1024 * 1024,      // 200MB
  pdfViewMode: "modal",
  pdfMaxFileSize: 75 * 1024 * 1024     // 75MB
}
```

## Backend Requirements

The PDF functionality expects the following backend endpoints:

### File Serving
```
GET /files/serve/:id
Returns: PDF file with proper Content-Type
```

### File Download
```
GET /files/:id/download
Returns: PDF file with Content-Disposition: attachment
```

### Thumbnail Generation
```
GET /files/thumbnail/:id?size=medium&page=1&quality=85
Returns: JPEG/PNG image of PDF page
```

### Metadata (Optional)
```
GET /files/:id/metadata
Returns: { pages, title, author, etc. }
```

## Testing

### Test Cases

1. **PDF Detection**
   - Test with `application/pdf` MIME type
   - Test with `.pdf` extension
   - Test with incorrect MIME but correct extension
   - Test with non-PDF files

2. **View Modes**
   - Test new-tab mode opens correctly
   - Test modal mode displays with toolbar
   - Test inline mode embeds properly
   - Test mode switching

3. **File Sizes**
   - Test small PDF (< 1MB)
   - Test medium PDF (1-50MB)
   - Test large PDF (50-100MB)
   - Test very large PDF (> 100MB)
   - Verify warnings and automatic mode selection

4. **Error Handling**
   - Test with missing file
   - Test with invalid URL
   - Test with unsupported browser
   - Test with blocked popup
   - Test iframe load failure

5. **Thumbnails**
   - Test thumbnail generation
   - Test different sizes
   - Test fallback when unavailable
   - Test loading states

## Browser Compatibility

| Browser | New Tab | Modal | Inline | Notes |
|---------|---------|-------|--------|-------|
| Chrome 90+ | ✅ | ✅ | ✅ | Full support |
| Firefox 88+ | ✅ | ✅ | ✅ | Full support |
| Safari 14+ | ✅ | ✅ | ✅ | Full support |
| Edge 90+ | ✅ | ✅ | ✅ | Full support |
| Mobile Safari | ✅ | ⚠️ | ⚠️ | Prefer new-tab |
| Mobile Chrome | ✅ | ⚠️ | ⚠️ | Prefer new-tab |

⚠️ = Works but may have limitations

## Performance Considerations

1. **Lazy Loading**
   - Thumbnails load on demand
   - PDF content only loads when viewed
   - Defer non-critical resources

2. **Memory Management**
   - Close modals to free memory
   - Limit concurrent PDF views
   - Use new-tab for large files

3. **Network Optimization**
   - Stream PDFs rather than full download
   - Compress thumbnails
   - Use appropriate cache headers

## Security Considerations

1. **File Validation**
   - Always validate MIME type on backend
   - Check file size limits
   - Scan for malware if needed

2. **XSS Prevention**
   - PDFs opened in new tab (sandboxed)
   - No inline HTML in PDF content
   - Sanitize file metadata

3. **CORS Configuration**
   - Allow appropriate origins
   - Set secure headers
   - Handle authentication

## Troubleshooting

### PDF doesn't open in new tab
- Check popup blocker settings
- Ensure URL is accessible
- Verify CORS configuration

### Modal shows blank/error
- Check browser PDF support
- Verify file URL is valid
- Check console for errors
- Try new-tab mode instead

### Thumbnails not loading
- Verify backend thumbnail endpoint
- Check file permissions
- Ensure PDF is valid
- Review network requests

### Large files timeout
- Increase timeout limits
- Use new-tab mode for large files
- Optimize PDF file size
- Implement streaming

## Future Enhancements

Potential improvements:

1. **Client-side PDF.js Integration**
   - Full PDF rendering in browser
   - Page-by-page navigation
   - Text selection and search
   - Annotations support

2. **Advanced Thumbnails**
   - Multiple page previews
   - Animated page flip
   - Hover preview
   - Page count badge

3. **Performance**
   - Progressive loading
   - Streaming support
   - Worker thread rendering
   - Better caching

4. **Features**
   - Print functionality
   - Full-screen mode
   - Page bookmarks
   - PDF form support

## Examples

See `pdf-viewer-demo.tsx` for complete working examples of:
- All three view modes
- FileViewer context integration
- Error handling scenarios
- Configuration options
- Custom styling

## Support

For issues or questions:
1. Check this documentation
2. Review `pdf-viewer-demo.tsx` examples
3. Inspect browser console
4. Verify backend endpoints
5. Check file permissions
