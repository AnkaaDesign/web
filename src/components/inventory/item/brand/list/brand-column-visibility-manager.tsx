import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";
import { getDefaultVisibleColumns } from "./brand-table-columns";
import type { ItemBrand } from "../../../../../types";

// Define column interface directly to avoid import issues
interface BrandColumn {
  key: string;
  header: string;
  accessor: (brand: ItemBrand, navigate: (path: string) => void) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface BrandColumnVisibilityManagerProps {
  columns: BrandColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function BrandColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: BrandColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return columns;
    return columns.filter((col) => col.header.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [columns, searchQuery]);

  const handleToggle = (columnKey: string, checked: boolean) => {
    const newVisible = new Set(localVisible);
    if (checked) {
      newVisible.add(columnKey);
    } else {
      newVisible.delete(columnKey);
    }
    setLocalVisible(newVisible);
  };

  const handleSelectAll = () => {
    setLocalVisible(new Set(columns.map((col) => col.key)));
  };

  const handleDeselectAll = () => {
    setLocalVisible(new Set());
  };

  const handleReset = () => {
    setLocalVisible(getDefaultVisibleColumns());
  };

  const handleApply = () => {
    onVisibilityChange(localVisible);
    setOpen(false);
  };

  const handleClose = () => {
    setLocalVisible(visibleColumns); // Reset to original state
    setOpen(false);
  };

  const visibleCount = localVisible.size;
  const totalCount = columns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <IconColumns className="h-4 w-4" />
          Colunas ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Gerenciar Colunas</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <IconRefresh className="h-3 w-3 mr-1" />
              Restaurar
            </Button>
          </div>

          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar coluna..." value={searchQuery} onChange={(value) => setSearchQuery(String(value || ""))} className="pl-9 h-9" />
          </div>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="flex-1 h-7 text-xs">
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} className="flex-1 h-7 text-xs">
              Desmarcar Todas
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {filteredColumns.map((column) => (
              <Label key={column.key} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                <Checkbox checked={localVisible.has(column.key)} onCheckedChange={(checked) => handleToggle(column.key, !!checked)} />
                <span className="flex-1 text-sm">{column.header}</span>
              </Label>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex justify-between">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
