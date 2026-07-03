import * as React from "react";
import type { ParagraphBlock as ParagraphBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";
import { FONT_SIZE_PX, FONT_WEIGHT, PARAGRAPH_FONT_SIZE, PARAGRAPH_LINE_HEIGHT } from "./render-constants";

interface ParagraphBlockProps {
  block: ParagraphBlockType;
  className?: string;
}

/**
 * Renders a paragraph with inline formatting support.
 * Spec §3: 15px / 400 / line-height 1.5 by default.
 */
export const ParagraphBlock = React.memo<ParagraphBlockProps>(({ block, className }) => {
  const { content, id, fontSize, fontWeight } = block;

  // Don't render empty paragraphs
  if (!content || content.length === 0) {
    return null;
  }

  const style: React.CSSProperties = {
    fontSize: fontSize && FONT_SIZE_PX[fontSize] ? FONT_SIZE_PX[fontSize] : PARAGRAPH_FONT_SIZE,
    fontWeight: fontWeight && FONT_WEIGHT[fontWeight] ? FONT_WEIGHT[fontWeight] : 400,
    lineHeight: PARAGRAPH_LINE_HEIGHT,
    margin: 0,
  };

  return (
    <p
      id={id}
      style={style}
      className={cn("text-foreground break-words whitespace-normal", className)}
    >
      <InlineContent content={content} />
    </p>
  );
});

ParagraphBlock.displayName = "ParagraphBlock";
