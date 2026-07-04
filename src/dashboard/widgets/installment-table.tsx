// Installment / Bank-slip tracker widget.
//
// Lists every installment from every billed task (Task → TaskQuote →
// TaskQuoteCustomerConfig → Installment[]) flattened into a single sortable,
// filterable table. Designed to mirror the task-table widget's robustness so
// the user can build dashboards that track boleto payments end-to-end:
//
//   • Quick due-date buckets (overdue / today / tomorrow / 7 days / 30 days)
//   • Filter by installment status (PENDING/PAID/OVERDUE/CANCELLED)
//   • Filter by bank-slip status (ACTIVE/PAID/OVERDUE/REJECTED/ERROR/...)
//   • Filter by customer
//   • Plain-text search (customer/task/serial/nosso número)
//   • Density (compact/comfortable/spacious)
//   • Layout modes (flat / grouped-by-bucket / grouped-by-status)
//   • Configurable column set, accent, refetch interval
//
// Backend: consumed entirely from the existing /tasks endpoint with deeply
// nested includes — there is currently no installment-list endpoint, so the
// widget flattens the task→quote→config→installment tree client-side. For a
// dashboard tile (capped at ~200 rows) this is fine; once a dedicated
// /installments endpoint exists the `useFlatInstallments` hook becomes a
// 5-line swap.

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { WidgetTabsBar } from "../components/config-kit";
import { useNavigate } from "react-router-dom";
import { useReturnTo } from "@/hooks/common/use-return-to";
import {
  IconReceipt,
  IconSearch,
  IconAlertTriangle,
  IconCircleCheck,
  IconCalendarDue,
  IconCash,
  IconAdjustments,
  IconColumns,
  IconFilter,
  IconLayout,
} from "@tabler/icons-react";

import { useTasks } from "../../hooks/production/use-task";
import { useCustomers } from "../../hooks/administration/use-customer";
import {
  INSTALLMENT_STATUS,
  BANK_SLIP_STATUS,
  TASK_QUOTE_STATUS,
  SECTOR_PRIVILEGES,
} from "../../constants/enums";
import {
  INSTALLMENT_STATUS_LABELS,
  BANK_SLIP_STATUS_LABELS,
} from "../../constants/enum-labels";
import { routes } from "../../constants/routes";
import { formatCurrency } from "../../utils/number";
import { formatDate } from "../../utils/date";

import { Combobox } from "../../components/ui/combobox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { InstallmentStatusBadge } from "../../components/production/task/billing/installment-status-badge";
import { BankSlipStatusBadge } from "../../components/production/task/billing/bank-slip-status-badge";
import { QuoteStatusBadge } from "../../components/production/task/quote/quote-status-badge";

import { WidgetCard } from "../components/widget-card";
import { ColumnPicker, type ColumnSort } from "../components/column-picker";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import {
  Section,
  SectionGroup,
  ToggleRow,
  LimitInput,
  REFETCH_INTERVAL_OPTIONS,
  DensitySegmented,
  densityClasses,
  makeTableDisplaySchema,
  TABLE_DISPLAY_DEFAULTS,
  coerceRefreshMs,
  getEffectiveZoom,
} from "./_shared";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Quick bucket the user picks from a chip row. Each maps to a (clientside)
 * dueDate predicate. Buckets are inclusive — "next-7-days" includes overdue
 * + today, etc — to match how users naturally think about cash flow.
 */
const DUE_BUCKETS = [
  "all",
  "overdue",
  "today",
  "tomorrow",
  "next-7-days",
  "next-30-days",
  "this-month",
  "paid-recent",
] as const;
type DueBucket = (typeof DUE_BUCKETS)[number];
const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  all: "Todas",
  overdue: "Vencidas",
  today: "Vencem hoje",
  tomorrow: "Vencem amanhã",
  "next-7-days": "Próximos 7 dias",
  "next-30-days": "Próximos 30 dias",
  "this-month": "Este mês",
  "paid-recent": "Pagas (30 dias)",
};

const LAYOUT_MODES = [
  "flat",
  "grouped-by-bucket",
  "grouped-by-status",
] as const;
type LayoutMode = (typeof LAYOUT_MODES)[number];
const LAYOUT_LABELS: Record<LayoutMode, string> = {
  flat: "Lista única",
  "grouped-by-bucket": "Agrupado por vencimento",
  "grouped-by-status": "Agrupado por status",
};

const COLUMN_KEYS = [
  "customer",
  "task",
  "installment",
  "dueDate",
  "countdown",
  "amount",
  "paidAmount",
  "installmentStatus",
  "bankSlipStatus",
  "nossoNumero",
  "paymentMethod",
  "quoteStatus",
] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  customer: "Cliente",
  task: "Tarefa",
  installment: "Parcela",
  dueDate: "Vencimento",
  countdown: "Restante",
  amount: "Valor",
  paidAmount: "Valor pago",
  installmentStatus: "Status da parcela",
  bankSlipStatus: "Status do boleto",
  nossoNumero: "Nosso número",
  paymentMethod: "Forma",
  quoteStatus: "Status do orçamento",
};

