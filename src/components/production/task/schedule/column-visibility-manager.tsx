import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";

// Define column interface to match the task table structure
interface TaskScheduleColumn {
  id: string;
  header: string;
  sortable?: boolean;
  width?: string;
}

// Task schedule columns matching the table structure
const TASK_SCHEDULE_COLUMNS: TaskScheduleColumn[] = [
  { id: "name", header: "LOGOMARCA", sortable: true, width: "w-[180px]" },
  { id: "customer.fantasyName", header: "CLIENTE", sortable: true, width: "w-[150px]" },
  { id: "measures", header: "MEDIDAS", sortable: true, width: "w-[110px]" },
  { id: "generalPainting", header: "PINTURA", sortable: true, width: "w-[100px]" },
  { id: "serialNumberOrPlate", header: "Nº SÉRIE", sortable: true, width: "w-[120px]" },
  { id: "chassisNumber", header: "Nº CHASSI", sortable: true, width: "w-[140px]" },
  { id: "sector.name", header: "SETOR", sortable: true, width: "w-[120px]" },
  { id: "entryDate", header: "ENTRADA", sortable: true, width: "w-[110px]" },
  { id: "startedAt", header: "INICIADO EM", sortable: true, width: "w-[110px]" },
  { id: "finishedAt", header: "FINALIZADO EM", sortable: true, width: "w-[110px]" },
  { id: "term", header: "PRAZO", sortable: true, width: "w-[110px]" },
  { id: "remainingTime", header: "TEMPO RESTANTE", sortable: false, width: "w-[130px]" },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "customer.fantasyName", "generalPainting", "serialNumberOrPlate", "entryDate", "term", "remainingTime"]);
};

interface ColumnVisibilityManagerProps {
  columns?: TaskScheduleColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange?: (columns: Set<string>) => void;
  onColumnVisibilityChange?: (columns: Set<string>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ColumnVisibilityManager({
  columns = TASK_SCHEDULE_COLUMNS,
  visibleColumns,
  onVisibilityChange,
  onColumnVisibilityChange,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: ColumnVisibilityManagerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
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
    setLocalVisible(new Set(columns.map((col) => col.id)));
  };

  const handleDeselectAll = () => {
    setLocalVisible(new Set());
  };

  const handleReset = () => {
    setLocalVisible(getDefaultVisibleColumns());
  };

  const handleApply = () => {
    const callback = onVisibilityChange || onColumnVisibilityChange;
    if (callback) {
      callback(localVisible);
    }
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
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <Button variant="outline" size="default" className="gap-2">
            <IconColumns className="h-4 w-4" />
            Colunas ({visibleCount}/{totalCount})
          </Button>
        </PopoverTrigger>
      )}
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
            <Input type="text" placeholder="Buscar coluna..." value={searchQuery} onChange={(value) => setSearchQuery(value as string)} className="pl-9 h-9" />
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
              <Label key={column.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                <Switch id={`column-${column.id}`} checked={localVisible.has(column.id)} onCheckedChange={(checked) => handleToggle(column.id, !!checked)} />
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
