import type { PpeDelivery } from "../../../../types";
import type { ReactNode } from "react";

export interface PpeDeliveryColumn {
  key: string;
  header: string;
  accessor: (delivery: PpeDelivery) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface SortConfig {
  columnKey: string;
  direction: "asc" | "desc";
}
