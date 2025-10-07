import React, { useState } from "react";
import type { File as AnkaaFile } from "../../types";
import { formatFileSize, getFileCategory, getFileDisplayName, isImageFile } from "../../utils";
import { fileViewerService } from "../../utils/file-viewer";
import { formatRelativeTime } from "../../utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconDownload, IconTrash, IconEye } from "@tabler/icons-react";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { useFileViewer } from "./file-viewer";

export type FileViewMode = "grid" | "list";

export interface FileItemProps {
  file: AnkaaFile;
  viewMode?: FileViewMode;
  onPreview?: (file: AnkaaFile) => void;
  onDownload?: (file: AnkaaFile) => void;
  onDelete?: (file: AnkaaFile) => void;
  showActions?: boolean;
  className?: string;
}

const isEpsFile = (file: AnkaaFile): boolean => {
  const epsMimeTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  return epsMimeTypes.includes(file.mimetype.toLowerCase());
};

// Removed getFileIcon function - now using FileTypeIcon/FileTypeAvatar components

const getThumbnailUrl = (file: AnkaaFile, size: "small" | "medium" | "large" = "medium"): string => {
  const apiUrl = (window as any).__ANKAA_API_URL__ || process.env.VITE_API_URL || "http://localhost:3030";

  if (file.thumbnailUrl) {
    // If it's already a full URL, use it
    if (file.thumbnailUrl.startsWith("http")) {
      return file.thumbnailUrl;
    }
    // Otherwise build the URL with API base
    return `${apiUrl}/files/thumbnail/${file.id}?size=${size}`;
  }
  // For images without thumbnails, use the file itself
  if (isImageFile(file)) {
    return `${apiUrl}/files/serve/${file.id}`;
  }
  return "";
};

