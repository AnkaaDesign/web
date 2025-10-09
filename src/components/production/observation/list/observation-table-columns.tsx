import React from "react";
import type { Observation } from "../../../../types";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { IconPaperclip } from "@tabler/icons-react";

export interface ObservationColumn {
  key: string;
  header: string;
  accessor: (observation: Observation) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["task.name", "description", "filesCount", "createdAt"]);
}

export function createObservationColumns(): ObservationColumn[] {
  return [
    {
      key: "task.name",
      header: "TAREFA",
      accessor: (observation) => (
        <div className="space-y-1">
          {observation.task ? (
            <TruncatedTextWithTooltip text={observation.task.name} className="font-medium" />
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
      key: "description",
      header: "DESCRIÇÃO",
      accessor: (observation) => (
        <div className="space-y-1">
          <TruncatedTextWithTooltip text={observation.description} className="text-sm" />
        </div>
      ),
      sortable: true,
      className: "min-w-[300px]",
      align: "left",
    },
    {
      key: "filesCount",
      header: "ARQUIVOS",
      accessor: (observation) => (
        <div className="flex items-center gap-1.5">
          {observation.files && observation.files.length > 0 ? (
            <>
              <IconPaperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{observation.files.length}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: false,
      className: "w-32",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (observation) => (
        <div className="space-y-1">
          <div className="text-sm">{formatDate(observation.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatRelativeTime(observation.createdAt)}</div>
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "updatedAt",
      header: "ATUALIZADO EM",
      accessor: (observation) => (
        <div className="space-y-1">
          <div className="text-sm">{formatDate(observation.updatedAt)}</div>
          <div className="text-xs text-muted-foreground">{formatRelativeTime(observation.updatedAt)}</div>
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
  ];
}

// Export alias for backwards compatibility
export const getObservationTableColumns = createObservationColumns;
