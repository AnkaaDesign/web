import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import type { MaintenanceScheduleColumn } from "./types";

// Function to get default visible columns for maintenance schedules
export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["name", "item.name", "frequency", "nextRun", "isActive"]);
}

interface ColumnVisibilityManagerProps {
  columns: MaintenanceScheduleColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.key, header: c.header })), [columns]);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => getDefaultVisibleColumns()}
    />
  );
}
