import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ListBlock } from "../types";
import { InlineFormattingToolbar } from "../inline-formatting-toolbar";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

interface ListBlockEditorProps {
  block: ListBlock;
  onUpdate: (updates: Partial<ListBlock>) => void;
}

export const ListBlockEditor = ({ block, onUpdate }: ListBlockEditorProps) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const richTextRefs = useRef<(RichTextEditorHandle | null)[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasDeletable = block.items.length > 1;

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setShowToolbar(false);
        return;
      }
      const idx = richTextRefs.current.findIndex(
        ref => ref?.getElement()?.contains(sel.anchorNode ?? null),
      );
      if (idx >= 0) {
        setActiveIndex(idx);
        if (sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0) {
            setToolbarPos({ x: Math.max(0, rect.left), y: rect.top });
          }
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
      const target = e.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      const isInEditor = richTextRefs.current.some(ref => ref?.getElement()?.contains(target));
      if (isInEditor) return;
      setShowToolbar(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleFormat = (
    format: 'bold' | 'italic' | 'underline' | 'color' | 'link',
    value?: string,
  ) => {
    if (activeIndex !== null) {
      richTextRefs.current[activeIndex]?.applyFormat(format, value);
    }
  };

  const handleAddItem = () => onUpdate({ items: [...block.items, ''] });

  const handleUpdateItem = (index: number, value: string) => {
    const newItems = [...block.items];
    newItems[index] = value;
    onUpdate({ items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (block.items.length === 1) return;
    onUpdate({ items: block.items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {/* Header row — same column grid as item rows */}
      <div className="flex items-center gap-2 min-h-[36px]">
        <div className="w-6 shrink-0" />
        <Label className="text-xs text-muted-foreground flex-1">Itens da Lista</Label>
        <Label className="text-xs text-muted-foreground">Numerada</Label>
        <Switch
          checked={block.ordered || false}
          onCheckedChange={(checked) => onUpdate({ ordered: checked })}
        />
        {hasDeletable && <div className="w-9 shrink-0" />}
      </div>

      <div className="space-y-2">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-6 shrink-0 text-right">
              {block.ordered ? `${index + 1}.` : '•'}
            </span>
            <RichTextEditor
              ref={(el) => { richTextRefs.current[index] = el; }}
              value={item}
              onChange={(value) => handleUpdateItem(index, value)}
              multiline={false}
              placeholder={`Item ${index + 1}...`}
              className="flex-1 h-9 min-h-0 px-3 rounded-md border border-input dark:border-muted bg-transparent text-sm flex items-center leading-none"
            />
            {hasDeletable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleRemoveItem(index)}
              >
                <IconTrash className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

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

      <Button variant="outline" size="sm" onClick={handleAddItem} className="w-full">
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar Item
      </Button>
    </div>
  );
};
