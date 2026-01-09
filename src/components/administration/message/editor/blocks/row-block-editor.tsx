import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconPlus, IconTrash, IconGripVertical } from "@tabler/icons-react";
import { BlockTypeSelector } from "../block-type-selector";
import { TextBlockEditor } from "./text-block-editor";
import { ImageBlockEditor } from "./image-block-editor";
import { ButtonBlockEditor } from "./button-block-editor";
import { ListBlockEditor } from "./list-block-editor";
import { DividerBlockEditor } from "./divider-block-editor";
import { SpacerBlockEditor } from "./spacer-block-editor";
import { IconBlockEditor } from "./icon-block-editor";
import type { RowBlock, ContentBlock, BlockType } from "../types";

interface RowBlockEditorProps {
  block: RowBlock;
  onUpdate: (updates: Partial<RowBlock>) => void;
}

export const RowBlockEditor = ({ block, onUpdate }: RowBlockEditorProps) => {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [addingToIndex, setAddingToIndex] = useState<number | null>(null);

  // Initialize columns count if not set
  const columnCount = block.columns || 2;

  const handleAddBlock = (type: BlockType) => {
    // Don't allow nested row blocks to prevent infinite nesting
    if (type === 'row') {
      alert('Não é possível adicionar uma linha dentro de outra linha');
      return;
    }

    const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let newBlock: ContentBlock;

    switch (type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'paragraph':
      case 'quote':
        newBlock = { id, type, content: '' };
        break;
      case 'image':
        newBlock = { id, type, url: '', alignment: 'center' };
        break;
      case 'button':
        newBlock = { id, type, text: '', url: '', variant: 'default', alignment: 'center' };
        break;
      case 'divider':
        newBlock = { id, type };
        break;
      case 'spacer':
        newBlock = { id, type, height: 'md' };
        break;
      case 'list':
        newBlock = { id, type, items: [''], ordered: false };
        break;
      case 'icon':
        newBlock = { id, type, icon: 'IconCheck', size: 'md', color: 'text-foreground', alignment: 'center' };
        break;
      default:
        newBlock = { id, type: 'paragraph', content: '' };
    }

    if (addingToIndex !== null) {
      // Insert at specific position
      const newBlocks = [...block.blocks];
      newBlocks.splice(addingToIndex, 0, newBlock);
      onUpdate({ blocks: newBlocks });
    } else {
      // Add to end
      onUpdate({ blocks: [...block.blocks, newBlock] });
    }

    setShowTypeSelector(false);
    setAddingToIndex(null);
  };

  const handleUpdateBlock = (index: number, updates: Partial<ContentBlock>) => {
    const updatedBlocks = [...block.blocks];
    updatedBlocks[index] = { ...updatedBlocks[index], ...updates };
    onUpdate({ blocks: updatedBlocks });
  };

  const handleDeleteBlock = (index: number) => {
    const updatedBlocks = block.blocks.filter((_, i) => i !== index);
    onUpdate({ blocks: updatedBlocks });
  };

  const renderNestedBlockContent = (nestedBlock: ContentBlock, index: number) => {
    switch (nestedBlock.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'paragraph':
      case 'quote':
        return <TextBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      case 'image':
        return <ImageBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      case 'button':
        return <ButtonBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      case 'list':
        return <ListBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      case 'divider':
        return <DividerBlockEditor />;
      case 'spacer':
        return <SpacerBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      case 'icon':
        return <IconBlockEditor block={nestedBlock} onUpdate={(updates) => handleUpdateBlock(index, updates)} />;
      default:
        return null;
    }
  };


  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div className="space-y-3">
      {/* Row Settings */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Número de Colunas</Label>
          <Combobox
            value={String(columnCount)}
            onValueChange={(value) => {
              const newColumnCount = Number(value) as 2 | 3 | 4;
              onUpdate({ columns: newColumnCount });

              // Trim blocks if reducing column count
              if (block.blocks.length > newColumnCount) {
                onUpdate({
                  columns: newColumnCount,
                  blocks: block.blocks.slice(0, newColumnCount)
                });
              }
            }}
            options={[
              { value: '2', label: '2 Colunas' },
              { value: '3', label: '3 Colunas' },
              { value: '4', label: '4 Colunas' },
            ]}
            placeholder="Selecione"
            searchable={false}
            triggerClassName="h-9"
          />
        </div>

        <div>
          <Label className="text-xs">Espaçamento</Label>
          <Combobox
            value={block.gap || 'md'}
            onValueChange={(value) => onUpdate({ gap: value as any })}
            options={[
              { value: 'none', label: 'Nenhum' },
              { value: 'sm', label: 'Pequeno' },
              { value: 'md', label: 'Médio' },
              { value: 'lg', label: 'Grande' },
            ]}
            placeholder="Selecione"
            searchable={false}
            triggerClassName="h-9"
          />
        </div>

        <div>
          <Label className="text-xs">Alinhamento Vertical</Label>
          <Combobox
            value={block.verticalAlign || 'top'}
            onValueChange={(value) => onUpdate({ verticalAlign: value as any })}
            options={[
              { value: 'top', label: 'Topo' },
              { value: 'center', label: 'Centro' },
              { value: 'bottom', label: 'Base' },
            ]}
            placeholder="Selecione"
            searchable={false}
            triggerClassName="h-9"
          />
        </div>
      </div>

      {/* Column-based Layout */}
      <div>
        <Label className="text-xs mb-2 block">Colunas ({columnCount} lado a lado)</Label>

        <div className={`grid ${columnCount === 2 ? 'grid-cols-2' : columnCount === 3 ? 'grid-cols-3' : 'grid-cols-4'} ${gapClasses[block.gap || 'md']}`}>
          {Array.from({ length: columnCount }).map((_, colIndex) => {
            const blockInColumn = block.blocks[colIndex];

            return (
              <div key={colIndex} className="min-h-[120px]">
                {blockInColumn ? (
                  <Card className="p-3 relative group h-full">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteBlock(colIndex)}
                        title="Remover"
                      >
                        <IconTrash className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <IconGripVertical className="h-3 w-3" />
                        Coluna {colIndex + 1}
                      </div>
                      {renderNestedBlockContent(blockInColumn, colIndex)}
                    </div>
                  </Card>
                ) : (
                  <button
                    className="w-full h-full min-h-[120px] border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2 group"
                    onClick={() => {
                      setAddingToIndex(colIndex);
                      setShowTypeSelector(true);
                    }}
                  >
                    <IconPlus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      Coluna {colIndex + 1}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Block Type Selector */}
      <BlockTypeSelector
        open={showTypeSelector}
        onClose={() => {
          setShowTypeSelector(false);
          setAddingToIndex(null);
        }}
        onSelect={handleAddBlock}
      />

      {/* Info */}
      <div className="rounded-lg bg-muted p-3 space-y-1">
        <p className="text-xs font-medium">Como funciona:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Os blocos ficam lado a lado, imediatamente próximos</li>
          <li>O espaçamento controla a distância entre eles</li>
          <li>Exemplo: ícone + título com espaçamento pequeno</li>
          <li>Passe o mouse entre blocos para adicionar mais</li>
          <li>Em dispositivos móveis, os blocos empilham verticalmente</li>
        </ul>
      </div>
    </div>
  );
};
