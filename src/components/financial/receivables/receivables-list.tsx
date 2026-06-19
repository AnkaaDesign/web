import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconCash,
  IconCheck,
  IconCoins,
  IconProgressCheck,
  IconReceipt2,
} from "@tabler/icons-react";

import type { ReceivableRow, ReceivableState } from "../../../types";
import { routes } from "../../../constants";
import { useReceivables } from "@/hooks/financial/use-receivable";
import { MonthNav, monthKey, parseMonthKey } from "@/components/financial/reconciliation/month-nav";
import { formatCurrency, formatDate } from "../../../utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { FinancialKpiCard } from "../common/financial-kpi-card";

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
  RECEIVED: "completed", // green
};

// --- Summary cards double as clickable filter buckets (Contas a Pagar pattern). --
type ReceivableBucketKey = "AWAITING" | "PARTIAL" | "OVERDUE" | "RECEIVED";

const RECEIVABLE_BUCKETS: Record<
  ReceivableBucketKey,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string; state: ReceivableState }
> = {
  AWAITING: { label: "Aguardando Recebimento", Icon: IconProgressCheck, tone: "text-amber-600 bg-amber-500/10", state: "AWAITING_RECEIPT" },
  PARTIAL: { label: "Parcialmente Recebido", Icon: IconCoins, tone: "text-orange-600 bg-orange-500/10", state: "PARTIALLY_RECEIVED" },
  OVERDUE: { label: "Vencido", Icon: IconReceipt2, tone: "text-red-600 bg-red-500/10", state: "OVERDUE" },
  RECEIVED: { label: "Recebido no mês", Icon: IconCash, tone: "text-emerald-600 bg-emerald-500/10", state: "RECEIVED" },
};

const BUCKET_ORDER: ReceivableBucketKey[] = ["AWAITING", "PARTIAL", "OVERDUE", "RECEIVED"];
// Default view: every open/overdue receivable; received-this-month is opt-in.
const DEFAULT_BUCKETS: ReceivableBucketKey[] = ["AWAITING", "PARTIAL", "OVERDUE"];

const STATE_TO_BUCKET: Record<ReceivableState, ReceivableBucketKey> = {
  AWAITING_RECEIPT: "AWAITING",
  PARTIALLY_RECEIVED: "PARTIAL",
  OVERDUE: "OVERDUE",
  RECEIVED: "RECEIVED",
};

// Row ordering rank: open/overdue first, received-this-month last.
function receivableRank(state: ReceivableState): number {
  return state === "RECEIVED" ? 1 : 0;
}

const SEARCH_PARAM = "search";
const STATUS_PARAM = "status";
const MONTH_PARAM = "mes";

function parseBuckets(raw: string | null): ReceivableBucketKey[] {
  if (raw === null) return DEFAULT_BUCKETS;
  return raw.split(",").filter((s): s is ReceivableBucketKey => (BUCKET_ORDER as string[]).includes(s));
}

function ReceivableStateBadge({ state }: { state: ReceivableState }) {
  return (
    <Badge variant={RECEIVABLE_STATE_BADGE[state]} className="font-medium whitespace-nowrap">
      {RECEIVABLE_STATE_LABELS[state]}
    </Badge>
  );
}

interface ReceivablesListProps {
  className?: string;
}

