import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { IconSwitch } from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CompanyAssetBlock, ImageSizePreset } from '../types';

interface CompanyAssetBlockEditorProps {
  block: CompanyAssetBlock;
  onUpdate: (updates: Partial<CompanyAssetBlock>) => void;
}

const ASSETS = [
  { key: 'logo' as const, label: 'Logo', description: 'Logotipo da empresa', path: '/logo.png', defaultSize: '75%' as ImageSizePreset },
  { key: 'icon' as const, label: 'Ícone', description: 'Ícone da empresa', path: '/android-chrome-192x192.png', defaultSize: '128px' as ImageSizePreset },
];

const SIZE_OPTIONS = [
  { value: '64px', label: '64px (Ícone)' },
  { value: '128px', label: '128px (Pequeno)' },
  { value: '256px', label: '256px (Médio)' },
  { value: '384px', label: '384px (Grande)' },
  { value: '25%', label: '25%' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
];

const ALIGNMENT_OPTIONS = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
];

export const CompanyAssetBlockEditor = ({ block, onUpdate }: CompanyAssetBlockEditorProps) => {
  const [showPicker, setShowPicker] = useState(false);

  const currentAsset = ASSETS.find(a => a.key === block.asset) ?? ASSETS[0];
  const size = block.size ?? '75%';
  const alignment = block.alignment ?? 'center';

  const justifyClass =
    alignment === 'center' ? 'justify-center' :
    alignment === 'right' ? 'justify-end' :
    'justify-start';

  return (
    <div className="space-y-3">
      <div className="w-full rounded-md bg-muted/30 p-4 flex overflow-hidden">
        <div className={`flex w-full ${justifyClass}`}>
          <img
            src={currentAsset.path}
            alt={currentAsset.label}
            style={{ maxWidth: size }}
            className="h-auto object-contain"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => setShowPicker(true)}
      >
        <IconSwitch className="h-4 w-4" />
        Trocar Ativo
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1">Tamanho</Label>
          <Combobox
            value={size}
            onValueChange={(value) => onUpdate({ size: value as ImageSizePreset })}
            options={SIZE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            placeholder="Selecione o tamanho"
            searchable={false}
            triggerClassName="h-8 text-sm dark:border-muted"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1">Alinhamento</Label>
          <Combobox
            value={alignment}
            onValueChange={(value) => onUpdate({ alignment: value as 'left' | 'center' | 'right' })}
            options={ALIGNMENT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            placeholder="Selecione o alinhamento"
            searchable={false}
            triggerClassName="h-8 text-sm dark:border-muted"
          />
        </div>
      </div>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Ativo da Empresa</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {ASSETS.map((asset) => {
              const isSelected = block.asset === asset.key;
              return (
                <button
                  key={asset.key}
                  type="button"
                  onClick={() => {
                    onUpdate({ asset: asset.key, size: asset.defaultSize });
                    setShowPicker(false);
                  }}
                  className={cn(
                    'group flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/60 hover:bg-muted/30'
                  )}
                >
                  <div className="h-16 flex items-center justify-center">
                    <img src={asset.path} alt={asset.label} className="max-h-16 max-w-full object-contain" />
                  </div>
                  <div className="text-center">
                    <p className={cn('text-sm font-medium', isSelected ? 'text-primary' : '')}>{asset.label}</p>
                    <p className="text-xs text-muted-foreground">{asset.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
