import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import type { ButtonBlock } from "../types";

interface ButtonBlockEditorProps {
  block: ButtonBlock;
  onUpdate: (updates: Partial<ButtonBlock>) => void;
}

export const ButtonBlockEditor = ({ block, onUpdate }: ButtonBlockEditorProps) => {
  // Format URL: add https:// if missing and looks like external domain
  const handleUrlChange = (value: string) => {
    let formattedUrl = value;

    // If user enters something that looks like a domain (contains dot, no protocol, no slash at start)
    // automatically add https://
    if (formattedUrl && !formattedUrl.match(/^https?:\/\//i) && !formattedUrl.startsWith('/')) {
      // Check if it looks like a domain (has a dot)
      if (formattedUrl.includes('.')) {
        formattedUrl = `https://${formattedUrl}`;
      }
    }

    onUpdate({ url: formattedUrl });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto do Botão</Label>
        <Input
          value={block.text}
          onChange={(value) => onUpdate({ text: value as string })}
          placeholder="Ex: Saiba Mais, Clique Aqui..."
          className="h-9 dark:border-muted"
          transparent
        />
      </div>

      <div>
        <Label className="text-xs">URL de Destino</Label>
        <Input
          value={block.url}
          onChange={(value) => handleUrlChange(value as string)}
          onBlur={(e) => handleUrlChange(e.target.value)}
          placeholder="https://exemplo.com ou /rota-interna"
          className="h-9 dark:border-muted"
          transparent
        />
        <p className="text-xs text-muted-foreground mt-1">
          URLs externas: <span className="font-mono">google.com</span> ou <span className="font-mono">https://google.com</span>
          <br />
          Rotas internas: <span className="font-mono">/administracao/mensagens</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Estilo</Label>
          <Combobox
            value={block.variant || 'default'}
            onValueChange={(value) => onUpdate({ variant: value as any })}
            options={[
              { value: 'default', label: 'Padrão' },
              { value: 'outline', label: 'Contorno' },
              { value: 'secondary', label: 'Secundário' },
            ]}
            placeholder="Selecione o estilo"
            searchable={false}
            triggerClassName="h-9 dark:border-muted"
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
            triggerClassName="h-9 dark:border-muted"
          />
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
