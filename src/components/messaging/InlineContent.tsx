import * as React from "react";
import type { InlineFormat } from "./types";
import { cn } from "@/lib/utils";

interface InlineContentProps {
  content: InlineFormat[];
  className?: string;
}

/**
 * Renders text content with newlines converted to <br /> elements
 */
const renderTextWithLineBreaks = (text: string): React.ReactNode => {
  if (!text.includes('\n')) {
    return text;
  }

  const parts = text.split('\n');
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && <br />}
    </React.Fragment>
  ));
};

/**
 * Renders inline formatted text content with support for bold, italic, and links.
 * Handles nested formatting and ensures proper semantic HTML.
 * Preserves line breaks by converting \n to <br /> elements.
 */
export const InlineContent = React.memo<InlineContentProps>(({ content, className }) => {
  return (
    <span className={cn("inline", className)}>
      {content.map((format, index) => {
        const key = `inline-${index}`;

        switch (format.type) {
          case 'text':
            return <React.Fragment key={key}>{renderTextWithLineBreaks(format.content)}</React.Fragment>;

          case 'bold':
            return (
              <strong key={key} className="font-semibold text-foreground">
                {renderTextWithLineBreaks(format.content)}
              </strong>
            );

          case 'italic':
            return (
              <em key={key} className="italic">
                {renderTextWithLineBreaks(format.content)}
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
                {renderTextWithLineBreaks(format.content)}
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
