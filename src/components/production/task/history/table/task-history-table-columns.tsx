import type { ReactNode } from "react";
import type { DataTableColumnDef, SectorDefaults } from "@/components/ui/datatable";
import type { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { ServiceOrderCell } from "../service-order-cell";
import { QuoteStatusBadge } from "../../quote/quote-status-badge";
import {
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  BONIFICATION_STATUS,
  BONIFICATION_STATUS_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_TYPE_LABELS,
  SECTOR_PRIVILEGES,
  getBadgeVariant,
} from "@/constants";
import { canViewServiceOrderType } from "@/utils/permissions/service-order-permissions";
import {
  formatCurrency,
  formatDateTime,
  getDurationBetweenDates,
  calculateTaskMeasures,
  formatTaskMeasures,
} from "@/utils";

// --- gating sets (ADMIN always passes via the engine; arrays mean OR) ---
const PRICE_VIEWERS: SECTOR_PRIVILEGES[] = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL];
const FINANCIAL_COLUMN_VIEWERS: SECTOR_PRIVILEGES[] = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL];
const RESTRICTED_VIEWERS: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.LOGISTIC,
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
];
const BONIFICATION_VIEWERS: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.PRODUCTION,
];

const ALL_SECTORS = Object.values(SECTOR_PRIVILEGES) as SECTOR_PRIVILEGES[];

/** Sectors allowed to see a given service-order type column (single source of truth = the SO matrix).
 *  Returns `undefined` (no gate) when every sector can already see it (PRODUCTION type). */
const soViewers = (type: SERVICE_ORDER_TYPE): SECTOR_PRIVILEGES[] | undefined => {
  const viewers = ALL_SECTORS.filter((p) => canViewServiceOrderType(p, type));
  return viewers.length >= ALL_SECTORS.length ? undefined : viewers;
};

const MutedDash = () => <span className="text-muted-foreground">-</span>;

/** Single-line date: dd/mm/yy hh:mm with the full datetime in the title. */
function renderDate(date: Date | null | undefined): ReactNode {
  if (!date) return <MutedDash />;
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return (
    <span className="tabular-nums" title={formatDateTime(d)}>
      {day}/{month}/{year} {hours}:{minutes}
    </span>
  );
}

function dateExport(date: Date | null | undefined): string {
  return date ? formatDateTime(new Date(date)) : "";
}

function soCount(task: Task, type: SERVICE_ORDER_TYPE): number {
  return task.serviceOrders?.filter((so) => so.type === type).length || 0;
}

function serviceOrderColumn(id: string, type: SERVICE_ORDER_TYPE, size: number): DataTableColumnDef<Task> {
  const label = SERVICE_ORDER_TYPE_LABELS[type];
  return {
    id,
    header: label,
    enableSorting: false,
    size,
    minSize: 90,
    meta: {
      defaultVisible: false,
      requiredPrivilege: soViewers(type),
      headerLabel: label,
      exportHeader: label,
      exportValue: (t) => soCount(t, type),
    },
    cell: ({ row }) => (
      <div className="relative flex">
        <ServiceOrderCell task={row.original} serviceOrderType={type} navigationRoute="history" />
      </div>
    ),
  };
}

/**
 * History column set as generic `DataTableColumnDef`s. Column ids are dot-free (they feed a CSS
 * `--col-<id>-size` custom property — a dot would break the cell width). Headers use Title Case to
 * match the Task Preparation / DetailPage convention (the column picker reads `meta.headerLabel`).
 * Privilege gating moves to `meta.requiredPrivilege`; `accessorFn` columns carry `meta.exportValue`
 * so they remain searchable + exportable.
 *
 * Default-visible (history): name, customer, generalPainting, identificador, sector, status,
 * finishedAt, bonification.
 */
