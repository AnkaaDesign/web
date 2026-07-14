import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconCash,
  IconCheck,
  IconChecks,
  IconCoins,
  IconProgressCheck,
  IconReceipt2,
} from "@tabler/icons-react";

import type { ClearanceState, ReceivableRow, ReceivableState } from "../../../types";
import { routes } from "../../../constants";
import { useReceivables } from "@/hooks/financial/use-receivable";
import { PeriodNav, currentPeriod, type Period } from "@/components/financial/reconciliation/period-nav";
import { formatCurrency, formatDate, formatInstallmentPaymentMethod } from "../../../utils";
import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { DataTable, type DataTableColumnDef } from "@/components/ui/datatable";
import { FinancialKpiCard } from "../common/financial-kpi-card";
import { buildDateGroups, pruneDateGroup, isDateGroup, GroupDateLabel, GroupProgressBar, type GroupedRow } from "@/components/financial/common/date-grouped-rows";

// --- Per-row receipt-state badge (the ENTRADA analog of payables). ------------
const RECEIVABLE_STATE_LABELS: Record<ReceivableState, string> = {
  AWAITING_RECEIPT: "Aguardando Recebimento",
  PARTIALLY_RECEIVED: "Parcialmente Recebido",
  OVERDUE: "Vencido",
  RECEIVED: "Recebido",
};

const RECEIVABLE_STATE_BADGE: Record<ReceivableState, BadgeProps["variant"]> = {
  AWAITING_RECEIPT: "pending", // amber — open receivable awaiting receipt
  PARTIALLY_RECEIVED: "orange",
  OVERDUE: "red",
  // Blue — distinct from "Conciliada" (green), which is one step further (matched against the bank statement).
  RECEIVED: "inProgress",
};

// --- Summary cards double as clickable filter buckets (Contas a Pagar pattern). --
// RECEIVED (Axis A — invoice status) splits into two cards along Axis B (bank
// truth): RECEIVED = paid but not yet matched to a statement line; CONCILIADO =
// paid AND matched. See isConciliada() below.
type ReceivableBucketKey = "AWAITING" | "PARTIAL" | "OVERDUE" | "RECEIVED" | "CONCILIADO";

const RECEIVABLE_BUCKETS: Record<
  ReceivableBucketKey,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  AWAITING: { label: "Aguardando Recebimento", Icon: IconProgressCheck, tone: "text-amber-600 bg-amber-500/10" },
  PARTIAL: { label: "Parcialmente Recebido", Icon: IconCoins, tone: "text-orange-600 bg-orange-500/10" },
  OVERDUE: { label: "Vencido", Icon: IconReceipt2, tone: "text-red-600 bg-red-500/10" },
  // Blue — matches the "Recebido" badge in the Situação column.
  RECEIVED: { label: "Recebido no período", Icon: IconCash, tone: "text-blue-600 bg-blue-500/10" },
  // Green — matches the "Conciliada" badge; one step further than RECEIVED.
  CONCILIADO: { label: "Conciliado no período", Icon: IconChecks, tone: "text-emerald-600 bg-emerald-500/10" },
};

const BUCKET_ORDER: ReceivableBucketKey[] = ["AWAITING", "PARTIAL", "OVERDUE", "RECEIVED", "CONCILIADO"];
// Default view: every open/overdue receivable; received/conciliado-this-period is opt-in.
const DEFAULT_BUCKETS: ReceivableBucketKey[] = ["AWAITING", "PARTIAL", "OVERDUE"];

// Day-grouping options — shared by buildDateGroups (initial grouping) and
// pruneDateGroup (search-narrowed regrouping) so the recomputed day totals /
// progress bar stay consistent. green = received on the day, red = still to receive.
const DAY_GROUP_OPTS = {
  // Bucket by the payment date when the parcela is paid; otherwise by its due date.
  getDate: (r: ReceivableRow) => r.paidAt ?? r.dueDate,
  getGreen: (r: ReceivableRow) => (r.state === "RECEIVED" ? r.amount : 0),
  getRed: (r: ReceivableRow) => (r.state === "RECEIVED" ? 0 : r.amount),
  getResolved: (r: ReceivableRow) => r.state === "RECEIVED",
  direction: "desc" as const,
};

