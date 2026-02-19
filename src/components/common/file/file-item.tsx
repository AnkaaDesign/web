import React, { useState, useCallback } from "react";
import type { File as AnkaaFile } from "../../../types";
import { formatFileSize, getFileDisplayName, getFileDownloadUrl, getFileUrl, isImageFile } from "../../../utils/file";
import { getPDFThumbnailUrl, isPDFFile } from "../../../utils/pdf-thumbnail";
import { formatRelativeTime } from "../../../utils";
import { cn } from "@/lib/utils";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { FileViewerContext } from "./file-viewer";
import { getApiBaseUrl } from "@/config/api";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconExternalLink, IconDownload, IconCopy, IconClipboard } from "@tabler/icons-react";

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
 * Hook for file context menu (right-click) with Open, Save, Copy actions.
 */
function useFileContextMenu(file: AnkaaFile) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => setContextMenu(null), []);

  const openInNewTab = useCallback(() => {
    const url = getFileUrl(file);
    window.open(url, "_blank");
    setContextMenu(null);
  }, [file]);

  const saveFile = useCallback(() => {
    const url = getFileDownloadUrl(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setContextMenu(null);
  }, [file]);

  const copyFile = useCallback(async () => {
    try {
      const url = getFileDownloadUrl(file);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Try to copy as file to clipboard (images)
      if (file.mimetype?.startsWith("image/")) {
        // Clipboard API requires image/png for images
        let clipboardBlob = blob;
        if (blob.type !== "image/png") {
          // Convert to PNG via canvas
          const img = new Image();
          const blobUrl = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = blobUrl;
          });
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(blobUrl);
          clipboardBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png");
          });
        }
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": clipboardBlob }),
        ]);
      } else {
        // For non-images, copy the download URL
        await navigator.clipboard.writeText(getFileUrl(file));
      }
    } catch (err) {
      console.warn("[FileItem] Copy failed, falling back to URL copy:", err);
      // Fallback: copy the file URL
      await navigator.clipboard.writeText(getFileUrl(file));
    }
    setContextMenu(null);
  }, [file]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(getFileUrl(file));
    setContextMenu(null);
  }, [file]);

  return { contextMenu, onContextMenu, close, openInNewTab, saveFile, copyFile, copyLink };
}

function FileContextMenu({ ctx }: { ctx: ReturnType<typeof useFileContextMenu> }) {
  return (
    <DropdownMenu open={!!ctx.contextMenu} onOpenChange={(open) => !open && ctx.close()}>
      <PositionedDropdownMenuContent
        position={ctx.contextMenu}
        isOpen={!!ctx.contextMenu}
        className="w-48"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem onClick={ctx.openInNewTab}>
          <IconExternalLink className="mr-2 h-4 w-4" />
          Abrir em nova aba
        </DropdownMenuItem>
        <DropdownMenuItem onClick={ctx.saveFile}>
          <IconDownload className="mr-2 h-4 w-4" />
          Salvar arquivo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={ctx.copyFile}>
          <IconCopy className="mr-2 h-4 w-4" />
          Copiar arquivo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={ctx.copyLink}>
          <IconClipboard className="mr-2 h-4 w-4" />
          Copiar link
        </DropdownMenuItem>
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
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
  const ctx = useFileContextMenu(file);

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
    <>
      <div
        className={cn(
          "group relative overflow-hidden transition-all duration-300 rounded-lg hover:shadow-sm cursor-pointer border border-border",
          "w-full max-w-[200px]",
          className
        )}
        onClick={handleClick}
        onContextMenu={ctx.onContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail/Icon Area */}
        <div
          className="flex items-center justify-center rounded-lg bg-muted/30"
          style={{ height: "8rem" }}
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
      <FileContextMenu ctx={ctx} />
    </>
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
  const ctx = useFileContextMenu(file);

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
    <>
      <div
        className={cn("group relative flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-border", className)}
        onClick={handleClick}
        onContextMenu={ctx.onContextMenu}
      >
        {/* Thumbnail/Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded bg-muted/30 shrink-0 relative">
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
      <FileContextMenu ctx={ctx} />
    </>
  );
};

export const FileItem: React.FC<FileItemProps> = ({ viewMode = "grid", ...props }) => {
  if (viewMode === "list") {
    return <FileItemList {...props} />;
  }

  return <FileItemGrid {...props} />;
};

export default FileItem;
