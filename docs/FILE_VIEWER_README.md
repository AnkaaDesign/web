# File Viewer System Documentation

Comprehensive documentation for the unified File Viewer system.

## Overview

The File Viewer system provides a complete, production-ready solution for viewing, previewing, and managing files in your React application. It handles images, videos, PDFs, documents, and more with a consistent, accessible interface.

### Key Features

- **Universal File Support** - Handles 30+ file types
- **Smart Preview** - Automatic preview for images, videos, PDFs
- **Gallery Mode** - Navigate through multiple images with keyboard/gestures
- **Video Player** - Full-featured player with controls
- **PDF Viewer** - Multiple viewing modes (new tab, modal, inline)
- **Security Built-in** - Validates files and warns about dangerous types
- **Thumbnail Generation** - Automatic thumbnails for supported types
- **Accessibility** - WCAG 2.1 AA compliant
- **Performance** - Code splitting, lazy loading, caching
- **TypeScript** - Full type safety
- **Responsive** - Works on desktop, tablet, mobile

---

## Quick Start

### Installation

The File Viewer is already included in the project. No additional installation needed.

### Basic Usage

1. **Wrap your app with the provider:**

```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';

function App() {
  return (
    <FileViewerProvider baseUrl="https://api.example.com">
      <YourApp />
    </FileViewerProvider>
  );
}
```

2. **Display files with cards:**

```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';

function FileList({ files }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map(file => (
        <FileViewerCard
          key={file.id}
          file={file}
          size="md"
          showName
          enableHover
        />
      ))}
    </div>
  );
}
```

3. **Use the viewer hook:**

```typescript
import { useFileViewer } from '@/components/file/file-viewer';

function FileActions({ file }) {
  const { actions } = useFileViewer();

  return (
    <button onClick={() => actions.viewFile(file)}>
      View File
    </button>
  );
}
```

That's it! The system automatically handles:
- File type detection
- Appropriate viewer selection
- Modal management
- Downloads
- Error handling

---

## Documentation Index

### 1. [API Reference](./FILE_VIEWER_API.md)
Complete API documentation for all components, hooks, and services.

**Contents:**
- Core Services (`fileViewerService`)
- React Components (`FileViewerProvider`, `FileViewerCard`, etc.)
- React Hooks (`useFileViewer`, `useFileViewerStandalone`)
- Type Definitions
- Configuration Options
- Utility Functions

**When to use:** Reference for component props, function signatures, and types.

---

### 2. [Usage Examples](./FILE_VIEWER_USAGE_EXAMPLES.md)
Practical examples and code patterns for common scenarios.

**Contents:**
- Basic Usage Patterns
- Advanced Patterns
- Common Scenarios (email attachments, product galleries, etc.)
- Integration Examples (React Query, infinite scroll)
- Custom Implementations
- Performance Optimization
- Testing Examples

**When to use:** Looking for code examples and best practices.

---

### 3. [File Type Support Matrix](./FILE_VIEWER_FILE_TYPE_SUPPORT.md)
Comprehensive reference for which file types are supported and how.

**Contents:**
- Quick Reference Table
- Detailed breakdown by file type:
  - Images (JPEG, PNG, GIF, WebP, SVG, etc.)
  - Videos (MP4, WebM, MOV, etc.)
  - PDFs
  - Documents (DOCX, TXT, etc.)
  - Spreadsheets (XLSX, CSV)
  - Presentations (PPTX)
  - Audio (MP3, WAV, etc.)
  - Archives (ZIP, RAR, etc.)
  - Vector Graphics (EPS, AI, SVG)
- Browser Compatibility
- Performance Recommendations

**When to use:** Need to know if a file type is supported or how it's handled.

---

### 4. [Testing Checklist](./FILE_VIEWER_TESTING_CHECKLIST.md)
Comprehensive testing scenarios and checklist.

**Contents:**
- Testing Environment Setup
- Unit Tests
- Integration Tests
- Manual Testing Scenarios
  - All file types
  - Error scenarios
  - Edge cases
