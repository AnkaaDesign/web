import type { Row } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import type { DataTableColumnDef, PersistedTableConfig } from "@/components/ui/datatable";
import {
  SECTOR_PRIVILEGES,
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_TYPE_LABELS,
  BONIFICATION_STATUS_LABELS,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  getBadgeVariant,
} from "@/constants";
import { canViewServiceOrderType } from "@/utils/permissions/service-order-permissions";
import { IconCalendarEvent } from "@tabler/icons-react";
import { formatCurrency } from "@/utils/number";
import { formatDate, formatDateTime, getDurationBetweenDates } from "@/utils/date";
import { formatChassis } from "@/utils/formatters";
import { calculateTaskMeasures, formatTaskMeasures } from "@/utils/task-measures";
import type { Task } from "@/types";
import type { ClusteredTask } from "./cluster-tasks";
import { TaskProgressCell } from "./task-progress-cell";

/** Tasks aggregated by a cell: the whole cluster when collapsed, otherwise just this task. */
function cellTasks(row: Row<ClusteredTask>): Task[] {
  const r = row.original;
  return row.getCanExpand() && !row.getIsExpanded() && r.__group ? r.__group : [r];
}

const FINANCIAL_SECTORS = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL];
// Sectors that may see responsibles / forecast (legacy `canViewRestrictedFields`).
const RESTRICTED_VIEWERS = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.LOGISTIC,
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
];
const BONIFICATION_VIEWERS = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.PRODUCTION,
];
const ALL_SECTORS = Object.values(SECTOR_PRIVILEGES) as SECTOR_PRIVILEGES[];

/**
 * Sectors allowed to view a service-order type column — derived from the permission matrix so it
 * stays in sync. Returns `undefined` (no gate) when EVERY sector can see it (PRODUCTION type).
 */
function soTypeViewers(type: SERVICE_ORDER_TYPE): SECTOR_PRIVILEGES[] | undefined {
  const viewers = ALL_SECTORS.filter((s) => canViewServiceOrderType(s, type));
  return viewers.length >= ALL_SECTORS.length ? undefined : viewers;
}

