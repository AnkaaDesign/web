import type { Task } from "../../../../types";
import type { TaskColumn } from "./types";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatCurrency, getTaskStatusLabel, getTaskStatusColor, isDateInPast } from "../../../../utils";
import {
  TASK_STATUS,
  PAINT_FINISH,
  PAINT_BRAND,
  TRUCK_MANUFACTURER,
  PAINT_FINISH_LABELS,
  PAINT_BRAND_LABELS,
  TRUCK_MANUFACTURER_LABELS,
} from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { IconClock, IconCalendar, IconCheck, IconX, IconAlertCircle } from "@tabler/icons-react";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

import { DeadlineCountdown } from "../schedule/deadline-countdown";

// Helper function to render status badge
const renderStatusBadge = (status: TASK_STATUS) => {
  const label = getTaskStatusLabel(status);
  const color = getTaskStatusColor(status);

  const getIcon = () => {
    switch (status) {
      case TASK_STATUS.COMPLETED:
        return <IconCheck className="h-3 w-3" />;
      case TASK_STATUS.CANCELLED:
        return <IconX className="h-3 w-3" />;
      case TASK_STATUS.IN_PRODUCTION:
        return <IconClock className="h-3 w-3" />;
      case TASK_STATUS.ON_HOLD:
        return <IconAlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Badge variant={color as any} className="gap-1 whitespace-nowrap">
      {getIcon()}
      {label}
    </Badge>
  );
};

// Helper function to render date with icon
const renderDateWithIcon = (date: Date | null) => {
  if (!date) return <span className="text-muted-foreground">-</span>;

  const formatted = formatDate(date);
  const dateTime = formatDateTime(date);

  return (
    <div className="flex items-center gap-1" title={dateTime}>
      <IconCalendar className="h-3 w-3" />
      <span className="truncate">{formatted}</span>
    </div>
  );
};

// Helper to render service count
const renderServiceCount = (task: Task) => {
  const count = task.services?.length || 0;
  if (count === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <Badge variant="secondary" className="font-mono">
      {count}
    </Badge>
  );
};

// Define all available columns
export const createTaskColumns = (): TaskColumn[] => [
  {
    id: "name",
    header: "NOME",
    accessorKey: "name",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    minWidth: "200px",
    formatter: (value: string, row: Task) => (
      <div className="flex flex-col gap-0.5">
        <TruncatedTextWithTooltip text={value} className="font-medium" />
        {row.serialNumber && <span className="text-xs text-muted-foreground">SN: {row.serialNumber}</span>}
      </div>
    ),
  },
  {
    id: "status",
    header: "STATUS",
    accessorKey: "status",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "150px",
    formatter: (value: TASK_STATUS) => renderStatusBadge(value),
  },
  {
    id: "customer.fantasyName",
    header: "CLIENTE",
    accessorFn: (row) => row.customer?.fantasyName || "",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    minWidth: "150px",
    formatter: (value: string, row: Task) => {
      if (!row.customer) return <span className="text-muted-foreground">-</span>;
      return <TruncatedTextWithTooltip text={value} />;
    },
  },
  {
    id: "sector.name",
    header: "SETOR",
    accessorFn: (row) => row.sector?.name || "",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (value: string, row: Task) => {
      if (!row.sector) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="truncate">
          {value}
        </Badge>
      );
    },
  },
  {
    id: "plate",
    header: "PLACA",
    accessorFn: (row) => row.truck?.plate || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "100px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-mono uppercase">{value}</span>;
    },
  },
  {
    id: "spot",
    header: "LOCAL",
    accessorFn: (row) => row.truck?.spot || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      // Format spot name for display (e.g., "B1_F1_V1" -> "B1-F1-V1", "PATIO" -> "Pátio")
      if (value === "PATIO") return <span className="text-sm">Pátio</span>;
      return <span className="font-mono text-sm">{value.replace(/_/g, "-")}</span>;
    },
  },
  {
    id: "serialNumber",
    header: "Nº SÉRIE",
    accessorKey: "serialNumber",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "200px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-mono">{value}</span>;
    },
  },
  {
    id: "chassisNumber",
    header: "Nº CHASSI",
    accessorFn: (row) => row.truck?.chassisNumber || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "200px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-mono">{value}</span>;
    },
  },
  {
    id: "price",
    header: "VALOR",
    accessorKey: "price",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "120px",
    className: "text-right",
    headerClassName: "text-right",
    formatter: (value: number | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-medium">{formatCurrency(value)}</span>;
    },
  },
  {
    id: "services",
    header: "SERVIÇOS",
    accessorFn: (row) => row.services?.length || 0,
    sortable: false,
    filterable: false,
    defaultVisible: true,
    width: "100px",
    formatter: (_: any, row: Task) => renderServiceCount(row),
  },
  {
    id: "generalPainting",
    header: "PINTURA",
    accessorFn: (row) => row.generalPainting,
    sortable: false,
    filterable: true,
    defaultVisible: true,
    width: "100px",
    formatter: (_value: any, row: Task) => {
      if (!row.generalPainting) {
        return <span className="text-muted-foreground">-</span>;
      }

      const paint = row.generalPainting;
      const paintFinish = paint.finish as PAINT_FINISH;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-16 h-8 rounded-md ring-1 ring-border shadow-sm overflow-hidden">
                {paint.colorPreview ? (
                  <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <CanvasNormalMapRenderer
                    baseColor={paint.hex || "#888888"}
                    finish={paintFinish || PAINT_FINISH.SOLID}
                    width={64}
                    height={32}
                    quality="medium"
                    className="w-full h-full"
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <div className="font-semibold">{paint.name}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {paint.paintType?.name && <div>{paint.paintType.name}</div>}
                  {paintFinish && <div>{PAINT_FINISH_LABELS[paintFinish]}</div>}
                  {paint.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer as TRUCK_MANUFACTURER]}</div>}
                  {paint.paintBrand?.name && !paint.manufacturer && <div>{paint.paintBrand.name}</div>}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "entryDate",
    header: "ENTRADA",
    accessorKey: "entryDate",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date | null) => renderDateWithIcon(value),
  },
  {
    id: "term",
    header: "PRAZO",
    accessorKey: "term",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "120px",
    formatter: (value: Date | null) => renderDateWithIcon(value),
  },
  {
    id: "remainingTime",
    header: "TEMPO RESTANTE",
    accessorKey: "term",
    sortable: false,
    filterable: false,
    defaultVisible: true,
    width: "140px",
    formatter: (value: Date | null, row: Task) => {
      if (!value || row.status === TASK_STATUS.COMPLETED || row.status === TASK_STATUS.CANCELLED) {
        return <span className="text-muted-foreground">-</span>;
      }
      return <DeadlineCountdown deadline={value} isOverdue={isDateInPast(value)} />;
    },
  },
  {
    id: "startedAt",
    header: "INICIADO",
    accessorKey: "startedAt",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date | null) => renderDateWithIcon(value),
  },
  {
    id: "finishedAt",
    header: "FINALIZADO",
    accessorKey: "finishedAt",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date | null) => renderDateWithIcon(value),
  },
  {
    id: "details",
    header: "DETALHES",
    accessorKey: "details",
    sortable: false,
    filterable: true,
    defaultVisible: false,
    minWidth: "200px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <TruncatedTextWithTooltip text={value} className="text-sm" />;
    },
  },
  {
    id: "createdBy.name",
    header: "CRIADO POR",
    accessorFn: (row) => row.createdBy?.name || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "150px",
    formatter: (value: string, row: Task) => {
      if (!row.createdBy) return <span className="text-muted-foreground">-</span>;
      return <TruncatedTextWithTooltip text={value} />;
    },
  },
  {
    id: "hasArtworks",
    header: "ARTES",
    accessorFn: (row) => (row.artworks?.length || 0) > 0,
    sortable: false,
    filterable: true,
    defaultVisible: false,
    width: "80px",
    formatter: (_value: boolean, row: Task) => {
      const count = row.artworks?.length || 0;
      if (count === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
      );
    },
  },
  {
    id: "hasObservation",
    header: "OBS.",
    accessorFn: (row) => !!row.observation,
    sortable: false,
    filterable: true,
    defaultVisible: false,
    width: "60px",
    formatter: (value: boolean) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <IconAlertCircle className="h-4 w-4 text-yellow-500" />;
    },
  },
  {
    id: "createdAt",
    header: "CRIADO EM",
    accessorKey: "createdAt",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date) => {
      const formatted = formatDate(value);
      const dateTime = formatDateTime(value);
      return <span title={dateTime}>{formatted}</span>;
    },
  },
  {
    id: "updatedAt",
    header: "ATUALIZADO EM",
    accessorKey: "updatedAt",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date) => {
      const formatted = formatDate(value);
      const dateTime = formatDateTime(value);
      return <span title={dateTime}>{formatted}</span>;
    },
  },
];

// Helper to get visible columns based on user preferences
export const getVisibleColumns = (columns: TaskColumn[], visibleColumnIds: Set<string>): TaskColumn[] => {
  return columns.filter((column) => visibleColumnIds.has(column.id));
};

// Helper to get default visible columns
export const getDefaultVisibleColumns = (columns: TaskColumn[]): Set<string> => {
  return new Set(columns.filter((column) => column.defaultVisible).map((column) => column.id));
};
