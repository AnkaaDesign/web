import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconRepeat,
  IconCash,
  IconProgressCheck,
  IconCoins,
  IconAlertTriangle,
  IconClock,
  IconBan,
  IconArrowBackUp,
  IconArrowRight,
  IconGift,
  IconCategory,
} from "@tabler/icons-react";

import type { ClearanceState, PayableRow, PayableState } from "../../../types";
import { routes, SECTOR_PRIVILEGES, AIRBRUSHING_PAYMENT_STATUS } from "../../../constants";
import { useOrderPayables, useOrderMutations, useSettlePayrollMonth, useTriggerOrderSchedule } from "../../../hooks";
import { MonthNav, monthKey, parseMonthKey } from "@/components/financial/reconciliation/month-nav";
import { useAirbrushingMutations, useAttachAirbrushingReceipts } from "../../../hooks/production/use-airbrushing";
import { usePrivileges } from "../../../hooks/common/use-privileges";
import { useToast } from "@/hooks/common/use-toast";
import { formatCurrency } from "../../../utils";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableRowAction } from "@/components/ui/datatable";
import { FinancialKpiCard } from "../common/financial-kpi-card";
import { PaymentAmountDialog } from "./payment-amount-dialog";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { buildPayableColumns, isOverdueRow } from "./payables-columns";
import { createAirbrushingFormData, createOrderFormData } from "@/utils/form-data-helper";
import { useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";

// --- Summary cards double as clickable filter buckets (Conciliação pattern). ----
// UNCLEARED is the cross-cutting "Pago mas não conciliado" bucket — it filters on
// the conciliação axis (PAID && clearanceState UNCLEARED), NOT on paymentState, so
// it overlaps the PAID bucket on purpose. It is the key 3-5 day-window view.
type PayableBucketKey = "AWAITING" | "OVERDUE" | "PARTIAL" | "EXPECTED" | "PAID" | "UNCLEARED";

const PAYABLE_BUCKETS: Record<
  PayableBucketKey,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  AWAITING: { label: "Aguardando Pagamento", Icon: IconProgressCheck, tone: "text-amber-600 bg-amber-500/10" },
  OVERDUE: { label: "Vencido", Icon: IconAlertTriangle, tone: "text-red-600 bg-red-500/10" },
  PARTIAL: { label: "Parcialmente Pago", Icon: IconCoins, tone: "text-orange-600 bg-orange-500/10" },
  EXPECTED: { label: "Previsto", Icon: IconRepeat, tone: "text-neutral-500 bg-neutral-500/10" },
  PAID: { label: "Pago no mês", Icon: IconCash, tone: "text-emerald-600 bg-emerald-500/10" },
  UNCLEARED: { label: "Pago, aguardando conciliação", Icon: IconClock, tone: "text-amber-600 bg-amber-500/10" },
};

// "UNCLEARED" (Pago, aguardando conciliação) is hidden for now — the payables
// reconciliation workflow is still being decided. Restore it here to bring the
// card back.
const BUCKET_ORDER: PayableBucketKey[] = ["AWAITING", "OVERDUE", "PARTIAL", "EXPECTED", "PAID"];
// Default view: every open/overdue/forecast obligation; paid-this-month and the
// awaiting-conciliação view are opt-in (click the card).
const DEFAULT_BUCKETS: PayableBucketKey[] = ["AWAITING", "OVERDUE", "PARTIAL", "EXPECTED"];

// Cards always kept on screen for a stable at-a-glance summary, even when the
// month has nothing in them. Every OTHER bucket (notably PARTIAL — "Parcialmente
// Pago", which recurrent occurrences never populate, so it is structurally always
// R$ 0,00 · 0 — and EXPECTED) is hidden when empty so no bogus card is rendered.
const ALWAYS_SHOWN_BUCKETS: PayableBucketKey[] = ["AWAITING", "OVERDUE", "PAID"];

