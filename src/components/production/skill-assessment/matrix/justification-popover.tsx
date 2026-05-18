// components/production/skill-assessment/matrix/justification-popover.tsx
//
// Per-cell justification popover. Trigger is an icon button on the row;
// content is a textarea + Save. Save commits to the parent which then
// fires the upsert mutation (along with the current score).

import { useEffect, useState } from "react";
import { IconAlertCircle, IconCheck, IconNote } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface JustificationPopoverProps {
  value: string;
  required: boolean;
  disabled?: boolean;
  onSave: (next: string) => void;
}

export function JustificationPopover({ value, required, disabled, onSave }: JustificationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  const missing = required && !value.trim();
  const hasValue = !!value.trim();

  const handleSave = () => {
    onSave(draft.trim());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={hasValue ? "Editar justificativa" : "Adicionar justificativa"}
          className={cn(
            "h-7 w-7",
            missing && "text-amber-600",
            hasValue && !missing && "text-emerald-600",
          )}
        >
          {missing ? (
            <IconAlertCircle className="h-4 w-4" />
          ) : hasValue ? (
            <IconCheck className="h-4 w-4" />
          ) : (
            <IconNote className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Justificativa</span>
            {required && <span className="text-xs text-amber-600">(obrigatória)</span>}
          </div>
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Comente o porquê desta nota..."
            rows={4}
            className="resize-none text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
