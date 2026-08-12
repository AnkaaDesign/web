/**
 * Columns for the Contas a Pagar DataTable.
 *
 * Same information the old `StandardizedTable` rendered, now as a real column
 * set — so the page gets the column manager, per-column resizing, reordering,
 * alignment and export that the Conciliação tables already have. Unlike the
 * Extrato and the NF list this table is FLAT: no date grouping, so no
 * `isGroupRow`/`getSubRows` on the consumer side and every row goes through
 * these cells.
 *
 * `accessorFn` is what the toolbar search and the sort read, and `meta.exportValue`
 * is what lands in the XLSX/PDF — both are set explicitly on every column whose
 * `cell` renders JSX, otherwise a badge column would export as "[object Object]"
 * and sort by nothing.
 */
import { IconCopy } from "@tabler/icons-react";

import type { DataTableColumnDef } from "@/components/ui/datatable";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { cn } from "@/lib/utils";
import { formatCNPJ, formatCurrency, formatDate, formatPixKey } from "@/utils";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS } from "@/constants";
import type { PayableRow, PayableState } from "@/types";

// --- Per-row payment-state badge. EXPECTED (previstos/recorrentes) is a forecast,
// not a real debt yet. ---------------------------------------------------------
export const PAYABLE_STATE_LABELS: Record<PayableState, string> = {
  AWAITING_PAYMENT: "Aguardando Pagamento",
  OVERDUE: "Vencido",
  PARTIALLY_PAID: "Parcialmente Pago",
  EXPECTED: "Previsto",
  PAID: "Pago",
};

const PAYABLE_STATE_BADGE: Record<PayableState, BadgeProps["variant"]> = {
  AWAITING_PAYMENT: "pending", // amber — open obligation awaiting payment
  OVERDUE: "destructive", // red — past due
  PARTIALLY_PAID: "orange",
  EXPECTED: "gray", // gray — forecast/recurrent, not a real debt yet
  PAID: "completed", // green
};

/**
 * Plain label for the "Tipo" column. A one-off (`oneOff`) is stored as a
 * `frequency: ONCE` RecurrentPayable so it settles and reconciles through the
 * same pipeline — but it is not a recurring bill and must not read as one.
 */
export function typeLabel(row: PayableRow): string {
  switch (row.source) {
    case "AIRBRUSHING":
      return "Aerografia";
    case "TAX":
      return "Imposto";
    case "PAYROLL":
      return "Folha";
    case "PAYROLL_SCHEDULED":
      return row.subtype || "Folha programada";
    case "RECURRING":
    case "RECURRENT_PAYABLE":
      return row.oneOff ? "Avulsa" : "Recorrente";
    case "SCHEDULED":
    default:
      return "Pedidos";
  }
}

function PayableTypeBadge({ row }: { row: PayableRow }) {
  const label = typeLabel(row);
  const variant: BadgeProps["variant"] =
    row.source === "AIRBRUSHING"
      ? "purple"
      : row.source === "TAX"
        ? "orange"
        : row.source === "PAYROLL" || row.source === "PAYROLL_SCHEDULED"
          ? "indigo"
          : row.source === "RECURRING" || row.source === "RECURRENT_PAYABLE"
            ? // Avulsa is visually distinct from Recorrente — they behave differently
              // (one has a cadence, the other never repeats).
              (row.oneOff ? "teal" : "pink")
            : "blue";
  return (
    <Badge variant={variant} className="whitespace-nowrap text-[10px] leading-4">
      {label}
      {(row.source === "RECURRING" || row.source === "RECURRENT_PAYABLE") && !row.oneOff && row.subtype
        ? ` · ${row.subtype}`
        : ""}
    </Badge>
  );
}

// Mirrors the API's OVERDUE sweep: a due-today obligation only turns "vencido"
// 18h past SP-midnight, giving the day itself a chance to be paid first.
const OVERDUE_GRACE_MS = 18 * 60 * 60 * 1000;

