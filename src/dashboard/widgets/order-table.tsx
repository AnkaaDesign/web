// Generic, fully configurable purchase-order (Pedido) table widget.
//
// Mirrors the inventory orders list page's column + filter set and the
// gold-standard installment-table widget's robustness so the user can build
// dashboards that track purchase orders end-to-end:
//
//   • Quick forecast buckets (overdue / today / 7 days / 30 days / no date)
//   • Filter by status (CREATED/FULFILLED/RECEIVED/…), supplier, schedule origin
//   • Plain-text search (order number / description / supplier)
//   • Density (compact/comfortable/spacious)
//   • Layout modes (flat / grouped-by-status / grouped-by-supplier)
//   • Configurable column set (number, description, supplier, status, item count,
//     total value, forecast, countdown, payment method, created date)
//   • Accent (color + icon + shade), refresh interval, resizable columns
//
// Data source: useOrders() (createEntityHooks `useList`) with the same
// convenience filters the orders list page uses (status / supplierIds /
// hasItems / isFromSchedule). We fetch a generous window and finish the
// forecast-bucket / grouping / multi-sort client-side — fine for a dashboard
// tile capped at ~200 rows; swapping to a dedicated summary endpoint later is a
// localized change in `useFlatOrders`.

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatCurrency as _formatCurrency } from "@/utils/number";
import { z } from "zod";
import { WidgetTabsBar } from "../components/config-kit";
import { useNavigate } from "react-router-dom";
import { useReturnTo } from "@/hooks/common/use-return-to";
import {
  IconShoppingCart,
  IconSearch,
  IconAlertTriangle,
  IconCalendarDue,
  IconTruck,
  IconAdjustments,
  IconColumns,
  IconFilter,
  IconLayout,
  IconEdit,
  IconEye,
  IconTrash,
} from "@tabler/icons-react";

import { useOrders, useOrderMutations } from "../../hooks/inventory/use-order";
import { useSuppliers } from "../../hooks/inventory/use-supplier";
import { useAuth } from "../../hooks/common/use-auth";
import {
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
  PAYMENT_METHOD,
  SECTOR_PRIVILEGES,
} from "../../constants/enums";
import {
  ORDER_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../constants/enum-labels";
import { routes } from "../../constants/routes";
import type { Order } from "../../types";
import { calculateOrderTotal } from "../../utils/order";

import { Combobox } from "../../components/ui/combobox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { OrderStatusBadge } from "../../components/inventory/order/common/order-status-badge";
import { OrderPaymentStatusBadge } from "../../components/inventory/order/common/order-payment-status-badge";

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
 * forecast-date predicate. Buckets are inclusive of earlier ones — "next-7-days"
 * counts today + overdue too — to match how users think about incoming
 * deliveries. `no-forecast` collects orders without a forecast date.
 */
const FORECAST_BUCKETS = [
  "all",
  "overdue",
  "today",
  "next-7-days",
  "next-30-days",
  "later",
  "no-forecast",
] as const;
type ForecastBucket = (typeof FORECAST_BUCKETS)[number];
const FORECAST_BUCKET_LABELS: Record<ForecastBucket, string> = {
  all: "Todos",
  overdue: "Atrasados",
  today: "Para hoje",
  "next-7-days": "Próximos 7 dias",
  "next-30-days": "Próximos 30 dias",
  later: "Depois",
  "no-forecast": "Sem previsão",
};

const LAYOUT_MODES = [
  "flat",
  "grouped-by-status",
  "grouped-by-supplier",
] as const;
type LayoutMode = (typeof LAYOUT_MODES)[number];
const LAYOUT_LABELS: Record<LayoutMode, string> = {
  flat: "Lista única",
  "grouped-by-status": "Agrupado por status",
  "grouped-by-supplier": "Agrupado por fornecedor",
};

// Natural status progression — used for grouping + status sort.
const ORDER_STATUS_SEQUENCE: ORDER_STATUS[] = [
  ORDER_STATUS.CREATED,
  ORDER_STATUS.PARTIALLY_FULFILLED,
  ORDER_STATUS.FULFILLED,
  ORDER_STATUS.OVERDUE,
  ORDER_STATUS.PARTIALLY_RECEIVED,
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.CANCELLED,
];

// Payment-status filter keys. "A Definir" is not a stored status — it's the
// derived state of an order that is AWAITING_PAYMENT with no payment method
// (mirrors OrderPaymentStatusBadge). It gets its own filter key so it can be
// selected distinctly from "Aguardando Pagamento" (awaiting WITH a method).
const ORDER_PAYMENT_UNDEFINED_KEY = "UNDEFINED" as const;
type PaymentFilterKey = ORDER_PAYMENT_STATUS | typeof ORDER_PAYMENT_UNDEFINED_KEY;

const ORDER_PAYMENT_FILTER_SEQUENCE: PaymentFilterKey[] = [
  ORDER_PAYMENT_UNDEFINED_KEY,
  ORDER_PAYMENT_STATUS.AWAITING_PAYMENT,
  ORDER_PAYMENT_STATUS.PARTIALLY_PAID,
  ORDER_PAYMENT_STATUS.PAID,
];

const ORDER_PAYMENT_FILTER_LABELS: Record<PaymentFilterKey, string> = {
  [ORDER_PAYMENT_UNDEFINED_KEY]: "A Definir",
  ...ORDER_PAYMENT_STATUS_LABELS,
};

function paymentFilterKey(r: FlatOrder): PaymentFilterKey {
  if (r.paymentStatus === ORDER_PAYMENT_STATUS.AWAITING_PAYMENT && !r.paymentMethod) {
    return ORDER_PAYMENT_UNDEFINED_KEY;
  }
  return r.paymentStatus;
}

const COLUMN_KEYS = [
  "orderNumber",
  "description",
  "supplier",
  "status",
  "itemCount",
  "total",
  "forecast",
  "countdown",
  "paymentStatus",
  "paymentMethod",
  "createdAt",
] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  orderNumber: "Nº",
  description: "Descrição",
  supplier: "Fornecedor",
  status: "Status",
  itemCount: "Itens",
  total: "Valor total",
  forecast: "Previsão",
  countdown: "Restante",
  paymentStatus: "Pagamento",
  paymentMethod: "Forma de pagamento",
  createdAt: "Criado em",
};

