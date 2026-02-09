import { formatDate, formatDateTime } from "../../../../utils";
import { MAINTENANCE_STATUS } from "../../../../constants";
import type { Maintenance } from "../../../../types";
import { MaintenanceStatusBadge } from "../common/maintenance-status-badge";
import type { MaintenanceColumn } from "./types";

export const createMaintenanceColumns = (): MaintenanceColumn[] => [
  // Primary columns in the correct order
  {
    key: "name",
    header: "NOME",
    accessor: (maintenance: Maintenance) => <div className="font-medium truncate">{maintenance.name}</div>,
    sortable: true,
    className: "w-80 min-w-80 max-w-80",
    align: "left",
  },
  {
    key: "item.name",
    header: "ITEM",
    accessor: (maintenance: Maintenance) => <div className="truncate">{maintenance.item?.name || "-"}</div>,
    sortable: true,
    className: "w-64 min-w-64 max-w-64",
    align: "left",
  },
  {
    key: "status",
    header: "STATUS",
    accessor: (maintenance: Maintenance) => (
      <div className="flex">
        <MaintenanceStatusBadge status={maintenance.status} showIcon={false} className="whitespace-nowrap" />
      </div>
    ),
    sortable: true,
    className: "w-40 min-w-40 max-w-40",
    align: "left",
  },
  {
    key: "scheduledFor",
    header: "DATA",
    accessor: (maintenance: Maintenance) => {
      if (!maintenance.scheduledFor) return <div className="truncate text-muted-foreground">-</div>;

      const now = new Date();
      const scheduledDate = new Date(maintenance.scheduledFor);
      const isOverdue = scheduledDate < now && maintenance.status === MAINTENANCE_STATUS.PENDING;
      const isDueSoon = scheduledDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && maintenance.status === MAINTENANCE_STATUS.PENDING;

      let className = "truncate";
      if (isOverdue) {
        className += " text-orange-600 font-medium"; // Overdue - orange for consistency
      } else if (isDueSoon) {
        className += " text-orange-600 font-medium"; // Due soon (within 7 days)
      } else {
        className += " text-foreground"; // Normal
      }

      return <div className={className}>{formatDate(scheduledDate)}</div>;
    },
    sortable: true,
    className: "w-40 min-w-40 max-w-40",
    align: "left",
  },
  {
    key: "timeTaken",
    header: "TEMPO GASTO",
    accessor: (maintenance: Maintenance) => (
      <div className="truncate text-sm tabular-nums">
        {maintenance.timeTaken ? (
          (() => {
            const hours = Math.floor(maintenance.timeTaken / 3600);
            const minutes = Math.floor((maintenance.timeTaken % 3600) / 60);
            return <span className="text-green-700 font-medium">{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}</span>;
          })()
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    ),
    sortable: true,
    className: "w-40 min-w-40 max-w-40",
    align: "center",
  },
  // Secondary columns
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (maintenance: Maintenance) => <div className="truncate text-sm text-muted-foreground">{maintenance.description || "-"}</div>,
    sortable: false,
    className: "w-64",
    align: "left",
  },
  {
    key: "item.brand.name",
    header: "MARCA DO ITEM",
    accessor: (maintenance: Maintenance) => <div className="truncate text-sm">{maintenance.item?.brand?.name || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "item.category.name",
    header: "CATEGORIA DO ITEM",
    accessor: (maintenance: Maintenance) => <div className="truncate text-sm">{maintenance.item?.category?.name || "-"}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (maintenance: Maintenance) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(maintenance.createdAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (maintenance: Maintenance) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(maintenance.updatedAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "item.name", "status", "scheduledFor", "timeTaken"]);
};
