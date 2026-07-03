import * as React from "react";
import type { QuoteBlock as QuoteBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import {
  FONT_SIZE_PX,
  FONT_WEIGHT,
  PARAGRAPH_FONT_SIZE,
  PARAGRAPH_LINE_HEIGHT,
  QUOTE_AUTHOR_FONT_SIZE,
  QUOTE_BORDER_WIDTH,
  QUOTE_PADDING_LEFT,
} from "./render-constants";

interface QuoteBlockProps {
  block: QuoteBlockType;
  className?: string;
}

/**
 * Renders a blockquote (Message Rendering Spec §3):
 * 15px italic, 3px primary-green left border, 12px left padding;
 * optional author line "— author" at 13px muted.
 */
export const QuoteBlock = React.memo<QuoteBlockProps>(({ block, className }) => {
  const { content, author, id, fontSize, fontWeight } = block;

  // Don't render empty quotes
  if (!content || content.length === 0) {
    return null;
  }

  const textStyle: React.CSSProperties = {
    fontSize: fontSize && FONT_SIZE_PX[fontSize] ? FONT_SIZE_PX[fontSize] : PARAGRAPH_FONT_SIZE,
    fontWeight: fontWeight && FONT_WEIGHT[fontWeight] ? FONT_WEIGHT[fontWeight] : 400,
    lineHeight: PARAGRAPH_LINE_HEIGHT,
  };

  return (
    <blockquote
      id={id}
      style={{
        borderLeft: `${QUOTE_BORDER_WIDTH}px solid hsl(var(--primary))`,
        paddingLeft: QUOTE_PADDING_LEFT,
        margin: 0,
      }}
      className={className}
      role="blockquote"
    >
      <div
        style={textStyle}
        className="text-foreground italic break-words whitespace-normal"
      >
        <InlineContent content={content} />
      </div>

      {author && (
        <footer
          style={{ fontSize: QUOTE_AUTHOR_FONT_SIZE, marginTop: 4 }}
          className="text-muted-foreground not-italic"
        >
          <cite className="not-italic">— {author}</cite>
        </footer>
      )}
    </blockquote>
  );
});

QuoteBlock.displayName = "QuoteBlock";
