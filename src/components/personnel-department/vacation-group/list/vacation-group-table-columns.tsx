import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { VACATION_STATUS, VACATION_STATUS_LABELS, VACATION_GROUP_TYPE_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { VacationGroup } from "../../../../types/vacation-group";

export interface VacationGroupColumn {
  key: string;
  header: string;
  accessor: (group: VacationGroup) => ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

/** Maps the vacation status to a generic badge variant. */
export function getVacationGroupStatusVariant(status: VACATION_STATUS): "secondary" | "warning" | "default" | "success" | "destructive" {
  switch (status) {
    case VACATION_STATUS.OPEN:
      return "secondary";
    case VACATION_STATUS.SCHEDULED:
      return "warning";
    case VACATION_STATUS.IN_PROGRESS:
      return "default";
    case VACATION_STATUS.PAID:
      return "success";
    case VACATION_STATUS.EXPIRED:
      return "destructive";
    default:
      return "secondary";
  }
}

function periodRange(group: VacationGroup): string {
  if (!group.startDate || !group.days) return "-";
  const start = new Date(group.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + (Number(group.days) || 0) - 1);
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export const createVacationGroupColumns = (): VacationGroupColumn[] => [
  {
    key: "name",
    header: "NOME",
    accessor: (group) => (
      <div className="truncate font-medium" title={group.name}>
        {group.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    className: "min-w-[220px]",
    align: "left",
  },
  {
    key: "type",
    header: "ABRANGÊNCIA",
    accessor: (group) => (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        {VACATION_GROUP_TYPE_LABELS[group.type] || group.type}
      </Badge>
    ),
    className: "min-w-[140px]",
    align: "left",
  },
  {
    key: "period",
    header: "PERÍODO",
    accessor: (group) => <div className="text-sm truncate">{periodRange(group)}</div>,
    className: "min-w-[200px]",
    align: "left",
  },
  {
    key: "status",
    header: "STATUS",
    accessor: (group) => (
      <Badge variant={getVacationGroupStatusVariant(group.status)} className="text-xs whitespace-nowrap">
        {VACATION_STATUS_LABELS[group.status] || group.status}
      </Badge>
    ),
    className: "min-w-[130px]",
    align: "left",
  },
  {
    key: "count",
    header: "FÉRIAS GERADAS",
    accessor: (group) => <div className="text-sm font-medium tabular-nums">{group.vacations?.length ?? 0}</div>,
    className: "min-w-[140px]",
    align: "center",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (group) => (
      <div className="text-sm truncate">{group.createdAt ? formatDate(new Date(group.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    className: "min-w-[130px]",
    align: "left",
  },
];
