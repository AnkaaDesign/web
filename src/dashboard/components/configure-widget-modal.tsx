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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurar: {def.name}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {Custom ? (
            <Custom config={draft} onChange={setDraft} />
          ) : (
            <DynamicFormField schema={def.configSchema} value={draft} onChange={setDraft} />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
