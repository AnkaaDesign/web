import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Task } from "@/types";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, getBadgeVariant } from "@/constants";
import type { TASK_STATUS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import { formatCurrency } from "@/utils";
import {
  InvoiceToCustomersCell,
  MutedDash,
  OrderNumbersCell,
  dateExportValue,
  invoiceToCustomerNames,
  quoteOrderNumbers,
  renderDateCell,
  taskCustomerName,
  taskIdentifier,
} from "@/components/financial/shared/quote-table-shared";

/**
 * Columns for the Orçamentos list.
 *
 * Column ids are deliberately dot-free — they become the `--col-<id>-size` CSS custom property
 * and the persistence key, so a nested sort target lives in BUDGET_SORT_FIELD_MAP instead of the
 * id (the legacy table used `quote.statusOrder` as the key, which the new engine cannot).
 *
 * Everything the legacy table showed stays visible by default; the columns added on top are
 * `defaultVisible: false` and reachable from "Colunas", so nobody's view changes without them
 * asking for it.
 */
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

export function createBudgetColumns(): DataTableColumnDef<Task>[] {
  return [
    {
      // The number people quote at each other on the phone — the fastest way to find a budget.
      id: "budgetNumber",
      header: "Nº Orçamento",
      accessorFn: (t) => t.quote?.budgetNumber ?? null,
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: {
        align: "right",
        headerLabel: "Nº Orçamento",
        exportHeader: "Nº Orçamento",
        exportValue: (t) => t.quote?.budgetNumber ?? "",
      },
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
      size: 240,
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
      // The task's OWN customer — who the work is for. Often the same as the invoice-to customer,
      // but not always, which is exactly why both are available.
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
      header: "Clientes",
      // No scalar to order by (it lives across quote → customerConfigs → customer), so this column
      // is display + export only, exactly as in the table it replaces.
      enableSorting: false,
      size: 320,
      minSize: 180,
      meta: { headerLabel: "Clientes", exportHeader: "Clientes", exportValue: (t) => invoiceToCustomerNames(t) },
      cell: ({ row }) => <InvoiceToCustomersCell task={row.original} />,
    },
    {
      // The field `task-quote.ibipora-missing-order-number` is about. Off by default here because
      // the pedido is a faturamento concern; Faturamento shows it by default.
      id: "orderNumber",
      header: "N° do Pedido",
      accessorFn: (t) => quoteOrderNumbers(t).join(", "),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "N° do Pedido",
        exportHeader: "N° do Pedido",
        exportValue: (t) => quoteOrderNumbers(t),
      },
      cell: ({ row }) => <OrderNumbersCell task={row.original} />,
    },
    {
      id: "forecastDate",
      header: "Previsão",
      accessorKey: "forecastDate",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Previsão", exportHeader: "Previsão", exportValue: (t) => dateExportValue(t.forecastDate) },
      cell: ({ row }) => renderDateCell(row.original.forecastDate),
    },
    {
      id: "term",
      header: "Prazo",
      accessorKey: "term",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Prazo", exportHeader: "Prazo", exportValue: (t) => dateExportValue(t.term) },
      cell: ({ row }) => renderDateCell(row.original.term),
    },
    {
      // The date the proposal stops being valid — the thing an Orçamento list is actually racing.
      // A rule used to blink off this field; it was removed for matching 147 rows, 74 of them
      // expired by more than 90 days. Reading the column is how you see this now.
      id: "expiresAt",
      header: "Validade",
      accessorFn: (t) => t.quote?.expiresAt ?? null,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Validade", exportHeader: "Validade", exportValue: (t) => dateExportValue(t.quote?.expiresAt) },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "entryDate",
      header: "Entrada",
      accessorKey: "entryDate",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { defaultVisible: false, headerLabel: "Entrada", exportHeader: "Entrada", exportValue: (t) => dateExportValue(t.entryDate) },
      cell: ({ row }) => renderDateCell(row.original.entryDate),
    },
    {
      id: "taskStatus",
      header: "Status da Tarefa",
      // Renders the status, sorts by its numeric `statusOrder` mirror.
      accessorFn: (t) => t.statusOrder ?? null,
      enableSorting: true,
      size: 170,
      minSize: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Status da Tarefa",
        exportHeader: "Status da Tarefa",
        exportValue: (t) => (t.status ? (TASK_STATUS_LABELS[t.status as TASK_STATUS] ?? t.status) : ""),
      },
      cell: ({ row }) => {
        const status = row.original.status;
        if (!status) return <MutedDash />;
        return <Badge variant={getBadgeVariant(status, "TASK")}>{TASK_STATUS_LABELS[status as TASK_STATUS] ?? status}</Badge>;
      },
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
      // Coerce defensively: the API maps Decimal → number, but a raw string must not break the cell.
      accessorFn: (t) => money(t.quote?.total),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        // The page itself is already money-gated, but the gate must live on the COLUMN too: it is
        // what keeps the value out of the column picker and out of the XLSX/PDF export.
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (t) => moneyExport(t.quote?.total),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      id: "guaranteeYears",
      header: "Garantia",
      accessorFn: (t) => t.quote?.guaranteeYears ?? null,
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        defaultVisible: false,
        align: "center",
        headerLabel: "Garantia",
        exportHeader: "Garantia (anos)",
        exportValue: (t) => t.quote?.guaranteeYears ?? "",
      },
      cell: ({ getValue }) => {
        const y = getValue() as number | null;
        return y ? <span className="text-sm tabular-nums">{y === 1 ? "1 ano" : `${y} anos`}</span> : <MutedDash />;
      },
    },
    {
      id: "quoteStatus",
      header: "Status",
      // Renders the status, sorts by its numeric `statusOrder` mirror (see BUDGET_SORT_FIELD_MAP).
      accessorFn: (t) => t.quote?.statusOrder ?? null,
      enableSorting: true,
      size: 170,
      minSize: 130,
      meta: {
        headerLabel: "Status",
        exportHeader: "Status",
        exportValue: (t) => QUOTE_STATUS_EXPORT[t.quote?.status as TASK_QUOTE_STATUS] ?? "",
      },
      cell: ({ row }) => {
        const status = row.original.quote?.status;
        // The list is scoped to PENDING/BUDGET_APPROVED; anything else means the quote moved on
        // between fetch and render, and a billing-stage badge here would be misleading.
        if (status !== "PENDING" && status !== "BUDGET_APPROVED") return <MutedDash />;
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

/** Plain-text status labels for exports (the cell renders a badge). */
const QUOTE_STATUS_EXPORT: Partial<Record<TASK_QUOTE_STATUS, string>> = {
  PENDING: "Pendente",
  BUDGET_APPROVED: "Orçamento Aprovado",
} as Partial<Record<TASK_QUOTE_STATUS, string>>;

/** column id → API `orderBy` entry. Ids absent here are not server-sortable. */
export const BUDGET_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  budgetNumber: (d) => ({ quote: { budgetNumber: d } }),
  name: (d) => ({ name: d }),
  // Computed column: only the serial is a scalar the API can order by, so plate-only rows sort last.
  identificador: (d) => ({ serialNumber: { sort: d, nulls: "last" } }),
  // Sorts by what the cell RENDERS (`corporateName || fantasyName`). Ordering by `fantasyName`
  // while showing `corporateName` made the column read as unsorted — 275 of 325 rows differ.
  customer: (d) => ({ customer: { corporateName: { sort: d, nulls: "last" } } }),
  forecastDate: (d) => ({ forecastDate: { sort: d, nulls: "last" } }),
  term: (d) => ({ term: d }),
  expiresAt: (d) => ({ quote: { expiresAt: d } }),
  entryDate: (d) => ({ entryDate: d }),
  taskStatus: (d) => ({ statusOrder: d }),
  quoteSubtotal: (d) => ({ quote: { subtotal: d } }),
  quoteTotal: (d) => ({ quote: { total: d } }),
  quoteStatus: (d) => ({ quote: { statusOrder: d } }),
  createdAt: (d) => ({ createdAt: d }),
};

/**
 * Default sort, expressed twice on purpose: once as TanStack sorting state (so the header arrows
 * are right at cold mount, where nothing is written to the URL) and once as the `orderBy` fallback
 * in `buildBudgetOrderBy([])`. They must stay identical or the arrows describe a different order
 * than the one the server applied.
 */
export const BUDGET_DEFAULT_SORTING: { id: string; desc: boolean }[] = [
  { id: "quoteStatus", desc: false },
  { id: "term", desc: false },
];

export function buildBudgetOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => BUDGET_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return [{ quote: { statusOrder: "asc" } }, { term: "asc" }];
  return entries.length === 1 ? entries[0] : entries;
}
