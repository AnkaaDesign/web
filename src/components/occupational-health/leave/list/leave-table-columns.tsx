import { IconAlertTriangle } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";

import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { LeaveColumn } from "./types";

export const createLeaveColumns = (): LeaveColumn[] => [
  // Colaborador (+ cargo)
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (leave: Leave) => (
      <div className="min-w-0">
        <div className="font-medium truncate" title={leave.user?.name}>
          {leave.user?.name || <span className="text-muted-foreground">-</span>}
        </div>
        {leave.user?.position?.name && <div className="text-xs text-muted-foreground truncate">{leave.user.position.name}</div>}
      </div>
    ),
    sortable: false,
    className: "min-w-[220px]",
    align: "left",
  },

  // Tipo
  {
    key: "type",
    header: "TIPO",
    accessor: (leave: Leave) => (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        {LEAVE_TYPE_LABELS[leave.type as LEAVE_TYPE] || leave.type}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Status
  {
    key: "status",
    header: "STATUS",
    accessor: (leave: Leave) => (
      <Badge variant={getBadgeVariantFromStatus(leave.status, "LEAVE")} className="text-xs whitespace-nowrap">
        {LEAVE_STATUS_LABELS[leave.status as LEAVE_STATUS] || leave.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Data de início
  {
    key: "startDate",
    header: "INÍCIO",
    accessor: (leave: Leave) => <div className="text-sm truncate">{leave.startDate ? formatDate(new Date(leave.startDate)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Término (efetivo ?? previsto)
  {
    key: "endDate",
    header: "TÉRMINO",
    accessor: (leave: Leave) => {
      if (leave.actualEndDate) {
        return <div className="text-sm truncate">{formatDate(new Date(leave.actualEndDate))}</div>;
      }
      if (leave.expectedEndDate) {
        return (
          <div className="text-sm truncate">
            {formatDate(new Date(leave.expectedEndDate))} <span className="text-xs text-muted-foreground">(previsto)</span>
          </div>
        );
      }
      return <span className="text-sm text-muted-foreground">-</span>;
    },
    sortable: false,
    className: "min-w-[150px]",
    align: "left",
  },

  // Exame de retorno obrigatório
  {
    key: "returnExamRequired",
    header: "EXAME DE RETORNO",
    accessor: (leave: Leave) =>
      leave.returnExamRequired ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <IconAlertTriangle className="h-4 w-4 text-amber-500" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Exame de retorno obrigatório (≥30 dias)</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    sortable: true,
    className: "w-40",
    align: "center",
  },

  // Nº benefício INSS
  {
    key: "inssBenefitNumber",
    header: "Nº BENEFÍCIO INSS",
    accessor: (leave: Leave) => <div className="text-sm truncate">{leave.inssBenefitNumber || <span className="text-muted-foreground">-</span>}</div>,
    sortable: false,
    className: "min-w-[150px]",
    align: "left",
  },

  // Criado em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (leave: Leave) => <div className="text-sm truncate">{leave.createdAt ? formatDate(new Date(leave.createdAt)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["user.name", "type", "status", "startDate", "endDate", "returnExamRequired"]);
