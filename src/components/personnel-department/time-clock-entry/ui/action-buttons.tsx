import { IconDeviceFloppy, IconRestore, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionButtonsProps {
  className?: string;
  onSave?: () => void;
  onRestore?: () => void;
  saveLabel?: string;
  restoreLabel?: string;
  hasChanges?: boolean;
  isSaving?: boolean;
  changedCount?: number;
  size?: "sm" | "default" | "lg";
  orientation?: "horizontal" | "vertical";
  showChangesIndicator?: boolean;
  disabled?: boolean;
}

export function ActionButtons({
  className,
  onSave,
  onRestore,
  saveLabel = "Salvar alterações",
  restoreLabel = "Restaurar",
  hasChanges = false,
  isSaving = false,
  changedCount = 0,
  size = "default",
  orientation = "horizontal",
  showChangesIndicator = true,
  disabled = false,
}: ActionButtonsProps) {
  const containerClasses = cn("flex gap-2", orientation === "vertical" ? "flex-col" : "flex-row items-center", className);

  const getSaveButtonText = () => {
    if (isSaving) return "Salvando...";
    if (showChangesIndicator && changedCount > 0) {
      return `${saveLabel} (${changedCount})`;
    }
    return saveLabel;
  };

  return (
    <div className={containerClasses}>
      {showChangesIndicator && changedCount > 0 && orientation === "horizontal" && (
        <div className="text-sm text-muted-foreground">
          {changedCount} {changedCount === 1 ? "alteração" : "alterações"}
        </div>
      )}

      <div className={cn("flex gap-2", orientation === "vertical" && "flex-col w-full")}>
        <Button onClick={onSave} disabled={disabled || !hasChanges || isSaving} size={size} className="gap-2">
          {isSaving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4" />}
          {getSaveButtonText()}
        </Button>

        <Button onClick={onRestore} disabled={disabled || !hasChanges || isSaving} variant="outline" size={size} className="gap-2">
          <IconRestore className="h-4 w-4" />
          {restoreLabel}
        </Button>
      </div>

      {showChangesIndicator && changedCount > 0 && orientation === "vertical" && (
        <div className="text-xs text-muted-foreground text-center">
          {changedCount} {changedCount === 1 ? "alteração pendente" : "alterações pendentes"}
        </div>
      )}
    </div>
  );
}
