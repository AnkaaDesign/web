import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { IconColumns } from "@tabler/icons-react";
import type { MaintenanceScheduleColumn } from "./types";

interface ColumnVisibilityManagerProps {
  columns: MaintenanceScheduleColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (visibleColumns: Set<string>) => void;
}

export function ColumnVisibilityManager({
  columns,
  visibleColumns,
  onVisibilityChange,
}: ColumnVisibilityManagerProps) {
  const toggleColumn = (columnKey: string) => {
    const newVisibleColumns = new Set(visibleColumns);
    if (newVisibleColumns.has(columnKey)) {
      newVisibleColumns.delete(columnKey);
    } else {
      newVisibleColumns.add(columnKey);
    }
    onVisibilityChange(newVisibleColumns);
  };

  const toggleAll = () => {
    if (visibleColumns.size === columns.length) {
      // If all are visible, hide all
      onVisibilityChange(new Set());
    } else {
      // Otherwise, show all
      onVisibilityChange(new Set(columns.map((col) => col.key)));
    }
  };

  const allVisible = visibleColumns.size === columns.length;
  const someVisible = visibleColumns.size > 0 && visibleColumns.size < columns.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <IconColumns className="h-4 w-4" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="font-semibold text-sm">Visibilidade das Colunas</div>

          {/* Toggle All Checkbox */}
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="toggle-all"
              checked={allVisible}
              indeterminate={someVisible}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="toggle-all" className="text-sm font-medium cursor-pointer">
              {allVisible ? "Desmarcar Todas" : "Marcar Todas"}
            </Label>
          </div>

          {/* Individual Column Checkboxes */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {columns.map((column) => (
              <div key={column.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`column-${column.key}`}
                  checked={visibleColumns.has(column.key)}
                  onCheckedChange={() => toggleColumn(column.key)}
                />
                <Label
                  htmlFor={`column-${column.key}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {column.header}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
