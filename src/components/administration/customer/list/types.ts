export interface CustomerColumn {
  key: string;
  header: string;
  accessor: (customer: any) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}
