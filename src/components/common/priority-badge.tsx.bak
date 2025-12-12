import { Badge } from "@/components/ui/badge";
import { PRIORITY_TYPE, PRIORITY_TYPE_LABELS, getBadgeVariant } from "../../constants";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: PRIORITY_TYPE;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function PriorityBadge({ priority, className, size = "default" }: PriorityBadgeProps) {
  const variant = getBadgeVariant(priority, "PRIORITY");

  return (
    <Badge variant={variant} size={size} className={cn(className)}>
      {PRIORITY_TYPE_LABELS[priority]}
    </Badge>
  );
}
