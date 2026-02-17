import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { IconUpload, IconPhoto } from "@tabler/icons-react";
import { fileService } from "@/api-client/file";
import { getApiBaseUrl } from "@/config/api";
import type { ImageBlock } from "../types";

interface ImageBlockEditorProps {
  block: ImageBlock;
  onUpdate: (updates: Partial<ImageBlock>) => void;
}

export const ImageBlockEditor = ({ block, onUpdate }: ImageBlockEditorProps) => {
  const [uploading, setUploading] = useState(false);

  const getSizeStyle = () => {
    // If customWidth is provided, use it directly
    if (block.customWidth) {
      return { maxWidth: block.customWidth };
    }

    // If size is provided, use it
    if (block.size) {
      return { maxWidth: block.size };
    }

    // Default to 50% (medium)
    return { maxWidth: '50%' };
  };

  const resolveImageUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('/')) return `${getApiBaseUrl()}${url}`;
    return url;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await fileService.uploadSingleFile(file, {
        fileContext: 'messageImages',
      });
      if (response.success && response.data) {
        onUpdate({ url: `/files/serve/${response.data.id}` });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!block.url ? (
        <div className="border-2 border-dashed border-border dark:border-muted rounded-lg p-8 text-center">
          <IconPhoto className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Faça upload de uma imagem ou cole a URL
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById(`file-upload-${block.id}`)?.click()}
            >
              <IconUpload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Upload'}
            </Button>
            <input
              id={`file-upload-${block.id}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <div className="mt-3">
            <Input
              placeholder="Ou cole a URL da imagem..."
              onChange={(value: string | number | null) => onUpdate({ url: value as string })}
              transparent
              className="dark:border-muted"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <div style={getSizeStyle()}>
              <img
                src={resolveImageUrl(block.url)}
                alt={block.alt || ''}
                className="w-full h-auto rounded-lg border dark:border-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tamanho</Label>
              <Combobox
                value={block.size || '50%'}
                onValueChange={(value) => onUpdate({ size: value as any })}
                options={[
                  { value: '64px', label: '64px (Ícone)' },
                  { value: '128px', label: '128px (Pequeno)' },
                  { value: '256px', label: '256px (Médio)' },
                  { value: '384px', label: '384px (Grande)' },
                  { value: '25%', label: '25%' },
                  { value: '50%', label: '50%' },
                  { value: '75%', label: '75%' },
                  { value: '100%', label: '100%' },
                ]}
                placeholder="Selecione o tamanho"
                searchable={true}
                triggerClassName="h-8 text-sm dark:border-muted"
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
                triggerClassName="h-8 text-sm dark:border-muted"
              />
            </div>
            <div>
              <Label className="text-xs">Texto Alternativo</Label>
              <Input
                value={block.alt || ''}
                onChange={(value: string | number | null) => onUpdate({ alt: value as string })}
                placeholder="Descrição"
                className="h-8 text-sm dark:border-muted"
                transparent
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Legenda (opcional)</Label>
            <Input
              value={block.caption || ''}
              onChange={(value: string | number | null) => onUpdate({ caption: value as string })}
              placeholder="Adicione uma legenda..."
              className="h-8 text-sm dark:border-muted"
              transparent
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate({ url: '' })}
          >
            Trocar Imagem
          </Button>
        </div>
      )}
    </div>
  );
};
