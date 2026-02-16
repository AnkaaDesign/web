/**
 * FileViewerCard Component
 *
 * A comprehensive file viewer component with thumbnail generation, hover effects,
 * and click handlers for different file types.
 *
 * Features:
 * - Automatic file type detection
 * - Thumbnail generation for images, videos, PDFs, and documents
 * - Hover effects with action buttons
 * - Click handlers for viewing different file types
 * - Error handling and loading states
 * - Responsive design
 *
 * @module FileViewerCard
 */

import React, { useState, useCallback, useMemo } from "react";
import type { File as AnkaaFile } from "../../../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IconPhoto,
  IconVideo,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePpt,
  IconFile,
  IconDownload,
  IconEye,
  IconAlertCircle,
  IconFileZip,
  IconMusic,
  IconVectorBezier,
} from "@tabler/icons-react";
import { fileViewerService } from "../../../utils/file-viewer";
import { FileViewerContext } from "./file-viewer";
import { getApiBaseUrl } from "@/config/api";

// =====================
// Type Definitions
// =====================

export type FileType =
  | "image"
  | "video"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "audio"
  | "archive"
  | "vector"
  | "other";

export interface FileViewerCardProps {
  /** The file to display */
  file: AnkaaFile;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show file name */
  showName?: boolean;
  /** Whether to show file size */
  showSize?: boolean;
  /** Whether to show file type badge */
  showType?: boolean;
  /** Whether to enable hover effects */
  enableHover?: boolean;
  /** Custom className */
  className?: string;
  /** Custom click handler (overrides default behavior) */
  onClick?: (file: AnkaaFile) => void;
  /** Custom download handler */
  onDownload?: (file: AnkaaFile) => void;
  /** Whether component is disabled */
  disabled?: boolean;
  /** Base URL for file serving */
  baseUrl?: string;
}

// =====================
// Utility Functions
// =====================

/**
 * Detects the specific file type from file metadata
 */
export const detectFileType = (file: AnkaaFile): FileType => {
  const mimeType = file.mimetype?.toLowerCase() || "";
  const filename = file.filename?.toLowerCase() || "";
  const extension = filename.split(".").pop() || "";

  // Images
  if (
    mimeType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "tiff"].includes(extension)
  ) {
    return "image";
  }

  // Videos
  if (
    mimeType.startsWith("video/") ||
    ["mp4", "webm", "avi", "mov", "wmv", "flv", "mkv", "m4v"].includes(extension)
  ) {
    return "video";
  }

  // PDFs
  if (mimeType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  // Documents
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx", "txt", "rtf", "odt"].includes(extension)
  ) {
    return "document";
  }

  // Spreadsheets
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    ["xls", "xlsx", "csv", "ods"].includes(extension)
  ) {
    return "spreadsheet";
  }

  // Presentations
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(extension)
  ) {
    return "presentation";
  }

  // Audio
  if (
    mimeType.startsWith("audio/") ||
    ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"].includes(extension)
  ) {
    return "audio";
  }

  // Archives
  if (
    ["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension) ||
    mimeType.includes("zip") ||
    mimeType.includes("compressed")
  ) {
    return "archive";
  }

  // Vector graphics
  if (
    ["eps", "ai", "svg"].includes(extension) ||
    mimeType.includes("postscript") ||
    mimeType === "image/svg+xml"
  ) {
    return "vector";
  }

  return "other";
};

/**
 * Gets the appropriate icon component for a file type
 */
