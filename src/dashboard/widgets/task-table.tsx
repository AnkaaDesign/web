// Generic, fully configurable task table widget.
//
// Mirrors the production task preparation page's column + filter set, plus
// per-instance overrides for visual density, deadline color thresholds,
// runtime search, layout mode (flat / grouped-by-status / tabs), refetch
// interval, and named local presets.
//
// File is organized in clearly labeled sections. The catalog and config UI
// are intentionally co-located so adding a new column means touching one file.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconAdjustments,
  IconClipboardText,
  IconColumns,
  IconCornerDownLeft,
  IconDownload,
  IconFileImport,
  IconFilter,
  IconLayout,
  IconPalette,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import {
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  IMPLEMENT_TYPE,
  IMPLEMENT_TYPE_LABELS,
  PAINT_FINISH,
  PAINT_FINISH_LABELS,
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_TYPE_LABELS,
  TASK_QUOTE_STATUS,
  TASK_QUOTE_STATUS_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  TRUCK_CATEGORY,
  TRUCK_CATEGORY_LABELS,
} from "../../constants";
import type { Task } from "../../types";
import { useTasks } from "../../hooks/production/use-task";
import { useSectors } from "../../hooks/administration/use-sector";
import { useCustomers } from "../../hooks/administration/use-customer";
import {
  DEADLINE_COLOR_LABELS,
  DEADLINE_COLOR_TOKENS,
  DEFAULT_FORECAST_COLOR_CONFIG,
  DEFAULT_TERM_COLOR_CONFIG,
  deadlineColorSwatchClass,
  deadlineColorTextClass,
  getForecastColorClass,
  getTermColorClass,
  isOverdue as isTaskOverdue,
  type DeadlineColorToken,
  type ForecastColorConfig,
  type TermColorConfig,
} from "../../utils/task-date-colors";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { CanvasNormalMapRenderer } from "../../components/painting/effects/canvas-normal-map-renderer";
import { ServiceOrderCell } from "../../components/production/task/history/service-order-cell";
import { DeadlineCountdown } from "../../components/production/task/schedule/deadline-countdown";
import { QuoteStatusBadge } from "../../components/production/task/quote/quote-status-badge";

import { WidgetCard } from "../components/widget-card";
import { ColumnPicker } from "../components/column-picker";
import { AccentPicker, resolveAccent } from "../components/widget-accent";
import { Section, ToggleRow, LimitInput } from "./_shared";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

// ============================================================================
// Helpers
// ============================================================================

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}
function formatDateTimeShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "—";
  }
}
function formatCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function isoOrNull(d: Date | undefined): string | null {
  return d ? d.toISOString() : null;
}
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

// ============================================================================
// Status badge — outline pill with status-specific tint, used when
// `cellModes.status === "badge"`. Matches prep page's getTaskStatusColor
// without depending on its variant API.
// ============================================================================

const STATUS_BADGE_CLASSES: Record<TASK_STATUS, string> = {
  [TASK_STATUS.PREPARATION]:
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  [TASK_STATUS.WAITING_PRODUCTION]:
    "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  [TASK_STATUS.IN_PRODUCTION]:
    "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  [TASK_STATUS.COMPLETED]:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  [TASK_STATUS.CANCELLED]:
    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};
const STATUS_DOT_CLASSES: Record<TASK_STATUS, string> = {
  [TASK_STATUS.PREPARATION]: "bg-amber-500",
  [TASK_STATUS.WAITING_PRODUCTION]: "bg-blue-500",
  [TASK_STATUS.IN_PRODUCTION]: "bg-violet-500",
  [TASK_STATUS.COMPLETED]: "bg-emerald-500",
  [TASK_STATUS.CANCELLED]: "bg-rose-500",
};

