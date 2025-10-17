# File Viewer Usage Examples

Practical examples and patterns for using the File Viewer system.

## Table of Contents
- [Basic Usage](#basic-usage)
- [Advanced Patterns](#advanced-patterns)
- [Common Scenarios](#common-scenarios)
- [Integration Examples](#integration-examples)
- [Custom Implementations](#custom-implementations)
- [Performance Optimization](#performance-optimization)

---

## Basic Usage

### 1. Simple File List with Cards

Display a list of files with automatic thumbnails and click-to-view functionality.

```typescript
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';

function FileList({ files }: { files: AnkaaFile[] }) {
  return (
    <FileViewerProvider baseUrl="https://api.example.com">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
    </FileViewerProvider>
  );
}
```

---

### 2. Single File Viewer Button

Add a view button for a single file.

```typescript
import { FileViewerButton } from '@/components/file/file-viewer';

function FileRow({ file }: { file: AnkaaFile }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded">
      <div>
        <p className="font-medium">{file.filename}</p>
        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
      </div>

      <FileViewerButton file={file} className="btn-primary">
        View File
      </FileViewerButton>
    </div>
  );
}
```

---

### 3. Image Gallery

Display an image gallery with modal viewer.

```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';
import { useFileViewer } from '@/components/file/file-viewer';

function ImageGallery({ images }: { images: AnkaaFile[] }) {
  return (
    <FileViewerProvider>
      <GalleryContent images={images} />
    </FileViewerProvider>
  );
}

function GalleryContent({ images }: { images: AnkaaFile[] }) {
  const { actions } = useFileViewer();

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((img, index) => (
        <div
          key={img.id}
          className="aspect-square cursor-pointer overflow-hidden rounded-lg"
          onClick={() => actions.openImageModal(images, index)}
        >
          <img
            src={img.thumbnailUrl}
            alt={img.filename}
            className="w-full h-full object-cover hover:scale-110 transition-transform"
          />
        </div>
      ))}
    </div>
  );
}
```

---

### 4. Standalone File Viewer (No Context)

Use file viewer without the provider (for simple cases).

```typescript
import { useFileViewerStandalone } from '@/components/file/file-viewer';

function SimpleFileViewer({ file }: { file: AnkaaFile }) {
  const viewer = useFileViewerStandalone({
    enableSecurity: true,
    baseUrl: 'https://api.example.com'
  });

  return (
    <div>
      <button
        onClick={() => viewer.viewFile(file)}
        disabled={!viewer.canPreview(file)}
      >
        {viewer.canPreview(file) ? 'Preview' : 'Download'}
      </button>
    </div>
  );
}
```

---

## Advanced Patterns

### 1. File Upload with Preview

Upload files and immediately preview them.

```typescript
import { useState } from 'react';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';
import { useFileViewer } from '@/components/file/file-viewer';

function FileUploadWithPreview() {
  const [files, setFiles] = useState<AnkaaFile[]>([]);

  const handleUpload = async (uploadedFiles: File[]) => {
    // Upload files to server
    const newFiles = await uploadFiles(uploadedFiles);
    setFiles(prev => [...prev, ...newFiles]);
  };

  return (
    <FileViewerProvider>
      <div>
        <FileDropzone onUpload={handleUpload} />

        <div className="grid grid-cols-4 gap-4 mt-4">
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
      </div>
    </FileViewerProvider>
  );
}
```

---

### 2. File Manager with Actions

Complete file manager with view, download, and delete actions.

```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';
import { useFileViewer } from '@/components/file/file-viewer';

function FileManager({ files }: { files: AnkaaFile[] }) {
  return (
    <FileViewerProvider
      onDownload={(file, url) => {
        console.log('Downloading:', file.filename);
        // Custom download tracking
      }}
    >
      <FileManagerContent files={files} />
    </FileViewerProvider>
  );
}

function FileManagerContent({ files }: { files: AnkaaFile[] }) {
  const { actions } = useFileViewer();

  const handleDelete = async (file: AnkaaFile) => {
    if (confirm(`Delete ${file.filename}?`)) {
      await deleteFile(file.id);
    }
  };

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.id} className="flex items-center gap-4 p-4 border rounded">
          <FileIcon file={file} />

          <div className="flex-1">
            <p className="font-medium">{file.filename}</p>
            <p className="text-sm text-gray-500">
              {formatFileSize(file.size)} • {formatDate(file.createdAt)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => actions.viewFile(file)}
              className="btn-secondary"
            >
              View
            </button>
            <button
              onClick={() => actions.downloadFile(file)}
              className="btn-secondary"
            >
              Download
            </button>
            <button
              onClick={() => handleDelete(file)}
              className="btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### 3. Filtered File Browser

Browse files with type filters and search.

```typescript
import { useState, useMemo } from 'react';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';
import { detectFileType } from '@/components/file/file-viewer-card';

function FileBrowser({ files }: { files: AnkaaFile[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // Search filter
      if (search && !file.filename.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Type filter
      if (typeFilter && detectFileType(file) !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [files, search, typeFilter]);

  return (
    <FileViewerProvider>
      <div>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />

          <select
            value={typeFilter || ''}
            onChange={(e) => setTypeFilter(e.target.value || null)}
            className="select"
          >
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="pdf">PDFs</option>
            <option value="document">Documents</option>
          </select>
        </div>

        {/* File Grid */}
        <div className="grid grid-cols-4 gap-4">
          {filteredFiles.map(file => (
            <FileViewerCard
              key={file.id}
              file={file}
              size="md"
              showName
              showType
              enableHover
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No files found</p>
          </div>
        )}
      </div>
    </FileViewerProvider>
  );
}
```

---

### 4. Custom Security Handling

Implement custom security policies and warnings.

```typescript
import { FileViewerProvider } from '@/components/file/file-viewer';
import { toast } from 'sonner';

function SecureFileViewer({ files }: { files: AnkaaFile[] }) {
  const handleSecurityWarning = (warnings: string[], file: AnkaaFile) => {
    // Log security event
    logSecurityEvent({
      type: 'file_security_warning',
      file: file.id,
      warnings,
      timestamp: new Date()
    });

    // Show custom warning UI
    toast.error('Security Warning', {
      description: (
        <div>
          <p className="font-medium">{file.filename}</p>
          <ul className="mt-2 text-sm">
            {warnings.map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      ),
      duration: 10000
    });

    // Notify admin for certain warnings
    if (warnings.some(w => w.includes('malicious'))) {
      notifyAdmin({ file, warnings });
    }
  };

  return (
    <FileViewerProvider
      config={{
        enableSecurity: true,
        maxFileSize: 100 * 1024 * 1024 // 100MB
      }}
      onSecurityWarning={handleSecurityWarning}
    >
      {/* Your file components */}
    </FileViewerProvider>
  );
}
```

---

## Common Scenarios

### 1. Document Preview in Email/Message

Preview attachments in an email or message.

```typescript
function EmailAttachments({ email }: { email: Email }) {
  return (
    <FileViewerProvider>
      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">
          Attachments ({email.attachments.length})
        </h3>

        <div className="flex flex-wrap gap-2">
          {email.attachments.map(file => (
            <FileViewerCard
              key={file.id}
              file={file}
              size="sm"
              showName
              enableHover
            />
          ))}
        </div>
      </div>
    </FileViewerProvider>
  );
}
```

---

### 2. Product Images Gallery

E-commerce product images with gallery viewer.

```typescript
function ProductGallery({ product }: { product: Product }) {
  return (
    <FileViewerProvider>
      <ProductGalleryContent images={product.images} />
    </FileViewerProvider>
  );
}

function ProductGalleryContent({ images }: { images: AnkaaFile[] }) {
  const { actions } = useFileViewer();
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div
        className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-zoom-in"
        onClick={() => actions.openImageModal(images, selectedIndex)}
      >
        <img
          src={images[selectedIndex].thumbnailUrl}
          alt="Product"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 overflow-x-auto">
        {images.map((img, index) => (
          <button
            key={img.id}
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "w-20 h-20 rounded border-2 overflow-hidden flex-shrink-0",
              selectedIndex === index ? "border-primary" : "border-transparent"
            )}
          >
            <img
              src={img.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### 3. File Type Specific Lists

Separate lists for different file types.

```typescript
function FilesByType({ files }: { files: AnkaaFile[] }) {
  const filesByType = useMemo(() => {
    const grouped: Record<string, AnkaaFile[]> = {};

    files.forEach(file => {
      const type = detectFileType(file);
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(file);
    });

    return grouped;
  }, [files]);

  return (
    <FileViewerProvider>
      <div className="space-y-8">
        {/* Images */}
        {filesByType.image && (
          <section>
            <h2 className="text-lg font-medium mb-4">Images</h2>
            <div className="grid grid-cols-6 gap-2">
              {filesByType.image.map(file => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size="sm"
                  showName={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        {filesByType.document && (
          <section>
            <h2 className="text-lg font-medium mb-4">Documents</h2>
            <div className="space-y-2">
              {filesByType.document.map(file => (
                <FileRow key={file.id} file={file} />
              ))}
            </div>
          </section>
        )}

        {/* Videos */}
        {filesByType.video && (
          <section>
            <h2 className="text-lg font-medium mb-4">Videos</h2>
            <div className="grid grid-cols-3 gap-4">
              {filesByType.video.map(file => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size="md"
                  showName
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </FileViewerProvider>
  );
}
```

---

### 4. Invoice/Receipt Viewer

View and download invoices and receipts.

```typescript
function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  return (
    <FileViewerProvider
      config={{
        pdfViewMode: 'new-tab' // Open PDFs in new tab
      }}
    >
      <InvoiceListContent invoices={invoices} />
    </FileViewerProvider>
  );
}

function InvoiceListContent({ invoices }: { invoices: Invoice[] }) {
  const { actions } = useFileViewer();

  return (
    <div className="space-y-4">
      {invoices.map(invoice => (
        <div key={invoice.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Invoice #{invoice.number}</h3>
              <p className="text-sm text-gray-500">
                {formatDate(invoice.date)} • ${invoice.amount}
              </p>
            </div>

            <div className="flex gap-2">
              {invoice.pdfFile && (
                <>
                  <button
                    onClick={() => actions.viewFile(invoice.pdfFile)}
                    className="btn-secondary"
                  >
                    View PDF
                  </button>
                  <button
                    onClick={() => actions.downloadFile(invoice.pdfFile)}
                    className="btn-secondary"
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Integration Examples

### 1. With React Query

Integrate with React Query for data fetching.

```typescript
import { useQuery } from '@tanstack/react-query';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';

function FileListWithQuery({ folderId }: { folderId: string }) {
  const { data: files, isLoading } = useQuery({
    queryKey: ['files', folderId],
    queryFn: () => fetchFiles(folderId)
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <FileViewerProvider>
      <div className="grid grid-cols-4 gap-4">
        {files?.map(file => (
          <FileViewerCard
            key={file.id}
            file={file}
            size="md"
            showName
          />
        ))}
      </div>
    </FileViewerProvider>
  );
}
```

---

### 2. With Infinite Scroll

Lazy load files with infinite scroll.

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';

function InfiniteFileList() {
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['files'],
    queryFn: ({ pageParam = 0 }) => fetchFiles(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  return (
    <FileViewerProvider>
      <div className="grid grid-cols-4 gap-4">
        {data?.pages.map((page) =>
          page.files.map((file) => (
            <FileViewerCard
              key={file.id}
              file={file}
              size="md"
              showName
            />
          ))
        )}
      </div>

      {/* Loading trigger */}
      <div ref={ref} className="h-10">
        {isFetchingNextPage && <Spinner />}
      </div>
    </FileViewerProvider>
  );
}
```

---

### 3. With Form (React Hook Form)

Use file viewer with form file inputs.

```typescript
import { useForm } from 'react-hook-form';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';

function DocumentForm() {
  const { register, watch, setValue } = useForm();
  const [uploadedFiles, setUploadedFiles] = useState<AnkaaFile[]>([]);

  const handleFileUpload = async (files: FileList) => {
    const newFiles = await uploadFiles(Array.from(files));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setValue('fileIds', newFiles.map(f => f.id));
  };

  const handleRemove = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <FileViewerProvider>
      <form>
        {/* File Input */}
        <div>
          <label>Attach Documents</label>
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </div>

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4">
            <h3>Attached Files</h3>
            <div className="grid grid-cols-4 gap-2">
              {uploadedFiles.map(file => (
                <div key={file.id} className="relative">
                  <FileViewerCard
                    file={file}
                    size="sm"
                    showName
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(file.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit">Submit</button>
      </form>
    </FileViewerProvider>
  );
}
```

---

### 4. With Drag and Drop (react-dropzone)

Integrate with drag-and-drop file uploads.

```typescript
import { useDropzone } from 'react-dropzone';
import { FileViewerProvider, FileViewerCard } from '@/components/file/file-viewer';

function FileDropzone() {
  const [files, setFiles] = useState<AnkaaFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploaded = await uploadFiles(acceptedFiles);
    setFiles(prev => [...prev, ...uploaded]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm']
    }
  });

  return (
    <FileViewerProvider>
      <div>
        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "border-gray-300"
          )}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <p>Drag and drop files here, or click to select</p>
          )}
        </div>

        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="mt-6 grid grid-cols-4 gap-4">
            {files.map(file => (
              <FileViewerCard
                key={file.id}
                file={file}
                size="md"
                showName
                showSize
              />
            ))}
          </div>
        )}
      </div>
    </FileViewerProvider>
  );
}
```

---

## Custom Implementations

### 1. Custom File Card

Create a custom file card with additional features.

```typescript
import { fileViewerService } from '@/utils/file-viewer';
import { useFileViewer } from '@/components/file/file-viewer';

function CustomFileCard({ file }: { file: AnkaaFile }) {
  const { actions } = useFileViewer();
  const [isFavorite, setIsFavorite] = useState(file.isFavorite);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorite(file.id);
    setIsFavorite(!isFavorite);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = await generateShareUrl(file.id);
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard');
  };

  return (
    <div
      className="relative group border rounded-lg overflow-hidden cursor-pointer"
      onClick={() => actions.viewFile(file)}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-100">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileIcon file={file} size={48} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-medium truncate">{file.filename}</p>
        <p className="text-sm text-gray-500">
          {formatFileSize(file.size)} • {formatDate(file.createdAt)}
        </p>
      </div>

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.viewFile(file);
          }}
          className="btn-icon-white"
          title="View"
        >
          <IconEye />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.downloadFile(file);
          }}
          className="btn-icon-white"
          title="Download"
        >
          <IconDownload />
        </button>
        <button
          onClick={handleShare}
          className="btn-icon-white"
          title="Share"
        >
          <IconShare />
        </button>
        <button
          onClick={handleToggleFavorite}
          className="btn-icon-white"
          title="Favorite"
        >
          {isFavorite ? <IconHeartFilled /> : <IconHeart />}
        </button>
      </div>

      {/* Favorite Badge */}
      {isFavorite && (
        <div className="absolute top-2 right-2">
          <IconHeartFilled className="text-red-500" />
        </div>
      )}
    </div>
  );
}
```

---

### 2. Custom Modal Wrapper

Wrap the file viewer with custom modal logic.

```typescript
function CustomFileViewer({ file, isOpen, onClose }: Props) {
  const { canPreview } = fileViewerService;

  if (!canPreview(file)) {
    // For non-previewable files, show custom download UI
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-8">
            <FileIcon file={file} size={64} />
            <h2 className="text-xl font-medium mt-4">{file.filename}</h2>
            <p className="text-gray-500 mt-2">{formatFileSize(file.size)}</p>

            <div className="flex gap-2 justify-center mt-6">
              <button
                onClick={() => downloadFile(file)}
                className="btn-primary"
              >
                Download File
              </button>
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For previewable files, use standard viewer
  return (
    <FileViewerProvider>
      <FileViewerContent file={file} isOpen={isOpen} onClose={onClose} />
    </FileViewerProvider>
  );
}
```

---

### 3. Custom Security Policy

Implement organization-specific security policies.

```typescript
function EnterpriseFileViewer({ files }: { files: AnkaaFile[] }) {
  const handleSecurityCheck = (warnings: string[], file: AnkaaFile) => {
    // Check against organization policy
    const policy = getSecurityPolicy();

    if (warnings.some(w => w.includes('executable'))) {
      // Block executable files completely
      toast.error('Executable files are not allowed');
      logSecurityViolation(file, 'executable_blocked');
      return;
    }

    if (file.size > policy.maxFileSize) {
      toast.warning(`File exceeds maximum size (${policy.maxFileSize}MB)`);
      return;
    }

    // Log warning but allow access
    logSecurityWarning(file, warnings);
    toast.warning('Security warning detected', {
      description: warnings[0]
    });
  };

  return (
    <FileViewerProvider
      config={{
        enableSecurity: true,
        maxFileSize: 100 * 1024 * 1024,
        allowedMimeTypes: [
          'image/*',
          'application/pdf',
          'application/vnd.*'
        ]
      }}
      onSecurityWarning={handleSecurityCheck}
    >
      {/* Your components */}
    </FileViewerProvider>
  );
}
```

---

## Performance Optimization

### 1. Virtual Scrolling for Large Lists

Use virtual scrolling for lists with many files.

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileViewerProvider } from '@/components/file/file-viewer';

function VirtualFileList({ files }: { files: AnkaaFile[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated row height
    overscan: 5
  });

  return (
    <FileViewerProvider>
      <div ref={parentRef} className="h-screen overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map(virtualItem => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              <FileRow file={files[virtualItem.index]} />
            </div>
          ))}
        </div>
      </div>
    </FileViewerProvider>
  );
}
```

---

### 2. Lazy Loading Thumbnails

Implement lazy loading for better initial load performance.

```typescript
function LazyThumbnail({ file }: { file: AnkaaFile }) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="aspect-square bg-gray-100">
      {isInView && file.thumbnailUrl ? (
        <img
          src={file.thumbnailUrl}
          alt={file.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Skeleton />
        </div>
      )}
    </div>
  );
}
```

---

### 3. Memoization for Performance

Optimize rendering with React.memo and useMemo.

```typescript
const FileCard = React.memo(({ file }: { file: AnkaaFile }) => {
  const fileType = useMemo(() => detectFileType(file), [file]);
  const thumbnailUrl = useMemo(
    () => generateThumbnailUrl(file, fileType),
    [file, fileType]
  );

  return (
    <FileViewerCard
      file={file}
      size="md"
      showName
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.file.id === nextProps.file.id &&
         prevProps.file.updatedAt === nextProps.file.updatedAt;
});
```

---

### 4. Code Splitting

Split file viewer components for better initial bundle size.

```typescript
import { lazy, Suspense } from 'react';

const FileViewerProvider = lazy(() =>
  import('@/components/file/file-viewer').then(m => ({
    default: m.FileViewerProvider
  }))
);

const FileViewerCard = lazy(() =>
  import('@/components/file/file-viewer-card')
);

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FileViewerProvider>
        <Suspense fallback={<Skeleton />}>
          <FileList />
        </Suspense>
      </FileViewerProvider>
    </Suspense>
  );
}
```

---

## Testing Examples

### 1. Unit Test for File Type Detection

```typescript
import { describe, it, expect } from 'vitest';
import { detectFileType } from '@/components/file/file-viewer-card';

describe('detectFileType', () => {
  it('detects image files correctly', () => {
    const file: AnkaaFile = {
      id: '1',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024
    };

    expect(detectFileType(file)).toBe('image');
  });

  it('detects PDF files correctly', () => {
    const file: AnkaaFile = {
      id: '2',
      filename: 'document.pdf',
      mimetype: 'application/pdf',
      size: 2048
    };

    expect(detectFileType(file)).toBe('pdf');
  });

  it('falls back to extension when MIME type is missing', () => {
    const file: AnkaaFile = {
      id: '3',
      filename: 'video.mp4',
      mimetype: '',
      size: 5000
    };

    expect(detectFileType(file)).toBe('video');
  });
});
```

---

### 2. Component Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { FileViewerCard } from '@/components/file/file-viewer-card';

describe('FileViewerCard', () => {
  const mockFile: AnkaaFile = {
    id: '1',
    filename: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    thumbnailUrl: '/thumb.jpg'
  };

  it('renders file name when showName is true', () => {
    render(<FileViewerCard file={mockFile} showName />);
    expect(screen.getByText('test.jpg')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<FileViewerCard file={mockFile} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(mockFile);
  });

  it('shows hover effects when enableHover is true', () => {
    const { container } = render(
      <FileViewerCard file={mockFile} enableHover />
    );

    const card = container.querySelector('.group');
    expect(card).toHaveClass('hover:shadow-lg');
  });
});
```

---

## Best Practices Summary

1. **Always wrap with FileViewerProvider** for components that share state
2. **Use appropriate size variants** based on layout (sm for lists, md for grids, lg for featured)
3. **Handle security warnings** with custom UI appropriate for your use case
4. **Implement lazy loading** for large file lists
5. **Cache file metadata** to avoid redundant API calls
6. **Use virtual scrolling** for very large lists (1000+ items)
7. **Optimize thumbnails** by requesting appropriate sizes
8. **Handle errors gracefully** with user-friendly messages
9. **Test across file types** to ensure compatibility
10. **Monitor performance** with React DevTools and browser tools
