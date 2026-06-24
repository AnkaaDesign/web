import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";

interface GenericColumn {
  key: string;
  header: string;
  defaultVisible?: boolean;
}

interface GenericColumnVisibilityManagerProps {
  columns: GenericColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  storageKey?: string;
  getDefaultVisibleColumns?: () => Set<string>;
}

/**
 * Thin adapter over {@link ColumnVisibilityManagerBase}. Kept for backwards
 * compatibility with the many lists that pass `{ key, header, defaultVisible }`
 * columns. New code can use the base component directly.
 */
export function GenericColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange, storageKey, getDefaultVisibleColumns }: GenericColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((col) => ({ id: col.key, header: col.header })), [columns]);

  const resolveDefaults = () =>
    getDefaultVisibleColumns ? getDefaultVisibleColumns() : new Set(columns.filter((col) => col.defaultVisible).map((col) => col.key));

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={resolveDefaults}
      storageKey={storageKey}
    />
  );
}