export const getFileTypeIcon = (fileType: FileType, size: number = 20): React.ReactNode => {
  const iconProps = { size, className: "shrink-0" };

  switch (fileType) {
    case "image":
      return <IconPhoto {...iconProps} className={cn(iconProps.className, "text-blue-500")} />;
    case "video":
      return <IconVideo {...iconProps} className={cn(iconProps.className, "text-purple-500")} />;
    case "pdf":
      return <IconFileTypePdf {...iconProps} className={cn(iconProps.className, "text-red-500")} />;
    case "document":
      return <IconFileTypeDoc {...iconProps} className={cn(iconProps.className, "text-blue-600")} />;
    case "spreadsheet":
      return <IconFileTypeXls {...iconProps} className={cn(iconProps.className, "text-green-600")} />;
    case "presentation":
      return <IconFileTypePpt {...iconProps} className={cn(iconProps.className, "text-orange-500")} />;
    case "audio":
      return <IconMusic {...iconProps} className={cn(iconProps.className, "text-pink-500")} />;
    case "archive":
      return <IconFileZip {...iconProps} className={cn(iconProps.className, "text-yellow-500")} />;
    case "vector":
      return <IconVectorBezier {...iconProps} className={cn(iconProps.className, "text-indigo-500")} />;
    default:
      return <IconFile {...iconProps} className={cn(iconProps.className, "text-gray-400")} />;
  }
};

/**
 * Generates thumbnail URL for a file
 */
export const generateThumbnailUrl = (
  file: AnkaaFile,
  fileType: FileType,
  baseUrl?: string
): string | null => {
  const apiUrl = baseUrl || getApiBaseUrl();

  // If file has a thumbnail URL, use it
  if (file.thumbnailUrl) {
    return file.thumbnailUrl.startsWith("http")
      ? file.thumbnailUrl
      : `${apiUrl}${file.thumbnailUrl}`;
  }

  // For images, use the serve endpoint
  if (fileType === "image") {
    return `${apiUrl}/files/serve/${file.id}`;
  }

  // For PDFs and documents, try to get generated thumbnail
  if (fileType === "pdf" || fileType === "document" || fileType === "spreadsheet") {
    return `${apiUrl}/files/thumbnail/${file.id}?size=medium`;
  }

  // For videos, attempt to get video thumbnail
  if (fileType === "video") {
    return `${apiUrl}/files/thumbnail/${file.id}?size=medium`;
  }

  return null;
};

/**
 * Formats file size to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Gets display label for file type
 */
export const getFileTypeLabel = (fileType: FileType): string => {
  const labels: Record<FileType, string> = {
    image: "Imagem",
    video: "Vídeo",
    pdf: "PDF",
    document: "Documento",
    spreadsheet: "Planilha",
    presentation: "Apresentação",
    audio: "Áudio",
    archive: "Arquivo",
    vector: "Vetor",
    other: "Arquivo",
  };
  return labels[fileType];
};

/**
 * Determines if a file can be previewed
 */
export const canPreviewFile = (fileType: FileType): boolean => {
  return ["image", "video", "pdf"].includes(fileType);
};

// =====================
// Main Component
// =====================

/**
 * FileViewerCard - A card component for displaying file thumbnails with interactive features
 */
