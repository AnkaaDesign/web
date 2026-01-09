import * as React from "react";
import type { IconBlock as IconBlockType } from "./types";
import { cn } from "@/lib/utils";
import * as TablerIcons from "@tabler/icons-react";

interface IconBlockProps {
  block: IconBlockType;
  className?: string;
}

/**
 * Renders an icon block using Tabler icons
 */
export const IconBlock = React.memo<IconBlockProps>(({ block, className }) => {
  console.log('[IconBlock] Rendering icon block:', block);
  const { icon, size = 'md', color = 'text-foreground', alignment = 'center', id } = block;

  // Dynamically import the icon component
  const IconComponent = icon ? (TablerIcons as any)[icon] : null;

  if (!IconComponent) {
    console.warn(`[IconBlock] Icon "${icon}" not found in Tabler icons`);
    return null;
  }

  console.log('[IconBlock] Successfully loaded icon:', icon);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <IconComponent
      id={id}
      className={cn(
        "my-2",
        sizeClasses[size],
        color,
        className
      )}
      aria-hidden="true"
    />
  );
});

IconBlock.displayName = "IconBlock";