- Performance Testing
- Security Testing
- Accessibility Testing
- Cross-Browser Testing
- Mobile/Responsive Testing
- Sign-off Checklist

**When to use:** Planning or executing tests for the file viewer.

---

### 5. [Migration Guide](./FILE_VIEWER_MIGRATION_GUIDE.md)
Step-by-step guide for migrating from old file viewing components.

**Contents:**
- Migration Strategy
- Component Mapping (old → new)
- Step-by-Step Instructions
- Breaking Changes
- Code Examples
- Testing After Migration
- Rollback Plan

**When to use:** Migrating from old file viewing system to new unified system.

---

## Architecture

### Component Hierarchy

```
FileViewerProvider (Context)
├── Your App Components
│   ├── FileViewerCard (Display)
│   ├── FileViewerButton (Action)
│   └── Custom Components using useFileViewer()
└── Global Modals (Managed by Provider)
    ├── FilePreview (Image Modal)
    ├── VideoPlayer (Video Modal)
    └── PDFViewer (PDF Modal)
```

### Data Flow

```
User clicks file
    ↓
FileViewerCard/Button
    ↓
useFileViewer hook
    ↓
fileViewerService.viewFile()
    ↓
determineFileViewAction()
    ↓
executeFileViewAction()
    ↓
┌─────────────┬──────────────┬──────────────┐
│ Modal       │ New Tab      │ Download     │
└─────────────┴──────────────┴──────────────┘
```

### File Type Detection

```
File object
    ↓
detectFileCategory()
    ↓
Check MIME type
    ↓
Fall back to extension
    ↓
Return category: images, pdfs, videos, etc.
    ↓
Determine appropriate action
```

---

## Core Concepts

### 1. File Categories

Files are categorized into groups that share similar handling:

- **images** - JPEG, PNG, GIF, WebP, SVG → Image Modal
- **videos** - MP4, WebM, MOV → Video Player
- **pdfs** - PDF → New Tab or Modal
- **documents** - DOCX, TXT → Download
- **spreadsheets** - XLSX, CSV → Download
- **presentations** - PPTX → Download
- **audio** - MP3, WAV → Download (future: player)
- **archives** - ZIP, RAR → Download
- **eps** - EPS, AI → Download or Preview (if thumbnail)
- **other** - Everything else → Download

### 2. Actions

Based on file category, the system determines an action:

- **modal** - Opens viewer modal (images, videos)
- **new-tab** - Opens in new browser tab (PDFs)
- **inline** - Embeds in page (future: audio)
- **download** - Downloads to device
- **not-supported** - Shows error

### 3. Security

Files are validated for:
- Dangerous file types (.exe, .bat, etc.)
- XSS risks (HTML, JavaScript files)
- File size limits
- Path traversal attempts

Security warnings are shown to users, and dangerous files can be blocked.

### 4. Thumbnails

Thumbnails are generated for:
- **Images** - Direct from file
- **Videos** - First frame extraction (server)
- **PDFs** - First page render (server)
- **Documents** - Preview image (server)
- **EPS/AI** - Rasterized preview (server)

Three sizes available:
- Small: 150x150px
- Medium: 300x300px
- Large: 600x600px

---

## Configuration

### Provider Configuration

```typescript
<FileViewerProvider
  config={{
    enableSecurity: true,
    maxFileSize: 200 * 1024 * 1024,      // 200MB
    pdfViewMode: "new-tab",
    pdfMaxFileSize: 50 * 1024 * 1024     // 50MB
  }}
  baseUrl="https://api.example.com"
  onDownload={(file, url) => {
    // Custom download handling
  }}
  onSecurityWarning={(warnings, file) => {
    // Custom security warning handling
  }}
>
```

### Configuration Presets