// ============================================================================
// Schema
// ============================================================================

const orderTableConfigSchemaInner = z.object({
  title: z.string().min(1).max(80).default("Pedidos"),
  accent: makeAccentSchema({
    color: "blue",
    icon: "ShoppingCart",
  }),

  // Canonical cross-platform table display block plus order-specific extras
  // (forecast bucket chips, layout mode). The extras object is `.default()`ed so
  // the intersection still parses when `display` is absent.
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
    .min(1)
    .default([
      "orderNumber",
      "description",
      "supplier",
      "status",
      "itemCount",
      "total",
      "forecast",
    ]),

  filters: z
    .object({
      defaultBucket: z.enum(FORECAST_BUCKETS).default("all"),
      statuses: z.array(z.nativeEnum(ORDER_STATUS)).default([]),
      paymentStatuses: z
        .array(
          z.union([
            z.nativeEnum(ORDER_PAYMENT_STATUS),
            z.literal(ORDER_PAYMENT_UNDEFINED_KEY),
          ]),
        )
        .default([]),
      supplierIds: z.array(z.string()).default([]),
      isFromSchedule: z.enum(["any", "yes", "no"]).default("any"),
      hasItems: z.enum(["any", "yes", "no"]).default("any"),
      // Keep only orders whose payment responsible is the current user.
      assignedToMe: z.boolean().default(false),
      hideReceived: z.boolean().default(false),
      hideCancelled: z.boolean().default(false),
    })
    .default({
      defaultBucket: "all",
      statuses: [],
      paymentStatuses: [],
      supplierIds: [],
      isFromSchedule: "any",
      hasItems: "any",
      assignedToMe: false,
      hideReceived: false,
      hideCancelled: false,
    }),

  sorts: z
    .array(
      z.object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "status", direction: "asc" }]),

  // Server caps the orders endpoint at 100 rows, so the limit tops out there.
  limit: z.number().int().min(5).max(100).default(50),

  // Legacy top-level refresh field. Canonical value lives in
  // `display.refreshIntervalMs`, folded in by the preprocess wrapper below.
  refetchInterval: z.number().int().min(0).default(0),
});

