import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconReceipt2,
  IconRepeat,
  IconSpray,
  IconCash,
  IconProgressCheck,
  IconCoins,
  IconPackage,
  IconReceiptTax,
  IconUsers,
  IconGift,
  IconArrowRight,
  IconAlertTriangle,
} from "@tabler/icons-react";

import type { PayableRow, PayableState } from "../../../types";
import { routes, SECTOR_PRIVILEGES, AIRBRUSHING_PAYMENT_STATUS, PAYMENT_METHOD, PAYMENT_METHOD_LABELS } from "../../../constants";
import { useOrderPayables, useOrderMutations, useSettlePayrollMonth, useTriggerOrderSchedule } from "../../../hooks";
import { MonthNav, monthKey, parseMonthKey } from "@/components/financial/reconciliation/month-nav";
import { useAirbrushingMutations } from "../../../hooks/production/use-airbrushing";
import { usePrivileges } from "../../../hooks/common/use-privileges";
import { formatCurrency, formatDate } from "../../../utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { FinancialKpiCard } from "../common/financial-kpi-card";
import { PaymentAmountDialog } from "./payment-amount-dialog";
import { useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";

// --- Per-row payment-state badge. EXPECTED (previstos/recorrentes) is a forecast,
// not a real debt yet. ---------------------------------------------------------
const PAYABLE_STATE_LABELS: Record<PayableState, string> = {
  AWAITING_PAYMENT: "Aguardando Pagamento",
  OVERDUE: "Vencido",
  PARTIALLY_PAID: "Parcialmente Pago",
  EXPECTED: "Previsto/Recorrente",
  PAID: "Pago",
};

const PAYABLE_STATE_BADGE: Record<PayableState, BadgeProps["variant"]> = {
  AWAITING_PAYMENT: "pending", // amber — open obligation awaiting payment
  OVERDUE: "destructive", // red — past due
  PARTIALLY_PAID: "orange",
  EXPECTED: "outline", // muted — forecast/recurrent, not a real debt yet
  PAID: "completed", // green
};

// --- Summary cards double as clickable filter buckets (Conciliação pattern). ----
type PayableBucketKey = "AWAITING" | "OVERDUE" | "PARTIAL" | "EXPECTED" | "PAID";

const PAYABLE_BUCKETS: Record<
  PayableBucketKey,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string; states: PayableState[] }
> = {
  AWAITING: { label: "Aguardando Pagamento", Icon: IconProgressCheck, tone: "text-amber-600 bg-amber-500/10", states: ["AWAITING_PAYMENT"] },
  OVERDUE: { label: "Vencido", Icon: IconAlertTriangle, tone: "text-red-600 bg-red-500/10", states: ["OVERDUE"] },
  PARTIAL: { label: "Parcialmente Pago", Icon: IconCoins, tone: "text-orange-600 bg-orange-500/10", states: ["PARTIALLY_PAID"] },
  EXPECTED: { label: "Previsto/Recorrente", Icon: IconRepeat, tone: "text-neutral-500 bg-neutral-500/10", states: ["EXPECTED"] },
  PAID: { label: "Pago no mês", Icon: IconCash, tone: "text-emerald-600 bg-emerald-500/10", states: ["PAID"] },
};

const BUCKET_ORDER: PayableBucketKey[] = ["AWAITING", "OVERDUE", "PARTIAL", "EXPECTED", "PAID"];
// Default view: every open/overdue/forecast obligation; paid-this-month is opt-in (click the card).
const DEFAULT_BUCKETS: PayableBucketKey[] = ["AWAITING", "OVERDUE", "PARTIAL", "EXPECTED"];

const STATE_TO_BUCKET: Record<PayableState, PayableBucketKey> = {
  AWAITING_PAYMENT: "AWAITING",
  OVERDUE: "OVERDUE",
  PARTIALLY_PAID: "PARTIAL",
  EXPECTED: "EXPECTED",
  PAID: "PAID",
};

// Row ordering rank: overdue first, then open obligations, then paid-this-month, then forecasts.
function payableRank(state: PayableState): number {
  if (state === "EXPECTED") return 3;
  if (state === "PAID") return 2;
  if (state === "OVERDUE") return 0;
  return 1;
}

