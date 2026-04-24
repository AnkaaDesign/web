import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconBold, IconItalic, IconUnderline, IconLink, IconX } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";

interface InlineFormattingToolbarProps {
  onFormat: (format: 'bold' | 'italic' | 'underline' | 'color' | 'link', value?: string) => void;
}

const PRESET_COLORS = [
  { hex: '#ef4444', label: 'Vermelho' },
  { hex: '#f97316', label: 'Laranja' },
  { hex: '#eab308', label: 'Amarelo' },
  { hex: '#22c55e', label: 'Verde' },
  { hex: '#14b8a6', label: 'Verde-azulado' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#8b5cf6', label: 'Roxo' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#64748b', label: 'Cinza médio' },
  { hex: '#3bc914', label: 'Verde Ankaa' },
];

const RAINBOW =
  'linear-gradient(135deg, #ff0000 0%, #ff8000 14%, #ffff00 28%, #00ff00 43%, #00ffff 57%, #0000ff 71%, #ff00ff 86%, #ff0000 100%)';

export const InlineFormattingToolbar = ({ onFormat }: InlineFormattingToolbarProps) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3bc914');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLinkInput) setTimeout(() => linkInputRef.current?.focus(), 10);
  }, [showLinkInput]);

  useEffect(() => {
    if (!showColorPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showColorPicker]);

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex);
    onFormat('color', hex);
  };

  const handleRemoveColor = () => {
    onFormat('color', undefined);
    setShowColorPicker(false);
  };

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      onFormat('link', linkUrl);
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  return (
    <Card className="p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
      <div className="flex items-center gap-1">
        {!showLinkInput ? (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFormat('bold')} title="Negrito">
              <IconBold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFormat('italic')} title="Itálico">
              <IconItalic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFormat('underline')} title="Sublinhado">
              <IconUnderline className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLinkInput(true)} title="Adicionar Link">
              <IconLink className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />

            <div className="relative" ref={colorPickerRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowColorPicker((v) => !v)}
                title="Cor do texto"
              >
                <span
                  className="text-base font-bold leading-none select-none"
                  style={{ color: selectedColor }}
                >
                  A
                </span>
              </Button>

              {showColorPicker && (
                <Card className="absolute top-full mt-1 left-0 z-20 p-3 shadow-xl min-w-[196px]">
                  <div className="flex flex-col gap-2">
                    {/* 6-col grid: 11 presets + 1 rainbow swatch = 12 items (2 rows) */}
                    <div className="grid grid-cols-6 gap-1.5">
                      {PRESET_COLORS.map(({ hex, label }) => (
                        <button
                          key={hex}
                          title={label}
                          onClick={() => handleColorSelect(hex)}
                          className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
                          style={{ backgroundColor: hex }}
                        />
                      ))}

                      {/* Rainbow / custom colour — same size as presets, opens OS picker */}
                      <button
                        title="Cor personalizada"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => colorInputRef.current?.click()}
                        className="w-7 h-7 rounded border border-border overflow-hidden cursor-pointer hover:scale-110 transition-transform p-0 focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ background: RAINBOW }}
                      />
                      {/* Hidden native colour input — onChange fires the moment user picks */}
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={selectedColor}
                        onChange={(e) => handleColorSelect(e.target.value)}
                        className="sr-only"
                      />
                    </div>

                    {/* Remove colour */}
                    <button
                      onClick={handleRemoveColor}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <IconX className="h-3 w-3" />
                      Remover cor
                    </button>
                  </div>
                </Card>
              )}
            </div>
          </>
        ) : (
          <>
            <input
              ref={linkInputRef}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 w-48 text-sm border border-input rounded-md px-3 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleLinkSubmit(); }
              }}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLinkSubmit}>
              <IconLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};
