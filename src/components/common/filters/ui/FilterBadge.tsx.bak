import { Badge } from "@/components/ui/badge";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface FilterBadgeProps {
  label: string;
  value?: string;
  onRemove?: () => void;
  icon?: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export function FilterBadge({
  label,
  value,
  onRemove,
  icon,
  variant = "secondary",
  className,
}: FilterBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "gap-1 pr-1 pl-2 py-1",
        onRemove && "cursor-pointer hover:bg-secondary-foreground/20",
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="font-medium">{label}:</span>
      {value && <span className="font-normal">{value}</span>}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-sm hover:bg-secondary-foreground/30 p-0.5"
        >
          <IconX className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
