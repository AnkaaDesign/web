import { useState, useRef } from "react";

import { cn } from "@/lib/utils";
import type { TextBlock } from "../types";
import { InlineFormattingToolbar } from "../inline-formatting-toolbar";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { stripMarkdownFormatting, removeMarkdownFormat } from "@/utils/markdown-parser";

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
    const fontSizeMap: Record<string, string> = {
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
    const fontWeightMap: Record<string, string> = {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    };
    return fontWeightMap[block.fontWeight || 'normal'];
  };

  const getClassName = () => {
    const fontSizeClass = getFontSizeClass();
    const fontWeightClass = getFontWeightClass();

    switch (block.type) {
      case 'quote':
        return cn(fontSizeClass, fontWeightClass, 'italic border-l-4 border-primary pl-4');
      default:
        return cn(fontSizeClass, fontWeightClass);
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

    const { start, end } = selection;
    const selectedText = block.content.substring(start, end);
    const beforeSelection = block.content.substring(0, start);
    const afterSelection = block.content.substring(end);

    // Check if text already has the format and toggle it
    let formattedText = selectedText;

    if (format === 'bold') {
      // Context-aware detection: check if selection is wrapped by ** markers
      const hasBoldBefore = beforeSelection.endsWith('**');
      const hasBoldAfter = afterSelection.startsWith('**');

      if (hasBoldBefore && hasBoldAfter) {
        // Remove bold markers (markers are OUTSIDE the selection)
        formattedText = selectedText;
        newStart = start - 2;
        newEnd = end;
        const newContent =
          block.content.substring(0, start - 2) +
          formattedText +
          block.content.substring(end + 2);
        onUpdate({ content: newContent });
      } else if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length > 4) {
        // Selected text includes the markers - remove them
        formattedText = selectedText.slice(2, -2);
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      } else {
        // Add bold markers
        formattedText = `**${selectedText}**`;
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      }
    } else if (format === 'italic') {
      // Context-aware detection for italic
      const hasItalicBefore = beforeSelection.endsWith('*') && !beforeSelection.endsWith('**');
      const hasItalicAfter = afterSelection.startsWith('*') && !afterSelection.startsWith('**');

      if (hasItalicBefore && hasItalicAfter) {
        // Remove italic markers (markers are OUTSIDE the selection)
        formattedText = selectedText;
        const newContent =
          block.content.substring(0, start - 1) +
          formattedText +
          block.content.substring(end + 1);
        onUpdate({ content: newContent });
      } else if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**') && selectedText.length > 2) {
        // Selected text includes the markers - remove them
        formattedText = selectedText.slice(1, -1);
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      } else {
        // Add italic markers
        formattedText = `*${selectedText}*`;
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      }
    } else if (format === 'underline') {
      // Context-aware detection for underline
      const hasUnderlineBefore = beforeSelection.endsWith('__');
      const hasUnderlineAfter = afterSelection.startsWith('__');

      if (hasUnderlineBefore && hasUnderlineAfter) {
        // Remove underline markers (markers are OUTSIDE the selection)
        formattedText = selectedText;
        const newContent =
          block.content.substring(0, start - 2) +
          formattedText +
          block.content.substring(end + 2);
        onUpdate({ content: newContent });
      } else if (selectedText.startsWith('__') && selectedText.endsWith('__') && selectedText.length > 4) {
        // Selected text includes the markers - remove them
        formattedText = selectedText.slice(2, -2);
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      } else {
        // Add underline markers
        formattedText = `__${selectedText}__`;
        const newContent =
          block.content.substring(0, start) +
          formattedText +
          block.content.substring(end);
        onUpdate({ content: newContent });
      }
    } else if (link) {
      formattedText = `[${selectedText}](${link})`;
      const newContent =
        block.content.substring(0, start) +
        formattedText +
        block.content.substring(end);
      onUpdate({ content: newContent });
    }

    setShowToolbar(false);
    setSelection(null);
  };

  // Handler for font weight changes - strip bold markers when switching to normal
  const handleFontWeightChange = (weight: string) => {
    let newContent = block.content;

    // If switching to normal or medium, remove bold markers
    if (weight === 'normal' || weight === 'medium') {
      newContent = removeMarkdownFormat(block.content, 'bold');
    }

    onUpdate({ fontWeight: weight as any, content: newContent });
  };

  // Handle paste events to strip formatting
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();

    // Get plain text from clipboard
    let text = e.clipboardData.getData('text/plain');

    // Strip any markdown formatting from the pasted text
    text = stripMarkdownFormatting(text);

    // Insert plain text at cursor position
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newContent =
      block.content.substring(0, start) +
      text +
      block.content.substring(end);

    onUpdate({ content: newContent });

    // Set cursor position after inserted text
    setTimeout(() => {
      if (textarea) {
        const newPosition = start + text.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  return (
    <div className="relative space-y-3">
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        onSelect={handleSelectionChange}
        onBlur={() => setTimeout(() => setShowToolbar(false), 200)}
        onPaste={handlePaste}
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
            triggerClassName="h-8 text-xs dark:border-muted"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1">Peso</Label>
          <Combobox
            value={block.fontWeight || 'normal'}
            onValueChange={handleFontWeightChange}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'medium', label: 'Médio' },
              { value: 'semibold', label: 'Semi-Negrito' },
              { value: 'bold', label: 'Negrito' },
            ]}
            placeholder="Selecione o peso"
            searchable={false}
            triggerClassName="h-8 text-xs dark:border-muted"
          />
        </div>
      </div>
    </div>
  );
};
