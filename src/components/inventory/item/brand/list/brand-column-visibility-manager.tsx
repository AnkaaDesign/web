import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./brand-table-columns";
import type { ItemBrand } from "../../../../../types";

// Define column interface directly to avoid import issues
interface BrandColumn {
  key: string;
  header: string;
  accessor: (brand: ItemBrand, navigate: (path: string) => void) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface BrandColumnVisibilityManagerProps {
  columns: BrandColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function BrandColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: BrandColumnVisibilityManagerProps) {
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