// A RECEIVED row splits across two buckets depending on Axis B (bank match) —
// so this is a function of the row, not a static per-state lookup.
function bucketOf(row: ReceivableRow): ReceivableBucketKey {
  switch (row.state) {
    case "AWAITING_RECEIPT":
      return "AWAITING";
    case "PARTIALLY_RECEIVED":
      return "PARTIAL";
    case "OVERDUE":
      return "OVERDUE";
    case "RECEIVED":
      return isConciliada(row) ? "CONCILIADO" : "RECEIVED";
  }
}

// Row ordering rank: open/overdue first, received-this-period last.
function receivableRank(state: ReceivableState): number {
  return state === "RECEIVED" ? 1 : 0;
}

const STATUS_PARAM = "status";
const VALOR_MIN_PARAM = "valorMin";
const VALOR_MAX_PARAM = "valorMax";
const MONTHS_RE = /^(0[1-9]|1[0-2])$/;

// The card selection + chosen period persist across visits in localStorage so
// the user's view sticks (mirrors the Extrato / Notas Fiscais pages). A URL
// param still wins when present (shared/deep links); otherwise falls back to
// the stored value, then the defaults.
const BUCKETS_STORAGE_KEY = "financial-receivables:buckets";
const PERIOD_STORAGE_KEY = "financial-receivables:period";

function readStoredBuckets(): ReceivableBucketKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUCKETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is ReceivableBucketKey => (BUCKET_ORDER as string[]).includes(v));
  } catch {
    return null;
  }
}

function readStoredPeriod(): Period | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.year === "number" && Array.isArray(p.months)) {
      const months = p.months.map(String).filter((m: string) => MONTHS_RE.test(m));
      if (months.length) return { year: p.year, months };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStored(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private-mode — non-fatal */
  }
}

/** Parses the `?status=` CSV; `null` means "not present in the URL" (caller
 *  falls back to localStorage, then DEFAULT_BUCKETS) rather than defaulting here. */
function parseBuckets(raw: string | null): ReceivableBucketKey[] | null {
  if (raw === null) return null;
  return raw.split(",").filter((s): s is ReceivableBucketKey => (BUCKET_ORDER as string[]).includes(s));
}

