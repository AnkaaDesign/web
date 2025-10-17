# File Viewer Migration Guide

Guide for migrating from old file viewing components to the new unified File Viewer system.

## Table of Contents
- [Overview](#overview)
- [Migration Strategy](#migration-strategy)
- [Component Mapping](#component-mapping)
- [Step-by-Step Migration](#step-by-step-migration)
- [Breaking Changes](#breaking-changes)
- [Code Examples](#code-examples)
- [Testing After Migration](#testing-after-migration)
- [Rollback Plan](#rollback-plan)

---

## Overview

### What's New

The new File Viewer system provides:

1. **Unified API** - Single service for all file operations
2. **Context Provider** - Shared state across components
3. **Better Performance** - Code splitting, lazy loading, caching
4. **Enhanced Security** - Built-in validation and warnings
5. **Improved UX** - Keyboard shortcuts, gestures, accessibility
6. **Type Safety** - Full TypeScript support
7. **Flexible Configuration** - Multiple presets and options

### Benefits of Migration

- **Reduced Code** - Less boilerplate
- **Consistency** - Uniform behavior across app
- **Better Maintenance** - Single source of truth
- **Future-Proof** - Easier to add new features
- **Better Testing** - Easier to mock and test

---

## Migration Strategy

### Phased Approach

**Phase 1: Non-Critical Areas (Week 1)**
- File lists in settings
- Profile picture displays
- Secondary image galleries

**Phase 2: Medium Priority (Week 2)**
- Document attachments
- Product images
- Report files

**Phase 3: Critical Features (Week 3)**
- Main file manager
- Email attachments
- Core document workflows

**Phase 4: Cleanup (Week 4)**
- Remove old components
- Update tests
- Documentation
- Performance optimization

### Risk Mitigation

1. **Feature Flags** - Enable/disable new viewer
2. **Parallel Running** - Keep both systems temporarily
3. **A/B Testing** - Gradual rollout
4. **Monitoring** - Track errors and performance
5. **Quick Rollback** - Ability to revert quickly

---

## Component Mapping

### Old → New Component Mapping

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `<ImagePreview />` | `<FilePreview />` | Enhanced with gallery support |
| `<FileCard />` | `<FileViewerCard />` | More features, better props |
| `<FileList />` | Custom with `<FileViewerCard />` | Use grid/list with cards |
| `<DocumentViewer />` | `fileViewerService.viewFile()` | Service-based approach |
| `<VideoModal />` | `<VideoPlayer mode="modal" />` | Built-in modal support |
| `<ThumbnailGrid />` | Grid of `<FileViewerCard />` | Automatic thumbnails |

### Service Function Mapping

| Old Function | New Function | Notes |
|-------------|--------------|-------|
| `getFileIcon(file)` | `fileViewerService.getFileTypeIcon(file)` | More file types |
| `getFileType(file)` | `fileViewerService.detectFileCategory(file)` | Better detection |
| `openFile(file)` | `fileViewerService.viewFile(file)` | Automatic action |
| `downloadFile(file)` | `fileViewerService.generateFileUrls(file).download` | More URL types |
| `isImage(file)` | `detectFileType(file) === 'image'` | Type-based check |

---

## Step-by-Step Migration

### Step 1: Install Dependencies (If Needed)

The new File Viewer uses existing dependencies, but verify:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.14",
    "@tabler/icons-react": "^3.34.0",
    "sonner": "^2.0.7"
  }
}
```

### Step 2: Add Provider to App Root

Wrap your app with `FileViewerProvider`:

**Before:**
```typescript
function App() {
  return (
    <Router>
      <Routes>
        {/* routes */}
      </Routes>
    </Router>
  );
}
```

**After:**
```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';

function App() {
  return (
    <FileViewerProvider
      baseUrl={process.env.VITE_API_URL}
      config={{
        enableSecurity: true,
        pdfViewMode: 'new-tab'
      }}
    >
      <Router>
        <Routes>
          {/* routes */}
        </Routes>
      </Router>
    </FileViewerProvider>
  );
}
```

### Step 3: Migrate Individual Components

#### Example 1: Simple Image Display

**Before:**
```typescript
function ProductImage({ file }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <img
        src={file.thumbnailUrl}
        onClick={() => setShowModal(true)}
        className="cursor-pointer"
      />

      {showModal && (
        <ImageModal
          file={file}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

**After:**
```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';

function ProductImage({ file }) {
  return (
    <FileViewerCard
      file={file}
      size="md"
      showName={false}
      enableHover
    />
  );
}
```

#### Example 2: File List

**Before:**
```typescript
function FileList({ files }) {
  const handleFileClick = (file) => {
    if (isImage(file)) {
      openImageModal(file);
    } else if (isPDF(file)) {
      window.open(`/files/${file.id}`, '_blank');
    } else {
      downloadFile(file);
    }
  };

  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.id} onClick={() => handleFileClick(file)}>
          <FileIcon type={getFileType(file)} />
          <span>{file.filename}</span>
          <span>{formatSize(file.size)}</span>
        </div>
      ))}
    </div>
  );
}
```

**After:**
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
          showSize
          enableHover
        />
      ))}
    </div>
  );
}
```

#### Example 3: Image Gallery

**Before:**
```typescript
function ImageGallery({ images }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, index) => (
          <img
            key={img.id}
            src={img.thumbnailUrl}
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      {selectedIndex !== null && (
        <ImageModal
          images={images}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNext={() => setSelectedIndex((selectedIndex + 1) % images.length)}
          onPrev={() => setSelectedIndex((selectedIndex - 1 + images.length) % images.length)}
        />
      )}
    </>
  );
}
```

**After:**
```typescript
import { useFileViewer } from '@/components/file/file-viewer';

function ImageGallery({ images }) {
  const { actions } = useFileViewer();

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((img, index) => (
        <img
          key={img.id}
          src={img.thumbnailUrl}
          onClick={() => actions.openImageModal(images, index)}
          className="cursor-pointer"
        />
      ))}
    </div>
  );
}
```

#### Example 4: Document Viewer

**Before:**
```typescript
function DocumentViewer({ file }) {
  const handleView = () => {
    const fileType = getFileType(file);

    switch (fileType) {
      case 'pdf':
        window.open(`/files/serve/${file.id}`, '_blank');
        break;
      case 'image':
        showImageModal(file);
        break;
      default:
        downloadFile(file);
    }
  };

  return (
    <button onClick={handleView}>
      View Document
    </button>
  );
}
```

**After:**
```typescript
import { FileViewerButton } from '@/components/file/file-viewer';

function DocumentViewer({ file }) {
  return (
    <FileViewerButton file={file} className="btn-primary">
      View Document
    </FileViewerButton>
  );
}
```

#### Example 5: File Manager

**Before:**
```typescript
function FileManager({ files }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleView = (file) => {
    setSelectedFile(file);
    // Complex modal logic
  };

  const handleDownload = (file) => {
    const link = document.createElement('a');
    link.href = `/api/files/${file.id}/download`;
    link.download = file.filename;
    link.click();
  };

  return (
    <div>
      {files.map(file => (
        <div key={file.id}>
          <FileCard
            file={file}
            onView={() => handleView(file)}
            onDownload={() => handleDownload(file)}
          />
        </div>
      ))}

      {selectedFile && (
        <FileViewerModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
```

**After:**
```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';
import { useFileViewer } from '@/components/file/file-viewer';

function FileManager({ files }) {
  const { actions } = useFileViewer();

  return (
    <div className="grid grid-cols-4 gap-4">
      {files.map(file => (
        <FileViewerCard
          key={file.id}
          file={file}
          size="md"
          showName
          showSize
          enableHover
          onClick={(file) => actions.viewFile(file)}
          onDownload={(file) => actions.downloadFile(file)}
        />
      ))}
    </div>
  );
}
```

### Step 4: Update Service Calls

**Before:**
```typescript
// utils/file-helpers.ts
export function getFileType(file: AnkaaFile): string {
  if (file.mimetype.startsWith('image/')) return 'image';
  if (file.mimetype === 'application/pdf') return 'pdf';
  return 'other';
}

export function openFile(file: AnkaaFile) {
  const type = getFileType(file);
  if (type === 'image') {
    // Show image modal
  } else if (type === 'pdf') {
    window.open(`/files/${file.id}`);
  } else {
    // Download
  }
}
```

**After:**
```typescript
import { fileViewerService } from '@/utils/file-viewer';

// Use service directly
const category = fileViewerService.detectFileCategory(file);
fileViewerService.viewFile(file, config);

// Or use standalone hook
import { useFileViewerStandalone } from '@/components/file/file-viewer';

function MyComponent() {
  const viewer = useFileViewerStandalone();

  const handleView = () => {
    viewer.viewFile(file);
  };
}
```

### Step 5: Update Tests

**Before:**
```typescript
describe('FileCard', () => {
  it('opens image modal on click', () => {
    const file = createMockFile({ mimetype: 'image/jpeg' });
    const onView = jest.fn();

    render(<FileCard file={file} onView={onView} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onView).toHaveBeenCalledWith(file);
  });
});
```

**After:**
```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';

describe('FileViewerCard', () => {
  it('opens image modal on click', () => {
    const file = createMockFile({ mimetype: 'image/jpeg' });

    render(
      <FileViewerProvider>
        <FileViewerCard file={file} />
      </FileViewerProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    // Modal opens automatically through context
  });
});
```

---

## Breaking Changes

### API Changes

1. **Provider Required**
   - Old: Components worked standalone
   - New: Must wrap with `FileViewerProvider` for context

2. **Prop Names**
   - `onView` → automatic (handled by context)
   - `onDownload` → optional custom handler
   - `showPreview` → `enableHover`
   - `imageSize` → `size` with different values

3. **Service Functions**
   - `getFileType()` → `detectFileCategory()` (returns different values)
   - `isImage()` → `detectFileType() === 'image'`

4. **Event Handlers**
   - onClick now automatically calls `viewFile()`
   - Custom onClick override available via prop

### Removed Features

1. **Custom Modal Components**
   - Old: Could pass custom modal component
   - New: Use built-in modals or standalone hook

2. **Manual Modal State**
   - Old: Manually manage modal open/close
   - New: Context handles automatically

3. **Direct URL Construction**
   - Old: Build URLs manually
   - New: Use `generateFileUrls()` service

### New Requirements

1. **TypeScript**
   - Better type safety
   - File type must match `AnkaaFile` interface

2. **React 18+**
   - Uses new context features
   - Concurrent rendering support

3. **Radix UI**
   - Dialog/Modal components
   - Better accessibility

---

## Code Examples

### Example 1: Email Attachments

**Before:**
```typescript
function EmailAttachments({ attachments }) {
  return (
    <div className="attachments">
      {attachments.map(file => (
        <div key={file.id} className="attachment-item">
          <FileIcon type={file.mimetype} />
          <span>{file.filename}</span>
          <button onClick={() => downloadFile(file)}>
            Download
          </button>
        </div>
      ))}
    </div>
  );
}
```

**After:**
```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';

function EmailAttachments({ attachments }) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map(file => (
        <FileViewerCard
          key={file.id}
          file={file}
          size="sm"
          showName
          enableHover
        />
      ))}
    </div>
  );
}
```

### Example 2: Product Gallery

**Before:**
```typescript
function ProductGallery({ product }) {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      <div className="main-image">
        <img src={product.images[0].url} />
      </div>

      <div className="thumbnails">
        {product.images.map((img, i) => (
          <img
            key={img.id}
            src={img.thumbnailUrl}
            onClick={() => setViewing(i)}
          />
        ))}
      </div>

      {viewing !== null && (
        <LightboxModal
          images={product.images}
          index={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
```

**After:**
```typescript
import { useFileViewer } from '@/components/file/file-viewer';

function ProductGallery({ product }) {
  const { actions } = useFileViewer();
  const [selected, setSelected] = useState(0);

  return (
    <>
      <div
        className="main-image cursor-zoom-in"
        onClick={() => actions.openImageModal(product.images, selected)}
      >
        <img src={product.images[selected].url} />
      </div>

      <div className="thumbnails flex gap-2">
        {product.images.map((img, i) => (
          <img
            key={img.id}
            src={img.thumbnailUrl}
            onClick={() => setSelected(i)}
            className={selected === i ? 'border-primary' : ''}
          />
        ))}
      </div>
    </>
  );
}
```

### Example 3: Document Upload

**Before:**
```typescript
function DocumentUpload() {
  const [files, setFiles] = useState([]);

  const handleUpload = async (newFiles) => {
    const uploaded = await uploadFiles(newFiles);
    setFiles([...files, ...uploaded]);
  };

  const handleRemove = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  return (
    <div>
      <FileInput onChange={handleUpload} />

      <div className="file-list">
        {files.map(file => (
          <div key={file.id}>
            <FileIcon type={file.mimetype} />
            <span>{file.filename}</span>
            <button onClick={() => handleRemove(file.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**After:**
```typescript
import { FileViewerCard } from '@/components/file/file-viewer-card';

function DocumentUpload() {
  const [files, setFiles] = useState([]);

  const handleUpload = async (newFiles) => {
    const uploaded = await uploadFiles(newFiles);
    setFiles([...files, ...uploaded]);
  };

  const handleRemove = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  return (
    <div>
      <FileInput onChange={handleUpload} />

      <div className="grid grid-cols-4 gap-4">
        {files.map(file => (
          <div key={file.id} className="relative">
            <FileViewerCard
              file={file}
              size="sm"
              showName
            />
            <button
              onClick={() => handleRemove(file.id)}
              className="absolute -top-2 -right-2 btn-icon-danger"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Testing After Migration

### Unit Tests

Test individual components:

```typescript
import { render, screen } from '@testing-library/react';
import { FileViewerProvider } from '@/components/file/file-viewer';
import { FileViewerCard } from '@/components/file/file-viewer-card';

describe('Migrated FileViewerCard', () => {
  it('renders correctly', () => {
    const file = createMockFile();

    render(
      <FileViewerProvider>
        <FileViewerCard file={file} showName />
      </FileViewerProvider>
    );

    expect(screen.getByText(file.filename)).toBeInTheDocument();
  });

  it('handles click events', () => {
    const file = createMockFile({ mimetype: 'image/jpeg' });

    render(
      <FileViewerProvider>
        <FileViewerCard file={file} />
      </FileViewerProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    // Assert modal opens
  });
});
```

### Integration Tests

Test complete workflows:

```typescript
describe('File Upload and Preview Workflow', () => {
  it('uploads file and shows in gallery', async () => {
    render(
      <FileViewerProvider>
        <DocumentUploadPage />
      </FileViewerProvider>
    );

    // Upload file
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Upload file');
    await userEvent.upload(input, file);

    // Wait for upload
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });

    // Click to preview
    const thumbnail = screen.getByRole('img', { name: 'test.jpg' });
    await userEvent.click(thumbnail);

    // Assert modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

Use tools like Percy or Chromatic:

```typescript
describe('Visual Regression', () => {
  it('matches screenshot for file grid', () => {
    const files = createMockFiles(12);

    const { container } = render(
      <FileViewerProvider>
        <FileGrid files={files} />
      </FileViewerProvider>
    );

    expect(container).toMatchImageSnapshot();
  });
});
```

---

## Rollback Plan

### Quick Rollback

If issues arise, you can quickly rollback:

1. **Feature Flag**
   ```typescript
   const USE_NEW_FILE_VIEWER = false;

   function App() {
     if (USE_NEW_FILE_VIEWER) {
       return <NewFileViewer />;
     } else {
       return <OldFileViewer />;
     }
   }
   ```

2. **Git Revert**
   ```bash
   git revert <migration-commit-hash>
   git push
   ```

3. **Gradual Rollback**
   - Revert one feature at a time
   - Monitor for improvements
   - Fix issues in new system

### Monitoring

Monitor these metrics after migration:

1. **Error Rate**
   - JavaScript errors
   - Failed file loads
   - API errors

2. **Performance**
   - Page load time
   - Time to first file display
   - Modal open time

3. **User Behavior**
   - File view success rate
   - Download rate
   - Support tickets

### Rollback Triggers

Rollback if:
- Error rate increases >20%
- Performance degrades >30%
- Critical feature broken
- Multiple user complaints

---

## Migration Checklist

### Pre-Migration
- [ ] Review all file-related components
- [ ] Identify custom file handling logic
- [ ] Plan migration phases
- [ ] Set up feature flags
- [ ] Create rollback plan
- [ ] Update documentation

### During Migration
- [ ] Add FileViewerProvider to app root
- [ ] Migrate non-critical components first
- [ ] Update imports and component names
- [ ] Test each migrated component
- [ ] Update tests
- [ ] Monitor error rates

### Post-Migration
- [ ] Remove old components
- [ ] Remove unused imports
- [ ] Update documentation
- [ ] Notify team
- [ ] Monitor performance
- [ ] Gather user feedback

---

## Common Pitfalls

### 1. Forgetting Provider

**Error:** "useFileViewer must be used within a FileViewerProvider"

**Solution:** Wrap app or component tree with provider

```typescript
<FileViewerProvider>
  <YourComponents />
</FileViewerProvider>
```

### 2. Wrong File Type

**Error:** TypeScript errors about file properties

**Solution:** Ensure file object matches `AnkaaFile` interface

```typescript
interface AnkaaFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  thumbnailUrl?: string;
}
```

### 3. Missing baseUrl

**Issue:** Files load from wrong URL

**Solution:** Set baseUrl in provider or config

```typescript
<FileViewerProvider baseUrl="https://api.example.com">
```

### 4. Slow Initial Load

**Issue:** Large bundle size

**Solution:** Use code splitting

```typescript
const FileViewerProvider = lazy(() =>
  import('@/components/file/file-viewer')
);
```

---

## Support Resources

### Documentation
- [API Reference](./FILE_VIEWER_API.md)
- [Usage Examples](./FILE_VIEWER_USAGE_EXAMPLES.md)
- [File Type Support](./FILE_VIEWER_FILE_TYPE_SUPPORT.md)
- [Testing Checklist](./FILE_VIEWER_TESTING_CHECKLIST.md)

### Getting Help
1. Check documentation first
2. Search existing issues
3. Ask in team chat
4. Create detailed bug report

### Reporting Issues

Include:
- File type and size
- Browser and version
- Error messages
- Steps to reproduce
- Screenshots/videos

---

## Success Criteria

Migration is successful when:
- [ ] All old components removed
- [ ] No file-related bugs reported
- [ ] Performance equal or better
- [ ] All tests passing
- [ ] Team trained on new system
- [ ] Documentation complete
- [ ] User feedback positive

---

## Timeline Estimate

### Small App (< 10 file components)
- Migration: 2-3 days
- Testing: 1-2 days
- Cleanup: 1 day
- **Total: ~1 week**

### Medium App (10-30 file components)
- Migration: 1-2 weeks
- Testing: 3-5 days
- Cleanup: 2-3 days
- **Total: ~2-3 weeks**

### Large App (> 30 file components)
- Migration: 2-4 weeks
- Testing: 1-2 weeks
- Cleanup: 1 week
- **Total: ~4-7 weeks**

---

## Conclusion

The migration to the new File Viewer system provides significant benefits in terms of maintainability, performance, and user experience. By following this guide and taking a phased approach, you can safely migrate your application with minimal risk.

Remember to:
- Test thoroughly at each phase
- Monitor metrics closely
- Have a rollback plan ready
- Communicate with your team
- Document any custom solutions

Good luck with your migration!
