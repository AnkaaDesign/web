// Generic, fully configurable task table widget.
//
// Mirrors the production task preparation page's column + filter set, plus
// per-instance overrides for visual density, deadline color thresholds,
// runtime search, layout mode (flat / grouped-by-status / tabs) and refetch
// interval.
//
// File is organized in clearly labeled sections. The catalog and config UI
// are intentionally co-located so adding a new column means touching one file.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconAdjustments,
  IconClipboardText,
  IconColumns,
  IconCornerDownLeft,
  IconFilter,
  IconLayout,
  IconPalette,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";

import {
  ARTWORK_STATUS,
  ARTWORK_STATUS_LABELS,
  BONIFICATION_STATUS,
  BONIFICATION_STATUS_LABELS,
  IMPLEMENT_TYPE,
  IMPLEMENT_TYPE_LABELS,
  PAINT_FINISH,
  PAINT_FINISH_LABELS,
  SECTOR_PRIVILEGES,
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
import { useTasks, useTaskMutations } from "../../hooks/production/use-task";
import {
  TaskTableContextMenu,
  type TaskAction,
} from "../../components/production/task/schedule/task-table-context-menu";
import { SetTermModal } from "../../components/production/task/schedule/set-term-modal";
import { TaskDuplicateModal } from "../../components/production/task/modals/task-duplicate-modal";
import { SetSectorModal } from "../../components/production/task/schedule/set-sector-modal";
import { SetStatusModal } from "../../components/production/task/schedule/set-status-modal";
import { CopyFromTaskModal } from "../../components/production/task/schedule/copy-from-task-modal";
import { AdvancedBulkActionsHandler } from "../../components/production/task/bulk-operations/AdvancedBulkActionsHandler";
import { taskService } from "@/api-client/task";
import { taskKeys } from "@/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import type { CopyableTaskField } from "@/types/task-copy";
import { getTaskQuoteEditRoute } from "../../utils/task";
import { useReturnTo } from "../../hooks/common/use-return-to";
import { useSectors } from "../../hooks/administration/use-sector";
import { useCustomers } from "../../hooks/administration/use-customer";
import {
  DEADLINE_COLOR_LABELS,
  DEADLINE_COLOR_TOKENS,
  DEFAULT_FORECAST_COLOR_CONFIG,
  DEFAULT_TERM_COLOR_CONFIG,
  deadlineColorSwatchClass,
  getForecastColorClass,
  getTermColorClass,
  isOverdue as isTaskOverdue,
  parseDeadlineColor,
  type DeadlineColorToken,
  type ForecastColorConfig,
  type TermColorConfig,
} from "../../utils/task-date-colors";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Badge } from "../../components/ui/badge";
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
import { useAuth } from "@/hooks/common/use-auth";
import { canViewTaskFinancialColumns, isTaskFinancialColumn } from "@/utils/permissions/task-column-permissions";
import { DeadlineCountdown } from "../../components/production/task/schedule/deadline-countdown";
import { QuoteStatusBadge } from "../../components/production/task/quote/quote-status-badge";
import { FilePreviewModal } from "../../components/common/file/file-preview-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
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
import { getFileThumbnailUrl } from "../../utils/file";

import { WidgetCard } from "../components/widget-card";
import { ColumnPicker } from "../components/column-picker";
import type { ColumnSort } from "../components/column-picker";
import {
  AccentPicker,
  ColorPaletteDialog,
  resolveAccent,
} from "../components/widget-accent";
import {
  Section,
  ToggleRow,
  LimitInput,
  DensitySegmented,
  REFETCH_INTERVAL_OPTIONS,
  densityClasses,
  makeTableDisplaySchema,
  TABLE_DISPLAY_DEFAULTS,
  coerceRefreshMs,
} from "./_shared";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
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

