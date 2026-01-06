/**
 * FileViewerCard Usage Examples
 *
 * This file contains practical examples of how to use the FileViewerCard component
 * in various real-world scenarios.
 */

import React from "react";
import { FileViewerCard, FileViewerProvider } from "@/components/common/file";
import type { File as AnkaaFile } from "@/types";
import { toast } from "sonner";

// =====================================================
// Example 1: Basic Usage
// =====================================================

export function BasicFileViewer() {
  const file: AnkaaFile = {
    id: "1",
    filename: "document.pdf",
    originalName: "important-document.pdf",
    mimetype: "application/pdf",
    path: "/uploads/document.pdf",
    size: 1024000,
    thumbnailUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return <FileViewerCard file={file} />;
}

// =====================================================
// Example 2: File Grid with Multiple Files
// =====================================================

export function FileGrid({ files }: { files: AnkaaFile[] }) {
  return (
    <FileViewerProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {files.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            size="md"
            showName={true}
            showSize={true}
            enableHover={true}
          />
        ))}
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 3: File Gallery with Custom Click Handler
// =====================================================

export function FileGallery({ files }: { files: AnkaaFile[] }) {
  const [selectedFile, setSelectedFile] = React.useState<AnkaaFile | null>(null);

  const handleFileClick = (file: AnkaaFile) => {
    setSelectedFile(file);
    toast.info(`Selected: ${file.filename}`);
    // You can also open a custom modal or perform other actions
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {files.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            size="md"
            showName={true}
            onClick={handleFileClick}
            className={selectedFile?.id === file.id ? "ring-2 ring-blue-500" : ""}
          />
        ))}
      </div>

      {selectedFile && (
        <div className="p-4 bg-muted rounded-lg">
          <h3 className="font-semibold">Selected File:</h3>
          <p className="text-sm text-muted-foreground">{selectedFile.filename}</p>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Example 4: Attachment List with Download
// =====================================================

export function AttachmentList({ files }: { files: AnkaaFile[] }) {
  const handleDownload = (file: AnkaaFile) => {
    toast.success(`Downloading ${file.filename}`);
    // Custom download logic here
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold mb-3">Attachments</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            size="sm"
            showName={true}
            showSize={true}
            onDownload={handleDownload}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Example 5: Image Gallery (Images Only)
// =====================================================

export function ImageGallery({ files }: { files: AnkaaFile[] }) {
  const imageFiles = files.filter((f) => f.mimetype.startsWith("image/"));

  return (
    <FileViewerProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {imageFiles.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            size="lg"
            showName={false}
            showType={true}
            className="aspect-square"
          />
        ))}
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 6: Document Library with Categories
// =====================================================

export function DocumentLibrary({ files }: { files: AnkaaFile[] }) {
  const categories = React.useMemo(() => {
    const cats = new Map<string, AnkaaFile[]>();

    files.forEach((file) => {
      const type = file.mimetype.split("/")[0];
      const category = type === "image" ? "Images" : type === "video" ? "Videos" : type === "application" && file.mimetype.includes("pdf") ? "PDFs" : "Documents";

      if (!cats.has(category)) {
        cats.set(category, []);
      }
      cats.get(category)!.push(file);
    });

    return cats;
  }, [files]);

  return (
    <FileViewerProvider>
      <div className="space-y-8">
        {Array.from(categories.entries()).map(([category, categoryFiles]) => (
          <div key={category}>
            <h3 className="text-xl font-semibold mb-4">{category}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categoryFiles.map((file) => (
                <FileViewerCard key={file.id} file={file} showName={true} showSize={true} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 7: Selectable File List
// =====================================================

export function SelectableFileList({ files, onSelectionChange }: { files: AnkaaFile[]; onSelectionChange?: (selected: AnkaaFile[]) => void }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const handleFileClick = (file: AnkaaFile) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(file.id)) {
        newSet.delete(file.id);
      } else {
        newSet.add(file.id);
      }

      // Notify parent of selection change
      if (onSelectionChange) {
        const selectedFiles = files.filter((f) => newSet.has(f.id));
        onSelectionChange(selectedFiles);
      }

      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{selected.size} file(s) selected</p>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-sm text-blue-500 hover:underline">
            Clear selection
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {files.map((file) => (
          <FileViewerCard
            key={file.id}
            file={file}
            showName={true}
            onClick={handleFileClick}
            className={selected.has(file.id) ? "ring-2 ring-blue-500 shadow-sm" : ""}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Example 8: File Upload Preview
// =====================================================

export function FileUploadPreview({ uploadedFiles }: { uploadedFiles: AnkaaFile[] }) {
  const [files, setFiles] = React.useState<AnkaaFile[]>(uploadedFiles);

  const handleRemove = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    toast.success("File removed");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Uploaded Files ({files.length})</h3>

      {files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No files uploaded</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div key={file.id} className="relative group">
              <FileViewerCard file={file} showName={true} showSize={true} />

              {/* Remove button */}
              <button
                onClick={() => handleRemove(file.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Example 9: Responsive File Browser
// =====================================================

export function FileBrowser({ files }: { files: AnkaaFile[] }) {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = React.useState<"name" | "date" | "size">("name");

  const sortedFiles = React.useMemo(() => {
    return [...files].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.filename.localeCompare(b.filename);
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "size":
          return b.size - a.size;
        default:
          return 0;
      }
    });
  }, [files, sortBy]);

  return (
    <FileViewerProvider>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setSortBy("name")} className={`px-3 py-1 rounded text-sm ${sortBy === "name" ? "bg-blue-500 text-white" : "bg-muted"}`}>
              Name
            </button>
            <button onClick={() => setSortBy("date")} className={`px-3 py-1 rounded text-sm ${sortBy === "date" ? "bg-blue-500 text-white" : "bg-muted"}`}>
              Date
            </button>
            <button onClick={() => setSortBy("size")} className={`px-3 py-1 rounded text-sm ${sortBy === "size" ? "bg-blue-500 text-white" : "bg-muted"}`}>
              Size
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-1 rounded text-sm ${viewMode === "grid" ? "bg-blue-500 text-white" : "bg-muted"}`}>
              Grid
            </button>
            <button onClick={() => setViewMode("list")} className={`px-3 py-1 rounded text-sm ${viewMode === "list" ? "bg-blue-500 text-white" : "bg-muted"}`}>
              List
            </button>
          </div>
        </div>

        {/* File Display */}
        <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" : "space-y-2"}>
          {sortedFiles.map((file) => (
            <FileViewerCard key={file.id} file={file} size={viewMode === "grid" ? "md" : "sm"} showName={true} showSize={viewMode === "list"} />
          ))}
        </div>
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 10: Task Attachments Component
// =====================================================

export function TaskAttachments({ taskId, files, onFileDelete }: { taskId: string; files: AnkaaFile[]; onFileDelete?: (fileId: string) => Promise<void> }) {
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    if (!onFileDelete) return;

    try {
      setDeleting(fileId);
      await onFileDelete(fileId);
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file");
    } finally {
      setDeleting(null);
    }
  };

  if (files.length === 0) {
    return <div className="text-sm text-muted-foreground">No attachments</div>;
  }

  return (
    <FileViewerProvider>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Attachments ({files.length})</h4>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {files.map((file) => (
            <div key={file.id} className="relative">
              <FileViewerCard file={file} size="sm" showName={true} disabled={deleting === file.id} />

              {onFileDelete && (
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 11: Custom Styled File Cards
// =====================================================

export function CustomStyledFiles({ files }: { files: AnkaaFile[] }) {
  return (
    <FileViewerProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file, index) => (
          <FileViewerCard
            key={file.id}
            file={file}
            showName={true}
            showSize={true}
            className={`
              border-2
              ${index % 4 === 0 ? "border-blue-300 hover:border-blue-500" : ""}
              ${index % 4 === 1 ? "border-green-300 hover:border-green-500" : ""}
              ${index % 4 === 2 ? "border-purple-300 hover:border-purple-500" : ""}
              ${index % 4 === 3 ? "border-orange-300 hover:border-orange-500" : ""}
              shadow-sm hover:shadow-sm
              transition-all duration-300
            `}
          />
        ))}
      </div>
    </FileViewerProvider>
  );
}

// =====================================================
// Example 12: File Preview with Metadata
// =====================================================

export function FilePreviewWithMetadata({ file }: { file: AnkaaFile }) {
  return (
    <div className="flex gap-4 items-start">
      {/* File Card */}
      <FileViewerCard file={file} size="lg" showName={false} />

      {/* Metadata */}
      <div className="flex-1 space-y-2">
        <h3 className="text-lg font-semibold">{file.filename}</h3>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <span className="font-medium">Size:</span> {(file.size / 1024).toFixed(2)} KB
          </p>
          <p>
            <span className="font-medium">Type:</span> {file.mimetype}
          </p>
          <p>
            <span className="font-medium">Uploaded:</span> {new Date(file.createdAt).toLocaleDateString()}
          </p>
          {file.updatedAt && (
            <p>
              <span className="font-medium">Modified:</span> {new Date(file.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default {
  BasicFileViewer,
  FileGrid,
  FileGallery,
  AttachmentList,
  ImageGallery,
  DocumentLibrary,
  SelectableFileList,
  FileUploadPreview,
  FileBrowser,
  TaskAttachments,
  CustomStyledFiles,
  FilePreviewWithMetadata,
};
