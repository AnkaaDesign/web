/**
 * Leaf-row columns for the Notas Fiscais (fiscal documents) grouped DataTable.
 * Mirrors the columns/cells the old `fiscal-documents-by-date-accordion`
 * rendered, now with resizable, manageable columns. Day grouping is provided by
 * the DataTable's group rows.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import { isLinked } from "./fiscal-documents-by-date-accordion";
import { routes } from "@/constants";
import { formatCNPJ, formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type { FiscalDocument } from "@/types/reconciliation";
import { OFF_BANK_RESOLUTION_LABELS } from "@/types/reconciliation";
import { docTypeLabel, docTypeVariant } from "./fiscal-doc-badge";

/**
 * Money direction of a fiscal note in the conciliação workflow. The green/red
 * Entrada/Saída coloring here tracks the CASH flow, not the fiscal goods flow:
 *  - a note WE EMITTED (operationType "SAIDA" — a sale) brings money IN → Entrada
 *  - a note issued AGAINST our CNPJ (operationType "ENTRADA" — a purchase) sends
 *    money OUT → Saída
 * i.e. it's the inverse of the fiscal `operationType` (mercadoria entra/sai).
 */
export const isMoneyIn = (d: FiscalDocument): boolean => d.operationType === "SAIDA";

const STATUS_LABEL = (status: string): string =>
  status === "AUTHORIZED"
    ? "Autorizada"
    : status === "CANCELLED"
      ? "Cancelada"
      : status === "DENIED"
        ? "Denegada"
        : status === "PENDING"
          ? "Pendente"
          : status;

const emitterText = (d: FiscalDocument): string => d.emitName || (d.emitCnpj ? formatCNPJ(d.emitCnpj) : "");
const destText = (d: FiscalDocument): string =>
  d.destName || (d.destCnpj ? formatCNPJ(d.destCnpj) : d.destCpf ? formatCnpjCpf(d.destCpf) : "");

// Search blobs — include the razão social AND the CNPJ (raw digits + formatted) so both are matched
// by the toolbar search input, regardless of which the operator types.
const emitterSearch = (d: FiscalDocument): string =>
  [d.emitName, d.emitCnpj, d.emitCnpj ? formatCNPJ(d.emitCnpj) : ""].filter(Boolean).join(" ");
const destSearch = (d: FiscalDocument): string =>
  [d.destName, d.destCnpj, d.destCnpj ? formatCNPJ(d.destCnpj) : "", d.destCpf].filter(Boolean).join(" ");

