import type { Item } from "../../../../types";

export interface ItemColumn {
  key: string;
  header: string;
  accessor: (item: Item) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
