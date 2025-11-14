import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconColumns, IconSearch, IconRefresh, IconLock } from "@tabler/icons-react";
import type { ItemSelectorColumn } from "./item-selector-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ItemSelectorColumnVisibilityProps {
  columns: ItemSelectorColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  /** Columns that cannot be hidden */
  fixedColumns?: string[];
  /** Default columns to restore when clicking Restaurar */
  defaultColumns?: Set<string>;
}

export function ItemSelectorColumnVisibility({
  columns,
  visibleColumns,
  onVisibilityChange,
  fixedColumns = [],
  defaultColumns,
}: ItemSelectorColumnVisibilityProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);

  // Filter out the checkbox column from the list (it's always shown and managed separately)
  const manageableColumns = useMemo(() => {
    return columns.filter((col) => col.key !== "checkbox");
  }, [columns]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return manageableColumns;
    return manageableColumns.filter((col) => col.header.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [manageableColumns, searchQuery]);

  const handleToggle = (columnKey: string, checked: boolean | undefined) => {
    // Don't allow toggling fixed columns
    if (fixedColumns.includes(columnKey)) return;

    const newVisible = new Set(localVisible);
    const isChecked = checked === true;
    if (isChecked) {
      newVisible.add(columnKey);
    } else {
      newVisible.delete(columnKey);
    }
    setLocalVisible(newVisible);
  };

  const handleSelectAll = () => {
    setLocalVisible(new Set(manageableColumns.map((col) => col.key)));
  };

  const handleDeselectAll = () => {
    // Keep only fixed columns when deselecting all
    const fixedSet = new Set(fixedColumns);
    setLocalVisible(fixedSet);
  };

  const handleReset = () => {
    // Reset to default columns (not just fixed)
    if (defaultColumns) {
      setLocalVisible(new Set(defaultColumns));
    } else {
      // Fallback to fixed columns only if no defaults provided
      const fixedSet = new Set(fixedColumns);
      setLocalVisible(fixedSet);
    }
  };

  const handleApply = () => {
    // Ensure fixed columns are always included
    const finalVisible = new Set(localVisible);
    fixedColumns.forEach((key) => finalVisible.add(key));
    onVisibilityChange(finalVisible);
    setOpen(false);
  };

  const handleClose = () => {
    setLocalVisible(visibleColumns); // Reset to original state
    setOpen(false);
  };

  // When opening, sync with current visible columns
  React.useEffect(() => {
    if (open) {
      setLocalVisible(visibleColumns);
      setSearchQuery("");
    }
  }, [open, visibleColumns]);

  const visibleCount = localVisible.size;
  const totalCount = manageableColumns.length;

  const isColumnFixed = (columnKey: string): boolean => {
    return fixedColumns.includes(columnKey);
  };

  const getFixedReason = (column: ItemSelectorColumn): string | undefined => {
    if (column.fixed && column.fixedReason) {
      return column.fixedReason;
    }
    if (isColumnFixed(column.key)) {
      return "Esta coluna é obrigatória e não pode ser ocultada";
    }
    return undefined;
  };

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
            <Input
              type="text"
              placeholder="Buscar coluna..."
              value={searchQuery}
              onChange={(value) => setSearchQuery(String(value || ""))}
              className="pl-9 h-9 bg-transparent"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="flex-1 h-7 text-xs">
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} className="flex-1 h-7 text-xs">
              Desmarcar Todas
            </Button>
          </div>

          {fixedColumns.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <IconLock className="h-3 w-3" />
              {fixedColumns.length} coluna{fixedColumns.length !== 1 ? "s" : ""} obrigatória
              {fixedColumns.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-2">
            {filteredColumns.map((column) => {
              const isFixed = isColumnFixed(column.key);
              const fixedReason = getFixedReason(column);
              const isChecked = localVisible.has(column.key);

              const labelContent = (
                <Label
                  className={`flex items-center justify-between space-x-3 p-2 rounded-md cursor-pointer ${
                    isFixed ? "bg-muted/50" : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  htmlFor={`column-${column.key}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isFixed && <IconLock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    <span className="text-sm truncate">{column.header}</span>
                    {column.editable && (
                      <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                        Input
                      </Badge>
                    )}
                  </div>
                  <Switch
                    id={`column-${column.key}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggle(column.key, checked)}
                    disabled={isFixed}
                  />
                </Label>
              );

              if (fixedReason) {
                return (
                  <TooltipProvider key={column.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>{labelContent}</TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-xs">{fixedReason}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              return <div key={column.key}>{labelContent}</div>;
            })}
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
