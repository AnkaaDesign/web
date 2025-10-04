import type { Maintenance } from "../../../../types";

export interface MaintenanceColumn {
  key: string;
  header: string;
  accessor: (maintenance: Maintenance) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface SortConfig {
  columnKey: string;
  direction: "asc" | "desc";
}