// Quote statuses that may have installments worth tracking. We exclude
// PENDING/BUDGET_APPROVED because those quotes haven't
// been turned into bills yet.
const RELEVANT_QUOTE_STATUSES = [
  TASK_QUOTE_STATUS.BILLING_APPROVED,
  TASK_QUOTE_STATUS.UPCOMING,
  TASK_QUOTE_STATUS.DUE,
  TASK_QUOTE_STATUS.PARTIAL,
  TASK_QUOTE_STATUS.SETTLED,
] as const;

// ============================================================================
// Schema
// ============================================================================

const installmentTableConfigSchemaInner = z.object({
  title: z.string().min(1).max(80).default("Boletos"),
  accent: makeAccentSchema({
    color: "blue",
    icon: "Receipt",
  }),

  // Canonical cross-platform table display block plus installment-specific
  // extras (bucket chips, layout mode). Shared-field defaults all matched
  // TABLE_DISPLAY_DEFAULTS; the factory additively contributes showColumnHeaders
  // / showRowDot / refreshIntervalMs. The extras object is itself `.default()`ed
  // so the intersection still parses when `display` is absent.
  display: makeTableDisplaySchema().and(
    z
      .object({
        showBucketChips: z.boolean().default(true),
        layoutMode: z.enum(LAYOUT_MODES).default("flat"),
      })
      .default({ showBucketChips: true, layoutMode: "flat" }),
  ),

  columns: z
    .array(z.enum(COLUMN_KEYS))
    .default([
      "customer",
      "task",
      "installment",
      "dueDate",
      "countdown",
      "amount",
      "installmentStatus",
      "bankSlipStatus",
    ]),

  filters: z
    .object({
      defaultBucket: z.enum(DUE_BUCKETS).default("next-30-days"),
      installmentStatuses: z.array(z.nativeEnum(INSTALLMENT_STATUS)).default([]),
      bankSlipStatuses: z.array(z.nativeEnum(BANK_SLIP_STATUS)).default([]),
      customerIds: z.array(z.string()).default([]),
      hideFullyPaid: z.boolean().default(false),
      hideMissingBankSlip: z.boolean().default(false),
    })
    .default({
      defaultBucket: "next-30-days",
      installmentStatuses: [],
      bankSlipStatuses: [],
      customerIds: [],
      hideFullyPaid: false,
      hideMissingBankSlip: false,
    }),

  sorts: z
    .array(
      z.object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "dueDate", direction: "asc" }]),

  limit: z.number().int().min(5).max(200).default(50),

  // Legacy top-level refresh field. Kept for back-compat (the config UI still
  // writes it); the canonical value lives in `display.refreshIntervalMs`, folded
  // in by the preprocess wrapper below.
  refetchInterval: z.number().int().min(0).default(0),
});

// Back-compat shim: older persisted configs stored the refresh interval at the
// top level (`refetchInterval`, number) and have no `display.refreshIntervalMs`.
// Fold the legacy value into the canonical field before validation. Guarded so
// undefined / non-object input passes through untouched.
export const installmentTableConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const display =
    obj.display && typeof obj.display === "object"
      ? (obj.display as Record<string, unknown>)
      : undefined;
  const hasCanonical =
    display && typeof display.refreshIntervalMs === "number";
  if (!hasCanonical && obj.refetchInterval !== undefined) {
    return {
      ...obj,
      display: {
        ...(display ?? {}),
        refreshIntervalMs: coerceRefreshMs(obj.refetchInterval),
      },
    };
  }
  return raw;
}, installmentTableConfigSchemaInner);

export type InstallmentTableConfig = z.infer<typeof installmentTableConfigSchema>;

// ============================================================================
// Flat row shape
// ============================================================================

interface FlatInstallment {
  id: string;
  installmentNumber: number;
  totalInstallments: number;

  taskId: string;
  taskName: string;
  taskSerial: string | null;

  quoteStatus: TASK_QUOTE_STATUS;

  customerId: string;
  customerName: string;

  dueDate: Date;
  amount: number;
  paidAmount: number;
  paidAt: Date | null;
  installmentStatus: INSTALLMENT_STATUS;
  paymentMethod: string | null;

  bankSlipId: string | null;
  nossoNumero: string | null;
  bankSlipStatus: BANK_SLIP_STATUS | null;

  // derived
  daysUntilDue: number;
  bucket: Exclude<DueBucket, "all" | "paid-recent">;
}

// ============================================================================
// Helpers
// ============================================================================

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function diffDays(target: Date, now: Date): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function bucketFor(
  installmentStatus: INSTALLMENT_STATUS,
  bankSlipStatus: BANK_SLIP_STATUS | null,
  daysUntilDue: number,
): FlatInstallment["bucket"] {
  // Treat any explicit OVERDUE as overdue regardless of the date arithmetic.
  if (
    installmentStatus === INSTALLMENT_STATUS.OVERDUE ||
    bankSlipStatus === BANK_SLIP_STATUS.OVERDUE
  ) {
    return "overdue";
  }
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "today";
  if (daysUntilDue === 1) return "tomorrow";
  if (daysUntilDue <= 7) return "next-7-days";
  if (daysUntilDue <= 30) return "next-30-days";
  return "this-month";
}

function customerLabel(customer: { fantasyName?: string; corporateName?: string } | undefined | null): string {
  if (!customer) return "—";
  return customer.corporateName || customer.fantasyName || "—";
}

