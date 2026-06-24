import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./task-history-columns";
import type { TaskColumn } from "../list/types";

interface ColumnVisibilityManagerProps {
  columns: TaskColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  /** Custom default columns to use for reset. If not provided, uses column definitions' defaultVisible property */
  defaultColumns?: Set<string>;
  /** Current column order (array of column IDs) */
  columnOrder?: string[];
  /** Callback when column order changes */
  onColumnOrderChange?: (order: string[]) => void;
  /** Callback to reset column order to defaults (kept for call-site compatibility; reset is handled via order change) */
  onColumnOrderReset?: () => void;
  /** Callback to reset column widths to defaults */
  onColumnWidthsReset?: () => void;
}

/**
 * Reorder-capable column manager (task history + task preparation). Thin
 * adapter over {@link ColumnVisibilityManagerBase}; drag-to-reorder is enabled
 * because `onColumnOrderChange` is forwarded.
 */
export function ColumnVisibilityManager({
  columns,
  visibleColumns,
  onVisibilityChange,
  defaultColumns,
  columnOrder,
  onColumnOrderChange,
  onColumnWidthsReset,
}: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.id, header: c.header })), [columns]);

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => defaultColumns ?? getDefaultVisibleColumns(columns)}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      onColumnWidthsReset={onColumnWidthsReset}
    />
  );
}
