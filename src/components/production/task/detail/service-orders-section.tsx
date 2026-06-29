import { useEffect, useRef, useState } from "react";
import { IconCheck, IconClock, IconHourglass, IconNote, IconUser } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { enumBadge, enumTriggerClass } from "@/components/ui/detailpage";
import type { EnumEditConfig } from "@/components/ui/detailpage";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useServiceOrderMutations } from "@/hooks/production/use-service-order";
import { canCancelServiceOrder, canEditServiceOrder } from "@/utils/permissions/service-order-permissions";
import { formatActiveTime, getServiceOrderTotalActiveTimeSeconds } from "@/utils/serviceOrder";
import { formatDateTime } from "@/utils/date";
import { SECTOR_PRIVILEGES, SERVICE_ORDER_STATUS, SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE } from "@/constants";
import type { Task } from "@/types";

type ServiceOrderRow = NonNullable<Task["serviceOrders"]>[number];

const SO_ENUM: EnumEditConfig = { values: Object.values(SERVICE_ORDER_STATUS), labels: SERVICE_ORDER_STATUS_LABELS, badgeEntity: "SERVICE_ORDER" };

// A click is "outside" only when it's neither in the editor nor in the combobox's portal dropdown.
const PORTAL_SELECTOR = '[data-radix-popper-content-wrapper],[data-radix-popover-content],[role="listbox"],[cmdk-root]';

/**
 * Status state machine — faithful port of the legacy schedule-detail control.
 * Options are keyed off the SO's CURRENT status (+ the viewer's role and the SO type):
 * the current state keeps its noun label, every transition is an action verb.
 * `isAutoCompletingTask` = a COMMERCIAL "Em Negociação" SO that auto-completes when the
 * quote is approved, so manual "Concluir" is never offered.
 */
