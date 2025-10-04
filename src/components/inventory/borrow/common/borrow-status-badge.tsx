import { Badge } from "@/components/ui/badge";
import { BORROW_STATUS, BORROW_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface BorrowStatusBadgeProps {
  status: BORROW_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
  isOverdue?: boolean;
}

export function BorrowStatusBadge({ status, className, size = "default", isOverdue = false }: BorrowStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "BORROW");

  // Get display text with emoji indicators for special states
  const getDisplayText = () => {
    if (status === BORROW_STATUS.ACTIVE && isOverdue) {
      return `🔴 ${BORROW_STATUS_LABELS[status]} (Atrasado)`;
    }
    if (status === BORROW_STATUS.LOST) {
      return `⚠️ ${BORROW_STATUS_LABELS[status]}`;
    }
    return BORROW_STATUS_LABELS[status] || status;
  };

  return (
    <Badge variant={variant} size={size} className={cn("font-medium font-enhanced-unicode", isOverdue && status === BORROW_STATUS.ACTIVE && "animate-pulse", className)}>
      {getDisplayText()}
    </Badge>
  );
}
