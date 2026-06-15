import { IconClipboardCheck } from "@tabler/icons-react";

import type { MedicalExam } from "@/types/medical-exam";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedicalExamCompleteForm } from "./medical-exam-complete-form";

interface MedicalExamCompleteDialogProps {
  exam: MedicalExam | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function MedicalExamCompleteDialog({ exam, open, onOpenChange, onCompleted }: MedicalExamCompleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-muted-foreground" />
            Concluir Exame
          </DialogTitle>
          <DialogDescription>
            Registre o resultado do exame{exam?.user?.name ? ` de ${exam.user.name}` : ""}. O exame será marcado como realizado.
          </DialogDescription>
        </DialogHeader>

        {/* Remount per exam/open so the form resets to fresh defaults each time. */}
        {open && (
          <MedicalExamCompleteForm
            key={exam?.id ?? "none"}
            exam={exam}
            onCompleted={() => {
              onOpenChange(false);
              onCompleted?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