// Routes that the production schedule (cronograma) detail requires — ACCOUNTING
// is NOT among them, so an airbrushing row must not navigate there for finance users.
const PRODUCTION_VIEW_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.PRODUCTION,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.LOGISTIC,
  SECTOR_PRIVILEGES.PLOTTING,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.ADMIN,
];

// Financial-only: WAREHOUSE manages orders but never settles their payment side.
const PAYMENT_MANAGER_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
];

const SEARCH_PARAM = "search";
const STATUS_PARAM = "status";
const MONTH_PARAM = "mes";

function parseBuckets(raw: string | null): PayableBucketKey[] {
  if (raw === null) return DEFAULT_BUCKETS;
  return raw.split(",").filter((s): s is PayableBucketKey => (BUCKET_ORDER as string[]).includes(s));
}

function PayableStateBadge({ state }: { state: PayableState }) {
  return (
    <Badge variant={PAYABLE_STATE_BADGE[state]} className="font-medium whitespace-nowrap">
      {PAYABLE_STATE_LABELS[state]}
    </Badge>
  );
}

// Map the raw payment-method enum (any casing) to its PT label, falling back to
// the raw value so an unknown method still shows something readable.
function formatPaymentMethod(method: string | null): string {
  if (!method) return "-";
  return PAYMENT_METHOD_LABELS[method.toUpperCase() as PAYMENT_METHOD] ?? method;
}

function isOverdueRow(row: PayableRow): boolean {
  if (row.paymentState === "EXPECTED" || !row.dueDate) return false;
  return new Date(row.dueDate) < new Date();
}

function PayableTypeBadge({ row }: { row: PayableRow }) {
  switch (row.source) {
    case "AIRBRUSHING":
      return (
        <Badge variant="purple" className="whitespace-nowrap text-[10px]">
          <IconSpray className="mr-1 h-3 w-3" />
          Aerografia
        </Badge>
      );
    case "SCHEDULED":
      return (
        <Badge variant="cyan" className="whitespace-nowrap text-[10px]">
          <IconRepeat className="mr-1 h-3 w-3" />
          Pedido programado
        </Badge>
      );
    case "TAX":
      return (
        <Badge variant="orange" className="whitespace-nowrap text-[10px]">
          <IconReceiptTax className="mr-1 h-3 w-3" />
          Imposto
        </Badge>
      );
    case "PAYROLL":
      return (
        <Badge variant="indigo" className="whitespace-nowrap text-[10px]">
          <IconUsers className="mr-1 h-3 w-3" />
          Folha
        </Badge>
      );
    case "PAYROLL_SCHEDULED":
      return (
        <Badge variant="indigo" className="whitespace-nowrap text-[10px]">
          <IconGift className="mr-1 h-3 w-3" />
          {row.subtype || "Folha programada"}
        </Badge>
      );
    case "RECURRING":
    case "RECURRENT_PAYABLE":
      return (
        <Badge variant="teal" className="whitespace-nowrap text-[10px]">
          <IconRepeat className="mr-1 h-3 w-3" />
          Recorrente{row.subtype ? ` · ${row.subtype}` : ""}
        </Badge>
      );
    default:
      return (
        <Badge variant="blue" className="whitespace-nowrap text-[10px]">
          <IconPackage className="mr-1 h-3 w-3" />
          Pedido
        </Badge>
      );
  }
}

interface AccountsPayableListProps {
  className?: string;
}

