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
  const fontSizeMap: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  };

  // Default font sizes for each heading level (only used when no custom fontSize)
  const defaultFontSizes: Record<number, string> = {
    1: 'text-4xl md:text-5xl',  // 36px/48px
    2: 'text-3xl md:text-4xl',  // 30px/36px
    3: 'text-2xl md:text-3xl',  // 24px/30px
    4: 'text-xl md:text-2xl',   // 20px/24px
    5: 'text-lg md:text-xl',    // 18px/20px
    6: 'text-base md:text-lg',  // 16px/18px
  };

  // Font weight classes
  const fontWeightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Base styles for all headings
  const baseStyles = "text-foreground tracking-tight scroll-mt-20 break-words whitespace-normal";

  // Get font size: use custom if provided, otherwise use semantic default
  const effectiveFontSize = fontSize ? fontSizeMap[fontSize] : defaultFontSizes[level];

  // Level-specific spacing and weight defaults
  const levelStyles = {
    1: cn(!fontWeight && "font-semibold", "leading-tight mb-6 mt-8"),
    2: cn(!fontWeight && "font-semibold", "leading-tight mb-5 mt-7"),
    3: cn(!fontWeight && "font-medium", "leading-snug mb-4 mt-6"),
    4: cn(!fontWeight && "font-medium", "leading-snug mb-3 mt-5"),
    5: cn(!fontWeight && "font-normal", "leading-normal mb-3 mt-4"),
    6: cn(!fontWeight && "font-normal", "leading-normal mb-2 mt-3"),
  };

  // Get effective weight
  const customFontWeight = fontWeight ? fontWeightMap[fontWeight] : '';

  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <HeadingTag
      id={id}
      className={cn(baseStyles, levelStyles[level], effectiveFontSize, customFontWeight, className)}
    >
      <InlineContent content={content} />
    </HeadingTag>
  );
});

HeadingBlock.displayName = "HeadingBlock";
