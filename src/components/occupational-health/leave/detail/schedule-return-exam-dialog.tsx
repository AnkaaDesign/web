import { useEffect, useState } from "react";
import { IconStethoscope, IconLoader2 } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { MEDICAL_EXAM_TYPE, MEDICAL_EXAM_STATUS } from "../../../../constants";
import { useMedicalExamMutations } from "../../../../hooks/occupational-health/use-medical-exams";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Label } from "@/components/ui/label";

interface ScheduleReturnExamDialogProps {
  leave: Leave;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleReturnExamDialog({ leave, open, onOpenChange }: ScheduleReturnExamDialogProps) {
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const { createAsync, isCreating } = useMedicalExamMutations();

  // Reset the date whenever the dialog opens
  useEffect(() => {
    if (open) {
      setScheduledAt(leave.actualEndDate ? new Date(leave.actualEndDate) : new Date());
    }
  }, [open, leave.actualEndDate]);

  const handleConfirm = async () => {
    if (!scheduledAt) return;

    try {
      await createAsync({
        userId: leave.userId,
        type: MEDICAL_EXAM_TYPE.RETURN_TO_WORK,
        status: MEDICAL_EXAM_STATUS.SCHEDULED,
        scheduledAt,
      } as any);
      onOpenChange(false);
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error scheduling return exam:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconStethoscope className="h-5 w-5" />
            Agendar Exame de Retorno
          </DialogTitle>
          <DialogDescription>
            Agende o exame de retorno ao trabalho{leave.user?.name ? ` do colaborador "${leave.user.name}"` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="mb-2 block">
            Data do Exame <span className="text-destructive">*</span>
          </Label>
          <DateTimeInput
            mode="date"
            value={scheduledAt ?? undefined}
            onChange={(date) => setScheduledAt(date instanceof Date ? date : null)}
            hideLabel
            placeholder="Selecionar data do exame..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!scheduledAt || isCreating}>
            {isCreating ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconStethoscope className="h-4 w-4 mr-2" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