export function AccountsPayableList({ className }: AccountsPayableListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasAnyPrivilegeAccess } = usePrivileges();

  const canManagePayments = hasAnyPrivilegeAccess(PAYMENT_MANAGER_PRIVILEGES);
  const canViewProduction = hasAnyPrivilegeAccess(PRODUCTION_VIEW_PRIVILEGES);

  // --- URL state: debounced search + active filter buckets ------------------
  const urlSearch = searchParams.get(SEARCH_PARAM) || "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [buckets, setBuckets] = useState<PayableBucketKey[]>(() => parseBuckets(searchParams.get(STATUS_PARAM)));
  // Competence month — same period switcher as the Extrato. Scopes the list (and
  // the summary cards) to obligations of the selected month.
  const [month, setMonth] = useState<Date>(() => parseMonthKey(searchParams.get(MONTH_PARAM)) ?? new Date());

  // Right-click payment menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: PayableRow } | null>(null);

  // VARIABLE recurrent bill awaiting its real paid amount (opens PaymentAmountDialog).
  const [payAmountRow, setPayAmountRow] = useState<PayableRow | null>(null);

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

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

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
  const toggleBucket = (key: PayableBucketKey) => {
    setBuckets((prev) => {
      const next = prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key];
      setSearchParams(
        (p) => {
          const params = new URLSearchParams(p);
          // Default set → drop the param; anything else (incl. empty) → persist it.
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

  // --- Unified payables endpoint (orders + airbrushing + scheduled) ---------
  const { data: response, isLoading, error, refetch } = useOrderPayables();
  const allRows = useMemo(() => response?.data?.rows ?? [], [response?.data?.rows]);

  // --- Period scope: keep only the rows that belong to the selected month ----
  // A row's month is its competence (payroll/tax/recurring), else its paidAt for
  // already-settled rows, else its due date. Undated, non-competence rows have no
  // natural month, so they stay visible across every period.
  const monthRows = useMemo(() => {
    const key = monthKey(month);
    return allRows.filter((row) => {
      if (row.competence) return row.competence === key;
      if (row.paymentState === "PAID") return row.paidAt ? monthKey(new Date(row.paidAt)) === key : false;
      if (row.dueDate) return monthKey(new Date(row.dueDate)) === key;
      return true;
    });
  }, [allRows, month]);

  // Card value/count are computed over the month's rows (independent of the
  // active bucket/search filter) so the cards always show the month's totals.
  const monthBucketSummary = useMemo(() => {
    const out: Record<PayableBucketKey, { count: number; total: number }> = {
      AWAITING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      EXPECTED: { count: 0, total: 0 },
      PAID: { count: 0, total: 0 },
    };
    for (const row of monthRows) {
      const bucket = STATE_TO_BUCKET[row.paymentState];
      out[bucket].count += 1;
      out[bucket].total += row.amount;
    }
    return out;
  }, [monthRows]);

  // Payment mutations. Order transitions auto-invalidate the payables query
  // (keyed under orderKeys.all); airbrushing settles via its own update, so we
  // refetch the list manually afterward.
  const { markAwaitingPaymentAsync, markPaidAsync, markInstallmentPaidAsync } = useOrderMutations();
  const { updateAsync: updateAirbrushingAsync } = useAirbrushingMutations();
  const settlePayrollMonth = useSettlePayrollMonth();
  const triggerSchedule = useTriggerOrderSchedule();
  // Recorrentes: pay one materialized occurrence (the payables query is keyed
  // under orderKeys.all, so the pay action invalidates it and the row flips).
  const { payAsync: payRecurrentAsync, payMutation: payRecurrentMutation } = useRecurrentPayableMutations();

  // --- Client-side filter: active buckets + search across tomador/description -
  const filteredRows = useMemo(() => {
    const active = new Set(buckets);
    const term = debouncedSearch.trim().toLowerCase();
    let base = monthRows.filter((row) => active.has(STATE_TO_BUCKET[row.paymentState]));
    if (term) base = base.filter((row) => row.payeeName.toLowerCase().includes(term) || row.description.toLowerCase().includes(term));
    return base;
  }, [monthRows, buckets, debouncedSearch]);

  // --- Flat ordering: real obligations first, overdue first, then due, then payee.
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const rankA = payableRank(a.paymentState);
      const rankB = payableRank(b.paymentState);
      if (rankA !== rankB) return rankA - rankB;
      const aOverdue = isOverdueRow(a);
      const bOverdue = isOverdueRow(b);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const byPayee = a.payeeName.localeCompare(b.payeeName, "pt-BR");
      if (byPayee !== 0) return byPayee;
      return a.description.localeCompare(b.description, "pt-BR");
    });
    return rows;
  }, [filteredRows]);

  const handleRowClick = (row: PayableRow) => {
    if (row.source === "ORDER") {
      navigate(routes.inventory.orders.details(row.id));
    } else if (row.source === "AIRBRUSHING" && row.taskId && canViewProduction) {
      navigate(routes.production.schedule.details(row.taskId));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, row: PayableRow) => {
    if (!canManagePayments) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, row });
  };

  // --- Payment actions (dispatch by source) ---------------------------------
  const runAction = async (fn: () => Promise<unknown>) => {
    setContextMenu(null);
    try {
      await fn();
    } catch {
      // Errors are toasted by the API client.
    }
  };

  const settleAirbrushing = (id: string, paymentStatus: AIRBRUSHING_PAYMENT_STATUS) => updateAirbrushingAsync({ id, data: { paymentStatus } }).then(() => refetch());

  // Mark a recurrent occurrence paid. VARIABLE bills (isEstimate) collect the
  // real value via PaymentAmountDialog; FIXED bills settle with the known value.
  const handleRecurrentPay = (row: PayableRow) => {
    setContextMenu(null);
    if (row.isEstimate) {
      setPayAmountRow(row);
      return;
    }
    runAction(() => payRecurrentAsync({ occurrenceId: row.id, body: {} }));
  };

  const parseCompetence = (c?: string | null): { year: number; month: number } | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(c ?? "");
    return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
  };

  // Settle dispatch for the non-order sources (folha, recorrentes, agendamentos).
  const handleSettle = (row: PayableRow) => {
    switch (row.settleVia) {
      case "PAYROLL_MONTH": {
        const c = parseCompetence(row.competence);
        if (c) runAction(() => settlePayrollMonth.mutateAsync({ year: c.year, month: c.month, amount: row.amount }).then(() => refetch()));
        break;
      }
      case "SCHEDULE_TRIGGER":
        runAction(() => triggerSchedule.mutateAsync({ id: row.id, cascadeMode: "GAP_ONLY" }).then(() => refetch()));
        break;
      case "RECONCILIATION":
        setContextMenu(null);
        navigate(routes.financial.reconciliation.statement);
        break;
      default:
        setContextMenu(null);
    }
  };

  const ctxRow = contextMenu?.row;

  // --- Table columns (StandardizedTable — matches Conciliação / Previsão) ----
  const columns: StandardizedColumn<PayableRow>[] = [
    {
      key: "description",
      header: "Descrição",
      className: "min-w-[16rem]",
      render: (row) => {
        const isForecast = row.paymentState === "EXPECTED" || row.isEstimate;
        return <TruncatedTextWithTooltip text={row.description || "-"} className={cn("text-sm", isForecast && "italic text-muted-foreground")} />;
      },
    },
    { key: "type", header: "Tipo", width: 176, render: (row) => <PayableTypeBadge row={row} /> },
    {
      key: "installment",
      header: "Parcela",
      width: 140,
      // Boleto parcela label e.g. "1ª parcela de 3"; "-" for single-payment rows.
      render: (row) =>
        row.source === "ORDER" && row.installmentId && row.subtype ? (
          <span className="text-sm whitespace-nowrap tabular-nums">{row.subtype}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    { key: "payee", header: "Tomador", className: "min-w-[12rem]", render: (row) => <TruncatedTextWithTooltip text={row.payeeName || "-"} className="text-sm font-medium" /> },
    { key: "amount", header: "Valor", width: 128, align: "right", render: (row) => <span className="text-sm font-medium tabular-nums">{formatCurrency(row.amount)}</span> },
    { key: "payment", header: "Pagamento", width: 192, render: (row) => <PayableStateBadge state={row.paymentState} /> },
    {
      key: "dueDate",
      header: "Vencimento",
      width: 144,
      render: (row) => {
        const dueDate = row.dueDate ? new Date(row.dueDate) : null;
        const overdue = isOverdueRow(row);
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
    { key: "method", header: "Forma", width: 144, render: (row) => <span className="text-sm text-muted-foreground">{formatPaymentMethod(row.method)}</span> },
  ];

  // --- Render ---------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4 h-full min-h-0", className)}>
      {/* Summary cards double as filter buckets — click to show only that status. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 flex-shrink-0">
        {BUCKET_ORDER.map((key) => {
          const meta = PAYABLE_BUCKETS[key];
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
                placeholder="Buscar por fornecedor, pintor ou descrição..."
                isPending={searchText !== debouncedSearch}
              />
            </div>
            <MonthNav month={month} onChange={setMonth} className="flex-shrink-0" />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <StandardizedTable<PayableRow>
              columns={columns}
              data={sortedRows}
              getItemKey={(row) => `${row.source}-${row.id}`}
              isLoading={isLoading}
              error={error}
              emptyMessage="Nenhuma conta a pagar encontrada"
              emptyIcon={IconReceipt2}
              onRowClick={handleRowClick}
              onContextMenu={handleContextMenu}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment context menu — dispatches by source. */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent position={contextMenu} isOpen={!!contextMenu} className="w-64 ![position:fixed]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {ctxRow && (
            <>
              <DropdownMenuLabel className="truncate">{ctxRow.payeeName}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {ctxRow.paymentState === "PAID" && (
                <>
                  <DropdownMenuItem disabled>
                    <IconCash className="mr-2 h-4 w-4" />
                    Pago{ctxRow.paidAt ? ` em ${formatDate(new Date(ctxRow.paidAt))}` : ""}
                  </DropdownMenuItem>
                  {ctxRow.source === "ORDER" && !ctxRow.installmentId && (
                    <DropdownMenuItem onClick={() => runAction(() => markAwaitingPaymentAsync(ctxRow.id))}>
                      <IconProgressCheck className="mr-2 h-4 w-4" />
                      Desfazer pagamento
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {ctxRow.source === "ORDER" && ctxRow.paymentState !== "PAID" && (
                ctxRow.installmentId ? (
                  // Boleto parcela — settle this single installment (or reconcile, below).
                  <DropdownMenuItem onClick={() => runAction(() => markInstallmentPaidAsync(ctxRow.installmentId!))}>
                    <IconCash className="mr-2 h-4 w-4" />
                    Marcar parcela como paga
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => runAction(() => markPaidAsync(ctxRow.id))}>
                    <IconCash className="mr-2 h-4 w-4" />
                    Marcar como pago
                  </DropdownMenuItem>
                )
              )}

              {ctxRow.source === "AIRBRUSHING" && ctxRow.paymentState !== "PAID" && (
                <>
                  {ctxRow.paymentState !== "PARTIALLY_PAID" && (
                    <DropdownMenuItem onClick={() => runAction(() => settleAirbrushing(ctxRow.id, AIRBRUSHING_PAYMENT_STATUS.PARTIALLY_PAID))}>
                      <IconProgressCheck className="mr-2 h-4 w-4" />
                      Marcar como parcialmente pago
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => runAction(() => settleAirbrushing(ctxRow.id, AIRBRUSHING_PAYMENT_STATUS.PAID))}>
                    <IconCash className="mr-2 h-4 w-4" />
                    Marcar como pago
                  </DropdownMenuItem>
                </>
              )}

              {ctxRow.source === "RECURRENT_PAYABLE" && ctxRow.paymentState !== "PAID" && (
                <DropdownMenuItem onClick={() => handleRecurrentPay(ctxRow)}>
                  <IconCash className="mr-2 h-4 w-4" />
                  Marcar como pago
                </DropdownMenuItem>
              )}

              {ctxRow.settleVia === "SCHEDULE_TRIGGER" && (
                <DropdownMenuItem onClick={() => handleSettle(ctxRow)}>
                  <IconPackage className="mr-2 h-4 w-4" />
                  Gerar pedido (materializar)
                </DropdownMenuItem>
              )}

              {ctxRow.settleVia === "PAYROLL_MONTH" && (
                <DropdownMenuItem onClick={() => handleSettle(ctxRow)}>
                  <IconCash className="mr-2 h-4 w-4" />
                  Marcar folha como paga
                </DropdownMenuItem>
              )}

              {ctxRow.settleVia === "RECONCILIATION" && (
                <DropdownMenuItem onClick={() => handleSettle(ctxRow)}>
                  <IconArrowRight className="mr-2 h-4 w-4" />
                  Conciliar / categorizar
                </DropdownMenuItem>
              )}

              {(ctxRow.settleVia === "THIRTEENTH" || ctxRow.settleVia === "VACATION") && (
                <DropdownMenuItem disabled>
                  <IconGift className="mr-2 h-4 w-4" />
                  Pague em Recursos Humanos
                </DropdownMenuItem>
              )}
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* VARIABLE recurrent bill — collect the real paid amount before settling. */}
      <PaymentAmountDialog
        open={!!payAmountRow}
        onOpenChange={(open) => !open && setPayAmountRow(null)}
        estimate={payAmountRow?.amount ?? 0}
        payeeName={payAmountRow?.payeeName}
        isPending={payRecurrentMutation.isPending}
        onConfirm={(paidAmount) => {
          const row = payAmountRow;
          if (!row) return;
          runAction(() => payRecurrentAsync({ occurrenceId: row.id, body: { paidAmount } }).then(() => setPayAmountRow(null)));
        }}
      />
    </div>
  );
}
