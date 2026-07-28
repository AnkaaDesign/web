import React, { useMemo } from "react";
import { ColumnVisibilityManagerBase } from "@/components/ui/column-visibility-manager-base";
import { SECTOR_PRIVILEGES } from "@/constants";
import { getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";

// Define column interface to match the task table structure
interface TaskScheduleColumn {
  id: string;
  header: string;
  sortable?: boolean;
  width?: string;
}

// Base task schedule columns (without service orders)
const BASE_TASK_SCHEDULE_COLUMNS: TaskScheduleColumn[] = [
  { id: "name", header: "LOGOMARCA", sortable: true, width: "w-[180px]" },
  { id: "customer.fantasyName", header: "CLIENTE", sortable: true, width: "w-[150px]" },
  { id: "measures", header: "MEDIDAS", sortable: true, width: "w-[110px]" },
  { id: "generalPainting", header: "PINTURA", sortable: true, width: "w-[100px]" },
  { id: "serialNumberOrPlate", header: "IDENTIFICADOR", sortable: true, width: "w-[140px]" },
  { id: "spot", header: "LOCAL", sortable: true, width: "w-[120px]" },
  { id: "chassisNumber", header: "Nº CHASSI", sortable: true, width: "w-[140px]" },
  { id: "sector.name", header: "SETOR", sortable: true, width: "w-[120px]" },
  { id: "entryDate", header: "ENTRADA", sortable: true, width: "w-[110px]" },
  { id: "startedAt", header: "INICIADO EM", sortable: true, width: "w-[110px]" },
  { id: "term", header: "PRAZO", sortable: true, width: "w-[110px]" },
  { id: "remainingTime", header: "TEMPO RESTANTE", sortable: false, width: "w-[130px]" },
];

// Service order columns
const SERVICE_ORDER_COLUMNS: TaskScheduleColumn[] = [
  { id: "serviceOrders.production", header: "OS PRODUÇÃO", sortable: true, width: "w-[120px]" },
  { id: "serviceOrders.commercial", header: "OS COMERCIAL", sortable: true, width: "w-[120px]" },
  { id: "serviceOrders.logistic", header: "OS LOGÍSTICA", sortable: true, width: "w-[120px]" },
  { id: "serviceOrders.artwork", header: "OS ARTE", sortable: true, width: "w-[120px]" },
];

// Get columns available for a specific sector privilege
// includeServiceOrders: whether to include service order columns (false for cronograma, true for other pages)
export const getAvailableColumns = (sectorPrivilege: SECTOR_PRIVILEGES | undefined, includeServiceOrders: boolean = true): TaskScheduleColumn[] => {
  // For cronograma, only return base columns without service orders
  if (!includeServiceOrders) {
    return [...BASE_TASK_SCHEDULE_COLUMNS];
  }

  // For other pages (history, agenda), include service order columns based on permissions
  const visibleServiceOrderTypes = getVisibleServiceOrderTypes(sectorPrivilege);
  const visibleServiceOrderColumnIds = visibleServiceOrderTypes.map(type => `serviceOrders.${type.toLowerCase()}`);

  const availableServiceOrderColumns = SERVICE_ORDER_COLUMNS.filter(col =>
    visibleServiceOrderColumnIds.includes(col.id)
  );

  // Insert service order columns after "generalPainting"
  const paintingIndex = BASE_TASK_SCHEDULE_COLUMNS.findIndex(col => col.id === "generalPainting");
  const result = [...BASE_TASK_SCHEDULE_COLUMNS];
  result.splice(paintingIndex + 1, 0, ...availableServiceOrderColumns);

  return result;
};

// Legacy: Task schedule columns for backward compatibility (all columns)
const TASK_SCHEDULE_COLUMNS: TaskScheduleColumn[] = getAvailableColumns(SECTOR_PRIVILEGES.ADMIN);

// Get default visible columns based on sector privilege
// includeServiceOrders: whether to include service order columns in defaults (true for history/agenda, false for cronograma)
export const getDefaultVisibleColumns = (sectorPrivilege?: SECTOR_PRIVILEGES, includeServiceOrders: boolean = false): Set<string> => {
  const baseColumns = new Set(["name", "customer.fantasyName", "generalPainting", "serialNumberOrPlate", "sector.name", "term", "measures", "remainingTime"]);

  // Only add service order columns if explicitly requested (for history/agenda pages)
  if (includeServiceOrders) {
    const visibleServiceOrderTypes = getVisibleServiceOrderTypes(sectorPrivilege);
    visibleServiceOrderTypes.forEach(type => {
      baseColumns.add(`serviceOrders.${type.toLowerCase()}`);
    });
  }

  return baseColumns;
};

interface ColumnVisibilityManagerProps {
  columns?: TaskScheduleColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange?: (columns: Set<string>) => void;
  onColumnVisibilityChange?: (columns: Set<string>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  sectorPrivilege?: SECTOR_PRIVILEGES;
  /** Whether to include service order columns in default visible columns (true for history/agenda, false for cronograma) */
  includeServiceOrdersInDefaults?: boolean;
}

export function ColumnVisibilityManager({
  columns = TASK_SCHEDULE_COLUMNS,
  visibleColumns,
  onVisibilityChange,
  onColumnVisibilityChange,
  sectorPrivilege,
  includeServiceOrdersInDefaults = false,
}: ColumnVisibilityManagerProps) {
  const baseColumns = useMemo(() => columns.map((col) => ({ id: col.id, header: col.header })), [columns]);
  const handleVisibilityChange = onVisibilityChange || onColumnVisibilityChange;

  return (
    <ColumnVisibilityManagerBase
      columns={baseColumns}
      visibleColumns={visibleColumns}
      onVisibilityChange={(cols) => handleVisibilityChange?.(cols)}
      getDefaultVisibleColumns={() => getDefaultVisibleColumns(sectorPrivilege, includeServiceOrdersInDefaults)}
    />
  );
}
