import { useEffect, useState } from "react";
import { IconCalendarPlus, IconLoader2 } from "@tabler/icons-react";

import { MEDICAL_EXAM_TYPE, MEDICAL_EXAM_TYPE_LABELS } from "../../../../constants";
import { useMedicalExamMutations } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface ScheduleNextExamDialogProps {
  exam: MedicalExam | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

export function ScheduleNextExamDialog({ exam, open, onOpenChange, onScheduled }: ScheduleNextExamDialogProps) {
  const { createAsync, createMutation } = useMedicalExamMutations();
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  const isSubmitting = createMutation.isPending;

  // Reset date when the dialog opens for a (new) exam
  useEffect(() => {
    if (open) {
      setScheduledAt(null);
    }
  }, [open, exam?.id]);

  const handleSchedule = async () => {
    if (!exam || !scheduledAt) return;

    try {
      await createAsync({
        userId: exam.userId,
        type: MEDICAL_EXAM_TYPE.PERIODIC,
        scheduledAt,
      } as any);
      onOpenChange(false);
      onScheduled?.();
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error scheduling next medical exam:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendarPlus className="h-5 w-5 text-muted-foreground" />
            Agendar Próximo Exame
          </DialogTitle>
          <DialogDescription>Agende o próximo exame periódico do colaborador. Um novo exame será criado com status "Agendado".</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Input value={exam?.user?.name || ""} disabled readOnly />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Exame</Label>
            <Input value={MEDICAL_EXAM_TYPE_LABELS[MEDICAL_EXAM_TYPE.PERIODIC]} disabled readOnly />
          </div>

          <DateTimeInput
            mode="date"
            context="scheduled"
            label="Agendado para"
            value={scheduledAt}
            onChange={(date) => setScheduledAt(date instanceof Date ? date : null)}
            disabled={isSubmitting}
            required
            placeholder="Selecionar data..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSchedule} disabled={isSubmitting || !scheduledAt}>
            {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCalendarPlus className="h-4 w-4 mr-2" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
