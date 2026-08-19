import { forwardRef, useImperativeHandle, useLayoutEffect, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { parseMarkdownToInlineFormat, sanitizeUrl } from "@/utils/markdown-parser";
import type { InlineFormat } from "@/components/messaging/types";

export interface RichTextEditorHandle {
  applyFormat: (format: 'bold' | 'italic' | 'underline' | 'color' | 'link', value?: string) => void;
  focus: () => void;
  getElement: () => HTMLDivElement | null;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
}

// rgb()/rgba() or #hex → lowercase #hex. Browsers normalise `style.color` to
// rgba() as soon as an alpha channel is present, and a dropped match here means
// the color is silently lost on the next serialization.
function toHex(color: string): string {
  if (!color) return '';
  if (color.startsWith('#')) return color.toLowerCase();
  const m = color.match(/rgba?\s*\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
}

// DOM → markdown string (exported for round-trip tests)
export function domToMarkdown(el: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const e = node as HTMLElement;
    const tag = e.tagName.toLowerCase();
    const kids = Array.from(e.childNodes).map(walk).join('');
    switch (tag) {
      case 'b': case 'strong': return kids ? `**${kids}**` : '';
      case 'i': case 'em':     return kids ? `*${kids}*` : '';
      case 'u':                return kids ? `__${kids}__` : '';
      case 'a': {
        const href = e.getAttribute('href') ?? '';
        return kids ? `[${kids}](${href})` : '';
      }
      case 'span': {
        const hex = toHex(e.style.color || '');
        return (hex && kids) ? `{c:${hex}}${kids}{/c}` : kids;
      }
      case 'br': return '\n';
      case 'div': case 'p': {
        const c = Array.from(e.childNodes).map(walk).join('');
        return '\n' + c;
      }
      default: return kids;
    }
  }
  let result = Array.from(el.childNodes).map(walk).join('');
  result = result.replace(/^\n/, '');          // strip leading newline
  result = result.replace(/\n{3,}/g, '\n\n'); // collapse excess blank lines
  return result;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string) {
  return s.replace(/"/g, '&quot;');
}

/**
 * A run carries a style SET (`{c:#hex}**x**{/c}` is bold *and* colored), and
 * runs are a flat list, so the HTML is rebuilt as a tree: consecutive runs that
 * share a layer's value sit inside ONE tag. Emitting a tag per run instead
 * would round-trip `**a {c:#x}b{/c} c**` back out as
 * `**a **{c:#x}**b**{/c}** c**` — semantically the same, but the stored markers
 * multiply every time the message is reopened.
 *
 * Layer order is the nesting order. Links are outermost so a partly-colored
 * link stays one link; color is innermost so it hugs the text it applies to.
 */
interface HtmlLayer {
  key: (run: InlineFormat) => string | null;
  open: (key: string) => string;
  close: string;
}

const HTML_LAYERS: HtmlLayer[] = [
  {
    key: (r) => (r.url ? sanitizeUrl(r.url) || null : null),
    open: (k) => `<a href="${escAttr(k)}">`,
    close: '</a>',
  },
  { key: (r) => (r.bold || r.type === 'bold' ? 'b' : null), open: () => '<b>', close: '</b>' },
  { key: (r) => (r.underline || r.type === 'underline' ? 'u' : null), open: () => '<u>', close: '</u>' },
  { key: (r) => (r.italic || r.type === 'italic' ? 'i' : null), open: () => '<i>', close: '</i>' },
  {
    key: (r) => r.color ?? null,
    open: (k) => `<span style="color:${escAttr(k)}">`,
    close: '</span>',
  },
];

function runsToHtml(runs: InlineFormat[], depth = 0): string {
  if (runs.length === 0) return '';
  const layer = HTML_LAYERS[depth];
  if (!layer) return runs.map((r) => escHtml(r.content || '')).join('');

  let out = '';
  let i = 0;
  while (i < runs.length) {
    const key = layer.key(runs[i]);
    let j = i + 1;
    while (j < runs.length && layer.key(runs[j]) === key) j++;
    const inner = runsToHtml(runs.slice(i, j), depth + 1);
    out += key === null ? inner : layer.open(key) + inner + layer.close;
    i = j;
  }
  return out;
}

// Markdown string → HTML string for contentEditable innerHTML (exported for tests)
export function markdownToHtml(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const html = runsToHtml(parseMarkdownToInlineFormat(line));
    // First line: raw; subsequent lines: wrapped in <div> (matches contentEditable behavior)
    return i === 0 ? html : `<div>${html || '<br>'}</div>`;
  }).join('');
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, multiline = false, placeholder, className, onFocus, onBlur }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    // Track the last value WE serialized so we can skip redundant innerHTML updates
    const lastSyncedRef = useRef<string>(value);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Persists the last non-collapsed selection inside this editor so it can be
    // restored after focus is lost (e.g. native color picker opened).
    const savedRangeRef = useRef<Range | null>(null);

    // Track selection changes and save whenever there is a non-collapsed range in
    // this editor — used by applyFormat to restore lost selections.
    useEffect(() => {
      const save = () => {
        const sel = window.getSelection();
        const el = editorRef.current;
        if (el && sel && !sel.isCollapsed && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
      };
      document.addEventListener('selectionchange', save);
      return () => document.removeEventListener('selectionchange', save);
    }, []);

    // Set innerHTML once on mount
    useLayoutEffect(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(value);
        lastSyncedRef.current = value;
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync when value changes from OUTSIDE (template applied, undo, etc.)
    useEffect(() => {
      if (!editorRef.current) return;
      if (value === lastSyncedRef.current) return; // Our own typing — skip
      editorRef.current.innerHTML = markdownToHtml(value);
      lastSyncedRef.current = value;
    }, [value]);

    const applyFormat = useCallback((
      format: 'bold' | 'italic' | 'underline' | 'color' | 'link',
      val?: string,
    ) => {
      const el = editorRef.current;
      if (!el) return;

      // Re-focus the editor so execCommand targets it
      el.focus();

      const sel = window.getSelection();
      if (!sel) return;

      // If the selection was lost (e.g. native color picker stole focus), restore
      // the last known range from within this editor before applying the format.
      if (sel.isCollapsed || sel.rangeCount === 0) {
        if (savedRangeRef.current) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current.cloneRange());
        } else {
          return; // Nothing to apply to
        }
      }

      if (format === 'bold') {
        document.execCommand('bold', false);
      } else if (format === 'italic') {
        document.execCommand('italic', false);
      } else if (format === 'underline') {
        document.execCommand('underline', false);
      } else if (format === 'link' && val) {
        document.execCommand('createLink', false, val);
      } else if (format === 'color') {
        const range = sel.getRangeAt(0);
        if (val && !range.collapsed) {
          // Wrap selection in a color span
          const span = document.createElement('span');
          span.style.color = val;
          try {
            range.surroundContents(span);
          } catch {
            // Selection crosses element boundaries — extract and re-insert
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
          }
          // Flatten any nested color spans so the new color wins uniformly.
          // Nested spans from prior coloring cause split colors when
          // a selection overlapping multiple colored segments is re-colored.
          Array.from(span.querySelectorAll<HTMLElement>('span[style]')).forEach(nested => {
            if (nested.style.color) {
              const parent = nested.parentNode!;
              while (nested.firstChild) parent.insertBefore(nested.firstChild, nested);
              parent.removeChild(nested);
            }
          });
        } else if (!val) {
          // Remove color: unwrap any color spans that intersect the selection
          const spans = Array.from(el.querySelectorAll<HTMLElement>('span[style]'));
          spans.forEach(span => {
            if (span.style.color && sel.containsNode(span, true)) {
              const parent = span.parentNode!;
              while (span.firstChild) parent.insertBefore(span.firstChild, span);
              parent.removeChild(span);
            }
          });
        }
      }

      // Serialize updated DOM → markdown and emit
      const md = domToMarkdown(el);
      lastSyncedRef.current = md;
      onChangeRef.current(md);

    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      applyFormat,
      focus: () => editorRef.current?.focus(),
      getElement: () => editorRef.current,
    }), [applyFormat]);

    const handleInput = () => {
      const el = editorRef.current;
      if (!el) return;
      const md = domToMarkdown(el);
      lastSyncedRef.current = md;
      onChangeRef.current(md);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!multiline && e.key === 'Enter') {
        e.preventDefault();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        document.execCommand('insertText', false, text);
        const el = editorRef.current;
        if (el) {
          const md = domToMarkdown(el);
          lastSyncedRef.current = md;
          onChangeRef.current(md);
        }
      }
    };

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder={placeholder}
        className={cn(
          "outline-none cursor-text",
          // Show placeholder via CSS when editor is empty
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          className,
        )}
      />
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';
