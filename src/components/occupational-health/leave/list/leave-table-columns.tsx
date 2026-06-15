import { IconAlertTriangle } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";

import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { LeaveColumn } from "./types";

export const createLeaveColumns = (): LeaveColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (leave: Leave) => (
      <div className="font-medium truncate" title={leave.user?.name}>
        {leave.user?.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    className: "min-w-[200px]",
    align: "left",
  },

  // Setor (do colaborador)
  {
    key: "user.sector",
    header: "SETOR",
    accessor: (leave: Leave) => {
      const sector = leave.user?.sector?.name;
      if (!sector) return <span className="text-muted-foreground">-</span>;
      return (
        <p className="text-sm truncate" title={sector}>
          {sector}
        </p>
      );
    },
    sortable: false,
    className: "min-w-[150px]",
    align: "left",
  },

  // Cargo (do colaborador)
  {
    key: "user.position",
    header: "CARGO",
    accessor: (leave: Leave) => {
      const position = leave.user?.position?.name;
      if (!position) return <span className="text-muted-foreground">-</span>;
      return (
        <p className="text-sm truncate" title={position}>
          {position}
        </p>
      );
    },
    sortable: false,
    className: "min-w-[170px]",
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
export const DEFAULT_VISIBLE_COLUMNS = new Set(["user.name", "user.sector", "user.position", "type", "status", "startDate", "endDate", "returnExamRequired"]);
