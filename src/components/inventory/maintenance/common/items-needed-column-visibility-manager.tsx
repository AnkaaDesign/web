import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";

interface Column {
  key: string;
  header: string;
}

export function getDefaultVisibleColumns(canViewPrices: boolean = true): Set<string> {
  const base = ["uniCode", "name", "brand.name", "category.name", "neededQuantity", "quantity", "price", "subtotal"];
  return new Set(base.filter((key) => canViewPrices || (key !== "price" && key !== "subtotal")));
}

interface ColumnVisibilityManagerProps {
  columns: Column[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ItemsNeededColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
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
