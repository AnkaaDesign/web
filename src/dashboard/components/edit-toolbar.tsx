// Top-bar controls for the dashboard: enter edit mode, add widgets, save / discard.

import { Button } from "../../components/ui/button";
import {
  IconPencil,
  IconPlus,
  IconDeviceFloppy,
  IconArrowBackUp,
} from "@tabler/icons-react";

interface EditToolbarProps {
  isEditing: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onEnterEdit: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onAddWidget: () => void;
}

export function EditToolbar({
  isEditing,
  isDirty,
  isSaving,
  onEnterEdit,
  onSave,
  onDiscard,
  onAddWidget,
}: EditToolbarProps) {
  if (!isEditing) {
    return (
      <Button variant="outline" size="sm" onClick={onEnterEdit} className="gap-1.5">
        <IconPencil className="h-4 w-4" />
        Editar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onAddWidget} className="gap-1.5">
        <IconPlus className="h-4 w-4" />
        Adicionar widget
      </Button>
      <div className="w-px h-6 bg-border" />
      <Button
        variant="destructive"
        size="sm"
        onClick={onDiscard}
        disabled={isSaving}
        className="gap-1.5"
      >
        <IconArrowBackUp className="h-4 w-4" />
        Descartar
      </Button>
      <Button
        size="sm"
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="gap-1.5"
      >
        <IconDeviceFloppy className="h-4 w-4" />
        {isSaving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
