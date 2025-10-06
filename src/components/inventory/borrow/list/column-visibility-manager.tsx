import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";
import { getDefaultVisibleBorrowColumns } from "./column-visibility";
import type { Borrow } from "../../../../types";

// Define column interface directly to avoid import issues
interface BorrowColumn {
  key: string;
  header: string;
  accessor: (borrow: Borrow) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Default columns for borrow table
const getBorrowColumns = (): BorrowColumn[] => [
  { key: "item.uniCode", header: "Código", sortable: true },
  { key: "item.name", header: "Item", sortable: true },
  { key: "user.name", header: "Usuário", sortable: true },
  { key: "quantity", header: "Quantidade", sortable: true },
  { key: "status", header: "Status", sortable: true },
  { key: "createdAt", header: "Data do Empréstimo", sortable: true },
  { key: "returnedAt", header: "Data de Devolução", sortable: true },
];

interface ColumnVisibilityManagerProps {
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const columns = getBorrowColumns();
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
    setLocalVisible(getDefaultVisibleBorrowColumns());
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
            <Input
              type="text"
              placeholder="Buscar coluna..."
              value={searchQuery}
              onChange={(value) => setSearchQuery(value as string)}
              className="pl-9 h-9"
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
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-2">
            {filteredColumns.map((column) => (
              <Label
                key={column.key}
                className="flex items-center justify-between space-x-3 p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                htmlFor={`column-${column.key}`}
              >
                <span className="text-sm">{column.header}</span>
                <Switch id={`column-${column.key}`} checked={localVisible.has(column.key)} onCheckedChange={(checked) => handleToggle(column.key, !!checked)} />
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