// Back-compat shim: fold any legacy top-level `refetchInterval` into the
// canonical `display.refreshIntervalMs` before validation.
export const orderTableConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const display =
    obj.display && typeof obj.display === "object"
      ? (obj.display as Record<string, unknown>)
      : undefined;
  const hasCanonical = display && typeof display.refreshIntervalMs === "number";
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
}, orderTableConfigSchemaInner);

export type OrderTableConfig = z.infer<typeof orderTableConfigSchema>;

// ============================================================================
// Flat row shape
// ============================================================================

interface FlatOrder {
  id: string;
  orderNumber: number | null;
  description: string;
  supplierId: string | null;
  supplierName: string;
  status: ORDER_STATUS;
  statusOrder: number;
  itemCount: number;
  total: number;
  forecast: Date | null;
  createdAt: Date;
  paymentStatus: ORDER_PAYMENT_STATUS;
  paymentStatusOrder: number;
  paymentMethod: PAYMENT_METHOD | null;
  paymentResponsibleId: string | null;

  // derived
  daysUntilForecast: number | null;
  bucket: ForecastBucket;
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

function formatOrderNumber(n: number | null): string {
  if (n == null) return "—";
  return `#${String(n).padStart(4, "0")}`;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return _formatCurrency(n);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function supplierLabel(
  supplier:
    | { fantasyName?: string | null; corporateName?: string | null }
    | undefined
    | null,
): string {
  if (!supplier) return "—";
  return supplier.fantasyName || supplier.corporateName || "—";
}

function bucketFor(forecast: Date | null, daysUntilForecast: number | null): ForecastBucket {
  if (!forecast || daysUntilForecast == null) return "no-forecast";
  if (daysUntilForecast < 0) return "overdue";
  if (daysUntilForecast === 0) return "today";
  if (daysUntilForecast <= 7) return "next-7-days";
  if (daysUntilForecast <= 30) return "next-30-days";
  return "later";
}

function flattenOrders(orders: Order[] | undefined): FlatOrder[] {
  if (!orders?.length) return [];
  const today = startOfToday();
  return orders.map((o) => {
    const forecast = o.forecast ? new Date(o.forecast) : null;
    const days = forecast ? diffDays(forecast, today) : null;
    const itemCount = o._count?.items ?? o.items?.length ?? 0;
    return {
      id: o.id,
      orderNumber: o.orderNumber ?? null,
      description: o.description ?? "—",
      supplierId: o.supplierId ?? null,
      supplierName: supplierLabel(o.supplier),
      status: o.status,
      statusOrder: o.statusOrder ?? 0,
      itemCount,
      total: calculateOrderTotal(o),
      forecast,
      createdAt: o.createdAt ? new Date(o.createdAt) : today,
      paymentStatus: o.paymentStatus ?? ORDER_PAYMENT_STATUS.AWAITING_PAYMENT,
      paymentStatusOrder: o.paymentStatusOrder ?? 0,
      paymentMethod: o.paymentMethod ?? null,
      paymentResponsibleId: o.paymentResponsibleId ?? null,
      daysUntilForecast: days,
      bucket: bucketFor(forecast, days),
    };
  });
}

function applyFilters(
  rows: FlatOrder[],
  config: OrderTableConfig,
  bucket: ForecastBucket,
  search: string,
  currentUserId: string | null,
): FlatOrder[] {
  const term = search.trim().toLowerCase();
  const f = config.filters;
  return rows.filter((r) => {
    // Forecast bucket (inclusive of earlier buckets for the cumulative ones).
    if (bucket === "overdue" && r.bucket !== "overdue") return false;
    if (bucket === "today" && r.bucket !== "today") return false;
    if (bucket === "next-7-days") {
      if (r.daysUntilForecast == null || r.daysUntilForecast > 7) return false;
    }
    if (bucket === "next-30-days") {
      if (r.daysUntilForecast == null || r.daysUntilForecast > 30) return false;
    }
    if (bucket === "later" && r.bucket !== "later") return false;
    if (bucket === "no-forecast" && r.bucket !== "no-forecast") return false;

    if (f.assignedToMe) {
      if (!currentUserId || r.paymentResponsibleId !== currentUserId) return false;
    }

    if (f.hideReceived && r.status === ORDER_STATUS.RECEIVED) return false;
    if (f.hideCancelled && r.status === ORDER_STATUS.CANCELLED) return false;

    if (f.paymentStatuses.length > 0 && !f.paymentStatuses.includes(paymentFilterKey(r)))
      return false;

    if (term) {
      const hay =
        `${formatOrderNumber(r.orderNumber)} ${r.description} ${r.supplierName}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function compareRows(a: FlatOrder, b: FlatOrder, key: string): number {
  switch (key) {
    case "orderNumber":
      return (a.orderNumber ?? Infinity) - (b.orderNumber ?? Infinity);
    case "description":
      return a.description.localeCompare(b.description);
    case "supplier":
      return a.supplierName.localeCompare(b.supplierName);
    case "status":
      return a.statusOrder - b.statusOrder;
    case "paymentStatus":
      return a.paymentStatusOrder - b.paymentStatusOrder;
    case "itemCount":
      return a.itemCount - b.itemCount;
    case "total":
      return a.total - b.total;
    case "forecast":
      // Nulls last regardless of direction is hard with a single sign; push
      // null forecasts to the largest timestamp so ascending lists them last.
      return (
        (a.forecast?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.forecast?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    case "createdAt":
      return a.createdAt.getTime() - b.createdAt.getTime();
    default:
      return 0;
  }
}

function applySort(rows: FlatOrder[], sorts: OrderTableConfig["sorts"]): FlatOrder[] {
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

const ORDER_INCLUDE = {
  supplier: {
    select: { id: true, fantasyName: true, corporateName: true },
  },
  items: {
    select: {
      id: true,
      orderedQuantity: true,
      receivedQuantity: true,
      price: true,
      icms: true,
      ipi: true,
    },
  },
  _count: { select: { items: true } },
} as const;

function useFlatOrders(config: OrderTableConfig, refreshIntervalMs: number) {
  const params = useMemo(() => {
    const f = config.filters;
    const p: Record<string, unknown> = {
      // Fetch the largest window the orders endpoint allows (server caps
      // take/limit at 100) so forecast-bucket counts reflect the full
      // landscape; the visible list is sliced to `config.limit` client-side.
      take: 100,
      orderBy: [{ statusOrder: "asc" }, { forecast: "asc" }],
      include: ORDER_INCLUDE,
    };
    if (f.statuses.length > 0) p.status = f.statuses;
    if (f.supplierIds.length > 0) p.supplierIds = f.supplierIds;
    if (f.isFromSchedule === "yes") p.isFromSchedule = true;
    if (f.isFromSchedule === "no") p.isFromSchedule = false;
    if (f.hasItems === "yes") p.hasItems = true;
    if (f.hasItems === "no") p.hasItems = false;
    return p;
  }, [config.filters]);

  const { data, isLoading, isError, refresh } = useOrders(
    params as any,
    refreshIntervalMs > 0 ? { refetchInterval: refreshIntervalMs } : undefined,
  );
  const rows = useMemo(() => flattenOrders(data?.data), [data?.data]);
  return { rows, isLoading, isError, refresh };
}

// ============================================================================
// Bucket bar
// ============================================================================

const BUCKET_VARIANTS: Record<ForecastBucket, { tone: string; icon?: any }> = {
  all: { tone: "border-border" },
  overdue: {
    tone: "border-red-500/40 text-red-600 dark:text-red-400",
    icon: IconAlertTriangle,
  },
  today: {
    tone: "border-orange-500/40 text-orange-600 dark:text-orange-400",
    icon: IconCalendarDue,
  },
  "next-7-days": {
    tone: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  },
  "next-30-days": {
    tone: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  },
  later: { tone: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400" },
  "no-forecast": {
    tone: "border-border text-muted-foreground",
  },
};

function BucketChip({
  bucket,
  active,
  count,
  onClick,
}: {
  bucket: ForecastBucket;
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
      <span>{FORECAST_BUCKET_LABELS[bucket]}</span>
      <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>
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
  render: (r: FlatOrder) => React.ReactNode;
}

function makeColumns(): Record<ColumnKey, ColumnDef> {
  return {
    orderNumber: {
      key: "orderNumber",
      label: COLUMN_LABELS.orderNumber,
      width: "minmax(0, 0.5fr)",
      render: (r) => (
        <span className="tabular-nums font-mono font-medium">
          {formatOrderNumber(r.orderNumber)}
        </span>
      ),
    },
    description: {
      key: "description",
      label: COLUMN_LABELS.description,
      width: "minmax(0, 1.8fr)",
      render: (r) => (
        <div className="block truncate font-medium pr-2" title={r.description}>
          {r.description}
        </div>
      ),
    },
    supplier: {
      key: "supplier",
      label: COLUMN_LABELS.supplier,
      width: "minmax(0, 1.3fr)",
      render: (r) => (
        <div className="block truncate pr-2" title={r.supplierName}>
          {r.supplierName}
        </div>
      ),
    },
    status: {
      key: "status",
      label: COLUMN_LABELS.status,
      width: "minmax(0, 1fr)",
      render: (r) => <OrderStatusBadge status={r.status} size="sm" />,
    },
    itemCount: {
      key: "itemCount",
      label: COLUMN_LABELS.itemCount,
      width: "minmax(0, 0.45fr)",
      align: "center",
      render: (r) => <span className="tabular-nums">{r.itemCount}</span>,
    },
    total: {
      key: "total",
      label: COLUMN_LABELS.total,
      width: "minmax(0, 0.8fr)",
      align: "right",
      render: (r) => (
        <span className="tabular-nums whitespace-nowrap font-medium">
          {formatCurrency(r.total)}
        </span>
      ),
    },
    forecast: {
      key: "forecast",
      label: COLUMN_LABELS.forecast,
      width: "minmax(0, 0.7fr)",
      render: (r) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatDate(r.forecast)}
        </span>
      ),
    },
    countdown: {
      key: "countdown",
      label: COLUMN_LABELS.countdown,
      width: "minmax(0, 0.6fr)",
      align: "center",
      render: (r) => {
        if (r.status === ORDER_STATUS.RECEIVED) {
          return (
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
              Recebido
            </span>
          );
        }
        if (r.status === ORDER_STATUS.CANCELLED) {
          return <span className="text-muted-foreground text-[10px]">Cancelado</span>;
        }
        const days = r.daysUntilForecast;
        if (days == null) return <span className="text-muted-foreground">—</span>;
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
    paymentStatus: {
      key: "paymentStatus",
      label: COLUMN_LABELS.paymentStatus,
      width: "minmax(0, 1fr)",
      render: (r) => (
        <OrderPaymentStatusBadge
          status={r.paymentStatus}
          paymentMethod={r.paymentMethod}
          size="sm"
        />
      ),
    },
    paymentMethod: {
      key: "paymentMethod",
      label: COLUMN_LABELS.paymentMethod,
      width: "minmax(0, 0.8fr)",
      render: (r) =>
        r.paymentMethod ? (
          <span className="text-muted-foreground">
            {PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    createdAt: {
      key: "createdAt",
      label: COLUMN_LABELS.createdAt,
      width: "minmax(0, 0.7fr)",
      render: (r) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatDate(r.createdAt)}
        </span>
      ),
    },
  };
}

// ============================================================================
// Per-instance column-width persistence
// ============================================================================

const COLUMN_WIDTHS_STORAGE_PREFIX = "order-table-widget:column-widths:";

function readStoredWidths(instanceId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(
      COLUMN_WIDTHS_STORAGE_PREFIX + instanceId,
    );
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

function Render({ config, instanceId }: WidgetRenderProps<OrderTableConfig>) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const display = config.display;
  const dens = densityClasses(display.density);

  const [searchInput, setSearchInput] = useState("");
  const [bucket, setBucket] = useState<ForecastBucket>(config.filters.defaultBucket);
  const debouncedSearch = useDeferredValue(searchInput);

  // Right-click context menu + delete confirmation state.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    order: FlatOrder;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ order: FlatOrder } | null>(null);
  const { deleteAsync: deleteOrderAsync } = useOrderMutations();

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
  const refreshIntervalMs = display.refreshIntervalMs || config.refetchInterval || 0;
  const {
    rows: rawRows,
    isLoading,
    isError,
  } = useFlatOrders(config, refreshIntervalMs);

  // Pre-compute bucket counts against ALL fetched rows so the chip counts
  // reflect the global landscape rather than the filtered view.
  const bucketCounts = useMemo(() => {
    const counts: Record<ForecastBucket, number> = {
      all: rawRows.length,
      overdue: 0,
      today: 0,
      "next-7-days": 0,
      "next-30-days": 0,
      later: 0,
      "no-forecast": 0,
    };
    for (const r of rawRows) {
      if (r.bucket === "overdue") counts.overdue += 1;
      if (r.bucket === "today") counts.today += 1;
      if (r.daysUntilForecast != null && r.daysUntilForecast >= 0 && r.daysUntilForecast <= 7)
        counts["next-7-days"] += 1;
      if (r.daysUntilForecast != null && r.daysUntilForecast >= 0 && r.daysUntilForecast <= 30)
        counts["next-30-days"] += 1;
      if (r.bucket === "later") counts.later += 1;
      if (r.bucket === "no-forecast") counts["no-forecast"] += 1;
    }
    return counts;
  }, [rawRows]);

  const rows = useMemo(() => {
    const filtered = applyFilters(rawRows, config, bucket, debouncedSearch, currentUserId);
    const sorted = applySort(filtered, config.sorts);
    return sorted.slice(0, config.limit);
  }, [rawRows, config, bucket, debouncedSearch, currentUserId]);

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
    (r: FlatOrder) => {
      navigate(routes.inventory.orders.details(r.id), { state: { returnTo } });
    },
    [navigate, returnTo],
  );

  const handleContextMenu = (e: React.MouseEvent, order: FlatOrder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, order });
  };

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

  // ----- Render helpers -----

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

  const renderRow = (r: FlatOrder, i: number) => {
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
        onContextMenu={(e) => handleContextMenu(e, r)}
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
            <div key={i} className="h-7 w-full rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <IconAlertTriangle className="h-5 w-5 mx-auto mb-1.5 opacity-60" />
          Erro ao carregar pedidos.
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <IconTruck className="h-6 w-6 mx-auto mb-2 opacity-40" />
          {display.emptyStateMessage?.trim() ||
            "Nenhum pedido encontrado com os filtros atuais."}
        </div>
      );
    }

    if (display.layoutMode === "grouped-by-status") {
      const groups = new Map<ORDER_STATUS, FlatOrder[]>();
      for (const r of rows) {
        if (!groups.has(r.status)) groups.set(r.status, []);
        groups.get(r.status)!.push(r);
      }
      const out: React.ReactNode[] = [];
      for (const s of ORDER_STATUS_SEQUENCE) {
        const list = groups.get(s);
        if (!list?.length) continue;
        out.push(
          <div key={`gs-${s}`}>
            {groupHeader(ORDER_STATUS_LABELS[s], list.length, "text-muted-foreground")}
            {list.map((r, i) => renderRow(r, i))}
          </div>,
        );
      }
      return out;
    }

    if (display.layoutMode === "grouped-by-supplier") {
      const groups = new Map<string, FlatOrder[]>();
      for (const r of rows) {
        if (!groups.has(r.supplierName)) groups.set(r.supplierName, []);
        groups.get(r.supplierName)!.push(r);
      }
      const out: React.ReactNode[] = [];
      for (const name of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
        const list = groups.get(name)!;
        out.push(
          <div key={`gsup-${name}`}>
            {groupHeader(name, list.length, "text-muted-foreground")}
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
      title={<span className={accent.classes.text}>{config.title || "Pedidos"}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      count={display.showCount && !isLoading ? rows.length : null}
      headerExtra={headerExtra}
      viewAllHref={display.showViewAllLink ? routes.inventory.orders.root : undefined}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="flex flex-col h-full min-h-0">
        {display.showBucketChips && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0 bg-card">
            {FORECAST_BUCKETS.map((b) => (
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

      {/* Right-click context menu — view / edit / delete. Radix handles
          outside-click and item-click closing on its own. */}
      <DropdownMenu
        open={!!contextMenu}
        onOpenChange={(open) => !open && setContextMenu(null)}
      >
        <DropdownMenuContent
          style={{ position: "fixed", left: contextMenu?.x, top: contextMenu?.y }}
          className="w-48"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            onClick={() =>
              contextMenu &&
              navigate(routes.inventory.orders.details(contextMenu.order.id), {
                state: { returnTo },
              })
            }
          >
            <IconEye className="mr-2 h-4 w-4" />
            Abrir detalhes
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              contextMenu &&
              navigate(routes.inventory.orders.edit(contextMenu.order.id), {
                state: { returnTo },
              })
            }
          >
            <IconEdit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => contextMenu && setDeleteDialog({ order: contextMenu.order })}
            className="text-destructive"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.{" "}
              {deleteDialog?.order && (
                <span className="font-medium">
                  {formatOrderNumber(deleteDialog.order.orderNumber)} ·{" "}
                  {deleteDialog.order.description}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteDialog) return;
                try {
                  await deleteOrderAsync(deleteDialog.order.id);
                } finally {
                  setDeleteDialog(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetCard>
  );
}

// ============================================================================
// Config UI
// ============================================================================

function ConfigComp({ config, onChange }: WidgetConfigProps<OrderTableConfig>) {
  const set = <K extends keyof OrderTableConfig>(
    key: K,
    value: OrderTableConfig[K],
  ) => onChange({ ...config, [key]: value });
  const setDisplay = <K extends keyof OrderTableConfig["display"]>(
    key: K,
    value: OrderTableConfig["display"][K],
  ) => set("display", { ...config.display, [key]: value });
  const setFilter = <K extends keyof OrderTableConfig["filters"]>(
    key: K,
    value: OrderTableConfig["filters"][K],
  ) => set("filters", { ...config.filters, [key]: value });

  const accentColor = (config.accent?.color ?? "blue") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "ShoppingCart") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const { data: suppliersData } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    limit: 100,
  } as any);
  const supplierOptions = useMemo(
    () =>
      (suppliersData?.data ?? []).map((s: any) => ({
        value: s.id,
        label: s.fantasyName || s.corporateName || s.id,
      })),
    [suppliersData?.data],
  );

  const triStateOptions = [
    { value: "any", label: "Qualquer" },
    { value: "yes", label: "Sim" },
    { value: "no", label: "Não" },
  ];

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
                  } as OrderTableConfig["accent"])
                }
              />
            </Section>
            <Section title="Densidade e linhas">
              <div className="space-y-2">
                <DensitySegmented
                  value={config.display.density}
                  onChange={(d) => setDisplay("density", d)}
                />
              </div>
            </Section>
            <Section title="Cabeçalho e link">
              <div className="space-y-1">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={config.display.showHeader ?? true}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label="Cabeçalho fixo"
                  checked={config.display.stickyHeader}
                  onCheckedChange={(v) => setDisplay("stickyHeader", v)}
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
                  label="Chips de previsão"
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
            <Section title="Mensagem quando vazio">
              <Input
                value={config.display.emptyStateMessage}
                onChange={(v) =>
                  setDisplay("emptyStateMessage", typeof v === "string" ? v : "")
                }
                placeholder="Nenhum pedido encontrado com os filtros atuais."
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* ---- COLUMNS & SORT ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <ColumnPicker
            catalog={COLUMN_KEYS.map((k) => ({ key: k, label: COLUMN_LABELS[k] }))}
            selected={config.columns}
            onChange={(next) => set("columns", next as OrderTableConfig["columns"])}
            sorts={config.sorts as ColumnSort<ColumnKey>[]}
            onSortsChange={(next) => set("sorts", next as OrderTableConfig["sorts"])}
          />
          <LimitInput value={config.limit} onChange={(n) => set("limit", n)} max={100} />
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="space-y-1.5">
            <Label className="text-xs">Previsão padrão</Label>
            <Combobox
              mode="single"
              value={config.filters.defaultBucket}
              onValueChange={(v) =>
                setFilter(
                  "defaultBucket",
                  (typeof v === "string" ? v : "all") as ForecastBucket,
                )
              }
              options={FORECAST_BUCKETS.map((b) => ({
                value: b,
                label: FORECAST_BUCKET_LABELS[b],
              }))}
              clearable={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.statuses}
              onValueChange={(v) =>
                setFilter("statuses", (Array.isArray(v) ? v : []) as ORDER_STATUS[])
              }
              options={ORDER_STATUS_SEQUENCE.map((s) => ({
                value: s,
                label: ORDER_STATUS_LABELS[s],
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status de pagamento (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.paymentStatuses}
              onValueChange={(v) =>
                setFilter(
                  "paymentStatuses",
                  (Array.isArray(v) ? v : []) as PaymentFilterKey[],
                )
              }
              options={ORDER_PAYMENT_FILTER_SEQUENCE.map((s) => ({
                value: s,
                label: ORDER_PAYMENT_FILTER_LABELS[s],
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedores (vazio = todos)</Label>
            <Combobox
              mode="multiple"
              value={config.filters.supplierIds}
              onValueChange={(v) =>
                setFilter("supplierIds", (Array.isArray(v) ? v : []) as string[])
              }
              options={supplierOptions}
              searchPlaceholder="Buscar fornecedor..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Origem agendamento</Label>
              <Combobox
                mode="single"
                value={config.filters.isFromSchedule}
                onValueChange={(v) =>
                  setFilter(
                    "isFromSchedule",
                    (typeof v === "string"
                      ? v
                      : "any") as OrderTableConfig["filters"]["isFromSchedule"],
                  )
                }
                options={triStateOptions}
                clearable={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tem itens</Label>
              <Combobox
                mode="single"
                value={config.filters.hasItems}
                onValueChange={(v) =>
                  setFilter(
                    "hasItems",
                    (typeof v === "string"
                      ? v
                      : "any") as OrderTableConfig["filters"]["hasItems"],
                  )
                }
                options={triStateOptions}
                clearable={false}
              />
            </div>
          </div>
          <div className="space-y-1">
            <ToggleRow
              label="Atribuídos a mim"
              checked={config.filters.assignedToMe}
              onCheckedChange={(v) => setFilter("assignedToMe", v)}
            />
            <ToggleRow
              label="Esconder recebidos"
              checked={config.filters.hideReceived}
              onCheckedChange={(v) => setFilter("hideReceived", v)}
            />
            <ToggleRow
              label="Esconder cancelados"
              checked={config.filters.hideCancelled}
              onCheckedChange={(v) => setFilter("hideCancelled", v)}
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

export const orderTableWidget: WidgetDefinition<OrderTableConfig> = {
  id: "inventory.orders",
  name: "Pedidos",
  description:
    "Tabela de pedidos de compra totalmente configurável. Filtros por previsão de entrega (atrasados, 7 dias, 30 dias), status e fornecedor. Suporta agrupamento, busca, densidade e colunas configuráveis.",
  icon: IconShoppingCart,
  // Mirror /estoque/pedidos page (parent /estoque is [WAREHOUSE, ADMIN]).
  category: "inventory",
  allowedSectors: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.WAREHOUSE],
  defaultSize: { cols: 3, rows: 2 },
  minSize: { cols: 2, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: orderTableConfigSchema,
  defaultConfig: {
    title: "Pedidos",
    accent: { color: "blue", icon: "ShoppingCart" },
    display: {
      ...TABLE_DISPLAY_DEFAULTS,
      ...({ showBucketChips: true, layoutMode: "flat" } as any),
    } as any,
    columns: [
      "orderNumber",
      "description",
      "supplier",
      "status",
      "itemCount",
      "total",
      "forecast",
    ],
    filters: {
      defaultBucket: "all",
      statuses: [],
      paymentStatuses: [],
      supplierIds: [],
      isFromSchedule: "any",
      hasItems: "any",
      assignedToMe: false,
      hideReceived: false,
      hideCancelled: false,
    },
    sorts: [{ key: "status", direction: "asc" }],
    limit: 50,
    refetchInterval: 0,
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
