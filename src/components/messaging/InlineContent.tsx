import * as React from "react";
import type { InlineFormat } from "./types";
import { cn } from "@/lib/utils";

interface InlineContentProps {
  content: InlineFormat[];
  className?: string;
}

/**
 * Renders inline formatted text content with support for bold, italic, and links.
 * Handles nested formatting and ensures proper semantic HTML.
 */
export const InlineContent = React.memo<InlineContentProps>(({ content, className }) => {
  return (
    <span className={cn("inline", className)}>
      {content.map((format, index) => {
        const key = `inline-${index}`;

        switch (format.type) {
          case 'text':
            return <React.Fragment key={key}>{format.content}</React.Fragment>;

          case 'bold':
            return (
              <strong key={key} className="font-semibold text-foreground">
                {format.content}
              </strong>
            );

          case 'italic':
            return (
              <em key={key} className="italic">
                {format.content}
              </em>
            );

          case 'link':
            return (
              <a
                key={key}
                href={format.url}
                className="text-primary hover:underline underline-offset-2 transition-all focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-1 rounded-sm outline-none"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Link to ${format.url}`}
              >
                {format.content}
              </a>
            );

          default:
            return null;
        }
      })}
    </span>
  );
});

InlineContent.displayName = "InlineContent";
