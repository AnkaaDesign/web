import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";

interface BonusColumn {
  key: string;
  header: string;
  defaultVisible: boolean;
}

const BONUS_COLUMNS: BonusColumn[] = [
  { key: "month", header: "Período", defaultVisible: false },
  { key: "payrollNumber", header: "Nº Folha", defaultVisible: false },
  { key: "user.name", header: "Colaborador", defaultVisible: true },
  { key: "user.cpf", header: "CPF", defaultVisible: false },
  { key: "position.name", header: "Cargo", defaultVisible: true },
  { key: "sector.name", header: "Setor", defaultVisible: false },
  { key: "performanceLevel", header: "Desempenho", defaultVisible: true },
  { key: "tasksCompleted", header: "Tarefas", defaultVisible: false },
  { key: "totalWeightedTasks", header: "Tarefas Ponderadas", defaultVisible: true },
  { key: "totalCollaborators", header: "Colaboradores", defaultVisible: true },
  { key: "averageTasks", header: "Média", defaultVisible: true },
  { key: "bonus", header: "Bônus Bruto", defaultVisible: true },
  { key: "totalDiscounts", header: "Ajustes", defaultVisible: true },
  { key: "netBonus", header: "Bônus Líquido", defaultVisible: true },
];

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(BONUS_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key));
}

interface BonusColumnVisibilityManagerProps {
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function BonusColumnVisibilityManager({ visibleColumns, onVisibilityChange }: BonusColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => BONUS_COLUMNS.map((c) => ({ id: c.key, header: c.header })), []);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={getDefaultVisibleColumns}
      storageKey="bonus-visible-columns"
    />
  );
}
