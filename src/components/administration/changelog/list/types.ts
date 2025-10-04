import React from "react";
import type { ChangeLog } from "../../../../types";

export interface ChangelogColumn {
  key: string;
  header: string;
  accessor: (changelog: ChangeLog) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface ChangelogTableProps {
  changelogs: ChangeLog[];
  isLoading: boolean;
  visibleColumns: Set<string>;
  sortConfigs: Array<{ key: string; direction: "asc" | "desc" }>;
  selectedIds: string[];
  onSort: (key: string) => void;
  onRowClick: (changelog: ChangeLog) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export interface ChangelogListProps {
  onDataChange?: (data: { items: ChangeLog[]; totalRecords: number }) => void;
}

export interface ChangelogFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onReset: () => void;
}
