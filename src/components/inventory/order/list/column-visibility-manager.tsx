import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./order-table-columns";
import type { Order } from "../../../../types";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
import { getHeaderText, isDataColumn } from "@/components/ui/column-visibility-utils";

// Use StandardizedColumn type alias for consistency
type OrderColumn = StandardizedColumn<Order>;

interface ColumnVisibilityManagerProps {
  columns: OrderColumn[];
  visibleColumns: Set<string>;
  // Privilege-aware default from the list; used by "Restaurar" so reset matches the
  // initial state (admins keep payment status, warehouse never gets it).
  defaultVisibleColumns?: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ columns, visibleColumns, defaultVisibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  // Only data columns are user-toggleable (exclude select/actions control columns).
  const baseColumns = useMemo(() => columns.filter(isDataColumn).map((c) => ({ id: c.key, header: getHeaderText(c.header) })), [columns]);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => new Set(defaultVisibleColumns ?? getDefaultVisibleColumns())}
    />
  );
}
