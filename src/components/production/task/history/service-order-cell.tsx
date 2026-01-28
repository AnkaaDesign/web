import { useCurrentUser } from "@/hooks/useAuth";
import type { Task } from "@/types";
import type { SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from "@/constants";
import { SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS as SO_STATUS, SERVICE_ORDER_STATUS_LABELS } from "@/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { getServiceOrderStatusColor } from "@/utils/serviceOrder";
import { IconAlertTriangle } from "@tabler/icons-react";

interface ServiceOrderCellProps {
  task: Task;
  serviceOrderType: SERVICE_ORDER_TYPE;
  navigationRoute?: 'history' | 'preparation' | 'schedule';
}

export function ServiceOrderCell({ task, serviceOrderType, navigationRoute }: ServiceOrderCellProps) {
  const { data: currentUser } = useCurrentUser();

  // Filter service orders by the specified type
  const serviceOrders = task.serviceOrders?.filter(
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

  // Count pending orders assigned to current user - this takes priority over other indicators
  const pendingAssignedCount = serviceOrders.filter(
    (serviceOrder) =>
      serviceOrder.assignedToId === currentUser?.id &&
      serviceOrder.status === SO_STATUS.PENDING
  ).length;

  const typeLabel = SERVICE_ORDER_TYPE_LABELS[serviceOrderType];

  // PRIORITY: If user has pending orders assigned to them, show only that indicator
  // This takes precedence over "missing service order" and other conditions
  const hasPendingAssignedOrders = pendingAssignedCount > 0;

  // If no service orders of this type, show dash with red corner indicator for preparation route
  // BUT only if the user doesn't have pending assigned orders (which takes priority)
  if (totalCount === 0) {
    if (navigationRoute === 'preparation' && !hasPendingAssignedOrders) {
      return (
        <>
          <span className="text-muted-foreground">-</span>
          {/* Red corner triangle indicator for missing service orders - positioned flush with cell corner */}
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-red-500 pointer-events-auto cursor-help">
                <IconAlertTriangle className="absolute -top-[25px] right-[2px] h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="text-sm">
                <div className="font-medium text-red-500">Ordem de serviço ausente</div>
                <div className="text-muted-foreground">Esta tarefa não possui nenhuma ordem de serviço de {typeLabel.toLowerCase()}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </>
      );
    }
    return <span className="text-muted-foreground">-</span>;
  }

  // Calculate percentages for progress bar
  const completedPercent = (completedCount / totalCount) * 100;
  const inProgressPercent = (inProgressCount / totalCount) * 100;
  const waitingApprovePercent = (waitingApproveCount / totalCount) * 100;
  const pendingPercent = (pendingCount / totalCount) * 100;
  const cancelledPercent = (cancelledCount / totalCount) * 100;

  return (
    <>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div className="relative cursor-help">
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
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-md">
          <div className="text-sm space-y-2">
            <div className="font-medium mb-2">
              Ordens de serviço de {typeLabel.toLowerCase()} ({completedCount}/{totalCount})
            </div>

            {/* List of service orders with their statuses */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {serviceOrders.map((serviceOrder, index) => (
                <div key={serviceOrder.id || index} className="flex items-start justify-between gap-2 py-1 border-b border-border/30 last:border-0">
                  <span className="text-xs flex-1 break-words">
                    {serviceOrder.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                  </span>
                  <Badge
                    variant={getServiceOrderStatusColor(serviceOrder.status)}
                    className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                  >
                    {SERVICE_ORDER_STATUS_LABELS[serviceOrder.status]}
                  </Badge>
                </div>
              ))}
            </div>

            {pendingAssignedCount > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-red-500 font-medium">
                  <div className="w-0 h-0 border-t-[14px] border-l-[14px] border-l-transparent border-t-red-500 flex items-center justify-center relative">
                    <span className="absolute -top-[11px] right-[1.5px] text-[8px] text-white font-bold">{pendingAssignedCount}</span>
                  </div>
                  <span className="text-xs">Atribuída(s) a você (pendente)</span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Red corner triangle indicator for pending user-assigned orders */}
      {pendingAssignedCount > 0 && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 z-[5] w-0 h-0 border-t-[28px] border-l-[28px] border-l-transparent border-t-red-500 pointer-events-auto cursor-help">
              <span className="absolute -top-[25px] right-[2px] h-3 w-3 flex items-center justify-center text-[11px] font-bold text-white leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                {pendingAssignedCount}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium text-red-500">Ordens pendentes atribuídas</div>
              <div className="text-muted-foreground">
                Você possui {pendingAssignedCount} {pendingAssignedCount === 1 ? 'ordem de serviço pendente' : 'ordens de serviço pendentes'} de {typeLabel.toLowerCase()}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
