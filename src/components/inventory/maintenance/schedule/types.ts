import type { MaintenanceSchedule } from "../../../../types";

export interface MaintenanceScheduleColumn {
  key: string;
  header: string;
  accessor: (schedule: MaintenanceSchedule) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface SortConfig {
  columnKey: string;
  direction: "asc" | "desc";
}
