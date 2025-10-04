import type { Truck } from "../../../../types";

export interface TruckColumn {
  id: string;
  label: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  sortable?: boolean;
  render: (truck: Truck) => React.ReactNode;
  align?: "left" | "center" | "right";
}

export interface FilterableEntity {
  id: string;
  name: string;
}

export interface FilterableCustomer {
  id: string;
  fantasyName?: string;
  corporateName?: string;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
  onRemove: () => void;
}
