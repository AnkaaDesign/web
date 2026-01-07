import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconBold, IconItalic, IconUnderline, IconLink } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { TextBlock } from "../types";
import { InlineFormattingToolbar } from "../inline-formatting-toolbar";

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

  const getClassName = () => {
    switch (block.type) {
      case 'heading1':
        return 'text-3xl font-bold';
      case 'heading2':
        return 'text-2xl font-semibold';
      case 'heading3':
        return 'text-xl font-medium';
      case 'quote':
        return 'text-lg italic border-l-4 border-primary pl-4';
      default:
        return 'text-base';
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
    <div className="relative">
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
    </div>
  );
};
