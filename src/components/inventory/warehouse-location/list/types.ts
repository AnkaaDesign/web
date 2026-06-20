import type { WarehouseLocation } from "../../../../types";

export interface WarehouseLocationColumn {
  key: string;
  header: string;
  accessor: (warehouseLocation: WarehouseLocation) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
