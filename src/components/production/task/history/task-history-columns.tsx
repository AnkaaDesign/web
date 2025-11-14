import type { Task } from "../../../../types";
import type { TaskColumn } from "../list/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatCurrency, getDurationBetweenDates, calculateTaskMeasures, formatTaskMeasures } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import {
  PAINT_FINISH,
  PAINT_FINISH_LABELS,
  PAINT_BRAND_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  getBadgeVariant
} from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";

// Helper function to render date without icon
const renderDate = (date: Date | null) => {
  if (!date) return <span className="text-muted-foreground">-</span>;

  const formatted = formatDate(date);
  const dateTime = formatDateTime(date);

  return (
    <span className="truncate" title={dateTime}>
      {formatted}
    </span>
  );
};

// Helper function to render duration
const renderDuration = (startedAt: Date | null, finishedAt: Date | null) => {
  if (!startedAt || !finishedAt) return <span className="text-muted-foreground">-</span>;

  const duration = getDurationBetweenDates(startedAt, finishedAt);

  return (
    <div className="flex items-center gap-1">
      <span>{duration}</span>
    </div>
  );
};

// Helper to render service list
const renderServices = (task: Task) => {
  const services = task.services || [];
  if (services.length === 0) return <span className="text-muted-foreground">-</span>;

  if (services.length === 1) {
    return <TruncatedTextWithTooltip text={services[0].service?.name || services[0].description || ""} className="text-sm" />;
  }

  const serviceNames = services.map((s) => s.service?.name || s.description || "").join(", ");
  return (
    <div className="flex items-center gap-1">
      <Badge variant="secondary" className="font-mono">
        {services.length}
      </Badge>
      <TruncatedTextWithTooltip text={serviceNames} className="text-sm" />
    </div>
  );
};

// Helper to get user who created the task
const getCreatedByUser = (task: Task) => {
  return task.createdBy?.name || "-";
};

// Helper to get user who completed the task
const getCompletedByUser = (task: Task) => {
  return task.updatedBy?.name || "-";
};