const FileItemGrid: React.FC<FileItemProps> = ({ file, onPreview, onDownload, onDelete, showActions = true, className }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const category = getFileCategory(file);
  const isImage = isImageFile(file);
  const isPdf = file.mimetype === "application/pdf";
  const isEps = isEpsFile(file);
  const canPreviewFile = fileViewerService.canPreviewFile(file);
  const hasThumbnail = file.thumbnailUrl || isImage;

  // Try to get file viewer context (optional)
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available, will use fallback behavior
  }

  // Only show thumbnail after initial render to prevent flash
  React.useEffect(() => {
    if (hasThumbnail) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowThumbnail(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail]);

  const handleClick = () => {
    // Use the new file viewer service if available
    if (fileViewerContext) {
      fileViewerContext.actions.viewFile(file);
    } else if (canPreviewFile && onPreview) {
      onPreview(file);
    } else if (onDownload) {
      onDownload(file);
    }
  };

  const handleThumbnailLoad = () => {
    setThumbnailLoading(false);
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
    setThumbnailLoading(false);
    setShowThumbnail(false);
  };

  return (
    <Card className={cn("group relative transition-all duration-200 hover:shadow-md cursor-pointer", "w-full max-w-[200px]", className)} onClick={handleClick}>
      <CardContent className="p-4">
        {/* Thumbnail/Icon Area */}
        <div className="flex items-center justify-center mb-3 rounded-lg bg-muted/30" style={{ height: "8rem" }}>
          {showThumbnail && hasThumbnail && !thumbnailError ? (
            <div className="relative w-full h-full">
              {thumbnailLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-md">
                  <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
                </div>
              )}
              <img
                src={getThumbnailUrl(file, "medium")}
                alt={file.filename}
                className={cn(
                  "w-full h-full object-contain rounded-md transition-all duration-300",
                  thumbnailLoading ? "opacity-0" : "opacity-100",
                  isPdf && "border-2 border-red-200",
                  isEps && "border-2 border-indigo-200",
                )}
                onLoad={handleThumbnailLoad}
                onError={handleThumbnailError}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{isEps ? "EPS" : category}</span>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-foreground leading-tight">{getFileDisplayName(file, 25)}</h4>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(file.size)}</span>
          </div>
          {file.createdAt && <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(file.createdAt))}</p>}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-1">
              {canPreviewFile && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 bg-primary/80 backdrop-blur-sm text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileViewerContext) {
                      fileViewerContext.actions.viewFile(file);
                    } else if (onPreview) {
                      onPreview(file);
                    }
                  }}
                  title="Visualizar arquivo"
                >
                  <IconEye size={14} />
                </Button>
              )}
              {onDownload && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileViewerContext) {
                      fileViewerContext.actions.downloadFile(file);
                    } else {
                      onDownload(file);
                    }
                  }}
                  title="Baixar arquivo"
                >
                  <IconDownload size={14} />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7 bg-destructive/80 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                  }}
                  title="Remover arquivo"
                >
                  <IconTrash size={14} />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FileItemList: React.FC<FileItemProps> = ({ file, onPreview, onDownload, onDelete, showActions = true, className }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const category = getFileCategory(file);
  const isImage = isImageFile(file);
  const isPdf = file.mimetype === "application/pdf";
  const isEps = isEpsFile(file);
  const canPreviewFile = fileViewerService.canPreviewFile(file);
  const hasThumbnail = file.thumbnailUrl || isImage;

  // Try to get file viewer context (optional)
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available, will use fallback behavior
  }

  // Only show thumbnail after initial render to prevent flash
  React.useEffect(() => {
    if (hasThumbnail) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowThumbnail(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail]);

  const handleClick = () => {
    // Use the new file viewer service if available
    if (fileViewerContext) {
      fileViewerContext.actions.viewFile(file);
    } else if (canPreviewFile && onPreview) {
      onPreview(file);
    } else if (onDownload) {
      onDownload(file);
    }
  };

  const handleThumbnailLoad = () => {
    setThumbnailLoading(false);
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
    setThumbnailLoading(false);
    setShowThumbnail(false);
  };

  return (
    <div className={cn("group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer", className)} onClick={handleClick}>
      {/* Thumbnail/Icon */}
      <div className="flex items-center justify-center w-10 h-10 rounded bg-muted/30 shrink-0">
        {showThumbnail && hasThumbnail && !thumbnailError ? (
          <div className="relative w-full h-full">
            {thumbnailLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded">
                <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
              </div>
            )}
            <img
              src={getThumbnailUrl(file, "small")}
              alt={file.filename}
              className={cn(
                "w-full h-full object-contain rounded transition-all duration-300",
                thumbnailLoading ? "opacity-0" : "opacity-100",
                isPdf && "border border-red-200",
                isEps && "border border-indigo-200",
              )}
              onLoad={handleThumbnailLoad}
              onError={handleThumbnailError}
            />
          </div>
        ) : (
          <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground truncate">{getFileDisplayName(file, 40)}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
            <span>{formatFileSize(file.size)}</span>
            {file.createdAt && (
              <>
                <span className="font-enhanced-unicode">•</span>
                <span>{formatRelativeTime(new Date(file.createdAt))}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground capitalize">{category}</p>
          {showActions && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canPreviewFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileViewerContext) {
                      fileViewerContext.actions.viewFile(file);
                    } else if (onPreview) {
                      onPreview(file);
                    }
                  }}
                  title="Visualizar arquivo"
                >
                  <IconEye size={12} />
                </Button>
              )}
              {onDownload && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileViewerContext) {
                      fileViewerContext.actions.downloadFile(file);
                    } else {
                      onDownload(file);
                    }
                  }}
                  title="Baixar arquivo"
                >
                  <IconDownload size={12} />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                  }}
                  title="Remover arquivo"
                >
                  <IconTrash size={12} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FileItem: React.FC<FileItemProps> = ({ viewMode = "grid", ...props }) => {
  if (viewMode === "list") {
    return <FileItemList {...props} />;
  }

  return <FileItemGrid {...props} />;
};

export default FileItem;
