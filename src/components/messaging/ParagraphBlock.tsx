import * as React from "react";
import type { ParagraphBlock as ParagraphBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";

interface ParagraphBlockProps {
  block: ParagraphBlockType;
  className?: string;
}

/**
 * Renders a paragraph with inline formatting support.
 * Handles text, bold, italic, and link formatting.
 */
export const ParagraphBlock = React.memo<ParagraphBlockProps>(({ block, className }) => {
  const { content, id, fontSize, fontWeight } = block;

  // Don't render empty paragraphs
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

  const customFontSize = fontSize ? fontSizeMap[fontSize] : 'text-base';
  const customFontWeight = fontWeight ? fontWeightMap[fontWeight] : 'font-normal';

  return (
    <p
      id={id}
      className={cn(
        "leading-relaxed text-foreground break-words whitespace-normal",
        customFontSize,
        customFontWeight,
        className
      )}
    >
      <InlineContent content={content} />
    </p>
  );
});

ParagraphBlock.displayName = "ParagraphBlock";