function flattenTasksToInstallments(tasks: any[] | undefined): FlatInstallment[] {
  if (!tasks?.length) return [];
  const today = startOfToday();
  const out: FlatInstallment[] = [];
  for (const task of tasks) {
    const quote = task?.quote;
    if (!quote) continue;
    const configs = quote.customerConfigs ?? [];
    let totalForTask = 0;
    for (const cfg of configs) {
      totalForTask += cfg?.installments?.length ?? 0;
    }
    for (const cfg of configs) {
      const installments = cfg?.installments ?? [];
      for (const inst of installments) {
        if (!inst?.dueDate) continue;
        const due = new Date(inst.dueDate);
        const days = diffDays(due, today);
        const bs = inst.bankSlip ?? null;
        const status = inst.status as INSTALLMENT_STATUS;
        const bsStatus = (bs?.status ?? null) as BANK_SLIP_STATUS | null;
        out.push({
          id: inst.id,
          installmentNumber: inst.number,
          totalInstallments: totalForTask,

          taskId: task.id,
          taskName: task.name ?? "—",
          taskSerial: task.serialNumber ?? null,

          quoteStatus: quote.status as TASK_QUOTE_STATUS,

          customerId: cfg.customer?.id ?? cfg.customerId,
          customerName: customerLabel(cfg.customer),

          dueDate: due,
          amount: Number(inst.amount ?? 0),
          paidAmount: Number(inst.paidAmount ?? 0),
          paidAt: inst.paidAt ? new Date(inst.paidAt) : null,
          installmentStatus: status,
          paymentMethod: inst.paymentMethod ?? null,

          bankSlipId: bs?.id ?? null,
          nossoNumero: bs?.nossoNumero ?? null,
          bankSlipStatus: bsStatus,

          daysUntilDue: days,
          bucket: bucketFor(status, bsStatus, days),
        });
      }
    }
  }
  return out;
}

