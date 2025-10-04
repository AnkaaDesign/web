import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh } from "@tabler/icons-react";
import { getDefaultVisibleColumns } from "./observation-table-columns";
import type { Observation } from "../../../../types";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
import { getHeaderText, isDataColumn } from "@/components/ui/column-visibility-utils";

// Use StandardizedColumn type alias for consistency
type ObservationColumn = StandardizedColumn<Observation>;

interface ColumnVisibilityManagerProps {
  columns: ObservationColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);

  const filteredColumns = useMemo(() => {
    // Filter out control columns (select and actions) and only show data columns
    const dataColumns = columns.filter(isDataColumn);

    if (!searchQuery) return dataColumns;
    return dataColumns.filter((col) => {
      const headerText = getHeaderText(col.header);
      return headerText.toLowerCase().includes(searchQuery.toLowerCase());
    });
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
    const dataColumns = columns.filter(isDataColumn);
    setLocalVisible(new Set(dataColumns.map((col) => col.key)));
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

  const dataColumnsCount = columns.filter(isDataColumn).length;
  const visibleCount = Array.from(localVisible).filter((key) => {
    const column = columns.find((col) => col.key === key);
    return column && isDataColumn(column);
  }).length;
  const totalCount = dataColumnsCount;

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
                key={column.key}
                className="flex items-center justify-between space-x-3 p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                htmlFor={`column-${column.key}`}
              >
                <span className="text-sm">{getHeaderText(column.header)}</span>
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
