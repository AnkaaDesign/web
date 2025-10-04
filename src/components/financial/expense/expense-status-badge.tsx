import { EXPENSE_STATUS, EXPENSE_STATUS_LABELS } from "../../../constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ExpenseStatusBadgeProps {
  status: EXPENSE_STATUS;
  className?: string;
}

export function ExpenseStatusBadge({ status, className }: ExpenseStatusBadgeProps) {
  const getStatusVariant = (status: EXPENSE_STATUS) => {
    switch (status) {
      case EXPENSE_STATUS.PENDING:
        return "secondary";
      case EXPENSE_STATUS.APPROVED:
        return "default";
      case EXPENSE_STATUS.PAID:
        return "default";
      case EXPENSE_STATUS.REJECTED:
        return "destructive";
      case EXPENSE_STATUS.CANCELLED:
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: EXPENSE_STATUS) => {
    switch (status) {
      case EXPENSE_STATUS.PENDING:
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      case EXPENSE_STATUS.APPROVED:
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      case EXPENSE_STATUS.PAID:
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case EXPENSE_STATUS.REJECTED:
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case EXPENSE_STATUS.CANCELLED:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
      default:
        return "";
    }
  };

  return (
    <Badge
      variant={getStatusVariant(status)}
      className={cn(getStatusColor(status), className)}
    >
      {EXPENSE_STATUS_LABELS[status]}
    </Badge>
  );
}