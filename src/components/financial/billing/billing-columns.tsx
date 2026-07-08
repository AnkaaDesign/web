import type { Task } from "@/types";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { formatDate, formatCurrency } from "@/utils";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";

const renderDate = (date: Date | string | null | undefined) => {
  if (!date) return <span className="text-muted-foreground">-</span>;
  return <span className="whitespace-nowrap">{formatDate(date)}</span>;
};

// Due date of the FIRST installment (parcela nº 1) across all customer configs,
// regardless of its status — so every task quote shows a vencimento, not only
// the ones currently "DUE". Falls back to the earliest due date when parcelas
// aren't numbered from 1.
// Exported so the table can sort by this value client-side — the due date lives
// two relations deep (quote -> customerConfigs -> installments), which Prisma
// can't order by directly, so this column sorts within the loaded page only.
export const findFirstInstallmentDueDate = (task: Task): Date | null => {
  const configs = task.quote?.customerConfigs;
  if (!configs || configs.length === 0) return null;
  let best: { number: number; due: Date } | null = null;
  for (const config of configs) {
    for (const installment of config.installments || []) {
      const due = installment.dueDate ? new Date(installment.dueDate) : null;
      if (!due) continue;
      const number = installment.number ?? Number.MAX_SAFE_INTEGER;
      if (!best || number < best.number || (number === best.number && due.getTime() < best.due.getTime())) {
        best = { number, due };
      }
    }
  }
  return best?.due ?? null;
};

export function createBillingColumns(): StandardizedColumn<Task>[] {
  return [
    {
      key: "name",
      header: "LOGOMARCA",
      sortable: true,
      width: "18%",
      render: (task) => (
        <TruncatedTextWithTooltip
          text={task.name}
          className="text-sm font-medium"
        />
      ),
    },
    {
      key: "identificador",
      header: "IDENTIFICADOR",
      sortable: true,
      width: "10%",
      render: (task) => {
        const value = task.serialNumber || task.truck?.plate || "";
        if (!value) return <span className="text-muted-foreground">-</span>;
        return <span className="text-sm truncate">{value}</span>;
      },
    },
    {
      key: "invoiceToCustomers",
      header: "FATURAR PARA",
      sortable: false,
      width: "30%",
      render: (task) => {
        const configs = task.quote?.customerConfigs;
        if (!configs || configs.length === 0) return <span className="text-muted-foreground">-</span>;
        const names = configs
          .map((c) => c.customer?.corporateName || c.customer?.fantasyName || "")
          .filter(Boolean);
        if (names.length === 0) return <span className="text-muted-foreground">-</span>;
        if (names.length === 1) {
          return <TruncatedTextWithTooltip text={names[0]} className="text-sm" />;
        }
        return (
          <div className="flex items-center gap-1 min-w-0" title={names.join(", ")}>
            <span className="text-sm truncate max-w-[45%]">{names[0]}</span>
            <span className="text-muted-foreground text-sm shrink-0">/</span>
            <span className="text-sm truncate max-w-[45%]">{names[1]}</span>
            {names.length > 2 && (
              <span className="text-muted-foreground text-xs shrink-0">+{names.length - 2}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "finishedAt",
      header: "FINALIZADO EM",
      sortable: true,
      width: "9%",
      render: (task) => renderDate(task.finishedAt),
    },
    {
      // Dotted key matches the "quote.statusOrder" convention below — the generic
      // path in convertSortConfigsToOrderBy turns this into { quote: { total } },
      // a valid Prisma orderBy since Task -> TaskQuote is a to-one relation.
      key: "quote.total",
      header: "VALOR",
      sortable: true,
      width: "10%",
      render: (task) => {
        const total = task.quote?.total;
        if (!total) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm font-medium whitespace-nowrap">
            {formatCurrency(Number(total))}
          </span>
        );
      },
    },
    {
      // Sorted client-side (see billing-table.tsx) — the due date lives two
      // relations deep, which Prisma can't order by directly.
      key: "currentInstallmentDueDate",
      header: "VENCIMENTO",
      sortable: true,
      width: "9%",
      render: (task) => renderDate(findFirstInstallmentDueDate(task)),
    },
    {
      key: "quote.statusOrder",
      header: "STATUS FATURAMENTO",
      sortable: true,
      width: "14%",
      render: (task) => {
        const status = task.quote?.status;
        if (!status) return <span className="text-muted-foreground">-</span>;
        return <QuoteStatusBadge status={status as TASK_QUOTE_STATUS} size="sm" />;
      },
    },
  ];
}
