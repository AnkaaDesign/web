import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconBold, IconItalic, IconUnderline, IconLink } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { TextBlock } from "../types";
import { InlineFormattingToolbar } from "../inline-formatting-toolbar";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

interface TextBlockEditorProps {
  block: TextBlock;
  onUpdate: (updates: Partial<TextBlock>) => void;
}

export const TextBlockEditor = ({ block, onUpdate }: TextBlockEditorProps) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getPlaceholder = () => {
    switch (block.type) {
      case 'heading1':
        return 'Título principal...';
      case 'heading2':
        return 'Subtítulo...';
      case 'heading3':
        return 'Título menor...';
      case 'quote':
        return 'Digite uma citação...';
      default:
        return 'Digite o texto...';
    }
  };

  const getFontSizeClass = () => {
    const fontSizeMap = {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
    };
    return fontSizeMap[block.fontSize || 'base'];
  };

  const getFontWeightClass = () => {
    const fontWeightMap = {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    };
    return fontWeightMap[block.fontWeight || 'normal'];
  };

  const getClassName = () => {
    const baseClasses = [getFontSizeClass(), getFontWeightClass()];

    switch (block.type) {
      case 'heading1':
        return cn(baseClasses, !block.fontSize && 'text-3xl', !block.fontWeight && 'font-bold');
      case 'heading2':
        return cn(baseClasses, !block.fontSize && 'text-2xl', !block.fontWeight && 'font-semibold');
      case 'heading3':
        return cn(baseClasses, !block.fontSize && 'text-xl', !block.fontWeight && 'font-medium');
      case 'quote':
        return cn(baseClasses, 'italic border-l-4 border-primary pl-4', !block.fontSize && 'text-lg');
      default:
        return cn(baseClasses);
    }
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      setSelection({ start, end });
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
      setSelection(null);
    }
  };

  const handleFormat = (format: 'bold' | 'italic' | 'underline', link?: string) => {
    if (!selection) return;

    // For now, we'll just store the formatting info
    // In a real implementation, you'd apply rich text formatting
    const { start, end } = selection;
    const selectedText = block.content.substring(start, end);

    // Apply format markers (simplified)
    let formattedText = selectedText;
    if (format === 'bold') formattedText = `**${selectedText}**`;
    if (format === 'italic') formattedText = `*${selectedText}*`;
    if (format === 'underline') formattedText = `__${selectedText}__`;
    if (link) formattedText = `[${selectedText}](${link})`;

    const newContent =
      block.content.substring(0, start) +
      formattedText +
      block.content.substring(end);

    onUpdate({ content: newContent });
    setShowToolbar(false);
    setSelection(null);
  };

  return (
    <div className="relative space-y-3">
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        onSelect={handleSelectionChange}
        onBlur={() => setTimeout(() => setShowToolbar(false), 200)}
        placeholder={getPlaceholder()}
        className={cn(
          "w-full min-h-[60px] resize-none border-0 focus:outline-none focus:ring-0 bg-transparent",
          getClassName()
        )}
        rows={block.type.startsWith('heading') ? 1 : 3}
      />

      {showToolbar && selection && (
        <InlineFormattingToolbar
          onFormat={handleFormat}
          position="below"
        />
      )}

      {/* Formatting Controls */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1">Tamanho</Label>
          <Combobox
            value={block.fontSize || 'base'}
            onValueChange={(value) => onUpdate({ fontSize: value as any })}
            options={[
              { value: 'xs', label: 'Muito Pequeno' },
              { value: 'sm', label: 'Pequeno' },
              { value: 'base', label: 'Normal' },
              { value: 'lg', label: 'Grande' },
              { value: 'xl', label: 'Muito Grande' },
              { value: '2xl', label: 'Extra Grande' },
              { value: '3xl', label: 'Gigante' },
            ]}
            placeholder="Selecione o tamanho"
            searchable={false}
            triggerClassName="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1">Peso</Label>
          <Combobox
            value={block.fontWeight || 'normal'}
            onValueChange={(value) => onUpdate({ fontWeight: value as any })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'medium', label: 'Médio' },
              { value: 'semibold', label: 'Semi-Negrito' },
              { value: 'bold', label: 'Negrito' },
            ]}
            placeholder="Selecione o peso"
            searchable={false}
            triggerClassName="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
};
