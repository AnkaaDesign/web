import * as React from "react";
import type { HeadingBlock as HeadingBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";

interface HeadingBlockProps {
  block: HeadingBlockType;
  className?: string;
}

/**
 * Renders a semantic heading element with appropriate styling based on level.
 * Supports all heading levels (h1-h6) with consistent design system styles.
 */
export const HeadingBlock = React.memo<HeadingBlockProps>(({ block, className }) => {
  const { level, content, id, fontSize, fontWeight } = block;

  // Don't render empty headings
  if (!content || content.length === 0) {
    return null;
  }

  // Font size classes
  const fontSizeMap = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  };

  // Font weight classes
  const fontWeightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Base styles for all headings
  const baseStyles = "text-foreground tracking-tight scroll-mt-20";

  // Level-specific styles following design system (only applied if no custom fontSize/weight)
  const levelStyles = {
    1: cn(!fontSize && "text-4xl md:text-5xl", !fontWeight && "font-semibold", "leading-tight mb-6 mt-8"),
    2: cn(!fontSize && "text-3xl md:text-4xl", !fontWeight && "font-semibold", "leading-tight mb-5 mt-7"),
    3: cn(!fontSize && "text-2xl md:text-3xl", !fontWeight && "font-medium", "leading-snug mb-4 mt-6"),
    4: cn(!fontSize && "text-xl md:text-2xl", !fontWeight && "font-medium", "leading-snug mb-3 mt-5"),
    5: cn(!fontSize && "text-lg md:text-xl", !fontWeight && "font-normal", "leading-normal mb-3 mt-4"),
    6: cn(!fontSize && "text-base md:text-lg", !fontWeight && "font-normal", "leading-normal mb-2 mt-3"),
  };

  // Custom styles override defaults
  const customFontSize = fontSize ? fontSizeMap[fontSize] : '';
  const customFontWeight = fontWeight ? fontWeightMap[fontWeight] : '';

  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <HeadingTag
      id={id}
      className={cn(baseStyles, levelStyles[level], customFontSize, customFontWeight, className)}
    >
      <InlineContent content={content} />
    </HeadingTag>
  );
});

HeadingBlock.displayName = "HeadingBlock";
