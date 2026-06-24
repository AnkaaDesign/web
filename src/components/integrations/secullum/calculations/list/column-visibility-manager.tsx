import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";

// Default visible columns for the Calculations (Visualização Colaborador)
// table. Other consumers (e.g. Visualização Dia) pass their own set via the
// `defaultVisibleColumns` prop on ColumnVisibilityManager — keep this as the
// fallback so existing call sites that omit the prop don't break.
export function getDefaultVisibleColumns(): Set<string> {
  return new Set([
    "date",
    "entrada1",
    "saida1",
    "entrada2",
    "saida2",
    "normais",
    "atras",
    "faltas",
    "ajuste",
    "ex50",
    "ex100",
    "dsr",
  ]);
}

export interface ColumnDef {
  key: string;
  header: string | React.ReactNode;
}

interface ColumnVisibilityManagerProps {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  // Per-consumer defaults for "Restaurar". Falls back to calc-list defaults.
  defaultVisibleColumns?: Set<string>;
}

export function ColumnVisibilityManager({ columns, visibleColumns, onVisibilityChange, defaultVisibleColumns }: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.key, header: c.header })), [columns]);

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => defaultVisibleColumns ?? getDefaultVisibleColumns()}
    />
  );
}
