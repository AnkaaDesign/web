import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconGripVertical, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TextBlockEditor } from "./blocks/text-block-editor";
import { ImageBlockEditor } from "./blocks/image-block-editor";
import { ButtonBlockEditor } from "./blocks/button-block-editor";
import { ListBlockEditor } from "./blocks/list-block-editor";
import { DividerBlockEditor } from "./blocks/divider-block-editor";
import { SpacerBlockEditor } from "./blocks/spacer-block-editor";
import { IconBlockEditor } from "./blocks/icon-block-editor";
import { RowBlockEditor } from "./blocks/row-block-editor";
import { DecoratorBlockEditor } from "./blocks/decorator-block-editor";
import { CompanyAssetBlockEditor } from "./blocks/company-asset-block-editor";
import type { ContentBlock } from "./types";

interface BlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
}

export const BlockEditor = ({ block, onUpdate, onDelete }: BlockEditorProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'paragraph':
      case 'quote':
        return <TextBlockEditor block={block} onUpdate={onUpdate} />;
      case 'image':
        return <ImageBlockEditor block={block} onUpdate={onUpdate} />;
      case 'button':
        return <ButtonBlockEditor block={block} onUpdate={onUpdate} />;
      case 'list':
        return <ListBlockEditor block={block} onUpdate={onUpdate} />;
      case 'divider':
        return <DividerBlockEditor />;
      case 'spacer':
        return <SpacerBlockEditor block={block} onUpdate={onUpdate} />;
      case 'icon':
        return <IconBlockEditor block={block} onUpdate={onUpdate} />;
      case 'row':
        return <RowBlockEditor block={block} onUpdate={onUpdate} />;
      case 'decorator':
        return <DecoratorBlockEditor block={block} onUpdate={onUpdate} />;
      case 'company-asset':
        return <CompanyAssetBlockEditor block={block as any} onUpdate={onUpdate} />;
      default:
        return null;
    }
  };

  const isDecorator = block.type === 'decorator';
  const isCompanyAsset = block.type === 'company-asset';

  if (isDecorator) {
    return (
      <div ref={setNodeRef} style={style} className={cn("group relative", isDragging && "opacity-50")}>
        <Card className="border border-border/50 hover:border-primary/60 transition-colors overflow-hidden">
          {/* Overlaid controls */}
          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              {...attributes}
              {...listeners}
              className="p-1 bg-background/80 hover:bg-muted rounded cursor-grab active:cursor-grabbing backdrop-blur-sm"
            >
              <IconGripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background/80 text-destructive hover:text-destructive backdrop-blur-sm"
              onClick={onDelete}
              title="Remover bloco"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
          {/* Edge-to-edge decorator content */}
          <div className="w-full">
            {renderBlockContent()}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("group relative", isDragging && "opacity-50")}>
      <Card className="border border-border/50 hover:border-primary/60 transition-colors">
        <div className={cn("flex items-start gap-2 p-3", isCompanyAsset && "py-5")}>
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 mt-1 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <IconGripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Block Content */}
          <div className="flex-1 min-w-0">
            {renderBlockContent()}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Remover bloco"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
