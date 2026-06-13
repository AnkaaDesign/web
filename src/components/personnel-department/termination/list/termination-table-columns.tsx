import type { ReactNode } from "react";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import {
  TERMINATION_STATUS,
  TERMINATION_TYPE_LABELS,
  TERMINATION_STATUS_LABELS,
} from "../../../../constants";
import { formatDate, formatCurrency } from "../../../../utils";
import type { Termination } from "../../../../types/termination";

export interface TerminationColumn {
  key: string;
  header: string;
  accessor: (termination: Termination) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const FINAL_STATUSES: TERMINATION_STATUS[] = [TERMINATION_STATUS.COMPLETED, TERMINATION_STATUS.CANCELLED];

export function isTerminationFinal(termination: Termination): boolean {
  return FINAL_STATUSES.includes(termination.status);
}

export function isPaymentOverdue(termination: Termination): boolean {
  if (!termination.paymentDueDate) return false;
  if (isTerminationFinal(termination)) return false;
  // Already paid (even if it was paid late) — no longer "overdue"
  if (termination.paymentDate) return false;
  return new Date(termination.paymentDueDate).getTime() < Date.now();
}

export function getTerminationNet(termination: Termination): number | null {
  if (!termination.items || termination.items.length === 0) return null;
  return termination.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

export const createTerminationColumns = (): TerminationColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (termination: Termination) => (
      <div className="truncate">
        <div className="font-medium truncate" title={termination.user?.name}>
          {termination.user?.name || <span className="text-muted-foreground">-</span>}
        </div>
        {termination.user?.position?.name && <div className="text-xs text-muted-foreground truncate">{termination.user.position.name}</div>}
      </div>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "left",
  },

  // Tipo
  {
    key: "type",
    header: "TIPO",
    accessor: (termination: Termination) => (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        {TERMINATION_TYPE_LABELS[termination.type] || termination.type}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "left",
  },

  // Status
  {
    key: "statusOrder",
    header: "STATUS",
    accessor: (termination: Termination) => (
      <Badge variant={getBadgeVariantFromStatus(termination.status, "TERMINATION")} className="text-xs whitespace-nowrap">
        {TERMINATION_STATUS_LABELS[termination.status] || termination.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Data da Rescisão
  {
    key: "terminationDate",
    header: "DATA DA RESCISÃO",
    accessor: (termination: Termination) => (
      <div className="text-sm truncate">{termination.terminationDate ? formatDate(new Date(termination.terminationDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Prazo de Pagamento
  {
    key: "paymentDueDate",
    header: "PRAZO DE PAGAMENTO",
    accessor: (termination: Termination) => {
      if (!termination.paymentDueDate) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }
      const overdue = isPaymentOverdue(termination);
      return (
        <div className="flex items-center gap-2">
          <span className={overdue ? "text-sm font-medium text-destructive" : "text-sm"}>{formatDate(new Date(termination.paymentDueDate))}</span>
          {overdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Atrasado
            </Badge>
          )}
        </div>
      );
    },
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Líquido
  {
    key: "net",
    header: "LÍQUIDO",
    accessor: (termination: Termination) => {
      const net = getTerminationNet(termination);
      if (net === null) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }
      return <div className={`text-sm font-medium tabular-nums ${net < 0 ? "text-destructive" : ""}`}>{formatCurrency(net)}</div>;
    },
    sortable: false,
    className: "min-w-[130px]",
    align: "right",
  },

  // Data de Criação
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (termination: Termination) => (
      <div className="text-sm truncate">{termination.createdAt ? formatDate(new Date(termination.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },
];

// Default visible columns
export const DEFAULT_TERMINATION_VISIBLE_COLUMNS = new Set(["user.name", "type", "statusOrder", "terminationDate", "paymentDueDate", "net"]);
