/**
 * Markdown Parser for Message Content
 *
 * Parses the inline markdown the composer stores — `{c:#hex}text{/c}`,
 * `[text](url)`, `**bold**`, `__underline__`, `*italic*` — into styled
 * InlineFormat runs.
 *
 * Markers NEST. The composer emits `{c:#hex}**texto**{/c}` whenever a colored
 * selection is bolded, and `{c:#a}{c:#b}x{/c}{/c}` whenever an already-colored
 * selection is recolored. So the parser descends recursively, and closes a
 * color tag with a balanced scan instead of a lazy regex — a lazy `.*?` closes
 * on the first `{/c}` and leaks the leftover markers into the rendered text.
 */

import type { InlineFormat } from '@/components/messaging/types';

/**
 * Returns the URL when it is safe to render in an href, otherwise ''.
 *
 * Blocks scheme-based XSS vectors (javascript:, data:, vbscript:, file:, …) —
 * including obfuscated forms like "java\tscript:" or "  javascript:" — while
 * allowing http/https/mailto/tel and relative/fragment/protocol-relative URLs.
 * Callers should drop the link (render plain text) when this returns ''.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  // Strip control chars / whitespace that can be smuggled inside a scheme.
  const normalized = trimmed.replace(/[\x00-\x20\x7f-\xa0]+/g, "");
  if (/^(?:https?|mailto|tel):/i.test(normalized)) return trimmed;
  // Relative, fragment, query, or protocol-relative URLs carry no scheme.
  if (/^(?:\/\/|\/|#|\?|\.)/.test(normalized)) return trimmed;
  // No colon at all → bare/relative path, safe.
  if (!normalized.includes(':')) return trimmed;
  // Any other explicit scheme is unsafe.
  return '';
}

// ─────────────────────────────── Inline parser ───────────────────────────────

/** Sticky matchers, used as "does a marker start exactly at index i?". */
const COLOR_OPEN = /\{c:#([0-9a-fA-F]{3,6})\}/y;
const LINK = /\[([^\]]+)\]\(([^)]*)\)/y;
const COLOR_CLOSE = '{/c}';

/** Style accumulated while descending through nested markers. */
interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  url?: string;
}

/**
 * The run's dominant style, kept so consumers that switch on `type` keep
 * working. The full style set always lives on the flags/color/url fields.
 */
function primaryType(style: RunStyle): InlineFormat['type'] {
  if (style.url) return 'link';
  if (style.color) return 'color';
  if (style.bold) return 'bold';
  if (style.underline) return 'underline';
  if (style.italic) return 'italic';
  return 'text';
}

function makeRun(content: string, style: RunStyle): InlineFormat {
  const run: InlineFormat = { type: primaryType(style), content };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.underline) run.underline = true;
  if (style.color) run.color = style.color;
  if (style.url) run.url = style.url;
  return run;
}

/**
 * Index of the `{/c}` closing the color run that starts at `from`, skipping
 * over nested `{c:#…}` pairs. Returns -1 when the run is never closed.
 */
function findColorClose(text: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < text.length) {
    if (text.startsWith(COLOR_CLOSE, i)) {
      if (depth === 0) return i;
      depth--;
      i += COLOR_CLOSE.length;
      continue;
    }
    COLOR_OPEN.lastIndex = i;
    const open = COLOR_OPEN.exec(text);
    if (open) {
      depth++;
      i = COLOR_OPEN.lastIndex;
      continue;
    }
    i++;
  }
  return -1;
}

