import type { Task } from "../../../../types";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export interface TaskColumn {
  id: string;
  header: string | ReactNode;
  accessorKey?: string;
  accessorFn?: (row: Task) => any;
  sortable?: boolean;
  filterable?: boolean;
  defaultVisible?: boolean;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  sticky?: boolean;
  formatter?: (value: any, row: Task) => React.ReactNode;
}

export type TaskTableColumn = ColumnDef<Task> & {
  meta?: {
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
    sticky?: boolean;
  };
};
