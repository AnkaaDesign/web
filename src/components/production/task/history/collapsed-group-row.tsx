import React, { useState, useEffect, useMemo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Task } from "../../../../types";
import type { TaskColumn } from "../list/types";
import {
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE_LABELS,
} from "../../../../constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CollapsedGroupRowProps {
  groupId: string;
  collapsedTasks: Task[];
  firstTask: Task;
  totalCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelectAll: () => void;
  canEdit: boolean;
  columns: TaskColumn[];
  selectedCount: number;
}

// Service order type column IDs
const SERVICE_ORDER_COLUMN_IDS = [
  'serviceOrders.commercial',
  'serviceOrders.logistic',
  'serviceOrders.artwork',
  'serviceOrders.production',
  'serviceOrders.financial',
];

// Map column ID to SERVICE_ORDER_TYPE
const COLUMN_ID_TO_TYPE: Record<string, SERVICE_ORDER_TYPE> = {
  'serviceOrders.commercial': SERVICE_ORDER_TYPE.COMMERCIAL,
  'serviceOrders.logistic': SERVICE_ORDER_TYPE.LOGISTIC,
  'serviceOrders.artwork': SERVICE_ORDER_TYPE.ARTWORK,
  'serviceOrders.production': SERVICE_ORDER_TYPE.PRODUCTION,
  'serviceOrders.financial': SERVICE_ORDER_TYPE.FINANCIAL,
};

