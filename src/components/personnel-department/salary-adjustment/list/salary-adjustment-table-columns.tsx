import React from "react";
import { formatCurrency, formatDate } from "../../../../utils";
import { SALARY_ADJUSTMENT_TYPE_LABELS, SALARY_ADJUSTMENT_TYPE } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { SalaryAdjustment } from "../../../../types/salary-adjustment";

export interface SalaryAdjustmentColumn {
  key: string;
  header: string;
  accessor: (adjustment: SalaryAdjustment) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const formatPercentage = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${percentage > 0 ? "+" : ""}${formatted}%`;
};

export const createSalaryAdjustmentColumns = (): SalaryAdjustmentColumn[] => [
  // Data de Vigência
  {
    key: "effectiveDate",
    header: "DATA DE VIGÊNCIA",
    accessor: (adjustment: SalaryAdjustment) => (
      <div className="text-sm truncate">{adjustment.effectiveDate ? formatDate(new Date(adjustment.effectiveDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Tipo
  {
    key: "type",
    header: "TIPO",
    accessor: (adjustment: SalaryAdjustment) => (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        {SALARY_ADJUSTMENT_TYPE_LABELS[adjustment.type as SALARY_ADJUSTMENT_TYPE] || adjustment.type}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // Percentual
  {
    key: "percentage",
    header: "PERCENTUAL",
    accessor: (adjustment: SalaryAdjustment) =>
      adjustment.percentage !== null && adjustment.percentage !== undefined ? (
        <div className="text-sm font-medium truncate">{formatPercentage(adjustment.percentage)}</div>
      ) : (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          Personalizado
        </Badge>
      ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Cargos Afetados
  {
    key: "itemsCount",
    header: "CARGOS AFETADOS",
    accessor: (adjustment: SalaryAdjustment) =>
      // Bonus reajustes target the bonus period, not specific positions.
      adjustment.type === SALARY_ADJUSTMENT_TYPE.BONUS ? (
        <span className="text-sm text-muted-foreground whitespace-nowrap">Bônus (todos)</span>
      ) : (
        <Badge variant="default" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
          {adjustment.items?.length ?? 0}
        </Badge>
      ),
    sortable: false,
    className: "min-w-[150px]",
    align: "left",
  },

  // Aplicado Por
  {
    key: "appliedBy.name",
    header: "APLICADO POR",
    accessor: (adjustment: SalaryAdjustment) => (
      <div className="text-sm truncate" title={adjustment.appliedBy?.name}>
        {adjustment.appliedBy?.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    className: "min-w-[200px]",
    align: "left",
  },

  // Observação
  {
    key: "note",
    header: "OBSERVAÇÃO",
    accessor: (adjustment: SalaryAdjustment) => (
      <div className="text-sm truncate">{adjustment.note ? <TruncatedTextWithTooltip text={adjustment.note} /> : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[250px]",
    align: "left",
  },

  // Total Anterior (soma dos valores anteriores dos itens)
  {
    key: "previousTotal",
    header: "TOTAL ANTERIOR",
    accessor: (adjustment: SalaryAdjustment) => {
      const total = adjustment.items?.reduce((sum, item) => sum + (item.previousValue ?? 0), 0) ?? 0;
      return <div className="text-sm truncate">{adjustment.items?.length ? formatCurrency(total) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "min-w-[140px]",
    align: "left",
  },

  // Total Novo (soma dos novos valores dos itens)
  {
    key: "newTotal",
    header: "TOTAL NOVO",
    accessor: (adjustment: SalaryAdjustment) => {
      const total = adjustment.items?.reduce((sum, item) => sum + (item.newValue ?? 0), 0) ?? 0;
      return <div className="text-sm truncate">{adjustment.items?.length ? formatCurrency(total) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "min-w-[140px]",
    align: "left",
  },

  // Criado Em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (adjustment: SalaryAdjustment) => (
      <div className="text-sm truncate">{adjustment.createdAt ? formatDate(new Date(adjustment.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_SALARY_ADJUSTMENT_VISIBLE_COLUMNS = new Set(["effectiveDate", "type", "percentage", "itemsCount", "appliedBy.name", "note"]);
