import React, { useState } from "react";
import type { File as AnkaaFile } from "../../../types";
import { formatFileSize, getFileDisplayName, getFileDownloadUrl, isImageFile } from "../../../utils/file";
import { getPDFThumbnailUrl, isPDFFile } from "../../../utils/pdf-thumbnail";
import { formatRelativeTime } from "../../../utils";
import { cn } from "@/lib/utils";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { FileViewerContext } from "./file-viewer";
import { getApiBaseUrl } from "@/config/api";

export type FileViewMode = "grid" | "list";

export interface FileItemProps {
  file: AnkaaFile;
  viewMode?: FileViewMode;
  onPreview?: (file: AnkaaFile) => void;
  onDownload?: (file: AnkaaFile) => void;
  onDelete?: (file: AnkaaFile) => void;
  showActions?: boolean;
  showFilename?: boolean;
  showFileSize?: boolean;
  showRelativeTime?: boolean;
  className?: string;
}

const getThumbnailUrl = (file: AnkaaFile, size: "small" | "medium" | "large" = "medium"): string => {
  let apiUrl = getApiBaseUrl();
  apiUrl = apiUrl.replace(/\/+$/, '');

  if (isPDFFile(file)) {
    return getPDFThumbnailUrl(file, { size });
  }

  if (file.thumbnailUrl) {
    if (file.thumbnailUrl.startsWith("http")) {
      return file.thumbnailUrl;
    }
    return `${apiUrl}/files/thumbnail/${file.id}?size=${size}`;
  }
  if (isImageFile(file)) {
    return `${apiUrl}/files/serve/${file.id}`;
  }
  return "";
};

/**
 * Sets up drag data for downloading the original file.
 * Uses Chrome's DownloadURL type which works on Windows/macOS.
 * On Linux, browser-to-file-manager drag is a platform limitation.
 */
function handleFileDragStart(e: React.DragEvent, file: AnkaaFile) {
  e.stopPropagation();
  e.dataTransfer.effectAllowed = "copy";

  const url = getFileDownloadUrl(file);
  const mimeType = file.mimetype || "application/octet-stream";
  const filename = file.filename || "download";
  e.dataTransfer.setData("DownloadURL", `${mimeType}:${filename}:${url}`);
}

const FileItemGrid: React.FC<FileItemProps> = ({ file, onPreview, onDownload: _onDownload, onDelete: _onDelete, showActions: _showActions = true, showFilename = true, showFileSize = true, showRelativeTime: _showRelativeTime = true, className }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isImage = isImageFile(file);
  const isPdf = isPDFFile(file);
  const hasThumbnail = file.thumbnailUrl || isImage || isPdf;

  const fileViewer = React.useContext(FileViewerContext);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (hasThumbnail) {
      const timer = setTimeout(() => {
        setShowThumbnail(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail]);

  const handleClick = () => {
    if (onPreview) {
      onPreview(file);
    } else {
      fileViewer?.actions.viewFile(file);
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden transition-all duration-300 rounded-lg hover:shadow-sm cursor-pointer border border-border",
        "w-full max-w-[200px]",
        className
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail/Icon Area — only this area is draggable */}
      <div
        className="flex items-center justify-center rounded-lg bg-muted/30"
        style={{ height: "8rem" }}
        draggable={true}
        onDragStart={(e) => {
          handleFileDragStart(e, file);
          // Use the thumbnail as drag ghost
          if (imgRef.current) {
            e.dataTransfer.setDragImage(imgRef.current, 0, 0);
          }
        }}
      >
        {showThumbnail && hasThumbnail && !thumbnailError ? (
          <div className="relative w-full h-full">
            {thumbnailLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-md">
                <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
              </div>
            )}
            <img
              ref={imgRef}
              src={getThumbnailUrl(file, "medium")}
              alt={file.filename}
              className={cn(
                "w-full h-full object-contain rounded-md transition-all duration-300",
                thumbnailLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setThumbnailLoading(false)}
              onError={() => {
                setThumbnailError(true);
                setThumbnailLoading(false);
                setShowThumbnail(false);
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
          </div>
        )}

        {/* Hover Overlay with File Info */}
        {isHovered && (showFilename || showFileSize) && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-between gap-2">
                {showFilename && (
                  <p className="text-xs text-white/90 truncate flex-1" title={file.filename}>
                    {file.filename}
                  </p>
                )}
                {showFileSize && (
                  <span className="text-[10px] text-white/70 shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FileItemList: React.FC<FileItemProps> = ({ file, onPreview, onDownload: _onDownload, onDelete: _onDelete, showActions: _showActions = true, showFilename = true, showFileSize = true, showRelativeTime = true, className }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const isImage = isImageFile(file);
  const isPdf = isPDFFile(file);
  const hasThumbnail = file.thumbnailUrl || isImage || isPdf;

  const fileViewer = React.useContext(FileViewerContext);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (hasThumbnail) {
      const timer = setTimeout(() => {
        setShowThumbnail(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail]);

  const handleClick = () => {
    if (onPreview) {
      onPreview(file);
    } else {
      fileViewer?.actions.viewFile(file);
    }
  };

  return (
    <div
      className={cn("group relative flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-border", className)}
      onClick={handleClick}
    >
      {/* Thumbnail/Icon — only this area is draggable */}
      <div
        className="flex items-center justify-center w-10 h-10 rounded bg-muted/30 shrink-0 relative"
        draggable={true}
        onDragStart={(e) => {
          handleFileDragStart(e, file);
          if (imgRef.current) {
            e.dataTransfer.setDragImage(imgRef.current, 0, 0);
          }
        }}
      >
        {showThumbnail && hasThumbnail && !thumbnailError ? (
          <div className="relative w-full h-full">
            {thumbnailLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded">
                <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
              </div>
            )}
            <img
              ref={imgRef}
              src={getThumbnailUrl(file, "small")}
              alt={file.filename}
              className={cn(
                "w-full h-full object-contain rounded transition-all duration-300",
                thumbnailLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setThumbnailLoading(false)}
              onError={() => {
                setThumbnailError(true);
                setThumbnailLoading(false);
                setShowThumbnail(false);
              }}
              draggable={false}
            />
          </div>
        ) : (
          <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        {showFilename && <h4 className="text-sm font-medium text-foreground truncate">{getFileDisplayName(file, 40)}</h4>}
        {(showFileSize || showRelativeTime) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            {showFileSize && <span>{formatFileSize(file.size)}</span>}
            {showFileSize && showRelativeTime && file.createdAt && <span className="font-enhanced-unicode">•</span>}
            {showRelativeTime && file.createdAt && <span>{formatRelativeTime(new Date(file.createdAt))}</span>}
          </div>
        )}
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
