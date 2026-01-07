import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconUpload, IconPhoto } from "@tabler/icons-react";
import type { ImageBlock } from "../types";

interface ImageBlockEditorProps {
  block: ImageBlock;
  onUpdate: (updates: Partial<ImageBlock>) => void;
}

export const ImageBlockEditor = ({ block, onUpdate }: ImageBlockEditorProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // TODO: Implement actual file upload
      // const url = await uploadFile(file);
      // For now, use a placeholder
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ url: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!block.url ? (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
              onChange={(e) => onUpdate({ url: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <img
              src={block.url}
              alt={block.alt || ''}
              className="max-w-full h-auto rounded-lg border"
              style={{ maxHeight: '400px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Texto Alternativo</Label>
              <Input
                value={block.alt || ''}
                onChange={(e) => onUpdate({ alt: e.target.value })}
                placeholder="Descrição da imagem"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Alinhamento</Label>
              <Select
                value={block.alignment || 'center'}
                onValueChange={(value: any) => onUpdate({ alignment: value })}
              >
                <SelectTrigger className="h-8 text-sm">
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

          <div>
            <Label className="text-xs">Legenda (opcional)</Label>
            <Input
              value={block.caption || ''}
              onChange={(e) => onUpdate({ caption: e.target.value })}
              placeholder="Adicione uma legenda..."
              className="h-8 text-sm"
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
