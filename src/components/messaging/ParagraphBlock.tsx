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
  const { content, id } = block;

  // Don't render empty paragraphs
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <p
      id={id}
      className={cn(
        "text-base leading-relaxed text-foreground mb-4 last:mb-0",
        className
      )}
    >
      <InlineContent content={content} />
    </p>
  );
});

ParagraphBlock.displayName = "ParagraphBlock";
