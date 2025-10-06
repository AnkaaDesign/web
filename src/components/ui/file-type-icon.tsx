import React from "react";
import { cn } from "@/lib/utils";
import { getFileTypeInfo, getFileTypeCategory, getCategoryLabel } from "../../utils";
import type { FileCategory, FileCategory as _FileCategoryType } from "../../utils";

// Tabler Icons imports - comprehensive set for file types
import {
  // Documents
  IconFileTypePdf,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePpt,

  // Images
  IconPhoto,
  IconVectorBezier,
  IconIcons,
  IconCamera,

  // Video
  IconVideo,
  IconDeviceTv,
  IconBrandYoutube,

  // Audio
  IconMusic,
  IconMicrophone,
  IconVolume,

  // Code
  IconBrandJavascript,
  IconBrandTypescript,
  IconBrandHtml5,
  IconBrandCss3,
  IconBrandPython,
  IconCoffee,
  IconBraces,
  IconCode,
  IconFileCode,

  // Archives
  IconFileZip,
  IconArchive,
  IconPackage,

  // CAD & 3D
  IconRuler2,
  IconBox,
  IconDimensions,

  // Special
  IconTypography,
  IconDatabase,
  IconBinary,
  IconFile,
  IconLoader,
  IconAlertCircle,
} from "@tabler/icons-react";

// Map of icon names to components
const ICON_COMPONENTS = {
  IconFileTypePdf,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePpt,
  IconPhoto,
  IconVectorBezier,
  IconIcons,
  IconCamera,
  IconVideo,
  IconDeviceTv,
  IconBrandYoutube,
  IconMusic,
  IconMicrophone,
  IconVolume,
  IconBrandJavascript,
  IconBrandTypescript,
  IconBrandHtml5,
  IconBrandCss3,
  IconBrandPython,
  IconCoffee,
  IconBraces,
  IconCode,
  IconFileCode,
  IconFileZip,
  IconArchive,
  IconPackage,
  IconRuler2,
  IconBox,
  IconDimensions,
  IconTypography,
  IconDatabase,
  IconBinary,
  IconFile,
  IconLoader,
  IconAlertCircle,
} as const;

export type FileTypeIconSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface FileTypeIconProps {
  /** File name with extension */
  filename: string;
  /** File MIME type (optional, fallback for detection) */
  mimeType?: string;
  /** Icon size */
  size?: FileTypeIconSize;
  /** Custom className */
  className?: string;
  /** Show file type label */
  showLabel?: boolean;
  /** Processing state */
  isProcessing?: boolean;
  /** Error state */
  isError?: boolean;
  /** Whether to animate processing icons */
  animate?: boolean;
}

const SIZE_CLASSES = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
} as const;

const SIZE_STROKE_WIDTH = {
  xs: 2.5,
  sm: 2,
  md: 1.5,
  lg: 1.5,
  xl: 1.25,
} as const;

/**
 * File Type Icon Component
 *
 * Displays appropriate icons for different file types with consistent styling
 * and color coding. Supports processing and error states.
 */
export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  filename,
  mimeType,
  size = "md",
  className,
  showLabel = false,
  isProcessing = false,
  isError = false,
  animate = true,
}) => {
  // Override category if in special states
  const category = React.useMemo(() => {
    if (isError) return FileCategory.ERROR;
    if (isProcessing) return FileCategory.PROCESSING;
    return getFileTypeCategory(filename, mimeType);
  }, [filename, mimeType, isError, isProcessing]);

  const fileInfo = getFileTypeInfo(filename, mimeType);
  const { colors, iconName } = fileInfo;

  // Get the icon component
  const IconComponent = ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || ICON_COMPONENTS.IconFile;

  // Icon classes
  const iconClasses = cn(SIZE_CLASSES[size], colors.icon, isProcessing && animate && "animate-spin", className);

  const strokeWidth = SIZE_STROKE_WIDTH[size];

  if (showLabel) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={cn("flex items-center justify-center rounded-lg p-2", colors.bg, colors.border, "border")}>
          <IconComponent className={iconClasses} stroke={strokeWidth} />
        </div>
        <span className={cn("text-xs font-medium text-center", colors.text, size === "xs" && "text-[10px]", size === "sm" && "text-[11px]")}>{getCategoryLabel(category)}</span>
      </div>
    );
  }

  return <IconComponent className={iconClasses} stroke={strokeWidth} />;
};

