import * as React from "react";
import type { InlineFormat } from "./types";
import { cn } from "@/lib/utils";

interface InlineContentProps {
  content: InlineFormat[];
  className?: string;
}

/**
 * Parses markdown-style formatting from a plain string into InlineFormat array.
 * Supports:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - [text](url) links
 */
const parseMarkdownText = (text: string): InlineFormat[] => {
  const result: InlineFormat[] = [];

  // Regex to match **bold**, *italic*, and [text](url)
  // Order matters: check bold (**) before italic (*) to avoid conflicts
  const pattern = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(\[(.+?)\]\((.+?)\))/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // **bold**
      result.push({ type: 'bold', content: match[2] });
    } else if (match[4]) {
      // __bold__
      result.push({ type: 'bold', content: match[4] });
    } else if (match[6]) {
      // *italic*
      result.push({ type: 'italic', content: match[6] });
    } else if (match[8]) {
      // _italic_
      result.push({ type: 'italic', content: match[8] });
    } else if (match[10] && match[11]) {
      // [text](url)
      result.push({ type: 'link', content: match[10], url: match[11] });
    }

    lastIndex = pattern.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no matches were found, return the original text
  if (result.length === 0) {
    result.push({ type: 'text', content: text });
  }

  return result;
};

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
  // Parse markdown in text content and flatten the result
  const parsedContent = content.flatMap((format) => {
    if (format.type === 'text') {
      return parseMarkdownText(format.content);
    }
    return [format];
  });

  return (
    <span className={cn("inline", className)}>
      {parsedContent.map((format, index) => {
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
