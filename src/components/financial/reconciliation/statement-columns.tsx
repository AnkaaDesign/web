/**
 * Leaf-row columns for the Extrato (bank statement) grouped DataTable. Mirrors
 * the columns/cells the old `transactions-by-date-accordion` rendered, so the
 * migration to the DataTable keeps the same information — now with resizable,
 * manageable columns. Day grouping is provided by the DataTable's group rows.
 */
import type { DataTableColumnDef } from "@/components/ui/datatable";
import { CategoryChips, MatchStatusBadge, getAccountingTypeLabel, STATUS_LABEL } from "./match-status-badge";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

const counterpartyText = (t: BankTransaction): string =>
  t.counterpartyName || (t.counterpartyCnpjCpf ? formatCnpjCpf(t.counterpartyCnpjCpf) : t.memo || "");

export const STATEMENT_COLUMNS: DataTableColumnDef<BankTransaction>[] = [
  {
    // Leftmost Data column — the day banner shows the date here; leaf cells stay blank (indent).
    id: "date",
    header: "Data",
    size: 132,
    enableSorting: false,
    meta: { align: "left", headerLabel: "Data", exportValue: (t) => (t.postedAt ? formatDate(new Date(t.postedAt)) : "") },
    cell: () => null,
  },
  {
    id: "subtype",
    header: "Forma",
    size: 96,
    accessorFn: (t) => t.subtype ?? "",
    meta: { align: "center", headerLabel: "Forma", exportValue: (t) => t.subtype ?? "" },
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.subtype}</span>,
  },
  {
    id: "credit",
    header: "Entrada",
    size: 140,
    accessorFn: (t) => (t.type === "CREDIT" ? Math.abs(Number(t.amount) || 0) : 0),
    meta: {
      align: "right",
      headerLabel: "Entrada",
      exportValue: (t) => (t.type === "CREDIT" ? Math.abs(Number(t.amount) || 0) : ""),
    },
    cell: ({ row }) =>
      row.original.type === "CREDIT" ? (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-400">
          {formatCurrency(Math.abs(Number(row.original.amount) || 0))}
        </span>
      ) : null,
  },
  {
    id: "debit",
    header: "Saída",
    size: 140,
    accessorFn: (t) => (t.type !== "CREDIT" ? Math.abs(Number(t.amount) || 0) : 0),
    meta: {
      align: "right",
      headerLabel: "Saída",
      exportValue: (t) => (t.type !== "CREDIT" ? Math.abs(Number(t.amount) || 0) : ""),
    },
    cell: ({ row }) =>
      row.original.type === "CREDIT" ? null : (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-red-700 dark:text-red-400">
          {formatCurrency(Math.abs(Number(row.original.amount) || 0))}
        </span>
      ),
  },
  {
    id: "counterparty",
    header: "Contraparte / Descrição",
    size: 422,
    accessorFn: counterpartyText,
    meta: { align: "left", headerLabel: "Contraparte", exportValue: counterpartyText },
    cell: ({ row }) => <span className="block truncate text-sm">{counterpartyText(row.original) || "—"}</span>,
  },
  {
    id: "category",
    header: "Categoria",
    size: 202,
    enableSorting: false,
    meta: {
      align: "left",
      headerLabel: "Categoria",
      exportValue: (t) => (t.categories ?? []).map((c) => c.category?.name).filter(Boolean).join(", "),
    },
    cell: ({ row }) => <CategoryChips categories={row.original.categories} maxVisible={2} />,
  },
  {
    id: "accountingGroup",
    header: "Grupo Contábil",
    size: 198,
    enableSorting: false,
    meta: {
      align: "left",
      headerLabel: "Grupo Contábil",
      exportValue: (t) =>
        Array.from(new Set((t.categories ?? []).map((c) => getAccountingTypeLabel(c.category)).filter(Boolean))).join(", "),
    },
    cell: ({ row }) => {
      const labels = Array.from(
        new Set(
          (row.original.categories ?? [])
            .map((tag) => getAccountingTypeLabel(tag.category))
            .filter((l): l is string => !!l),
        ),
      );
      if (labels.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          {labels.map((l) => (
            <span key={l} className="truncate text-xs text-muted-foreground" title={l}>
              {l}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: "reconciliationStatus",
    header: "Situação",
    size: 160,
    accessorFn: (t) => STATUS_LABEL[t.reconciliationStatus] ?? t.reconciliationStatus,
    meta: {
      // Right-aligned to match the saved layout — the Situação badge hugs the right edge.
      align: "right",
      headerLabel: "Situação",
      exportValue: (t) => STATUS_LABEL[t.reconciliationStatus] ?? t.reconciliationStatus,
    },
    cell: ({ row }) => (
      <MatchStatusBadge status={row.original.reconciliationStatus} topMatchScore={row.original.topMatchScore} />
    ),
  },
];
