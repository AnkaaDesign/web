import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Task } from "@/types";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TASK_QUOTE_STATUS_LABELS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import { formatCurrency } from "@/utils";
import {
  InvoiceToCustomersCell,
  MutedDash,
  OrderNumbersCell,
  PaymentMethodCell,
  dateExportValue,
  installmentProgress,
  invoiceToCustomerNames,
  paymentMethodLabels,
  quoteOrderNumbers,
  renderDateCell,
  taskCustomerName,
  taskIdentifier,
} from "@/components/financial/shared/quote-table-shared";

/**
 * Due date of the FIRST installment (parcela nº 1) across all customer configs, regardless of its
 * status — so every task quote shows a vencimento, not only the ones currently "DUE". Falls back
 * to the earliest due date when parcelas aren't numbered from 1.
 *
 * The API mirrors this resolution byte for byte for the `currentInstallmentDueDate` sort key
 * (`task-prisma.repository.ts` → `resolveFirstInstallmentDueDate`); keep both in sync or the
 * rendered date and the sort order disagree.
 */
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

const money = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const moneyCell = (n: number | null) =>
  n ? <span className="text-sm font-medium whitespace-nowrap tabular-nums">{formatCurrency(n)}</span> : <MutedDash />;

const moneyExport = (value: unknown) => {
  const n = money(value);
  return n && n > 0 ? formatCurrency(n) : "";
};

/**
 * Columns for the Faturamento list. Ids are dot-free (they become `--col-<id>-size` and the
 * persistence key); nested sort targets live in BILLING_SORT_FIELD_MAP.
 *
 * Everything the legacy table showed stays visible by default; the columns added on top are
 * `defaultVisible: false` and reachable from "Colunas", except Nº Orçamento, N° do Pedido and
 * Parcelas — the three the financial team asked to have in front of them.
 */
