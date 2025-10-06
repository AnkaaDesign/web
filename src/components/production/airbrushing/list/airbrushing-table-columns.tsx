import React from "react";
import { Badge } from "@/components/ui/badge";
import { IconPhoto } from "@tabler/icons-react";
import { formatDate, formatRelativeTime, formatCurrency } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import type { Airbrushing } from "../../../../types";

export interface AirbrushingColumn {
  key: string;
  header: string;
  accessor: (airbrushing: Airbrushing) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["task.name", "task.customer.fantasyName", "status", "price", "startDate", "finishDate", "artworksCount"]);
}

export function createAirbrushingColumns(): AirbrushingColumn[] {
  return [
    {
      key: "task.name",
      header: "TAREFA",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.task ? (
            <TruncatedTextWithTooltip text={airbrushing.task.name} className="font-medium" />
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: TABLE_LAYOUT.firstDataColumn.className,
      align: "left",
    },
    {
      key: "task.customer.fantasyName",
      header: "CLIENTE",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.task?.customer ? (
            <TruncatedTextWithTooltip text={airbrushing.task.customer.fantasyName} className="text-sm" />
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-48",
      align: "left",
    },
    {
      key: "status",
      header: "STATUS",
      accessor: (airbrushing) => (
        <Badge
          variant={
            airbrushing.status === "PENDING"
              ? "secondary"
              : airbrushing.status === "IN_PRODUCTION"
                ? "default"
                : airbrushing.status === "COMPLETED"
                  ? "success"
                  : "destructive"
          }
          className="whitespace-nowrap"
        >
          {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
        </Badge>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "price",
      header: "PREÇO",
      accessor: (airbrushing) => (
        <div className="font-medium truncate">
          {airbrushing.price !== null ? formatCurrency(airbrushing.price) : <span className="text-muted-foreground">-</span>}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "startDate",
      header: "DATA INÍCIO",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.startDate ? (
            <>
              <div className="text-sm">{formatDate(airbrushing.startDate)}</div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(airbrushing.startDate)}</div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "finishDate",
      header: "DATA FINALIZAÇÃO",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.finishDate ? (
            <>
              <div className="text-sm">{formatDate(airbrushing.finishDate)}</div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(airbrushing.finishDate)}</div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "artworksCount",
      header: "ARTES",
      accessor: (airbrushing) => (
        <div className="flex items-center gap-1.5">
          <IconPhoto className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{airbrushing.artworks?.length || 0}</span>
        </div>
      ),
      sortable: false,
      className: "w-24",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (airbrushing) => (
        <div className="text-sm text-muted-foreground">
          {new Date(airbrushing.createdAt).toLocaleDateString("pt-BR")}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "updatedAt",
      header: "ATUALIZADO EM",
      accessor: (airbrushing) => (
        <div className="text-sm text-muted-foreground">
          {new Date(airbrushing.updatedAt).toLocaleDateString("pt-BR")}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
  ];
}

// Export alias for backwards compatibility
export const getAirbrushingTableColumns = createAirbrushingColumns;