// Status badges follow the centralized BADGE_COLORS workflow (solid bg + white
// text). Hues match ENTITY_BADGE_CONFIG.TASK in constants/badge-colors.ts:
//   preparation = orange, waiting = gray, in-production = blue,
//   completed = green, cancelled = red.
const STATUS_BADGE_CLASSES: Record<TASK_STATUS, string> = {
  [TASK_STATUS.PREPARATION]: "bg-orange-600 text-white border-orange-700",
  [TASK_STATUS.WAITING_PRODUCTION]: "bg-neutral-500 text-white border-neutral-600",
  [TASK_STATUS.IN_PRODUCTION]: "bg-blue-700 text-white border-blue-800",
  [TASK_STATUS.COMPLETED]: "bg-green-700 text-white border-green-800",
  [TASK_STATUS.CANCELLED]: "bg-red-700 text-white border-red-800",
};
const STATUS_DOT_CLASSES: Record<TASK_STATUS, string> = {
  [TASK_STATUS.PREPARATION]: "bg-orange-600",
  [TASK_STATUS.WAITING_PRODUCTION]: "bg-neutral-500",
  [TASK_STATUS.IN_PRODUCTION]: "bg-blue-700",
  [TASK_STATUS.COMPLETED]: "bg-green-700",
  [TASK_STATUS.CANCELLED]: "bg-red-700",
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
  | "bonification"
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

const COLUMN_KEY_VALUES = [
  "name",
  "customerName",
  "responsibles",
  "serialNumber",
  "chassisNumber",
  "plate",
  "spot",
  "sector",
  "status",
  "bonification",
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
] as const satisfies readonly ColumnKey[];

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

// ============================================================================
// Artworks cell + modal
// ============================================================================
// The "Artes" column displays the artwork count and overrides the row click
// to open an inline modal listing every artwork for the task with its status.
// Clicking a thumbnail in the listing hands off to the shared FilePreviewModal
// so the user can preview/download/zoom the file with the same UX as the rest
// of the app. Badges follow the same `approved` / `rejected` variants used in
// the task detail page (`components/production/task/artwork/artwork-status-badge.tsx`)
// so the visual language stays consistent.

function artworkStatusBadgeVariant(
  status: ARTWORK_STATUS,
): "approved" | "rejected" | "secondary" {
  switch (status) {
    case ARTWORK_STATUS.APPROVED:
      return "approved";
    case ARTWORK_STATUS.REPROVED:
      return "rejected";
    default:
      return "secondary";
  }
}

type TaskArtwork = {
  id: string;
  artworkId?: string;
  status: ARTWORK_STATUS;
  filename: string;
  originalName?: string;
  path?: string;
  mimetype: string;
  size?: number;
  thumbnailUrl?: string | null;
};

function ArtworksCell({ task }: { task: Task }) {
  const artworks = ((task as any).artworks ?? []) as TaskArtwork[];
  const count = artworks.length;
  const [listOpen, setListOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (count === 0) {
    return <span className="text-sm tabular-nums text-muted-foreground">0</span>;
  }

  // React synthetic events propagate through the *virtual* tree, not the DOM
  // tree. Even though Radix portals the dialog content to <body>, the dialog
  // is still a React child of this cell — and this cell is a child of the
  // table row, which has an onClick that navigates to the task detail page.
  // Without this boundary, closing FilePreviewModal (via X / Escape / overlay
  // click) would bubble up the virtual tree into the row's onClick and
  // trigger navigation. The wrapper stops both pointer and keyboard events
  // before they can reach the row.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Status breakdown — drives the cell color so users see at a glance whether
  // anything still needs approval.
  const counts = artworks.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const hasReproved = (counts[ARTWORK_STATUS.REPROVED] ?? 0) > 0;
  const hasDraft = (counts[ARTWORK_STATUS.DRAFT] ?? 0) > 0;
  const allApproved = !hasReproved && !hasDraft;
  const cellColor = hasReproved
    ? "text-red-500"
    : hasDraft
      ? "text-amber-500"
      : allApproved
        ? "text-emerald-500"
        : "";

  return (
    <span
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          // Cell click overrides the row click — never navigate away.
          e.stopPropagation();
          setListOpen(true);
        }}
        onKeyDown={(e) => {
          // The row owns Enter/Space for navigation. Re-bind them here so the
          // cell button can be activated from the keyboard without the row
          // hijacking the event.
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            setListOpen(true);
          }
        }}
        className={`text-sm tabular-nums font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 ${cellColor}`}
        aria-label={`Ver ${count} ${count === 1 ? "arte" : "artes"} da tarefa`}
      >
        {count}
      </button>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent
          className="max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Artes — {task.name ?? task.serialNumber ?? ""}</DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? "arte" : "artes"} ·{" "}
              {(Object.keys(counts) as ARTWORK_STATUS[])
                .map((s) => `${counts[s]} ${ARTWORK_STATUS_LABELS[s] ?? s}`)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-auto pr-1">
            {artworks.map((art, idx) => {
              const thumb = getFileThumbnailUrl(art as any) || art.thumbnailUrl || null;
              const label = art.originalName || art.filename;
              return (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setPreviewIndex(idx)}
                  className="group relative flex flex-col items-stretch gap-1.5 rounded-md border border-border bg-card p-2 text-left hover:border-primary hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={label}
                >
                  <div className="aspect-square overflow-hidden rounded bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={label}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        {art.mimetype?.split("/")[1]?.toUpperCase() ?? "Arquivo"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge
                      variant={artworkStatusBadgeVariant(art.status)}
                      size="sm"
                      className="shrink-0"
                    >
                      {ARTWORK_STATUS_LABELS[art.status] ?? art.status}
                    </Badge>
                    <span className="truncate text-xs text-foreground min-w-0">
                      {label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewModal
        files={artworks as any}
        initialFileIndex={previewIndex ?? 0}
        open={previewIndex !== null}
        onOpenChange={(v) => {
          if (!v) setPreviewIndex(null);
        }}
      />
    </span>
  );
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
      key: "bonification",
      label: "Bonificação",
      track: "minmax(0, 1fr)",
      render: (t) => {
        const c = (t as any).bonification as BONIFICATION_STATUS | null | undefined;
        if (!c) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 truncate">
            {BONIFICATION_STATUS_LABELS[c] ?? c}
          </Badge>
        );
      },
    },
    {
      key: "term",
      label: "Prazo",
      track: "minmax(0, 1fr)",
      render: (t, ctx) => {
        const isInactive =
          t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.CANCELLED;
        const cls = isInactive ? "" : dateClassFor(t.term, "term", ctx);
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
        const isInactive =
          t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.CANCELLED;
        const cls = isInactive ? "" : dateClassFor(t.forecastDate, "forecast", ctx);
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
      render: (t) => <ArtworksCell task={t} />,
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
  "bonificationOrder",
  "updatedAt",
] as const;
const TRI_STATE = ["any", "yes", "no"] as const;
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

const taskTableConfigSchemaInner = z.object({
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
      borderThickness: z.enum(["none", "thin", "medium", "thick"]).optional(),
      shade: z
        .enum(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"])
        .optional(),
    })
    .default({ color: "gray", icon: "ClipboardText", borderColor: "none" }),

  rowClickTarget: z.enum(["task", "budget", "billing"]).default("task"),

  // Canonical cross-platform table display block plus the task-specific layout
  // mode. Two shared fields keep this widget's prior (non-default) values via the
  // factory overrides: showRowDot=true and showSearchBox=false. The factory
  // additively contributes showColumnHeaders / emptyStateMessage /
  // refreshIntervalMs / showHeader (the last unused here — task-table reads the
  // top-level `config.showHeader`). The extras object is itself `.default()`ed so
  // the intersection still parses when `display` is absent.
  display: makeTableDisplaySchema({
    showRowDot: true,
    showSearchBox: false,
  }).and(
    z
      .object({
        layoutMode: z.enum(LAYOUT_MODES).default("flat"),
      })
      .default({ layoutMode: "flat" }),
  ),

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
      // Shade-aware tokens (e.g. "red-500"). Bare tokens like "red" still
      // parse as legacy data and resolve to shade 500 at render time.
      forecastCriticalColor: z.string().default("red-500"),
      forecastWarningColor: z.string().default("orange-500"),
      forecastNoticeColor: z.string().default("yellow-500"),
      termOverdueColor: z.string().default("red-500"),
      termCriticalHours: z.number().min(0).max(72).default(4),
      termCriticalColor: z.string().default("amber-500"),
      termOnTrackColor: z.string().default("green-500"),
    })
    .default({
      enabled: true,
      bold: true,
      forecastCriticalDays: 3,
      forecastWarningDays: 7,
      forecastNoticeDays: 10,
      forecastCriticalColor: "red-500",
      forecastWarningColor: "orange-500",
      forecastNoticeColor: "yellow-500",
      termOverdueColor: "red-500",
      termCriticalHours: 4,
      termCriticalColor: "amber-500",
      termOnTrackColor: "green-500",
    }),

  columns: z
    .array(z.enum(COLUMN_KEY_VALUES))
    .min(1)
    .default(["name", "customerName", "serialNumber", "term"]),

  columnWidths: z.record(z.string()).default({}),

  // User-supplied label overrides per column key. Empty/missing entries fall
  // back to the catalog's default label.
  columnLabels: z.record(z.string()).default({}),

  filters: z
    .object({
      status: z.array(z.nativeEnum(TASK_STATUS)).default([]),
      sectorIds: z.array(z.string().uuid()).default([]),
      customerIds: z.array(z.string().uuid()).default([]),
      assigneeIds: z.array(z.string().uuid()).default([]),
      truckCategories: z.array(z.nativeEnum(TRUCK_CATEGORY)).default([]),
      implementTypes: z.array(z.nativeEnum(IMPLEMENT_TYPE)).default([]),
      bonifications: z.array(z.nativeEnum(BONIFICATION_STATUS)).default([]),
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
      bonifications: [],
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

  // Multi-sort accepts ANY column key (z.string()), not just the strict
  // SORT_KEYS subset — users should be able to sort by any visible column
  // (Cliente, Identificador, Setor, etc.). The Prisma orderBy accepts the
  // raw key for native fields; nested fields are handled by the API layer.
  sorts: z
    .array(
      z.object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "term", direction: "asc" }]),

  limit: z.number().int().min(5).max(200).default(20),
  showHeader: z.boolean().default(true),

  behavior: z
    .object({
      // Legacy refresh field. Kept for back-compat (the config UI still writes
      // it); the canonical value lives in `display.refreshIntervalMs`, folded in
      // by the preprocess wrapper below.
      refetchIntervalMs: z.number().int().min(0).max(3_600_000).default(0),
      viewAllRouteOverride: z.string().default(""),
    })
    .default({ refetchIntervalMs: 0, viewAllRouteOverride: "" }),
});

// Back-compat shim: older persisted configs stored the refresh interval at
// `behavior.refetchIntervalMs` (number) and have no `display.refreshIntervalMs`.
// Fold the legacy value into the canonical field before validation. Guarded so
// undefined / non-object input passes through untouched.
export const taskTableConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const display =
    obj.display && typeof obj.display === "object"
      ? (obj.display as Record<string, unknown>)
      : undefined;
  const behavior =
    obj.behavior && typeof obj.behavior === "object"
      ? (obj.behavior as Record<string, unknown>)
      : undefined;
  const hasCanonical =
    display && typeof display.refreshIntervalMs === "number";
  const legacy = behavior?.refetchIntervalMs;
  if (!hasCanonical && legacy !== undefined) {
    return {
      ...obj,
      display: {
        ...(display ?? {}),
        refreshIntervalMs: coerceRefreshMs(legacy),
      },
    };
  }
  return raw;
}, taskTableConfigSchemaInner);

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

