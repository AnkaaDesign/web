import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IconFilter, IconFilterCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ShowSelectedToggleProps {
  showSelectedOnly: boolean;
  onToggle: (value: boolean) => void;
  selectionCount: number;
  className?: string;
  variant?: "button" | "checkbox";
}

export function ShowSelectedToggle({ showSelectedOnly, onToggle, selectionCount, className, variant = "button" }: ShowSelectedToggleProps) {
  // Don't render if no items are selected
  if (selectionCount === 0) return null;

  if (variant === "checkbox") {
    return (
      <div className={cn("flex items-center space-x-2 text-sm", className)}>
        <Checkbox id="show-selected-only" checked={showSelectedOnly} onCheckedChange={() => onToggle(!showSelectedOnly)} />
        <label htmlFor="show-selected-only" className="font-medium cursor-pointer select-none">
          Mostrar apenas selecionados
          <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
            {selectionCount}
          </Badge>
        </label>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={showSelectedOnly ? "default" : "outline"}
      size="default"
      onClick={() => onToggle(!showSelectedOnly)}
      className={cn("gap-2 transition-all", showSelectedOnly && "bg-primary text-primary-foreground", className)}
    >
      {showSelectedOnly ? <IconFilterCheck className="h-3.5 w-3.5" /> : <IconFilter className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{showSelectedOnly ? "Mostrando selecionados" : "Mostrar selecionados"}</span>
      <Badge variant={showSelectedOnly ? "secondary" : "default"} className="h-5 px-1.5 min-w-0">
        {selectionCount}
      </Badge>
    </Button>
  );
}