export function createTaskHistoryColumns(): DataTableColumnDef<Task>[] {
  return [
    {
      id: "name",
      header: "Logomarca",
      accessorKey: "name",
      enableSorting: true,
      size: 220,
      minSize: 180,
      meta: { headerLabel: "Logomarca", exportHeader: "Logomarca", exportValue: (t) => t.name || "" },
      cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.name || "-"} className="font-medium truncate" />,
    },
    {
      id: "customer",
      header: "Razão Social",
      accessorFn: (t) => t.customer?.corporateName || t.customer?.fantasyName || "",
      enableSorting: true,
      size: 200,
      minSize: 150,
      meta: {
        headerLabel: "Razão Social",
        exportHeader: "Razão Social",
        exportValue: (t) => t.customer?.corporateName || t.customer?.fantasyName || "",
      },
      cell: ({ row }) => {
        const v = row.original.customer?.corporateName || row.original.customer?.fantasyName || "";
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <MutedDash />;
      },
    },
    {
      id: "responsibles",
      header: "Responsáveis",
      accessorFn: (t) => t.responsibles?.map((r) => r.name).join(", ") || "",
      enableSorting: false,
      size: 180,
      meta: {
        defaultVisible: false,
        requiredPrivilege: RESTRICTED_VIEWERS,
        headerLabel: "Responsáveis",
        exportHeader: "Responsáveis",
        exportValue: (t) => t.responsibles?.map((r) => r.name).join(", ") || "",
      },
      cell: ({ row }) => {
        const v = row.original.responsibles?.map((r) => r.name).join(", ") || "";
        return v ? <TruncatedTextWithTooltip text={v} className="truncate" /> : <MutedDash />;
      },
    },
    {
      id: "measures",
      header: "Medidas",
      accessorFn: (t) => calculateTaskMeasures(t) || 0,
      enableSorting: false,
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Medidas",
        exportHeader: "Medidas",
        exportValue: (t) => formatTaskMeasures(t) || "",
      },
      cell: ({ row }) => {
        const m = formatTaskMeasures(row.original);
        return m && m !== "-" ? <span className="tabular-nums">{m}</span> : <MutedDash />;
      },
    },
    {
      id: "generalPainting",
      header: "Pintura",
      accessorFn: (t) => t.generalPainting?.name || "",
      enableSorting: false,
      size: 180,
      meta: { defaultVisible: true, headerLabel: "Pintura", exportHeader: "Pintura", exportValue: (t) => t.generalPainting?.name || "" },
      cell: ({ row }) => {
        const gp = row.original.generalPainting;
        return gp?.name ? (
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="inline-block h-5 w-5 shrink-0 rounded-md border border-foreground/25" style={{ background: gp.hex || "#888" }} />
            <TruncatedTextWithTooltip text={gp.name} className="truncate" />
          </span>
        ) : (
          <MutedDash />
        );
      },
    },
    {
      id: "sector",
      header: "Setor",
      accessorFn: (t) => t.sector?.name || "",
      enableSorting: true,
      size: 140,
      meta: { headerLabel: "Setor", exportHeader: "Setor", exportValue: (t) => t.sector?.name || "" },
      cell: ({ row }) =>
        row.original.sector ? (
          <Badge variant="outline" className="truncate">
            {row.original.sector.name}
          </Badge>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "identificador",
      header: "Identificador",
      accessorFn: (t) => t.serialNumber || t.truck?.plate || "",
      enableSorting: true,
      size: 150,
      meta: {
        headerLabel: "Identificador",
        exportHeader: "Identificador",
        exportValue: (t) => t.serialNumber || t.truck?.plate || "",
      },
      cell: ({ row }) => {
        const v = row.original.serialNumber || row.original.truck?.plate || "";
        return v ? <span className="truncate">{v}</span> : <MutedDash />;
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      enableSorting: true,
      size: 140,
      meta: {
        defaultVisible: true,
        headerLabel: "Status",
        exportHeader: "Status",
        exportValue: (t) => (t.status ? TASK_STATUS_LABELS[t.status] : ""),
      },
      cell: ({ row }) => {
        const status = row.original.status;
        if (!status) return <MutedDash />;
        return <Badge variant={getBadgeVariant(status, "TASK")}>{TASK_STATUS_LABELS[status]}</Badge>;
      },
    },
    {
      id: "chassisNumber",
      header: "Nº Chassi",
      accessorFn: (t) => t.truck?.chassisNumber || "",
      enableSorting: false,
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Nº Chassi", exportHeader: "Nº Chassi", exportValue: (t) => t.truck?.chassisNumber || "" },
      cell: ({ row }) => (row.original.truck?.chassisNumber ? <span className="truncate">{row.original.truck.chassisNumber}</span> : <MutedDash />),
    },
    {
      id: "truckCategory",
      header: "Categoria",
      accessorFn: (t) => (t.truck?.category ? TRUCK_CATEGORY_LABELS[t.truck.category] : ""),
      enableSorting: false,
      size: 150,
      meta: {
        defaultVisible: false,
        headerLabel: "Categoria",
        exportHeader: "Categoria",
        exportValue: (t) => (t.truck?.category ? TRUCK_CATEGORY_LABELS[t.truck.category] : ""),
      },
      cell: ({ row }) =>
        row.original.truck?.category ? (
          <Badge variant="outline" className="truncate">
            {TRUCK_CATEGORY_LABELS[row.original.truck.category]}
          </Badge>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "implementType",
      header: "Tipo de Implemento",
      accessorFn: (t) => (t.truck?.implementType ? IMPLEMENT_TYPE_LABELS[t.truck.implementType] : ""),
      enableSorting: false,
      size: 160,
      meta: {
        defaultVisible: false,
        headerLabel: "Tipo de Implemento",
        exportHeader: "Tipo de Implemento",
        exportValue: (t) => (t.truck?.implementType ? IMPLEMENT_TYPE_LABELS[t.truck.implementType] : ""),
      },
      cell: ({ row }) =>
        row.original.truck?.implementType ? (
          <Badge variant="outline" className="truncate">
            {IMPLEMENT_TYPE_LABELS[row.original.truck.implementType]}
          </Badge>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "forecastDate",
      header: "Previsão",
      accessorKey: "forecastDate",
      enableSorting: true,
      size: 140,
      meta: {
        defaultVisible: false,
        requiredPrivilege: RESTRICTED_VIEWERS,
        headerLabel: "Previsão",
        exportHeader: "Previsão",
        exportValue: (t) => dateExport(t.forecastDate),
      },
      cell: ({ row }) => renderDate(row.original.forecastDate),
    },
    {
      id: "entryDate",
      header: "Entrada",
      accessorKey: "entryDate",
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Entrada", exportHeader: "Entrada", exportValue: (t) => dateExport(t.entryDate) },
      cell: ({ row }) => renderDate(row.original.entryDate),
    },
    {
      id: "startedAt",
      header: "Iniciado",
      accessorKey: "startedAt",
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Iniciado", exportHeader: "Iniciado", exportValue: (t) => dateExport(t.startedAt) },
      cell: ({ row }) => renderDate(row.original.startedAt),
    },
    {
      id: "finishedAt",
      header: "Finalizado",
      accessorKey: "finishedAt",
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: true, headerLabel: "Finalizado", exportHeader: "Finalizado", exportValue: (t) => dateExport(t.finishedAt) },
      cell: ({ row }) => renderDate(row.original.finishedAt),
    },
    {
      id: "term",
      header: "Prazo",
      accessorKey: "term",
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Prazo", exportHeader: "Prazo", exportValue: (t) => dateExport(t.term) },
      cell: ({ row }) => renderDate(row.original.term),
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportHeader: "Criado em", exportValue: (t) => dateExport(t.createdAt) },
      cell: ({ row }) => renderDate(row.original.createdAt),
    },
    {
      id: "createdBy",
      header: "Criado por",
      accessorFn: (t) => t.createdBy?.name || "",
      enableSorting: false,
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Criado por", exportHeader: "Criado por", exportValue: (t) => t.createdBy?.name || "" },
      cell: ({ row }) => (row.original.createdBy?.name ? <TruncatedTextWithTooltip text={row.original.createdBy.name} className="truncate" /> : <MutedDash />),
    },
    {
      id: "duration",
      header: "Duração",
      accessorFn: (t) => (t.startedAt && t.finishedAt ? new Date(t.finishedAt).getTime() - new Date(t.startedAt).getTime() : 0),
      enableSorting: false,
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Duração",
        exportHeader: "Duração",
        exportValue: (t) => (t.startedAt && t.finishedAt ? getDurationBetweenDates(t.startedAt, t.finishedAt) : ""),
      },
      cell: ({ row }) =>
        row.original.startedAt && row.original.finishedAt ? (
          <span>{getDurationBetweenDates(row.original.startedAt, row.original.finishedAt)}</span>
        ) : (
          <MutedDash />
        ),
    },
    serviceOrderColumn("soCommercial", SERVICE_ORDER_TYPE.COMMERCIAL, 140),
    serviceOrderColumn("soLogistic", SERVICE_ORDER_TYPE.LOGISTIC, 140),
    serviceOrderColumn("soArtwork", SERVICE_ORDER_TYPE.ARTWORK, 110),
    serviceOrderColumn("soProduction", SERVICE_ORDER_TYPE.PRODUCTION, 120),
    {
      id: "price",
      header: "Valor Total",
      // Coerce defensively: the API mapper returns a number, but a raw Decimal/string must not break the cell.
      accessorFn: (t) => {
        const n = Number(t.quote?.total);
        return Number.isFinite(n) ? n : null;
      },
      enableSorting: false,
      size: 140,
      meta: {
        defaultVisible: false,
        requiredPrivilege: PRICE_VIEWERS,
        align: "right",
        headerLabel: "Valor Total",
        exportHeader: "Valor Total",
        exportValue: (t) => {
          const n = Number(t.quote?.total);
          return Number.isFinite(n) && n > 0 ? formatCurrency(n) : "";
        },
      },
      cell: ({ row }) => {
        const n = Number(row.original.quote?.total);
        return Number.isFinite(n) && n > 0 ? <span className="font-medium tabular-nums">{formatCurrency(n)}</span> : <MutedDash />;
      },
    },
    {
      id: "bonification",
      header: "Bonificação",
      accessorKey: "bonification",
      enableSorting: true,
      size: 160,
      meta: {
        defaultVisible: true,
        requiredPrivilege: BONIFICATION_VIEWERS,
        headerLabel: "Bonificação",
        exportHeader: "Bonificação",
        exportValue: (t) => (t.bonification ? BONIFICATION_STATUS_LABELS[t.bonification] : ""),
      },
      cell: ({ row }) => {
        const status = row.original.bonification;
        if (!status) return <MutedDash />;
        const variant = getBadgeVariant(status, "BONIFICATION_STATUS");
        const label = BONIFICATION_STATUS_LABELS[status] || status;

        if (status === BONIFICATION_STATUS.SUSPENDED_BONIFICATION) {
          const t = row.original;
          let reason = "Bonificação suspensa";
          if (t.status === TASK_STATUS.PREPARATION) reason = "Tarefa em preparação";
          else if (t.status === TASK_STATUS.CANCELLED) reason = "Tarefa cancelada";
          else if (!t.finishedAt && t.term && new Date(t.term) < new Date()) reason = "Prazo excedido";
          else if (t.observation?.description?.toLowerCase().includes("suspens")) reason = "Suspensa por observação";
          return (
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Badge variant={variant} className="cursor-help">
                    {label}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-sm space-y-1">
                  <div className="font-medium">Motivo da suspensão:</div>
                  <div className="text-muted-foreground">{reason}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      id: "details",
      header: "Detalhes",
      accessorKey: "details",
      enableSorting: false,
      size: 220,
      meta: { defaultVisible: false, headerLabel: "Detalhes", exportHeader: "Detalhes", exportValue: (t) => t.details || "" },
      cell: ({ row }) => (row.original.details ? <TruncatedTextWithTooltip text={row.original.details} className="text-sm" /> : <MutedDash />),
    },
    {
      id: "invoiceToCustomers",
      header: "Faturar Para",
      accessorFn: (t) =>
        t.quote?.customerConfigs?.map((c) => c.customer?.corporateName || c.customer?.fantasyName || "").filter(Boolean).join(", ") || "",
      enableSorting: false,
      size: 200,
      meta: {
        defaultVisible: false,
        requiredPrivilege: FINANCIAL_COLUMN_VIEWERS,
        headerLabel: "Faturar Para",
        exportHeader: "Faturar Para",
        exportValue: (t) =>
          t.quote?.customerConfigs?.map((c) => c.customer?.corporateName || c.customer?.fantasyName || "").filter(Boolean).join(", ") || "",
      },
      cell: ({ row }) => {
        const v =
          row.original.quote?.customerConfigs?.map((c) => c.customer?.corporateName || c.customer?.fantasyName || "").filter(Boolean).join(", ") || "";
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : <MutedDash />;
      },
    },
    {
      id: "paymentStatus",
      header: "Status Faturamento",
      accessorFn: (t) => t.quote?.status || "",
      enableSorting: false,
      size: 160,
      meta: {
        defaultVisible: false,
        requiredPrivilege: FINANCIAL_COLUMN_VIEWERS,
        headerLabel: "Status Faturamento",
        exportHeader: "Status Faturamento",
        exportValue: (t) => t.quote?.status || "",
      },
      cell: ({ row }) => (row.original.quote?.status ? <QuoteStatusBadge status={row.original.quote.status as never} size="sm" /> : <MutedDash />),
    },
    {
      id: "observation",
      header: "Observação",
      accessorFn: (t) => t.observation?.description || "",
      enableSorting: false,
      size: 220,
      meta: { defaultVisible: false, headerLabel: "Observação", exportHeader: "Observação", exportValue: (t) => t.observation?.description || "" },
      cell: ({ row }) =>
        row.original.observation?.description ? <TruncatedTextWithTooltip text={row.original.observation.description} className="text-sm" /> : <MutedDash />,
    },
  ];
}

/** Ordered list of every column id (used to build per-sector default layouts). */
export const ALL_TASK_HISTORY_COLUMN_IDS: string[] = createTaskHistoryColumns().map((c) => c.id);

/** Build a `{columnVisibility, columnOrder}` defaults entry from a visible-id list. */
function sectorConfig(visibleIds: string[]) {
  const visibility: Record<string, boolean> = {};
  for (const id of ALL_TASK_HISTORY_COLUMN_IDS) visibility[id] = visibleIds.includes(id);
  return {
    columnVisibility: visibility,
    columnOrder: [...visibleIds, ...ALL_TASK_HISTORY_COLUMN_IDS.filter((id) => !visibleIds.includes(id))],
  };
}

const HISTORY_BASE_VISIBLE = ["name", "customer", "generalPainting", "identificador", "sector", "status", "finishedAt", "bonification"];

/**
 * Per-sector starting layouts (applied only when a user has no saved/interacted layout). ADMIN is
 * omitted so it falls back to the hardcoded `meta.defaultVisible` set. Gated columns a sector cannot
 * see are filtered out by the engine regardless of what is listed here.
 */
export const TASK_HISTORY_SECTOR_DEFAULTS: SectorDefaults = {
  [SECTOR_PRIVILEGES.PRODUCTION]: sectorConfig([...HISTORY_BASE_VISIBLE, "soProduction"]),
  [SECTOR_PRIVILEGES.WAREHOUSE]: sectorConfig(["name", "customer", "generalPainting", "identificador", "sector", "status", "finishedAt"]),
  [SECTOR_PRIVILEGES.COMMERCIAL]: sectorConfig([...HISTORY_BASE_VISIBLE, "price", "paymentStatus"]),
  [SECTOR_PRIVILEGES.FINANCIAL]: sectorConfig([...HISTORY_BASE_VISIBLE, "price", "paymentStatus", "invoiceToCustomers"]),
  [SECTOR_PRIVILEGES.LOGISTIC]: sectorConfig([...HISTORY_BASE_VISIBLE, "forecastDate"]),
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: sectorConfig([...HISTORY_BASE_VISIBLE, "forecastDate", "responsibles"]),
  [SECTOR_PRIVILEGES.DESIGNER]: sectorConfig([...HISTORY_BASE_VISIBLE, "soArtwork"]),
};
