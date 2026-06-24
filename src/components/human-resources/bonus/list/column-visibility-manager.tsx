import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getHeaderText, isDataColumn } from "@/components/ui/column-visibility-utils";
import type { Bonus } from "../../../../types";
import type { StandardizedColumn } from "@/components/ui/standardized-table";

interface ColumnVisibilityManagerProps {
  columns: StandardizedColumn<Bonus>[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  defaultVisibleColumns: Set<string>;
}

export function ColumnVisibilityManager({
  columns,
  visibleColumns,
  onVisibilityChange,
  defaultVisibleColumns,
}: ColumnVisibilityManagerProps) {
  // Only expose data columns (exclude control columns like select and actions).
  const baseColumns = useMemo(
    () => columns.filter(isDataColumn).map((c) => ({ id: c.key, header: getHeaderText(c.header) })),
    [columns],
  );
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => defaultVisibleColumns}
    />
  );
}