export function isOverdueRow(row: PayableRow): boolean {
  // Already-paid rows are never "vencido" — only unpaid dues past their date are.
  if (row.paymentState === "PAID" || row.paymentState === "EXPECTED" || !row.dueDate) return false;
  return new Date(row.dueDate).getTime() + OVERDUE_GRACE_MS < Date.now();
}

/**
 * The status text shown, searched, sorted and exported. The conciliação
 * (clearance) axis stays hidden until the payables reconciliation workflow is
 * decided, so a PAID row is simply "Pago" regardless of `clearanceState`.
 */
export function paymentStatusText(row: PayableRow): string {
  if (row.ignored) return "Ignorado";
  return row.paymentState === "PAID" ? "Pago" : PAYABLE_STATE_LABELS[row.paymentState];
}

function PayablePaymentCell({ row }: { row: PayableRow }) {
  if (row.ignored) {
    return (
      <Badge
        variant="gray"
        className="font-medium whitespace-nowrap w-fit"
        title="Conta ignorada neste mês — não será paga e não entra nos totais."
      >
        Ignorado
      </Badge>
    );
  }
  if (row.paymentState === "PAID") {
    return (
      <Badge variant="completed" className="font-medium whitespace-nowrap w-fit">
        Pago
      </Badge>
    );
  }
  return (
    <Badge variant={PAYABLE_STATE_BADGE[row.paymentState]} className="font-medium whitespace-nowrap">
      {PAYABLE_STATE_LABELS[row.paymentState]}
    </Badge>
  );
}

// Map the raw payment-method enum (any casing) to its PT label, falling back to
// the raw value so an unknown method still shows something readable.
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "";
  return PAYMENT_METHOD_LABELS[method.toUpperCase() as PAYMENT_METHOD] ?? method;
}

/** Parcela label for boleto orders ("1ª parcela de 3"); empty for the rest. */
function installmentText(row: PayableRow): string {
  return row.source === "ORDER" && row.installmentId && row.subtype ? row.subtype : "";
}

function payeeText(row: PayableRow): string {
  return [row.payeeName, row.payeeCnpj ? formatCNPJ(row.payeeCnpj) : ""].filter(Boolean).join(" ");
}

interface PayableColumnsOptions {
  /** Click-to-copy handler for the Chave Pix cell (stops row-click propagation). */
  onCopy: (text: string, label: string) => (e: React.MouseEvent) => void;
}

