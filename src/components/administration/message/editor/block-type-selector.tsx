import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  IconH1,
  IconH2,
  IconH3,
  IconTextSize,
  IconPhoto,
  IconClick,
  IconMinus,
  IconList,
  IconQuote,
  IconSpacingVertical,
  IconStar,
  IconColumns,
} from "@tabler/icons-react";
import type { BlockType } from "./types";

interface BlockTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: BlockType) => void;
}

const blockTypes: Array<{
  type: BlockType;
  label: string;
  icon: typeof IconH1;
  description: string;
}> = [
  {
    type: 'heading1',
    label: 'Título 1',
    icon: IconH1,
    description: 'Título principal',
  },
  {
    type: 'heading2',
    label: 'Título 2',
    icon: IconH2,
    description: 'Subtítulo',
  },
  {
    type: 'heading3',
    label: 'Título 3',
    icon: IconH3,
    description: 'Título menor',
  },
  {
    type: 'paragraph',
    label: 'Parágrafo',
    icon: IconTextSize,
    description: 'Texto normal',
  },
  {
    type: 'image',
    label: 'Imagem',
    icon: IconPhoto,
    description: 'Adicionar uma imagem',
  },
  {
    type: 'button',
    label: 'Botão',
    icon: IconClick,
    description: 'Botão de ação com link',
  },
  {
    type: 'divider',
    label: 'Divisor',
    icon: IconMinus,
    description: 'Linha horizontal',
  },
  {
    type: 'spacer',
    label: 'Espaço',
    icon: IconSpacingVertical,
    description: 'Adicionar espaçamento vertical',
  },
  {
    type: 'list',
    label: 'Lista',
    icon: IconList,
    description: 'Lista de itens',
  },
  {
    type: 'quote',
    label: 'Citação',
    icon: IconQuote,
    description: 'Bloco de citação',
  },
  {
    type: 'icon',
    label: 'Ícone',
    icon: IconStar,
    description: 'Ícone decorativo',
  },
  {
    type: 'row',
    label: 'Linha',
    icon: IconColumns,
    description: 'Componentes lado a lado',
  },
];

export const BlockTypeSelector = ({ open, onClose, onSelect }: BlockTypeSelectorProps) => {
  const handleSelect = (type: BlockType) => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecione o tipo de bloco</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {blockTypes.map((blockType) => {
            const Icon = blockType.icon;
            return (
              <Button
                key={blockType.type}
                variant="outline"
                className="h-auto flex-col gap-2 p-4 hover:bg-muted"
                onClick={() => handleSelect(blockType.type)}
              >
                <Icon className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium text-sm">{blockType.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {blockType.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
