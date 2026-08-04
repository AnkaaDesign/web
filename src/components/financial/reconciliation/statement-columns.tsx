/**
 * Leaf-row columns for the Extrato (bank statement) grouped DataTable. Mirrors
 * the columns/cells the old `transactions-by-date-accordion` rendered, so the
 * migration to the DataTable keeps the same information — now with resizable,
 * manageable columns. Day grouping is provided by the DataTable's group rows.
 */
import type { DataTableColumnDef } from "@/components/ui/datatable";
import {
  CategoryChips,
  MatchStatusBadge,
  getAccountingTypeLabel,
  settlementStatusText,
  type ReconciliationLinkage,
} from "./match-status-badge";
import { LinkedDocCell } from "./transaction-buckets";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

const counterpartyText = (t: BankTransaction): string =>
  t.counterpartyName || (t.counterpartyCnpjCpf ? formatCnpjCpf(t.counterpartyCnpjCpf) : t.memo || "");

/**
 * What a reconciled transaction is linked TO — NF, boleto, parcela, pedido,
 * conta recorrente, aerografia or folha.
 *
 * The API-derived `settlement.label` covers all seven anchors and is preferred;
 * the hand-rolled walk below only ran for three of them, which is why an
 * order-cleared supplier payment showed a green chip beside an EMPTY cell. It
 * stays as the fallback for payloads without a settlement.
 */
const linkedText = (t: BankTransaction): string => {
  if (t.settlement?.label) return t.settlement.label;
  const matches = (t.matches ?? []).filter((m) => !m.reversedAt);
  const doc = matches.find((m) => m.fiscalDocument)?.fiscalDocument;
  if (doc) return doc.emitName || (doc.emitCnpj ? formatCnpjCpf(doc.emitCnpj) : "NF");
  const slip = matches.find((m) => m.bankSlip)?.bankSlip;
  if (slip) return `Boleto ${slip.nossoNumero}`;
  const inst = matches.map((m) => m.installment ?? m.bankSlip?.installment).find(Boolean);
  if (inst) {
    const task = inst.invoice?.task;
    return (
      [task?.serialNumber, task?.name].filter(Boolean).join(" · ") ||
      inst.invoice?.customer?.fantasyName ||
      `Parcela ${inst.number}`
    );
  }
  return "";
};

/**
 * What backs a resolved transaction, derived from its live matches.
 *
 * Purely presentational — no new field is stored. RECONCILED is legitimately
 * reached two different ways (a linked document, or a resolving category such
 * as Tarifa Bancária that will never have a document), and rendering both as
 * the same green "Resolvido" chip is what allowed hundreds of unbacked rows to
 * accumulate without anyone noticing.
 */
const linkageOf = (t: BankTransaction): ReconciliationLinkage => {
  const matches = (t.matches ?? []).filter((m) => !m.reversedAt);
  if (matches.length === 0) return "NONE";
  return matches.some((m) => m.fiscalDocument || m.fiscalDocumentId)
    ? "FISCAL_DOCUMENT"
    : "SETTLEMENT_ANCHOR";
};

/** Name of the resolving category holding an unbacked row up, if any. */
const resolvedByLabelOf = (t: BankTransaction): string | null =>
  (t.categories ?? []).find((c) => c.category?.isResolving)?.category?.name ?? null;

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
    // What the transaction is conciliated against. The Extrato had no such
    // column, so an entrada matched to a parcela/tarefa looked identical to an
    // unmatched one at a glance.
    id: "vinculo",
    header: "Vínculo",
    size: 220,
    enableSorting: false,
    accessorFn: linkedText,
    meta: {
      headerLabel: "Vínculo",
      // Mandatory for an accessorFn-only column: this is what the toolbar
      // search matches on and what lands in the XLSX/PDF export.
      exportValue: linkedText,
    },
    cell: ({ row }) => <LinkedDocCell tx={row.original} />,
  },
  {
    id: "reconciliationStatus",
    header: "Situação",
    size: 160,
    // Sort/search/export read the SAME text the badge renders — otherwise an
    // exported statement would still call an "Aguardando nota" row "Resolvido".
    accessorFn: (t) => settlementStatusText(t.reconciliationStatus, t.settlement),
    meta: {
      // Right-aligned to match the saved layout — the Situação badge hugs the right edge.
      align: "right",
      headerLabel: "Situação",
      exportValue: (t) => settlementStatusText(t.reconciliationStatus, t.settlement),
    },
    cell: ({ row }) => (
      <MatchStatusBadge
        status={row.original.reconciliationStatus}
        topMatchScore={row.original.topMatchScore}
        settlement={row.original.settlement}
        // Fallback path only — `settlement` wins when present.
        linkage={linkageOf(row.original)}
        resolvedByLabel={resolvedByLabelOf(row.original)}
      />
    ),
  },
];
