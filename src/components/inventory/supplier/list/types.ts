import type { Supplier } from "../../../../types";

export interface SupplierColumn {
  key: string;
  header: string;
  accessor: (supplier: Supplier) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
