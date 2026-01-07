import * as React from "react";
import type { QuoteBlock as QuoteBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";

interface QuoteBlockProps {
  block: QuoteBlockType;
  className?: string;
}

/**
 * Renders a blockquote with optional author attribution.
 * Styled with design system colors and proper semantic HTML.
 */
export const QuoteBlock = React.memo<QuoteBlockProps>(({ block, className }) => {
  const { content, author, id } = block;

  // Don't render empty quotes
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <blockquote
      id={id}
      className={cn(
        "my-6 border-l-4 border-primary/30 bg-muted/30 px-6 py-4 rounded-r-lg first:mt-0 last:mb-0",
        className
      )}
      role="blockquote"
    >
      <div className="text-base leading-relaxed text-foreground italic">
        <InlineContent content={content} />
      </div>

      {author && (
        <footer className="mt-3 text-sm text-muted-foreground not-italic">
          <cite className="font-medium">— {author}</cite>
        </footer>
      )}
    </blockquote>
  );
});

QuoteBlock.displayName = "QuoteBlock";
