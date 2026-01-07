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
  const { level, content, id } = block;

  // Don't render empty headings
  if (!content || content.length === 0) {
    return null;
  }

  // Base styles for all headings
  const baseStyles = "font-semibold text-foreground tracking-tight scroll-mt-20";

  // Level-specific styles following design system
  const levelStyles = {
    1: "text-4xl md:text-5xl leading-tight mb-6 mt-8",
    2: "text-3xl md:text-4xl leading-tight mb-5 mt-7",
    3: "text-2xl md:text-3xl leading-snug mb-4 mt-6",
    4: "text-xl md:text-2xl leading-snug mb-3 mt-5",
    5: "text-lg md:text-xl leading-normal mb-3 mt-4",
    6: "text-base md:text-lg leading-normal mb-2 mt-3",
  };

  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <HeadingTag
      id={id}
      className={cn(baseStyles, levelStyles[level], className)}
    >
      <InlineContent content={content} />
    </HeadingTag>
  );
});

HeadingBlock.displayName = "HeadingBlock";
