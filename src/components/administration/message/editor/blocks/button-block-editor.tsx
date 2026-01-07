import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ButtonBlock } from "../types";

interface ButtonBlockEditorProps {
  block: ButtonBlock;
  onUpdate: (updates: Partial<ButtonBlock>) => void;
}

export const ButtonBlockEditor = ({ block, onUpdate }: ButtonBlockEditorProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto do Botão</Label>
        <Input
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Ex: Saiba Mais, Clique Aqui..."
          className="h-9"
        />
      </div>

      <div>
        <Label className="text-xs">URL de Destino</Label>
        <Input
          value={block.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://..."
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Estilo</Label>
          <Select
            value={block.variant || 'default'}
            onValueChange={(value: any) => onUpdate({ variant: value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Padrão</SelectItem>
              <SelectItem value="outline">Contorno</SelectItem>
              <SelectItem value="secondary">Secundário</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Alinhamento</Label>
          <Select
            value={block.alignment || 'center'}
            onValueChange={(value: any) => onUpdate({ alignment: value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
        <Button
          variant={block.variant || 'default'}
          disabled
          className="pointer-events-none"
        >
          {block.text || 'Botão de Ação'}
        </Button>
      </div>
    </div>
  );
};