function getStatusOptions(so: ServiceOrderRow, type: SERVICE_ORDER_TYPE, role: string): ComboboxOption[] {
  const isArtworkServiceOrder = type === SERVICE_ORDER_TYPE.ARTWORK;
  const isDesignerUser = role === SECTOR_PRIVILEGES.DESIGNER;
  const isAdminUser = role === SECTOR_PRIVILEGES.ADMIN;
  const currentSOStatus = so.status as SERVICE_ORDER_STATUS | null;
  const isAutoCompletingTask = type === SERVICE_ORDER_TYPE.COMMERCIAL && so.description === "Em Negociação";
  const canCancel = canCancelServiceOrder(role as SECTOR_PRIVILEGES);

  const options: ComboboxOption[] = [];

  if (currentSOStatus === SERVICE_ORDER_STATUS.PENDING) {
    // Pendente → only Iniciar. Admin can Cancelar.
    options.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Pendente" }, { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Iniciar" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.IN_PROGRESS) {
    // Em Andamento → Pausar, (artwork) Enviar para Aprovação, Concluir, Voltar (admin), Cancelar.
    options.push({ value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Em Andamento" }, { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausar" });
    if (isArtworkServiceOrder) options.push({ value: SERVICE_ORDER_STATUS.WAITING_APPROVE, label: "Enviar para Aprovação" });
    if (!(isArtworkServiceOrder && isDesignerUser) && !isAutoCompletingTask) options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Voltar para Pendente" });
    if (canCancel) options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.PAUSED) {
    // Pausado → Continuar (resume), Concluir, Voltar (admin), Cancelar.
    options.push({ value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausado" }, { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Continuar" });
    if (!isAutoCompletingTask) options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Voltar para Pendente" });
    if (canCancel) options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.WAITING_ARTWORK) {
    // Aguardando Arte → Pausar, Concluir, Voltar (admin), Cancelar.
    options.push({ value: SERVICE_ORDER_STATUS.WAITING_ARTWORK, label: "Aguardando Arte" }, { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausar" });
    if (!isAutoCompletingTask) options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Voltar para Pendente" });
    if (canCancel) options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.WAITING_APPROVE) {
    // Aguardando Aprovação → Admin: Aprovar/Reprovar. Designer: Retirar Envio. Others: Aprovar.
    options.push({ value: SERVICE_ORDER_STATUS.WAITING_APPROVE, label: "Aguardando Aprovação" });
    if (isAdminUser) {
      options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Aprovar" }, { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Reprovar" });
    } else if (!isDesignerUser) {
      options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Aprovar" });
    } else {
      options.push({ value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Retirar Envio" });
    }
    if (canCancel) options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.COMPLETED) {
    // Concluído → terminal. Admin can Reabrir.
    options.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluído" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Reabrir" });
  } else if (currentSOStatus === SERVICE_ORDER_STATUS.CANCELLED) {
    // Cancelado → terminal. Admin can Restaurar.
    options.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelado" });
    if (isAdminUser) options.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Restaurar" });
  } else {
    // Fallback (no/unknown status).
    options.push(
      { value: SERVICE_ORDER_STATUS.PENDING, label: "Pendente" },
      { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Iniciar" },
      { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausar" },
      { value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" },
    );
  }

  return options;
}

/** Status shows as a colored badge (like the task-status field); DOUBLE-click to edit → combobox. */
function SoStatusControl({ so, editable, options }: { so: ServiceOrderRow; editable: boolean; options: ComboboxOption[] }) {
  const { updateAsync } = useServiceOrderMutations();
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || ref.current?.contains(t) || t.closest?.(PORTAL_SELECTOR)) return;
      setEditing(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [editing]);

  if (!editable) return <>{enumBadge(so.status, SO_ENUM)}</>;

  if (!editing) {
    return (
      <div onDoubleClick={() => setEditing(true)} className="cursor-pointer select-none" title="Duplo clique para alterar o status">
        {enumBadge(so.status, SO_ENUM)}
      </div>
    );
  }

  return (
    <div ref={ref} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
      <Combobox
        value={so.status ?? undefined}
        mode="single"
        clearable={false}
        searchable={false}
        defaultOpen
        options={options}
        className="h-7 w-[12rem]"
        triggerClassName={enumTriggerClass(so.status, SO_ENUM)}
        onValueChange={async (v) => {
          if (typeof v !== "string" || v === so.status) {
            setEditing(false);
            return;
          }
          const data: Record<string, unknown> = { status: v };
          // Keep the timestamps consistent with the new status — forward moves SET, reverse moves CLEAR.
          if (v === SERVICE_ORDER_STATUS.PENDING) {
            // Back to the start → clear both timestamps.
            data.startedAt = null;
            data.finishedAt = null;
          } else if (v === SERVICE_ORDER_STATUS.IN_PROGRESS) {
            // (Re)started / reopened → ensure a start time, always clear any finish time.
            if (!so.startedAt) data.startedAt = new Date();
            data.finishedAt = null;
          } else if (v === SERVICE_ORDER_STATUS.COMPLETED) {
            // Completed → stamp finish (and backfill start if it was never set).
            if (!so.startedAt) data.startedAt = new Date();
            data.finishedAt = new Date();
          }
          setEditing(false);
          try {
            // The api client surfaces success/error notifications itself.
            await updateAsync({ id: so.id, data: data as never });
          } catch {
            // already surfaced by the api client.
          }
        }}
      />
    </div>
  );
}

/** One service-order TYPE's orders (a section per type on the detail page). */
export function TaskServiceOrderGroup({ task, type, role, currentUserId }: { task: Task; type: SERVICE_ORDER_TYPE; role: string; currentUserId?: string }) {
  const orders = (task.serviceOrders ?? []).filter((so) => {
    if (so.type !== type) return false;
    // Legacy rule: hide cancelled PRODUCTION orders from PRODUCTION/WAREHOUSE sectors.
    if (
      so.type === SERVICE_ORDER_TYPE.PRODUCTION &&
      so.status === SERVICE_ORDER_STATUS.CANCELLED &&
      (role === SECTOR_PRIVILEGES.PRODUCTION || role === SECTOR_PRIVILEGES.WAREHOUSE)
    ) {
      return false;
    }
    return true;
  });
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>;

  // Rows mirror the DetailRow pattern used by every other section (rounded bg-muted/50 rows).
  return (
    <div className="space-y-2">
      {orders.map((so) => {
        // Per-SO editability: sector + type + assignment gate (not type-only).
        const editable = canEditServiceOrder(role as SECTOR_PRIVILEGES, type, so.assignedToId, currentUserId);
        // "Outros" SOs render their free-text observation as the title; other SOs keep description + a note indicator.
        const isOutrosWithObservation = so.description === "Outros" && !!so.observation;
        const displayDescription = isOutrosWithObservation ? so.observation : so.description;
        const totalSec = getServiceOrderTotalActiveTimeSeconds(so);
        return (
          <div key={so.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-semibold">{displayDescription || "—"}</h4>
                {!isOutrosWithObservation && so.observation && (
                  <HoverCard openDelay={100} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button className="relative flex items-center justify-center h-6 w-6 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                        <IconNote className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">!</span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72 p-3" side="top">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <IconNote className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Observação</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{so.observation}</p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>

              {so.assignedTo?.name && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconUser className="h-3 w-3" />
                  <span>Responsável: {so.assignedTo.name}</span>
                </div>
              )}

              {(so.startedAt || so.finishedAt || totalSec > 0) && (
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {so.startedAt && (
                    <div className="flex items-center gap-1">
                      <IconClock className="h-3 w-3" />
                      <span>Iniciado: {formatDateTime(so.startedAt)}</span>
                    </div>
                  )}
                  {so.finishedAt && (
                    <div className="flex items-center gap-1">
                      <IconCheck className="h-3 w-3 text-green-600" />
                      <span>Finalizado: {formatDateTime(so.finishedAt)}</span>
                    </div>
                  )}
                  {totalSec > 0 && (
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <IconHourglass className="h-3 w-3" />
                      <span>Ativo: {formatActiveTime(totalSec)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="shrink-0">
              <SoStatusControl so={so} editable={editable} options={getStatusOptions(so, type, role)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
