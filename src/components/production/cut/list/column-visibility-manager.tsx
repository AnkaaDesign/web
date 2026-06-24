import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import type { Cut } from "../../../../types";

// Define column interface directly to avoid import issues
interface CutColumn {
  key: string;
  header: string;
  accessor: (item: Cut) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Function to get default visible columns for cuts
// By default, all columns are visible except "reason"
export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["filePreview", "fileName", "task.name", "status", "type", "origin", "startedAt", "completedAt"]);
}

interface ColumnVisibilityManagerProps {
  columns: CutColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((col) => ({ id: col.key, header: col.header })), [columns]);

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => getDefaultVisibleColumns()}
    />
  );
}
