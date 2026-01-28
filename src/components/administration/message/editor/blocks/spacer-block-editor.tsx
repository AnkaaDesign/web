import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import type { SpacerBlock } from "../types";

interface SpacerBlockEditorProps {
  block: SpacerBlock;
  onUpdate: (updates: Partial<SpacerBlock>) => void;
}

export const SpacerBlockEditor = ({ block, onUpdate }: SpacerBlockEditorProps) => {
  const getHeightInPx = (height: string = 'md') => {
    const heights = { sm: '1rem', md: '2rem', lg: '3rem', xl: '4rem' };
    return heights[height as keyof typeof heights];
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Altura do Espaço</Label>
        <Combobox
          value={block.height || 'md'}
          onValueChange={(value) => onUpdate({ height: value as any })}
          options={[
            { value: 'sm', label: 'Pequeno (1rem / 16px)' },
            { value: 'md', label: 'Médio (2rem / 32px)' },
            { value: 'lg', label: 'Grande (3rem / 48px)' },
            { value: 'xl', label: 'Extra Grande (4rem / 64px)' },
          ]}
          placeholder="Selecione a altura"
          searchable={false}
          triggerClassName="h-9 dark:border-muted"
        />
      </div>

      {/* Preview */}
      <div className="border border-dashed border-primary/30 rounded-lg flex items-center justify-center text-xs text-muted-foreground" style={{ height: getHeightInPx(block.height) }}>
        Espaço Vertical ({getHeightInPx(block.height)})
      </div>
    </div>
  );
};