// paymentState → its primary bucket (the assertion axis). UNCLEARED is handled
// separately (it cross-cuts on the conciliação axis).
const STATE_TO_BUCKET: Record<PayableState, Exclude<PayableBucketKey, "UNCLEARED">> = {
  AWAITING_PAYMENT: "AWAITING",
  OVERDUE: "OVERDUE",
  PARTIALLY_PAID: "PARTIAL",
  EXPECTED: "EXPECTED",
  PAID: "PAID",
};

// A row belongs to the "Pago mas não conciliado" bucket when it is asserted PAID
// but no confirming bank line has cleared it yet.
function isAwaitingClearance(row: PayableRow): boolean {
  return row.paymentState === "PAID" && (row.clearanceState ?? "UNCLEARED") === "UNCLEARED";
}

// Privileges the airbrushing (aerografia) detail page itself accepts — mirror its
// PrivilegeRoute so a payable row only links there for users who can actually open it.
const AIRBRUSHING_VIEW_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.PRODUCTION,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.ADMIN,
];

// Privileges the order DETAIL page itself accepts — mirror its PrivilegeRoute
// (`pages/inventory/orders/details/[id].tsx`) so a payable row only links there
// for users who can actually open it. Note ACCOUNTING has detail access even
// though it has no access to the order LIST page / "Estoque" menu section.
const ORDER_DETAIL_VIEW_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
];

// Financial-only: WAREHOUSE manages orders but never settles their payment side.
const PAYMENT_MANAGER_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
];

// Page-owned URL params. Search/sort/filters/pagination/selection are owned by the
// DataTable itself (q / sort / filters / page / pageSize / sel), so there is no
// collision — `search` is gone from here entirely.
const STATUS_PARAM = "status";
const MONTH_PARAM = "mes";

function parseBuckets(raw: string | null): PayableBucketKey[] {
  if (raw === null) return DEFAULT_BUCKETS;
  return raw.split(",").filter((s): s is PayableBucketKey => (BUCKET_ORDER as string[]).includes(s));
}

// --- Axis B (conciliação / bank truth) — orthogonal to paymentState. ----------
// Default to UNCLEARED for rows the API doesn't yet populate (forecasts, etc.).
function clearanceOf(row: PayableRow): ClearanceState {
  return row.clearanceState ?? "UNCLEARED";
}

// Row ordering rank: overdue first, then open obligations, then forecasts —
// anything still unpaid, however it's classified — and Pago always last.
function payableRank(state: PayableState): number {
  if (state === "PAID") return 3;
  if (state === "OVERDUE") return 0;
  if (state === "EXPECTED") return 2;
  return 1; // AWAITING_PAYMENT / PARTIALLY_PAID
}

// A row is payable TODAY: an open obligation whose payment has already been
// released (aerografia concluída, pedido requisitado, recorrente materializada).
// EXPECTED forecasts, PENDING orders awaiting "Requisitar Pagamento", ignored
// occurrences and settled rows are not — they are not money that can leave now.
function isPayableNow(row: PayableRow): boolean {
  if (row.ignored || row.paymentRequested === false) return false;
  return row.paymentState === "AWAITING_PAYMENT" || row.paymentState === "PARTIALLY_PAID" || row.paymentState === "OVERDUE";
}

interface AccountsPayableListProps {
  className?: string;
}

