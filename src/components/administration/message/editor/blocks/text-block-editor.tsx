import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { TextBlock } from "../types";
import { InlineFormattingToolbar } from "../inline-formatting-toolbar";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { removeMarkdownFormat } from "@/utils/markdown-parser";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

interface TextBlockEditorProps {
  block: TextBlock;
  onUpdate: (updates: Partial<TextBlock>) => void;
}

export const TextBlockEditor = ({ block, onUpdate }: TextBlockEditorProps) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const richTextRef = useRef<RichTextEditorHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const el = richTextRef.current?.getElement();
      if (!el || !sel || sel.isCollapsed) {
        if (!el || document.activeElement === el) setShowToolbar(false);
        return;
      }
      if (el.contains(sel.anchorNode)) {
        if (sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0) setToolbarPos({ x: Math.max(0, rect.left), y: rect.top });
        }
        setShowToolbar(true);
      } else {
        setShowToolbar(false);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const el = richTextRef.current?.getElement();
      const toolbar = toolbarRef.current;
      const target = e.target as Node;
      if (el?.contains(target) || toolbar?.contains(target)) return;
      setShowToolbar(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const getPlaceholder = () => {
    switch (block.type) {
      case 'heading1': return 'Título principal...';
      case 'heading2': return 'Subtítulo...';
      case 'heading3': return 'Título menor...';
      case 'quote':    return 'Digite uma citação...';
      default:         return 'Digite o texto...';
    }
  };

  const getFontSizeClass = () => {
    const map: Record<string, string> = {
      xs: 'text-xs', sm: 'text-sm', base: 'text-base',
      lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl',
    };
    return map[block.fontSize || 'base'];
  };

  const getFontWeightClass = () => {
    const map: Record<string, string> = {
      normal: 'font-normal', medium: 'font-medium',
      semibold: 'font-semibold', bold: 'font-bold',
    };
    return map[block.fontWeight || 'normal'];
  };

  const getEditorClassName = () => {
    const base = cn(getFontSizeClass(), getFontWeightClass());
    if (block.type === 'quote') return cn(base, 'italic border-l-4 border-primary pl-4');
    return base;
  };

  const handleFormat = (
    format: 'bold' | 'italic' | 'underline' | 'color' | 'link',
    value?: string,
  ) => {
    richTextRef.current?.applyFormat(format, value);
  };

  const handleFontWeightChange = (weight: string | string[] | null | undefined) => {
    if (!weight || typeof weight !== 'string') return;
    let newContent = block.content;
    if (weight === 'normal' || weight === 'medium') {
      newContent = removeMarkdownFormat(block.content, 'bold');
    }
    onUpdate({ fontWeight: weight as TextBlock['fontWeight'], content: newContent });
  };

  // Hide size/weight controls for quote (it has fixed styling)
  const showStyleControls = block.type !== 'quote';

  return (
    <div className="space-y-2">
      {showStyleControls && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1">Tamanho</Label>
            <Combobox
              value={block.fontSize || 'base'}
              onValueChange={(value) => onUpdate({ fontSize: value as TextBlock['fontSize'] })}
              options={[
                { value: 'xs',   label: 'Muito Pequeno' },
                { value: 'sm',   label: 'Pequeno' },
                { value: 'base', label: 'Normal' },
                { value: 'lg',   label: 'Grande' },
                { value: 'xl',   label: 'Muito Grande' },
                { value: '2xl',  label: 'Extra Grande' },
                { value: '3xl',  label: 'Gigante' },
              ]}
              placeholder="Tamanho"
              searchable={false}
              triggerClassName="h-8 text-xs dark:border-muted"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1">Peso</Label>
            <Combobox
              value={block.fontWeight || 'normal'}
              onValueChange={handleFontWeightChange}
              options={[
                { value: 'normal',   label: 'Normal' },
                { value: 'medium',   label: 'Médio' },
                { value: 'semibold', label: 'Semi-Negrito' },
                { value: 'bold',     label: 'Negrito' },
              ]}
              placeholder="Peso"
              searchable={false}
              triggerClassName="h-8 text-xs dark:border-muted"
            />
          </div>
        </div>
      )}

      <RichTextEditor
        ref={richTextRef}
        value={block.content}
        onChange={(content) => onUpdate({ content })}
        multiline={block.type === 'paragraph' || block.type === 'quote'}
        placeholder={getPlaceholder()}
        className={cn(
          "w-full min-h-[60px] border-0 bg-transparent",
          getEditorClassName(),
        )}
      />

      {showToolbar && toolbarPos && (
        <div
          ref={toolbarRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: toolbarPos.y,
            left: toolbarPos.x,
            transform: 'translateY(calc(-100% - 8px))',
            zIndex: 9999,
            outline: 'none',
          }}
        >
          <InlineFormattingToolbar onFormat={handleFormat} />
        </div>
      )}
    </div>
  );
};
