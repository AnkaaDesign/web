import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ListBlock } from "../types";

interface ListBlockEditorProps {
  block: ListBlock;
  onUpdate: (updates: Partial<ListBlock>) => void;
}

export const ListBlockEditor = ({ block, onUpdate }: ListBlockEditorProps) => {
  const handleAddItem = () => {
    onUpdate({ items: [...block.items, ''] });
  };

  const handleUpdateItem = (index: number, value: string) => {
    const newItems = [...block.items];
    newItems[index] = value;
    onUpdate({ items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (block.items.length === 1) return;
    const newItems = block.items.filter((_, i) => i !== index);
    onUpdate({ items: newItems });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Itens da Lista</Label>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Numerada</Label>
          <Switch
            checked={block.ordered || false}
            onCheckedChange={(checked) => onUpdate({ ordered: checked })}
          />
        </div>
      </div>

      <div className="space-y-2">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-6">
              {block.ordered ? `${index + 1}.` : '•'}
            </span>
            <Input
              value={item}
              onChange={(value: string | number | null) => handleUpdateItem(index, value as string)}
              placeholder={`Item ${index + 1}...`}
              className="h-9 dark:border-muted"
              transparent
            />
            {block.items.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleRemoveItem(index)}
              >
                <IconTrash className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddItem}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar Item
      </Button>
    </div>
  );
};