type TaskQueryParams = {
  where: Record<string, unknown>;
  searchingFor?: string;
  createdByIds?: string[];
  isOverdue?: boolean;
};

function buildQueryParams(
  config: TaskTableConfig,
  runtimeSearch: string,
  runtimeStatus?: TASK_STATUS,
): TaskQueryParams {
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
  if (f.bonifications.length > 0) where.bonification = { in: f.bonifications };

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

  // isOverdue 'yes' → top-level helper (API adds `term: not null` + active status)
  // isOverdue 'no' → manual where (API has no built-in "not overdue")
  let isOverdueParam: boolean | undefined;
  if (f.isOverdue === "yes") {
    isOverdueParam = true;
  } else if (f.isOverdue === "no") {
    ANDs.push({
      OR: [
        { term: null },
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

  if (ANDs.length > 0) where.AND = ANDs;

  // Top-level helpers — these are NOT valid keys inside the strict where schema,
  // so they must be sent as separate query params alongside `where`.
  const search = runtimeSearch.trim() || f.defaultSearch.trim();
  return {
    where,
    searchingFor: search || undefined,
    createdByIds: f.assigneeIds.length > 0 ? f.assigneeIds : undefined,
    isOverdue: isOverdueParam,
  };
}

// Column keys whose backing data lives on a related model — these need to be
// expanded into nested Prisma orderBy clauses or Prisma silently ignores them.
// (e.g. sorting by "quoteStatus" must hit `quote.statusOrder`, not a top-level
// `quoteStatus` field that doesn't exist on Task.)
const ORDER_BY_PATH_MAP: Partial<Record<ColumnKey, readonly string[]>> = {
  quoteStatus: ["quote", "statusOrder"],
  quoteTotal: ["quote", "total"],
  customerName: ["customer", "fantasyName"],
  sector: ["sector", "name"],
  generalPainting: ["generalPainting", "name"],
  plate: ["truck", "plate"],
  chassisNumber: ["truck", "chassisNumber"],
};

function orderByEntry(key: string, direction: "asc" | "desc"): Record<string, any> {
  const path = ORDER_BY_PATH_MAP[key as ColumnKey];
  if (!path || path.length === 0) return { [key]: direction };
  const last = path[path.length - 1];
  let nested: Record<string, any> = { [last]: direction };
  for (let i = path.length - 2; i >= 0; i--) {
    nested = { [path[i]]: nested };
  }
  return nested;
}

function buildOrderBy(config: TaskTableConfig): Array<Record<string, any>> {
  if (config.sorts && config.sorts.length > 0) {
    return config.sorts.map((s) => orderByEntry(s.key, s.direction));
  }
  return [orderByEntry(config.sort.key, config.sort.direction)];
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
  const returnTo = useReturnTo();
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
      // Clamp width to a sane range so a runaway drag can't blow out the layout.
      const clamped = Math.min(800, Math.max(40, Math.round(px)));
      const next = { ...liveWidths, [key]: `${clamped}px` };
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

  const queryParams = useMemo(
    () => buildQueryParams(config, debouncedSearch, runtimeStatus),
    [config, debouncedSearch, runtimeStatus],
  );
  const orderBy = useMemo(() => buildOrderBy(config), [config]);

  const { data, isLoading, isError, refetch } = useTasks({
    where: queryParams.where,
    searchingFor: queryParams.searchingFor,
    createdByIds: queryParams.createdByIds,
    isOverdue: queryParams.isOverdue,
    orderBy: orderBy as any,
    take: config.limit,
    include: TASK_INCLUDE as any,
  } as any);

  // Background refetch — useTasks doesn't support refetchInterval, so we drive
  // it ourselves. Skip when the tab is hidden so we don't churn against the API
  // for an off-screen dashboard. Clamp to a 5s floor so a misconfigured value
  // can't hammer the API. The interval reads from the canonical
  // `display.refreshIntervalMs` (0 disables), falling back to the legacy
  // `behavior.refetchIntervalMs` for configs that predate the preprocess shim.
  const rawInterval =
    config.display?.refreshIntervalMs || config.behavior?.refetchIntervalMs || 0;
  const refetchInterval = rawInterval > 0 ? Math.max(5000, rawInterval) : 0;
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

  // ----- Right-click context menu -----
  // Full parity with the production schedule page's menu: every action the
  // shared TaskTableContextMenu renders (start/finish/edit/duplicate/quote/
  // setSector/setTerm/setStatus, the advanced bulk submenu, copy-from-task and
  // delete) is wired here to the same standalone modals/handlers those pages
  // use. The menu component shows only items the user has permission for, so
  // unprivileged sectors still see no menu at all.
  const { updateAsync, deleteAsync: deleteTaskAsync } = useTaskMutations();
  const queryClient = useQueryClient();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tasks: Task[];
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ tasks: Task[] } | null>(
    null,
  );
  const [setTermDialog, setSetTermDialog] = useState<{ tasks: Task[] } | null>(
    null,
  );
  const [taskToDuplicate, setTaskToDuplicate] = useState<Task | null>(null);
  const [sectorDialog, setSectorDialog] = useState<{ tasks: Task[] } | null>(
    null,
  );
  const [statusDialog, setStatusDialog] = useState<{ tasks: Task[] } | null>(
    null,
  );
  const advancedActionsRef = useRef<{
    openModal: (type: string, taskIds: string[]) => void;
  } | null>(null);
  // Copy-from-task is a list-level flow: pick fields → click a source row in
  // this widget's own list → confirm. Mirrors task-history-list.tsx.
  const [copyState, setCopyState] = useState<{
    step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
    targetTasks: Task[];
    selectedFields: CopyableTaskField[];
    sourceTask: Task | null;
  }>({ step: "idle", targetTasks: [], selectedFields: [], sourceTask: null });

  const handleContextMenu = useCallback((e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tasks: [task] });
  }, []);

  // Click anywhere closes the menu.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  const handleAction = useCallback(
    async (action: TaskAction, actionTasks: Task[]) => {
      try {
        switch (action) {
          case "start":
            for (const t of actionTasks) {
              if (
                t.status === TASK_STATUS.WAITING_PRODUCTION ||
                t.status === TASK_STATUS.PREPARATION
              ) {
                await updateAsync({
                  id: t.id,
                  data: { status: TASK_STATUS.IN_PRODUCTION },
                } as any);
              }
            }
            break;
          case "finish":
            for (const t of actionTasks) {
              if (t.status === TASK_STATUS.IN_PRODUCTION) {
                await updateAsync({
                  id: t.id,
                  data: { status: TASK_STATUS.COMPLETED },
                } as any);
              }
            }
            break;
          case "view":
          case "edit":
            if (actionTasks.length === 1) {
              navigate(detailHref(actionTasks[0].id));
            }
            break;
          case "quote":
            if (actionTasks.length === 1) {
              navigate(getTaskQuoteEditRoute(actionTasks[0]), { state: { returnTo } });
            }
            break;
          case "setTerm":
            setSetTermDialog({ tasks: actionTasks });
            break;
          case "delete":
            setDeleteDialog({ tasks: actionTasks });
            break;
          case "duplicate":
            if (actionTasks.length === 1) {
              setTaskToDuplicate(actionTasks[0]);
            }
            break;
          case "setSector":
            setSectorDialog({ tasks: actionTasks });
            break;
          case "setStatus":
            setStatusDialog({ tasks: actionTasks });
            break;
          case "bulkArts":
            advancedActionsRef.current?.openModal(
              "arts",
              actionTasks.map((t) => t.id),
            );
            break;
          case "bulkBaseFiles":
            advancedActionsRef.current?.openModal(
              "baseFiles",
              actionTasks.map((t) => t.id),
            );
            break;
          case "bulkPaints":
            advancedActionsRef.current?.openModal(
              "paints",
              actionTasks.map((t) => t.id),
            );
            break;
          case "bulkCuttingPlans":
            advancedActionsRef.current?.openModal(
              "cuttingPlans",
              actionTasks.map((t) => t.id),
            );
            break;
          case "bulkServiceOrder":
            advancedActionsRef.current?.openModal(
              "serviceOrder",
              actionTasks.map((t) => t.id),
            );
            break;
          case "bulkLayout":
            advancedActionsRef.current?.openModal(
              "layout",
              actionTasks.map((t) => t.id),
            );
            break;
          case "copyFromTask":
            setCopyState({
              step: "selecting_fields",
              targetTasks: actionTasks,
              selectedFields: [],
              sourceTask: null,
            });
            break;
          default:
            break;
        }
      } catch {
        // Mutation hooks fire toasts on failure.
      }
    },
    [updateAsync, navigate, returnTo],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    try {
      for (const t of deleteDialog.tasks) {
        await deleteTaskAsync(t.id);
      }
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, deleteTaskAsync]);

  const confirmSetTerm = useCallback(
    async (term: Date | null) => {
      if (!setTermDialog) return;
      try {
        for (const t of setTermDialog.tasks) {
          await updateAsync({ id: t.id, data: { term } } as any);
        }
      } finally {
        setSetTermDialog(null);
      }
    },
    [setTermDialog, updateAsync],
  );

  const confirmSetSector = useCallback(
    async (sectorId: string | null) => {
      if (!sectorDialog) return;
      try {
        for (const t of sectorDialog.tasks) {
          await updateAsync({ id: t.id, data: { sectorId } } as any);
        }
      } finally {
        setSectorDialog(null);
      }
    },
    [sectorDialog, updateAsync],
  );

  const confirmSetStatus = useCallback(
    async (status: TASK_STATUS) => {
      if (!statusDialog) return;
      try {
        for (const t of statusDialog.tasks) {
          await updateAsync({ id: t.id, data: { status } } as any);
        }
      } finally {
        setStatusDialog(null);
      }
    },
    [statusDialog, updateAsync],
  );

  // ----- Copy-from-task flow (mirrors task-history-list.tsx) -----
  const resetCopyState = useCallback(
    () =>
      setCopyState({
        step: "idle",
        targetTasks: [],
        selectedFields: [],
        sourceTask: null,
      }),
    [],
  );

  const handleCopyStartSourceSelection = useCallback(
    (selectedFields: CopyableTaskField[]) =>
      setCopyState((prev) => ({ ...prev, step: "selecting_source", selectedFields })),
    [],
  );

  const handleCopyChangeSource = useCallback(
    () => setCopyState((prev) => ({ ...prev, step: "selecting_source", sourceTask: null })),
    [],
  );

  const handleCopySourceSelected = useCallback(
    async (sourceTask: Task) => {
      try {
        const full = await taskService.getTaskById(sourceTask.id, {
          include: {
            artworks: { include: { file: true } },
            budgets: true,
            invoices: true,
            receipts: true,
            quote: true,
            logoPaints: true,
            cuts: true,
            serviceOrders: true,
            truck: {
              include: {
                leftSideLayout: { include: { layoutSections: true, photo: true } },
                rightSideLayout: { include: { layoutSections: true, photo: true } },
                backSideLayout: { include: { layoutSections: true, photo: true } },
              },
            },
          },
        } as any);
        if (!full.success || !full.data) {
          throw new Error("Failed to fetch source task details");
        }
        setCopyState((prev) => ({ ...prev, step: "confirming", sourceTask: full.data ?? null }));
      } catch {
        toast.error("Falha ao carregar detalhes da tarefa de origem");
        resetCopyState();
      }
    },
    [resetCopyState],
  );

  const handleCopyConfirm = useCallback(
    async (selectedFields: CopyableTaskField[], sourceTask: Task) => {
      const targetTasks = copyState.targetTasks;
      try {
        let success = 0;
        // Sequential to avoid budgetNumber unique-constraint races when copying quotes.
        for (const target of targetTasks) {
          try {
            await taskService.copyFromTask(target.id, {
              sourceTaskId: sourceTask.id,
              fields: selectedFields,
            });
            success++;
          } catch {
            // Aggregate — reported below.
          }
        }
        if (success > 0) {
          toast.success("Campos copiados com sucesso", {
            description: `${selectedFields.length} campo(s) copiado(s) de "${sourceTask.name}" para ${success} tarefa(s)`,
          });
          queryClient.invalidateQueries({ queryKey: taskKeys.all });
          refetch?.();
        } else {
          toast.error("Erro ao copiar campos", {
            description: "Não foi possível copiar os campos. Tente novamente.",
          });
        }
      } finally {
        resetCopyState();
      }
    },
    [copyState.targetTasks, queryClient, refetch, resetCopyState],
  );

  // Strip financial columns (price/quoteTotal/quoteStatus) for sectors
  // that aren't allowed to see them. The widget allowlist gates access to
  // the widget overall; this is the per-column layer for sensitive fields.
  const { user } = useAuth();
  const sectorPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const canSeeFinancials = canViewTaskFinancialColumns(sectorPrivilege);

  const cols = useMemo(
    () =>
      config.columns
        .map((k) => COLUMN_BY_KEY[k])
        .filter(Boolean)
        .filter((c) => canSeeFinancials || !isTaskFinancialColumn(c.key)),
    [config.columns, canSeeFinancials],
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
    ...TABLE_DISPLAY_DEFAULTS,
    showRowDot: true,
    showSearchBox: false,
    layoutMode: "flat" as const,
  };
  const dens = densityClasses(display.density);
  const stickyClass = display.stickyHeader ? "sticky top-0 z-20" : "";
  const rowBorder = display.gridLines ? "border-b border-border last:border-b-0" : "";
  // Striping and hover-highlight are always on — non-configurable now.
  const rowHover = "hover:bg-secondary/50";
  const emptyMsg = "Nenhuma tarefa encontrada";

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
        <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
          <div>Erro ao carregar tarefas.</div>
          {refetch && (
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs text-primary hover:underline"
            >
              Tentar novamente
            </button>
          )}
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

  const selectingSource = copyState.step === "selecting_source";
  const isCopyTarget = (id: string) => copyState.targetTasks.some((t) => t.id === id);
  const activateRow = (task: Task) => {
    if (selectingSource) {
      // Don't allow a target task to be its own source.
      if (isCopyTarget(task.id)) return;
      handleCopySourceSelected(task);
      return;
    }
    navigate(detailHref(task.id));
  };

  const renderRow = (task: Task, i: number) => (
    <div
      key={task.id}
      role="button"
      tabIndex={0}
      aria-label={
        selectingSource
          ? `Copiar de ${task.name ?? task.serialNumber ?? task.id}`
          : `Abrir tarefa ${task.name ?? task.serialNumber ?? task.id}`
      }
      className={`grid gap-x-3 items-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${dens.row} ${rowBorder} ${rowHover} ${
        i % 2 === 1 ? "bg-muted/20" : ""
      } ${selectingSource && isCopyTarget(task.id) ? "opacity-40 pointer-events-none" : ""} ${
        selectingSource && !isCopyTarget(task.id) ? "hover:ring-2 hover:ring-primary hover:ring-inset" : ""
      }`}
      style={{ gridTemplateColumns: gridTemplate }}
      onClick={() => activateRow(task)}
      onContextMenu={(e) => handleContextMenu(e, task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateRow(task);
        }
      }}
    >
      {cols.map((c) => (
        <div
          key={c.key}
          className={`min-w-0 ${c.needsRelative ? "relative" : "overflow-hidden"}`}
        >
          {c.render(task, ctx)}
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
        {cols.map((c, i) => {
          const displayLabel = config.columnLabels?.[c.key]?.trim() || c.label;
          return (
          <div
            key={c.key}
            data-col-key={c.key}
            className="relative truncate select-none"
            title={displayLabel}
          >
            {displayLabel}
            {i < cols.length - 1 && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Redimensionar coluna ${displayLabel}`}
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
          );
        })}
      </div>
      {renderRows()}
    </>
  );

  const body =
    layoutMode === "tabs" ? (
      <Tabs
        value={activeStatusTab}
        onValueChange={(v) => {
          setActiveStatusTab(v as TASK_STATUS | "ALL");
          // Reset search across tab boundaries — a query that matched on the
          // previous tab is rarely meaningful on a different status subset.
          setSearchInput("");
        }}
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
      <div className="h-full min-h-0 overflow-auto">{tableBody}</div>
    );

  return (
    <WidgetCard
      showHeader={config.showHeader}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={display.showViewAllLink ? viewAllHref : undefined}
      headerExtra={headerExtra}
      count={display.showCount && !isLoading ? visibleCount : null}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
      accentColor={config.accent?.color}
      accentShade={config.accent?.shade}
    >
      {selectingSource && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-primary/10 border-b border-primary/30">
          <span className="text-primary font-medium truncate">
            Clique em uma tarefa para copiar seus dados
          </span>
          <button
            type="button"
            onClick={resetCopyState}
            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground underline"
          >
            Cancelar
          </button>
        </div>
      )}
      {body}
      <TaskTableContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onAction={handleAction}
      />
      <SetTermModal
        open={!!setTermDialog}
        onOpenChange={(open) => !open && setSetTermDialog(null)}
        tasks={setTermDialog?.tasks ?? []}
        onConfirm={confirmSetTerm}
      />
      <TaskDuplicateModal
        task={taskToDuplicate}
        open={!!taskToDuplicate}
        onOpenChange={(open) => {
          if (!open) setTaskToDuplicate(null);
        }}
        onSuccess={() => {
          setTaskToDuplicate(null);
          refetch?.();
        }}
      />
      <SetSectorModal
        open={!!sectorDialog}
        onOpenChange={(open) => !open && setSectorDialog(null)}
        tasks={sectorDialog?.tasks ?? []}
        onConfirm={confirmSetSector}
      />
      <SetStatusModal
        open={!!statusDialog}
        onOpenChange={(open) => !open && setStatusDialog(null)}
        tasks={statusDialog?.tasks ?? []}
        onConfirm={confirmSetStatus}
      />
      <CopyFromTaskModal
        open={copyState.step === "selecting_fields" || copyState.step === "confirming"}
        onOpenChange={(open) => !open && resetCopyState()}
        step={copyState.step === "confirming" ? "confirming" : "selecting_fields"}
        targetTasks={copyState.targetTasks}
        sourceTask={copyState.sourceTask}
        onStartSourceSelection={handleCopyStartSourceSelection}
        onConfirm={handleCopyConfirm}
        onCancel={resetCopyState}
        onChangeSource={handleCopyChangeSource}
        userPrivilege={user?.sector?.privileges}
      />
      <AdvancedBulkActionsHandler
        ref={advancedActionsRef}
        selectedTaskIds={new Set<string>()}
        onClearSelection={() => {
          refetch?.();
        }}
      />
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog && deleteDialog.tasks.length > 1
                ? `Excluir ${deleteDialog.tasks.length} tarefas?`
                : "Excluir tarefa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
// SORT_LABELS removed: the standalone sort UI was replaced by inline chips on
// the column picker, which uses each column's own label rather than a separate
// sort-key label table.
const SO_TYPE_LABELS_LOCAL: Record<SERVICE_ORDER_TYPE, string> = {
  [SERVICE_ORDER_TYPE.PRODUCTION]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.PRODUCTION] ?? "Produção",
  [SERVICE_ORDER_TYPE.COMMERCIAL]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.COMMERCIAL] ?? "Comercial",
  [SERVICE_ORDER_TYPE.LOGISTIC]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.LOGISTIC] ?? "Logística",
  [SERVICE_ORDER_TYPE.ARTWORK]: SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.ARTWORK] ?? "Arte",
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
// Deadline-color picker: full Tailwind grid (rows = colors × cols = shades),
// shares ColorPaletteDialog with the appearance accent picker. Stores the
// full `<color>-<shade>` token (e.g. "red-700") so the user's exact pick is
// preserved. Legacy bare tokens like "red" still parse and render via
// `parseDeadlineColor` (treated as shade 500).
const HIDDEN_DEADLINE_COLORS = new Set<DeadlineColorToken>([
  "amber",
  "emerald",
  "sky",
  "pink",
]);
const VISIBLE_DEADLINE_TOKENS = DEADLINE_COLOR_TOKENS.filter(
  (t) => !HIDDEN_DEADLINE_COLORS.has(t),
);
function ColorTokenPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDeadlineColor(value);
  const normalized = `${parsed.color}-${parsed.shade}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
      >
        <span
          className={`h-6 w-6 rounded-md shrink-0 ring-2 ring-border ${deadlineColorSwatchClass(value)}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cor
          </div>
          <div className="text-sm font-medium truncate">
            {DEADLINE_COLOR_LABELS[parsed.color]}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              · {parsed.shade}
            </span>
          </div>
        </div>
      </button>
      <ColorPaletteDialog
        open={open}
        onOpenChange={setOpen}
        value={normalized}
        onSelect={(token) => onChange(token)}
        palette={VISIBLE_DEADLINE_TOKENS}
        paletteLabels={DEADLINE_COLOR_LABELS}
        title="Selecione uma cor"
        description="A cor é aplicada ao texto da célula correspondente conforme a urgência do prazo."
      />
    </>
  );
}

function TaskTableConfigComponent({
  config: rawConfig,
  onChange,
}: WidgetConfigProps<TaskTableConfig>) {
  // Same normalization the render component does — guards against stale
  // instances saved before newer schema fields existed.
  const c = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
  const { user: authUser } = useAuth();
  const configSectorPrivilege = authUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const canSeeFinancialColsInPicker = canViewTaskFinancialColumns(configSectorPrivilege);
  const pickerCatalog = useMemo(
    () =>
      COLUMN_CATALOG.filter(
        (col) => canSeeFinancialColsInPicker || !isTaskFinancialColumn(col.key),
      ).map((col) => ({ key: col.key, label: col.label })),
    [canSeeFinancialColsInPicker],
  );
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
  const bonificationOptions = useMemo(
    () =>
      (Object.values(BONIFICATION_STATUS) as BONIFICATION_STATUS[]).map((cs) => ({
        value: cs,
        label: BONIFICATION_STATUS_LABELS[cs] ?? cs,
      })),
    [],
  );

  const triStateOptions = (Object.entries(TRI_STATE_LABELS) as [
    (typeof TRI_STATE)[number],
    string,
  ][]).map(([value, label]) => ({ value, label }));

  // Multi-sort manipulation now lives inside <ColumnPicker> via its `sorts` /
  // `onSortsChange` props — no standalone helpers needed.

  // Accent helpers
  const currentAccentColor = (c.accent?.color ?? "gray") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "ClipboardText") as WidgetAccentIcon;
  const currentAccentShade = (c.accent?.shade ?? "500") as WidgetAccentShade;

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar>
          <TabsList className="self-start bg-muted/50 h-9">
            <TabsTrigger value="appearance" className="gap-1 px-3">
              <IconAdjustments className="h-3.5 w-3.5" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="columns" className="gap-1 px-3">
              <IconColumns className="h-3.5 w-3.5" /> Colunas e ordenação
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-1 px-3">
              <IconFilter className="h-3.5 w-3.5" /> Filtros
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-1 px-3">
              <IconPalette className="h-3.5 w-3.5" /> Cores de prazo
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1 px-3">
              <IconLayout className="h-3.5 w-3.5" /> Comportamento
            </TabsTrigger>
          </TabsList>
        </WidgetTabsBar>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <Section title="Destaque (cor e ícone)" defaultOpen>
            <AccentPicker
              value={{
                color: currentAccentColor,
                icon: currentAccentIcon,
                shade: currentAccentShade,
              }}
              onChange={(next) =>
                // Defensive: fall back to existing accent fields if any
                // emitted field is missing/falsy. Prevents a partial
                // emission (e.g. from a stale closure) from clobbering
                // the saved color/icon back to defaults on parse failure.
                set("accent", {
                  color: next.color || currentAccentColor,
                  icon: next.icon || currentAccentIcon,
                  shade: next.shade || currentAccentShade,
                } as TaskTableConfig["accent"])
              }
            />
          </Section>
          <Section title="Densidade e linhas" defaultOpen>
            <div className="space-y-3">
              <DensitySegmented
                value={c.display.density}
                onChange={(d) => setDisplay("density", d)}
              />
              <div className="space-y-1">
                <ToggleRow
                  label="Linhas divisórias"
                  checked={c.display.gridLines}
                  onCheckedChange={(v) => setDisplay("gridLines", v)}
                />
              </div>
            </div>
          </Section>
          <Section title="Renderização das células">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
            </div>
          </Section>
          <Section title="Cabeçalho e link">
            <div className="space-y-1">
              <ToggleRow
                label="Exibir cabeçalho"
                checked={c.showHeader}
                onCheckedChange={(v) => set("showHeader", v)}
              />
              <ToggleRow
                label="Cabeçalho fixo"
                checked={c.display.stickyHeader}
                onCheckedChange={(v) => setDisplay("stickyHeader", v)}
              />
              <ToggleRow
                label="Exibir contagem"
                checked={c.display.showCount}
                onCheckedChange={(v) => setDisplay("showCount", v)}
              />
              <ToggleRow
                label="Caixa de busca"
                checked={c.display.showSearchBox}
                onCheckedChange={(v) => setDisplay("showSearchBox", v)}
              />
              <ToggleRow
                label='Exibir "Ver todos"'
                checked={c.display.showViewAllLink}
                onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
              />
            </div>
          </Section>
        </TabsContent>

        {/* ---- COLUMNS ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          {/*
            Single unified column picker: each row has a drag handle, a
            visibility checkbox, an inline rename input (the column name
            doubles as an editable input), a reset-to-default button, and an
            inline sort chip that drives multi-column ordering. The dedicated
            "Ordenação" section was retired in favor of these per-row chips.
          */}
          <ColumnPicker
            catalog={pickerCatalog}
            selected={c.columns}
            onChange={(next) => set("columns", next as TaskTableConfig["columns"])}
            labelOverrides={c.columnLabels}
            onLabelChange={(colKey, value) => {
              const next = { ...(c.columnLabels ?? {}) };
              if (value.trim()) next[colKey] = value;
              else delete next[colKey];
              set("columnLabels", next);
            }}
            // SortKey is a superset of ColumnKey — it also covers virtual
            // keys like `statusOrder`, `bonificationOrder`, `updatedAt` that
            // have no matching column row. Drop those from the chip-driven
            // list so the picker only juggles sorts that map to a real
            // visible row. The trade-off: virtual sorts can no longer be
            // edited from this UI — they survive untouched if already
            // present, but new ones can only be created from columns the
            // user can actually see.
            sorts={
              c.sorts.filter((s) =>
                (COLUMN_KEY_VALUES as readonly string[]).includes(s.key),
              ) as ColumnSort<ColumnKey>[]
            }
            onSortsChange={(next) => {
              // Preserve any pre-existing virtual sorts (keys not in the
              // ColumnKey universe) at the END of the list so chip edits
              // don't silently drop them.
              const virtual = c.sorts.filter(
                (s) => !(COLUMN_KEY_VALUES as readonly string[]).includes(s.key),
              );
              set("sorts", [
                ...(next as TaskTableConfig["sorts"]),
                ...virtual,
              ]);
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Para ajustar a largura, arraste a borda direita do cabeçalho da coluna
            diretamente na tabela (mesma forma da página de preparação).
          </p>
          <Section title="Quantidade máxima">
            <LimitInput
              value={c.limit}
              onChange={(n) => set("limit", n)}
            />
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Bonificação</Label>
            <Combobox
              mode="multiple"
              value={c.filters.bonifications}
              onValueChange={(v) =>
                setFilter("bonifications", asArray(v) as BONIFICATION_STATUS[])
              }
              options={bonificationOptions}
              placeholder="Qualquer bonificação"
              searchPlaceholder="Buscar..."
            />
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
        </TabsContent>

        {/* ---- COLORS ---- */}
        <TabsContent value="colors" className="space-y-3 mt-0">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Cor crítico</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastCriticalColor}
                onChange={(v) => setDeadline("forecastCriticalColor", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor atenção</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastWarningColor}
                onChange={(v) => setDeadline("forecastWarningColor", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor aviso</Label>
              <ColorTokenPicker
                value={c.deadlineColors.forecastNoticeColor}
                onChange={(v) => setDeadline("forecastNoticeColor", v)}
              />
            </div>
          </Section>
          <Section title="Prazo (em horas)" defaultOpen>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor vencido</Label>
              <ColorTokenPicker
                value={c.deadlineColors.termOverdueColor}
                onChange={(v) => setDeadline("termOverdueColor", v)}
              />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Cor crítico</Label>
              <ColorTokenPicker
                value={c.deadlineColors.termCriticalColor}
                onChange={(v) => setDeadline("termCriticalColor", v)}
              />
            </div>
            <div className="space-y-1.5">
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
          <Section title="Layout" defaultOpen>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Intervalo de refetch</Label>
              <Combobox
                mode="single"
                value={String(c.behavior.refetchIntervalMs)}
                onValueChange={(v) => {
                  const n = Number(typeof v === "string" ? v : 0);
                  setBehavior("refetchIntervalMs", Number.isFinite(n) ? n : 0);
                }}
                options={REFETCH_INTERVAL_OPTIONS}
                clearable={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Atualiza os dados em segundo plano. Use com moderação para não sobrecarregar a API.
              </p>
            </div>
          </Section>
          <Section title="Navegação">
            <div className="space-y-1.5">
              <Label className="text-xs">Destino ao clicar na linha</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Sobrescrever rota "Ver todos"</Label>
              <Input
                value={c.behavior.viewAllRouteOverride}
                onChange={(v) =>
                  setBehavior("viewAllRouteOverride", typeof v === "string" ? v : "")
                }
                placeholder="Ex.: /producao/agenda?status=COMPLETED"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Vazio = usa a rota padrão do destino selecionado acima.
              </p>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Definition
// ============================================================================

export const taskTableWidget: WidgetDefinition<TaskTableConfig> = {
  id: "table.tasks",
  name: "Tabela de Tarefas",
  description:
    "Tabela de tarefas com paridade visual à página de preparação: OSs ricas, pintura em canvas, contagem regressiva, cores de prazo configuráveis, multi-ordenação e modo abas/agrupado.",
  icon: IconClipboardText,
  category: "production",
  // Mirror /producao/cronograma route privileges. Financial columns
  // (price, quoteTotal, quoteStatus) are gated per-column inside the
  // catalog — see canViewTaskFinancialColumns().
  allowedSectors: [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PLOTTING,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: taskTableConfigSchema,
  defaultConfig: {
    title: "Tarefas",
    accent: { color: "gray", icon: "ClipboardText", borderColor: "none" },
    rowClickTarget: "task",
    display: {
      ...TABLE_DISPLAY_DEFAULTS,
      showRowDot: true,
      showSearchBox: false,
      // The intersection in configSchema also accepts the layoutMode extra.
      ...({ layoutMode: "flat" } as any),
    } as any,
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
    columnLabels: {},
    filters: {
      status: [],
      sectorIds: [],
      customerIds: [],
      assigneeIds: [],
      truckCategories: [],
      implementTypes: [],
      bonifications: [],
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
  },
  RenderComponent: TaskTableRender,
  ConfigComponent: TaskTableConfigComponent,
};

// Silence unused-imports lint for items kept for future use
void IconRefresh;
void IconCornerDownLeft;