function applyFilters(
  rows: FlatInstallment[],
  config: InstallmentTableConfig,
  bucket: DueBucket,
  search: string,
): FlatInstallment[] {
  const term = search.trim().toLowerCase();
  const f = config.filters;
  return rows.filter((r) => {
    // Bucket
    if (bucket === "overdue" && r.bucket !== "overdue") return false;
    if (bucket === "today" && r.bucket !== "today") return false;
    if (bucket === "tomorrow" && r.bucket !== "tomorrow") return false;
    if (bucket === "next-7-days" && r.daysUntilDue > 7) return false;
    if (bucket === "next-30-days" && r.daysUntilDue > 30) return false;
    if (bucket === "this-month") {
      const today = startOfToday();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const lastDayDays = diffDays(lastDay, today);
      if (r.daysUntilDue < 0 || r.daysUntilDue > lastDayDays) return false;
    }
    if (bucket === "paid-recent") {
      if (r.installmentStatus !== INSTALLMENT_STATUS.PAID) return false;
      if (!r.paidAt) return false;
      if (diffDays(r.paidAt, startOfToday()) < -30) return false;
    }

    if (f.installmentStatuses.length && !f.installmentStatuses.includes(r.installmentStatus)) {
      return false;
    }
    if (f.bankSlipStatuses.length) {
      if (!r.bankSlipStatus || !f.bankSlipStatuses.includes(r.bankSlipStatus)) return false;
    }
    if (f.customerIds.length && !f.customerIds.includes(r.customerId)) return false;
    if (f.hideFullyPaid && r.installmentStatus === INSTALLMENT_STATUS.PAID) return false;
    if (f.hideMissingBankSlip && !r.bankSlipId) return false;

    if (term) {
      const hay = `${r.customerName} ${r.taskName} ${r.taskSerial ?? ""} ${r.nossoNumero ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function compareRows(a: FlatInstallment, b: FlatInstallment, key: string): number {
  switch (key) {
    case "dueDate":
      return a.dueDate.getTime() - b.dueDate.getTime();
    case "amount":
      return a.amount - b.amount;
    case "customer":
      return a.customerName.localeCompare(b.customerName);
    case "installmentStatus":
      return a.installmentStatus.localeCompare(b.installmentStatus);
    case "bankSlipStatus":
      return (a.bankSlipStatus ?? "ZZZ").localeCompare(b.bankSlipStatus ?? "ZZZ");
    default:
      return 0;
  }
}

function applySort(
  rows: FlatInstallment[],
  sorts: InstallmentTableConfig["sorts"],
): FlatInstallment[] {
  if (!sorts || sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const sign = s.direction === "asc" ? 1 : -1;
      const c = compareRows(a, b, s.key);
      if (c !== 0) return sign * c;
    }
    return 0;
  });
}

// ============================================================================
// Data fetching
// ============================================================================

const TASK_INCLUDE = {
  customer: { select: { id: true, fantasyName: true, corporateName: true } },
  quote: {
    select: {
      id: true,
      status: true,
      statusOrder: true,
      total: true,
      customerConfigs: {
        select: {
          id: true,
          customerId: true,
          customer: { select: { id: true, fantasyName: true, corporateName: true } },
          installments: {
            select: {
              id: true,
              number: true,
              dueDate: true,
              amount: true,
              paidAmount: true,
              paidAt: true,
              status: true,
              paymentMethod: true,
              bankSlip: {
                select: {
                  id: true,
                  nossoNumero: true,
                  status: true,
                  amount: true,
                  dueDate: true,
                  paidAt: true,
                  paidAmount: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

function useFlatInstallments(refetchInterval: number) {
  const params = useMemo(
    () => ({
      page: 1,
      limit: 200,
      where: { quote: { status: { in: [...RELEVANT_QUOTE_STATUSES] } } },
      include: TASK_INCLUDE,
      orderBy: [{ quote: { statusOrder: "asc" } }, { finishedAt: "desc" }],
      ...(refetchInterval > 0 && { refetchInterval }),
    }),
    [refetchInterval],
  );
  const { data, isLoading, isError, refresh } = useTasks(params as any);
  const rows = useMemo(() => flattenTasksToInstallments(data?.data), [data?.data]);
  return { rows, isLoading, isError, refresh };
}

// ============================================================================
// Bucket bar
// ============================================================================

const BUCKET_VARIANTS: Record<DueBucket, { tone: string; icon?: any }> = {
  all: { tone: "border-border" },
  overdue: { tone: "border-red-500/40 text-red-600 dark:text-red-400", icon: IconAlertTriangle },
  today: { tone: "border-orange-500/40 text-orange-600 dark:text-orange-400", icon: IconCalendarDue },
  tomorrow: { tone: "border-amber-500/40 text-amber-600 dark:text-amber-400" },
  "next-7-days": { tone: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400" },
  "next-30-days": { tone: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
  "this-month": { tone: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400" },
  "paid-recent": { tone: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400", icon: IconCircleCheck },
};

function BucketChip({
  bucket,
  active,
  count,
  onClick,
}: {
  bucket: DueBucket;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const v = BUCKET_VARIANTS[bucket];
  const Icon = v.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap ${
        active
          ? `bg-primary text-primary-foreground border-primary`
          : `bg-card hover:bg-accent text-muted-foreground hover:text-foreground ${v.tone}`
      }`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span>{DUE_BUCKET_LABELS[bucket]}</span>
      <span
        className={`tabular-nums ${
          active ? "opacity-80" : "opacity-60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ============================================================================
// Column rendering
// ============================================================================

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: string; // CSS grid track size
  align?: "left" | "right" | "center";
  render: (r: FlatInstallment) => React.ReactNode;
}

function makeColumns(): Record<ColumnKey, ColumnDef> {
  return {
    customer: {
      key: "customer",
      label: COLUMN_LABELS.customer,
      width: "minmax(0, 1.6fr)",
      render: (r) => (
        <div className="block truncate font-medium pr-2" title={r.customerName}>
          {r.customerName}
        </div>
      ),
    },
    task: {
      key: "task",
      label: COLUMN_LABELS.task,
      width: "minmax(0, 1.4fr)",
      render: (r) => (
        <div className="block truncate pr-2" title={r.taskName}>
          {r.taskName}
          {r.taskSerial && (
            <span className="ml-1 text-muted-foreground tabular-nums">
              · {r.taskSerial}
            </span>
          )}
        </div>
      ),
    },
    installment: {
      key: "installment",
      label: COLUMN_LABELS.installment,
      width: "minmax(0, 0.5fr)",
      align: "center",
      render: (r) => (
        <span className="tabular-nums">
          {r.installmentNumber}/{r.totalInstallments}
        </span>
      ),
    },
    dueDate: {
      key: "dueDate",
      label: COLUMN_LABELS.dueDate,
      width: "minmax(0, 0.7fr)",
      render: (r) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatDate(r.dueDate)}
        </span>
      ),
    },
    countdown: {
      key: "countdown",
      label: COLUMN_LABELS.countdown,
      width: "minmax(0, 0.6fr)",
      align: "center",
      render: (r) => {
        const isPaid = r.installmentStatus === INSTALLMENT_STATUS.PAID;
        if (isPaid) {
          return <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">Pago</span>;
        }
        const days = r.daysUntilDue;
        const cls =
          days < 0
            ? "text-red-600 dark:text-red-400"
            : days === 0
              ? "text-orange-600 dark:text-orange-400"
              : days <= 7
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground";
        const label =
          days < 0
            ? `${Math.abs(days)}d atraso`
            : days === 0
              ? "Hoje"
              : days === 1
                ? "Amanhã"
                : `${days}d`;
        return <span className={`tabular-nums ${cls}`}>{label}</span>;
      },
    },
    amount: {
      key: "amount",
      label: COLUMN_LABELS.amount,
      width: "minmax(0, 0.7fr)",
      align: "right",
      render: (r) => (
        <span className="tabular-nums whitespace-nowrap font-medium">
          {formatCurrency(r.amount)}
        </span>
      ),
    },
    paidAmount: {
      key: "paidAmount",
      label: COLUMN_LABELS.paidAmount,
      width: "minmax(0, 0.7fr)",
      align: "right",
      render: (r) =>
        r.paidAmount > 0 ? (
          <span className="tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">
            {formatCurrency(r.paidAmount)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    installmentStatus: {
      key: "installmentStatus",
      label: COLUMN_LABELS.installmentStatus,
      width: "minmax(0, 0.9fr)",
      render: (r) => (
        <InstallmentStatusBadge
          status={r.installmentStatus}
          paymentMethod={r.paymentMethod}
          size="sm"
        />
      ),
    },
    bankSlipStatus: {
      key: "bankSlipStatus",
      label: COLUMN_LABELS.bankSlipStatus,
      width: "minmax(0, 0.9fr)",
      render: (r) =>
        r.bankSlipStatus ? (
          <BankSlipStatusBadge status={r.bankSlipStatus} size="sm" />
        ) : (
          <span className="text-muted-foreground italic text-[10px]">Sem boleto</span>
        ),
    },
    nossoNumero: {
      key: "nossoNumero",
      label: COLUMN_LABELS.nossoNumero,
      width: "minmax(0, 0.8fr)",
      render: (r) =>
        r.nossoNumero ? (
          <span className="tabular-nums text-muted-foreground">{r.nossoNumero}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    paymentMethod: {
      key: "paymentMethod",
      label: COLUMN_LABELS.paymentMethod,
      width: "minmax(0, 0.5fr)",
      render: (r) =>
        r.paymentMethod ? (
          <span className="text-muted-foreground">{r.paymentMethod}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    quoteStatus: {
      key: "quoteStatus",
      label: COLUMN_LABELS.quoteStatus,
      width: "minmax(0, 0.9fr)",
      render: (r) => <QuoteStatusBadge status={r.quoteStatus} size="sm" />,
    },
  };
}

// ============================================================================
// Per-instance column-width persistence
// ============================================================================

const COLUMN_WIDTHS_STORAGE_PREFIX = "installment-table-widget:column-widths:";

function readStoredWidths(instanceId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_PREFIX + instanceId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeStoredWidths(instanceId: string, widths: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COLUMN_WIDTHS_STORAGE_PREFIX + instanceId,
      JSON.stringify(widths),
    );
  } catch {
    /* ignore — quota or disabled storage */
  }
}

// ============================================================================
// Render
// ============================================================================

function Render({ config, instanceId }: WidgetRenderProps<InstallmentTableConfig>) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const display = config.display;
  const dens = densityClasses(display.density);

  const [searchInput, setSearchInput] = useState("");
  const [bucket, setBucket] = useState<DueBucket>(config.filters.defaultBucket);
  const debouncedSearch = useDeferredValue(searchInput);

  // Live column widths — hydrate from localStorage on mount. Drag handlers
  // update both state and storage so widths stick across reloads.
  const [liveWidths, setLiveWidths] = useState<Record<string, string>>(() =>
    readStoredWidths(instanceId),
  );
  const headerRef = useRef<HTMLDivElement>(null);

  const setColumnWidthPx = useCallback(
    (key: string, px: number) => {
      const next = { ...liveWidths, [key]: `${Math.max(40, Math.round(px))}px` };
      setLiveWidths(next);
      writeStoredWidths(instanceId, next);
    },
    [instanceId, liveWidths],
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      const headerEl = headerRef.current;
      if (!headerEl) return;
      const cell = headerEl.querySelector<HTMLElement>(
        `[data-col-key="${columnKey}"]`,
      );
      if (!cell) return;
      // Under the document's CSS `zoom`, getBoundingClientRect/clientX are in the
      // scaled space; normalize to CSS-px (the space the width is written in) so
      // the column tracks the cursor 1:1 instead of drifting by the zoom factor.
      const zoom = getEffectiveZoom(cell);
      const startX = e.clientX;
      const startWidth = cell.getBoundingClientRect().width / zoom;

      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        setColumnWidthPx(columnKey, startWidth + dx);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [setColumnWidthPx],
  );

  // Canonical refresh field. 0 disables polling. Falls back to the legacy
  // top-level `refetchInterval` for configs that predate the preprocess shim.
  const refreshIntervalMs =
    display.refreshIntervalMs || config.refetchInterval || 0;
  const { rows: rawRows, isLoading, isError } = useFlatInstallments(
    refreshIntervalMs,
  );

  // Pre-compute bucket counts for the chip row (against ALL rows so the
  // counts don't change as the user clicks chips — they reflect the global
  // landscape, not the filtered view).
  const bucketCounts = useMemo(() => {
    const counts: Record<DueBucket, number> = {
      all: rawRows.length,
      overdue: 0,
      today: 0,
      tomorrow: 0,
      "next-7-days": 0,
      "next-30-days": 0,
      "this-month": 0,
      "paid-recent": 0,
    };
    const today = startOfToday();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastDayDays = diffDays(lastDay, today);
    for (const r of rawRows) {
      if (r.bucket === "overdue") counts.overdue += 1;
      if (r.bucket === "today") counts.today += 1;
      if (r.bucket === "tomorrow") counts.tomorrow += 1;
      if (r.daysUntilDue >= 0 && r.daysUntilDue <= 7) counts["next-7-days"] += 1;
      if (r.daysUntilDue >= 0 && r.daysUntilDue <= 30) counts["next-30-days"] += 1;
      if (r.daysUntilDue >= 0 && r.daysUntilDue <= lastDayDays)
        counts["this-month"] += 1;
      if (
        r.installmentStatus === INSTALLMENT_STATUS.PAID &&
        r.paidAt &&
        diffDays(r.paidAt, today) >= -30
      )
        counts["paid-recent"] += 1;
    }
    return counts;
  }, [rawRows]);

  const rows = useMemo(() => {
    const filtered = applyFilters(rawRows, config, bucket, debouncedSearch);
    const sorted = applySort(filtered, config.sorts);
    return sorted.slice(0, config.limit);
  }, [rawRows, config, bucket, debouncedSearch]);

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  const cols = useMemo(() => {
    const all = makeColumns();
    return config.columns.map((k) => all[k]).filter(Boolean);
  }, [config.columns]);
  const gridTemplate = useMemo(
    () => cols.map((c) => liveWidths[c.key] ?? c.width).join(" "),
    [cols, liveWidths],
  );

  const onRowClick = useCallback(
    (r: FlatInstallment) => {
      navigate(routes.financial.billing.details(r.taskId), { state: { returnTo } });
    },
    [navigate, returnTo],
  );

  const headerExtra = (
    <div className="flex items-center gap-2">
      {display.showSearchBox && (
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar..."
            className="h-7 w-40 rounded-md border border-border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );

  // ----- Group helpers -----

  const renderHeader = () => (
    <div
      ref={headerRef}
      className={`grid gap-x-3 ${dens.header} ${
        display.stickyHeader ? "sticky top-0 z-20" : ""
      } bg-muted/95 backdrop-blur-sm border-b border-border font-semibold uppercase tracking-wider text-muted-foreground`}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {cols.map((c, i) => (
        <div
          key={c.key}
          data-col-key={c.key}
          className={`relative truncate select-none ${
            c.align === "center"
              ? "text-center"
              : c.align === "right"
                ? "text-right"
                : ""
          }`}
        >
          {c.label}
          {i < cols.length - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={`Redimensionar coluna ${c.label}`}
              onPointerDown={(e) => onResizeStart(e, c.key)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!liveWidths[c.key]) return;
                const next = { ...liveWidths };
                delete next[c.key];
                setLiveWidths(next);
                writeStoredWidths(instanceId, next);
              }}
              className="absolute top-0 bottom-0 right-0 w-1.5 -mr-[3px] z-30 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderRow = (r: FlatInstallment, i: number) => {
    // Hardcoded chrome — striping/gridLines/hoverHighlight no longer configurable.
    const rowBorder = "border-b border-border last:border-b-0";
    const rowHover = "hover:bg-secondary/50";
    return (
      <div
        key={r.id}
        className={`grid gap-x-3 items-center cursor-pointer transition-colors ${dens.row} ${rowBorder} ${rowHover} ${
          i % 2 === 1 ? "bg-muted/20" : ""
        }`}
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={() => onRowClick(r)}
        role="button"
      >
        {cols.map((c) => (
          <div
            key={c.key}
            className={`min-w-0 overflow-hidden ${
              c.align === "center"
                ? "text-center"
                : c.align === "right"
                  ? "text-right"
                  : ""
            }`}
          >
            {c.render(r)}
          </div>
        ))}
      </div>
    );
  };

  const groupHeader = (label: string, count: number, tone: string) => (
    <div
      className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border-b border-border bg-muted/40 ${tone}`}
    >
      {label}
      <span className="ml-1.5 opacity-60">({count})</span>
    </div>
  );

  const renderRows = () => {
    if (isLoading) {
      return (
        <div className="space-y-1 p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-full rounded bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <IconAlertTriangle className="h-5 w-5 mx-auto mb-1.5 opacity-60" />
          Erro ao carregar boletos.
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <IconCash className="h-6 w-6 mx-auto mb-2 opacity-40" />
          {display.emptyStateMessage?.trim() ||
            "Nenhum boleto encontrado com os filtros atuais."}
        </div>
      );
    }

    if (display.layoutMode === "grouped-by-bucket") {
      const order: FlatInstallment["bucket"][] = [
        "overdue",
        "today",
        "tomorrow",
        "next-7-days",
        "next-30-days",
        "this-month",
      ];
      const labels: Record<FlatInstallment["bucket"], string> = {
        overdue: "Vencidas",
        today: "Vencem hoje",
        tomorrow: "Vencem amanhã",
        "next-7-days": "Próximos 7 dias",
        "next-30-days": "Próximos 30 dias",
        "this-month": "Este mês",
      };
      const tones: Record<FlatInstallment["bucket"], string> = {
        overdue: "text-red-600 dark:text-red-400",
        today: "text-orange-600 dark:text-orange-400",
        tomorrow: "text-amber-600 dark:text-amber-400",
        "next-7-days": "text-yellow-700 dark:text-yellow-400",
        "next-30-days": "text-blue-600 dark:text-blue-400",
        "this-month": "text-indigo-600 dark:text-indigo-400",
      };
      const buckets = new Map<FlatInstallment["bucket"], FlatInstallment[]>();
      for (const r of rows) {
        if (!buckets.has(r.bucket)) buckets.set(r.bucket, []);
        buckets.get(r.bucket)!.push(r);
      }
      const out: React.ReactNode[] = [];
      for (const b of order) {
        const list = buckets.get(b);
        if (!list?.length) continue;
        out.push(
          <div key={`g-${b}`}>
            {groupHeader(labels[b], list.length, tones[b])}
            {list.map((r, i) => renderRow(r, i))}
          </div>,
        );
      }
      return out;
    }

    if (display.layoutMode === "grouped-by-status") {
      const groups = new Map<INSTALLMENT_STATUS, FlatInstallment[]>();
      for (const r of rows) {
        if (!groups.has(r.installmentStatus)) groups.set(r.installmentStatus, []);
        groups.get(r.installmentStatus)!.push(r);
      }
      const order: INSTALLMENT_STATUS[] = [
        INSTALLMENT_STATUS.OVERDUE,
        INSTALLMENT_STATUS.PROCESSING,
        INSTALLMENT_STATUS.PENDING,
        INSTALLMENT_STATUS.PAID,
        INSTALLMENT_STATUS.CANCELLED,
      ];
      const out: React.ReactNode[] = [];
      for (const s of order) {
        const list = groups.get(s);
        if (!list?.length) continue;
        out.push(
          <div key={`gs-${s}`}>
            {groupHeader(INSTALLMENT_STATUS_LABELS[s], list.length, "text-muted-foreground")}
            {list.map((r, i) => renderRow(r, i))}
          </div>,
        );
      }
      return out;
    }

    return rows.map((r, i) => renderRow(r, i));
  };

  return (
    <WidgetCard
      showHeader={display.showHeader ?? true}
      title={
        <span className={accent.classes.text}>{config.title || "Boletos"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      count={display.showCount && !isLoading ? rows.length : null}
      headerExtra={headerExtra}
      viewAllHref={display.showViewAllLink ? routes.financial.billing.root : undefined}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="flex flex-col h-full min-h-0">
        {display.showBucketChips && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0 bg-card">
            {DUE_BUCKETS.map((b) => (
              <BucketChip
                key={b}
                bucket={b}
                active={bucket === b}
                count={bucketCounts[b]}
                onClick={() => setBucket(b)}
              />
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          {renderHeader()}
          {renderRows()}
        </div>
      </div>
    </WidgetCard>
  );
}

// ============================================================================
// Config UI
// ============================================================================

function ConfigComp({
  config,
  onChange,
}: WidgetConfigProps<InstallmentTableConfig>) {
  const set = <K extends keyof InstallmentTableConfig>(
    key: K,
    value: InstallmentTableConfig[K],
  ) => onChange({ ...config, [key]: value });
  const setDisplay = <K extends keyof InstallmentTableConfig["display"]>(
    key: K,
    value: InstallmentTableConfig["display"][K],
  ) => set("display", { ...config.display, [key]: value });
  const setFilter = <K extends keyof InstallmentTableConfig["filters"]>(
    key: K,
    value: InstallmentTableConfig["filters"][K],
  ) => set("filters", { ...config.filters, [key]: value });
  // Sort is now driven by the column-picker's per-row chips.

  const accentColor = (config.accent?.color ?? "blue") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Receipt") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const { data: customersData } = useCustomers({
    page: 1,
    limit: 100,
    orderBy: { fantasyName: "asc" },
  } as any);
  const customers = customersData?.data ?? [];

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar>
          <TabsList className="self-start">
            <TabsTrigger value="appearance" className="gap-1">
              <IconAdjustments className="h-3.5 w-3.5" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="columns" className="gap-1">
              <IconColumns className="h-3.5 w-3.5" /> Colunas e ordenação
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-1">
              <IconFilter className="h-3.5 w-3.5" /> Filtros
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1">
              <IconLayout className="h-3.5 w-3.5" /> Comportamento
            </TabsTrigger>
          </TabsList>
        </WidgetTabsBar>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Destaque (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || accentColor,
                    icon: next.icon || accentIcon,
                    shade: next.shade || accentShade,
                  } as InstallmentTableConfig["accent"])
                }
              />
            </Section>
            <Section title="Cabeçalho e link">
              <div className="space-y-1">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={config.display.showHeader ?? true}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label="Exibir contagem"
                  checked={config.display.showCount}
                  onCheckedChange={(v) => setDisplay("showCount", v)}
                />
                <ToggleRow
                  label="Caixa de busca"
                  checked={config.display.showSearchBox}
                  onCheckedChange={(v) => setDisplay("showSearchBox", v)}
                />
                <ToggleRow
                  label="Chips de vencimento"
                  checked={config.display.showBucketChips}
                  onCheckedChange={(v) => setDisplay("showBucketChips", v)}
                />
                <ToggleRow
                  label='Link "Ver todos"'
                  checked={config.display.showViewAllLink}
                  onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
                />
              </div>
            </Section>
            <Section title="Densidade e linhas">
              <div className="space-y-2">
                <DensitySegmented
                  value={config.display.density}
                  onChange={(d) => setDisplay("density", d)}
                />
                <ToggleRow
                  label="Cabeçalho fixo"
                  checked={config.display.stickyHeader}
                  onCheckedChange={(v) => setDisplay("stickyHeader", v)}
                />
              </div>
            </Section>
            <Section title="Mensagem quando vazio">
              <Input
                value={config.display.emptyStateMessage}
                onChange={(v) =>
                  setDisplay(
                    "emptyStateMessage",
                    typeof v === "string" ? v : "",
                  )
                }
                placeholder="Nenhum boleto encontrado com os filtros atuais."
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* ---- COLUMNS & SORT ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <ColumnPicker
            catalog={COLUMN_KEYS.map((k) => ({ key: k, label: COLUMN_LABELS[k] }))}
            selected={config.columns}
            onChange={(next) =>
              set("columns", next as InstallmentTableConfig["columns"])
            }
            sorts={config.sorts as ColumnSort<ColumnKey>[]}
            onSortsChange={(next) =>
              set("sorts", next as InstallmentTableConfig["sorts"])
            }
          />
          <LimitInput value={config.limit} onChange={(n) => set("limit", n)} />
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="space-y-1.5">
            <Label className="text-xs">Vencimento padrão</Label>
            <Combobox
              mode="single"
              value={config.filters.defaultBucket}
              onValueChange={(v) =>
                setFilter(
                  "defaultBucket",
                  (typeof v === "string" ? v : "next-30-days") as DueBucket,
                )
              }
              options={DUE_BUCKETS.map((b) => ({
                value: b,
                label: DUE_BUCKET_LABELS[b],
              }))}
              clearable={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status da parcela (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.installmentStatuses}
              onValueChange={(v) =>
                setFilter(
                  "installmentStatuses",
                  (Array.isArray(v) ? v : []) as INSTALLMENT_STATUS[],
                )
              }
              options={Object.values(INSTALLMENT_STATUS).map((s) => ({
                value: s,
                label: INSTALLMENT_STATUS_LABELS[s],
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status do boleto (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.bankSlipStatuses}
              onValueChange={(v) =>
                setFilter(
                  "bankSlipStatuses",
                  (Array.isArray(v) ? v : []) as BANK_SLIP_STATUS[],
                )
              }
              options={Object.values(BANK_SLIP_STATUS).map((s) => ({
                value: s,
                label: BANK_SLIP_STATUS_LABELS[s],
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Clientes (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.customerIds}
              onValueChange={(v) =>
                setFilter("customerIds", (Array.isArray(v) ? v : []) as string[])
              }
              options={customers.map((c: any) => ({
                value: c.id,
                label: c.fantasyName ?? c.corporateName ?? c.id,
              }))}
              searchPlaceholder="Buscar cliente..."
            />
          </div>
          <div className="space-y-1">
            <ToggleRow
              label="Esconder pagas"
              checked={config.filters.hideFullyPaid}
              onCheckedChange={(v) => setFilter("hideFullyPaid", v)}
            />
            <ToggleRow
              label="Esconder sem boleto"
              checked={config.filters.hideMissingBankSlip}
              onCheckedChange={(v) => setFilter("hideMissingBankSlip", v)}
            />
          </div>
        </TabsContent>

        {/* ---- BEHAVIOR ---- */}
        <TabsContent value="behavior" className="space-y-3 mt-0">
          <Section title="Layout" defaultOpen>
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de layout</Label>
              <Combobox
                mode="single"
                value={config.display.layoutMode}
                onValueChange={(v) =>
                  setDisplay(
                    "layoutMode",
                    (typeof v === "string" ? v : "flat") as LayoutMode,
                  )
                }
                options={LAYOUT_MODES.map((m) => ({
                  value: m,
                  label: LAYOUT_LABELS[m],
                }))}
                clearable={false}
              />
            </div>
          </Section>
          <Section title="Atualização">
            <div className="space-y-1.5">
              <Label className="text-xs">Atualizar automaticamente</Label>
              <Combobox
                mode="single"
                value={String(config.refetchInterval)}
                onValueChange={(v) => {
                  const n = typeof v === "string" ? Number(v) : 0;
                  set("refetchInterval", Number.isFinite(n) ? n : 0);
                }}
                options={REFETCH_INTERVAL_OPTIONS}
                clearable={false}
              />
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Widget definition
// ============================================================================

export const installmentTableWidget: WidgetDefinition<InstallmentTableConfig> = {
  id: "financial.installments",
  name: "Boletos / Parcelas",
  description:
    "Acompanhamento de boletos e parcelas. Filtros por vencimento (hoje, 7 dias, 30 dias), status, cliente. Suporta agrupamento, busca, densidade e colunas configuráveis.",
  icon: IconReceipt,
  category: "financial",
  // Mirror /financeiro/orcamento page privileges. Financial data — production
  // managers do not get visibility here.
  allowedSectors: [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ],
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 2, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: installmentTableConfigSchema,
  defaultConfig: {
    title: "Boletos",
    accent: { color: "blue", icon: "Receipt" },
    display: {
      ...TABLE_DISPLAY_DEFAULTS,
      // The intersection in configSchema also accepts the bucket-chip / layout
      // extras.
      ...({ showBucketChips: true, layoutMode: "flat" } as any),
    } as any,
    columns: [
      "customer",
      "task",
      "installment",
      "dueDate",
      "countdown",
      "amount",
      "installmentStatus",
      "bankSlipStatus",
    ],
    filters: {
      defaultBucket: "next-30-days",
      installmentStatuses: [],
      bankSlipStatuses: [],
      customerIds: [],
      hideFullyPaid: false,
      hideMissingBankSlip: false,
    },
    sorts: [{ key: "dueDate", direction: "asc" }],
    limit: 50,
    refetchInterval: 0,
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
