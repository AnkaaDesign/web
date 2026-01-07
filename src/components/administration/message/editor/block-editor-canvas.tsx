import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";
import { BlockEditor } from "./block-editor";
import { BlockTypeSelector } from "./block-type-selector";
import type { ContentBlock, BlockType } from "./types";

interface BlockEditorCanvasProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const BlockEditorCanvas = ({ blocks, onBlocksChange }: BlockEditorCanvasProps) => {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const handleAddBlock = (type: BlockType) => {
    const newBlock: ContentBlock = createEmptyBlock(type);

    if (insertIndex !== null) {
      const newBlocks = [...blocks];
      newBlocks.splice(insertIndex + 1, 0, newBlock);
      onBlocksChange(newBlocks);
    } else {
      onBlocksChange([...blocks, newBlock]);
    }

    setShowTypeSelector(false);
    setInsertIndex(null);
  };

  const handleUpdateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onBlocksChange(
      blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  const handleDeleteBlock = (id: string) => {
    onBlocksChange(blocks.filter((block) => block.id !== id));
  };

  const handleInsertBlock = (index: number) => {
    setInsertIndex(index);
    setShowTypeSelector(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor de Conteúdo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocks.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">Nenhum bloco adicionado ainda</p>
            <Button onClick={() => setShowTypeSelector(true)}>
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Bloco
            </Button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onInsertBelow={() => handleInsertBlock(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {blocks.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setInsertIndex(null);
                setShowTypeSelector(true);
              }}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar Bloco
            </Button>
          </div>
        )}

        <BlockTypeSelector
          open={showTypeSelector}
          onClose={() => {
            setShowTypeSelector(false);
            setInsertIndex(null);
          }}
          onSelect={handleAddBlock}
        />
      </CardContent>
    </Card>
  );
};

function createEmptyBlock(type: BlockType): ContentBlock {
  const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  switch (type) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'paragraph':
    case 'quote':
      return { id, type, content: '' };
    case 'image':
      return { id, type, url: '', alignment: 'center' };
    case 'button':
      return { id, type, text: '', url: '', variant: 'default', alignment: 'center' };
    case 'divider':
      return { id, type };
    case 'list':
      return { id, type, items: [''], ordered: false };
    default:
      return { id, type: 'paragraph', content: '' };
  }
}
