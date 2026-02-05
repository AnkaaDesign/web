import { formatDate, formatDateTime } from "../../../../utils";
import { getDynamicFrequencyLabel, PPE_TYPE_LABELS } from "../../../../constants";
import type { PpeDeliverySchedule } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { PpeScheduleColumn } from "./types";

export const createPpeScheduleColumns = (): PpeScheduleColumn[] => [
  // Primary columns in the correct order
  {
    key: "name",
    header: "NOME",
    accessor: (schedule: PpeDeliverySchedule) => (
      <div className="font-medium truncate" title={schedule.name || ""}>
        {schedule.name || `#${schedule.id.slice(0, 8)}`}
      </div>
    ),
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className + " w-48",
    align: "left",
  },
  {
    key: "items",
    header: "ITENS DE EPI",
    accessor: (schedule: PpeDeliverySchedule) => {
      const ppeItems = schedule.items || [];
      if (ppeItems.length === 0) return <div className="truncate text-muted-foreground">-</div>;

      const displayText =
        ppeItems.length <= 2
          ? ppeItems.map((item) => `${PPE_TYPE_LABELS[item.ppeType] || item.ppeType} (${item.quantity})`).join(", ")
          : `${ppeItems
              .slice(0, 2)
              .map((item) => `${PPE_TYPE_LABELS[item.ppeType] || item.ppeType} (${item.quantity})`)
              .join(", ")} +${ppeItems.length - 2}`;

      return (
        <div className="truncate text-sm" title={ppeItems.map((item) => `${PPE_TYPE_LABELS[item.ppeType] || item.ppeType}: ${item.quantity}`).join(", ")}>
          {displayText}
        </div>
      );
    },
    sortable: false,
    className: "w-48",
    align: "left",
  },
  {
    key: "assignmentType",
    header: "ATRIBUIÇÃO",
    accessor: (schedule: PpeDeliverySchedule) => {
      const type = schedule.assignmentType;
      let displayText = "";

      switch (type) {
        case "ALL":
          displayText = "Todos os usuários";
          break;
        case "SPECIFIC":
          const userCount = schedule.includedUserIds?.length || 0;
          displayText = userCount > 0 ? `${userCount} usuário(s) específico(s)` : "Nenhum usuário";
          break;
        case "ALL_EXCEPT":
          const excludedCount = schedule.excludedUserIds?.length || 0;
          displayText = excludedCount > 0 ? `Todos exceto ${excludedCount}` : "Todos os usuários";
          break;
        default:
          displayText = "Configuração inválida";
      }

      return <div className="truncate text-sm">{displayText}</div>;
    },
    sortable: true,
    className: "w-48",
    align: "left",
  },
  {
    key: "frequency",
    header: "FREQUÊNCIA",
    accessor: (schedule: PpeDeliverySchedule) => <div className="truncate text-sm">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "nextRun",
    header: "PRÓXIMA EXECUÇÃO",
    accessor: (schedule: PpeDeliverySchedule) => {
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
    accessor: (schedule: PpeDeliverySchedule) => (
      <Badge variant={schedule.isActive ? "active" : "destructive"} className="whitespace-nowrap">
        {schedule.isActive ? "Sim" : "Não"}
      </Badge>
    ),
    sortable: true,
    className: "w-24",
    align: "center",
  },
  // Secondary columns
  {
    key: "id",
    header: "ID",
    accessor: (schedule: PpeDeliverySchedule) => <div className="font-mono text-xs truncate text-muted-foreground">{schedule.id.slice(0, 8)}</div>,
    sortable: true,
    className: "w-24",
    align: "left",
  },
  {
    key: "frequencyCount",
    header: "INTERVALO",
    accessor: (schedule: PpeDeliverySchedule) => (
      <div className="truncate text-sm text-center tabular-nums">
        {schedule.frequencyCount ? <span className="text-sky-600 font-medium">{schedule.frequencyCount}</span> : <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "lastRun",
    header: "ÚLTIMA EXECUÇÃO",
    accessor: (schedule: PpeDeliverySchedule) => {
      if (!schedule.lastRun) return <div className="truncate text-muted-foreground">-</div>;

      return <div className="truncate text-sm">{formatDate(new Date(schedule.lastRun))}</div>;
    },
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (schedule: PpeDeliverySchedule) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(schedule.createdAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (schedule: PpeDeliverySchedule) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(schedule.updatedAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "items", "frequency", "nextRun", "isActive"]);
};