export const FISCAL_DOCUMENT_COLUMNS: DataTableColumnDef<FiscalDocument>[] = [
  {
    // Leftmost Data column — the day banner shows the date here; leaf cells stay blank (indent).
    id: "date",
    header: "Data",
    size: 132,
    enableSorting: false,
    meta: { align: "left", headerLabel: "Data", exportValue: (d) => (d.issueDate ? formatDate(new Date(d.issueDate)) : "") },
    cell: () => null,
  },
  {
    id: "docType",
    header: "Tipo",
    size: 96,
    accessorFn: (d) => docTypeLabel(d.docType),
    meta: { align: "center", headerLabel: "Tipo", exportValue: (d) => docTypeLabel(d.docType) },
    cell: ({ row }) => (
      <Badge size="sm" variant={docTypeVariant(row.original.docType)}>
        {docTypeLabel(row.original.docType)}
      </Badge>
    ),
  },
  {
    id: "operationType",
    header: "Operação",
    size: 110,
    accessorFn: (d) => (isMoneyIn(d) ? "Entrada" : "Saída"),
    meta: { align: "center", headerLabel: "Operação", exportValue: (d) => (isMoneyIn(d) ? "Entrada" : "Saída") },
    cell: ({ row }) => (
      <Badge size="sm" variant={isMoneyIn(row.original) ? "completed" : "cancelled"}>
        {isMoneyIn(row.original) ? "Entrada" : "Saída"}
      </Badge>
    ),
  },
  {
    id: "emitter",
    header: "Emitente",
    size: 349,
    accessorFn: emitterSearch,
    meta: { align: "left", headerLabel: "Emitente", exportValue: emitterText },
    cell: ({ row }) => {
      const d = row.original;
      const title = d.emitName
        ? `${d.emitName}${d.emitCnpj ? ` (${formatCNPJ(d.emitCnpj)})` : ""}`
        : d.emitCnpj
          ? formatCNPJ(d.emitCnpj)
          : undefined;
      return (
        <span className="block truncate text-sm" title={title}>
          {emitterText(d) || "—"}
        </span>
      );
    },
  },
  {
    id: "destinatario",
    header: "Destinatário",
    size: 268,
    accessorFn: destSearch,
    meta: { align: "left", headerLabel: "Destinatário", exportValue: destText },
    cell: ({ row }) => <span className="block truncate text-sm">{destText(row.original) || "—"}</span>,
  },
  {
    id: "entrada",
    header: "Entrada",
    size: 140,
    accessorFn: (d) => (isMoneyIn(d) ? d.totalValue : 0),
    meta: { align: "right", headerLabel: "Entrada", exportValue: (d) => (isMoneyIn(d) ? d.totalValue : "") },
    cell: ({ row }) =>
      isMoneyIn(row.original) ? (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-400">
          {formatCurrency(row.original.totalValue)}
        </span>
      ) : null,
  },
  {
    id: "saida",
    header: "Saída",
    size: 110,
    accessorFn: (d) => (!isMoneyIn(d) ? d.totalValue : 0),
    meta: { align: "right", headerLabel: "Saída", exportValue: (d) => (!isMoneyIn(d) ? d.totalValue : "") },
    cell: ({ row }) =>
      isMoneyIn(row.original) ? null : (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-red-700 dark:text-red-400">
          {formatCurrency(row.original.totalValue)}
        </span>
      ),
  },
  {
    id: "status",
    header: "Status",
    size: 120,
    accessorFn: (d) => STATUS_LABEL(d.status),
    meta: { align: "right", headerLabel: "Status", exportValue: (d) => STATUS_LABEL(d.status) },
    cell: ({ row }) => (
      <Badge size="sm" variant={row.original.status === "AUTHORIZED" ? "completed" : "cancelled"}>
        {STATUS_LABEL(row.original.status)}
      </Badge>
    ),
  },
  {
    id: "linked",
    header: "Situação",
    size: 160,
    enableSorting: false,
    accessorFn: (d) => (isLinked(d) ? "Conciliada" : "Pendente"),
    meta: { align: "right", headerLabel: "Situação", exportValue: (d) => (isLinked(d) ? "Conciliada" : "Pendente") },
    cell: ({ row }) => {
      const d = row.original;
      // Not conciliated → a "Pendente" badge, matching the Extrato Situação chrome (variant="pending").
      if (!isLinked(d)) {
        return (
          <Badge variant="pending" className="whitespace-nowrap">
            Pendente
          </Badge>
        );
      }
      // Conciliated. Same Badge chrome as the Extrato Situação column (variant="completed"); SAIDA notes
      // link to the faturamento/orçamento they came from; off-bank shows how it settled; ENTRADA (bank
      // match) links to the single matched transaction when there is one. The title carries the detail.
      const conciliada = (title?: string) => (
        <Badge variant="completed" className="whitespace-nowrap" title={title}>
          Conciliada
        </Badge>
      );
      if (d.operationType === "SAIDA") {
        const invoiceId = d.nfseDocument?.invoiceId ?? null;
        const taskId = d.nfseDocument?.taskId ?? null;
        const to = invoiceId
          ? routes.financial.billing.details(invoiceId)
          : taskId
            ? routes.financial.budget.details(taskId)
            : null;
        const badge = conciliada(invoiceId ? "Faturamento vinculado" : "Orçamento vinculado");
        return to ? (
          <Link to={to} onClick={(e) => e.stopPropagation()} className="hover:opacity-80 transition-opacity">
            {badge}
          </Link>
        ) : (
          badge
        );
      }
      if (d.offBankResolvedAt && d.offBankResolution) {
        return conciliada(OFF_BANK_RESOLUTION_LABELS[d.offBankResolution]);
      }
      const matches = d.matches ?? [];
      const onlyTxId = matches.length === 1 ? matches[0].transaction?.id : null;
      const badge = conciliada(`${matches.length} ${matches.length === 1 ? "transação vinculada" : "transações vinculadas"}`);
      return onlyTxId ? (
        <Link
          to={routes.financial.reconciliation.transactionDetail(onlyTxId)}
          onClick={(e) => e.stopPropagation()}
          className="hover:opacity-80 transition-opacity"
        >
          {badge}
        </Link>
      ) : (
        badge
      );
    },
  },
];
