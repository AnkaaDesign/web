import React, { useState, useMemo, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";
import { getHeaderText } from "@/components/ui/column-visibility-utils";

interface BonusColumn {
  key: string;
  header: string;
  defaultVisible: boolean;
}

const BONUS_COLUMNS: BonusColumn[] = [
  { key: "month", header: "Período", defaultVisible: false },
  { key: "payrollNumber", header: "Nº Folha", defaultVisible: false },
  { key: "user.name", header: "Colaborador", defaultVisible: true },
  { key: "user.cpf", header: "CPF", defaultVisible: false },
  { key: "position.name", header: "Cargo", defaultVisible: true },
  { key: "sector.name", header: "Setor", defaultVisible: false },
  { key: "performanceLevel", header: "Desempenho", defaultVisible: true },
  { key: "tasksCompleted", header: "Tarefas", defaultVisible: true },
  { key: "totalWeightedTasks", header: "Ponderadas", defaultVisible: false },
  { key: "totalCollaborators", header: "Colaboradores", defaultVisible: true },
  { key: "averageTasks", header: "Média", defaultVisible: true },
  { key: "bonus", header: "Bônus Bruto", defaultVisible: true },
  { key: "totalDiscounts", header: "Ajustes", defaultVisible: false },
  { key: "netBonus", header: "Bônus Líquido", defaultVisible: true },
];

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(BONUS_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key));
}

interface BonusColumnVisibilityManagerProps {
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function BonusColumnVisibilityManager({ visibleColumns, onVisibilityChange }: BonusColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);

  // Sync localVisible when visibleColumns prop changes or when popover opens
  useEffect(() => {
    if (open) {
      setLocalVisible(visibleColumns);
      setSearchQuery("");
    }
  }, [open, visibleColumns]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return BONUS_COLUMNS;
    return BONUS_COLUMNS.filter((col) => getHeaderText(col.header).toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const handleToggle = (columnKey: string, checked: boolean | undefined) => {
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
    setLocalVisible(new Set(BONUS_COLUMNS.map((col) => col.key)));
  };

  const handleDeselectAll = () => {
    setLocalVisible(new Set());
  };

  const handleReset = () => {
    setLocalVisible(getDefaultVisibleColumns());
  };

  const handleApply = () => {
    onVisibilityChange(localVisible);
    localStorage.setItem("bonus-visible-columns", JSON.stringify(Array.from(localVisible)));
    setOpen(false);
  };

  const handleClose = () => {
    setLocalVisible(visibleColumns);
    setOpen(false);
  };

  // Handle search input - Input component passes value directly, not event
  const handleSearchChange = (value: string | number | null) => {
    setSearchQuery(typeof value === 'string' ? value : '');
  };

  const visibleCount = localVisible.size;
  const totalCount = BONUS_COLUMNS.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default">
          <IconColumns className="h-4 w-4 mr-2" />
          Colunas ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Gerenciar Colunas</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <IconRefresh className="h-3 w-3 mr-1" />
              Restaurar
            </Button>
          </div>

          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
            <input
              type="text"
              placeholder="Buscar coluna..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-transparent px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                htmlFor={`bonus-column-${column.key}`}
              >
                <span className="text-sm">{column.header}</span>
                <Switch
                  id={`bonus-column-${column.key}`}
                  checked={localVisible.has(column.key)}
                  onCheckedChange={(checked) => handleToggle(column.key, checked)}
                />
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