/** Parse the year+months period from URL params (JSON or CSV months). */
function parsePeriodFromUrl(params: URLSearchParams): Period | null {
  const yearRaw = params.get("year");
  const monthsRaw = params.get("months");
  if (!yearRaw || !monthsRaw) return null;
  const year = parseInt(yearRaw, 10);
  if (!Number.isFinite(year)) return null;
  let months: string[] = [];
  try {
    const parsed = JSON.parse(monthsRaw);
    if (Array.isArray(parsed)) months = parsed.map(String);
  } catch {
    months = monthsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  months = months.filter((m) => MONTHS_RE.test(m));
  if (!months.length) return null;
  return { year, months };
}

/** Does `d` fall within the selected period (matching year + one of its months)? */
function dateInPeriod(d: Date, period: Period, monthsSet: Set<string>): boolean {
  return d.getFullYear() === period.year && monthsSet.has(String(d.getMonth() + 1).padStart(2, "0"));
}

// --- Axis B (conciliação / bank truth) — prefer the three-valued clearanceState,
// fall back to the legacy `reconciled` boolean for rows the API hasn't populated. -
function clearanceOf(row: ReceivableRow): ClearanceState {
  if (row.clearanceState) return row.clearanceState;
  return row.reconciled ? "CLEARED" : "UNCLEARED";
}

// A received parcela that has also been matched against the bank statement is
// "Conciliada" — the terminal state one step BEYOND "Recebido". The dedicated
// "Conciliado" column was folded into the Situação column as this extra state.
function isConciliada(row: ReceivableRow): boolean {
  return row.state === "RECEIVED" && clearanceOf(row) === "CLEARED";
}

/** The Situação label used by the badge, sorting and export (adds "Conciliada"). */
function receivableStatusLabel(row: ReceivableRow): string {
  return isConciliada(row) ? "Conciliada" : RECEIVABLE_STATE_LABELS[row.state];
}

// Situação cell — the receipt state, plus the extra "Conciliada" state (green,
// with a check) once a received parcela is matched against the bank.
function ReceivableStatusCell({ row }: { row: ReceivableRow }) {
  if (isConciliada(row)) {
    return (
      <Badge variant="completed" className="gap-1 font-medium whitespace-nowrap">
        <IconCheck className="h-3 w-3" />
        Conciliada
      </Badge>
    );
  }
  return (
    <Badge variant={RECEIVABLE_STATE_BADGE[row.state]} className="font-medium whitespace-nowrap">
      {RECEIVABLE_STATE_LABELS[row.state]}
    </Badge>
  );
}

// --- DataTable columns (column manage / resize / export come for free) ---------
const RECEIVABLE_COLUMNS: DataTableColumnDef<ReceivableRow>[] = [
  {
    // Leftmost Data column — the day banner shows the date here; leaf cells stay blank (indent).
    // The bucketing date is the payment date when paid, otherwise the due date (see groupedRows).
    id: "date",
    header: "Data",
    size: 132,
    enableSorting: false,
    meta: {
      align: "left",
      headerLabel: "Data",
      exportValue: (row) => {
        const d = row.paidAt ?? row.dueDate;
        return d ? formatDate(new Date(d)) : "";
      },
    },
    cell: () => null,
  },
  {
    id: "description",
    header: "Logomarca",
    size: 206,
    accessorFn: (row) => row.description,
    meta: { align: "left", headerLabel: "Logomarca", exportValue: (row) => row.description || "" },
    cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.description || "-"} className="text-sm" />,
  },
  {
    id: "customer",
    header: "Cliente",
    size: 284,
    accessorFn: (row) => row.customerName,
    meta: { align: "left", headerLabel: "Cliente", exportValue: (row) => row.customerName || "" },
    cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.customerName || "-"} className="text-sm font-medium" />,
  },
  {
    id: "installment",
    header: "Parcela",
    size: 93,
    accessorFn: (row) => row.number,
    meta: {
      align: "center",
      headerLabel: "Parcela",
      exportValue: (row) => `${row.number}/${row.totalInstallments || row.number}`,
    },
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {row.original.number}/{row.original.totalInstallments || row.original.number}
      </span>
    ),
  },
  {
    id: "dueDate",
    header: "Vencimento",
    size: 130,
    accessorFn: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : 0),
    meta: {
      align: "left",
      headerLabel: "Vencimento",
      exportValue: (row) => (row.dueDate ? formatDate(new Date(row.dueDate)) : ""),
    },
    cell: ({ row }) => {
      const dueDate = row.original.dueDate ? new Date(row.original.dueDate) : null;
      const overdue = row.original.state === "OVERDUE";
      // Overdue is already conveyed by the Situação badge — here we only tint the date
      // with the SAME red the Extrato/NF use for saídas (no "(vencido)" suffix).
      return dueDate ? (
        <span
          className={cn(
            "text-sm whitespace-nowrap",
            overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {formatDate(dueDate)}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      );
    },
  },
  {
    id: "amount",
    header: "Valor",
    size: 128,
    accessorFn: (row) => row.amount,
    meta: { align: "right", headerLabel: "Valor", exportValue: (row) => row.amount },
    cell: ({ row }) => <span className="text-sm font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>,
  },
  {
    id: "paidAt",
    header: "Pago em",
    size: 128,
    accessorFn: (row) => (row.paidAt ? new Date(row.paidAt).getTime() : 0),
    meta: {
      align: "left",
      headerLabel: "Pago em",
      exportValue: (row) => (row.paidAt ? formatDate(new Date(row.paidAt)) : ""),
    },
    cell: ({ row }) => {
      const paidAt = row.original.paidAt ? new Date(row.original.paidAt) : null;
      return paidAt ? (
        <span className="text-sm whitespace-nowrap text-emerald-700 dark:text-emerald-400">{formatDate(paidAt)}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      );
    },
  },
  {
    id: "paymentMethod",
    header: "Forma de Pagamento",
    size: 188,
    accessorFn: (row) => formatInstallmentPaymentMethod(row.paymentMethod) ?? (row.hasBankSlip ? "Boleto" : ""),
    meta: {
      align: "left",
      headerLabel: "Forma de Pagamento",
      exportValue: (row) => formatInstallmentPaymentMethod(row.paymentMethod) ?? (row.hasBankSlip ? "Boleto" : ""),
    },
    cell: ({ row }) => {
      const r = row.original;
      const paid = r.state === "RECEIVED" || r.paidAt != null;
      // Once paid, show the actual method; before that, the expected one — a
      // Sicredi boleto (hasBankSlip) is the planned method for open parcelas.
      const method = formatInstallmentPaymentMethod(r.paymentMethod) ?? (r.hasBankSlip ? "Boleto" : null);
      if (!method) return <span className="text-sm text-muted-foreground">-</span>;
      return (
        <span className={cn("text-sm whitespace-nowrap", paid ? "" : "italic text-muted-foreground")}>
          {method}
          {!paid && " (previsto)"}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Situação",
    size: 200,
    accessorFn: (row) => receivableStatusLabel(row),
    // Right-aligned to match the saved layout — the Situação badge hugs the right edge.
    meta: { align: "right", headerLabel: "Situação", exportValue: (row) => receivableStatusLabel(row) },
    cell: ({ row }) => <ReceivableStatusCell row={row.original} />,
  },
];

interface ReceivablesListProps {
  className?: string;
}

export function ReceivablesList({ className }: ReceivablesListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- State: active filter buckets + period + value range. URL wins when
  // present (shareable/deep link); otherwise falls back to localStorage, then
  // the defaults (mirrors the Extrato / Notas Fiscais pages). -----------------
  const [buckets, setBuckets] = useState<ReceivableBucketKey[]>(
    () => parseBuckets(searchParams.get(STATUS_PARAM)) ?? readStoredBuckets() ?? DEFAULT_BUCKETS,
  );
  const [period, setPeriod] = useState<Period>(
    () => parsePeriodFromUrl(searchParams) ?? readStoredPeriod() ?? currentPeriod(),
  );
  const [amountMin, setAmountMin] = useState<number | null>(() => {
    const raw = searchParams.get(VALOR_MIN_PARAM);
    return raw != null && raw !== "" ? Number(raw) : null;
  });
  const [amountMax, setAmountMax] = useState<number | null>(() => {
    const raw = searchParams.get(VALOR_MAX_PARAM);
    return raw != null && raw !== "" ? Number(raw) : null;
  });

  // Keep period + value range shareable in the URL.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("year", String(period.year));
        params.set("months", JSON.stringify(period.months));
        if (amountMin != null) params.set(VALOR_MIN_PARAM, String(amountMin));
        else params.delete(VALOR_MIN_PARAM);
        if (amountMax != null) params.set(VALOR_MAX_PARAM, String(amountMax));
        else params.delete(VALOR_MAX_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [period, amountMin, amountMax, setSearchParams]);

  // Persist the card selection + period so the chosen view sticks across visits.
  useEffect(() => {
    writeStored(BUCKETS_STORAGE_KEY, buckets);
  }, [buckets]);
  useEffect(() => {
    writeStored(PERIOD_STORAGE_KEY, period);
  }, [period]);

  // Toggle a summary card on/off and mirror the selection into the URL.
  const toggleBucket = (key: ReceivableBucketKey) => {
    setBuckets((prev) => {
      const next = prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key];
      setSearchParams(
        (p) => {
          const params = new URLSearchParams(p);
          if (next.length === DEFAULT_BUCKETS.length && DEFAULT_BUCKETS.every((b) => next.includes(b))) {
            params.delete(STATUS_PARAM);
          } else {
            params.set(STATUS_PARAM, next.join(","));
          }
          return params;
        },
        { replace: true },
      );
      return next;
    });
  };

  // --- Unified receivables endpoint (task-quotes + external operations + invoices) -
  const { data: response, isLoading } = useReceivables();
  const allRows = useMemo(() => response?.rows ?? [], [response?.rows]);

  // --- Period scope: keep only the rows that belong to the selected period ---
  // A received row's month is its paidAt; otherwise its due date. Undated rows
  // have no natural month — show them only when the CURRENT month is in the
  // selected period so they aren't double-counted into every period's cards.
  const periodRows = useMemo(() => {
    const monthsSet = new Set(period.months);
    const now = new Date();
    const currentInPeriod = dateInPeriod(now, period, monthsSet);
    return allRows.filter((row) => {
      if (row.state === "RECEIVED") return row.paidAt ? dateInPeriod(new Date(row.paidAt), period, monthsSet) : false;
      if (row.dueDate) return dateInPeriod(new Date(row.dueDate), period, monthsSet);
      return currentInPeriod;
    });
  }, [allRows, period]);

  // Card value/count are computed over the period's rows (independent of the
  // active bucket/value filter) so the cards always show the period's totals.
  const periodBucketSummary = useMemo(() => {
    const out: Record<ReceivableBucketKey, { count: number; total: number }> = {
      AWAITING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      OVERDUE: { count: 0, total: 0 },
      RECEIVED: { count: 0, total: 0 },
      CONCILIADO: { count: 0, total: 0 },
    };
    for (const row of periodRows) {
      const bucket = bucketOf(row);
      out[bucket].count += 1;
      // Open buckets show OUTSTANDING (amount − received); RECEIVED/CONCILIADO show what came in.
      out[bucket].total += bucket === "RECEIVED" || bucket === "CONCILIADO" ? row.paidAmount : row.amount - row.paidAmount;
    }
    return out;
  }, [periodRows]);

  // --- Client-side filter: active buckets + value range (search is owned by the
  // DataTable's toolbar). ----------------------------------------------------
  const filteredRows = useMemo(() => {
    const active = new Set(buckets);
    return periodRows.filter((row) => {
      if (!active.has(bucketOf(row))) return false;
      if (amountMin != null && row.amount < amountMin) return false;
      if (amountMax != null && row.amount > amountMax) return false;
      return true;
    });
  }, [periodRows, buckets, amountMin, amountMax]);

  // --- Flat ordering: open first, overdue first, then due, then cliente. -----
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const rankA = receivableRank(a.state);
      const rankB = receivableRank(b.state);
      if (rankA !== rankB) return rankA - rankB;
      const aOverdue = a.state === "OVERDUE";
      const bOverdue = b.state === "OVERDUE";
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const byCustomer = a.customerName.localeCompare(b.customerName, "pt-BR");
      if (byCustomer !== 0) return byCustomer;
      return a.description.localeCompare(b.description, "pt-BR");
    });
    return rows;
  }, [filteredRows]);

  // Group the flat rows into day banners (paidAt when paid, else vencimento),
  // newest-first — the same accordion grouping the Extrato / Notas Fiscais use.
  const groupedRows = useMemo(
    () => buildDateGroups(sortedRows, DAY_GROUP_OPTS),
    [sortedRows],
  );

  // A reconciled receipt links to the bank transaction it was matched against,
  // where the operator can review / undo the reconciliation. Non-reconciled rows
  // have no meaningful detail target yet, so they stay informational.
  const handleRowClick = (row: ReceivableRow) => {
    // Task-quote receivables open their faturamento (task-quote) detail page; only
    // fall back to the bank-transaction detail for non-task rows already conciliated.
    if (row.taskId) {
      navigate(routes.financial.billing.details(row.taskId));
    } else if (row.transactionId) {
      navigate(routes.financial.reconciliation.transactionDetail(row.transactionId));
    }
  };

  // Inline value-range + period stepper, rendered in the DataTable toolbar.
  const toolbarActions = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          type="currency"
          value={amountMin}
          onChange={(v) => setAmountMin(typeof v === "number" ? v : null)}
          placeholder="Mín"
          className="h-9 w-28"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="currency"
          value={amountMax}
          onChange={(v) => setAmountMax(typeof v === "number" ? v : null)}
          placeholder="Máx"
          className="h-9 w-28"
        />
      </div>
      <PeriodNav period={period} onChange={setPeriod} className="flex-shrink-0" />
    </div>
  );

  // --- Render ---------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4 h-full min-h-0", className)}>
      {/* Summary cards double as filter buckets — click to show only that status. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 flex-shrink-0">
        {BUCKET_ORDER.map((key) => {
          const meta = RECEIVABLE_BUCKETS[key];
          const b = periodBucketSummary[key];
          return (
            <FinancialKpiCard
              key={key}
              label={meta.label}
              value={isLoading ? null : formatCurrency(b.total)}
              count={b.count}
              Icon={meta.Icon}
              tone={meta.tone}
              active={buckets.includes(key)}
              onClick={() => toggleBucket(key)}
            />
          );
        })}
      </div>

      {/* Column-managed, resizable, sortable list — no pagination (shows all). */}
      <div className="flex-1 min-h-0">
        <DataTable<GroupedRow<ReceivableRow>>
          tableId="financial-receivables"
          data={groupedRows}
          columns={RECEIVABLE_COLUMNS as unknown as DataTableColumnDef<GroupedRow<ReceivableRow>>[]}
          getRowId={(row) => (isDateGroup(row) ? row.id : `${row.source}-${row.id}`)}
          isLoading={isLoading}
          enablePagination={false}
          enableSelection={false}
          enableRowPinning={false}
          enableShare={false}
          enableExpansion
          defaultExpanded
          getSubRows={(row) => (isDateGroup(row) ? row.children : undefined)}
          pruneSubRows={(row, kept) =>
            isDateGroup(row)
              ? pruneDateGroup(row, kept as ReceivableRow[], DAY_GROUP_OPTS)
              : row
          }
          isGroupRow={isDateGroup}
          renderGroupCell={(row, columnId, { isExpanded }) => {
            if (!isDateGroup(row)) return null;
            switch (columnId) {
              case "date":
                return <GroupDateLabel group={row} />;
              case "amount": {
                if (isExpanded) return null;
                // Cumulative for the day: received (green) + still-to-receive (red).
                const total = row.greenTotal + row.redTotal;
                if (total <= 0) return null;
                const fullyReceived = row.redTotal === 0 && row.greenTotal > 0;
                return (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      fullyReceived ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                    )}
                    title={fullyReceived ? "Recebido no dia" : "A receber no dia"}
                  >
                    {formatCurrency(total)}
                  </span>
                );
              }
              case "status":
                return <GroupProgressBar resolved={row.resolvedCount} count={row.count} />;
              default:
                return null;
            }
          }}
          searchPlaceholder="Buscar por logomarca ou cliente..."
          toolbarActions={toolbarActions}
          onRowClick={(row) => {
            if (!isDateGroup(row)) handleRowClick(row);
          }}
          emptyMessage="Nenhuma conta a receber encontrada"
          exportTitle="Contas a Receber"
          exportFilename="contas-a-receber"
          className="h-full"
        />
      </div>
    </div>
  );
}
