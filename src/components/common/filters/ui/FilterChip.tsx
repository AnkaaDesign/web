import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  value?: string;
  onRemove: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function FilterChip({
  label,
  value,
  onRemove,
  icon,
  className,
}: FilterChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm",
        "transition-colors hover:bg-primary/20",
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="font-medium text-primary">{label}</span>
      {value && (
        <>
          <span className="text-muted-foreground">:</span>
          <span className="text-foreground">{value}</span>
        </>
      )}
      <button
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-primary/30 transition-colors"
        aria-label={`Remover filtro ${label}`}
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
