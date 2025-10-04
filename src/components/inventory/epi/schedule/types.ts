import type { PpeDeliverySchedule } from "../../../../types";

export interface PpeScheduleColumn {
  key: string;
  header: string;
  accessor: (schedule: PpeDeliverySchedule) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface SortConfig {
  columnKey: string;
  direction: "asc" | "desc";
}