function parseInline(text: string, style: RunStyle): InlineFormat[] {
  const runs: InlineFormat[] = [];
  let plain = '';

  const flush = () => {
    if (!plain) return;
    runs.push(makeRun(plain, style));
    plain = '';
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // {c:#RRGGBB}…{/c}
    if (ch === '{') {
      COLOR_OPEN.lastIndex = i;
      const open = COLOR_OPEN.exec(text);
      if (open) {
        const contentStart = COLOR_OPEN.lastIndex;
        const close = findColorClose(text, contentStart);
        if (close !== -1) {
          const inner = text.substring(contentStart, close);
          if (inner.trim()) {
            flush();
            runs.push(...parseInline(inner, { ...style, color: `#${open[1]}` }));
          } else {
            // Empty color run — keep the markers as written.
            plain += text.substring(i, close + COLOR_CLOSE.length);
          }
          i = close + COLOR_CLOSE.length;
          continue;
        }
      }
    }

    // [text](url)
    if (ch === '[') {
      LINK.lastIndex = i;
      const link = LINK.exec(text);
      if (link) {
        const label = link[1].trim();
        // Unsafe scheme (javascript:, data:, …) → keep the readable label,
        // drop the dangerous link.
        const url = sanitizeUrl(link[2].trim());
        if (label) {
          flush();
          runs.push(...parseInline(label, url ? { ...style, url } : style));
          i = LINK.lastIndex;
          continue;
        }
      }
    }

    // **bold**, __underline__, *italic*
    if (ch === '*' || ch === '_') {
      const token = text.startsWith('**', i)
        ? '**'
        : text.startsWith('__', i)
          ? '__'
          : ch === '*'
            ? '*'
            : null;
      if (token) {
        const close = text.indexOf(token, i + token.length);
        if (close !== -1) {
          const inner = text.substring(i + token.length, close);
          if (inner.trim()) {
            flush();
            const nested: RunStyle =
              token === '**'
                ? { ...style, bold: true }
                : token === '__'
                  ? { ...style, underline: true }
                  : { ...style, italic: true };
            runs.push(...parseInline(inner, nested));
            i = close + token.length;
            continue;
          }
        }
      }
    }

    plain += ch;
    i++;
  }

  flush();
  return runs;
}

/**
 * Parses text with markdown-style formatting into InlineFormat runs.
 *
 * Supported markers:
 * - `{c:#rrggbb}text{/c}` -> colored (nestable; innermost color wins)
 * - `[text](url)` -> link (unsafe schemes are dropped, label kept)
 * - `**text**` -> bold
 * - `__text__` -> underline
 * - `*text*` -> italic
 *
 * Markers combine: `{c:#3bc914}**texto**{/c}` yields ONE run that is both bold
 * and green, instead of a green run printing literal `**` markers.
 *
 * Unmatched or empty markers (`2 ** 3`, `{c:#3bc914}{/c}`) stay literal text.
 *
 * @param text - Text with markdown-style markers
 * @returns Array of InlineFormat objects
 */
export function parseMarkdownToInlineFormat(text: string): InlineFormat[] {
  if (!text) return [];
  const runs = parseInline(text, {});
  if (runs.length === 0) return [{ type: 'text', content: text }];
  return runs;
}

/**
 * Re-parses a run's own text for markers, keeping the run's style as the base.
 *
 * Stored content mixes both shapes — a plain string, or already-structured runs
 * whose text still carries markers (`{ type: 'color', content: '**texto**' }`)
 * — so renderers expand every run through this instead of only plain-text ones.
 */
export function expandInlineFormat(run: InlineFormat): InlineFormat[] {
  if (!run || !run.content) return [];
  return parseInline(run.content, {
    bold: run.bold ?? run.type === 'bold',
    italic: run.italic ?? run.type === 'italic',
    underline: run.underline ?? run.type === 'underline',
    color: run.color,
    // Structured content can come straight from the API, so a stored href is
    // sanitized here — every renderer downstream trusts the parsed run.
    url: run.url ? sanitizeUrl(run.url) || undefined : undefined,
  });
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
  // Parsing (rather than pair-matching regexes) is what makes nested markers
  // strip cleanly instead of leaving a stray `{/c}` behind.
  return parseMarkdownToInlineFormat(text)
    .map((run) => run.content)
    .join('');
}

/**
 * Checks if text contains any markdown formatting markers
 *
 * @param text - Text to check
 * @returns true if text contains formatting markers
 */
export function hasMarkdownFormatting(text: string): boolean {
  if (!text) return false;
  return /(\{c:#[0-9a-fA-F]{3,6}\})|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(\*[\s\S]+?\*)|(\[[^\]]+\]\([^)]*\))/.test(text);
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
      return text.replace(/\*\*([\s\S]+?)\*\*/g, '$1');
    case 'italic':
      return text.replace(/\*([\s\S]+?)\*/g, '$1');
    case 'underline':
      return text.replace(/__([\s\S]+?)__/g, '$1');
    case 'link':
      return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    case 'color':
      // Markers are dropped individually: nested runs have no matching pairs.
      return text.replace(/\{c:#[0-9a-fA-F]{3,6}\}/g, '').replace(/\{\/c\}/g, '');
    default:
      return text;
  }
}
