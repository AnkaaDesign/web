import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleBorrowColumns } from "./column-visibility";

// Simple column interface for visibility management
interface BorrowColumnMeta {
  key: string;
  header: string;
}

// Default columns for borrow table
const getBorrowColumns = (): BorrowColumnMeta[] => [
  { key: "item.uniCode", header: "Código" },
  { key: "item.name", header: "Item" },
  { key: "user.name", header: "Usuário" },
  { key: "quantity", header: "Quantidade" },
  { key: "status", header: "Status" },
  { key: "createdAt", header: "Data do Empréstimo" },
  { key: "returnedAt", header: "Data de Devolução" },
];

interface ColumnVisibilityManagerProps {
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function ColumnVisibilityManager({ visibleColumns, onVisibilityChange }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => getBorrowColumns().map((c) => ({ id: c.key, header: c.header })), []);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => getDefaultVisibleBorrowColumns()}
    />
  );
}