export function ReceivablesList({ className }: ReceivablesListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL state: debounced search + active filter buckets ------------------
  const urlSearch = searchParams.get(SEARCH_PARAM) || "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [buckets, setBuckets] = useState<ReceivableBucketKey[]>(() => parseBuckets(searchParams.get(STATUS_PARAM)));
  // Competence month — same period switcher as the Extrato / Contas a Pagar.
  const [month, setMonth] = useState<Date>(() => parseMonthKey(searchParams.get(MONTH_PARAM)) ?? new Date());

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchText);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = params.get(SEARCH_PARAM) || "";
          if (current === searchText) return prev;
          if (searchText) {
            params.set(SEARCH_PARAM, searchText);
          } else {
            params.delete(SEARCH_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [searchText, setSearchParams]);

  // Keep the selected month shareable in the URL.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (params.get(MONTH_PARAM) === monthKey(month)) return prev;
        params.set(MONTH_PARAM, monthKey(month));
        return params;
      },
      { replace: true },
    );
  }, [month, setSearchParams]);

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
  const { data: response, isLoading, error } = useReceivables();
  const allRows = useMemo(() => response?.rows ?? [], [response?.rows]);

  // --- Period scope: keep only the rows that belong to the selected month ----
  // A received row's month is its paidAt; otherwise its due date. Undated rows
  // have no natural month — show them only in the CURRENT month so they aren't
  // double-counted into every period's KPI cards.
  const monthRows = useMemo(() => {
    const key = monthKey(month);
    const currentKey = monthKey(new Date());
    return allRows.filter((row) => {
      if (row.state === "RECEIVED") return row.paidAt ? monthKey(new Date(row.paidAt)) === key : false;
      if (row.dueDate) return monthKey(new Date(row.dueDate)) === key;
      return key === currentKey;
    });
  }, [allRows, month]);

  // Card value/count are computed over the month's rows (independent of the
  // active bucket/search filter) so the cards always show the month's totals.
  const monthBucketSummary = useMemo(() => {
    const out: Record<ReceivableBucketKey, { count: number; total: number }> = {
      AWAITING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      OVERDUE: { count: 0, total: 0 },
      RECEIVED: { count: 0, total: 0 },
    };
    for (const row of monthRows) {
      const bucket = STATE_TO_BUCKET[row.state];
      out[bucket].count += 1;
      // Open buckets show OUTSTANDING (amount − received); RECEIVED shows what
      // came in — matching the API summary (was summing gross amount).
      out[bucket].total += bucket === "RECEIVED" ? row.paidAmount : row.amount - row.paidAmount;
    }
    return out;
  }, [monthRows]);

  // --- Client-side filter: active buckets + search across cliente/description -
  const filteredRows = useMemo(() => {
    const active = new Set(buckets);
    const term = debouncedSearch.trim().toLowerCase();
    let base = monthRows.filter((row) => active.has(STATE_TO_BUCKET[row.state]));
    if (term) base = base.filter((row) => row.customerName.toLowerCase().includes(term) || row.description.toLowerCase().includes(term));
    return base;
  }, [monthRows, buckets, debouncedSearch]);

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

  // A reconciled receipt links to the bank transaction it was matched against,
  // where the operator can review / undo the reconciliation. Non-reconciled rows
  // have no meaningful detail target yet, so they stay informational (no nav to
  // an unrelated fiscal document — the previous behavior misrouted invoiceId into
  // the NF-detail route).
  const handleRowClick = (row: ReceivableRow) => {
    if (row.transactionId) {
      navigate(routes.financial.reconciliation.transactionDetail(row.transactionId));
    }
  };

  // --- Table columns (StandardizedTable — matches Contas a Pagar) -----------
  const columns: StandardizedColumn<ReceivableRow>[] = [
    {
      key: "description",
      header: "Descrição",
      className: "min-w-[16rem]",
      render: (row) => <TruncatedTextWithTooltip text={row.description || "-"} className="text-sm" />,
    },
    { key: "customer", header: "Cliente", className: "min-w-[12rem]", render: (row) => <TruncatedTextWithTooltip text={row.customerName || "-"} className="text-sm font-medium" /> },
    { key: "amount", header: "Valor", width: 128, align: "right", render: (row) => <span className="text-sm font-medium tabular-nums">{formatCurrency(row.amount)}</span> },
    {
      key: "paidAmount",
      header: "Recebido",
      width: 128,
      align: "right",
      render: (row) => (
        <span className={cn("text-sm tabular-nums", row.paidAmount > 0 ? "font-medium text-emerald-700" : "text-muted-foreground")}>
          {row.paidAmount > 0 ? formatCurrency(row.paidAmount) : "-"}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Vencimento",
      width: 144,
      render: (row) => {
        const dueDate = row.dueDate ? new Date(row.dueDate) : null;
        const overdue = row.state === "OVERDUE";
        return dueDate ? (
          <span className={cn("text-sm whitespace-nowrap", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            {formatDate(dueDate)}
            {overdue && " (vencido)"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    },
    { key: "status", header: "Status", width: 192, render: (row) => <ReceivableStateBadge state={row.state} /> },
    {
      key: "bankSlip",
      header: "Boleto",
      width: 92,
      align: "center",
      render: (row) =>
        row.hasBankSlip ? <IconCheck className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="text-sm text-muted-foreground">-</span>,
    },
    {
      key: "reconciled",
      header: "Conciliado",
      width: 110,
      align: "center",
      render: (row) =>
        row.reconciled ? <IconCheck className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="text-sm text-muted-foreground">-</span>,
    },
  ];

  // --- Render ---------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4 h-full min-h-0", className)}>
      {/* Summary cards double as filter buckets — click to show only that status. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 flex-shrink-0">
        {BUCKET_ORDER.map((key) => {
          const meta = RECEIVABLE_BUCKETS[key];
          const b = monthBucketSummary[key];
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

      {/* Search + period switcher + flat list */}
      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 min-h-0 flex flex-col p-4 space-y-4 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 min-w-0">
              <TableSearchInput
                value={searchText}
                onChange={(value) => setSearchText(value)}
                placeholder="Buscar por cliente ou descrição..."
                isPending={searchText !== debouncedSearch}
              />
            </div>
            <MonthNav month={month} onChange={setMonth} className="flex-shrink-0" />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <StandardizedTable<ReceivableRow>
              columns={columns}
              data={sortedRows}
              getItemKey={(row) => `${row.source}-${row.id}`}
              isLoading={isLoading}
              error={error}
              emptyMessage="Nenhuma conta a receber encontrada"
              emptyIcon={IconReceipt2}
              onRowClick={handleRowClick}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