function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}
function isToday(date: Date): boolean {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

/**
 * Forecast date with the Agenda status indicators: green = vehicle already entered, blue = released
 * ("Liberado"), red = overdue, yellow = due today. The violet top-right corner flag (hover popup)
 * marks a forecast that was MANUALLY rescheduled — `task-prep-page` fetches just the latest MANUAL
 * forecastHistory row (take:1) so this is restored without reloading the full history.
 */
function ForecastDateCell({ task }: { task: Task }) {
  const date = task.forecastDate ? new Date(task.forecastDate) : null;

  // Latest manual reschedule (the include already filters to source MANUAL + previousDate, newest
  // first, take:1 — but keep the guard so it's correct even if a fuller history is ever passed).
  const cleared = !!task.cleared;
  const lastManualReschedule = task.forecastHistory
    ?.filter((h) => h.source === "MANUAL" && h.previousDate)
    ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())?.[0];
  const rescheduled = !!lastManualReschedule && !cleared;

  // Top-right corner flag (same purple as the "aguardando arte" SO badge, bg-purple-600). The cell is
  // a relative, full-width container so the flag pins to the column's top-right corner.
  const flag = rescheduled && lastManualReschedule ? (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="absolute top-0 right-0 z-[5] h-0 w-0 border-t-[22px] border-l-[22px] border-l-transparent border-t-purple-600 pointer-events-auto cursor-help">
          <IconCalendarEvent className="absolute -top-[20px] right-[1px] h-2.5 w-2.5 text-white" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-md p-4">
        <div className="space-y-2 text-[15px]">
          <div className="text-base font-semibold text-purple-600">Previsão reagendada</div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{formatDate(lastManualReschedule.previousDate)}</span>
            <span className="text-purple-600">→</span>
            <span className="font-medium text-foreground">{formatDate(lastManualReschedule.newDate)}</span>
          </div>
          {lastManualReschedule.reason && (
            <div className="border-t border-border/60 pt-2 italic leading-relaxed text-muted-foreground">
              {lastManualReschedule.reason}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  ) : null;

  if (!date) {
    return (
      <div className="forecast-date relative">
        <span className="text-muted-foreground">-</span>
        {flag}
      </div>
    );
  }

  const entered = !!task.entryDate && task.status !== TASK_STATUS.COMPLETED;

  let className = "";
  let title = "";
  if (entered) {
    className = "text-green-500 font-medium";
    title = "Veículo já entrou";
  } else if (cleared) {
    className = "text-blue-500 font-medium";
    title = "Liberado";
  } else if (isPast(date)) {
    className = "text-red-500 font-medium";
    title = "Previsão vencida";
  } else if (isToday(date)) {
    className = "text-yellow-500 font-medium";
    title = "Previsão para hoje";
  }

  // Responsive "dd/mm[/yy] - hh:mm": the 2-digit year is wrapped in `.forecast-year`, which the
  // `.forecast-date` container query hides when the column is narrow. The 4-digit year is never shown.
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const dateText = (extra: string) => (
    <span className={`tabular-nums whitespace-nowrap ${extra}`}>
      {dd}/{mm}
      <span className="forecast-year">/{yy}</span> - {hh}:{mi}
    </span>
  );

  return (
    <div className="forecast-date relative">
      {!title ? (
        dateText("")
      ) : (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>{dateText(`cursor-help ${className}`)}</TooltipTrigger>
          <TooltipContent side="top">
            <span className={className.split(" ")[0]}>{title}</span>
          </TooltipContent>
        </Tooltip>
      )}
      {flag}
    </div>
  );
}

function progressColumn(
  id: string,
  type: SERVICE_ORDER_TYPE,
  size: number,
  currentUserId?: string,
): DataTableColumnDef<ClusteredTask> {
  return {
    id,
    // Title Case (matches the other column labels — the COLUMN_LABELS map is all-caps).
    header: SERVICE_ORDER_TYPE_LABELS[type],
    // Sort by the aggregate the cell SHOWS (whole cluster when collapsed), not just the parent task.
    accessorFn: (row) =>
      (row.__group ?? [row]).reduce((n, t) => n + (t.serviceOrders?.filter((so) => so.type === type).length ?? 0), 0),
    enableSorting: true,
    size,
    minSize: 90,
    meta: { headerLabel: SERVICE_ORDER_TYPE_LABELS[type], requiredPrivilege: soTypeViewers(type) },
    cell: ({ row }) => <TaskProgressCell tasks={cellTasks(row)} type={type} currentUserId={currentUserId} />,
  };
}

/** The quote's "Faturar Para" customers (corporate/fantasy names joined) — used by the FINANCIAL view. */
function invoiceCustomers(row: Task): string {
  const configs = (row.quote as { customerConfigs?: { customer?: { corporateName?: string | null; fantasyName?: string | null } }[] } | undefined)?.customerConfigs;
  if (!configs?.length) return "";
  return configs
    .map((c) => c.customer?.corporateName || c.customer?.fantasyName || "")
    .filter(Boolean)
    .join(", ");
}

function mutedDate(v: Date | string | null | undefined) {
  return v ? <span className="tabular-nums">{formatDateTime(new Date(v))}</span> : <span className="text-muted-foreground">-</span>;
}

/**
 * Sort accessor for date columns: epoch ms, or `undefined` when missing. Paired with the NUMERIC
 * `sortUndefined: 1` (empties last in asc), NOT the string `"last"`. The string form is buggy for
 * multi-sort in @tanstack/table-core 8.21.3: when BOTH rows have an undefined value it returns `1`
 * instead of `0` (getSortedRowModel.js), so the empty group never falls through to the next sort key
 * (e.g. a "Previsão asc, Criado em asc" combo left the empty-Previsão rows unsorted by Criado em) AND
 * the comparator is inconsistent. The numeric form returns `0` for the both-undefined case, so
 * secondary sorts apply and every column combination sorts correctly.
 */
function dateSortValue(v: Date | string | null | undefined): number | undefined {
  return v ? new Date(v).getTime() : undefined;
}

export interface TaskPreparationColumnContext {
  currentUserId?: string;
}

// Every task-prep column id, in authoring order — the basis for the per-sector default layout below.
const ALL_TASK_PREP_COLUMN_IDS = [
  "name", "customer", "identificador",
  "soCommercial", "soLogistic", "soArtwork", "soProduction",
  "forecastDate", "term", "total", "invoiceToCustomers", "paymentStatus", "bonification",
  "status", "pintura", "sector", "responsibles",
  "truckCategory", "implementType", "chassisNumber", "measures",
  "entryDate", "startedAt", "finishedAt", "createdAt", "duration", "details",
] as const;

/** Build a full table config (visibility + order) showing exactly `visible` (in that order), the rest
 *  hidden. Ids the sector can't access are filtered out by `requiredPrivilege` before the engine sees
 *  them, so listing/hiding a gated id here is harmless. */
function sectorConfig(visible: string[]): Partial<PersistedTableConfig> {
  const columnVisibility: Record<string, boolean> = {};
  for (const id of ALL_TASK_PREP_COLUMN_IDS) columnVisibility[id] = visible.includes(id);
  return {
    columnOrder: [...visible, ...ALL_TASK_PREP_COLUMN_IDS.filter((id) => !visible.includes(id))],
    columnVisibility,
  };
}

/**
 * Per-sector STARTING column layout for the task-prep tables — applied when a user has no saved
 * config (precedence: URL > localStorage > server config > THIS > hardcoded meta defaults), and
 * adopted on "Restaurar padrão". Each sector sees the columns its workflow needs; ADMIN has no entry
 * and falls back to the show-everything hardcoded default. (Derived from the changelog edit-
 * distribution analysis + the service-order view matrix; gated columns auto-drop per sector.)
 */
export const TASK_PREP_SECTOR_DEFAULTS: Partial<Record<SECTOR_PRIVILEGES, Partial<PersistedTableConfig>>> = {
  [SECTOR_PRIVILEGES.PRODUCTION]: sectorConfig(["name", "identificador", "soProduction", "pintura", "term", "status", "sector"]),
  [SECTOR_PRIVILEGES.WAREHOUSE]: sectorConfig(["name", "identificador", "soProduction", "pintura", "status", "sector"]),
  [SECTOR_PRIVILEGES.LOGISTIC]: sectorConfig(["identificador", "name", "customer", "forecastDate", "entryDate", "soLogistic", "soProduction", "term"]),
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: sectorConfig([
    "name", "customer", "identificador", "forecastDate", "soProduction", "soArtwork", "soLogistic", "soCommercial", "responsibles", "status", "sector",
  ]),
  [SECTOR_PRIVILEGES.COMMERCIAL]: sectorConfig(["customer", "name", "identificador", "total", "paymentStatus", "forecastDate", "term", "soCommercial", "bonification"]),
  [SECTOR_PRIVILEGES.FINANCIAL]: sectorConfig(["customer", "total", "invoiceToCustomers", "paymentStatus", "name", "identificador", "forecastDate", "term", "soCommercial", "soLogistic", "bonification"]),
  [SECTOR_PRIVILEGES.DESIGNER]: sectorConfig(["name", "identificador", "soArtwork", "pintura", "forecastDate", "soProduction", "status", "customer"]),
};

/** The task-preparation column set as generic `DataTableColumnDef`s for the new DataTable. */
export function createTaskPreparationColumns(ctx: TaskPreparationColumnContext = {}): DataTableColumnDef<ClusteredTask>[] {
  const { currentUserId } = ctx;
  return [
    {
      id: "name",
      accessorKey: "name",
      header: "Logomarca",
      size: 220,
      minSize: 180,
      meta: { headerLabel: "Logomarca" },
      cell: ({ row, getValue }) => {
        const hidden = row.original.__children?.length ?? 0;
        return (
          <span className="flex min-w-0 items-center gap-2">
            <TruncatedTextWithTooltip text={(getValue() as string) || "-"} className="truncate font-medium" />
            {hidden > 0 && !row.getIsExpanded() ? (
              <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                +{hidden} {hidden === 1 ? "tarefa" : "tarefas"}
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "customer",
      header: "Razão Social",
      accessorFn: (row) => row.customer?.corporateName || row.customer?.fantasyName || "",
      size: 200,
      // exportValue also feeds global search (rawColumnValue) — without it accessorFn columns aren't searchable.
      meta: { headerLabel: "Razão Social", exportValue: (row) => row.customer?.corporateName || row.customer?.fantasyName || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "identificador",
      header: "Identificador",
      accessorFn: (row) => row.serialNumber || row.truck?.plate || "",
      size: 150,
      meta: { headerLabel: "Identificador", exportValue: (row) => row.serialNumber || row.truck?.plate || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <span className="truncate">{v}</span> : <span className="text-muted-foreground">-</span>;
      },
    },
    // IMPORTANT: column ids feed a CSS var `--col-<id>-size`; a dot is not a valid custom-property
    // ident, so keep them dot-free (a dotted id collapses the cell width → misaligned columns).
    progressColumn("soCommercial", SERVICE_ORDER_TYPE.COMMERCIAL, 130, currentUserId),
    progressColumn("soLogistic", SERVICE_ORDER_TYPE.LOGISTIC, 130, currentUserId),
    progressColumn("soArtwork", SERVICE_ORDER_TYPE.ARTWORK, 110, currentUserId),
    progressColumn("soProduction", SERVICE_ORDER_TYPE.PRODUCTION, 130, currentUserId),
    {
      id: "forecastDate",
      header: "Previsão",
      // Missing forecast → `undefined` so the numeric `sortUndefined: 1` keeps empties at the bottom
      // (asc) AND lets a both-empty pair fall through to any secondary sort. The cell reads
      // row.original directly, so this accessor is sort-only and doesn't affect display.
      accessorFn: (row) => dateSortValue(row.forecastDate),
      sortUndefined: 1,
      enableSorting: true,
      size: 150,
      meta: { headerLabel: "Previsão", requiredPrivilege: RESTRICTED_VIEWERS },
      cell: ({ row }) => <ForecastDateCell task={row.original} />,
    },
    {
      id: "term",
      header: "Prazo",
      accessorFn: (row) => dateSortValue(row.term),
      sortUndefined: 1,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Prazo" },
      cell: ({ row }) => mutedDate(row.original.term),
    },
    {
      id: "total",
      header: "Valor Total",
      accessorFn: (row) => row.quote?.total ?? 0,
      enableSorting: true,
      size: 140,
      meta: {
        align: "right",
        defaultVisible: false,
        headerLabel: "Valor Total",
        requiredPrivilege: FINANCIAL_SECTORS,
        exportValue: (r) => r.quote?.total ?? 0,
      },
      cell: ({ row }) =>
        row.original.quote?.total != null ? (
          <span className="font-medium tabular-nums">{formatCurrency(row.original.quote.total)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "invoiceToCustomers",
      header: "Faturar Para",
      accessorFn: (row) => invoiceCustomers(row),
      size: 200,
      meta: { defaultVisible: false, headerLabel: "Faturar Para", requiredPrivilege: FINANCIAL_SECTORS, exportValue: (row) => invoiceCustomers(row) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "paymentStatus",
      header: "Status Faturamento",
      accessorFn: (row) => row.quote?.status ?? "",
      enableSorting: true,
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Status Faturamento", requiredPrivilege: FINANCIAL_SECTORS },
      cell: ({ row }) =>
        row.original.quote?.status ? (
          <QuoteStatusBadge status={row.original.quote.status} />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "bonification",
      header: "Bonificação",
      accessorKey: "bonification",
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Bonificação", requiredPrivilege: BONIFICATION_VIEWERS },
      cell: ({ getValue }) => {
        const v = getValue() as keyof typeof BONIFICATION_STATUS_LABELS | null;
        return v ? (
          <Badge variant={getBadgeVariant(v, "BONIFICATION_STATUS")}>{BONIFICATION_STATUS_LABELS[v]}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      enableSorting: true,
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Status", exportValue: (row) => (row.status ? TASK_STATUS_LABELS[row.status] : "") },
      cell: ({ getValue }) => {
        const v = getValue() as TASK_STATUS | null;
        return v ? <Badge variant={getBadgeVariant(v, "TASK")}>{TASK_STATUS_LABELS[v]}</Badge> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "pintura",
      header: "Pintura",
      accessorFn: (row) => row.generalPainting?.name || "",
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Pintura", exportValue: (row) => row.generalPainting?.name || "" },
      cell: ({ row }) => {
        const gp = row.original.generalPainting as { name?: string | null; hex?: string | null } | undefined;
        return gp?.name ? (
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-5 w-5 shrink-0 rounded-md border border-foreground/25"
              style={{ background: gp.hex || "#888" }}
            />
            <TruncatedTextWithTooltip text={gp.name} className="truncate" />
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "sector",
      header: "Setor",
      accessorFn: (row) => row.sector?.name || "",
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Setor", exportValue: (row) => row.sector?.name || "" },
      cell: ({ row }) =>
        row.original.sector?.name ? (
          <Badge variant="outline" className="truncate">
            {row.original.sector.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "responsibles",
      header: "Responsáveis",
      accessorFn: (row) => (row.responsibles ?? []).map((r) => r.name).filter(Boolean).join(", "),
      size: 180,
      meta: {
        defaultVisible: false,
        headerLabel: "Responsáveis",
        requiredPrivilege: RESTRICTED_VIEWERS,
        exportValue: (row) => (row.responsibles ?? []).map((r) => r.name).filter(Boolean).join(", "),
      },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "truckCategory",
      header: "Categoria",
      accessorFn: (row) => row.truck?.category || "",
      size: 150,
      meta: {
        defaultVisible: false,
        headerLabel: "Categoria",
        exportValue: (row) => (row.truck?.category ? TRUCK_CATEGORY_LABELS[row.truck.category] : ""),
      },
      cell: ({ row }) =>
        row.original.truck?.category ? (
          <Badge variant="outline" className="truncate">
            {TRUCK_CATEGORY_LABELS[row.original.truck.category]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "implementType",
      header: "Tipo de Implemento",
      accessorFn: (row) => row.truck?.implementType || "",
      size: 160,
      meta: {
        defaultVisible: false,
        headerLabel: "Tipo de Implemento",
        exportValue: (row) => (row.truck?.implementType ? IMPLEMENT_TYPE_LABELS[row.truck.implementType] : ""),
      },
      cell: ({ row }) =>
        row.original.truck?.implementType ? (
          <Badge variant="outline" className="truncate">
            {IMPLEMENT_TYPE_LABELS[row.original.truck.implementType]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "chassisNumber",
      header: "Nº Chassi",
      accessorFn: (row) => row.truck?.chassisNumber || "",
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Nº Chassi", exportValue: (row) => row.truck?.chassisNumber || "" },
      cell: ({ row }) =>
        row.original.truck?.chassisNumber ? (
          <span className="truncate">{formatChassis(row.original.truck.chassisNumber)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      // Truck dimensions (width × height in cm). Default-hidden — toggleable only, as in the legacy
      // Agenda. Sorts by total area (m²); displays + exports/searches the "L × A" string.
      id: "measures",
      header: "Medidas",
      accessorFn: (row) => calculateTaskMeasures(row) ?? 0,
      enableSorting: true,
      size: 110,
      meta: { defaultVisible: false, headerLabel: "Medidas", exportValue: (row) => formatTaskMeasures(row) },
      cell: ({ row }) => {
        const m = formatTaskMeasures(row.original);
        return m && m !== "-" ? <span className="tabular-nums">{m}</span> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "entryDate",
      header: "Entrada",
      accessorFn: (row) => dateSortValue(row.entryDate),
      sortUndefined: 1,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Entrada" },
      cell: ({ row }) => mutedDate(row.original.entryDate),
    },
    {
      id: "startedAt",
      header: "Iniciado",
      accessorFn: (row) => dateSortValue(row.startedAt),
      sortUndefined: 1,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Iniciado" },
      cell: ({ row }) => mutedDate(row.original.startedAt),
    },
    {
      id: "finishedAt",
      header: "Finalizado",
      accessorFn: (row) => dateSortValue(row.finishedAt),
      sortUndefined: 1,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Finalizado" },
      cell: ({ row }) => mutedDate(row.original.finishedAt),
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorFn: (row) => dateSortValue(row.createdAt),
      sortUndefined: 1,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Criado em" },
      cell: ({ row }) => mutedDate(row.original.createdAt),
    },
    {
      id: "duration",
      header: "Duração",
      // Undefined (not 0) when the task hasn't run, so the numeric `sortUndefined: 1` keeps
      // unstarted/unfinished tasks at the bottom rather than sorting them as a zero duration at the top.
      accessorFn: (row) => (row.startedAt && row.finishedAt ? new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime() : undefined),
      sortUndefined: 1,
      enableSorting: true,
      size: 130,
      meta: { defaultVisible: false, headerLabel: "Duração" },
      cell: ({ row }) =>
        row.original.startedAt && row.original.finishedAt ? (
          <span>{getDurationBetweenDates(row.original.startedAt, row.original.finishedAt)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "details",
      header: "Detalhes",
      accessorKey: "details",
      size: 220,
      meta: { defaultVisible: false, headerLabel: "Detalhes" },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <span className="text-muted-foreground">-</span>;
      },
    },
  ];
}
