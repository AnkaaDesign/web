import type { ReactNode } from "react";
import type { Fispq } from "@/types/fispq";

export interface FispqColumn {
  key: string;
  header: string;
  accessor: (fispq: Fispq) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
