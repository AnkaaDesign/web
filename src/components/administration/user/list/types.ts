import type { User } from "../../../../types";
import type { ReactNode } from "react";

export interface UserColumn {
  key: string;
  header: string;
  accessor: (user: User) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface UserFilters {
  searchingFor?: string;
  status?: string[];
  positionId?: string[];
  sectorId?: string[];
  managedSectorId?: string[];
  hasCommissions?: boolean;
  hasManagedSector?: boolean;
  birthDate?: {
    gte?: Date;
    lte?: Date;
  };
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  hasEmail?: boolean;
  hasPhone?: boolean;
  verified?: boolean;
  requirePasswordChange?: boolean;
}
