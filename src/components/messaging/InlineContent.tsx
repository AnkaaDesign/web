import * as React from "react";
import type { InlineFormat } from "./types";
import { expandInlineFormat, parseMarkdownToInlineFormat, sanitizeUrl } from "@/utils/markdown-parser";
import { cn } from "@/lib/utils";

interface InlineContentProps {
  /** Structured runs, or a raw markdown string when a block was stored unparsed. */
  content: InlineFormat[] | string;
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
 * Renders one run with every style it carries. Wrapping order matters: the
 * color/link wrapper is outermost, so `text-foreground` on <strong> can never
 * override a colored run.
 */
const renderRun = (run: InlineFormat, key: string): React.ReactNode => {
  let node: React.ReactNode = renderTextWithLineBreaks(run.content);

  if (run.italic || run.type === 'italic') {
    node = <em className="italic">{node}</em>;
  }
  if (run.underline || run.type === 'underline') {
    node = <u>{node}</u>;
  }
  if (run.bold || run.type === 'bold') {
    node = <strong className={cn("font-semibold", !run.color && "text-foreground")}>{node}</strong>;
  }

  // Structured content can reach the renderer straight from the API, so the
  // href is sanitized here too — never trust a stored URL.
  const href = run.url ? sanitizeUrl(run.url) : '';
  if (href) {
    return (
      <a
        key={key}
        href={href}
        className="text-primary hover:underline underline-offset-2 transition-all focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-1 rounded-sm outline-none"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Link to ${href}`}
      >
        {node}
      </a>
    );
  }

  if (run.color) {
    return (
      <span key={key} style={{ color: run.color }}>
        {node}
      </span>
    );
  }

  return <React.Fragment key={key}>{node}</React.Fragment>;
};

/**
 * Renders inline formatted text content with support for bold, italic,
 * underline, color and links, including nested combinations.
 * Preserves line breaks by converting \n to <br /> elements.
 */
export const InlineContent = React.memo<InlineContentProps>(({ content, className }) => {
  // Every run is re-expanded: stored content mixes plain strings with typed
  // runs whose text still carries markers (`{type:'color', content:'**x**'}`).
  const parsedContent = React.useMemo(() => {
    if (typeof content === 'string') return parseMarkdownToInlineFormat(content);
    if (!Array.isArray(content)) return [];
    return content.flatMap((format) =>
      typeof format === 'string'
        ? parseMarkdownToInlineFormat(format)
        : expandInlineFormat(format),
    );
  }, [content]);

  return (
    <span className={cn("inline", className)}>
      {parsedContent.map((format, index) => renderRun(format, `inline-${index}`))}
    </span>
  );
});

InlineContent.displayName = "InlineContent";
