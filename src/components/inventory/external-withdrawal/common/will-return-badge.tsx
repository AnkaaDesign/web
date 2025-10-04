import { Badge } from "@/components/ui/badge";
import { getBooleanBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface WillReturnBadgeProps {
  willReturn: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "short" | "long";
}

export function WillReturnBadge({ willReturn, className, size = "default", variant = "short" }: WillReturnBadgeProps) {
  // Use centralized boolean badge configuration
  const badgeVariant = getBooleanBadgeVariant("willReturn", willReturn);

  // Get display text based on variant
  const displayText = variant === "short" ? (willReturn ? "Com devolução" : "Sem devolução") : willReturn ? "Itens serão devolvidos" : "Itens não serão devolvidos";

  return (
    <Badge variant={badgeVariant} size={size} className={cn(className)}>
      {displayText}
    </Badge>
  );
}