function StatusCell({
  status,
  mode,
}: {
  status: TASK_STATUS;
  mode: "badge" | "dot-label" | "text";
}) {
  const label = TASK_STATUS_LABELS[status] ?? status;
  if (mode === "badge") {
    return (
      <Badge
        variant="outline"
        className={`${STATUS_BADGE_CLASSES[status]} text-[10px] py-0 px-1.5 font-medium border`}
      >
        {label}
      </Badge>
    );
  }
  if (mode === "dot-label") {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_CLASSES[status]}`} />
        <span className="text-sm truncate">{label}</span>
      </span>
    );
  }
  return <span className="text-sm truncate">{label}</span>;
}

// ============================================================================
// Paint cell — three modes: full canvas swatch (matches prep page), swatch +
// name, or name only. Falls back to a colored dot when the paint has no hex.
// ============================================================================

function PaintCell({
  paint,
  mode,
}: {
  paint: any | null | undefined;
  mode: "swatch" | "swatch-name" | "name";
}) {
  if (!paint?.name) return <span className="text-muted-foreground text-sm">—</span>;
  const finish = (paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID;
  const hex = paint.hex || "#888888";
  const swatch = (
    <div className="w-12 h-6 rounded-md ring-1 ring-border shadow-sm overflow-hidden shrink-0">
      {paint.colorPreview ? (
        <img
          src={paint.colorPreview}
          alt={paint.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <CanvasNormalMapRenderer
          baseColor={hex}
          finish={finish}
          width={48}
          height={24}
          quality="medium"
          className="w-full h-full"
        />
      )}
    </div>
  );
  const tooltip = (
    <TooltipContent side="top" className="max-w-xs">
      <div className="space-y-0.5">
        <div className="font-semibold text-sm">{paint.name}</div>
        {finish && (
          <div className="text-xs text-muted-foreground">{PAINT_FINISH_LABELS[finish]}</div>
        )}
        {paint.paintType?.name && (
          <div className="text-xs text-muted-foreground">{paint.paintType.name}</div>
        )}
      </div>
    </TooltipContent>
  );

  if (mode === "swatch") {
    return (
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <div className="-my-1 flex items-center">{swatch}</div>
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
    );
  }
  if (mode === "name") {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span
          className="h-3 w-3 rounded-full border border-border shrink-0"
          style={{ backgroundColor: hex }}
        />
        <span className="text-sm truncate">{paint.name}</span>
      </span>
    );
  }
  // swatch-name (default)
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 min-w-0 -my-1">
          {swatch}
          <span className="text-sm truncate">{paint.name}</span>
        </span>
      </TooltipTrigger>
      {tooltip}
    </Tooltip>
  );
}

// ============================================================================
// SO open helpers (legacy count columns)
// ============================================================================

const SO_OPEN_STATUSES = new Set<string>([
  "PENDING",
  "IN_PROGRESS",
  "PAUSED",
  "WAITING_APPROVE",
]);
function countOpenSO(task: Task): number {
  return (task.serviceOrders ?? []).filter((so) => SO_OPEN_STATUSES.has(so.status as string))
    .length;
}
function countSOByType(task: Task, type: string): number {
  return (task.serviceOrders ?? []).filter((so) => (so.type as string) === type).length;
}

// ============================================================================
// Column catalog — built as a factory so cell rendering can read the live
// config (cell modes, deadline colors, density). Each entry yields a default
// CSS grid track which the user can override via `columnWidths`.
// ============================================================================

type ColumnKey =
  // identity
  | "name"
  | "customerName"
  | "responsibles"
  | "serialNumber"
  | "chassisNumber"
  | "plate"
  | "spot"
  | "sector"
  // workflow
  | "status"
  | "commission"
  // dates
  | "term"
  | "remainingTime"
  | "forecastDate"
  | "createdAt"
  | "entryDate"
  | "startedAt"
  | "finishedAt"
  // paint
  | "generalPainting"
  | "logoPaints"
  | "paintFinish"
  // truck
  | "truckCategory"
  | "implementType"
  // money
  | "quoteTotal"
  | "quoteStatus"
  | "price"
  // text
  | "observation"
  | "details"
  // service orders — rich rendering, configurable
  | "soProduction"
  | "soCommercial"
  | "soLogistic"
  | "soArtwork"
  // service orders — legacy count columns (kept for back-compat)
  | "soCount"
  | "soOpenCount"
  | "soProductionCount"
  | "soCommercialCount"
  | "soLogisticCount"
  | "soArtworkCount"
  // characteristics
  | "hasArtworks"
  | "hasOpenSO"
  | "hasBudget"
  | "hasObservation";

const COLUMN_KEY_VALUES: readonly ColumnKey[] = [
  "name",
  "customerName",
  "responsibles",
  "serialNumber",
  "chassisNumber",
  "plate",
  "spot",
  "sector",
  "status",
  "commission",
  "term",
  "remainingTime",
  "forecastDate",
  "createdAt",
  "entryDate",
  "startedAt",
  "finishedAt",
  "generalPainting",
  "logoPaints",
  "paintFinish",
  "truckCategory",
  "implementType",
  "quoteTotal",
  "quoteStatus",
  "price",
  "observation",
  "details",
  "soProduction",
  "soCommercial",
  "soLogistic",
  "soArtwork",
  "soCount",
  "soOpenCount",
  "soProductionCount",
  "soCommercialCount",
  "soLogisticCount",
  "soArtworkCount",
  "hasArtworks",
  "hasOpenSO",
  "hasBudget",
  "hasObservation",
] as const;

interface RenderCtx {
  cellModes: { serviceOrder: "count" | "progress-bar"; paint: "swatch" | "swatch-name" | "name"; status: "badge" | "dot-label" | "text" };
  forecast: ForecastColorConfig;
  term: TermColorConfig;
  bold: boolean;
}

interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** CSS Grid track — falls back when `columnWidths` has no override. */
  track: string;
  /** Some cells (SO progress bar, forecast corner flag) use `position:absolute` —
   * the wrapping cell must be `position:relative`. */
  needsRelative?: boolean;
  render: (task: Task, ctx: RenderCtx) => React.ReactNode;
}

function dateClassFor(
  value: Date | string | null | undefined,
  kind: "term" | "forecast",
  ctx: RenderCtx,
): string {
  const cls =
    kind === "term"
      ? getTermColorClass(value, ctx.term)
      : getForecastColorClass(value, ctx.forecast);
  if (!cls) return "";
  return ctx.bold ? `${cls} font-medium` : cls;
}

function buildColumnCatalog(): ColumnDef[] {
  return [
    {
      key: "name",
      label: "Logomarca",
      track: "minmax(0, 1.5fr)",
      render: (t) => <span className="text-sm truncate">{t.name || "—"}</span>,
    },
    {
      key: "customerName",
      label: "Cliente",
      track: "minmax(0, 1.2fr)",
      render: (t) => (
        <span className="text-sm truncate">
          {t.customer?.fantasyName || t.customer?.corporateName || "—"}
        </span>
      ),
    },
    {
      key: "responsibles",
      label: "Responsáveis",
      track: "minmax(0, 1.2fr)",
      render: (t) => {
        const list = ((t as any).responsibles ?? []) as Array<{ name?: string }>;
        if (list.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <span className="text-sm truncate">
            {list.map((r) => r.name).filter(Boolean).join(", ") || "—"}
          </span>
        );
      },
    },
    {
      key: "serialNumber",
      label: "Identificador",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm font-mono truncate">{t.serialNumber || "—"}</span>
      ),
    },
    {
      key: "chassisNumber",
      label: "Chassi",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm font-mono truncate">
          {(t.truck as any)?.chassisNumber || "—"}
        </span>
      ),
    },
    {
      key: "plate",
      label: "Placa",
      track: "minmax(0, 0.8fr)",
      render: (t) =>
        t.truck?.plate ? (
          <Badge variant="default" className="text-[10px] py-0 px-1.5 font-mono">
            {t.truck.plate}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "spot",
      label: "Local",
      track: "minmax(0, 0.7fr)",
      render: (t) => {
        const spot = (t.truck as any)?.spot as string | null | undefined;
        if (!spot) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge variant="default" className="text-[10px] py-0 px-1.5 font-mono">
            {spot.replace(/_/g, "-")}
          </Badge>
        );
      },
    },
    {
      key: "sector",
      label: "Setor",
      track: "minmax(0, 1fr)",
      render: (t) =>
        t.sector?.name ? (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 truncate">
            {t.sector.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      track: "minmax(0, 0.9fr)",
      render: (t, ctx) => <StatusCell status={t.status} mode={ctx.cellModes.status} />,
    },
    {
      key: "commission",
      label: "Comissão",
      track: "minmax(0, 1fr)",
      render: (t) => {
        const c = (t as any).commission as COMMISSION_STATUS | null | undefined;
        if (!c) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 truncate">
            {COMMISSION_STATUS_LABELS[c] ?? c}
          </Badge>
        );
      },
    },
    {
      key: "term",
      label: "Prazo",
      track: "minmax(0, 1fr)",
      render: (t, ctx) => {
        const cls = dateClassFor(t.term, "term", ctx);
        return (
          <span className={`text-sm tabular-nums ${cls}`}>{formatDateTimeShort(t.term)}</span>
        );
      },
    },
    {
      key: "remainingTime",
      label: "Tempo restante",
      track: "minmax(0, 1fr)",
      render: (t, ctx) => {
        if (
          t.status === TASK_STATUS.COMPLETED ||
          t.status === TASK_STATUS.CANCELLED ||
          !t.term
        ) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        const overdue = isTaskOverdue(t.term);
        const cls = dateClassFor(t.term, "term", ctx);
        return (
          <span className={`tabular-nums text-sm ${cls}`}>
            <DeadlineCountdown deadline={t.term} isOverdue={overdue} />
          </span>
        );
      },
    },
    {
      key: "forecastDate",
      label: "Previsão",
      track: "minmax(0, 1fr)",
      render: (t, ctx) => {
        const cls = dateClassFor(t.forecastDate, "forecast", ctx);
        return (
          <span className={`text-sm tabular-nums ${cls}`}>
            {formatDateTimeShort(t.forecastDate)}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Criado em",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm tabular-nums">{formatDateTimeShort(t.createdAt)}</span>
      ),
    },
    {
      key: "entryDate",
      label: "Entrada",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm tabular-nums">{formatDateTimeShort(t.entryDate)}</span>
      ),
    },
    {
      key: "startedAt",
      label: "Iniciada em",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm tabular-nums">{formatDateTimeShort(t.startedAt)}</span>
      ),
    },
    {
      key: "finishedAt",
      label: "Concluída em",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm tabular-nums">{formatDateTimeShort(t.finishedAt)}</span>
      ),
    },
    {
      key: "generalPainting",
      label: "Pintura",
      track: "minmax(0, 1.2fr)",
      render: (t, ctx) => <PaintCell paint={t.generalPainting} mode={ctx.cellModes.paint} />,
    },
    {
      key: "logoPaints",
      label: "Pinturas (logo)",
      track: "minmax(0, 1.4fr)",
      render: (t, ctx) => {
        const list = (t.logoPaints ?? []) as any[];
        if (list.length === 0)
          return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {list.slice(0, 3).map((p) => (
              <PaintCell key={p.id} paint={p} mode={ctx.cellModes.paint === "name" ? "name" : "swatch"} />
            ))}
            {list.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{list.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "paintFinish",
      label: "Acabamento",
      track: "minmax(0, 0.9fr)",
      render: (t) => {
        const f = (t.generalPainting as any)?.finish as PAINT_FINISH | undefined;
        if (!f) return <span className="text-muted-foreground text-sm">—</span>;
        return <span className="text-sm truncate">{PAINT_FINISH_LABELS[f] ?? f}</span>;
      },
    },
    {
      key: "truckCategory",
      label: "Categoria",
      track: "minmax(0, 1fr)",
      render: (t) => {
        const c = (t.truck as any)?.category as TRUCK_CATEGORY | undefined;
        if (!c) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 truncate">
            {TRUCK_CATEGORY_LABELS[c] ?? c}
          </Badge>
        );
      },
    },
    {
      key: "implementType",
      label: "Implemento",
      track: "minmax(0, 1fr)",
      render: (t) => {
        const i = (t.truck as any)?.implementType as IMPLEMENT_TYPE | undefined;
        if (!i) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 truncate">
            {IMPLEMENT_TYPE_LABELS[i] ?? i}
          </Badge>
        );
      },
    },
    {
      key: "quoteTotal",
      label: "Orçamento",
      track: "minmax(0, 1fr)",
      render: (t) => {
        const total = (t.quote as any)?.total ?? null;
        return (
          <span className="text-sm tabular-nums font-medium">
            {total != null ? formatCurrency(Number(total)) : "—"}
          </span>
        );
      },
    },
    {
      key: "quoteStatus",
      label: "Status do orçamento",
      track: "minmax(0, 1.1fr)",
      render: (t) => {
        const q: any = t.quote;
        if (!q?.status) return <span className="text-muted-foreground text-sm">—</span>;
        // Installments live under quote.customerConfigs[].installments (the
        // API's base task include hydrates them). Flatten across configs for
        // the badge's paid/total progress display.
        const installments: any[] =
          (q.customerConfigs ?? []).flatMap((cc: any) => cc?.installments ?? []) ?? [];
        const paidCount = installments.length
          ? installments.filter((i) => i.paid || i.paidAt).length
          : undefined;
        const totalCount = installments.length || undefined;
        return (
          <QuoteStatusBadge
            status={q.status}
            paidCount={paidCount}
            totalCount={totalCount}
            size="sm"
          />
        );
      },
    },
    {
      key: "price",
      label: "Valor",
      track: "minmax(0, 1fr)",
      render: (t) => (
        <span className="text-sm tabular-nums font-medium">
          {formatCurrency((t as any).price)}
        </span>
      ),
    },
    {
      key: "observation",
      label: "Observação",
      track: "minmax(0, 2fr)",
      render: (t) => (
        <span className="text-sm text-muted-foreground truncate">
          {(t.observation as any)?.description || (t.observation as any)?.text || "—"}
        </span>
      ),
    },
    {
      key: "details",
      label: "Detalhes",
      track: "minmax(0, 2fr)",
      render: (t) => (
        <span className="text-sm text-muted-foreground truncate">
          {(t as any).details || "—"}
        </span>
      ),
    },
    // ---- Rich SO columns ----
    ...((["soProduction", "soCommercial", "soLogistic", "soArtwork"] as const).map(
      (key): ColumnDef => {
        const typeMap: Record<typeof key, SERVICE_ORDER_TYPE> = {
          soProduction: SERVICE_ORDER_TYPE.PRODUCTION,
          soCommercial: SERVICE_ORDER_TYPE.COMMERCIAL,
          soLogistic: SERVICE_ORDER_TYPE.LOGISTIC,
          soArtwork: SERVICE_ORDER_TYPE.ARTWORK,
        };
        const labelMap: Record<typeof key, string> = {
          soProduction: "Ordem de Serviço — Produção",
          soCommercial: "Ordem de Serviço — Comercial",
          soLogistic: "Ordem de Serviço — Logística",
          soArtwork: "Ordem de Serviço — Arte",
        };
        return {
          key,
          label: labelMap[key],
          track: "minmax(0, 0.9fr)",
          needsRelative: true,
          render: (t, ctx) => {
            const type = typeMap[key];
            if (ctx.cellModes.serviceOrder === "count") {
              return (
                <span className="text-sm tabular-nums">{countSOByType(t, type)}</span>
              );
            }
            return (
              <ServiceOrderCell
                task={t}
                serviceOrderType={type}
                navigationRoute="preparation"
              />
            );
          },
        };
      },
    )),
    // ---- Legacy count columns (kept for back-compat) ----
    {
      key: "soCount",
      label: "Total Ordens de Serviço",
      track: "minmax(0, 0.7fr)",
      render: (t) => (
        <span className="text-sm tabular-nums">{(t.serviceOrders ?? []).length}</span>
      ),
    },
    {
      key: "soOpenCount",
      label: "Ordens de Serviço abertas",
      track: "minmax(0, 0.8fr)",
      render: (t) => {
        const n = countOpenSO(t);
        return (
          <span className={`text-sm tabular-nums ${n > 0 ? "text-amber-500 font-medium" : ""}`}>
            {n}
          </span>
        );
      },
    },
    // Legacy per-type SO count keys (`soProductionCount`, `soCommercialCount`,
    // `soLogisticCount`, `soArtworkCount`) are intentionally NOT in the catalog
    // — they're auto-migrated to the rich `soProduction`/etc. columns above
    // (which render as count when `cellModes.serviceOrder === "count"`).
    {
      key: "hasArtworks",
      label: "Artes",
      track: "minmax(0, 0.6fr)",
      render: (t) => {
        const n = (t.artworks ?? []).length;
        return (
          <span className={`text-sm tabular-nums ${n > 0 ? "text-emerald-500" : ""}`}>{n}</span>
        );
      },
    },
    {
      key: "hasOpenSO",
      label: "Tem Ordem de Serviço aberta",
      track: "minmax(0, 1fr)",
      render: (t) =>
        countOpenSO(t) > 0 ? (
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-500"
          >
            Sim
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "hasBudget",
      label: "Tem orçamento",
      track: "minmax(0, 0.7fr)",
      render: (t) =>
        t.quote ? (
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-500"
          >
            Sim
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "hasObservation",
      label: "Tem observação",
      track: "minmax(0, 0.7fr)",
      render: (t) =>
        t.observation ? (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-sky-500/40 text-sky-500">
            Sim
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];
}

const COLUMN_CATALOG: ColumnDef[] = buildColumnCatalog();
const COLUMN_BY_KEY: Record<ColumnKey, ColumnDef> = COLUMN_CATALOG.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<ColumnKey, ColumnDef>,
);

// ============================================================================
// Config schema
// ============================================================================

const TERM_PRESETS = [
  "any",
  "today",
  "overdue",
  "next-7-days",
  "next-30-days",
  "this-month",
] as const;
const FORECAST_PRESETS = [
  "any",
  "today",
  "next-7-days",
  "next-30-days",
  "this-month",
] as const;
const FINISHED_PRESETS = [
  "any",
  "today",
  "last-7-days",
  "last-30-days",
  "this-month",
] as const;
const CREATED_PRESETS = [
  "any",
  "today",
  "last-7-days",
  "last-30-days",
  "this-month",
] as const;
const SORT_KEYS = [
  "term",
  "forecastDate",
  "createdAt",
  "startedAt",
  "finishedAt",
  "name",
  "statusOrder",
  "entryDate",
  "price",
  "commissionOrder",
  "updatedAt",
] as const;
const TRI_STATE = ["any", "yes", "no"] as const;
const DENSITY = ["compact", "comfortable", "spacious"] as const;
const LAYOUT_MODES = ["flat", "grouped-by-status", "tabs"] as const;
const SO_CELL_MODES = ["count", "progress-bar"] as const;
const PAINT_CELL_MODES = ["swatch", "swatch-name", "name"] as const;
const STATUS_CELL_MODES = ["badge", "dot-label", "text"] as const;

const dateRangeSchema = z
  .object({
    from: z.string().nullable().default(null),
    to: z.string().nullable().default(null),
  })
  .default({ from: null, to: null });

export const taskTableConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Tarefas"),
  accent: z
    .object({
      color: z
        .enum([
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("gray"),
      icon: z
        .enum([
          "ClipboardText",
          "ClipboardList",
          "ClipboardCheck",
          "Calendar",
          "CalendarDue",
          "Clock",
          "Hourglass",
          "Check",
          "CircleCheck",
          "AlertTriangle",
          "Flag",
          "Star",
          "Bolt",
          "Truck",
          "Package",
          "Brush",
          "Palette",
          "Receipt",
          "FileText",
          "Tools",
          "Users",
          "Factory",
        ])
        .default("ClipboardText"),
      borderColor: z
        .enum([
          "none",
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("none"),
    })
    .default({ color: "gray", icon: "ClipboardText", borderColor: "none" }),

  rowClickTarget: z.enum(["task", "budget", "billing"]).default("task"),

  display: z
    .object({
      density: z.enum(DENSITY).default("comfortable"),
      striping: z.boolean().default(true),
      gridLines: z.boolean().default(true),
      hoverHighlight: z.boolean().default(true),
      stickyHeader: z.boolean().default(true),
      showRowDot: z.boolean().default(true),
      showSearchBox: z.boolean().default(false),
      showViewAllLink: z.boolean().default(true),
      emptyStateMessage: z.string().max(160).default(""),
      layoutMode: z.enum(LAYOUT_MODES).default("flat"),
    })
    .default({
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
      showRowDot: true,
      showSearchBox: false,
      showViewAllLink: true,
      emptyStateMessage: "",
      layoutMode: "flat",
    }),

  cellModes: z
    .object({
      serviceOrder: z.enum(SO_CELL_MODES).default("progress-bar"),
      paint: z.enum(PAINT_CELL_MODES).default("swatch-name"),
      status: z.enum(STATUS_CELL_MODES).default("badge"),
    })
    .default({ serviceOrder: "progress-bar", paint: "swatch-name", status: "badge" }),

  deadlineColors: z
    .object({
      enabled: z.boolean().default(true),
      bold: z.boolean().default(true),
      forecastCriticalDays: z.number().int().min(0).max(60).default(3),
      forecastWarningDays: z.number().int().min(0).max(120).default(7),
      forecastNoticeDays: z.number().int().min(0).max(180).default(10),
      forecastCriticalColor: z.enum(DEADLINE_COLOR_TOKENS).default("red"),
      forecastWarningColor: z.enum(DEADLINE_COLOR_TOKENS).default("orange"),
      forecastNoticeColor: z.enum(DEADLINE_COLOR_TOKENS).default("yellow"),
      termOverdueColor: z.enum(DEADLINE_COLOR_TOKENS).default("red"),
      termCriticalHours: z.number().min(0).max(72).default(4),
      termCriticalColor: z.enum(DEADLINE_COLOR_TOKENS).default("amber"),
      termOnTrackColor: z.enum(DEADLINE_COLOR_TOKENS).default("green"),
    })
    .default({
      enabled: true,
      bold: true,
      forecastCriticalDays: 3,
      forecastWarningDays: 7,
      forecastNoticeDays: 10,
      forecastCriticalColor: "red",
      forecastWarningColor: "orange",
      forecastNoticeColor: "yellow",
      termOverdueColor: "red",
      termCriticalHours: 4,
      termCriticalColor: "amber",
      termOnTrackColor: "green",
    }),

  columns: z
    .array(z.enum(COLUMN_KEY_VALUES))
    .min(1)
    .default(["name", "customerName", "serialNumber", "term"]),

  columnWidths: z.record(z.string()).default({}),

  filters: z
    .object({
      status: z.array(z.nativeEnum(TASK_STATUS)).default([]),
      sectorIds: z.array(z.string().uuid()).default([]),
      customerIds: z.array(z.string().uuid()).default([]),
      assigneeIds: z.array(z.string().uuid()).default([]),
      truckCategories: z.array(z.nativeEnum(TRUCK_CATEGORY)).default([]),
      implementTypes: z.array(z.nativeEnum(IMPLEMENT_TYPE)).default([]),
      commissions: z.array(z.nativeEnum(COMMISSION_STATUS)).default([]),
      hasTruck: z.enum(TRI_STATE).default("any"),
      termPreset: z.enum(TERM_PRESETS).default("any"),
      forecastPreset: z.enum(FORECAST_PRESETS).default("any"),
      finishedPreset: z.enum(FINISHED_PRESETS).default("any"),
      createdPreset: z.enum(CREATED_PRESETS).default("any"),
      termRange: dateRangeSchema,
      forecastRange: dateRangeSchema,
      finishedRange: dateRangeSchema,
      createdRange: dateRangeSchema,
      entryRange: dateRangeSchema,
      hasOpenSO: z.enum(TRI_STATE).default("any"),
      hasArtworks: z.enum(TRI_STATE).default("any"),
      hasObservation: z.enum(TRI_STATE).default("any"),
      hasBudget: z.enum(TRI_STATE).default("any"),
      isOverdue: z.enum(TRI_STATE).default("any"),
      serviceOrderTypes: z.array(z.nativeEnum(SERVICE_ORDER_TYPE)).default([]),
      quoteStatuses: z.array(z.nativeEnum(TASK_QUOTE_STATUS)).default([]),
      defaultSearch: z.string().default(""),
    })
    .default({
      status: [],
      sectorIds: [],
      customerIds: [],
      assigneeIds: [],
      truckCategories: [],
      implementTypes: [],
      commissions: [],
      hasTruck: "any",
      termPreset: "any",
      forecastPreset: "any",
      finishedPreset: "any",
      createdPreset: "any",
      termRange: { from: null, to: null },
      forecastRange: { from: null, to: null },
      finishedRange: { from: null, to: null },
      createdRange: { from: null, to: null },
      entryRange: { from: null, to: null },
      hasOpenSO: "any",
      hasArtworks: "any",
      hasObservation: "any",
      hasBudget: "any",
      isOverdue: "any",
      serviceOrderTypes: [],
      quoteStatuses: [],
      defaultSearch: "",
    }),

  sort: z
    .object({
      key: z.enum(SORT_KEYS).default("term"),
      direction: z.enum(["asc", "desc"]).default("asc"),
    })
    .default({ key: "term", direction: "asc" }),

  sorts: z
    .array(
      z.object({
        key: z.enum(SORT_KEYS),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "term", direction: "asc" }]),

  limit: z.number().int().min(5).max(200).default(20),
  showHeader: z.boolean().default(true),

  behavior: z
    .object({
      refetchIntervalMs: z.number().int().min(0).max(3_600_000).default(0),
      viewAllRouteOverride: z.string().default(""),
    })
    .default({ refetchIntervalMs: 0, viewAllRouteOverride: "" }),

  presets: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        config: z.unknown(),
      }),
    )
    .default([]),
});

export type TaskTableConfig = z.infer<typeof taskTableConfigSchema>;
type DateRangeValue = z.infer<typeof dateRangeSchema>;

// ============================================================================
// Where / orderBy builders
// ============================================================================

function dateRangeFor(preset: string): unknown {
  const now = new Date();
  switch (preset) {
    case "today":
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case "overdue":
      return { lt: startOfDay(now) };
    case "next-7-days":
      return { gte: startOfDay(now), lte: endOfDay(addDays(now, 7)) };
    case "next-30-days":
      return { gte: startOfDay(now), lte: endOfDay(addDays(now, 30)) };
    case "last-7-days":
      return { gte: startOfDay(addDays(now, -7)), lte: endOfDay(now) };
    case "last-30-days":
      return { gte: startOfDay(addDays(now, -30)), lte: endOfDay(now) };
    case "this-month":
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
    case "any":
    default:
      return undefined;
  }
}

function rangeFromCalendar(range: DateRangeValue): unknown {
  if (!range.from && !range.to) return undefined;
  const out: { gte?: Date; lte?: Date } = {};
  if (range.from) out.gte = startOfDay(new Date(range.from));
  if (range.to) out.lte = endOfDay(new Date(range.to));
  return out;
}

function buildWhere(
  config: TaskTableConfig,
  runtimeSearch: string,
  runtimeStatus?: TASK_STATUS,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const ANDs: Array<Record<string, unknown>> = [];
  const f = config.filters;

  // Status — runtime tab takes precedence over config status array
  if (runtimeStatus) {
    where.status = runtimeStatus;
  } else if (f.status.length > 0) {
    where.status = { in: f.status };
  }

  if (f.sectorIds.length > 0) where.sectorId = { in: f.sectorIds };
  if (f.customerIds.length > 0) where.customerId = { in: f.customerIds };
  if (f.assigneeIds.length > 0) where.createdById = { in: f.assigneeIds };
  if (f.commissions.length > 0) where.commission = { in: f.commissions };

  // Calendar ranges win when set, otherwise fall back to presets.
  const term = rangeFromCalendar(f.termRange) ?? dateRangeFor(f.termPreset);
  if (term) where.term = term;
  const forecast = rangeFromCalendar(f.forecastRange) ?? dateRangeFor(f.forecastPreset);
  if (forecast) where.forecastDate = forecast;
  const finished = rangeFromCalendar(f.finishedRange) ?? dateRangeFor(f.finishedPreset);
  if (finished) where.finishedAt = finished;
  const created = rangeFromCalendar(f.createdRange) ?? dateRangeFor(f.createdPreset);
  if (created) where.createdAt = created;
  const entry = rangeFromCalendar(f.entryRange);
  if (entry) where.entryDate = entry;

  // Truck filters
  if (f.hasTruck === "yes") ANDs.push({ truck: { isNot: null as any } });
  if (f.hasTruck === "no") ANDs.push({ truck: null as any });
  if (f.truckCategories.length > 0)
    ANDs.push({ truck: { category: { in: f.truckCategories } } });
  if (f.implementTypes.length > 0)
    ANDs.push({ truck: { implementType: { in: f.implementTypes } } });

  // SO / artwork / observation / budget
  if (f.hasOpenSO === "yes") {
    ANDs.push({
      serviceOrders: {
        some: { status: { in: ["PENDING", "IN_PROGRESS", "PAUSED", "WAITING_APPROVE"] } },
      },
    });
  } else if (f.hasOpenSO === "no") {
    ANDs.push({
      OR: [
        { serviceOrders: { none: {} } },
        { serviceOrders: { every: { status: { in: ["COMPLETED", "CANCELLED"] } } } },
      ],
    });
  }

  if (f.hasArtworks === "yes") ANDs.push({ artworks: { some: {} } });
  if (f.hasArtworks === "no") ANDs.push({ artworks: { none: {} } });

  if (f.hasObservation === "yes") ANDs.push({ observation: { isNot: null as any } });
  if (f.hasObservation === "no") ANDs.push({ observation: null as any });

  if (f.hasBudget === "yes") ANDs.push({ quote: { isNot: null as any } });
  if (f.hasBudget === "no") ANDs.push({ quote: null as any });

  if (f.isOverdue === "yes") {
    ANDs.push({ term: { lt: startOfDay() } });
    ANDs.push({ status: { notIn: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] } });
  } else if (f.isOverdue === "no") {
    ANDs.push({
      OR: [
        { term: null as any },
        { term: { gte: startOfDay() } },
        { status: { in: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] } },
      ],
    });
  }

  if (f.serviceOrderTypes.length > 0) {
    ANDs.push({ serviceOrders: { some: { type: { in: f.serviceOrderTypes } } } });
  }

  if (f.quoteStatuses && f.quoteStatuses.length > 0) {
    ANDs.push({ quote: { is: { status: { in: f.quoteStatuses } } } });
  }

  const search = runtimeSearch.trim() || f.defaultSearch.trim();
  if (search) (where as any).searchingFor = search;

  if (ANDs.length > 0) where.AND = ANDs;
  return where;
}

function buildOrderBy(config: TaskTableConfig): Array<Record<string, "asc" | "desc">> {
  if (config.sorts && config.sorts.length > 0) {
    return config.sorts.map((s) => ({ [s.key]: s.direction }));
  }
  return [{ [config.sort.key]: config.sort.direction }];
}

// ============================================================================
// Render
// ============================================================================

const TASK_INCLUDE = {
  customer: true,
  sector: true,
  generalPainting: true,
  logoPaints: true,
  serviceOrders: true,
  observation: true,
  truck: true,
  // The API's base task include already hydrates `quote.customerConfigs.installments`.
  // Don't override with `{ include: { installments: true } }` — `installments`
  // is not a direct relation on TaskQuote, only on TaskQuoteCustomerConfig,
  // and Prisma rejects the unknown field.
  quote: true,
  artworks: true,
  responsibles: true,
} as const;

function densityClasses(d: TaskTableConfig["display"]["density"]) {
  if (d === "compact") return { row: "px-2 py-1 text-xs", header: "px-2 py-1 text-[10px]" };
  if (d === "spacious") return { row: "px-3 py-3 text-sm", header: "px-3 py-2 text-[10px]" };
  return { row: "px-3 py-2 text-sm", header: "px-3 py-1.5 text-[10px]" };
}

function statusGroupClass(status: TASK_STATUS): string {
  return STATUS_BADGE_CLASSES[status] ?? "";
}

// Legacy per-type SO count column keys → rich progress-bar equivalents.
// The rich cells subsume the count cells (set cellModes.serviceOrder="count"
// to get a pure number), so old configs are migrated forward on read.
const LEGACY_SO_COUNT_KEY_MAP: Partial<Record<ColumnKey, ColumnKey>> = {
  soProductionCount: "soProduction",
  soCommercialCount: "soCommercial",
  soLogisticCount: "soLogistic",
  soArtworkCount: "soArtwork",
};

// Normalize a (possibly stale or partial) saved config through the Zod schema
// so every nested field has its `.default()` applied. Without this, instances
// saved before a schema field was added crash on `.length` / property access.
function normalizeConfig(raw: unknown): TaskTableConfig {
  const result = taskTableConfigSchema.safeParse(raw);
  let config = result.success ? result.data : taskTableConfigSchema.parse({});

  // Migrate legacy per-type SO count keys → rich keys, deduping.
  const seen = new Set<ColumnKey>();
  const migrated: ColumnKey[] = [];
  let mutated = false;
  for (const k of config.columns) {
    const target = (LEGACY_SO_COUNT_KEY_MAP[k] ?? k) as ColumnKey;
    if (target !== k) mutated = true;
    if (seen.has(target)) {
      mutated = true;
      continue;
    }
    seen.add(target);
    migrated.push(target);
  }
  if (mutated) config = { ...config, columns: migrated };

  return config;
}

// Per-instance column width persistence. Drag-to-resize updates these via
// localStorage rather than the saved config — avoids round-tripping the
// dashboard layout API on every drag-move and keeps widget state local.
const COLUMN_WIDTHS_STORAGE_PREFIX = "task-table-widget:column-widths:";

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

function TaskTableRender({
  config: rawConfig,
  instanceId,
}: WidgetRenderProps<TaskTableConfig>) {
  const config = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [activeStatusTab, setActiveStatusTab] = useState<TASK_STATUS | "ALL">("ALL");
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
      const startX = e.clientX;
      const startWidth = cell.getBoundingClientRect().width;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
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

  const layoutMode = config.display?.layoutMode ?? "flat";
  const runtimeStatus =
    layoutMode === "tabs" && activeStatusTab !== "ALL" ? activeStatusTab : undefined;

  const where = useMemo(
    () => buildWhere(config, debouncedSearch, runtimeStatus),
    [config, debouncedSearch, runtimeStatus],
  );
  const orderBy = useMemo(() => buildOrderBy(config), [config]);

  const { data, isLoading, isError, refetch } = useTasks({
    where,
    orderBy: orderBy as any,
    take: config.limit,
    include: TASK_INCLUDE as any,
  } as any);

  // Background refetch — useTasks doesn't support refetchInterval, so we drive
  // it ourselves. Skip when the tab is hidden so we don't churn against the API
  // for an off-screen dashboard.
  const refetchInterval = config.behavior?.refetchIntervalMs ?? 0;
  useEffect(() => {
    if (!refetchInterval || !refetch) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refetch();
    }, refetchInterval);
    return () => clearInterval(id);
  }, [refetchInterval, refetch]);

  const tasks = data?.data ?? [];
  const visibleCount = tasks.length;

  const cols = useMemo(
    () => config.columns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean),
    [config.columns],
  );

  // Resolve column widths — live drag wins over saved config wins over catalog.
  const gridTemplate = useMemo(
    () =>
      cols
        .map(
          (c) =>
            liveWidths[c.key] ?? config.columnWidths?.[c.key] ?? c.track,
        )
        .join(" "),
    [cols, config.columnWidths, liveWidths],
  );

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
      }),
    [config.accent?.color, config.accent?.icon],
  );
  const AccentIcon = accent.Icon;
  const showRowDot = (config.display?.showRowDot ?? true) && config.columns[0] === "name";

  const target = config.rowClickTarget ?? "task";
  const detailHref = (taskId: string): string =>
    target === "budget"
      ? `/financeiro/orcamento/detalhes/${taskId}`
      : target === "billing"
      ? `/financeiro/faturamento/detalhes/${taskId}`
      : `/producao/agenda/detalhes/${taskId}`;
  const viewAllHref =
    config.behavior?.viewAllRouteOverride?.trim() ||
    (target === "budget"
      ? "/financeiro/orcamento"
      : target === "billing"
      ? "/financeiro/faturamento"
      : "/producao/agenda");

  const ctx: RenderCtx = useMemo(
    () => ({
      cellModes: {
        serviceOrder: config.cellModes?.serviceOrder ?? "progress-bar",
        paint: config.cellModes?.paint ?? "swatch-name",
        status: config.cellModes?.status ?? "badge",
      },
      forecast: {
        enabled: config.deadlineColors?.enabled ?? true,
        criticalDays: config.deadlineColors?.forecastCriticalDays ?? 3,
        warningDays: config.deadlineColors?.forecastWarningDays ?? 7,
        noticeDays: config.deadlineColors?.forecastNoticeDays ?? 10,
        criticalColor: config.deadlineColors?.forecastCriticalColor ?? "red",
        warningColor: config.deadlineColors?.forecastWarningColor ?? "orange",
        noticeColor: config.deadlineColors?.forecastNoticeColor ?? "yellow",
      },
      term: {
        enabled: config.deadlineColors?.enabled ?? true,
        overdueColor: config.deadlineColors?.termOverdueColor ?? "red",
        criticalHours: config.deadlineColors?.termCriticalHours ?? 4,
        criticalColor: config.deadlineColors?.termCriticalColor ?? "amber",
        onTrackColor: config.deadlineColors?.termOnTrackColor ?? "green",
      },
      bold: config.deadlineColors?.bold ?? true,
    }),
    [config.cellModes, config.deadlineColors],
  );

  const display = config.display ?? {
    density: "comfortable" as const,
    striping: true,
    gridLines: true,
    hoverHighlight: true,
    stickyHeader: true,
    showRowDot: true,
    showSearchBox: false,
    showViewAllLink: true,
    emptyStateMessage: "",
    layoutMode: "flat" as const,
  };
  const dens = densityClasses(display.density);
  const stickyClass = display.stickyHeader ? "sticky top-0 z-20" : "";
  const rowBorder = display.gridLines ? "border-b border-border last:border-b-0" : "";
  const rowHover = display.hoverHighlight ? "hover:bg-secondary/50" : "";
  const emptyMsg =
    display.emptyStateMessage?.trim() || "Nenhuma tarefa encontrada com os filtros atuais.";

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

  const renderRows = () => {
    if (isLoading) {
      return (
        <SkeletonRows columns={cols.length} count={6} gridTemplate={gridTemplate} dens={dens} />
      );
    }
    if (isError) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Erro ao carregar tarefas.
        </div>
      );
    }
    if (tasks.length === 0) {
      return <div className="p-6 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
    }

    if (layoutMode === "grouped-by-status") {
      const out: React.ReactNode[] = [];
      let prev: TASK_STATUS | null = null;
      tasks.forEach((task, i) => {
        if (task.status !== prev) {
          out.push(
            <div
              key={`group-${task.id}`}
              className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b border-border ${statusGroupClass(task.status)}`}
            >
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </div>,
          );
          prev = task.status;
        }
        out.push(renderRow(task, i));
      });
      return out;
    }

    return tasks.map((task, i) => renderRow(task, i));
  };

  const renderRow = (task: Task, i: number) => (
    <div
      key={task.id}
      className={`grid gap-x-3 items-center cursor-pointer transition-colors ${dens.row} ${rowBorder} ${rowHover} ${
        display.striping && i % 2 === 1 ? "bg-muted/20" : ""
      }`}
      style={{ gridTemplateColumns: gridTemplate }}
      onClick={() => navigate(detailHref(task.id))}
    >
      {cols.map((c, idx) => (
        <div
          key={c.key}
          className={`min-w-0 ${c.needsRelative ? "relative" : ""}`}
        >
          {idx === 0 && showRowDot ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${accent.classes.dot}`}
                aria-hidden="true"
              />
              {c.render(task, ctx)}
            </div>
          ) : (
            c.render(task, ctx)
          )}
        </div>
      ))}
    </div>
  );

  const tableBody = (
    <>
      <div
        ref={headerRef}
        className={`grid gap-x-3 ${dens.header} ${stickyClass} bg-muted/95 backdrop-blur-sm border-b border-border font-semibold uppercase tracking-wider text-muted-foreground`}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {cols.map((c, i) => (
          <div
            key={c.key}
            data-col-key={c.key}
            className="relative truncate select-none"
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
                  // Double-click clears the override → reverts to catalog default.
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
      {renderRows()}
    </>
  );

  const body =
    layoutMode === "tabs" ? (
      <Tabs
        value={activeStatusTab}
        onValueChange={(v) => setActiveStatusTab(v as TASK_STATUS | "ALL")}
        className="flex flex-col h-full min-h-0"
      >
        <TabsList className="m-2 self-start">
          <TabsTrigger value="ALL">Todas</TabsTrigger>
          {(Object.values(TASK_STATUS) as TASK_STATUS[]).map((s) => (
            <TabsTrigger key={s} value={s}>
              {TASK_STATUS_LABELS[s] ?? s}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeStatusTab} className="flex-1 min-h-0 overflow-auto">
          {tableBody}
        </TabsContent>
      </Tabs>
    ) : (
      tableBody
    );

  return (
    <WidgetCard
      showHeader={config.showHeader}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={display.showViewAllLink ? viewAllHref : undefined}
      headerExtra={headerExtra}
      count={!isLoading ? visibleCount : null}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
    >
      {body}
    </WidgetCard>
  );
}

function SkeletonRows({
  columns,
  count,
  gridTemplate,
  dens,
}: {
  columns: number;
  count: number;
  gridTemplate: string;
  dens: { row: string };
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`grid gap-x-3 items-center border-b border-border last:border-b-0 ${dens.row}`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {Array.from({ length: columns }).map((__, j) => (
            <div
              key={j}
              className="h-3 rounded bg-muted/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ============================================================================
// Configure UI — tabs: Aparência, Colunas, Filtros, Ordenação, Cores, Comportamento
// ============================================================================

const TERM_PRESET_LABELS: Record<(typeof TERM_PRESETS)[number], string> = {
  any: "Qualquer",
  today: "Hoje",
  overdue: "Vencido",
  "next-7-days": "Próximos 7 dias",
  "next-30-days": "Próximos 30 dias",
  "this-month": "Este mês",
};
const FORECAST_PRESET_LABELS: Record<(typeof FORECAST_PRESETS)[number], string> = {
  any: "Qualquer",
  today: "Hoje",
  "next-7-days": "Próximos 7 dias",
  "next-30-days": "Próximos 30 dias",
  "this-month": "Este mês",
};
const FINISHED_PRESET_LABELS: Record<(typeof FINISHED_PRESETS)[number], string> = {
  any: "Qualquer",
  today: "Hoje",
  "last-7-days": "Últimos 7 dias",
  "last-30-days": "Últimos 30 dias",
  "this-month": "Este mês",
};
const CREATED_PRESET_LABELS: Record<(typeof CREATED_PRESETS)[number], string> = {
  any: "Qualquer",
  today: "Hoje",
  "last-7-days": "Últimos 7 dias",
  "last-30-days": "Últimos 30 dias",
  "this-month": "Este mês",
};
const TRI_STATE_LABELS: Record<(typeof TRI_STATE)[number], string> = {
  any: "Qualquer",
  yes: "Sim",
  no: "Não",
};
const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  term: "Prazo",
  forecastDate: "Previsão",
  createdAt: "Data de criação",
  startedAt: "Data de início",
  finishedAt: "Data de conclusão",
  name: "Logomarca / Nome",
  statusOrder: "Ordem de status",
  entryDate: "Data de entrada",
  price: "Valor",
  commissionOrder: "Ordem de comissão",
  updatedAt: "Atualizado em",
};
const SO_TYPE_LABELS_LOCAL: Record<SERVICE_ORDER_TYPE, string> = {
  [SERVICE_ORDER_TYPE.PRODUCTION]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.PRODUCTION] ?? "Produção",
  [SERVICE_ORDER_TYPE.COMMERCIAL]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.COMMERCIAL] ?? "Comercial",
  [SERVICE_ORDER_TYPE.LOGISTIC]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.LOGISTIC] ?? "Logística",
  [SERVICE_ORDER_TYPE.ARTWORK]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.ARTWORK] ?? "Arte",
};
const DENSITY_LABELS: Record<(typeof DENSITY)[number], string> = {
  compact: "Compacto",
  comfortable: "Confortável",
  spacious: "Espaçoso",
};
const LAYOUT_LABELS: Record<(typeof LAYOUT_MODES)[number], string> = {
  flat: "Lista única",
  "grouped-by-status": "Agrupado por status",
  tabs: "Abas por status",
};
const SO_CELL_LABELS: Record<(typeof SO_CELL_MODES)[number], string> = {
  count: "Apenas contagem",
  "progress-bar": "Barra de progresso (rico)",
};
const PAINT_CELL_LABELS: Record<(typeof PAINT_CELL_MODES)[number], string> = {
  swatch: "Apenas amostra",
  "swatch-name": "Amostra + nome",
  name: "Apenas nome",
};
const STATUS_CELL_LABELS: Record<(typeof STATUS_CELL_MODES)[number], string> = {
  badge: "Badge colorida",
  "dot-label": "Bolinha + texto",
  text: "Apenas texto",
};
const REFETCH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Desligado" },
  { value: 30_000, label: "A cada 30 s" },
  { value: 60_000, label: "A cada 1 min" },
  { value: 5 * 60_000, label: "A cada 5 min" },
  { value: 15 * 60_000, label: "A cada 15 min" },
];

const COLOR_TOKEN_OPTIONS = DEADLINE_COLOR_TOKENS.map((t) => ({
  value: t,
  label: DEADLINE_COLOR_LABELS[t],
}));

function ColorTokenPicker({
  value,
  onChange,
}: {
  value: DeadlineColorToken;
  onChange: (v: DeadlineColorToken) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-5 w-5 rounded-full shrink-0 border border-border ${deadlineColorSwatchClass(value)}`}
        aria-hidden="true"
      />
      <div className="flex-1">
        <Combobox
          mode="single"
          value={value}
          onValueChange={(v) =>
            onChange((typeof v === "string" ? v : "red") as DeadlineColorToken)
          }
          options={COLOR_TOKEN_OPTIONS}
          clearable={false}
        />
      </div>
    </div>
  );
}

function TaskTableConfigComponent({
  config: rawConfig,
  onChange,
}: WidgetConfigProps<TaskTableConfig>) {
  // Same normalization the render component does — guards against stale
  // instances saved before newer schema fields existed.
  const c = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
  const set = <K extends keyof TaskTableConfig>(key: K, value: TaskTableConfig[K]) =>
    onChange({ ...c, [key]: value });
  const setFilter = <K extends keyof TaskTableConfig["filters"]>(
    key: K,
    value: TaskTableConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  const setDisplay = <K extends keyof TaskTableConfig["display"]>(
    key: K,
    value: TaskTableConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });
  const setCellMode = <K extends keyof TaskTableConfig["cellModes"]>(
    key: K,
    value: TaskTableConfig["cellModes"][K],
  ) => onChange({ ...c, cellModes: { ...c.cellModes, [key]: value } });
  const setDeadline = <K extends keyof TaskTableConfig["deadlineColors"]>(
    key: K,
    value: TaskTableConfig["deadlineColors"][K],
  ) => onChange({ ...c, deadlineColors: { ...c.deadlineColors, [key]: value } });
  const setBehavior = <K extends keyof TaskTableConfig["behavior"]>(
    key: K,
    value: TaskTableConfig["behavior"][K],
  ) => onChange({ ...c, behavior: { ...c.behavior, [key]: value } });

  // Reference data
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } } as any);
  const { data: customersData } = useCustomers({
    orderBy: { fantasyName: "asc" },
  } as any);

  const sectorOptions = useMemo(
    () => (sectorsData?.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
    [sectorsData?.data],
  );
  const customerOptions = useMemo(
    () =>
      (customersData?.data ?? []).map((cu: any) => ({
        value: cu.id,
        label: cu.fantasyName || cu.corporateName,
      })),
    [customersData?.data],
  );
  const quoteStatusOptions = useMemo(
    () =>
      (Object.values(TASK_QUOTE_STATUS) as TASK_QUOTE_STATUS[]).map((s) => ({
        value: s,
        label: TASK_QUOTE_STATUS_LABELS[s] ?? s,
      })),
    [],
  );

  const statusOptions = useMemo(
    () =>
      (Object.values(TASK_STATUS) as TASK_STATUS[]).map((s) => ({
        value: s,
        label: TASK_STATUS_LABELS[s] ?? s,
      })),
    [],
  );
  const soTypeOptions = useMemo(
    () =>
      (Object.values(SERVICE_ORDER_TYPE) as SERVICE_ORDER_TYPE[]).map((t) => ({
        value: t,
        label: SO_TYPE_LABELS_LOCAL[t] ?? t,
      })),
    [],
  );
  const truckCategoryOptions = useMemo(
    () =>
      (Object.values(TRUCK_CATEGORY) as TRUCK_CATEGORY[]).map((tc) => ({
        value: tc,
        label: TRUCK_CATEGORY_LABELS[tc] ?? tc,
      })),
    [],
  );
  const implementTypeOptions = useMemo(
    () =>
      (Object.values(IMPLEMENT_TYPE) as IMPLEMENT_TYPE[]).map((it) => ({
        value: it,
        label: IMPLEMENT_TYPE_LABELS[it] ?? it,
      })),
    [],
  );
  const commissionOptions = useMemo(
    () =>
      (Object.values(COMMISSION_STATUS) as COMMISSION_STATUS[]).map((cs) => ({
        value: cs,
        label: COMMISSION_STATUS_LABELS[cs] ?? cs,
      })),
    [],
  );

  const triStateOptions = (Object.entries(TRI_STATE_LABELS) as [
    (typeof TRI_STATE)[number],
    string,
  ][]).map(([value, label]) => ({ value, label }));

  // Reset helpers — per-tab
  const resetDisplay = () => set("display", taskTableWidget.defaultConfig.display);
  const resetCellModes = () => set("cellModes", taskTableWidget.defaultConfig.cellModes);
  const resetColumns = () => {
    set("columns", taskTableWidget.defaultConfig.columns);
    set("columnWidths", {});
  };
  const resetFilters = () => set("filters", taskTableWidget.defaultConfig.filters);
  const resetDeadlineColors = () =>
    set("deadlineColors", taskTableWidget.defaultConfig.deadlineColors);
  const resetBehavior = () => set("behavior", taskTableWidget.defaultConfig.behavior);

  // Multi-sort manipulators
  const addSort = () => {
    const used = new Set(c.sorts.map((s) => s.key));
    const nextKey = (SORT_KEYS as readonly string[]).find((k) => !used.has(k as any)) as
      | (typeof SORT_KEYS)[number]
      | undefined;
    if (!nextKey) return;
    set("sorts", [...c.sorts, { key: nextKey, direction: "asc" }]);
  };
  const removeSort = (i: number) => {
    if (c.sorts.length <= 1) return;
    set("sorts", c.sorts.filter((_, idx) => idx !== i));
  };
  const updateSort = (
    i: number,
    patch: Partial<TaskTableConfig["sorts"][number]>,
  ) => {
    set(
      "sorts",
      c.sorts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  };
  const moveSort = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= c.sorts.length) return;
    const next = c.sorts.slice();
    [next[i], next[j]] = [next[j], next[i]];
    set("sorts", next);
  };

  // Presets
  const savePreset = () => {
    const name = window.prompt("Nome do preset?");
    if (!name) return;
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    const without = c.presets.filter((p) => p.name !== trimmed);
    const snapshot: TaskTableConfig = { ...c, presets: [] };
    set("presets", [...without, { name: trimmed, config: snapshot }]);
  };
  const loadPreset = (i: number) => {
    const p = c.presets[i];
    if (!p) return;
    const parsed = taskTableConfigSchema.safeParse(p.config);
    if (!parsed.success) return;
    onChange({ ...parsed.data, presets: c.presets });
  };
  const deletePreset = (i: number) => {
    set("presets", c.presets.filter((_, idx) => idx !== i));
  };
  const exportConfig = () => {
    const json = JSON.stringify({ ...c, presets: [] }, null, 2);
    navigator.clipboard?.writeText(json);
    window.alert("Configuração copiada para a área de transferência.");
  };
  const importConfig = () => {
    const txt = window.prompt("Cole o JSON de configuração:");
    if (!txt) return;
    try {
      const parsed = taskTableConfigSchema.safeParse(JSON.parse(txt));
      if (!parsed.success) {
        window.alert("JSON inválido para esta configuração.");
        return;
      }
      onChange({ ...parsed.data, presets: c.presets });
    } catch {
      window.alert("JSON inválido.");
    }
  };

  // Accent helpers
  const currentAccentColor = (c.accent?.color ?? "gray") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "ClipboardText") as WidgetAccentIcon;
  const currentBorderColor = (c.accent?.borderColor ?? "none") as WidgetBorderColor;

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
      {/* Title row + presets */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label className="text-sm">Título</Label>
          <Input
            value={c.title}
            onChange={(v) => set("title", typeof v === "string" ? v : "")}
            placeholder="Tarefas"
          />
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={savePreset} title="Salvar preset">
            <IconBookmark className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportConfig} title="Exportar JSON">
            <IconDownload className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={importConfig} title="Importar JSON">
            <IconFileImport className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {c.presets.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Presets ({c.presets.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.presets.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => loadPreset(i)}
                  className="hover:underline"
                  title="Carregar preset"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(i)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover preset"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
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
          <TabsTrigger value="colors" className="gap-1">
            <IconPalette className="h-3.5 w-3.5" /> Cores de prazo
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1">
            <IconLayout className="h-3.5 w-3.5" /> Comportamento
          </TabsTrigger>
        </TabsList>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetDisplay}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar aparência
            </button>
          </div>
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{
                color: currentAccentColor,
                icon: currentAccentIcon,
                borderColor: currentBorderColor,
              }}
              onChange={(next) =>
                set("accent", {
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                } as TaskTableConfig["accent"])
              }
            />
          </Section>
          <Section title="Densidade e linhas" defaultOpen>
            <div>
              <Label className="text-xs">Densidade</Label>
              <Combobox
                mode="single"
                value={c.display.density}
                onValueChange={(v) =>
                  setDisplay(
                    "density",
                    (typeof v === "string" ? v : "comfortable") as (typeof DENSITY)[number],
                  )
                }
                options={DENSITY.map((d) => ({ value: d, label: DENSITY_LABELS[d] }))}
                clearable={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Listras alternadas"
                checked={c.display.striping}
                onCheckedChange={(v) => setDisplay("striping", v)}
              />
              <ToggleRow
                label="Linhas divisórias"
                checked={c.display.gridLines}
                onCheckedChange={(v) => setDisplay("gridLines", v)}
              />
              <ToggleRow
                label="Destaque ao passar mouse"
                checked={c.display.hoverHighlight}
                onCheckedChange={(v) => setDisplay("hoverHighlight", v)}
              />
              <ToggleRow
                label="Cabeçalho fixo"
                checked={c.display.stickyHeader}
                onCheckedChange={(v) => setDisplay("stickyHeader", v)}
              />
              <ToggleRow
                label="Bolinha colorida na 1ª coluna"
                hint="Mostra um ponto da cor de acento ao lado da Logomarca."
                checked={c.display.showRowDot}
                onCheckedChange={(v) => setDisplay("showRowDot", v)}
              />
              <ToggleRow
                label="Mostrar caixa de busca"
                hint="Permite buscar tarefas em tempo real no widget."
                checked={c.display.showSearchBox}
                onCheckedChange={(v) => setDisplay("showSearchBox", v)}
              />
            </div>
          </Section>
          <Section title="Renderização das células">
            <div>
              <Label className="text-xs">Ordens de Serviço</Label>
              <Combobox
                mode="single"
                value={c.cellModes.serviceOrder}
                onValueChange={(v) =>
                  setCellMode(
                    "serviceOrder",
                    (typeof v === "string"
                      ? v
                      : "progress-bar") as (typeof SO_CELL_MODES)[number],
                  )
                }
                options={SO_CELL_MODES.map((m) => ({ value: m, label: SO_CELL_LABELS[m] }))}
                clearable={false}
              />
            </div>
            <div>
              <Label className="text-xs">Pintura</Label>
              <Combobox
                mode="single"
                value={c.cellModes.paint}
                onValueChange={(v) =>
                  setCellMode(
                    "paint",
                    (typeof v === "string"
                      ? v
                      : "swatch-name") as (typeof PAINT_CELL_MODES)[number],
                  )
                }
                options={PAINT_CELL_MODES.map((m) => ({
                  value: m,
                  label: PAINT_CELL_LABELS[m],
                }))}
                clearable={false}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Combobox
                mode="single"
                value={c.cellModes.status}
                onValueChange={(v) =>
                  setCellMode(
                    "status",
                    (typeof v === "string"
                      ? v
                      : "badge") as (typeof STATUS_CELL_MODES)[number],
                  )
                }
                options={STATUS_CELL_MODES.map((m) => ({
                  value: m,
                  label: STATUS_CELL_LABELS[m],
                }))}
                clearable={false}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetCellModes}
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Restaurar células
              </button>
            </div>
          </Section>
          <Section title="Cabeçalho e link">
            <ToggleRow
              label="Exibir cabeçalho do widget"
              checked={c.showHeader}
              onCheckedChange={(v) => set("showHeader", v)}
            />
            <ToggleRow
              label='Exibir link "Ver todos"'
              checked={c.display.showViewAllLink}
              onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
            />
            <div>
              <Label className="text-xs">Mensagem quando vazio</Label>
              <Input
                value={c.display.emptyStateMessage}
                onChange={(v) =>
                  setDisplay("emptyStateMessage", typeof v === "string" ? v : "")
                }
                placeholder="Nenhuma tarefa encontrada com os filtros atuais."
              />
            </div>
          </Section>
        </TabsContent>

        {/* ---- COLUMNS ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetColumns}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar colunas
            </button>
          </div>
          <Section
            title={`Selecionar e reordenar (${c.columns.length})`}
            defaultOpen
          >
            <ColumnPicker
              catalog={COLUMN_CATALOG.map((col) => ({ key: col.key, label: col.label }))}
              selected={c.columns}
              onChange={(next) => set("columns", next as TaskTableConfig["columns"])}
            />
            <p className="text-[11px] text-muted-foreground">
              Para ajustar a largura, arraste a borda direita do cabeçalho da coluna
              diretamente na tabela (mesma forma da página de preparação).
            </p>
          </Section>
          <Section title="Navegação ao clicar na linha">
            <div>
              <Label className="text-xs">Destino do clique</Label>
              <Combobox
                mode="single"
                value={c.rowClickTarget ?? "task"}
                onValueChange={(v) =>
                  set(
                    "rowClickTarget",
                    (typeof v === "string"
                      ? v
                      : "task") as TaskTableConfig["rowClickTarget"],
                  )
                }
                options={[
                  { value: "task", label: "Tarefa (detalhe da tarefa)" },
                  { value: "budget", label: "Orçamento (Faturamento → Orçamento)" },
                  {
                    value: "billing",
                    label: "Faturamento (Faturamento → Detalhe)",
                  },
                ]}
                clearable={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Define para onde o usuário vai ao clicar em uma linha — útil para
                criar tabelas dedicadas a orçamentos ou faturamento.
              </p>
            </div>
          </Section>
          <Section title="Ordenação multi-coluna" defaultOpen>
            <p className="text-[11px] text-muted-foreground">
              A ordem aqui define a precedência: a primeira é o critério principal.
            </p>
            <ul className="space-y-1.5">
              {c.sorts.map((s, i) => (
                <li
                  key={`${s.key}-${i}`}
                  className="flex items-center gap-1.5 rounded-md border border-border p-1.5"
                >
                  <span className="text-[11px] text-muted-foreground w-5 tabular-nums">
                    {i + 1}.
                  </span>
                  <div className="flex-1">
                    <Combobox
                      mode="single"
                      value={s.key}
                      onValueChange={(v) =>
                        updateSort(i, {
                          key: (typeof v === "string" ? v : "term") as (typeof SORT_KEYS)[number],
                        })
                      }
                      options={SORT_KEYS.map((k) => ({ value: k, label: SORT_LABELS[k] }))}
                      clearable={false}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() =>
                      updateSort(i, { direction: s.direction === "asc" ? "desc" : "asc" })
                    }
                    title={s.direction === "asc" ? "Crescente" : "Decrescente"}
                  >
                    {s.direction === "asc" ? "↑" : "↓"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => moveSort(i, -1)}
                    disabled={i === 0}
                    title="Subir"
                  >
                    ▲
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => moveSort(i, 1)}
                    disabled={i === c.sorts.length - 1}
                    title="Descer"
                  >
                    ▼
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => removeSort(i)}
                    disabled={c.sorts.length <= 1}
                    title="Remover"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-center pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addSort}
                disabled={c.sorts.length >= SORT_KEYS.length}
              >
                + Adicionar critério
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {c.sorts.length} de {SORT_KEYS.length}
              </span>
            </div>
          </Section>
          <Section title="Quantidade máxima">
            <LimitInput
              value={c.limit}
              onChange={(n) => set("limit", n)}
            />
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Combobox
              mode="multiple"
              value={c.filters.status}
              onValueChange={(v) => setFilter("status", asArray(v) as TASK_STATUS[])}
              options={statusOptions}
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
            />
          </div>
          <div>
            <Label className="text-xs">Setores</Label>
            <Combobox
              mode="multiple"
              value={c.filters.sectorIds}
              onValueChange={(v) => setFilter("sectorIds", asArray(v))}
              options={sectorOptions}
              placeholder="Todos os setores"
              searchPlaceholder="Buscar setor..."
            />
          </div>
          <div>
            <Label className="text-xs">Clientes</Label>
            <Combobox
              mode="multiple"
              value={c.filters.customerIds}
              onValueChange={(v) => setFilter("customerIds", asArray(v))}
              options={customerOptions}
              placeholder="Todos os clientes"
              searchPlaceholder="Buscar cliente..."
            />
          </div>
          <div>
            <Label className="text-xs">Categoria do caminhão</Label>
            <Combobox
              mode="multiple"
              value={c.filters.truckCategories}
              onValueChange={(v) =>
                setFilter("truckCategories", asArray(v) as TRUCK_CATEGORY[])
              }
              options={truckCategoryOptions}
              placeholder="Qualquer categoria"
              searchPlaceholder="Buscar categoria..."
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de implemento</Label>
            <Combobox
              mode="multiple"
              value={c.filters.implementTypes}
              onValueChange={(v) =>
                setFilter("implementTypes", asArray(v) as IMPLEMENT_TYPE[])
              }
              options={implementTypeOptions}
              placeholder="Qualquer implemento"
              searchPlaceholder="Buscar implemento..."
            />
          </div>
          <div>
            <Label className="text-xs">Comissão</Label>
            <Combobox
              mode="multiple"
              value={c.filters.commissions}
              onValueChange={(v) =>
                setFilter("commissions", asArray(v) as COMMISSION_STATUS[])
              }
              options={commissionOptions}
              placeholder="Qualquer comissão"
              searchPlaceholder="Buscar..."
            />
          </div>
          <div>
            <Label className="text-xs">Status do orçamento</Label>
            <Combobox
              mode="multiple"
              value={c.filters.quoteStatuses ?? []}
              onValueChange={(v) =>
                setFilter("quoteStatuses", asArray(v) as TASK_QUOTE_STATUS[])
              }
              options={quoteStatusOptions}
              placeholder="Qualquer status"
              searchPlaceholder="Buscar status do orçamento..."
            />
          </div>
          <div>
            <Label className="text-xs">Tipos de Ordem de Serviço</Label>
            <Combobox
              mode="multiple"
              value={c.filters.serviceOrderTypes}
              onValueChange={(v) =>
                setFilter("serviceOrderTypes", asArray(v) as SERVICE_ORDER_TYPE[])
              }
              options={soTypeOptions}
              placeholder="Qualquer tipo"
              searchPlaceholder="Buscar tipo..."
            />
          </div>
          <div>
            <Label className="text-xs">Prazo</Label>
            <Combobox
              mode="single"
              value={c.filters.termPreset}
              onValueChange={(v) =>
                setFilter(
                  "termPreset",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["termPreset"],
                )
              }
              options={TERM_PRESETS.map((p) => ({
                value: p,
                label: TERM_PRESET_LABELS[p],
              }))}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Previsão</Label>
            <Combobox
              mode="single"
              value={c.filters.forecastPreset}
              onValueChange={(v) =>
                setFilter(
                  "forecastPreset",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["forecastPreset"],
                )
              }
              options={FORECAST_PRESETS.map((p) => ({
                value: p,
                label: FORECAST_PRESET_LABELS[p],
              }))}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Conclusão</Label>
            <Combobox
              mode="single"
              value={c.filters.finishedPreset}
              onValueChange={(v) =>
                setFilter(
                  "finishedPreset",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["finishedPreset"],
                )
              }
              options={FINISHED_PRESETS.map((p) => ({
                value: p,
                label: FINISHED_PRESET_LABELS[p],
              }))}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Criação</Label>
            <Combobox
              mode="single"
              value={c.filters.createdPreset}
              onValueChange={(v) =>
                setFilter(
                  "createdPreset",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["createdPreset"],
                )
              }
              options={CREATED_PRESETS.map((p) => ({
                value: p,
                label: CREATED_PRESET_LABELS[p],
              }))}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Atrasada</Label>
            <Combobox
              mode="single"
              value={c.filters.isOverdue}
              onValueChange={(v) =>
                setFilter(
                  "isOverdue",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["isOverdue"],
                )
              }
              options={triStateOptions}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Tem Ordem de Serviço aberta</Label>
            <Combobox
              mode="single"
              value={c.filters.hasOpenSO}
              onValueChange={(v) =>
                setFilter(
                  "hasOpenSO",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["hasOpenSO"],
                )
              }
              options={triStateOptions}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Tem artes</Label>
            <Combobox
              mode="single"
              value={c.filters.hasArtworks}
              onValueChange={(v) =>
                setFilter(
                  "hasArtworks",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["hasArtworks"],
                )
              }
              options={triStateOptions}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Tem observações</Label>
            <Combobox
              mode="single"
              value={c.filters.hasObservation}
              onValueChange={(v) =>
                setFilter(
                  "hasObservation",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["hasObservation"],
                )
              }
              options={triStateOptions}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Tem orçamento</Label>
            <Combobox
              mode="single"
              value={c.filters.hasBudget}
              onValueChange={(v) =>
                setFilter(
                  "hasBudget",
                  (typeof v === "string"
                    ? v
                    : "any") as TaskTableConfig["filters"]["hasBudget"],
                )
              }
              options={triStateOptions}
              clearable={false}
            />
          </div>
          <div>
            <Label className="text-xs">Termo de busca padrão</Label>
            <Input
              value={c.filters.defaultSearch}
              onChange={(v) =>
                setFilter("defaultSearch", typeof v === "string" ? v : "")
              }
              placeholder='Ex.: "ABC1234" — busca em nome, série, cliente, observação'
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplicado sempre. A caixa de busca em tempo real (se ativada) prevalece.
            </p>
          </div>
        </TabsContent>

        {/* ---- SORT ---- */}
        {/* ---- COLORS ---- */}
        <TabsContent value="colors" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetDeadlineColors}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar cores
            </button>
          </div>
          <Section title="Geral" defaultOpen>
            <ToggleRow
              label="Ativar cores de prazo/previsão"
              hint="Pinta as colunas Prazo, Tempo restante e Previsão conforme a urgência."
              checked={c.deadlineColors.enabled}
              onCheckedChange={(v) => setDeadline("enabled", v)}
            />
            <ToggleRow
              label="Negrito quando colorido"
              checked={c.deadlineColors.bold}
              onCheckedChange={(v) => setDeadline("bold", v)}
            />
          </Section>
          <Section title="Previsão (em dias)" defaultOpen>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Crítico ≤</Label>
                <Input
                  type="number"
                  value={c.deadlineColors.forecastCriticalDays}
                  onChange={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) setDeadline("forecastCriticalDays", n);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Atenção ≤</Label>
                <Input
                  type="number"
                  value={c.deadlineColors.forecastWarningDays}
                  onChange={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) setDeadline("forecastWarningDays", n);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Aviso ≤</Label>
                <Input
                  type="number"
                  value={c.deadlineColors.forecastNoticeDays}
                  onChange={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) setDeadline("forecastNoticeDays", n);
                  }}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor crítico</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastCriticalColor}
                onChange={(v) => setDeadline("forecastCriticalColor", v)}
              />
            </div>
            <div>
              <Label className="text-xs">Cor atenção</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastWarningColor}
                onChange={(v) => setDeadline("forecastWarningColor", v)}
              />
            </div>
            <div>
              <Label className="text-xs">Cor aviso</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastNoticeColor}
                onChange={(v) => setDeadline("forecastNoticeColor", v)}
              />
            </div>
          </Section>
          <Section title="Prazo (em horas)" defaultOpen>
            <div>
              <Label className="text-xs">Cor vencido</Label>
              <ColorTokenPicker
                value={c.deadlineColors.termOverdueColor}
                onChange={(v) => setDeadline("termOverdueColor", v)}
              />
            </div>
            <div>
              <Label className="text-xs">Crítico ≤ (horas)</Label>
              <Input
                type="number"
                value={c.deadlineColors.termCriticalHours}
                onChange={(v) => {
                  const n = Number(v);
                  if (Number.isFinite(n)) setDeadline("termCriticalHours", n);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Cor crítico</Label>
              <ColorTokenPicker
                value={c.deadlineColors.termCriticalColor}
                onChange={(v) => setDeadline("termCriticalColor", v)}
              />
            </div>
            <div>
              <Label className="text-xs">Cor no prazo</Label>
              <ColorTokenPicker
                value={c.deadlineColors.termOnTrackColor}
                onChange={(v) => setDeadline("termOnTrackColor", v)}
              />
            </div>
          </Section>
        </TabsContent>

        {/* ---- BEHAVIOR ---- */}
        <TabsContent value="behavior" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetBehavior}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar comportamento
            </button>
          </div>
          <Section title="Layout" defaultOpen>
            <div>
              <Label className="text-xs">Modo de exibição</Label>
              <Combobox
                mode="single"
                value={c.display.layoutMode}
                onValueChange={(v) =>
                  setDisplay(
                    "layoutMode",
                    (typeof v === "string" ? v : "flat") as (typeof LAYOUT_MODES)[number],
                  )
                }
                options={LAYOUT_MODES.map((m) => ({ value: m, label: LAYOUT_LABELS[m] }))}
                clearable={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                <strong>Lista única</strong>: tudo numa só lista.{" "}
                <strong>Agrupado por status</strong>: insere cabeçalhos quando o status muda
                (ordene por status para melhor resultado).{" "}
                <strong>Abas por status</strong>: tabs para alternar entre status.
              </p>
            </div>
          </Section>
          <Section title="Atualização automática" defaultOpen>
            <div>
              <Label className="text-xs">Intervalo de refetch</Label>
              <Combobox
                mode="single"
                value={String(c.behavior.refetchIntervalMs)}
                onValueChange={(v) => {
                  const n = Number(typeof v === "string" ? v : 0);
                  setBehavior("refetchIntervalMs", Number.isFinite(n) ? n : 0);
                }}
                options={REFETCH_OPTIONS.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
                clearable={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Atualiza os dados em segundo plano. Use com moderação para não sobrecarregar a API.
              </p>
            </div>
          </Section>
          <Section title='Sobrescrever rota "Ver todos"'>
            <div>
              <Label className="text-xs">Rota personalizada</Label>
              <Input
                value={c.behavior.viewAllRouteOverride}
                onChange={(v) =>
                  setBehavior("viewAllRouteOverride", typeof v === "string" ? v : "")
                }
                placeholder="Ex.: /producao/agenda?status=COMPLETED"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Vazio = usa a rota padrão do destino selecionado em "Colunas → Navegação".
              </p>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Inline icon — local lightweight (not in tabler-react bundle import group above
// to avoid bloating the main import block above with one-offs).
function IconBookmark(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ============================================================================
// Definition
// ============================================================================

export const taskTableWidget: WidgetDefinition<TaskTableConfig> = {
  id: "table.tasks",
  name: "Tabela de Tarefas",
  description:
    "Tabela de tarefas com paridade visual à página de preparação: OSs ricas, pintura em canvas, contagem regressiva, cores de prazo configuráveis, multi-ordenação, presets e modo abas/agrupado.",
  icon: IconClipboardText,
  category: "production",
  allowedSectors: "*",
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: taskTableConfigSchema,
  defaultConfig: {
    title: "Tarefas",
    accent: { color: "gray", icon: "ClipboardText", borderColor: "none" },
    rowClickTarget: "task",
    display: {
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
      showRowDot: true,
      showSearchBox: false,
      showViewAllLink: true,
      emptyStateMessage: "",
      layoutMode: "flat",
    },
    cellModes: {
      serviceOrder: "progress-bar",
      paint: "swatch-name",
      status: "badge",
    },
    deadlineColors: {
      enabled: true,
      bold: true,
      forecastCriticalDays: DEFAULT_FORECAST_COLOR_CONFIG.criticalDays,
      forecastWarningDays: DEFAULT_FORECAST_COLOR_CONFIG.warningDays,
      forecastNoticeDays: DEFAULT_FORECAST_COLOR_CONFIG.noticeDays,
      forecastCriticalColor: DEFAULT_FORECAST_COLOR_CONFIG.criticalColor,
      forecastWarningColor: DEFAULT_FORECAST_COLOR_CONFIG.warningColor,
      forecastNoticeColor: DEFAULT_FORECAST_COLOR_CONFIG.noticeColor,
      termOverdueColor: DEFAULT_TERM_COLOR_CONFIG.overdueColor,
      termCriticalHours: DEFAULT_TERM_COLOR_CONFIG.criticalHours,
      termCriticalColor: DEFAULT_TERM_COLOR_CONFIG.criticalColor,
      termOnTrackColor: DEFAULT_TERM_COLOR_CONFIG.onTrackColor,
    },
    columns: ["name", "customerName", "serialNumber", "term"],
    columnWidths: {},
    filters: {
      status: [],
      sectorIds: [],
      customerIds: [],
      assigneeIds: [],
      truckCategories: [],
      implementTypes: [],
      commissions: [],
      hasTruck: "any",
      termPreset: "any",
      forecastPreset: "any",
      finishedPreset: "any",
      createdPreset: "any",
      termRange: { from: null, to: null },
      forecastRange: { from: null, to: null },
      finishedRange: { from: null, to: null },
      createdRange: { from: null, to: null },
      entryRange: { from: null, to: null },
      hasOpenSO: "any",
      hasArtworks: "any",
      hasObservation: "any",
      hasBudget: "any",
      isOverdue: "any",
      serviceOrderTypes: [],
      quoteStatuses: [],
      defaultSearch: "",
    },
    sort: { key: "term", direction: "asc" },
    sorts: [{ key: "term", direction: "asc" }],
    limit: 20,
    showHeader: true,
    behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
    presets: [],
  },
  RenderComponent: TaskTableRender,
  ConfigComponent: TaskTableConfigComponent,
};

// Silence unused-imports lint for items kept for future use
void IconRefresh;
void IconCornerDownLeft;
void deadlineColorTextClass;
