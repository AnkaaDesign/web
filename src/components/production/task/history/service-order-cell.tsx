import { useCurrentUser } from "@/hooks/useAuth";
import type { Task } from "@/types";
import type { SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from "@/constants";
import { SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS as SO_STATUS } from "@/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceOrderCellProps {
  task: Task;
  serviceOrderType: SERVICE_ORDER_TYPE;
}

export function ServiceOrderCell({ task, serviceOrderType }: ServiceOrderCellProps) {
  const { data: currentUser } = useCurrentUser();

  // Filter service orders by the specified type
  const serviceOrders = task.services?.filter(
    (serviceOrder) => serviceOrder.type === serviceOrderType
  ) || [];

  // Total count of service orders of this type
  const totalCount = serviceOrders.length;

  // Count by status
  const completedCount = serviceOrders.filter(so => so.status === SO_STATUS.COMPLETED).length;
  const inProgressCount = serviceOrders.filter(so => so.status === SO_STATUS.IN_PROGRESS).length;
  const cancelledCount = serviceOrders.filter(so => so.status === SO_STATUS.CANCELLED).length;
  const pendingCount = serviceOrders.filter(so => so.status === SO_STATUS.PENDING).length;

  // Count incomplete (not completed/cancelled) orders assigned to current user
  const incompleteAssignedCount = serviceOrders.filter(
    (serviceOrder) =>
      serviceOrder.assignedToId === currentUser?.id &&
      serviceOrder.status !== SO_STATUS.COMPLETED &&
      serviceOrder.status !== SO_STATUS.CANCELLED
  ).length;

  // If no service orders of this type, show dash
  if (totalCount === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const typeLabel = SERVICE_ORDER_TYPE_LABELS[serviceOrderType];

  // Calculate percentages for progress bar
  const completedPercent = (completedCount / totalCount) * 100;
  const inProgressPercent = (inProgressCount / totalCount) * 100;
  const pendingPercent = (pendingCount / totalCount) * 100;
  const cancelledPercent = (cancelledCount / totalCount) * 100;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-help w-full">
            {/* Progress bar container */}
            <div className="relative flex-1 h-5 min-w-[90px] max-w-[140px] bg-gray-100 dark:bg-gray-700 rounded overflow-hidden shadow-sm">
              {/* Completed segment (green) */}
              {completedCount > 0 && (
                <div
                  className="absolute h-full bg-green-500 transition-all duration-300"
                  style={{
                    left: '0%',
                    width: `${completedPercent}%`,
                  }}
                />
              )}

              {/* In Progress segment (blue) */}
              {inProgressCount > 0 && (
                <div
                  className="absolute h-full bg-blue-500 transition-all duration-300"
                  style={{
                    left: `${completedPercent}%`,
                    width: `${inProgressPercent}%`,
                  }}
                />
              )}

              {/* Pending segment (amber) */}
              {pendingCount > 0 && (
                <div
                  className="absolute h-full bg-amber-500 transition-all duration-300"
                  style={{
                    left: `${completedPercent + inProgressPercent}%`,
                    width: `${pendingPercent}%`,
                  }}
                />
              )}

              {/* Cancelled segment (gray) */}
              {cancelledCount > 0 && (
                <div
                  className="absolute h-full bg-gray-400 transition-all duration-300"
                  style={{
                    left: `${completedPercent + inProgressPercent + pendingPercent}%`,
                    width: `${cancelledPercent}%`,
                  }}
                />
              )}

              {/* Count label centered */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {completedCount}/{totalCount}
                </span>
              </div>
            </div>

            {/* Red circle indicator for incomplete user-assigned orders */}
            {incompleteAssignedCount > 0 && (
              <div className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                <span className="text-[9px] font-bold text-white">
                  {incompleteAssignedCount}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm space-y-1">
            <div className="font-medium mb-2">
              Ordens de serviço de {typeLabel.toLowerCase()}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-1 ring-green-600" />
                <span>Concluído:</span>
              </div>
              <span className="text-right font-medium">{completedCount}</span>

              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600" />
                <span>Em andamento:</span>
              </div>
              <span className="text-right font-medium">{inProgressCount}</span>

              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-600" />
                <span>Pendente:</span>
              </div>
              <span className="text-right font-medium">{pendingCount}</span>

              {cancelledCount > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 ring-1 ring-gray-600" />
                    <span>Cancelado:</span>
                  </div>
                  <span className="text-right font-medium">{cancelledCount}</span>
                </>
              )}
            </div>
            {incompleteAssignedCount > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-red-500 font-medium">
                  <div className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">{incompleteAssignedCount}</span>
                  </div>
                  <span className="text-xs">Atribuída(s) a você (incompleta)</span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
  );
}
