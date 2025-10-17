import React, { useState } from "react";
import type { File as AnkaaFile } from "../../types";
import { formatFileSize, getFileCategory, isImageFile } from "../../utils/file";
import { getPDFThumbnailUrl, isPDFFile } from "../../utils/pdf-thumbnail";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IconPhoto,
  IconFileText,
  IconDownload,
  IconEye,
  IconVideo,
  IconMusic,
  IconFileZip,
  IconFile,
  IconVectorBezier,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeXls,
} from "@tabler/icons-react";

export interface FileThumbnailProps {
  file: AnkaaFile;
  size?: "xs" | "sm" | "md";
  onClick?: () => void;
  onDownload?: () => void;
  showActions?: boolean;
  showSize?: boolean;
  showName?: boolean;
  className?: string;
}

const isEpsFile = (file: AnkaaFile): boolean => {
  const epsMimeTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  return epsMimeTypes.includes(file.mimetype.toLowerCase());
};

const getFileIcon = (file: AnkaaFile, size: number = 16) => {
  const category = getFileCategory(file);
  const iconProps = { size, className: "shrink-0" };

  // Special handling for specific file types
  if (isEpsFile(file)) {
    return <IconVectorBezier {...iconProps} className={cn(iconProps.className, "text-indigo-500")} />;
  }

  if (file.mimetype === "application/pdf") {
    return <IconFileTypePdf {...iconProps} className={cn(iconProps.className, "text-red-500")} />;
  }

  if (file.mimetype.includes("word") || file.filename.toLowerCase().endsWith(".docx") || file.filename.toLowerCase().endsWith(".doc")) {
    return <IconFileTypeDoc {...iconProps} className={cn(iconProps.className, "text-blue-500")} />;
  }

  if (file.mimetype.includes("sheet") || file.mimetype.includes("excel") || file.filename.toLowerCase().endsWith(".xlsx") || file.filename.toLowerCase().endsWith(".xls")) {
    return <IconFileTypeXls {...iconProps} className={cn(iconProps.className, "text-green-500")} />;
  }

  switch (category) {
    case "image":
      return <IconPhoto {...iconProps} className={cn(iconProps.className, "text-blue-500")} />;
    case "document":
      return <IconFileText {...iconProps} className={cn(iconProps.className, "text-gray-500")} />;
    case "video":
      return <IconVideo {...iconProps} className={cn(iconProps.className, "text-purple-500")} />;
    case "audio":
      return <IconMusic {...iconProps} className={cn(iconProps.className, "text-green-500")} />;
    case "archive":
      return <IconFileZip {...iconProps} className={cn(iconProps.className, "text-yellow-500")} />;
    default:
      return <IconFile {...iconProps} className={cn(iconProps.className, "text-gray-400")} />;
  }
};

const getThumbnailUrl = (file: AnkaaFile, size: "small" | "medium" = "small"): string => {
  const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030";

  // Handle PDF thumbnails
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

const getSizeConfig = (size: "xs" | "sm" | "md") => {
  switch (size) {
    case "xs":
      return {
        container: "w-8 h-8",
        icon: 12,
      };
    case "sm":
      return {
        container: "w-12 h-12",
        icon: 16,
      };
    default: // md
      return {
        container: "w-16 h-16",
        icon: 20,
      };
  }
};

export const FileThumbnail: React.FC<FileThumbnailProps> = ({ file, size = "md", onClick, onDownload, showActions = false, showSize = false, showName = false, className }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);

  const isImage = isImageFile(file);
  const isPdf = isPDFFile(file);
  const isEps = isEpsFile(file);
  const canPreview = isImage || isPdf || isEps;
  const hasThumbnail = file.thumbnailUrl || isImage || isPdf;
  const sizeConfig = getSizeConfig(size);

  React.useEffect(() => {
    if (hasThumbnail) {
      const timer = setTimeout(() => {
        setShowThumbnail(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail]);

  const handleThumbnailLoad = () => {
    setThumbnailLoading(false);
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
    setThumbnailLoading(false);
    setShowThumbnail(false);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    }
  };

  return (
    <div className={cn("group relative", className)}>
      {/* Thumbnail Container */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg bg-muted/30 border border-border/20 overflow-hidden transition-all duration-200 cursor-pointer hover:border-primary/30 hover:scale-105",
          sizeConfig.container,
          onClick && "hover:shadow-md",
        )}
        onClick={handleClick}
      >
        {showThumbnail && hasThumbnail && !thumbnailError ? (
          <div className="relative w-full h-full">
            {thumbnailLoading && <div className="absolute inset-0 flex items-center justify-center bg-muted/30 animate-pulse">{getFileIcon(file, sizeConfig.icon)}</div>}
            <img
              src={getThumbnailUrl(file, size === "xs" ? "small" : "medium")}
              alt={file.filename}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                thumbnailLoading ? "opacity-0" : "opacity-100",
                isPdf && "object-contain bg-white",
                isEps && "object-contain bg-white",
              )}
              onLoad={handleThumbnailLoad}
              onError={handleThumbnailError}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">{getFileIcon(file, sizeConfig.icon)}</div>
        )}

        {/* Action Buttons */}
        {showActions && size !== "xs" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-1">
              {canPreview && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-5 w-5 text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onClick) onClick();
                  }}
                >
                  <IconEye size={10} />
                </Button>
              )}
              {onDownload && (
                <Button variant="secondary" size="icon" className="h-5 w-5 text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0" onClick={handleDownload}>
                  <IconDownload size={10} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Info */}
      {(showName || showSize) && (
        <div className="mt-1 space-y-0.5">
          {showName && (
            <p className="text-xs font-medium text-foreground leading-tight line-clamp-1" title={file.filename}>
              {file.filename.length > 12 ? `${file.filename.substring(0, 12)}...` : file.filename}
            </p>
          )}
          {showSize && <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>}
        </div>
      )}

      {/* Loading Overlay */}
      {thumbnailLoading && showThumbnail && size !== "xs" && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-2 w-2 border border-primary/30 border-t-primary" />
        </div>
      )}
    </div>
  );
};

export default FileThumbnail;
