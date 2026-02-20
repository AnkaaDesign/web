import type { Task } from "../../../../types";
import type { TaskColumn } from "../list/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatCurrency, getDurationBetweenDates, calculateTaskMeasures, formatTaskMeasures } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import {
  PAINT_FINISH,
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  TASK_STATUS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_TYPE_LABELS,
  SERVICE_ORDER_TYPE_COLUMN_LABELS,
  SECTOR_PRIVILEGES,
  getBadgeVariant
} from "../../../../constants";
import { canViewServiceOrderType } from "../../../../utils/permissions/service-order-permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { ServiceOrderCell } from "./service-order-cell";
import { IconCheck, IconAlertTriangle } from "@tabler/icons-react";

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

// Helper function to check if a date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

// Helper function to check if a date is in the past
const isPast = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
};

// Helper function to calculate days until a date
const getDaysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to get detailed status of commercial and artwork service orders
const getCommercialArtworkOrdersStatus = (task: Task): {
  hasIssue: boolean;
  commercialMissing: boolean;
  commercialIncomplete: boolean;
  artworkMissing: boolean;
  artworkIncomplete: boolean;
  issueDescription: string;
} => {
  const incompleteStatuses = [
    SERVICE_ORDER_STATUS.PENDING,
    SERVICE_ORDER_STATUS.IN_PROGRESS,
    SERVICE_ORDER_STATUS.WAITING_APPROVE
  ];

  // Check commercial service orders
  const commercialOrders = task.serviceOrders?.filter(so => so.type === SERVICE_ORDER_TYPE.COMMERCIAL) || [];
  const commercialMissing = commercialOrders.length === 0;
  const commercialIncomplete = !commercialMissing && commercialOrders.some(so => so.status && incompleteStatuses.includes(so.status));

  // Check artwork service orders
  const artworkOrders = task.serviceOrders?.filter(so => so.type === SERVICE_ORDER_TYPE.ARTWORK) || [];
  const artworkMissing = artworkOrders.length === 0;
  const artworkIncomplete = !artworkMissing && artworkOrders.some(so => so.status && incompleteStatuses.includes(so.status));

  const hasIssue = commercialMissing || commercialIncomplete || artworkMissing || artworkIncomplete;

  // Build issue description
  const issues: string[] = [];
  if (commercialMissing) issues.push('Ordem comercial ausente');
  if (commercialIncomplete) issues.push('Ordem comercial incompleta');
  if (artworkMissing) issues.push('Ordem de arte ausente');
  if (artworkIncomplete) issues.push('Ordem de arte incompleta');

  return {
    hasIssue,
    commercialMissing,
    commercialIncomplete,
    artworkMissing,
    artworkIncomplete,
    issueDescription: issues.join('. ') + (issues.length > 0 ? '.' : ''),
  };
};

// Helper function to get urgency color based on days until forecast
const getUrgencyColor = (daysUntil: number): { color: string; colorClass: string; label: string } | null => {
  if (daysUntil <= 3) {
    return { color: 'rgb(239, 68, 68)', colorClass: 'text-red-500', label: '3 dias ou menos' }; // red-500
  }
  if (daysUntil <= 7) {
    return { color: 'rgb(249, 115, 22)', colorClass: 'text-orange-500', label: '7 dias ou menos' }; // orange-500
  }
  if (daysUntil <= 10) {
    return { color: 'rgb(234, 179, 8)', colorClass: 'text-yellow-500', label: '10 dias ou menos' }; // yellow-500
  }
  return null;
};

