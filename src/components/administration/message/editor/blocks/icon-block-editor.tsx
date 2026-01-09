import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { IconPicker, AVAILABLE_ICONS } from "./icon-picker";
import type { IconBlock } from "../types";

interface IconBlockEditorProps {
  block: IconBlock;
  onUpdate: (updates: Partial<IconBlock>) => void;
}

export const IconBlockEditor = ({ block, onUpdate }: IconBlockEditorProps) => {
  const [showIconPicker, setShowIconPicker] = useState(false);

  const IconComponent = block.icon
    ? AVAILABLE_ICONS[block.icon as keyof typeof AVAILABLE_ICONS]
    : null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Ícone</Label>
        <Button
          variant="outline"
          className="w-full h-20 flex flex-col gap-2"
          onClick={() => setShowIconPicker(true)}
        >
          {IconComponent ? (
            <>
              <IconComponent className="h-8 w-8" />
              <span className="text-xs text-muted-foreground">{block.icon}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Clique para selecionar um ícone</span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tamanho</Label>
          <Combobox
            value={block.size || 'md'}
            onValueChange={(value) => onUpdate({ size: value as any })}
            options={[
              { value: 'sm', label: 'Pequeno (16px)' },
              { value: 'md', label: 'Médio (24px)' },
              { value: 'lg', label: 'Grande (32px)' },
              { value: 'xl', label: 'Extra Grande (48px)' },
            ]}
            placeholder="Selecione o tamanho"
            searchable={false}
            triggerClassName="h-9"
          />
        </div>

        <div>
          <Label className="text-xs">Alinhamento</Label>
          <Combobox
            value={block.alignment || 'center'}
            onValueChange={(value) => onUpdate({ alignment: value as any })}
            options={[
              { value: 'left', label: 'Esquerda' },
              { value: 'center', label: 'Centro' },
              { value: 'right', label: 'Direita' },
            ]}
            placeholder="Selecione o alinhamento"
            searchable={false}
            triggerClassName="h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Cor</Label>
        <Combobox
          value={block.color || 'text-foreground'}
          onValueChange={(value) => onUpdate({ color: value })}
          options={[
            { value: 'text-foreground', label: 'Padrão' },
            { value: 'text-primary', label: 'Primária' },
            { value: 'text-secondary', label: 'Secundária' },
            { value: 'text-muted-foreground', label: 'Suave' },
            { value: 'text-green-600', label: 'Sucesso (Verde)' },
            { value: 'text-blue-600', label: 'Informação (Azul)' },
            { value: 'text-yellow-600', label: 'Aviso (Amarelo)' },
            { value: 'text-red-600', label: 'Erro (Vermelho)' },
            { value: 'text-purple-600', label: 'Roxo' },
            { value: 'text-orange-600', label: 'Laranja' },
            { value: 'text-pink-600', label: 'Rosa' },
          ]}
          placeholder="Selecione a cor"
          searchable={false}
          triggerClassName="h-9"
        />
      </div>

      {/* Preview */}
      {IconComponent && (
        <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
          <div className="border border-dashed border-primary/30 rounded-lg p-4 inline-flex">
            <IconComponent
              className={`
                ${block.size === 'sm' ? 'h-4 w-4' : ''}
                ${block.size === 'md' ? 'h-6 w-6' : ''}
                ${block.size === 'lg' ? 'h-8 w-8' : ''}
                ${block.size === 'xl' ? 'h-12 w-12' : ''}
                ${!block.size ? 'h-6 w-6' : ''}
                ${block.color || 'text-foreground'}
              `}
            />
          </div>
        </div>
      )}

      <IconPicker
        open={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(iconName) => onUpdate({ icon: iconName })}
        selectedIcon={block.icon}
      />
    </div>
  );
};
