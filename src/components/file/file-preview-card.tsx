import React, { useState } from "react";
import type { File as AnkaaFile } from "../../types";
import { formatFileSize, getFileCategory, getFileDisplayName, getFileUrl, isImageFile } from "../../utils/file";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { IconPhoto, IconFileText, IconVideo, IconMusic, IconFileZip, IconFile, IconVectorBezier, IconEye } from "@tabler/icons-react";

export interface FilePreviewCardProps {
  file: AnkaaFile;
  onPreview?: (file: AnkaaFile, index: number) => void;
  onDownload?: (file: AnkaaFile) => void;
  onClick?: () => void;
  index?: number;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showActions?: boolean;
  showMetadata?: boolean;
}

const isEpsFile = (file: AnkaaFile): boolean => {
  const epsMimeTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  return epsMimeTypes.includes(file.mimetype.toLowerCase());
};

const getFileIcon = (file: AnkaaFile, size: number = 24) => {
  const category = getFileCategory(file);
  const iconProps = { size, className: "shrink-0" };

  // Special handling for EPS files
  if (isEpsFile(file)) {
    return <IconVectorBezier {...iconProps} className={cn(iconProps.className, "text-indigo-600")} />;
  }

  switch (category) {
    case "image":
      return <IconPhoto {...iconProps} className={cn(iconProps.className, "text-blue-600")} />;
    case "document":
      if (file.mimetype === "application/pdf") {
        return <IconFileText {...iconProps} className={cn(iconProps.className, "text-red-600")} />;
      }
      return <IconFileText {...iconProps} className={cn(iconProps.className, "text-gray-600")} />;
    case "video":
      return <IconVideo {...iconProps} className={cn(iconProps.className, "text-purple-600")} />;
    case "audio":
      return <IconMusic {...iconProps} className={cn(iconProps.className, "text-green-600")} />;
    case "archive":
      return <IconFileZip {...iconProps} className={cn(iconProps.className, "text-yellow-600")} />;
    default:
      return <IconFile {...iconProps} className={cn(iconProps.className, "text-gray-500")} />;
  }
};

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({
  file,
  onPreview,
  onDownload,
  onClick,
  index = 0,
  className,
  size = "md",
  showActions = true,
  showMetadata = true,
}) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(false);

  const category = getFileCategory(file);
  const isImage = isImageFile(file);
  const isPdf = file.mimetype === "application/pdf";
  const isEps = isEpsFile(file);
  const canPreview = isImage || isPdf || isEps;
  // For PDFs and EPS, always try to show thumbnail
  const hasThumbnail = file.thumbnailUrl || isImage || isPdf || isEps;

  // Debug logging
  React.useEffect(() => {}, [file]);

  // Only show thumbnail after initial render to prevent flash
  React.useEffect(() => {
    if (hasThumbnail) {
      const timer = setTimeout(
        () => {
          setShowThumbnail(true);
        },
        100 + index * 50,
      ); // Stagger loading for better UX
      return () => clearTimeout(timer);
    }
  }, [hasThumbnail, index]);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    // Handle different file types
    if (file.mimetype === "application/pdf") {
      // Open PDF in new tab
      const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://192.168.0.123:3030";
      window.open(`${apiUrl}/files/serve/${file.id}`, "_blank");
    } else if (isImage || category === "video") {
      // Open image/video in preview modal if available
      if (onPreview) {
        onPreview(file, index);
      }
    } else if (onDownload) {
      // Download other file types
      onDownload(file);
    } else {
      // Default: try to open in new tab
      const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://192.168.0.123:3030";
      window.open(`${apiUrl}/files/${file.id}/download`, "_blank");
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

  // Size-based dimensions
  const sizeClasses = {
    xs: "w-16 h-16",
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 hover:shadow-lg cursor-pointer overflow-hidden",
        !className?.includes("w-") && !className?.includes("h-") && sizeClasses[size],
        "border-2 hover:border-primary/20",
        className,
      )}
      onClick={handleClick}
    >
      <CardContent className="p-0 h-full w-full">
        {/* Thumbnail/Icon Area - Full size */}
        <div className="h-full w-full flex items-center justify-center bg-muted/20 relative overflow-hidden">
          {showThumbnail && hasThumbnail && !thumbnailError ? (
            <div className="relative w-full h-full">
              {thumbnailLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-md">
                  <div className="animate-pulse">{getFileIcon(file, 32)}</div>
                </div>
              )}
              <img
                src={(() => {
                  // Use the correct API URL - same as the one used for API calls
                  const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://192.168.0.123:3030";
                  let thumbnailSrc = "";

                  if (file.thumbnailUrl) {
                    // If thumbnailUrl is a full URL, use it as is
                    if (file.thumbnailUrl.startsWith("http")) {
                      thumbnailSrc = file.thumbnailUrl;
                    }
                    // If it's a path, prepend the API URL
                    else if (file.thumbnailUrl.startsWith("/")) {
                      thumbnailSrc = `${apiUrl}${file.thumbnailUrl}`;
                    } else {
                      thumbnailSrc = file.thumbnailUrl;
                    }
                  }
                  // For images without thumbnails, use the direct file URL
                  else if (isImage) {
                    thumbnailSrc = `${apiUrl}/files/serve/${file.id}`;
                  }
                  // For PDFs and EPS, try the thumbnail endpoint
                  else if (isPdf || isEps) {
                    thumbnailSrc = `${apiUrl}/files/thumbnail/${file.id}`;
                  } else {
                    thumbnailSrc = getFileUrl(file);
                  }
                  return thumbnailSrc;
                })()}
                alt={file.filename}
                className={cn("w-full h-full object-contain rounded-md transition-all duration-300", thumbnailLoading ? "opacity-0" : "opacity-100")}
                onLoad={handleThumbnailLoad}
                onError={handleThumbnailError}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full w-full">{getFileIcon(file, size === "xs" || size === "sm" ? 24 : 32)}</div>
          )}

          {/* Preview overlay on hover - only show icon */}
          {canPreview && showActions && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded">
              <IconEye className="text-white" size={20} />
            </div>
          )}
        </div>

        {/* File Info - Compact */}
        {showMetadata && (
          <div className="space-y-1 mt-2">
            <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-2 min-h-[2.5rem] flex items-center">{getFileDisplayName(file, 30)}</h4>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">{formatFileSize(file.size)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilePreviewCard;
