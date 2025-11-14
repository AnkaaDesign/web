import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { File as AnkaaFile } from "../../types";
import { getFileUrl } from "@/utils/file";

export type AvatarDisplaySize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface AvatarDisplayProps {
  /** File object containing logo/avatar information */
  file?: AnkaaFile | null;
  /** Alternative: Direct URL to the image */
  src?: string;
  /** Fallback text to display (usually initials) */
  fallback?: string;
  /** Alt text for the image */
  alt?: string;
  /** Size of the avatar */
  size?: AvatarDisplaySize;
  /** Custom className */
  className?: string;
  /** Shape of the avatar */
  shape?: "circle" | "square" | "rounded";
  /** Whether to show a border */
  bordered?: boolean;
  /** Custom fallback component */
  fallbackComponent?: React.ReactNode;
}

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-2xl",
} as const;

const SHAPE_CLASSES = {
  circle: "rounded-full",
  square: "rounded-none",
  rounded: "rounded-md",
} as const;

/**
 * AvatarDisplay Component
 *
 * A specialized component for displaying logos and avatars with proper fallbacks.
 * Use this component for:
 * - Supplier logos
 * - User profile pictures
 * - Brand/company logos
 * - Any circular or square avatar-style images
 *
 * Do NOT use this for:
 * - Document previews (use FileViewer instead)
 * - General file thumbnails (use FileItem instead)
 * - Multi-file displays (use FilePreviewGrid instead)
 */
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  file,
  src,
  fallback,
  alt = "Avatar",
  size = "md",
  className,
  shape = "circle",
  bordered = false,
  fallbackComponent,
}) => {
  // Determine the image source
  const imageSrc = React.useMemo(() => {
    if (src) return src;
    if (file?.id) return getFileUrl(file);
    return undefined;
  }, [src, file]);

  // Generate fallback text if not provided
  const fallbackText = React.useMemo(() => {
    if (fallback) return fallback;

    // Try to extract initials from alt text
    if (alt && alt !== "Avatar") {
      const words = alt.split(" ");
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      }
      return alt.substring(0, 2).toUpperCase();
    }

    return "?";
  }, [fallback, alt]);

  return (
    <Avatar
      className={cn(
        SIZE_CLASSES[size],
        SHAPE_CLASSES[shape],
        bordered && "border border-border/50",
        className,
      )}
    >
      {imageSrc && (
        <AvatarImage
          src={imageSrc}
          alt={alt}
          className={cn(
            "object-cover",
            shape === "square" && "rounded-none",
            shape === "rounded" && "rounded-md",
          )}
        />
      )}
      <AvatarFallback
        className={cn(
          "bg-muted font-semibold text-muted-foreground",
          shape === "square" && "rounded-none",
          shape === "rounded" && "rounded-md",
        )}
      >
        {fallbackComponent || fallbackText}
      </AvatarFallback>
    </Avatar>
  );
};

/**
 * SupplierLogoDisplay Component
 *
 * Specialized variant for supplier logos with consistent styling
 */
export interface SupplierLogoDisplayProps {
  logo?: AnkaaFile | null;
  supplierName: string;
  size?: AvatarDisplaySize;
  className?: string;
  shape?: "circle" | "square" | "rounded";
}

export const SupplierLogoDisplay: React.FC<SupplierLogoDisplayProps> = ({
  logo,
  supplierName,
  size = "md",
  className,
  shape = "rounded",
}) => {
  const initials = React.useMemo(() => {
    const words = supplierName.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return supplierName.substring(0, 2).toUpperCase();
  }, [supplierName]);

  return (
    <AvatarDisplay
      file={logo}
      alt={`${supplierName} logo`}
      fallback={initials}
      size={size}
      shape={shape}
      bordered
      className={className}
    />
  );
};

/**
 * CustomerLogoDisplay Component
 *
 * Specialized variant for customer logos with consistent styling
 */
export interface CustomerLogoDisplayProps {
  logo?: AnkaaFile | null;
  customerName: string;
  size?: AvatarDisplaySize;
  className?: string;
  shape?: "circle" | "square" | "rounded";
  bordered?: boolean;
}

export const CustomerLogoDisplay: React.FC<CustomerLogoDisplayProps> = ({
  logo,
  customerName,
  size = "md",
  className,
  shape = "rounded",
  bordered = true,
}) => {
  const initials = React.useMemo(() => {
    const words = customerName.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return customerName.substring(0, 2).toUpperCase();
  }, [customerName]);

  return (
    <AvatarDisplay
      file={logo}
      alt={`${customerName} logo`}
      fallback={initials}
      size={size}
      shape={shape}
      bordered={bordered}
      className={className}
    />
  );
};

/**
 * UserAvatarDisplay Component
 *
 * Specialized variant for user avatars with consistent styling
 */
export interface UserAvatarDisplayProps {
  avatar?: AnkaaFile | null;
  userName: string;
  size?: AvatarDisplaySize;
  className?: string;
  shape?: "circle" | "square" | "rounded";
  bordered?: boolean;
}

export const UserAvatarDisplay: React.FC<UserAvatarDisplayProps> = ({
  avatar,
  userName,
  size = "md",
  className,
  shape = "rounded",
  bordered = true,
}) => {
  const initials = React.useMemo(() => {
    const words = userName.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  }, [userName]);

  return (
    <AvatarDisplay
      file={avatar}
      alt={`${userName} avatar`}
      fallback={initials}
      size={size}
      shape={shape}
      bordered={bordered}
      className={className}
    />
  );
};

export default AvatarDisplay;
