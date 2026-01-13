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
  const waitingApproveCount = serviceOrders.filter(so => so.status === SO_STATUS.WAITING_APPROVE).length;
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
  const waitingApprovePercent = (waitingApproveCount / totalCount) * 100;
  const pendingPercent = (pendingCount / totalCount) * 100;
  const cancelledPercent = (cancelledCount / totalCount) * 100;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className="relative cursor-help w-full">
            {/* Progress bar container */}
            <div className="relative h-5 min-w-[90px] max-w-[140px] bg-gray-200 dark:bg-gray-700 rounded overflow-hidden shadow-sm">
              {/* Completed segment (green-700 matching badge) */}
              {completedCount > 0 && (
                <div
                  className="absolute h-full bg-green-700 transition-all duration-300"
                  style={{
                    left: '0%',
                    width: `${completedPercent}%`,
                  }}
                />
              )}

              {/* Waiting Approve segment (purple-600 matching badge) */}
              {waitingApproveCount > 0 && (
                <div
                  className="absolute h-full bg-purple-600 transition-all duration-300"
                  style={{
                    left: `${completedPercent}%`,
                    width: `${waitingApprovePercent}%`,
                  }}
                />
              )}

              {/* In Progress segment (blue-700 matching badge) */}
              {inProgressCount > 0 && (
                <div
                  className="absolute h-full bg-blue-700 transition-all duration-300"
                  style={{
                    left: `${completedPercent + waitingApprovePercent}%`,
                    width: `${inProgressPercent}%`,
                  }}
                />
              )}

              {/* Pending segment (neutral-500 matching badge) */}
              {pendingCount > 0 && (
                <div
                  className="absolute h-full bg-neutral-500 transition-all duration-300"
                  style={{
                    left: `${completedPercent + waitingApprovePercent + inProgressPercent}%`,
                    width: `${pendingPercent}%`,
                  }}
                />
              )}

              {/* Cancelled segment (red-700 matching badge) */}
              {cancelledCount > 0 && (
                <div
                  className="absolute h-full bg-red-700 transition-all duration-300"
                  style={{
                    left: `${completedPercent + waitingApprovePercent + inProgressPercent + pendingPercent}%`,
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

            {/* Red circle indicator for incomplete user-assigned orders - positioned like observation indicator */}
            {incompleteAssignedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                {incompleteAssignedCount}
              </span>
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
                <div className="w-2.5 h-2.5 rounded-full bg-green-700 ring-1 ring-green-800" />
                <span>Concluído:</span>
              </div>
              <span className="text-right font-medium">{completedCount}</span>

              {waitingApproveCount > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600 ring-1 ring-purple-700" />
                    <span>Aguardando aprovação:</span>
                  </div>
                  <span className="text-right font-medium">{waitingApproveCount}</span>
                </>
              )}

              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-700 ring-1 ring-blue-800" />
                <span>Em andamento:</span>
              </div>
              <span className="text-right font-medium">{inProgressCount}</span>

              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-500 ring-1 ring-neutral-600" />
                <span>Pendente:</span>
              </div>
              <span className="text-right font-medium">{pendingCount}</span>

              {cancelledCount > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-700 ring-1 ring-red-800" />
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