// Define columns specific to history view
export const createTaskHistoryColumns = (options?: { canViewPrice?: boolean }): TaskColumn[] => {
  const { canViewPrice = true } = options || {};

  const allColumns: TaskColumn[] = [
  {
    id: "name",
    header: "NOME",
    accessorKey: "name",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    minWidth: "200px",
    formatter: (value: string) => <TruncatedTextWithTooltip text={value} className="font-medium truncate" />,
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
      return <TruncatedTextWithTooltip text={value} className="truncate" />;
    },
  },
  {
    id: "measures",
    header: "MEDIDAS",
    accessorFn: (row) => calculateTaskMeasures(row) || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "120px",
    formatter: (_: any, row: Task) => {
      return <span>{formatTaskMeasures(row)}</span>;
    },
  },
  {
    id: "generalPainting",
    header: "PINTURA",
    accessorFn: (row) => row.generalPainting,
    sortable: false,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (_value: any, row: Task) => {
      if (!row.generalPainting) {
        return <span className="text-muted-foreground">-</span>;
      }

      const paint = row.generalPainting;
      const paintFinish = paint.finish as PAINT_FINISH;

      return (
        <div className="-my-2 flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-16 h-8">
                  <CanvasNormalMapRenderer
                    baseColor={paint.hex || "#888888"}
                    finish={paintFinish || PAINT_FINISH.SOLID}
                    width={64}
                    height={32}
                    quality="medium"
                    className="w-full h-full rounded-md"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-semibold">{paint.name}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {paint.paintType?.name && <div>{paint.paintType.name}</div>}
                    {paintFinish && <div>{PAINT_FINISH_LABELS[paintFinish]}</div>}
                    {paint.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</div>}
                    {paint.paintBrand?.name && !paint.manufacturer && <div>{paint.paintBrand.name}</div>}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
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
      const sectorName = row.sector.name || value || "";
      return (
        <Badge variant="outline" className="truncate">
          {sectorName}
        </Badge>
      );
    },
  },
  {
    id: "status",
    header: "STATUS",
    accessorKey: "status",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      const status = value as TASK_STATUS;
      const variant = getBadgeVariant(status, "TASK");
      const label = TASK_STATUS_LABELS[status] || status;
      return (
        <Badge variant={variant as any}>
          {label}
        </Badge>
      );
    },
  },
  {
    id: "serialNumber",
    header: "Nº SÉRIE",
    accessorKey: "serialNumber",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-mono truncate">{value}</span>;
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
      return <span className="font-mono uppercase truncate">{value}</span>;
    },
  },
  {
    id: "chassisNumber",
    header: "Nº CHASSI",
    accessorFn: (row) => row.truck?.chassisNumber || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "140px",
    formatter: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-mono truncate">{value}</span>;
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
    formatter: (value: Date | null) => renderDate(value),
  },
  {
    id: "startedAt",
    header: "INICIADO",
    accessorKey: "startedAt",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date | null) => renderDate(value),
  },
  {
    id: "finishedAt",
    header: "FINALIZADO",
    accessorKey: "finishedAt",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (value: Date | null) => renderDate(value),
  },
  {
    id: "term",
    header: "PRAZO",
    accessorKey: "term",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    formatter: (value: Date | null) => renderDate(value),
  },
  {
    id: "duration",
    header: "DURAÇÃO",
    accessorFn: (row) => {
      if (!row.startedAt || !row.finishedAt) return 0;
      return new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime();
    },
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "120px",
    formatter: (_: any, row: Task) => renderDuration(row.startedAt, row.finishedAt),
  },
  {
    id: "services",
    header: "SERVIÇOS",
    accessorFn: (row) => row.services?.length || 0,
    sortable: false,
    filterable: false,
    defaultVisible: false,
    minWidth: "200px",
    formatter: (_: any, row: Task) => renderServices(row),
  },
  {
    id: "price",
    header: "VALOR TOTAL",
    accessorKey: "price",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    className: "text-right",
    headerClassName: "text-right",
    formatter: (value: number | null) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="font-medium">{formatCurrency(value)}</span>;
    },
  },
  {
    id: "commission",
    header: "COMISSÃO",
    accessorKey: "commission",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "140px",
    formatter: (value: string | null, row: Task) => {
      if (!value) return <span className="text-muted-foreground">-</span>;

      const status = value as COMMISSION_STATUS;
      const variant = getBadgeVariant(status, "COMMISSION_STATUS");
      const label = COMMISSION_STATUS_LABELS[status] || status;

      // For suspended commission, show tooltip with reason
      if (status === COMMISSION_STATUS.SUSPENDED_COMMISSION) {
        // Determine suspension reason based on task status or other attributes
        let suspensionReason = "Comissão suspensa";

        if (row.status === TASK_STATUS.ON_HOLD) {
          suspensionReason = "Tarefa em espera";
        } else if (row.status === TASK_STATUS.CANCELLED) {
          suspensionReason = "Tarefa cancelada";
        } else if (!row.finishedAt && row.term && new Date(row.term) < new Date()) {
          suspensionReason = "Prazo excedido";
        } else if (row.observation?.description?.toLowerCase().includes("suspens")) {
          suspensionReason = "Suspensa por observação";
        }

        return (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Badge variant={variant as any} className="cursor-help">
                    {label}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-sm space-y-1">
                  <div className="font-medium">Motivo da suspensão:</div>
                  <div className="text-muted-foreground">{suspensionReason}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // For other commission statuses, just show the badge without tooltip
      return (
        <Badge variant={variant as any}>
          {label}
        </Badge>
      );
    },
  },
  {
    id: "completedBy.name",
    header: "FINALIZADO POR",
    accessorFn: (row) => getCompletedByUser(row),
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "150px",
    formatter: (value: string) => {
      if (!value || value === "-") return <span className="text-muted-foreground">-</span>;
      return <TruncatedTextWithTooltip text={value} className="truncate" />;
    },
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
    id: "observation",
    header: "OBSERVAÇÃO",
    accessorFn: (row) => row.observation?.description || "",
    sortable: false,
    filterable: false,
    defaultVisible: false,
    minWidth: "200px",
    formatter: (value: string, row: Task) => {
      if (!row.observation) return <span className="text-muted-foreground">-</span>;
      return <TruncatedTextWithTooltip text={value} className="text-sm" />;
    },
  },
  ];

  // Filter out price column if user doesn't have permission
  return canViewPrice ? allColumns : allColumns.filter(col => col.id !== 'price');
};

// Helper to get visible columns based on user preferences
export const getVisibleColumns = (columns: TaskColumn[], visibleColumnIds: Set<string>): TaskColumn[] => {
  return columns.filter((column) => visibleColumnIds.has(column.id));
};

// Helper to get default visible columns
export const getDefaultVisibleColumns = (columns: TaskColumn[]): Set<string> => {
  return new Set(columns.filter((column) => column.defaultVisible).map((column) => column.id));
};
