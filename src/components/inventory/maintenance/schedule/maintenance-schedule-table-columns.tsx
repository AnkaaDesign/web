import { formatDate, formatDateTime } from "../../../../utils";
import { getDynamicFrequencyLabel } from "../../../../constants";
import type { MaintenanceSchedule } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { MaintenanceScheduleColumn } from "./types";

export const createMaintenanceScheduleColumns = (): MaintenanceScheduleColumn[] => [
  // Primary columns in the correct order
  {
    key: "id",
    header: "ID",
    accessor: (schedule: MaintenanceSchedule) => <div className="font-medium truncate">{schedule.id.slice(0, 8)}</div>,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className + " w-64",
    align: "left",
  },
  {
    key: "name",
    header: "NOME",
    accessor: (schedule: MaintenanceSchedule) => {
      return (
        <div className="truncate text-sm font-medium" title={schedule.name}>
          {schedule.name}
        </div>
      );
    },
    sortable: true,
    className: "w-64",
    align: "left",
  },
  {
    key: "item",
    header: "ITEM",
    accessor: (schedule: MaintenanceSchedule) => {
      if (!schedule.item) return <div className="truncate text-muted-foreground">-</div>;

      return (
        <div className="truncate text-sm" title={schedule.item.name}>
          {schedule.item.name}
        </div>
      );
    },
    sortable: false,
    className: "w-48",
    align: "left",
  },
  {
    key: "frequency",
    header: "FREQUÊNCIA",
    accessor: (schedule: MaintenanceSchedule) => (
      <div className="truncate text-sm">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "nextRun",
    header: "PRÓXIMA EXECUÇÃO",
    accessor: (schedule: MaintenanceSchedule) => {
      if (!schedule.nextRun) return <div className="truncate text-muted-foreground">-</div>;

      const now = new Date();
      const nextRun = new Date(schedule.nextRun);
      const isDue = nextRun <= now;
      const isDueSoon = nextRun <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let className = "truncate";
      if (isDue) {
        className += " text-red-600 font-medium"; // Due now
      } else if (isDueSoon) {
        className += " text-orange-600 font-medium"; // Due soon (within 7 days)
      } else {
        className += " text-foreground"; // Normal
      }

      return <div className={className}>{formatDate(nextRun)}</div>;
    },
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "isActive",
    header: "ATIVO",
    accessor: (schedule: MaintenanceSchedule) => (
      <Badge variant={schedule.isActive ? "active" : "inactive"} className="whitespace-nowrap">
        {schedule.isActive ? "Sim" : "Não"}
      </Badge>
    ),
    sortable: true,
    className: "w-24",
    align: "left",
  },
  // Secondary columns
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (schedule: MaintenanceSchedule) => {
      if (!schedule.description) return <div className="truncate text-muted-foreground">-</div>;
      return (
        <div className="truncate text-sm text-muted-foreground" title={schedule.description}>
          {schedule.description}
        </div>
      );
    },
    sortable: false,
    className: "w-64",
    align: "left",
  },
  {
    key: "frequencyCount",
    header: "INTERVALO",
    accessor: (schedule: MaintenanceSchedule) => (
      <div className="truncate text-sm tabular-nums">
        {schedule.frequencyCount ? (
          <span className="text-sky-600 font-medium">{schedule.frequencyCount}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    ),
    sortable: true,
    className: "w-24",
    align: "left",
  },
  {
    key: "lastRun",
    header: "ÚLTIMA EXECUÇÃO",
    accessor: (schedule: MaintenanceSchedule) => {
      if (!schedule.lastRun) return <div className="truncate text-muted-foreground">-</div>;

      return <div className="truncate text-sm">{formatDate(new Date(schedule.lastRun))}</div>;
    },
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "maintenanceItems",
    header: "ITENS NECESSÁRIOS",
    accessor: (schedule: MaintenanceSchedule) => {
      const config = schedule.maintenanceItemsConfig;
      if (!config || !Array.isArray(config) || config.length === 0) {
        return <div className="truncate text-muted-foreground">-</div>;
      }

      return (
        <div className="truncate text-sm">
          {config.length} {config.length === 1 ? "item" : "itens"}
        </div>
      );
    },
    sortable: false,
    className: "w-40",
    align: "left",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (schedule: MaintenanceSchedule) => (
      <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(schedule.createdAt))}</div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (schedule: MaintenanceSchedule) => (
      <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(schedule.updatedAt))}</div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "item", "frequency", "nextRun", "isActive"]);
};