export function CollapsedGroupRow({
  groupId,
  collapsedTasks,
  firstTask,
  totalCount,
  isExpanded,
  onToggle,
  isSelected,
  onSelectAll,
  canEdit,
  columns,
  selectedCount,
}: CollapsedGroupRowProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(!isExpanded);

  // All tasks in the group (first + collapsed)
  const allGroupTasks = useMemo(() => [firstTask, ...collapsedTasks], [firstTask, collapsedTasks]);

  // Calculate service order sums for each type
  const serviceOrderSums = useMemo(() => {
    const sums: Record<SERVICE_ORDER_TYPE, { total: number; completed: number; inProgress: number; pending: number; waitingApprove: number; cancelled: number }> = {
      [SERVICE_ORDER_TYPE.COMMERCIAL]: { total: 0, completed: 0, inProgress: 0, pending: 0, waitingApprove: 0, cancelled: 0 },
      [SERVICE_ORDER_TYPE.LOGISTIC]: { total: 0, completed: 0, inProgress: 0, pending: 0, waitingApprove: 0, cancelled: 0 },
      [SERVICE_ORDER_TYPE.ARTWORK]: { total: 0, completed: 0, inProgress: 0, pending: 0, waitingApprove: 0, cancelled: 0 },
      [SERVICE_ORDER_TYPE.PRODUCTION]: { total: 0, completed: 0, inProgress: 0, pending: 0, waitingApprove: 0, cancelled: 0 },
      [SERVICE_ORDER_TYPE.FINANCIAL]: { total: 0, completed: 0, inProgress: 0, pending: 0, waitingApprove: 0, cancelled: 0 },
    };

    for (const task of allGroupTasks) {
      const serviceOrders = task.serviceOrders || [];
      for (const so of serviceOrders) {
        if (so.type && sums[so.type]) {
          sums[so.type].total++;
          if (so.status === SERVICE_ORDER_STATUS.COMPLETED) {
            sums[so.type].completed++;
          } else if (so.status === SERVICE_ORDER_STATUS.IN_PROGRESS) {
            sums[so.type].inProgress++;
          } else if (so.status === SERVICE_ORDER_STATUS.PENDING) {
            sums[so.type].pending++;
          } else if (so.status === SERVICE_ORDER_STATUS.WAITING_APPROVE) {
            sums[so.type].waitingApprove++;
          } else if (so.status === SERVICE_ORDER_STATUS.CANCELLED) {
            sums[so.type].cancelled++;
          }
        }
      }
    }

    return sums;
  }, [allGroupTasks]);

  // Handle smooth transitions
  useEffect(() => {
    if (isExpanded) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(true);
      setIsAnimating(false);
    }
  }, [isExpanded]);

  if (!shouldRender) {
    return null;
  }

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-checkbox]")) {
      return;
    }
    onToggle();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckboxChange = () => {
    onSelectAll();
  };

  const collapsedTaskCount = collapsedTasks.length;
  const hasPartialSelection = selectedCount > 0 && selectedCount < totalCount;

  // Find service order columns that are visible
  const visibleServiceOrderColumns = columns.filter(col => SERVICE_ORDER_COLUMN_IDS.includes(col.id));
  const nonServiceOrderColumns = columns.filter(col => !SERVICE_ORDER_COLUMN_IDS.includes(col.id));

  // Render service order cell with progress bar
  const renderServiceOrderCell = (columnId: string) => {
    const type = COLUMN_ID_TO_TYPE[columnId];
    if (!type) return <span className="text-muted-foreground">-</span>;

    const data = serviceOrderSums[type];
    if (data.total === 0) {
      return <span className="text-muted-foreground">-</span>;
    }

    const completedPercent = (data.completed / data.total) * 100;
    const waitingApprovePercent = (data.waitingApprove / data.total) * 100;
    const inProgressPercent = (data.inProgress / data.total) * 100;
    const pendingPercent = (data.pending / data.total) * 100;
    const cancelledPercent = (data.cancelled / data.total) * 100;

    const typeLabel = SERVICE_ORDER_TYPE_LABELS[type];

    return (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div className="relative cursor-help">
            <div className="relative h-5 min-w-[90px] max-w-[140px] bg-gray-200 dark:bg-gray-700 rounded overflow-hidden shadow-sm">
              {data.completed > 0 && (
                <div
                  className="absolute h-full bg-green-700 transition-all duration-300"
                  style={{ left: '0%', width: `${completedPercent}%` }}
                />
              )}
              {data.waitingApprove > 0 && (
                <div
                  className="absolute h-full bg-purple-600 transition-all duration-300"
                  style={{ left: `${completedPercent}%`, width: `${waitingApprovePercent}%` }}
                />
              )}
              {data.inProgress > 0 && (
                <div
                  className="absolute h-full bg-blue-700 transition-all duration-300"
                  style={{ left: `${completedPercent + waitingApprovePercent}%`, width: `${inProgressPercent}%` }}
                />
              )}
              {data.pending > 0 && (
                <div
                  className="absolute h-full bg-neutral-500 transition-all duration-300"
                  style={{ left: `${completedPercent + waitingApprovePercent + inProgressPercent}%`, width: `${pendingPercent}%` }}
                />
              )}
              {data.cancelled > 0 && (
                <div
                  className="absolute h-full bg-red-700 transition-all duration-300"
                  style={{ left: `${completedPercent + waitingApprovePercent + inProgressPercent + pendingPercent}%`, width: `${cancelledPercent}%` }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {data.completed}/{data.total}
                </span>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md">
          <div className="text-sm space-y-2">
            <div className="font-medium mb-2">
              Total de ordens de {typeLabel.toLowerCase()} no grupo ({data.completed}/{data.total})
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {data.completed > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-700 rounded" />{data.completed} concluída(s)</div>}
              {data.waitingApprove > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-600 rounded" />{data.waitingApprove} aguardando aprovação</div>}
              {data.inProgress > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-700 rounded" />{data.inProgress} em andamento</div>}
              {data.pending > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-neutral-500 rounded" />{data.pending} pendente(s)</div>}
              {data.cancelled > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-700 rounded" />{data.cancelled} cancelada(s)</div>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TableRow
      className={cn(
        "cursor-pointer border-b border-border",
        "bg-muted/30 hover:bg-muted/50",
        "group",
        "transition-all duration-200 ease-in-out",
        isAnimating && "opacity-0 scale-y-0",
        !isAnimating && "opacity-100 scale-y-100"
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox column */}
      {canEdit && (
        <TableCell className="p-0 !border-r-0 w-[60px]" onClick={handleCheckboxClick}>
          <div className="flex items-center justify-center h-full w-full px-2 py-2">
            <Checkbox
              checked={isSelected}
              indeterminate={hasPartialSelection}
              onCheckedChange={handleCheckboxChange}
              aria-label={`Select ${collapsedTaskCount} collapsed tasks`}
              data-checkbox
            />
          </div>
        </TableCell>
      )}

      {/* First cell with collapse info (spans non-service-order columns) */}
      <TableCell
        colSpan={nonServiceOrderColumns.length}
        className="p-0 !border-r-0"
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Expand/collapse icon */}
          <div className="flex-shrink-0">
            <IconChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </div>

          {/* Group info text */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground font-medium">
              {collapsedTaskCount} {collapsedTaskCount === 1 ? 'tarefa oculta' : 'tarefas ocultas'}
            </span>

            {/* Selection badge */}
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedCount} selecionada{selectedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Expand hint */}
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Clique para expandir
          </span>
        </div>
      </TableCell>

      {/* Service order columns with sums */}
      {visibleServiceOrderColumns.map((column) => (
        <TableCell key={column.id} className={cn(column.cellClassName, column.className, "px-4 py-1")}>
          {renderServiceOrderCell(column.id)}
        </TableCell>
      ))}
    </TableRow>
  );
}
