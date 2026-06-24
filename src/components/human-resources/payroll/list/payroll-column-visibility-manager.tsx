import { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { getDefaultVisibleColumns } from "./payroll-table-columns";

interface PayrollColumn {
  key: string;
  header: string;
  defaultVisible: boolean;
}

const PAYROLL_COLUMNS: PayrollColumn[] = [
  { key: "month", header: "Período", defaultVisible: false },
  { key: "payrollNumber", header: "Nº Folha", defaultVisible: true },
  { key: "user.name", header: "Nome", defaultVisible: true },
  { key: "user.cpf", header: "CPF", defaultVisible: false },
  { key: "position.name", header: "Cargo", defaultVisible: true },
  { key: "sector.name", header: "Setor", defaultVisible: true },
  { key: "bonus", header: "Bônus Bruto", defaultVisible: true },
  { key: "netBonus", header: "Bônus Líquido", defaultVisible: true },
  { key: "remuneration", header: "Remuneração", defaultVisible: true },
  { key: "totalEarnings", header: "Total Bruto", defaultVisible: false },
  { key: "totalNet", header: "Total Líquido", defaultVisible: true },
];

interface PayrollColumnVisibilityManagerProps {
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}

export function PayrollColumnVisibilityManager({ visibleColumns, onVisibilityChange }: PayrollColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => PAYROLL_COLUMNS.map((c) => ({ id: c.key, header: c.header })), []);
  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={onVisibilityChange}
      getDefaultVisibleColumns={() => getDefaultVisibleColumns()}
      storageKey="payroll-visible-columns"
    />
  );
}
