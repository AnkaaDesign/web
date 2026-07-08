import type { Task } from "../../../../types";
import {
  TASK_STATUS,
  PAINT_FINISH,
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  SERVICE_ORDER_TYPE,
} from "../../../../constants";
import { formatDate, isDateInPast, calculateTaskMeasures, formatTaskMeasures, formatTruckSpot } from "../../../../utils";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { DeadlineCountdown } from "./deadline-countdown";
import { ServiceOrderCell } from "../history/service-order-cell";

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

export interface TaskScheduleColumnsOptions {
  /** Insert the OS (service order) columns after "PINTURA" (used by history/agenda, NOT cronograma). */
  includeServiceOrders?: boolean;
  /** Which OS types the user is allowed to see (only consulted when includeServiceOrders is true). */
  visibleServiceOrderTypes?: SERVICE_ORDER_TYPE[];
}

/**
 * The canonical Cronograma / task-schedule column set, expressed as generic
 * `DataTableColumnDef<Task>[]` (the DataTable base column model — mirrors
 * `airbrushing-table-columns.tsx`). It is the single source of truth for the
 * schedule tables' headers, sort accessors, cell renderers and export values.
 *
 * NOTE: column `id`s are intentionally DOT-FREE (`customerName`, `sectorName`,
 * `soProduction`/`soCommercial`/`soLogistic`/`soArtwork`). The base DataTable sizes
 * each column via a `--col-<id>-size` CSS custom property, and a `.` in the id
 * produces an invalid custom-property name → the header/body flex-basis breaks and
 * the columns misalign. Overdue/hours-remaining are derived from `term` inside the
 * cells, so the columns can stay typed on plain `Task`.
 */