/**
 * File Type Badge Component
 *
 * Shows file type with background color and icon for upload cards
 */
export interface FileTypeBadgeProps {
  filename: string;
  mimeType?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  isProcessing?: boolean;
  isError?: boolean;
}

export const FileTypeBadge: React.FC<FileTypeBadgeProps> = ({ filename, mimeType, size = "md", className, isProcessing = false, isError = false }) => {
  const category = React.useMemo(() => {
    if (isError) return FileCategory.ERROR;
    if (isProcessing) return FileCategory.PROCESSING;
    return getFileTypeCategory(filename, mimeType);
  }, [filename, mimeType, isError, isProcessing]);

  const fileInfo = getFileTypeInfo(filename, mimeType);
  const { colors, iconName } = fileInfo;

  const IconComponent = ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || ICON_COMPONENTS.IconFile;

  const sizeClasses = {
    sm: {
      container: "px-2 py-1 text-xs",
      icon: "w-3 h-3",
      stroke: 2.5,
    },
    md: {
      container: "px-3 py-1.5 text-sm",
      icon: "w-4 h-4",
      stroke: 2,
    },
    lg: {
      container: "px-4 py-2 text-base",
      icon: "w-5 h-5",
      stroke: 1.5,
    },
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full font-medium", colors.bg, colors.border, colors.text, "border", sizeClasses[size].container, className)}>
      <IconComponent className={cn(sizeClasses[size].icon, isProcessing && "animate-spin")} stroke={sizeClasses[size].stroke} />
      <span>{getCategoryLabel(category)}</span>
    </div>
  );
};

/**
 * File Type Avatar Component
 *
 * Large icon display for file previews in upload cards (h-12 compatible)
 */
export interface FileTypeAvatarProps {
  filename: string;
  mimeType?: string;
  className?: string;
  isProcessing?: boolean;
  isError?: boolean;
  onClick?: () => void;
}

export const FileTypeAvatar: React.FC<FileTypeAvatarProps> = ({ filename, mimeType, className, isProcessing = false, onClick }) => {
  const fileInfo = getFileTypeInfo(filename, mimeType);
  const { colors, iconName } = fileInfo;

  const IconComponent = ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || ICON_COMPONENTS.IconFile;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl",
        "w-12 h-12", // Fixed size for upload cards
        colors.bg,
        colors.border,
        "border-2",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
      onClick={onClick}
    >
      <IconComponent className={cn("w-6 h-6", colors.icon, isProcessing && "animate-spin")} stroke={1.5} />
    </div>
  );
};

/**
 * File Type Info Component
 *
 * Complete file type information display
 */
export interface FileTypeInfoProps {
  filename: string;
  mimeType?: string;
  fileSize?: number;
  className?: string;
  isProcessing?: boolean;
  isError?: boolean;
  showFullPath?: boolean;
}

export const FileTypeInfo: React.FC<FileTypeInfoProps> = ({ filename, mimeType, fileSize, className, isProcessing = false, isError = false, showFullPath = false }) => {
  const category = React.useMemo(() => {
    if (isError) return FileCategory.ERROR;
    if (isProcessing) return FileCategory.PROCESSING;
    return getFileTypeCategory(filename, mimeType);
  }, [filename, mimeType, isError, isProcessing]);

  const fileInfo = getFileTypeInfo(filename, mimeType);
  const { colors } = fileInfo;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const displayFilename = showFullPath ? filename : filename.length > 30 ? `${filename.substring(0, 27)}...` : filename;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <FileTypeAvatar filename={filename} mimeType={mimeType} isProcessing={isProcessing} isError={isError} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayFilename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={colors.text}>{getCategoryLabel(category)}</span>
          {fileSize && (
            <>
              <span>•</span>
              <span>{formatFileSize(fileSize)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileTypeIcon;