```typescript
import { fileViewerService } from '@/utils/file-viewer';

// Secure preset (recommended for production)
const secureConfig = fileViewerService.configs.secure;

// Permissive preset (for internal tools)
const permissiveConfig = fileViewerService.configs.permissive;

// Default preset
const defaultConfig = fileViewerService.configs.default;
```

### Environment Variables

```bash
# .env file
VITE_API_URL=https://api.example.com
```

Or set at runtime:
```html
<script>
  window.__ANKAA_API_URL__ = 'https://api.example.com';
</script>
```

---

## Common Patterns

### Pattern 1: Simple File Display

```typescript
<FileViewerCard
  file={file}
  size="md"
  showName
  showSize
/>
```

### Pattern 2: Image Gallery

```typescript
const { actions } = useFileViewer();

<div className="grid grid-cols-3 gap-2">
  {images.map((img, i) => (
    <img
      src={img.thumbnailUrl}
      onClick={() => actions.openImageModal(images, i)}
    />
  ))}
</div>
```

### Pattern 3: File List with Actions

```typescript
const { actions } = useFileViewer();

files.map(file => (
  <div>
    <FileIcon file={file} />
    <span>{file.filename}</span>
    <button onClick={() => actions.viewFile(file)}>View</button>
    <button onClick={() => actions.downloadFile(file)}>Download</button>
  </div>
))
```

### Pattern 4: Standalone Usage

```typescript
const viewer = useFileViewerStandalone();

<button onClick={() => viewer.viewFile(file)}>
  {viewer.canPreview(file) ? 'Preview' : 'Download'}
</button>
```

---

## Best Practices

### 1. Performance

✅ **DO:**
- Use lazy loading for large file lists
- Implement virtual scrolling for 100+ files
- Request appropriate thumbnail sizes
- Cache file metadata

❌ **DON'T:**
- Load all file data at once
- Use large thumbnails unnecessarily
- Skip lazy loading attributes
- Forget to cleanup on unmount

### 2. Security

✅ **DO:**
- Enable security validation in production
- Show security warnings to users
- Log security events
- Use appropriate file size limits

❌ **DON'T:**
- Disable security without reason
- Ignore security warnings
- Allow unlimited file sizes
- Trust client-side validation only

### 3. User Experience

✅ **DO:**
- Show file size before download
- Provide preview when possible
- Use appropriate loading states
- Handle errors gracefully

❌ **DON'T:**
- Auto-download large files
- Hide file type information
- Leave users in loading state
- Show technical error messages

### 4. Accessibility

✅ **DO:**
- Use keyboard shortcuts
- Provide ARIA labels
- Ensure color contrast
- Support screen readers

❌ **DON'T:**
- Rely only on mouse
- Forget alt text for images
- Use poor color contrast
- Ignore accessibility warnings

---

## Troubleshooting

### Issue: Files won't preview

**Possible causes:**
- File type not supported
- Corrupted file
- Network error
- Missing thumbnails

**Solutions:**
1. Check file type in support matrix
2. Verify file isn't corrupted
3. Check browser console for errors
4. Ensure thumbnail service running

### Issue: Provider not working

**Error:** "useFileViewer must be used within a FileViewerProvider"

**Solution:** Wrap your components with FileViewerProvider

### Issue: Slow performance

**Symptoms:**
- Long load times
- Laggy interactions
- High memory usage

**Solutions:**
- Implement virtual scrolling
- Use smaller thumbnail sizes
- Enable lazy loading
- Code split components

### Issue: Security warnings

**Symptoms:**
- Warning toasts appearing
- Files forcing download

**Solutions:**
- Check if warnings are valid
- Adjust security config if needed
- Scan files before upload
- Educate users on file types

---

## Browser Support

### Desktop
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Mobile
- iOS Safari 14+ ✅
- Chrome Android 90+ ✅
- Samsung Internet 14+ ✅

