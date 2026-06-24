import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import type { Paint } from "../../../../types";

// Define column interface directly to avoid import issues
interface PaintColumn {
  key: string;
  header: string;
  accessor: (paint: Paint) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface ColumnVisibilityManagerProps {
  columns: PaintColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "type", "finish", "brand", "manufacturer", "formulas"]);
};

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.key, header: c.header })), [columns]);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={getDefaultVisibleColumns}
      storageKey="paint-catalogue-visible-columns"
    />
  );
}