export function buildPayableColumns({ onCopy }: PayableColumnsOptions): DataTableColumnDef<PayableRow>[] {
  return [
    {
      id: "description",
      header: "Descrição",
      size: 320,
      accessorFn: (row) => row.description ?? "",
      meta: { align: "left", headerLabel: "Descrição", exportValue: (row) => row.description ?? "" },
      cell: ({ row }) => {
        // PENDING orders (paymentRequested === false) are not yet a real debt —
        // they await an admin's "Requisitar Pagamento" and render muted/italic
        // like the EXPECTED/estimate forecasts.
        const r = row.original;
        const isPending = r.paymentRequested === false;
        const isForecast = r.paymentState === "EXPECTED" || r.isEstimate || isPending;
        return (
          <TruncatedTextWithTooltip
            text={r.description || "-"}
            className={cn(
              "text-sm",
              isForecast && "italic text-muted-foreground",
              r.ignored && "line-through text-muted-foreground",
            )}
          />
        );
      },
    },
    {
      id: "type",
      header: "Tipo",
      size: 176,
      accessorFn: typeLabel,
      meta: { align: "left", headerLabel: "Tipo", exportValue: typeLabel },
      cell: ({ row }) => <PayableTypeBadge row={row.original} />,
    },
    {
      id: "installment",
      header: "Parcela",
      size: 140,
      accessorFn: installmentText,
      meta: { align: "left", headerLabel: "Parcela", exportValue: installmentText, defaultVisible: false },
      cell: ({ row }) => {
        const text = installmentText(row.original);
        return text ? (
          <span className="text-sm whitespace-nowrap tabular-nums">{text}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "payee",
      header: "Tomador",
      size: 260,
      accessorFn: payeeText,
      meta: { align: "left", headerLabel: "Tomador", exportValue: payeeText },
      cell: ({ row }) => (
        <div className="flex items-baseline gap-2 min-w-0">
          <TruncatedTextWithTooltip text={row.original.payeeName || "-"} className="text-sm font-medium" />
          {row.original.payeeCnpj && (
            <span className="text-sm text-muted-foreground shrink-0">{formatCNPJ(row.original.payeeCnpj)}</span>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Valor",
      size: 132,
      accessorFn: (row) => row.amount,
      meta: { align: "right", headerLabel: "Valor", exportValue: (row) => row.amount },
      cell: ({ row }) => <span className="text-sm font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>,
    },
    {
      id: "payment",
      header: "Pagamento",
      size: 200,
      accessorFn: paymentStatusText,
      meta: { align: "left", headerLabel: "Pagamento", exportValue: paymentStatusText },
      cell: ({ row }) => <PayablePaymentCell row={row.original} />,
    },
    {
      id: "dueDate",
      header: "Vencimento",
      size: 144,
      // Sort on the instant, not on the formatted string — "01/09" must not sort
      // before "31/08".
      accessorFn: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : Number.POSITIVE_INFINITY),
      meta: {
        align: "left",
        headerLabel: "Vencimento",
        exportValue: (row) => (row.dueDate ? formatDate(new Date(row.dueDate)) : ""),
      },
      cell: ({ row }) => {
        const dueDate = row.original.dueDate ? new Date(row.original.dueDate) : null;
        const overdue = isOverdueRow(row.original);
        return dueDate ? (
          <span className={cn("text-sm whitespace-nowrap", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
            {formatDate(dueDate)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "method",
      header: "Forma",
      size: 144,
      accessorFn: (row) => formatPaymentMethod(row.method),
      meta: { align: "left", headerLabel: "Forma", exportValue: (row) => formatPaymentMethod(row.method) },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatPaymentMethod(row.original.method) || "-"}</span>
      ),
    },
    {
      // PIX key (orders paying via PIX) — click-to-copy. Only shown once the
      // payment has been requested (AWAITING_PAYMENT onward): a PENDING order
      // isn't a payable debt yet, so its Pix key stays hidden until an admin
      // runs "Requisitar Pagamento".
      id: "pixKey",
      header: "Chave Pix",
      size: 200,
      enableSorting: false,
      accessorFn: (row) => (row.pixKey && row.paymentRequested !== false ? row.pixKey : ""),
      meta: {
        align: "left",
        headerLabel: "Chave Pix",
        exportValue: (row) => (row.pixKey && row.paymentRequested !== false ? formatPixKey(row.pixKey) : ""),
      },
      cell: ({ row }) =>
        row.original.pixKey && row.original.paymentRequested !== false ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 max-w-full text-muted-foreground hover:text-foreground"
            onClick={onCopy(row.original.pixKey, "Chave Pix copiada!")}
            title="Copiar chave Pix"
          >
            <IconCopy className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span className="text-sm truncate">{formatPixKey(row.original.pixKey)}</span>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      // Off by default — useful when reviewing a month's competences, noise otherwise.
      id: "competence",
      header: "Competência",
      size: 132,
      accessorFn: (row) => row.competence ?? "",
      meta: {
        align: "left",
        headerLabel: "Competência",
        exportValue: (row) => row.competence ?? "",
        defaultVisible: false,
      },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">{row.original.competence || "-"}</span>
      ),
    },
    {
      id: "paidAt",
      header: "Pago em",
      size: 132,
      accessorFn: (row) => (row.paidAt ? new Date(row.paidAt).getTime() : 0),
      meta: {
        align: "left",
        headerLabel: "Pago em",
        exportValue: (row) => (row.paidAt ? formatDate(new Date(row.paidAt)) : ""),
        defaultVisible: false,
      },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.paidAt ? formatDate(new Date(row.original.paidAt)) : "-"}
        </span>
      ),
    },
    // NOTE: the "Conciliado" (clearance axis) column stays out for now — the
    // payables reconciliation workflow is still being decided. `clearanceState`
    // is still carried on the row, so the column can be added here when it lands.
  ];
}
