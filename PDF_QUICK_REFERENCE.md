# PDF Viewing - Quick Reference Card

## 🎯 TL;DR

PDF viewing is fully implemented and integrated. PDFs automatically open in new browser tabs using native PDF support.

## 🔥 Common Usage Patterns

### 1. Automatic (Recommended)
```tsx
import { FileViewerProvider, useFileViewer } from "@/components/file";

// Setup once in your app
<FileViewerProvider config={{ pdfViewMode: "new-tab" }}>
  {children}
</FileViewerProvider>

// Use anywhere
const { actions } = useFileViewer();
<button onClick={() => actions.viewFile(file)}>View</button>
```

### 2. Direct Component
```tsx
import { PDFViewer } from "@/components/file";

<PDFViewer
  file={pdfFile}
  url={pdfUrl}
  open={open}
  onOpenChange={setOpen}
  mode="new-tab"
/>
```

### 3. Get PDF Thumbnail
```tsx
import { getPDFThumbnailUrl } from "@/utils/pdf-thumbnail";

const thumbUrl = getPDFThumbnailUrl(file, { size: "medium" });
<img src={thumbUrl} alt={file.filename} />
```

## 📋 Key Files

| File | Purpose |
|------|---------|
| `components/file/pdf-viewer.tsx` | Main viewer component |
| `utils/pdf-thumbnail.ts` | Thumbnail utilities |
| `utils/file-viewer.ts` | Detection & validation |
| `components/file/file-viewer.tsx` | Context integration |

## 🎨 View Modes

| Mode | When to Use |
|------|-------------|
| `new-tab` | Default, best for all cases |
| `modal` | Quick previews, small files |
| `inline` | Embedded in page |

## ⚙️ Configuration

```tsx
{
  pdfViewMode: "new-tab",           // new-tab | modal | inline
  pdfMaxFileSize: 50 * 1024 * 1024, // 50MB
  enableSecurity: true,
}
```

## 🛡️ Automatic Behaviors

- ✅ PDFs detected by MIME type and extension
- ✅ Files > 100MB automatically open in new tab
- ✅ Browser support detection with fallback
- ✅ Security validation and warnings
- ✅ Loading states and error handling

## 🔌 Backend Endpoints

```
GET /files/serve/:id              → Serve PDF
GET /files/:id/download           → Download PDF
GET /files/thumbnail/:id?size=... → Thumbnail
```

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| PDF won't open | Try `mode="new-tab"` |
| Thumbnail missing | Check backend endpoint |
| Large file slow | Use new-tab mode |
| Browser error | Check console, verify URL |

## 📊 Props Quick Ref

```typescript
// PDFViewer
file: AnkaaFile          // Required
url: string              // Required
open: boolean            // Required
onOpenChange: Function   // Required
mode?: string            // "new-tab" | "modal" | "inline"
onDownload?: Function    // Optional
maxFileSize?: number     // Optional (bytes)
showToolbar?: boolean    // Optional (default: true)
```

## 🎓 Examples

```tsx
// Example 1: New Tab (Default)
<PDFViewer
  file={file}
  url={url}
  open={open}
  onOpenChange={setOpen}
  mode="new-tab"
/>

// Example 2: Modal with Toolbar
<PDFViewer
  file={file}
  url={url}
  open={open}
  onOpenChange={setOpen}
  mode="modal"
  showToolbar={true}
/>

// Example 3: With Context
const { actions } = useFileViewer();
<button onClick={() => actions.viewFile(pdfFile)}>
  View PDF
</button>

// Example 4: Check if PDF
import { isPDFFile } from "@/utils/pdf-thumbnail";
if (isPDFFile(file)) {
  // Handle PDF
}

// Example 5: Get Thumbnail
import { getPDFThumbnailUrl } from "@/utils/pdf-thumbnail";
const url = getPDFThumbnailUrl(file, {
  size: "medium",
  page: 1,
  quality: 85
});
```

## 📦 Imports

```typescript
// Components
import { PDFViewer } from "@/components/file";
import { FileViewerProvider, useFileViewer } from "@/components/file";

// Utils
import { isPDFFile, getPDFThumbnailUrl } from "@/utils/pdf-thumbnail";
import { fileViewerService } from "@/utils/file-viewer";

// Types
import type { PDFViewerProps } from "@/components/file";
import type { FileViewerConfig } from "@/utils/file-viewer";
```

## ✅ Features Checklist

All implemented and working:

- [x] PDF detection (MIME + extension)
- [x] Open in new tab
- [x] Modal viewer
- [x] Inline viewer
- [x] Thumbnail generation
- [x] Download functionality
- [x] Large file handling (> 100MB)
- [x] Browser fallback
- [x] Error handling
- [x] Loading states
- [x] Security validation
- [x] Zoom controls (modal)
- [x] Context integration
- [x] Mobile support

## 🎯 Best Practices

1. **Always use new-tab mode** for best UX
2. **Set reasonable size limits** (50MB inline, 100MB max)
3. **Enable security validation** in production
4. **Provide download option** always
5. **Handle errors gracefully** with fallbacks
6. **Test on mobile** devices
7. **Monitor file sizes** and optimize
8. **Cache thumbnails** on backend

## 🔧 Common Tasks

### Change Default Mode
```tsx
<FileViewerProvider config={{ pdfViewMode: "modal" }}>
```

### Increase Size Limit
```tsx
<FileViewerProvider config={{ pdfMaxFileSize: 100 * 1024 * 1024 }}>
```

### Custom Download Handler
```tsx
<PDFViewer
  onDownload={(file) => {
    // Custom logic
    console.log("Downloading:", file.filename);
  }}
/>
```

### Preload Thumbnail
```tsx
import { preloadPDFThumbnail } from "@/utils/pdf-thumbnail";

await preloadPDFThumbnail(file, { size: "medium" });
```

## 📞 Support

1. Check `PDF_IMPLEMENTATION.md` for full docs
2. Review `pdf-viewer-demo.tsx` for examples
3. Inspect browser console for errors
4. Verify backend endpoints are working

---

**Quick Start:** Add `<FileViewerProvider>` to your app, then use `actions.viewFile(file)` anywhere. PDFs automatically open in new tabs. That's it! 🎉
