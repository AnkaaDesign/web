// components/production/skill-assessment/justification-sheet.tsx
//
// Bottom sheet to capture justification text for a single topic response.
// Auto-opens when the selected score is <= 2 (since those scores are
// "critical/concerning" and the API/UX flow treats a justification as required
// in that case).

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";

interface JustificationSheetProps {
  open: boolean;
  topicTitle: string;
  score: number | null;
  required: boolean;
  initialValue: string;
  disabled?: boolean;
  /** Label for the note (defaults to "Justificativa"; "Comentário" for questionnaires). */
  label?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (value: string) => void;
}

export function JustificationSheet({
  open,
  topicTitle,
  score,
  required,
  initialValue,
  disabled,
  label = "Justificativa",
  onOpenChange,
  onSave,
}: JustificationSheetProps) {
  const [value, setValue] = useState(initialValue);

  // Keep the textarea in sync when the sheet re-opens for a different topic.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const handleSave = () => {
    onSave(value);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            {required && <IconAlertTriangle className="h-5 w-5 text-amber-500" />}
            {label}
            {score !== null && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium">
                Nota {score}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            <span className="font-medium text-foreground">{topicTitle}</span>
            {required && (
              <span className="mt-1 block text-amber-700 dark:text-amber-400">
                Notas iguais ou inferiores a 2 exigem justificativa para o envio.
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder="Descreva contexto, observações ou exemplos que sustentem a nota selecionada…"
            className="min-h-[180px] resize-y"
            autoFocus
          />
        </div>
        <SheetFooter className="flex-row justify-end gap-2 sm:justify-end">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={disabled}>
            Salvar justificativa
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
