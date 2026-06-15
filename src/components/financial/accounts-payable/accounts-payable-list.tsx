import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconReceipt2,
  IconRepeat,
  IconSpray,
  IconCash,
  IconClockDollar,
  IconProgressCheck,
  IconCoins,
  IconPackage,
  IconReceiptTax,
  IconUsers,
  IconGift,
  IconArrowRight,
} from "@tabler/icons-react";

import type { PayableRow, PayableState } from "../../../types";
import { routes, SECTOR_PRIVILEGES, ORDER_PAYMENT_STATUS, AIRBRUSHING_PAYMENT_STATUS, PAYMENT_METHOD, PAYMENT_METHOD_LABELS } from "../../../constants";
import { useOrderPayables, useOrderMutations, useSettlePayrollMonth, useTriggerOrderSchedule } from "../../../hooks";
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

// --- Per-row payment-state badge. NOT_REQUESTED/REQUESTED collapse to a single
// "Em Aberto" reading — the request sub-step is no longer surfaced as its own
// status. EXPECTED (previstos/recorrentes) is a forecast, not a real debt yet. --
const PAYABLE_STATE_LABELS: Record<PayableState, string> = {
  NOT_REQUESTED: "Em Aberto",
  REQUESTED: "Em Aberto",
  AWAITING_PAYMENT: "Aguardando Pagamento",
  PARTIALLY_PAID: "Parcialmente Pago",
  EXPECTED: "Previsto/Recorrente",
  PAID: "Pago",
};

const PAYABLE_STATE_BADGE: Record<PayableState, BadgeProps["variant"]> = {
  NOT_REQUESTED: "secondary", // gray — open, awaiting action
  REQUESTED: "secondary",
  AWAITING_PAYMENT: "pending", // amber — queued by finance
  PARTIALLY_PAID: "orange",
  EXPECTED: "outline", // muted — forecast/recurrent, not a real debt yet
  PAID: "completed", // green
};

// --- Summary cards double as clickable filter buckets (Conciliação pattern).
// Each bucket maps to one or more underlying payment states; "Em Aberto" merges
// NOT_REQUESTED + REQUESTED. ---------------------------------------------------
type PayableBucketKey = "OPEN" | "AWAITING" | "PARTIAL" | "EXPECTED" | "PAID";

const PAYABLE_BUCKETS: Record<
  PayableBucketKey,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string; states: PayableState[] }
> = {
  OPEN: { label: "Em Aberto", Icon: IconClockDollar, tone: "text-amber-600 bg-amber-500/10", states: ["NOT_REQUESTED", "REQUESTED"] },
  AWAITING: { label: "Aguardando Pagamento", Icon: IconProgressCheck, tone: "text-blue-600 bg-blue-500/10", states: ["AWAITING_PAYMENT"] },
  PARTIAL: { label: "Parcialmente Pago", Icon: IconCoins, tone: "text-orange-600 bg-orange-500/10", states: ["PARTIALLY_PAID"] },
  EXPECTED: { label: "Previsto/Recorrente", Icon: IconRepeat, tone: "text-neutral-500 bg-neutral-500/10", states: ["EXPECTED"] },
  PAID: { label: "Pago no mês", Icon: IconCash, tone: "text-emerald-600 bg-emerald-500/10", states: ["PAID"] },
};

const BUCKET_ORDER: PayableBucketKey[] = ["OPEN", "AWAITING", "PARTIAL", "EXPECTED", "PAID"];
// Default view: every open/forecast obligation; paid-this-month is opt-in (click the card).
const DEFAULT_BUCKETS: PayableBucketKey[] = ["OPEN", "AWAITING", "PARTIAL", "EXPECTED"];

const STATE_TO_BUCKET: Record<PayableState, PayableBucketKey> = {
  NOT_REQUESTED: "OPEN",
  REQUESTED: "OPEN",
  AWAITING_PAYMENT: "AWAITING",
  PARTIALLY_PAID: "PARTIAL",
  EXPECTED: "EXPECTED",
  PAID: "PAID",
};

// Row ordering rank: open obligations first, then paid-this-month, then forecasts.
function payableRank(state: PayableState): number {
  if (state === "EXPECTED") return 2;
  if (state === "PAID") return 1;
  return 0;
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

const PAYMENT_MANAGER_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
];

