import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./ppe-schedule-table-columns";
import type { PpeDeliverySchedule } from "../../../../types";

// Define column interface directly to avoid import issues
interface PpeScheduleColumn {
  key: string;
  header: string;
  accessor: (schedule: PpeDeliverySchedule) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface ColumnVisibilityManagerProps {
  columns: PpeScheduleColumn[];
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
      getDefaultVisibleColumns={() => getDefaultVisibleColumns()}
    />
  );
}
