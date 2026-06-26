/**
 * Rich Paste → Message Blocks
 *
 * Converts pasted, already-formatted content (HTML from Word, Google Docs, web
 * pages, etc. — or plain text) into the editor's standard ContentBlock format.
 *
 * The goal of the "Simples" flow is to let a user paste text that is *already
 * formatted* and keep the formatting: bold, italic, underline, links, lists and
 * paragraph spacing. We deliberately emit only the existing block types
 * (heading1/heading2, paragraph, list, quote, divider, spacer) so the result
 * renders everywhere (web preview, public viewer, mobile, PDF) with no extra
 * wiring — exactly like the "Exemplos" templates do.
 *
 * Inline formatting is encoded with the same markdown markers the rest of the
 * editor uses (see markdown-parser.ts / rich-text-editor.tsx):
 *   **bold**  *italic*  __underline__  [text](url)  {c:#rrggbb}text{/c}
 */

import type { ContentBlock, DecoratorVariant } from '@/components/administration/message/editor/types';

// ─── id generation ────────────────────────────────────────────────────────────
let seq = 0;
function blockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${seq++}`;
}

// ─── block factories ──────────────────────────────────────────────────────────
function paragraph(content: string): ContentBlock {
  return { id: blockId(), type: 'paragraph', content, fontSize: 'base', fontWeight: 'normal' };
}
function heading(type: 'heading1' | 'heading2', content: string): ContentBlock {
  return type === 'heading1'
    ? { id: blockId(), type, content, fontSize: '2xl', fontWeight: 'bold' }
    : { id: blockId(), type, content, fontSize: 'xl', fontWeight: 'semibold' };
}
function quote(content: string): ContentBlock {
  return { id: blockId(), type: 'quote', content, fontSize: 'lg', fontWeight: 'normal' };
}
function list(items: string[], ordered: boolean): ContentBlock {
  return { id: blockId(), type: 'list', items, ordered };
}
function divider(): ContentBlock {
  return { id: blockId(), type: 'divider' };
}
function spacer(height: 'sm' | 'md' | 'lg' | 'xl' = 'sm'): ContentBlock {
  return { id: blockId(), type: 'spacer', height };
}

// ─── inline style detection ───────────────────────────────────────────────────
// Considers BOTH tag and inline style. An explicit style override wins over the
// tag — crucial for Google Docs, which wraps the whole paste in
// <b style="font-weight:normal"> (tag-only detection would bold everything).
function isBold(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const fw = (el.style.fontWeight || '').toLowerCase();
  const n = parseInt(fw, 10);
  if (fw === 'normal' || (!Number.isNaN(n) && n < 600)) return false;
  if (tag === 'b' || tag === 'strong') return true;
  return fw === 'bold' || fw === 'bolder' || (!Number.isNaN(n) && n >= 600);
}
function isItalic(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const fs = (el.style.fontStyle || '').toLowerCase();
  if (fs === 'normal') return false;
  return tag === 'i' || tag === 'em' || fs.includes('italic');
}
function isUnderline(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const td = `${el.style.textDecoration || ''} ${(el.style as any).textDecorationLine || ''}`.toLowerCase();
  if (td.includes('underline')) return true;
  return tag === 'u' && !td.includes('none');
}

// ─── inline serialization (DOM → markdown string) ─────────────────────────────
// We intentionally do NOT carry over text color: pasted content (Google Docs in
// particular) nests colored spans, which would produce nested {c:..} markers the
// flat markdown parser cannot handle, leaking literal markers into the output.
// `active` tracks formats already applied by ancestors so we never double-wrap
// (e.g. nested bold spans → ****text**** which also breaks the parser).
interface ActiveFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function serializeInline(node: Node, active: ActiveFormats = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  if (tag === 'style' || tag === 'script') return '';

  const elBold = isBold(el);
  const elItalic = isItalic(el);
  const elUnderline = isUnderline(el);

  const childActive: ActiveFormats = {
    bold: active.bold || elBold,
    italic: active.italic || elItalic,
    underline: active.underline || elUnderline,
  };

  let inner = Array.from(el.childNodes).map((c) => serializeInline(c, childActive)).join('');
  if (!inner.trim()) return inner; // preserve whitespace-only runs verbatim

  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    if (href) inner = `[${inner}](${href})`;
  }
  // Only wrap a format that an ancestor hasn't already applied.
  if (elUnderline && !active.underline) inner = `__${inner}__`;
  if (elItalic && !active.italic) inner = `*${inner}*`;
  if (elBold && !active.bold) inner = `**${inner}**`;
  return inner;
}

// Normalize a serialized inline run into clean paragraph text.
function cleanInline(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── block-level walk ─────────────────────────────────────────────────────────
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'figure', 'main',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'blockquote', 'table', 'pre', 'hr',
]);

function isBlock(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase());
}
function hasBlockChild(el: HTMLElement): boolean {
  return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
}
function listItems(el: HTMLElement, ordered: boolean): ContentBlock {
  const items = Array.from(el.children)
    .filter((c) => c.tagName.toLowerCase() === 'li')
    .map((li) => cleanInline(serializeInline(li)).replace(/\n+/g, ' '))
    .filter(Boolean);
  return list(items.length ? items : [''], ordered);
}

function tableToParagraphs(el: HTMLElement, out: ContentBlock[]): void {
  Array.from(el.querySelectorAll('tr')).forEach((tr) => {
    const cells = Array.from(tr.children)
      .filter((c) => /^(td|th)$/.test(c.tagName.toLowerCase()))
      .map((c) => cleanInline(serializeInline(c)).replace(/\n+/g, ' '))
      .filter(Boolean);
    if (cells.length) out.push(paragraph(cells.join('   ')));
  });
}

function walk(container: HTMLElement, out: ContentBlock[]): void {
  let buf = '';
  const flush = () => {
    const text = cleanInline(buf);
    buf = '';
    if (text) out.push(paragraph(text));
  };

  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || '';
      if (t.trim()) buf += t.replace(/\s+/g, ' ');
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') { buf += '\n'; continue; }
    if (!isBlock(el)) {
      // Inline element — but Google Docs wraps block <p>/<ul> inside an outer
      // inline <b>; descend so that nested structure isn't flattened into one line.
      if (hasBlockChild(el)) { flush(); walk(el, out); }
      else { buf += serializeInline(el); }
      continue;
    }

    flush(); // a block element ends the current inline run

    switch (tag) {
      case 'h1': {
        const c = cleanInline(serializeInline(el)).replace(/\n+/g, ' ');
        if (c) out.push(heading('heading1', c));
        break;
      }
      case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const c = cleanInline(serializeInline(el)).replace(/\n+/g, ' ');
        if (c) out.push(heading('heading2', c));
        break;
      }
      case 'ul': out.push(listItems(el, false)); break;
      case 'ol': out.push(listItems(el, true)); break;
      case 'blockquote': {
        const c = cleanInline(serializeInline(el));
        if (c) out.push(quote(c));
        break;
      }
      case 'hr': out.push(divider()); break;
      case 'pre': {
        const c = (el.textContent || '').replace(/\s+$/g, '');
        if (c.trim()) out.push(paragraph(c));
        break;
      }
      case 'table': tableToParagraphs(el, out); break;
      default: {
        // p / div / section / etc.
        if (hasBlockChild(el)) {
          walk(el, out);
        } else {
          const c = cleanInline(serializeInline(el));
          if (c) out.push(paragraph(c)); // skip empty / whitespace-only blocks
        }
      }
    }
  }
  flush();
}

// Trim leading/trailing spacers and collapse consecutive ones.
function tidy(blocks: ContentBlock[]): ContentBlock[] {
  const collapsed: ContentBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'spacer' && collapsed[collapsed.length - 1]?.type === 'spacer') continue;
    collapsed.push(b);
  }
  while (collapsed[0]?.type === 'spacer') collapsed.shift();
  while (collapsed[collapsed.length - 1]?.type === 'spacer') collapsed.pop();
  return collapsed;
}

/** Convert pasted HTML into content blocks. */
export function htmlToContentBlocks(html: string): ContentBlock[] {
  if (!html || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: ContentBlock[] = [];
  walk(doc.body, out);
  return tidy(out);
}

/** Convert pasted plain text into content blocks (paragraphs + simple lists). */
export function plainTextToContentBlocks(text: string): ContentBlock[] {
  if (!text || !text.trim()) return [];
  const paras = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n{2,}/);
  const out: ContentBlock[] = [];
  for (const raw of paras) {
    const para = raw.replace(/[ \t]+$/gm, '');
    if (!para.trim()) continue;
    const lines = para.split('\n').filter((l) => l.trim().length > 0);
    const allBullets = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
    const allNumbered = lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    if (lines.length > 1 && allBullets) {
      out.push(list(lines.map((l) => l.replace(/^\s*[-*•]\s+/, '')), false));
    } else if (lines.length > 1 && allNumbered) {
      out.push(list(lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, '')), true));
    } else {
      out.push(paragraph(para.trim()));
    }
  }
  return out;
}

/**
 * Convert clipboard data (HTML preferred, plain-text fallback) into content
 * blocks. Returns [] when there is nothing usable.
 */
export function clipboardToContentBlocks(input: { html?: string; text?: string }): ContentBlock[] {
  const fromHtml = input.html ? htmlToContentBlocks(input.html) : [];
  if (fromHtml.length) return fromHtml;
  return plainTextToContentBlocks(input.text || '');
}

// ─── document assembly ────────────────────────────────────────────────────────
const HEADER_VARIANT: DecoratorVariant = 'header-logo';
const FOOTER_VARIANT: DecoratorVariant = 'footer-wave-dark';

function isHeaderDecorator(b?: ContentBlock): boolean {
  return !!b && b.type === 'decorator' && (b as any).variant?.startsWith('header-');
}
function isFooterDecorator(b?: ContentBlock): boolean {
  return !!b && b.type === 'decorator' && (b as any).variant?.startsWith('footer-');
}

/**
 * Wrap pasted content blocks into a complete document layout: company logo
 * header at the top and a wave footer at the bottom — like the examples have.
 * Reuses existing header/footer decorators in `existing` instead of duplicating.
 */
export function buildSimpleDocument(content: ContentBlock[], existing: ContentBlock[] = []): ContentBlock[] {
  const middle = content.length ? content : [paragraph('')];
  const header: ContentBlock[] = isHeaderDecorator(existing[0])
    ? []
    : [{ id: blockId(), type: 'decorator', variant: HEADER_VARIANT }, spacer('sm')];
  const footer: ContentBlock[] = isFooterDecorator(existing[existing.length - 1])
    ? []
    : [{ id: blockId(), type: 'decorator', variant: FOOTER_VARIANT }];
  return [...header, ...middle, ...footer];
}
