import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./paint-brand-table-columns";
import type { PaintBrand } from "../../../../types";

// Define column interface directly to avoid import issues
interface PaintBrandColumn {
  key: string;
  header: string | React.ReactNode;
  accessor: (paintBrand: PaintBrand) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface ColumnVisibilityManagerProps {
  columns: PaintBrandColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export const ColumnVisibilityManager = React.memo(function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.key, header: c.header })), [columns]);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={getDefaultVisibleColumns}
    />
  );
});
