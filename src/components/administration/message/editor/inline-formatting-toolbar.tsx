import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconBold, IconItalic, IconUnderline, IconLink, IconX } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";

interface InlineFormattingToolbarProps {
  onFormat: (format: 'bold' | 'italic' | 'underline', link?: string) => void;
  position?: 'above' | 'below';
}

export const InlineFormattingToolbar = ({ onFormat, position = 'above' }: InlineFormattingToolbarProps) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      onFormat('bold', linkUrl);
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  return (
    <Card className={`absolute ${position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-10 p-2 shadow-lg`}>
      <div className="flex items-center gap-1">
        {!showLinkInput ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onFormat('bold')}
              title="Negrito"
            >
              <IconBold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onFormat('italic')}
              title="Itálico"
            >
              <IconItalic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onFormat('underline')}
              title="Sublinhado"
            >
              <IconUnderline className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowLinkInput(true)}
              title="Adicionar Link"
            >
              <IconLink className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Input
              value={linkUrl}
              onChange={(value) => setLinkUrl(value as string)}
              placeholder="https://..."
              className="h-8 w-48 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLinkSubmit();
                }
              }}
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLinkSubmit}
            >
              <IconLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
              }}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};
