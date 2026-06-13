import { useEffect, useState } from "react";
import { IconCalendarCheck, IconLoader2 } from "@tabler/icons-react";

import type { Leave } from "../../../types/leave";
import { useFinishLeave } from "../../../hooks/occupational-health/use-leaves";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Label } from "@/components/ui/label";

interface FinishLeaveDialogProps {
  leave: Leave | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}

export function FinishLeaveDialog({ leave, open, onOpenChange, onFinished }: FinishLeaveDialogProps) {
  const [actualEndDate, setActualEndDate] = useState<Date | null>(new Date());
  const finishLeave = useFinishLeave();

  // Reset the date whenever the dialog opens
  useEffect(() => {
    if (open) {
      setActualEndDate(new Date());
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!leave || !actualEndDate) return;

    try {
      await finishLeave.mutateAsync({ id: leave.id, actualEndDate });
      onOpenChange(false);
      onFinished?.();
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error finishing leave:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendarCheck className="h-5 w-5" />
            Finalizar Afastamento
          </DialogTitle>
          <DialogDescription>
            Informe a data de retorno efetiva{leave?.user?.name ? ` do colaborador "${leave.user.name}"` : ""}. O afastamento será marcado como concluído.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="mb-2 block">
            Data de Retorno Efetiva <span className="text-destructive">*</span>
          </Label>
          <DateTimeInput
            mode="date"
            value={actualEndDate ?? undefined}
            onChange={(date) => setActualEndDate(date instanceof Date ? date : null)}
            hideLabel
            placeholder="Selecionar data de retorno..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={finishLeave.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!actualEndDate || finishLeave.isPending}>
            {finishLeave.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCalendarCheck className="h-4 w-4 mr-2" />}
            Finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
