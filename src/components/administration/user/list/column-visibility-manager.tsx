import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { DEFAULT_VISIBLE_COLUMNS } from "./user-table-columns";
import type { User } from "../../../../types";

// Define column interface directly to avoid import issues
interface UserColumn {
  key: string;
  header: string;
  accessor: (user: User) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface ColumnVisibilityManagerProps {
  columns: UserColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.key, header: c.header })), [columns]);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => DEFAULT_VISIBLE_COLUMNS}
    />
  );
}
