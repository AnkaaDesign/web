/**
 * Markdown Parser for Message Content
 *
 * Parses markdown-style formatting markers into structured InlineFormat objects.
 * Supports: **bold**, *italic*, __underline__, and [link](url)
 */

import type { InlineFormat } from '@/components/messaging/types';

/**
 * Parses text with markdown-style formatting into InlineFormat array
 *
 * Supported formats:
 * - **text** -> bold (handles spaces: ** text ** or **text**)
 * - *text* -> italic (handles spaces: * text * or *text*)
 * - __text__ -> underline (not in InlineFormat spec, treated as bold for now)
 * - [text](url) -> link
 *
 * Edge cases handled:
 * - Spaces inside markers: ** text ** is parsed correctly
 * - Nested formatting: **bold *and italic* text** (outer wins)
 * - Empty markers: ** ** is treated as plain text
 * - Single markers: * or ** without closing are treated as plain text
 *
 * @param text - Text with markdown-style markers
 * @returns Array of InlineFormat objects
 */
export function parseMarkdownToInlineFormat(text: string): InlineFormat[] {
  if (!text) return [];

  const result: InlineFormat[] = [];
  let currentIndex = 0;

  // Combined regex to match all formatting patterns
  // Order matters: color first (avoid conflicts), then links (most specific), then bold/underline, then italic
  // Using [\s\S] instead of . to match any character including newlines
  // Using *? for non-greedy matching to avoid over-matching
  // Allowing spaces around content: ** text ** or **text**
  const formatRegex = /(\{c:#([0-9a-fA-F]{3,6})\}([\s\S]*?)\{\/c\})|(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+?)\*\*)|(__([^_]+?)__)|(\*([^*]+?)\*)/g;

  let match: RegExpExecArray | null;

  while ((match = formatRegex.exec(text)) !== null) {
    // Add any plain text before this match
    if (match.index > currentIndex) {
      const plainText = text.substring(currentIndex, match.index);
      if (plainText) {
        result.push({ type: 'text', content: plainText });
      }
    }

    // Determine which pattern matched and add formatted content
    if (match[1]) {
      // Color: {c:#RRGGBB}text{/c}
      const colorHex = `#${match[2]}`;
      const colorContent = match[3];
      if (colorContent.trim()) {
        result.push({
          type: 'color',
          content: colorContent,
          color: colorHex,
        });
      } else {
        result.push({
          type: 'text',
          content: match[0],
        });
      }
    } else if (match[4]) {
      // Link: [text](url)
      const linkText = match[5].trim();
      const linkUrl = match[6].trim();
      // Only add link if both text and URL are non-empty
      if (linkText && linkUrl) {
        result.push({
          type: 'link',
          content: linkText,
          url: linkUrl,
        });
      } else {
        // Invalid link format - treat as plain text
        result.push({
          type: 'text',
          content: match[0],
        });
      }
    } else if (match[7]) {
      // Bold: **text**
      const boldText = match[8];
      // Skip if content is only whitespace
      if (boldText.trim()) {
        result.push({
          type: 'bold',
          content: boldText,
        });
      } else {
        // Empty bold markers - treat as plain text
        result.push({
          type: 'text',
          content: match[0],
        });
      }
    } else if (match[9]) {
      // Underline: __text__
      const underlineText = match[10];
      if (underlineText.trim()) {
        result.push({
          type: 'underline',
          content: underlineText,
        });
      } else {
        result.push({
          type: 'text',
          content: match[0],
        });
      }
    } else if (match[11]) {
      // Italic: *text*
      const italicText = match[12];
      // Skip if content is only whitespace
      if (italicText.trim()) {
        result.push({
          type: 'italic',
          content: italicText,
        });
      } else {
        // Empty italic markers - treat as plain text
        result.push({
          type: 'text',
          content: match[0],
        });
      }
    }

    currentIndex = match.index + match[0].length;
  }

  // Add any remaining plain text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText) {
      result.push({ type: 'text', content: remainingText });
    }
  }

  // If no formatting was found, return the entire text as plain
  if (result.length === 0) {
    return [{ type: 'text', content: text }];
  }

  return result;
}

/**
 * Removes markdown formatting markers from text, leaving only plain text
 * Useful for stripping formatting when toggling back to normal
 *
 * @param text - Text with markdown markers
 * @returns Plain text without markers
 */
export function stripMarkdownFormatting(text: string): string {
  if (!text) return '';

  return text
    // Remove color {c:#hex}text{/c} -> text
    .replace(/\{c:#[0-9a-fA-F]{3,6}\}(.*?)\{\/c\}/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold **text** -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove underline __text__ -> text
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic *text* -> text
    .replace(/\*([^*]+)\*/g, '$1');
}

/**
 * Checks if text contains any markdown formatting markers
 *
 * @param text - Text to check
 * @returns true if text contains formatting markers
 */
export function hasMarkdownFormatting(text: string): boolean {
  if (!text) return false;
  return /(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/.test(text);
}

/**
 * Wraps text with markdown markers based on format type
 *
 * @param text - Plain text to format
 * @param format - Format type
 * @param url - URL for link format (optional)
 * @returns Formatted text with markers
 */
export function wrapWithMarkdown(
  text: string,
  format: 'bold' | 'italic' | 'underline' | 'link' | 'color',
  url?: string
): string {
  if (!text) return '';

  switch (format) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'underline':
      return `__${text}__`;
    case 'link':
      return url ? `[${text}](${url})` : text;
    case 'color':
      return url ? `{c:${url}}${text}{/c}` : text;
    default:
      return text;
  }
}

/**
 * Removes specific formatting type from text
 *
 * @param text - Text with formatting
 * @param format - Format type to remove
 * @returns Text without specified formatting
 */
export function removeMarkdownFormat(
  text: string,
  format: 'bold' | 'italic' | 'underline' | 'link' | 'color'
): string {
  if (!text) return '';

  switch (format) {
    case 'bold':
      return text.replace(/\*\*([^*]+)\*\*/g, '$1');
    case 'italic':
      return text.replace(/\*([^*]+)\*/g, '$1');
    case 'underline':
      return text.replace(/__([^_]+)__/g, '$1');
    case 'link':
      return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    case 'color':
      return text.replace(/\{c:#[0-9a-fA-F]{3,6}\}(.*?)\{\/c\}/g, '$1');
    default:
      return text;
  }
}