export function createTaskScheduleColumns(options: TaskScheduleColumnsOptions = {}): DataTableColumnDef<Task>[] {
  const { includeServiceOrders = false, visibleServiceOrderTypes = [] } = options;

  const serviceOrderColumns: DataTableColumnDef<Task>[] = includeServiceOrders
    ? (
        [
          { id: "soProduction", header: "OS PRODUÇÃO", type: SERVICE_ORDER_TYPE.PRODUCTION },
          { id: "soCommercial", header: "OS COMERCIAL", type: SERVICE_ORDER_TYPE.COMMERCIAL },
          { id: "soLogistic", header: "OS LOGÍSTICA", type: SERVICE_ORDER_TYPE.LOGISTIC },
          { id: "soArtwork", header: "OS ARTE", type: SERVICE_ORDER_TYPE.ARTWORK },
        ] as const
      )
        .filter((c) => visibleServiceOrderTypes.includes(c.type))
        .map(
          (c): DataTableColumnDef<Task> => ({
            id: c.id,
            header: c.header,
            enableSorting: false,
            size: 120,
            minSize: 110,
            meta: {
              headerLabel: c.header,
              exportValue: (row) => `${(row.serviceOrders ?? []).filter((so) => so.type === c.type).length}`,
            },
            cell: ({ row }) => <ServiceOrderCell task={row.original} serviceOrderType={c.type} />,
          }),
        )
    : [];

  return [
    {
      id: "name",
      header: "LOGOMARCA",
      accessorFn: (row) => row.name || "",
      enableSorting: true,
      size: 180,
      minSize: 140,
      meta: { headerLabel: "Logomarca", exportValue: (row) => row.name || "" },
      cell: ({ row }) => <span className="block truncate font-medium">{row.original.name}</span>,
    },
    {
      id: "customerName",
      header: "CLIENTE",
      accessorFn: (row) => row.customer?.fantasyName || "",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { headerLabel: "Cliente", exportValue: (row) => row.customer?.fantasyName || "" },
      cell: ({ row }) => <span className="block truncate">{row.original.customer?.fantasyName || "-"}</span>,
    },
    {
      id: "measures",
      header: "MEDIDAS",
      accessorFn: (row) => calculateTaskMeasures(row) ?? 0,
      enableSorting: true,
      size: 110,
      minSize: 90,
      meta: { headerLabel: "Medidas", exportValue: (row) => formatTaskMeasures(row) },
      cell: ({ row }) => <span className="block truncate">{formatTaskMeasures(row.original)}</span>,
    },
    {
      id: "generalPainting",
      header: "PINTURA",
      accessorFn: (row) => row.generalPainting?.name || "",
      enableSorting: true,
      size: 180,
      minSize: 140,
      meta: {
        headerLabel: "Pintura",
        exportValue: (row) => {
          const gp = row.generalPainting;
          if (!gp) return "";
          const parts: string[] = [];
          if (gp.name) parts.push(gp.name);
          if (gp.finish) parts.push(PAINT_FINISH_LABELS[gp.finish as PAINT_FINISH]);
          if (gp.manufacturer) parts.push(TRUCK_MANUFACTURER_LABELS[gp.manufacturer]);
          else if (gp.paintBrand?.name) parts.push(gp.paintBrand.name);
          return parts.join(" - ");
        },
      },
      cell: ({ row }) => {
        const gp = row.original.generalPainting;
        if (!gp?.name) return muted("-");
        return (
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-5 w-5 shrink-0 rounded-md border border-foreground/25 bg-center bg-cover"
              style={{ background: gp.colorPreview ? `url("${encodeURI(gp.colorPreview)}") center/cover` : gp.hex || "#888888" }}
            />
            <TruncatedTextWithTooltip text={gp.name} className="truncate" />
          </span>
        );
      },
    },
    ...serviceOrderColumns,
    {
      id: "serialNumberOrPlate",
      header: "IDENTIFICADOR",
      accessorFn: (row) => row.serialNumber || row.truck?.plate || "",
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Identificador", exportValue: (row) => row.serialNumber || row.truck?.plate || "" },
      cell: ({ row }) => <span className="block truncate">{row.original.serialNumber || row.original.truck?.plate || "-"}</span>,
    },
    {
      id: "spot",
      header: "LOCAL",
      accessorFn: (row) => row.truck?.spot || "",
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { headerLabel: "Local", exportValue: (row) => (row.truck?.spot ? formatTruckSpot(row.truck.spot) : "") },
      cell: ({ row }) =>
        row.original.truck?.spot ? (
          <Badge variant="default" className="font-mono">
            {formatTruckSpot(row.original.truck.spot)}
          </Badge>
        ) : (
          muted("-")
        ),
    },
    {
      id: "chassisNumber",
      header: "Nº CHASSI",
      accessorFn: (row) => row.truck?.chassisNumber || "",
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Nº Chassi", exportValue: (row) => row.truck?.chassisNumber || "" },
      cell: ({ row }) => <span className="block truncate font-mono">{row.original.truck?.chassisNumber || "-"}</span>,
    },
    {
      id: "sectorName",
      header: "SETOR",
      accessorFn: (row) => row.sector?.name || "",
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { headerLabel: "Setor", exportValue: (row) => row.sector?.name || "" },
      cell: ({ row }) => <span className="block truncate">{row.original.sector?.name || "-"}</span>,
    },
    {
      id: "entryDate",
      header: "ENTRADA",
      accessorFn: (row) => (row.entryDate ? new Date(row.entryDate).getTime() : Infinity),
      enableSorting: true,
      size: 110,
      minSize: 90,
      meta: { headerLabel: "Entrada", exportValue: (row) => (row.entryDate ? formatDate(row.entryDate) : "") },
      cell: ({ row }) => <span className="block truncate">{row.original.entryDate ? formatDate(row.original.entryDate) : "-"}</span>,
    },
    {
      id: "startedAt",
      header: "INICIADO EM",
      accessorFn: (row) => (row.startedAt ? new Date(row.startedAt).getTime() : Infinity),
      enableSorting: true,
      size: 110,
      minSize: 90,
      meta: { defaultVisible: false, headerLabel: "Iniciado em", exportValue: (row) => (row.startedAt ? formatDate(row.startedAt) : "") },
      cell: ({ row }) => <span className="block truncate">{row.original.startedAt ? formatDate(row.original.startedAt) : "-"}</span>,
    },
    {
      id: "term",
      header: "PRAZO",
      accessorFn: (row) => (row.term ? new Date(row.term).getTime() : Infinity),
      enableSorting: true,
      size: 110,
      minSize: 90,
      meta: { headerLabel: "Prazo", exportValue: (row) => (row.term ? formatDate(row.term) : "") },
      cell: ({ row }) => <span className="block truncate">{row.original.term ? formatDate(row.original.term) : "-"}</span>,
    },
    {
      id: "remainingTime",
      header: "TEMPO RESTANTE",
      // Sort by ms-until-deadline; tasks with no term (Infinity) sort last on asc.
      accessorFn: (row) => (row.term ? new Date(row.term).getTime() - Date.now() : Infinity),
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: {
        align: "right",
        headerLabel: "Tempo Restante",
        exportValue: (row) => {
          if (!row.term || row.status === TASK_STATUS.COMPLETED || row.status === TASK_STATUS.CANCELLED) return "-";
          const diffMs = Math.abs(new Date(row.term).getTime() - Date.now());
          const s = Math.floor(diffMs / 1000);
          const dd = Math.floor(s / 86400);
          const hh = Math.floor((s % 86400) / 3600);
          const mm = Math.floor((s % 3600) / 60);
          const ss = s % 60;
          const t = [dd, hh, mm, ss].map((n) => n.toString().padStart(2, "0")).join(":");
          return isDateInPast(row.term) ? `${t} (atrasado)` : t;
        },
      },
      cell: ({ row }) => {
        const task = row.original;
        return task.term && task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED ? (
          <DeadlineCountdown deadline={task.term} isOverdue={isDateInPast(task.term)} />
        ) : (
          muted("-")
        );
      },
    },
  ];
}
