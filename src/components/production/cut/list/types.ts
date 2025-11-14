import type { Cut } from "../../../../types";

export interface CutColumn {
  key: string;
  header: string;
  accessor: (item: Cut) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