const SEARCH_PARAM = "search";
const STATUS_PARAM = "status";

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

  // Right-click payment menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: PayableRow } | null>(null);

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
  const summary = response?.data?.summary;

  // Card value/count come from the server summary, regrouped into buckets so the
  // cards always show absolute totals regardless of the active filter.
  const bucketSummary = (key: PayableBucketKey) => {
    let count = 0;
    let total = 0;
    for (const state of PAYABLE_BUCKETS[key].states) {
      const b = summary?.[state];
      if (b) {
        count += b.count;
        total += b.total;
      }
    }
    return { count, total };
  };

  // Payment mutations. Order transitions auto-invalidate the payables query
  // (keyed under orderKeys.all); airbrushing settles via its own update, so we
  // refetch the list manually afterward.
  const { markAwaitingPaymentAsync, markPaidAsync } = useOrderMutations();
  const { updateAsync: updateAirbrushingAsync } = useAirbrushingMutations();
  const settlePayrollMonth = useSettlePayrollMonth();
  const triggerSchedule = useTriggerOrderSchedule();

  // --- Client-side filter: active buckets + search across tomador/description -
  const filteredRows = useMemo(() => {
    const active = new Set(buckets);
    const term = debouncedSearch.trim().toLowerCase();
    let base = allRows.filter((row) => active.has(STATE_TO_BUCKET[row.paymentState]));
    if (term) base = base.filter((row) => row.payeeName.toLowerCase().includes(term) || row.description.toLowerCase().includes(term));
    return base;
  }, [allRows, buckets, debouncedSearch]);

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

  // "Em aberto" total excludes paid-this-month and forecast rows.
  const grandTotal = useMemo(
    () => filteredRows.filter((row) => row.paymentState !== "PAID" && row.paymentState !== "EXPECTED").reduce((sum, row) => sum + row.amount, 0),
    [filteredRows],
  );

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

  const settleAirbrushing = (id: string, paymentStatus: string) => updateAirbrushingAsync({ id, data: { paymentStatus } }).then(() => refetch());

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
        navigate(row.source === "RECURRING" && row.payeeId ? `${routes.financial.reconciliation.transactions}?categoryIds=${row.payeeId}` : routes.financial.reconciliation.transactions);
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
      render: (row) => <TruncatedTextWithTooltip text={row.description || "-"} className={cn("text-sm", row.paymentState === "EXPECTED" && "italic text-muted-foreground")} />,
    },
    { key: "type", header: "Tipo", width: 176, render: (row) => <PayableTypeBadge row={row} /> },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
        {BUCKET_ORDER.map((key) => {
          const meta = PAYABLE_BUCKETS[key];
          const b = bucketSummary(key);
          return (
            <FinancialKpiCard
              key={key}
              label={meta.label}
              value={isLoading || !summary ? null : formatCurrency(b.total)}
              count={b.count}
              Icon={meta.Icon}
              tone={meta.tone}
              active={buckets.includes(key)}
              onClick={() => toggleBucket(key)}
            />
          );
        })}
      </div>

      {/* Search + flat list */}
      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 min-h-0 flex flex-col p-4 space-y-4 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TableSearchInput
              value={searchText}
              onChange={(value) => setSearchText(value)}
              placeholder="Buscar por fornecedor, pintor ou descrição..."
              isPending={searchText !== debouncedSearch}
            />
            <div className="text-sm text-muted-foreground whitespace-nowrap sm:text-right">
              {filteredRows.length} {filteredRows.length === 1 ? "conta" : "contas"} •{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatCurrency(grandTotal)}</span> em aberto
            </div>
          </div>

          {canManagePayments && (
            <p className="text-xs text-muted-foreground">
              Clique nos cartões acima para filtrar por situação. Clique com o botão direito em uma conta para registrar o pagamento. Pedidos: Em Aberto → (Aguardando) →
              Pago; aerografia e folha são pagas direto; impostos e recorrentes são quitados pela conciliação bancária.
            </p>
          )}

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
                <DropdownMenuItem disabled>
                  <IconCash className="mr-2 h-4 w-4" />
                  Pago{ctxRow.paidAt ? ` em ${formatDate(new Date(ctxRow.paidAt))}` : ""}
                </DropdownMenuItem>
              )}

              {ctxRow.source === "ORDER" && ctxRow.paymentState !== "PAID" && (
                <>
                  {ctxRow.paymentState !== ORDER_PAYMENT_STATUS.AWAITING_PAYMENT && (
                    <DropdownMenuItem onClick={() => runAction(() => markAwaitingPaymentAsync(ctxRow.id))}>
                      <IconProgressCheck className="mr-2 h-4 w-4" />
                      Marcar como aguardando pagamento
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => runAction(() => markPaidAsync(ctxRow.id))}>
                    <IconCash className="mr-2 h-4 w-4" />
                    Marcar como pago
                  </DropdownMenuItem>
                </>
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
    </div>
  );
}
