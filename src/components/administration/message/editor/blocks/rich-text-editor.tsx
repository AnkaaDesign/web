import { forwardRef, useImperativeHandle, useLayoutEffect, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { parseMarkdownToInlineFormat } from "@/utils/markdown-parser";
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

// rgb(r,g,b) or #hex → lowercase #hex
function toHex(color: string): string {
  if (!color) return '';
  if (color.startsWith('#')) return color.toLowerCase();
  const m = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
}

// DOM → markdown string
function domToMarkdown(el: HTMLElement): string {
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

function segToHtml(seg: InlineFormat): string {
  const c = escHtml(seg.content || '');
  switch (seg.type) {
    case 'bold':      return `<b>${c}</b>`;
    case 'italic':    return `<i>${c}</i>`;
    case 'underline': return `<u>${c}</u>`;
    case 'link':      return `<a href="${escAttr((seg as any).url || '')}">${c}</a>`;
    case 'color':     return `<span style="color:${(seg as any).color}">${c}</span>`;
    default:          return c;
  }
}

// Markdown string → HTML string for contentEditable innerHTML
function markdownToHtml(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const html = parseMarkdownToInlineFormat(line).map(segToHtml).join('');
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
