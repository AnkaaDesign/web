// Per-widget configuration dialog. Renders the widget's custom ConfigComponent
// if provided; otherwise auto-generates a form from configSchema via DynamicFormField.
//
// Validation: the form's draft state is parsed with the widget's Zod schema on
// submit. Invalid configs surface inline error messages and block save.

import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { DynamicFormField } from "./dynamic-form-field";
import { WidgetConfigDialog, TitleField } from "./config-kit";
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

  // Título is hoisted here (fixed, never scrolls) so every widget shares one
  // pinned title editor; the widget's ConfigComponent renders only its tabs.
  const draftObj =
    draft && typeof draft === "object" ? (draft as Record<string, unknown>) : {};
  const hasTitle = "title" in draftObj || (def.defaultConfig as Record<string, unknown> | null)?.title != null;
  const titleVal = typeof draftObj.title === "string" ? draftObj.title : "";

  // The title is hoisted into the fixed headerExtra zone only for Custom
  // ConfigComponents that own a `title` field. The auto-generated form
  // (DynamicFormField) already renders `title` as an ordinary string field, so
  // hoisting there would duplicate it. When the hoisted title is shown, the
  // body's top padding is removed (`pt-0`) so the tabs sit flush under it.
  const showHoistedTitle = !!Custom && hasTitle;

  return (
    <WidgetConfigDialog
      open={!!instance}
      onOpenChange={(v) => (!v ? onClose() : undefined)}
      title={`Configurar: ${def.name}`}
      description={def.description}
      headerExtra={
        showHoistedTitle ? (
          <TitleField
            value={titleVal}
            onChange={(t) => setDraft({ ...draftObj, title: t })}
          />
        ) : undefined
      }
      headerExtraBordered={false}
      bodyClassName={showHoistedTitle ? "pt-0" : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Aplicar</Button>
        </>
      }
    >
      <SectionGroup key={instance.instanceId}>
        {Custom ? (
          <Custom config={draft} onChange={setDraft} />
        ) : (
          <DynamicFormField schema={def.configSchema} value={draft} onChange={setDraft} />
        )}
      </SectionGroup>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </WidgetConfigDialog>
  );
}