export function createBillingColumns(): DataTableColumnDef<Task>[] {
  return [
    {
      // The number people quote at each other on the phone — the fastest way to find a faturamento.
      id: "budgetNumber",
      header: "Nº Orçamento",
      accessorFn: (t) => t.quote?.budgetNumber ?? null,
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { align: "right", headerLabel: "Nº Orçamento", exportHeader: "Nº Orçamento", exportValue: (t) => t.quote?.budgetNumber ?? "" },
      cell: ({ getValue }) => {
        const n = getValue() as number | null;
        return n ? <span className="text-sm font-medium tabular-nums">{n}</span> : <MutedDash />;
      },
    },
    {
      id: "name",
      header: "Logomarca",
      accessorKey: "name",
      enableSorting: true,
      size: 220,
      minSize: 160,
      meta: { headerLabel: "Logomarca", exportHeader: "Logomarca", exportValue: (t) => t.name || "" },
      cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.name} className="text-sm font-medium" />,
    },
    {
      id: "identificador",
      header: "Identificador",
      accessorFn: (t) => taskIdentifier(t),
      enableSorting: true,
      size: 130,
      minSize: 100,
      meta: { headerLabel: "Identificador", exportHeader: "Identificador", exportValue: (t) => taskIdentifier(t) },
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return value ? <span className="text-sm truncate">{value}</span> : <MutedDash />;
      },
    },
    {
      // The task's OWN customer — who the work was for, which is not always who is invoiced.
      id: "customer",
      header: "Cliente",
      accessorFn: (t) => taskCustomerName(t),
      enableSorting: true,
      size: 240,
      minSize: 150,
      meta: { defaultVisible: false, headerLabel: "Cliente", exportHeader: "Cliente", exportValue: (t) => taskCustomerName(t) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : <MutedDash />;
      },
    },
    {
      id: "invoiceToCustomers",
      header: "Faturar Para",
      enableSorting: false,
      size: 300,
      minSize: 180,
      meta: { headerLabel: "Faturar Para", exportHeader: "Faturar Para", exportValue: (t) => invoiceToCustomerNames(t) },
      cell: ({ row }) => <InvoiceToCustomersCell task={row.original} />,
    },
    {
      // Visible by default here: without the pedido the nota cannot be issued, so on Faturamento
      // its absence is the blocker itself (see `task-quote.ibipora-missing-order-number`).
      id: "orderNumber",
      header: "N° do Pedido",
      accessorFn: (t) => quoteOrderNumbers(t).join(", "),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "N° do Pedido", exportHeader: "N° do Pedido", exportValue: (t) => quoteOrderNumbers(t) },
      cell: ({ row }) => <OrderNumbersCell task={row.original} />,
    },
    {
      id: "finishedAt",
      header: "Finalizado em",
      accessorKey: "finishedAt",
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Finalizado em", exportHeader: "Finalizado em", exportValue: (t) => dateExportValue(t.finishedAt) },
      cell: ({ row }) => renderDateCell(row.original.finishedAt),
    },
    {
      id: "quoteSubtotal",
      header: "Subtotal",
      accessorFn: (t) => money(t.quote?.subtotal),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        align: "right",
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Subtotal",
        exportHeader: "Subtotal",
        exportValue: (t) => moneyExport(t.quote?.subtotal),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      id: "quoteTotal",
      header: "Valor",
      accessorFn: (t) => money(t.quote?.total),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        // The route already admits only money sectors, but the gate belongs on the column: it is
        // what keeps the value out of the column picker and out of the XLSX/PDF export.
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (t) => moneyExport(t.quote?.total),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      // Collections progress at a glance: how many parcelas are settled out of how many exist,
      // across every customer config on the quote. Not server-sortable (it lives two relations
      // deep and would need the same in-memory pass `currentInstallmentDueDate` uses).
      id: "installments",
      header: "Parcelas",
      accessorFn: (t) => {
        const { total } = installmentProgress(t);
        return total;
      },
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        align: "center",
        headerLabel: "Parcelas",
        exportHeader: "Parcelas (pagas/total)",
        exportValue: (t) => {
          const { paid, total } = installmentProgress(t);
          return total > 0 ? `${paid}/${total}` : "";
        },
      },
      cell: ({ row }) => {
        const { paid, total } = installmentProgress(row.original);
        if (total === 0) return <MutedDash />;
        const settled = paid === total;
        return (
          <span
            className={`text-sm tabular-nums ${settled ? "font-medium text-primary" : paid > 0 ? "font-medium" : "text-muted-foreground"}`}
            title={`${paid} de ${total} parcela(s) paga(s)`}
          >
            {paid}/{total}
          </span>
        );
      },
    },
    {
      // Computed key: the due date lives two relations deep, so the API resolves it and sorts the
      // WHOLE result set in memory before paginating. Server mode is therefore mandatory here, and
      // this column deliberately stays out of the default sort (it forces a full scan).
      id: "currentInstallmentDueDate",
      header: "Vencimento",
      accessorFn: (t) => findFirstInstallmentDueDate(t),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        headerLabel: "Vencimento",
        exportHeader: "Vencimento",
        exportValue: (t) => dateExportValue(findFirstInstallmentDueDate(t)),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "billingApprovedAt",
      header: "Faturado em",
      accessorFn: (t) => t.quote?.billingApprovedAt ?? null,
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "Faturado em",
        exportHeader: "Faturado em",
        exportValue: (t) => dateExportValue(t.quote?.billingApprovedAt),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      // No "Status da Tarefa" column here on purpose: this list is scoped to finished tasks by
      // default (the `taskStatus` FILTER still exists to widen that), so the column would read
      // "Finalizado" on nearly every row. What the financial team actually needs at a glance is
      // HOW the quote gets paid.
      id: "paymentMethod",
      header: "Forma de Pagamento",
      accessorFn: (t) => paymentMethodLabels(t).join(", "),
      // Payment shape lives in a JSON column (`paymentConfig`) on the config, so there is no
      // scalar for the API to order by — hence no entry in BILLING_SORT_FIELD_MAP either.
      enableSorting: false,
      size: 180,
      minSize: 140,
      meta: {
        headerLabel: "Forma de Pagamento",
        exportHeader: "Forma de Pagamento",
        exportValue: (t) => paymentMethodLabels(t).join(", "),
      },
      cell: ({ row }) => <PaymentMethodCell task={row.original} />,
    },
    {
      id: "quoteStatus",
      header: "Status Faturamento",
      // Renders the status, sorts by its numeric `statusOrder` mirror.
      accessorFn: (t) => t.quote?.statusOrder ?? null,
      enableSorting: true,
      size: 190,
      minSize: 140,
      meta: {
        headerLabel: "Status Faturamento",
        exportHeader: "Status Faturamento",
        exportValue: (t) => (t.quote?.status ? (TASK_QUOTE_STATUS_LABELS[t.quote.status as TASK_QUOTE_STATUS] ?? t.quote.status) : ""),
      },
      cell: ({ row }) => {
        const status = row.original.quote?.status;
        if (!status) return <MutedDash />;
        return <QuoteStatusBadge status={status as TASK_QUOTE_STATUS} size="sm" />;
      },
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportHeader: "Criado em", exportValue: (t) => dateExportValue(t.createdAt) },
      cell: ({ row }) => renderDateCell(row.original.createdAt),
    },
  ];
}

/** column id → API `orderBy` entry. Ids absent here are not server-sortable. */
export const BILLING_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  budgetNumber: (d) => ({ quote: { budgetNumber: d } }),
  name: (d) => ({ name: d }),
  identificador: (d) => ({ serialNumber: { sort: d, nulls: "last" } }),
  // Sorts by what the cell RENDERS (`corporateName || fantasyName`). Ordering by `fantasyName`
  // while showing `corporateName` made the column read as unsorted on most rows.
  customer: (d) => ({ customer: { corporateName: { sort: d, nulls: "last" } } }),
  finishedAt: (d) => ({ finishedAt: d }),
  quoteSubtotal: (d) => ({ quote: { subtotal: d } }),
  quoteTotal: (d) => ({ quote: { total: d } }),
  // Whitelisted by the API as a computed key (`taskOrderByFieldsSchema`); nulls go last on its side.
  currentInstallmentDueDate: (d) => ({ currentInstallmentDueDate: d }),
  billingApprovedAt: (d) => ({ quote: { billingApprovedAt: { sort: d, nulls: "last" } } }),
  quoteStatus: (d) => ({ quote: { statusOrder: d } }),
  createdAt: (d) => ({ createdAt: d }),
};

/**
 * Default sort, stated twice on purpose — once as TanStack sorting state (the header arrows at
 * cold mount, when nothing is in the URL) and once as `buildBillingOrderBy([])`. They must agree.
 */
export const BILLING_DEFAULT_SORTING: { id: string; desc: boolean }[] = [
  { id: "quoteStatus", desc: false },
  { id: "finishedAt", desc: true },
];

export function buildBillingOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => BILLING_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return [{ quote: { statusOrder: "asc" } }, { finishedAt: "desc" }];
  return entries.length === 1 ? entries[0] : entries;
}
