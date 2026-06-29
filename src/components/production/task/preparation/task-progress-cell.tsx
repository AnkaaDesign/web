import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS_LABELS } from "@/constants";
import { getServiceOrderStatusColor } from "@/utils/serviceOrder";
import type { Task } from "@/types";

// Status segments, left→right, mirroring the status-badge palette (WAITING_* are both purple).
// A running offset keeps the segments contiguous so no status falls through to the gray track.
const SEGMENTS: { status: SERVICE_ORDER_STATUS; className: string; label: string }[] = [
  { status: SERVICE_ORDER_STATUS.COMPLETED, className: "bg-green-700", label: "concluída(s)" },
  { status: SERVICE_ORDER_STATUS.WAITING_APPROVE, className: "bg-purple-600", label: "aguardando aprovação" },
  { status: SERVICE_ORDER_STATUS.WAITING_ARTWORK, className: "bg-purple-600", label: "aguardando arte" },
  { status: SERVICE_ORDER_STATUS.IN_PROGRESS, className: "bg-blue-700", label: "em andamento" },
  { status: SERVICE_ORDER_STATUS.PAUSED, className: "bg-yellow-500", label: "pausada(s)" },
  { status: SERVICE_ORDER_STATUS.PENDING, className: "bg-neutral-500", label: "pendente(s)" },
  { status: SERVICE_ORDER_STATUS.CANCELLED, className: "bg-red-700", label: "cancelada(s)" },
];

type SO = NonNullable<Task["serviceOrders"]>[number];

/** "Outros" service orders display their free-text observation instead of the literal "Outros". */
function soLabel(so: SO): string {
  if (so.description === "Outros" && so.observation) return so.observation;
  return so.description || "Sem descrição";
}

/**
 * One stacked service-order progress bar for a given type, aggregated over `tasks` — pass a single
 * task for a normal row, or a whole name-cluster for a collapsed parent row. Shows `completed/total`.
 * Hovering lists the individual service orders (description + status), like the legacy table.
 */
export function TaskProgressCell({
  tasks,
  type,
  currentUserId,
}: {
  tasks: Task[];
  type: SERVICE_ORDER_TYPE;
  currentUserId?: string;
}) {
  const { orders, byStatus, total, completed, pendingAssigned } = useMemo(() => {
    const orders: SO[] = [];
    const byStatus = new Map<SERVICE_ORDER_STATUS, number>();
    let pendingAssigned = 0;
    for (const task of tasks) {
      for (const so of task.serviceOrders ?? []) {
        if (so.type !== type || !so.status) continue;
        orders.push(so);
        byStatus.set(so.status, (byStatus.get(so.status) ?? 0) + 1);
        if (currentUserId && so.assignedToId === currentUserId && so.status === SERVICE_ORDER_STATUS.PENDING) {
          pendingAssigned++;
        }
      }
    }
    return { orders, byStatus, total: orders.length, completed: byStatus.get(SERVICE_ORDER_STATUS.COMPLETED) ?? 0, pendingAssigned };
  }, [tasks, type, currentUserId]);

  const typeLabel = SERVICE_ORDER_TYPE_LABELS[type];

  // No service order of this type — clean muted dash, the "missing" detail lives in the tooltip.
  if (total === 0) {
    return (
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <span className="cursor-help text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-sm">Nenhuma ordem de serviço de {typeLabel.toLowerCase()}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  let acc = 0;
  const segs = SEGMENTS.map((s) => {
    const count = byStatus.get(s.status) ?? 0;
    const left = acc;
    const width = (count / total) * 100;
    acc += width;
    return { ...s, count, left, width };
  }).filter((s) => s.count > 0);

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <div className="relative h-5 w-full min-w-0 max-w-[140px] cursor-help overflow-visible">
          <div className="relative h-full w-full overflow-hidden rounded bg-gray-200 shadow-sm dark:bg-gray-700">
            {segs.map((s) => (
              <div
                key={s.status}
                className={`absolute h-full ${s.className} transition-all duration-300`}
                style={{ left: `${s.left}%`, width: `${s.width}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {completed}/{total}
              </span>
            </div>
          </div>
          {pendingAssigned > 0 && (
            <span className="absolute -right-1.5 -top-1.5 z-10 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-1 ring-background">
              {pendingAssigned}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md">
        <div className="space-y-2 text-sm">
          <div className="font-medium">
            Ordens de {typeLabel.toLowerCase()} ({completed}/{total})
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {orders.map((so, i) => (
              <div key={so.id || i} className="flex items-start justify-between gap-2 border-b border-border/30 py-1 last:border-0">
                <span className="flex-1 break-words text-xs">{soLabel(so)}</span>
                {/* orders only ever holds non-null statuses (filtered in the aggregation loop). */}
                <Badge variant={getServiceOrderStatusColor(so.status!)} className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
                  {SERVICE_ORDER_STATUS_LABELS[so.status!]}
                </Badge>
              </div>
            ))}
          </div>
          {pendingAssigned > 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-2 text-xs font-medium text-red-500">
              <span className="flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white">
                {pendingAssigned}
              </span>
              Atribuída(s) a você (pendente)
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