// Helper function to render forecast date with indicators (only for preparation route)
const renderForecastDate = (date: Date | null, task: Task, navigationRoute?: string, _currentUserId?: string) => {
  if (!date) return <span className="text-muted-foreground">-</span>;

  const formatted = formatDate(date);
  const dateTime = formatDateTime(date);
  const forecastDate = new Date(date);

  // Only show indicators for preparation route
  const showIndicators = navigationRoute === 'preparation';

  // Get detailed status of commercial and artwork service orders
  const ordersStatus = getCommercialArtworkOrdersStatus(task);
  const hasIncompleteOrders = ordersStatus.hasIssue;

  // Calculate days until forecast
  const daysUntil = getDaysUntil(forecastDate);

  // Get urgency color if within threshold and has incomplete orders
  const urgencyInfo = showIndicators && hasIncompleteOrders ? getUrgencyColor(daysUntil) : null;

  // Blue triangle with check icon when forecast is today
  const isForecastToday = isToday(forecastDate);
  const isForecastPast = isPast(forecastDate);
  const showBlueIndicator = showIndicators && isForecastToday && !hasIncompleteOrders;

  // Red triangle when forecast is today AND has incomplete orders (blue font already indicates "today")
  const showRedTodayWithIncompleteOrders = showIndicators && isForecastToday && hasIncompleteOrders;

  // Red triangle with alert icon when forecast is past AND has incomplete/missing orders (regardless of entry date)
  const showRedOverdueWithIncompleteOrders = showIndicators && isForecastPast && !isForecastToday && hasIncompleteOrders;

  // Red triangle with alert icon when forecast is past AND entry date is not filled (no incomplete orders check)
  const showRedOverdueNoEntryDate = showIndicators && isForecastPast && !task.entryDate && !isForecastToday && !hasIncompleteOrders;

  // Show urgency indicator when approaching forecast with incomplete orders (but not today or past)
  const showUrgencyIndicator = showIndicators && urgencyInfo && !isForecastToday && !isForecastPast;

  // Green text when entryDate is filled (vehicle has entered) and task is not completed
  const hasEntryDate = !!task.entryDate && task.status !== TASK_STATUS.COMPLETED;

  return (
    <>
      {showIndicators && hasEntryDate ? (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <span className="truncate text-green-500 font-medium cursor-help">
              {formatted}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-green-500">Veículo já entrou</div>
              <div className="text-muted-foreground">Data de entrada preenchida. Previsão: {formatted}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : showIndicators && isForecastToday ? (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <span className="truncate text-blue-500 font-medium cursor-help">
              {formatted}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-blue-500">Previsão para hoje</div>
              <div className="text-muted-foreground">A data de liberação é hoje ({formatted})</div>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="truncate" title={dateTime}>
          {formatted}
        </span>
      )}

      {/* Red indicator for today with incomplete/missing orders (blue font already indicates "today") */}
      {showRedTodayWithIncompleteOrders && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-red-500 pointer-events-auto cursor-help">
              <IconAlertTriangle className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-red-500">Liberação hoje - Ordens pendentes</div>
              <div className="text-muted-foreground">A liberação é hoje ({formatted}). {ordersStatus.issueDescription}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Urgency indicator for approaching forecast with incomplete/missing orders */}
      {showUrgencyIndicator && urgencyInfo && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div
              className="absolute top-0 right-0 z-20 w-0 h-0 border-l-[28px] border-l-transparent pointer-events-auto cursor-help"
              style={{ borderTop: `28px solid ${urgencyInfo.color}` }}
            >
              <IconAlertTriangle className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className={`font-medium ${urgencyInfo.colorClass}`}>Liberação em {daysUntil} {daysUntil === 1 ? 'dia' : 'dias'}</div>
              <div className="text-muted-foreground">A liberação ({formatted}) está próxima. {ordersStatus.issueDescription}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Blue indicator for today (without incomplete orders) - positioned flush with cell corner */}
      {showBlueIndicator && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-blue-500 pointer-events-auto cursor-help">
              <IconCheck className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium">Previsão para hoje</div>
              <div className="text-muted-foreground">A data de liberação é hoje ({formatted})</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Red indicator for overdue with incomplete/missing orders - positioned flush with cell corner */}
      {showRedOverdueWithIncompleteOrders && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-red-500 pointer-events-auto cursor-help">
              <IconAlertTriangle className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-red-500">Liberação atrasada - Ordens pendentes</div>
              <div className="text-muted-foreground">A liberação ({formatted}) já passou. {ordersStatus.issueDescription}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Red indicator for overdue without entry date (when no incomplete orders) - positioned flush with cell corner */}
      {showRedOverdueNoEntryDate && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-red-500 pointer-events-auto cursor-help">
              <IconAlertTriangle className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-red-500">Liberação atrasada</div>
              <div className="text-muted-foreground">A liberação ({formatted}) já passou e a data de entrada ainda não foi preenchida</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </>
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
  const services = task.serviceOrders || [];
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

// Define columns specific to history view
export const createTaskHistoryColumns = (options?: {
  canViewPrice?: boolean;
  currentUserId?: string;
  sectorPrivilege?: SECTOR_PRIVILEGES; // User's sector privilege for column filtering
  navigationRoute?: 'history' | 'preparation' | 'schedule'; // Current navigation route
}): TaskColumn[] => {
  const { canViewPrice = true, currentUserId, sectorPrivilege, navigationRoute } = options || {};

  const allColumns: TaskColumn[] = [
  {
    id: "name",
    header: "LOGOMARCA",
    accessorKey: "name",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    minWidth: "200px",
    formatter: (value: string) => <TruncatedTextWithTooltip text={value} className="font-medium truncate" />,
  },
  {
    id: "customer.fantasyName",
    header: "RAZÃO SOCIAL",
    accessorFn: (row) => row.customer?.corporateName || row.customer?.fantasyName || "",
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
    id: "responsibles",
    header: "RESPONSÁVEIS",
    accessorFn: (row) => row.responsibles?.map(r => r.name).join(", ") || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "150px",
    formatter: (value: string, row: Task) => {
      if (!row.responsibles || row.responsibles.length === 0) return <span className="text-muted-foreground">-</span>;
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
    defaultVisible: false,
    width: "140px",
    formatter: (_value: any, row: Task) => {
      if (!row.generalPainting) {
        return <span className="text-muted-foreground">-</span>;
      }

      const paint = row.generalPainting;
      const paintFinish = paint.finish as PAINT_FINISH;

      return (
        <div className="-my-2 flex items-center">
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
                  {paint.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</div>}
                  {paint.paintBrand?.name && !paint.manufacturer && <div>{paint.paintBrand.name}</div>}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
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
    defaultVisible: false,
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
    id: "identificador",
    header: "IDENTIFICADOR",
    accessorFn: (row) => row.serialNumber || row.truck?.plate || "",
    sortable: true,
    filterable: true,
    defaultVisible: true,
    width: "140px",
    formatter: (value: string) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="truncate">{value}</span>;
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
    id: "truckCategory",
    header: "CATEGORIA DO CAMINHÃO",
    accessorFn: (row) => row.truck?.category || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "160px",
    formatter: (_value: string | null, row: Task) => {
      if (!row.truck?.category) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="truncate">
          {TRUCK_CATEGORY_LABELS[row.truck.category]}
        </Badge>
      );
    },
  },
  {
    id: "implementType",
    header: "TIPO DE IMPLEMENTO",
    accessorFn: (row) => row.truck?.implementType || "",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "140px",
    formatter: (_value: string | null, row: Task) => {
      if (!row.truck?.implementType) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="truncate">
          {IMPLEMENT_TYPE_LABELS[row.truck.implementType]}
        </Badge>
      );
    },
  },
  {
    id: "forecastDate",
    header: "PREVISÃO",
    accessorKey: "forecastDate",
    sortable: true,
    filterable: true,
    defaultVisible: false,
    width: "120px",
    cellClassName: "relative",
    formatter: (value: Date | null, row: Task) => renderForecastDate(value, row, navigationRoute, currentUserId),
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
    defaultVisible: false,
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
    id: "serviceOrders",
    header: "SERVIÇOS",
    accessorFn: (row) => row.serviceOrders?.length || 0,
    sortable: false,
    filterable: false,
    defaultVisible: false,
    minWidth: "200px",
    formatter: (_: any, row: Task) => renderServices(row),
  },
  {
    id: "serviceOrders.commercial",
    header: (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{SERVICE_ORDER_TYPE_COLUMN_LABELS[SERVICE_ORDER_TYPE.COMMERCIAL]}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            Total de ordens de serviço de {SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.COMMERCIAL].toLowerCase()}
          </div>
        </TooltipContent>
      </Tooltip>
    ),
    accessorFn: (row) => row.serviceOrders?.filter((so) => so.type === SERVICE_ORDER_TYPE.COMMERCIAL).length || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "140px",
    cellClassName: "relative",
    formatter: (_: any, row: Task) => <ServiceOrderCell task={row} serviceOrderType={SERVICE_ORDER_TYPE.COMMERCIAL} navigationRoute={navigationRoute} />,
  },
  {
    id: "serviceOrders.logistic",
    header: (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{SERVICE_ORDER_TYPE_COLUMN_LABELS[SERVICE_ORDER_TYPE.LOGISTIC]}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            Total de ordens de serviço de {SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.LOGISTIC].toLowerCase()}
          </div>
        </TooltipContent>
      </Tooltip>
    ),
    accessorFn: (row) => row.serviceOrders?.filter((so) => so.type === SERVICE_ORDER_TYPE.LOGISTIC).length || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "140px",
    cellClassName: "relative",
    formatter: (_: any, row: Task) => <ServiceOrderCell task={row} serviceOrderType={SERVICE_ORDER_TYPE.LOGISTIC} navigationRoute={navigationRoute} />,
  },
  {
    id: "serviceOrders.artwork",
    header: (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{SERVICE_ORDER_TYPE_COLUMN_LABELS[SERVICE_ORDER_TYPE.ARTWORK]}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            Total de ordens de serviço de {SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.ARTWORK].toLowerCase()}
          </div>
        </TooltipContent>
      </Tooltip>
    ),
    accessorFn: (row) => row.serviceOrders?.filter((so) => so.type === SERVICE_ORDER_TYPE.ARTWORK).length || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "100px",
    cellClassName: "relative",
    formatter: (_: any, row: Task) => <ServiceOrderCell task={row} serviceOrderType={SERVICE_ORDER_TYPE.ARTWORK} navigationRoute={navigationRoute} />,
  },
  {
    id: "serviceOrders.production",
    header: (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{SERVICE_ORDER_TYPE_COLUMN_LABELS[SERVICE_ORDER_TYPE.PRODUCTION]}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            Total de ordens de serviço de {SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.PRODUCTION].toLowerCase()}
          </div>
        </TooltipContent>
      </Tooltip>
    ),
    accessorFn: (row) => row.serviceOrders?.filter((so) => so.type === SERVICE_ORDER_TYPE.PRODUCTION).length || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "120px",
    cellClassName: "relative",
    formatter: (_: any, row: Task) => <ServiceOrderCell task={row} serviceOrderType={SERVICE_ORDER_TYPE.PRODUCTION} navigationRoute={navigationRoute} />,
  },
  {
    id: "serviceOrders.financial",
    header: (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{SERVICE_ORDER_TYPE_COLUMN_LABELS[SERVICE_ORDER_TYPE.FINANCIAL]}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            Total de ordens de serviço de {SERVICE_ORDER_TYPE_LABELS[SERVICE_ORDER_TYPE.FINANCIAL].toLowerCase()}
          </div>
        </TooltipContent>
      </Tooltip>
    ),
    accessorFn: (row) => row.serviceOrders?.filter((so) => so.type === SERVICE_ORDER_TYPE.FINANCIAL).length || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
    width: "120px",
    cellClassName: "relative",
    formatter: (_: any, row: Task) => <ServiceOrderCell task={row} serviceOrderType={SERVICE_ORDER_TYPE.FINANCIAL} navigationRoute={navigationRoute} />,
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

        if (row.status === TASK_STATUS.PREPARATION) {
          suspensionReason = "Tarefa em preparação";
        } else if (row.status === TASK_STATUS.CANCELLED) {
          suspensionReason = "Tarefa cancelada";
        } else if (!row.finishedAt && row.term && new Date(row.term) < new Date()) {
          suspensionReason = "Prazo excedido";
        } else if (row.observation?.description?.toLowerCase().includes("suspens")) {
          suspensionReason = "Suspensa por observação";
        }

        return (
          <Tooltip delayDuration={500}>
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

  // Filter columns based on permissions and page context
  let filteredColumns = allColumns;

  // Always remove the old "SERVIÇOS" column (replaced by individual service order type columns)
  filteredColumns = filteredColumns.filter(col => col.id !== 'serviceOrders');

  // Filter service order columns based on sector privilege
  // Each sector has specific visibility for each service order type:
  // - ADMIN: sees all
  // - COMMERCIAL: sees PRODUCTION + FINANCIAL + COMMERCIAL
  // - DESIGNER: sees PRODUCTION + ARTWORK (view only)
  // - FINANCIAL: sees PRODUCTION + FINANCIAL only
  // - LOGISTIC: sees PRODUCTION + LOGISTIC only
  // - PRODUCTION/WAREHOUSE/BASIC/EXTERNAL/MAINTENANCE: sees PRODUCTION only
  // - HR: sees none
  if (sectorPrivilege) {
    filteredColumns = filteredColumns.filter(col => {
      // Check service order columns
      if (col.id === 'serviceOrders.production') {
        return canViewServiceOrderType(sectorPrivilege, SERVICE_ORDER_TYPE.PRODUCTION);
      }
      if (col.id === 'serviceOrders.financial') {
        return canViewServiceOrderType(sectorPrivilege, SERVICE_ORDER_TYPE.FINANCIAL);
      }
      if (col.id === 'serviceOrders.commercial') {
        return canViewServiceOrderType(sectorPrivilege, SERVICE_ORDER_TYPE.COMMERCIAL);
      }
      if (col.id === 'serviceOrders.logistic') {
        return canViewServiceOrderType(sectorPrivilege, SERVICE_ORDER_TYPE.LOGISTIC);
      }
      if (col.id === 'serviceOrders.artwork') {
        return canViewServiceOrderType(sectorPrivilege, SERVICE_ORDER_TYPE.ARTWORK);
      }
      // Keep all other columns
      return true;
    });
  }

  // Filter out price column if user doesn't have permission
  if (!canViewPrice) {
    filteredColumns = filteredColumns.filter(col => col.id !== 'price');
  }

  // Define privileged sectors that can view restricted fields (responsibles, forecastDate)
  const canViewRestrictedFields = sectorPrivilege && (
    sectorPrivilege === SECTOR_PRIVILEGES.ADMIN ||
    sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
    sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
    sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER
  );

  // Define sectors that can view commission field (ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION)
  const canViewCommissionField = sectorPrivilege && (
    sectorPrivilege === SECTOR_PRIVILEGES.ADMIN ||
    sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
    sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    sectorPrivilege === SECTOR_PRIVILEGES.PRODUCTION
  );

  // Filter out restricted columns for users without permission
  // Only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, and DESIGNER can see responsibles and forecastDate
  if (!canViewRestrictedFields) {
    filteredColumns = filteredColumns.filter(col =>
      col.id !== 'responsibles' &&
      col.id !== 'forecastDate'
    );
  }

  // Filter out commission column for users without permission (ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION only)
  if (!canViewCommissionField) {
    filteredColumns = filteredColumns.filter(col => col.id !== 'commission');
  }

  // Filter out observation column from agenda (preparation) page
  if (navigationRoute === 'preparation') {
    filteredColumns = filteredColumns.filter(col => col.id !== 'observation');
  }

  return filteredColumns;
};

// Helper to get visible columns based on user preferences
export const getVisibleColumns = (columns: TaskColumn[], visibleColumnIds: Set<string>): TaskColumn[] => {
  return columns.filter((column) => visibleColumnIds.has(column.id));
};

// Helper to get default visible columns
export const getDefaultVisibleColumns = (columns: TaskColumn[]): Set<string> => {
  return new Set(columns.filter((column) => column.defaultVisible).map((column) => column.id));
};
