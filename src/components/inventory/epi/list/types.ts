import type { Item } from "../../../../types";

export interface PpeColumn {
  key: string;
  header: string;
  accessor: (item: Item) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface SortConfig {
  columnKey: string;
  direction: "asc" | "desc";
}
