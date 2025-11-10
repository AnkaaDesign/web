import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

export interface CategoryFilterProps {
  value: string[];
  onChange: (selected: string[]) => void;
  categories: CategoryNode[];
  placeholder?: string;
  className?: string;
  maxHeight?: number;
}

function CategoryTreeNode({
  node,
  selected,
  onToggle,
  level = 0,
}: {
  node: CategoryNode;
  selected: string[];
  onToggle: (id: string) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selected.includes(node.id);

  // Check if all children are selected
  const allChildrenSelected = hasChildren
    ? node.children!.every((child) => selected.includes(child.id))
    : false;

  const someChildrenSelected = hasChildren
    ? node.children!.some((child) => selected.includes(child.id))
    : false;

  return (
    <div>
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${level * 16}px` }}>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-accent rounded"
          >
            <IconChevronRight
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <Checkbox
          checked={isSelected || allChildrenSelected}
          className={cn(someChildrenSelected && !allChildrenSelected && "opacity-50")}
          onCheckedChange={() => onToggle(node.id)}
        />
        <Label className="text-sm cursor-pointer flex-1" onClick={() => onToggle(node.id)}>
          {node.name}
        </Label>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              selected={selected}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryFilter({
  value = [],
  onChange,
  categories,
  placeholder = "Selecionar categorias",
  className,
  maxHeight = 400,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (categoryId: string) => {
    const newValue = value.includes(categoryId)
      ? value.filter((id) => id !== categoryId)
      : [...value, categoryId];
    onChange(newValue);
  };

  const getSelectedLabel = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const findCategory = (nodes: CategoryNode[]): string | null => {
        for (const node of nodes) {
          if (node.id === value[0]) return node.name;
          if (node.children) {
            const found = findCategory(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return findCategory(categories) || value[0];
    }
    return `${value.length} categorias`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <span className="truncate">{getSelectedLabel()}</span>
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-mono text-xs">
              {value.length}
            </Badge>
          )}
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <ScrollArea style={{ maxHeight: `${maxHeight}px` }} className="p-4">
          {categories.map((category) => (
            <CategoryTreeNode
              key={category.id}
              node={category}
              selected={value}
              onToggle={handleToggle}
            />
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
