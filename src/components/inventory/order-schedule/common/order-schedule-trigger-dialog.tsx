import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils";
import { useOrderScheduleProjection, useTriggerOrderSchedule } from "@/hooks";
import { routes } from "@/constants";
import type { OrderSchedule, OrderScheduleCascadeMode } from "@/types";

interface OrderScheduleTriggerDialogProps {
  /** The schedule to execute. When null the dialog stays closed. */
  schedule: OrderSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful trigger (e.g. to refetch a list/detail). */
  onTriggered?: () => void;
}

/**
 * Shared "Executar agora" dialog for an order schedule — identical behavior whether
 * launched from the schedule detail page or the list right-click menu. Fetches the
 * trigger projection, lets the user choose the coverage window (gap-only vs gap+cycle),
 * triggers, and navigates to the created order.
 */
export function OrderScheduleTriggerDialog({
  schedule,
  open,
  onOpenChange,
  onTriggered,
}: OrderScheduleTriggerDialogProps) {
  const navigate = useNavigate();
  const [cascadeMode, setCascadeMode] = useState<OrderScheduleCascadeMode>("GAP_ONLY");
  const triggerSchedule = useTriggerOrderSchedule();

  const { data: projectionResponse } = useOrderScheduleProjection(schedule?.id ?? "", {
    enabled: open && !!schedule?.id,
  });
  const projection = projectionResponse?.data;
  const projectionMeta = projection?.meta;

  const isFinished = !!schedule?.finishedAt;
  const canTrigger = !!schedule?.isActive && !isFinished;
  const triggerDisabledHint = isFinished
    ? "Este agendamento já foi finalizado."
    : !schedule?.isActive
      ? "Ative o agendamento para poder executá-lo."
      : null;

  const gapDays = projectionMeta?.gapDays ?? 0;
  const intervalDays = projectionMeta?.intervalDays ?? null;
  const hasGapOption = gapDays > 0;

  // When the dialog opens (and the projection resolves), default the mode the same way
  // the detail page does: bridge-only when there's a gap, otherwise the full cycle.
  useEffect(() => {
    if (open) {
      setCascadeMode((projectionMeta?.gapDays ?? 0) > 0 ? "GAP_ONLY" : "GAP_PLUS_CYCLE");
    }
  }, [open, projectionMeta?.gapDays]);

  const handleConfirm = () => {
    if (!schedule || !canTrigger) return;
    triggerSchedule.mutate(
      { id: schedule.id, cascadeMode },
      {
        onSuccess: (response) => {
          onOpenChange(false);
          if (response.data?.order?.id) {
            toast.success("Pedido criado a partir do agendamento.");
            navigate(routes.inventory.orders.details(response.data.order.id));
          } else {
            toast.info("Nenhum item precisava ser pedido no momento.");
            onTriggered?.();
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Executar agendamento agora</DialogTitle>
          <DialogDescription>
            Escolha quanto este pedido deve cobrir. O agendamento permanece configurado normalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={cascadeMode} onValueChange={(value) => setCascadeMode(value as OrderScheduleCascadeMode)}>
            {hasGapOption && (
              <label
                htmlFor="cascade-gap-only"
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30",
                  cascadeMode === "GAP_ONLY" && "border-primary bg-muted/30",
                )}
              >
                <RadioGroupItem value="GAP_ONLY" id="cascade-gap-only" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Cobrir apenas até a próxima execução
                    <span className="ml-1 text-muted-foreground">({gapDays} dias)</span>
                  </p>
                  <p className="text-xs text-muted-foreground">o agendamento ainda executa na data prevista</p>
                  {projectionMeta && (
                    <p className="text-xs font-medium text-foreground">Total: {formatCurrency(projectionMeta.gapOnlyTotal)}</p>
                  )}
                </div>
              </label>
            )}

            <label
              htmlFor="cascade-gap-cycle"
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30",
                cascadeMode === "GAP_PLUS_CYCLE" && "border-primary bg-muted/30",
              )}
            >
              <RadioGroupItem value="GAP_PLUS_CYCLE" id="cascade-gap-cycle" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Cobrir até a próxima execução + ciclo completo
                  <span className="ml-1 text-muted-foreground">
                    ({gapDays}{intervalDays != null ? ` + ${intervalDays}` : ""} dias)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">a próxima execução é adiada um ciclo</p>
                {projectionMeta && (
                  <p className="text-xs font-medium text-foreground">Total: {formatCurrency(projectionMeta.gapPlusCycleTotal)}</p>
                )}
              </div>
            </label>
          </RadioGroup>

          {projectionMeta?.scheduledDate && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Execução prevista</span>
                <span className="font-medium text-foreground">{formatDate(new Date(projectionMeta.scheduledDate))}</span>
              </div>
            </div>
          )}
        </div>

        {!canTrigger && triggerDisabledHint && (
          <p className="text-xs text-muted-foreground">{triggerDisabledHint}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={triggerSchedule.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={triggerSchedule.isPending || !canTrigger}>
            {triggerSchedule.isPending ? "Executando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
