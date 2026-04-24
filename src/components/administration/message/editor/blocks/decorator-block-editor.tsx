import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DecoratorBlock, DecoratorVariant } from '../types';

interface DecoratorBlockEditorProps {
  block: DecoratorBlock;
  onUpdate: (updates: Partial<DecoratorBlock>) => void;
}

export const DECORATOR_IMAGES: Record<DecoratorVariant, string> = {
  'header-logo': '/header-logo.webp',
  'header-logo-stripes': '/header-logo-stripes.webp',
  'footer-wave-dark': '/footer-wave-dark.webp',
  'footer-wave-logo': '/footer-wave-logo.webp',
  'footer-diagonal-stripes': '/footer-diagonal-stripes.webp',
  'footer-wave-gold': '/footer-wave-gold.webp',
  'footer-geometric': '/footer-geometric.webp',
};

const HEADER_VARIANTS: DecoratorVariant[] = ['header-logo', 'header-logo-stripes'];
const FOOTER_VARIANTS: DecoratorVariant[] = [
  'footer-wave-dark',
  'footer-wave-logo',
  'footer-diagonal-stripes',
  'footer-wave-gold',
  'footer-geometric',
];

const VARIANT_LABELS: Record<DecoratorVariant, string> = {
  'header-logo': 'Logo',
  'header-logo-stripes': 'Logo + Listras',
  'footer-wave-dark': 'Onda Escura',
  'footer-wave-logo': 'Onda + Logo',
  'footer-diagonal-stripes': 'Listras Diagonais',
  'footer-wave-gold': 'Onda Dourada',
  'footer-geometric': 'Geométrico',
};

export const DecoratorBlockEditor = ({ block, onUpdate }: DecoratorBlockEditorProps) => {
  const [open, setOpen] = useState(false);

  const src = DECORATOR_IMAGES[block.variant] ?? DECORATOR_IMAGES['footer-wave-dark'];
  const isHeader = block.variant.startsWith('header-');
  const variants = isHeader ? HEADER_VARIANTS : FOOTER_VARIANTS;
  const groupLabel = isHeader ? 'Cabeçalho' : 'Rodapé';

  return (
    <>
      <div className="space-y-2">
        <div className="w-full pointer-events-none">
          <img src={src} alt="Decoração" style={{ width: '100%', display: 'block' }} />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
          Alterar {groupLabel}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar {groupLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            {variants.map((v) => {
              const isSelected = block.variant === v;
              return (
                <button
                  key={v}
                  onClick={() => { onUpdate({ variant: v }); setOpen(false); }}
                  className={`rounded-md border-2 overflow-hidden text-left transition-all focus:outline-none ${
                    isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img
                    src={DECORATOR_IMAGES[v]}
                    alt={VARIANT_LABELS[v]}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <div className="px-2 py-1.5">
                    <Label className={`text-xs cursor-pointer ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {VARIANT_LABELS[v]}
                    </Label>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