### Features by Browser

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Image Preview | ✅ | ✅ | ✅ | ✅ |
| Video (MP4) | ✅ | ✅ | ✅ | ✅ |
| Video (WebM) | ✅ | ✅ | ⚠️ | ✅ |
| PDF Preview | ✅ | ✅ | ✅ | ✅ |
| SVG Display | ✅ | ✅ | ✅ | ✅ |
| WebP Support | ✅ | ✅ | ✅ | ✅ |

---

## Performance Benchmarks

### Typical Load Times

| Scenario | Time | Notes |
|----------|------|-------|
| Initial Load | <2s | First component mount |
| Thumbnail Load | <500ms | Single thumbnail |
| Image Modal Open | <200ms | From thumbnail click |
| Gallery Navigate | <100ms | Next/prev image |
| Video Start | <2s | From modal open |
| PDF Open | <1s | New tab opening |

### Memory Usage

| Scenario | Memory | Notes |
|----------|--------|-------|
| 10 thumbnails | ~5MB | Includes images |
| 100 thumbnails | ~30MB | With virtual scroll |
| Image modal open | ~10MB | High-res image |
| Video playing | ~50MB | Depends on quality |

---

## Roadmap

### Current Version (v1.0)
- ✅ Image viewer with gallery
- ✅ Video player with controls
- ✅ PDF viewer (new tab/modal)
- ✅ File type detection
- ✅ Security validation
- ✅ Thumbnail generation
- ✅ Accessibility support

### Planned Features (v1.1)
- ⏳ Audio player
- ⏳ PDF modal viewer with toolbar
- ⏳ Document preview (Office files)
- ⏳ CSV/Excel table viewer
- ⏳ Archive content browser

### Future Considerations (v2.0)
- 💭 3D model viewer
- 💭 Code syntax highlighting
- 💭 Markdown preview
- 💭 Multi-file compare
- 💭 Annotation tools
- 💭 OCR for images/PDFs

---

## Contributing

### Reporting Issues

When reporting issues, include:
1. File type and size
2. Browser and version
3. Error messages/console logs
4. Steps to reproduce
5. Screenshots or video

### Suggesting Features

Feature requests should include:
1. Use case description
2. Expected behavior
3. Current workaround (if any)
4. Importance/priority

### Code Contributions

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Test across browsers
5. Follow accessibility guidelines

---

## FAQ

### Q: Can I use this without the provider?

A: Yes, use `useFileViewerStandalone()` hook for standalone usage without context.

### Q: How do I customize the modals?

A: Pass custom `config` to provider, or use callbacks like `onDownload` for custom behavior.

### Q: What about file uploads?

A: The viewer handles display/preview only. Use separate upload component, then display with viewer.

### Q: Can I add custom file types?

A: Extend `detectFileCategory()` and add handling in `determineFileViewAction()`.

### Q: How are thumbnails generated?

A: Backend service generates thumbnails on upload. Frontend requests appropriate size.

### Q: What about file permissions?

A: File access control is handled by backend. Viewer assumes files are accessible.

### Q: Can I disable security validation?

A: Yes, set `enableSecurity: false` in config, but not recommended for production.

### Q: How do I handle very large files?

A: Set appropriate `maxFileSize` limits and show warnings to users.

---

## Support

### Documentation
- [API Reference](./FILE_VIEWER_API.md)
- [Usage Examples](./FILE_VIEWER_USAGE_EXAMPLES.md)
- [File Type Support](./FILE_VIEWER_FILE_TYPE_SUPPORT.md)
- [Testing Checklist](./FILE_VIEWER_TESTING_CHECKLIST.md)
- [Migration Guide](./FILE_VIEWER_MIGRATION_GUIDE.md)

### Getting Help
1. Check documentation
2. Search existing issues
3. Ask in team chat
4. Create detailed issue report

---

## License

Internal use only. See project license for details.

---

## Credits

Built with:
- React 19
- TypeScript
- Radix UI
- Tailwind CSS
- Tabler Icons

Maintained by the Frontend Team.

---

**Last Updated:** 2025-10-16
**Version:** 1.0.0