export const FileViewerCard: React.FC<FileViewerCardProps> = ({
  file,
  size = "md",
  showName: _showName = true,
  showSize: _showSize = false,
  showType: _showType = false,
  enableHover = true,
  className,
  onClick,
  onDownload,
  disabled = false,
  baseUrl,
}) => {
  // =====================
  // State Management
  // =====================

  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // =====================
  // File Viewer Context
  // =====================

  const fileViewerContext = React.useContext(FileViewerContext);

  // =====================
  // Computed Values
  // =====================

  const fileType = useMemo(() => detectFileType(file), [file]);
  const thumbnailUrl = useMemo(
    () => generateThumbnailUrl(file, fileType, baseUrl),
    [file, fileType, baseUrl]
  );
  const canPreview = useMemo(() => canPreviewFile(fileType), [fileType]);

  // Size configurations
  const sizeConfig = useMemo(() => {
    const configs = {
      sm: {
        container: "w-20 h-20",
        icon: 16,
        text: "text-xs",
      },
      md: {
        container: "w-32 h-32",
        icon: 24,
        text: "text-sm",
      },
      lg: {
        container: "w-48 h-48",
        icon: 32,
        text: "text-base",
      },
    };
    return configs[size];
  }, [size]);

  // =====================
  // Event Handlers
  // =====================

  const handleThumbnailLoad = useCallback(() => {
    setThumbnailLoading(false);
  }, []);

  const handleThumbnailError = useCallback(() => {
    setThumbnailError(true);
    setThumbnailLoading(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;

      if (onClick) {
        // Custom click handler
        onClick(file);
      } else if (fileViewerContext) {
        // Use file viewer context
        fileViewerContext.actions.viewFile(file);
      } else {
        // Fallback: Use file viewer service directly
        fileViewerService.viewFile(file, { baseUrl });
      }
    },
    [disabled, onClick, file, fileViewerContext, baseUrl]
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;

      if (onDownload) {
        onDownload(file);
      } else if (fileViewerContext) {
        fileViewerContext.actions.downloadFile(file);
      } else {
        // Default download
        const urls = fileViewerService.generateFileUrls(file, baseUrl);
        const link = document.createElement("a");
        link.href = urls.download;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    [disabled, onDownload, file, fileViewerContext, baseUrl]
  );

  const handlePreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleClick(e);
    },
    [handleClick]
  );

  // Get the original file URL for dragging
  const getOriginalFileUrl = useCallback(() => {
    const apiUrl = baseUrl || getApiBaseUrl();
    // Use download endpoint to get the original file, not serve which may compress
    return `${apiUrl}/files/${file.id}/download`;
  }, [file, baseUrl]);

  // =====================
  // Render
  // =====================

  return (
    <div
      className={cn(
        "group relative overflow-hidden transition-all duration-200 rounded-lg",
        enableHover && !disabled && "hover:shadow-sm hover:scale-105 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Thumbnail Container */}
      <div
        className={cn(
          "relative flex items-center justify-center bg-muted/30 overflow-hidden",
          sizeConfig.container
        )}
      >
        {/* Thumbnail Image or Icon */}
        {thumbnailUrl && !thumbnailError ? (
          <>
            {/* Loading Skeleton */}
            {thumbnailLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 animate-pulse">
                {getFileTypeIcon(fileType, sizeConfig.icon)}
              </div>
            )}

            {/* Draggable link overlay for proper file dragging */}
            {!disabled && (
              <a
                href={getOriginalFileUrl()}
                download={file.filename}
                draggable={true}
                className="absolute inset-0 z-10"
                onClick={(e) => {
                  // Prevent navigation, let the card's onClick handle it
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragStart={(e) => {
                  // Allow drag to proceed with original file URL
                  e.stopPropagation();
                }}
              />
            )}

            {/* Actual Thumbnail */}
            <img
              src={thumbnailUrl}
              alt={file.filename}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                thumbnailLoading ? "opacity-0" : "opacity-100",
                fileType === "pdf" && "object-contain bg-white p-2",
                fileType === "document" && "object-contain bg-white p-2"
              )}
              onLoad={handleThumbnailLoad}
              onError={handleThumbnailError}
              loading="lazy"
              draggable={false}
            />
          </>
        ) : (
          /* Fallback Icon */
          <div className="flex items-center justify-center p-4">
            {thumbnailError ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <IconAlertCircle size={sizeConfig.icon} className="text-yellow-500" />
                <span className="text-xs">Sem preview</span>
              </div>
            ) : (
              getFileTypeIcon(fileType, sizeConfig.icon)
            )}
          </div>
        )}

        {/* Hover Overlay with Actions and File Information */}
        {enableHover && isHovered && !disabled && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 transition-all duration-200 p-4">
            {/* File Information */}
            <div className="text-center space-y-1 max-w-full px-2">
              <p
                className={cn(
                  "font-medium text-white truncate w-full",
                  sizeConfig.text
                )}
                title={file.filename}
              >
                {file.filename}
              </p>
              <p className="text-xs text-white/80">
                {formatFileSize(file.size)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {canPreview && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-white/90 hover:bg-white text-gray-900"
                  onClick={handlePreview}
                  title="Visualizar"
                >
                  <IconEye size={18} />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="bg-white/90 hover:bg-white text-gray-900"
                onClick={handleDownload}
                title="Download"
              >
                <IconDownload size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {thumbnailLoading && thumbnailUrl && !thumbnailError && (
          <div className="absolute bottom-2 right-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default FileViewerCard;
