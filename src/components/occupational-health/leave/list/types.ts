import type { ReactNode } from "react";
import type { Leave } from "../../../../types/leave";

export interface LeaveColumn {
  key: string;
  header: string;
  accessor: (leave: Leave) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Filter state shape used by the leave list (convenience filters + start date range)
export interface LeaveListFilters {
  searchingFor?: string;
  types?: string[];
  statuses?: string[];
  userIds?: string[];
  returnExamRequired?: boolean;
  startDate?: {
    gte?: Date;
    lte?: Date;
  };
  limit?: number;
  page?: number;
  orderBy?: any;
  where?: any;
}