export function AccountsPayableList({ className }: AccountsPayableListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasAnyPrivilegeAccess } = usePrivileges();
  const { toast } = useToast();

  const canManagePayments = hasAnyPrivilegeAccess(PAYMENT_MANAGER_PRIVILEGES);
  const canViewAirbrushing = hasAnyPrivilegeAccess(AIRBRUSHING_VIEW_PRIVILEGES);
  const canViewOrderDetail = hasAnyPrivilegeAccess(ORDER_DETAIL_VIEW_PRIVILEGES);

  const [buckets, setBuckets] = useState<PayableBucketKey[]>(() => parseBuckets(searchParams.get(STATUS_PARAM)));
  // Competence month — same period switcher as the Extrato. Scopes the list (and
  // the summary cards) to obligations of the selected month.
  const [month, setMonth] = useState<Date>(() => parseMonthKey(searchParams.get(MONTH_PARAM)) ?? new Date());

  // VARIABLE recurrent bill awaiting its real paid amount (opens PaymentAmountDialog).
  const [payAmountRow, setPayAmountRow] = useState<PayableRow | null>(null);

  // Order/airbrushing payable awaiting confirmation + optional comprovante.
  const [markPaidRow, setMarkPaidRow] = useState<PayableRow | null>(null);
  const [markPaidPending, setMarkPaidPending] = useState(false);

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
  const { data: response, isLoading, refetch } = useOrderPayables(monthKey(month));
  const allRows = useMemo(() => response?.data?.rows ?? [], [response?.data?.rows]);

  // --- Period scope: keep only the rows that belong to the selected month ----
  // A row's month is its competence (payroll/tax/recurring), else its paidAt for
  // already-settled rows, else its due date. Undated, non-competence rows have no
  // natural month, so they stay visible across every period.
  //
  // EXCEPTION — anything payable TODAY also belongs to the CURRENT month, whatever
  // its vencimento says, and keeps showing in its own due month as well:
  //   · uma aerografia concluída em 27/07 vence 03/08 (prazo de 7 dias) mas já pode
  //     ser paga agora — some do mês em que o financeiro está trabalhando se ficar
  //     só em Agosto;
  //   · uma conta que já venceu continua devida — não pode sumir do mês corrente só
  //     porque o vencimento ficou para trás.
  const monthRows = useMemo(() => {
    const key = monthKey(month);
    const currentKey = monthKey(new Date());
    return allRows.filter((row) => {
      if (key === currentKey && isPayableNow(row)) return true;
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
      OVERDUE: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      EXPECTED: { count: 0, total: 0 },
      PAID: { count: 0, total: 0 },
      UNCLEARED: { count: 0, total: 0 },
    };
    for (const row of monthRows) {
      const bucket = STATE_TO_BUCKET[row.paymentState];
      out[bucket].count += 1;
      out[bucket].total += row.amount;
      // UNCLEARED cross-cuts: a PAID-but-unconfirmed row is counted here too.
      if (isAwaitingClearance(row)) {
        out.UNCLEARED.count += 1;
        out.UNCLEARED.total += row.amount;
      }
    }
    return out;
  }, [monthRows]);

  // Payment mutations. Order transitions auto-invalidate the payables query
  // (keyed under orderKeys.all); airbrushing settles via its own update, so we
  // refetch the list manually afterward.
  const { markAwaitingPaymentAsync, markPaidAsync, markInstallmentPaidAsync, attachReceiptsAsync } = useOrderMutations();
  const { updateAsync: updateAirbrushingAsync } = useAirbrushingMutations();
  const { mutateAsync: attachAirbrushingReceiptsAsync } = useAttachAirbrushingReceipts();
  const settlePayrollMonth = useSettlePayrollMonth();
  const triggerSchedule = useTriggerOrderSchedule();
  // Recorrentes: pay one materialized occurrence (the payables query is keyed
  // under orderKeys.all, so the pay action invalidates it and the row flips).
  const {
    payAsync: payRecurrentAsync,
    payMutation: payRecurrentMutation,
    ignoreAsync: ignoreRecurrentAsync,
    unignoreAsync: unignoreRecurrentAsync,
  } = useRecurrentPayableMutations();

  // --- Bucket filter (the KPI cards). Search/column filters/sorting are the
  // DataTable's job from here on. -------------------------------------------
  const bucketRows = useMemo(() => {
    const active = new Set(buckets);
    // A row matches if its assertion-axis bucket is active OR (the conciliação
    // bucket is active and the row is paid-but-unconfirmed).
    return monthRows.filter(
      (row) => active.has(STATE_TO_BUCKET[row.paymentState]) || (active.has("UNCLEARED") && isAwaitingClearance(row)),
    );
  }, [monthRows, buckets]);

  // Default order — the most urgent open payables lead: anything vencida by date
  // first (even if the server hasn't flipped its state yet), then the same rank
  // the old table used, then by due date. The DataTable's own column sorting
  // takes over the moment the user clicks a header.
  const sortedRows = useMemo(() => {
    const rows = [...bucketRows];
    rows.sort((a, b) => {
      const rankA = isOverdueRow(a) ? -1 : payableRank(a.paymentState);
      const rankB = isOverdueRow(b) ? -1 : payableRank(b.paymentState);
      if (rankA !== rankB) return rankA - rankB;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const byPayee = a.payeeName.localeCompare(b.payeeName, "pt-BR");
      return byPayee !== 0 ? byPayee : a.description.localeCompare(b.description, "pt-BR");
    });
    return rows;
  }, [bucketRows]);

  const handleRowClick = useCallback(
    (row: PayableRow) => {
      // A DISPUTED row's most useful target is the bank line that diverged, so the
      // operator can review/undo the match. Other cleared rows keep their natural
      // source detail (order / cronograma).
      if (clearanceOf(row) === "DISPUTED" && row.bankTransactionId) {
        navigate(routes.financial.reconciliation.transactionDetail(row.bankTransactionId));
        return;
      }
      // Recurrent/one-off occurrences must not leave the payables table — clicking
      // a row stays here (settle via the row's context menu when payable).
      if (row.source === "RECURRENT_PAYABLE" || row.source === "RECURRING") return;
      if (row.source === "ORDER") {
        // row.id is the orderId — open the order's own detail page (its breadcrumb
        // hides the "Estoque"/"Pedidos" ancestor links for users, like ACCOUNTING,
        // who can view the detail page but not the orders list). `from: "payables"`
        // tells the detail page to show "Financeiro / Contas a Pagar" instead,
        // matching the path actually taken.
        if (canViewOrderDetail) navigate(routes.inventory.orders.details(row.id), { state: { from: "payables" } });
        return;
      }
      if (row.source === "AIRBRUSHING") {
        // row.id is the airbrushing id — open its own detail page (not the task
        // cronograma, which finance/accounting users can't reach). Same contract as
        // ORDER rows.
        if (canViewAirbrushing) navigate(routes.production.airbrushings.details(row.id), { state: { from: "payables" } });
      } else if (row.bankTransactionId) {
        // Non-order/airbrushing cleared rows (folha/recorrentes/agendamentos) have
        // no own detail page — link to the bank line that cleared them.
        navigate(routes.financial.reconciliation.transactionDetail(row.bankTransactionId));
      }
    },
    [navigate, canViewAirbrushing, canViewOrderDetail],
  );

  // --- Payment actions (dispatch by source) ---------------------------------
  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      // Errors are toasted by the API client.
    }
  };

  // Mark a recurrent occurrence paid. VARIABLE bills (isEstimate) collect the
  // real value via PaymentAmountDialog; FIXED bills settle with the known value.
  const handleRecurrentPay = (row: PayableRow) => {
    if (row.isEstimate) {
      setPayAmountRow(row);
      return;
    }
    runAction(() => payRecurrentAsync({ occurrenceId: row.id, body: {} }));
  };

  // Confirm a payable as paid. The two steps (flip status + attach receipt) are not a
  // single transaction, so we flip the PAYMENT STATUS FIRST: a validation failure on
  // settle then aborts before any receipt is attached (the comprovante does not need to
  // precede the payment, and categorization is deferred to the Conciliação flow). The
  // receipt goes through the dedicated payment-side receipts endpoint of each entity —
  // NOT the generic update: on orders that one is WAREHOUSE/ADMIN only (403 for
  // accounting/financial), and on aerografias it REPLACES the receipts relation, which
  // from here — holding only a PayableRow, never the job's current file list — would
  // detach every comprovante already attached. If the upload fails AFTER the payment is
  // recorded, we surface a clear warning instead of letting the generic error imply the
  // payment didn't go through.
  const confirmMarkPaid = async (receipts: File[]) => {
    const row = markPaidRow;
    if (!row) return;
    const isAirbrushing = row.source === "AIRBRUSHING";
    setMarkPaidPending(true);
    try {
      if (isAirbrushing) {
        await updateAirbrushingAsync({ id: row.id, data: { paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PAID } });
      } else if (row.installmentId) {
        await markInstallmentPaidAsync(row.installmentId);
      } else {
        await markPaidAsync(row.id);
      }
      if (receipts.length > 0) {
        try {
          if (isAirbrushing) {
            await attachAirbrushingReceiptsAsync({ id: row.id, data: createAirbrushingFormData({}, { receipts }) });
          } else {
            await attachReceiptsAsync({ id: row.id, data: createOrderFormData({}, { receipts }) });
          }
        } catch {
          // Payment is already recorded — don't let the receipt failure look like a
          // failed payment. Tell the user exactly what happened.
          toast({
            title: "Pagamento registrado, comprovante não anexado",
            description: `O pagamento foi marcado como pago, mas o comprovante não pôde ser anexado. Anexe-o novamente ${isAirbrushing ? "pela aerografia" : "pelo pedido"}.`,
            variant: "warning",
          });
        }
      }
      setMarkPaidRow(null);
      refetch();
    } catch {
      // The settle failed before any side effect — error toasted by the API client.
    } finally {
      setMarkPaidPending(false);
    }
  };

  const parseCompetence = (c?: string | null): { year: number; month: number } | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(c ?? "");
    return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
  };

  // Click-to-copy helper for the Chave Pix cell (mirrors the order detail copy UX).
  // Stops row-click propagation so copying never navigates.
  const copyText = useCallback(
    (text: string, label: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      toast({ title: label, variant: "success" });
    },
    [toast],
  );

  const columns = useMemo(() => buildPayableColumns({ onCopy: copyText }), [copyText]);

  // Right-click actions, replacing the hand-rolled positioned dropdown. Each is
  // `hidden` for the rows it doesn't apply to, so one menu serves every source.
  const rowActions = useMemo<DataTableRowAction<PayableRow>[]>(() => {
    if (!canManagePayments) return [];
    const one = (rows: PayableRow[]): PayableRow | undefined => rows[0];
    return [
      {
        key: "order-mark-paid",
        label: "Marcar como pago",
        icon: <IconCash className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return (
            !r ||
            !(r.source === "ORDER" || r.source === "AIRBRUSHING") ||
            r.paymentState === "PAID" ||
            r.paymentRequested === false
          );
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) setMarkPaidRow(r);
        },
      },
      {
        key: "recurrent-pay",
        label: "Marcar como pago",
        icon: <IconCash className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.source !== "RECURRENT_PAYABLE" || r.paymentState === "PAID" || !!r.ignored;
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) handleRecurrentPay(r);
        },
      },
      {
        key: "recurrent-ignore",
        label: "Ignorar este mês",
        icon: <IconBan className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.source !== "RECURRENT_PAYABLE" || r.paymentState === "PAID" || !!r.ignored;
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) runAction(() => ignoreRecurrentAsync(r.id));
        },
      },
      {
        key: "recurrent-unignore",
        label: "Reverter (deixar de ignorar)",
        icon: <IconArrowBackUp className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.source !== "RECURRENT_PAYABLE" || !r.ignored;
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) runAction(() => unignoreRecurrentAsync(r.id));
        },
      },
      {
        key: "order-undo-paid",
        label: "Desfazer pagamento",
        icon: <IconProgressCheck className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.source !== "ORDER" || r.paymentState !== "PAID" || !!r.installmentId;
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) runAction(() => markAwaitingPaymentAsync(r.id));
        },
      },
      {
        key: "payroll-settle",
        label: "Marcar folha como paga",
        icon: <IconCash className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.settleVia !== "PAYROLL_MONTH";
        },
        onClick: (rows) => {
          const r = one(rows);
          const c = parseCompetence(r?.competence);
          if (r && c) {
            runAction(() => settlePayrollMonth.mutateAsync({ year: c.year, month: c.month, amount: r.amount }).then(() => refetch()));
          }
        },
      },
      {
        key: "schedule-trigger",
        label: "Gerar pedido agora",
        icon: <IconArrowRight className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.settleVia !== "SCHEDULE_TRIGGER";
        },
        onClick: (rows) => {
          const r = one(rows);
          if (r) runAction(() => triggerSchedule.mutateAsync({ id: r.id, cascadeMode: "GAP_ONLY" }).then(() => refetch()));
        },
      },
      {
        // Order rows settle directly via "Marcar como pago"; categorization is
        // deferred to the dedicated Conciliação flow. Other reconciliation-only
        // sources keep this option so they aren't stranded.
        key: "reconcile",
        label: "Conciliar / categorizar",
        icon: <IconCategory className="h-4 w-4" />,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.settleVia !== "RECONCILIATION" || r.source === "ORDER";
        },
        onClick: () => navigate(routes.financial.reconciliation.statement),
      },
      {
        key: "dp-only",
        label: "Pague em Departamento Pessoal",
        icon: <IconGift className="h-4 w-4" />,
        disabled: () => true,
        hidden: (rows) => {
          const r = one(rows);
          return !r || (r.settleVia !== "THIRTEENTH" && r.settleVia !== "VACATION");
        },
        onClick: () => undefined,
      },
      {
        // Why an otherwise-payable row can't be settled yet. Disabled on purpose —
        // it explains rather than acts.
        key: "awaiting-release",
        label: "Aguardando liberação para pagamento",
        icon: <IconClock className="h-4 w-4" />,
        disabled: () => true,
        hidden: (rows) => {
          const r = one(rows);
          return !r || r.paymentState === "PAID" || r.paymentRequested !== false;
        },
        onClick: () => undefined,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManagePayments, navigate, refetch]);

  // --- Render ---------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4 h-full min-h-0", className)}>
      {/* Summary cards double as filter buckets — click to show only that status.
          They span the FULL width: the column count tracks how many actually
          render (empty non-core buckets are hidden), so there is never a blank
          slot where a removed card used to be. */}
      {(() => {
        const visibleBuckets = BUCKET_ORDER.filter((key) => {
          if (ALWAYS_SHOWN_BUCKETS.includes(key)) return true;
          const b = monthBucketSummary[key];
          return !(b.count === 0 && b.total === 0);
        });
        // Static Tailwind classes (no dynamic string) so the columns fill the row.
        const lgCols: Record<number, string> = {
          1: "lg:grid-cols-1",
          2: "lg:grid-cols-2",
          3: "lg:grid-cols-3",
          4: "lg:grid-cols-4",
          5: "lg:grid-cols-5",
        };
        return (
          <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-2 flex-shrink-0", lgCols[visibleBuckets.length] ?? "lg:grid-cols-4")}>
            {visibleBuckets.map((key) => {
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
        );
      })()}

      <div className="flex-1 min-h-0 pb-2 flex flex-col">
        <DataTable<PayableRow>
          tableId="accounts-payable"
          data={sortedRows}
          columns={columns}
          // A recurrent occurrence id and an order id can never collide, but the
          // source prefix keeps the row key stable and obviously unique.
          getRowId={(row) => `${row.source}-${row.id}`}
          isLoading={isLoading}
          rowActions={rowActions}
          onRowClick={handleRowClick}
          // An ignored occurrence stays visible but reads as struck-out/muted.
          getRowClassName={(row) => (row.ignored ? "opacity-60" : "")}
          searchPlaceholder="Buscar por fornecedor, descrição ou categoria..."
          toolbarActions={<MonthNav month={month} onChange={setMonth} className="flex-shrink-0" />}
          enableSelection={false}
          enableRowPinning={false}
          enablePagination={false}
          enableColumnResizing
          enableColumnReorder
          enableShare
          emptyMessage="Nenhuma conta a pagar encontrada"
          exportTitle="Contas a Pagar"
          exportFilename="contas-a-pagar"
          className="h-full"
        />
      </div>

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

      {/* Order/airbrushing payable — confirm payment and optionally attach the comprovante. */}
      <MarkPaidDialog
        open={!!markPaidRow}
        onOpenChange={(open) => !open && setMarkPaidRow(null)}
        payeeName={markPaidRow?.payeeName}
        amount={markPaidRow?.amount}
        isPending={markPaidPending}
        onConfirm={confirmMarkPaid}
      />
    </div>
  );
}
