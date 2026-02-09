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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor de Conteúdo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocks.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border dark:border-muted rounded-lg">
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
              {blocks.map((block, _index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                  onDelete={() => handleDeleteBlock(block.id)}
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
      return { id, type, content: '', fontSize: 'lg', fontWeight: 'semibold' };
    case 'heading2':
      return { id, type, content: '', fontSize: '2xl', fontWeight: 'semibold' };
    case 'heading3':
      return { id, type, content: '', fontSize: 'xl', fontWeight: 'medium' };
    case 'paragraph':
      return { id, type, content: '', fontSize: 'base', fontWeight: 'normal' };
    case 'quote':
      return { id, type, content: '', fontSize: 'lg', fontWeight: 'normal' };
    case 'image':
      return { id, type, url: '', alignment: 'center' };
    case 'button':
      return { id, type, text: '', url: '', variant: 'default', alignment: 'center' };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, height: 'md' };
    case 'list':
      return { id, type, items: [''], ordered: false };
    case 'icon':
      return { id, type, icon: 'IconCheck', size: 'md', color: 'text-foreground', alignment: 'center' };
    case 'row':
      return { id, type, blocks: [], columns: 2, gap: 'md', verticalAlign: 'top' };
    default:
      return { id, type: 'paragraph', content: '', fontSize: 'base', fontWeight: 'normal' };
  }
}
