import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
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
  // Only data columns are user-toggleable (exclude select/actions control columns).
  const baseColumns = useMemo(() => columns.filter(isDataColumn).map((col) => ({ id: col.key, header: getHeaderText(col.header) })), [columns]);

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => getDefaultVisibleColumns()}
    />
  );
}
