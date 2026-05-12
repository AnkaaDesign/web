// Per-widget configuration dialog. Renders the widget's custom ConfigComponent
// if provided; otherwise auto-generates a form from configSchema via DynamicFormField.
//
// Validation: the form's draft state is parsed with the widget's Zod schema on
// submit. Invalid configs surface inline error messages and block save.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { DynamicFormField } from "./dynamic-form-field";
import { widgetRegistry } from "../registry";
import { SectionGroup } from "../widgets/_shared";
import type { WidgetInstance } from "../types";

interface ConfigureWidgetModalProps {
  instance: WidgetInstance | null;
  onClose: () => void;
  onSave: (instanceId: string, config: unknown) => void;
}

export function ConfigureWidgetModal({ instance, onClose, onSave }: ConfigureWidgetModalProps) {
  const def = instance ? widgetRegistry.get(instance.widgetId) : undefined;
  const [draft, setDraft] = useState<unknown>(instance?.config ?? def?.defaultConfig ?? {});
  const [error, setError] = useState<string | null>(null);

  // Reset local draft whenever a different widget instance is opened.
  useEffect(() => {
    if (instance) {
      setDraft(instance.config ?? def?.defaultConfig ?? {});
      setError(null);
    }
  }, [instance, def]);

  if (!instance || !def) return null;

  const handleSave = () => {
    const parsed = def.configSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Configuração inválida.");
      return;
    }
    onSave(instance.instanceId, parsed.data);
    onClose();
  };

  const Custom = def.ConfigComponent;

  return (
    <Dialog open={!!instance} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      {/*
        Fixed dimensions (w-[1080px] h-[800px]) keep the dialog from jumping when
        accordion sections inside the config expand/collapse. The header and
        footer stay fixed; only the inner content area scrolls.

        The default DialogContent uses `grid` — we override to flex column so
        the middle scroll area can claim remaining height via `flex-1 min-h-0`.
        max-w/max-h cap the dialog on smaller viewports. Size matches the
        AddWidgetModal so the two dialogs feel visually consistent.
      */}
      <DialogContent className="!max-w-[1080px] w-[1080px] max-w-[calc(100vw-2rem)] h-[800px] max-h-[calc(100vh-2rem)] flex flex-col gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle>Configurar: {def.name}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
          <div className="space-y-3 pb-1">
            <SectionGroup key={instance.instanceId}>
              {Custom ? (
                <Custom config={draft} onChange={setDraft} />
              ) : (
                <DynamicFormField schema={def.configSchema} value={draft} onChange={setDraft} />
              )}
            </SectionGroup>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
