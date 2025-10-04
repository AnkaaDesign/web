import React, { useState, useMemo, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";
import type { TruckColumn } from "./truck-table-columns";

const getDefaultVisibleColumns = () => {
  return new Set(["plate", "task.serialNumber", "model", "manufacturer", "task.customer.fantasyName", "garage.name", "parkingStatus", "createdAt"]);
};

interface ColumnVisibilityManagerProps {
  columns: TruckColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export const ColumnVisibilityManager = React.memo(function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(() => new Set(visibleColumns));

  // Sync localVisible with visibleColumns prop changes
  useEffect(() => {
    setLocalVisible(new Set(visibleColumns));
  }, [visibleColumns]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return columns;
    return columns.filter((col) => {
      const headerText = col.label;
      return headerText.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [columns, searchQuery]);

  const handleToggle = (columnId: string, checked: boolean) => {
    const newVisible = new Set(localVisible);
    if (checked) {
      newVisible.add(columnId);
    } else {
      newVisible.delete(columnId);
    }
    setLocalVisible(newVisible);
  };

  const handleSelectAll = () => {
    setLocalVisible(new Set(columns.map((col) => col.id)));
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
    setLocalVisible(new Set(visibleColumns)); // Reset to original state
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
            <Input type="text" placeholder="Buscar coluna..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
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
          <div className="space-y-1 p-2">
            {filteredColumns.map((column) => (
              <Label
                key={column.id}
                className="flex items-center justify-between space-x-3 p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                htmlFor={`column-${column.id}`}
              >
                <span className="text-sm">{column.label}</span>
                <Switch id={`column-${column.id}`} checked={localVisible.has(column.id)} onCheckedChange={(checked) => handleToggle(column.id, !!checked)} />
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
});