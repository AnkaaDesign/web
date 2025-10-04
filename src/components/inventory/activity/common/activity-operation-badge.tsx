import { Badge } from "@/components/ui/badge";
import { ACTIVITY_OPERATION, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface ActivityOperationBadgeProps {
  operation: ACTIVITY_OPERATION;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function ActivityOperationBadge({ operation, className, size = "default" }: ActivityOperationBadgeProps) {
  // Use centralized badge configuration with entity context for activity operations
  const variant = getBadgeVariant(operation, "ACTIVITY");

  // Get display text with icon
  const getDisplayText = (op: ACTIVITY_OPERATION) => {
    switch (op) {
      case ACTIVITY_OPERATION.INBOUND:
        return (
          <>
            <span className="font-enhanced-unicode navigation-arrow">↗</span> Entrada
          </>
        );
      case ACTIVITY_OPERATION.OUTBOUND:
        return (
          <>
            <span className="font-enhanced-unicode navigation-arrow">↙</span> Saída
          </>
        );
      default:
        return op;
    }
  };

  const displayText = getDisplayText(operation);

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
