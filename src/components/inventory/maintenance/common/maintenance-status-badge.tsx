import { Badge } from "@/components/ui/badge";
import { IconClock, IconPlayerPlay, IconCircleCheck, IconCircleX, IconAlertTriangle } from "@tabler/icons-react";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface MaintenanceStatusBadgeProps {
  status: MAINTENANCE_STATUS;
  className?: string;
  showIcon?: boolean;
  size?: "default" | "sm" | "lg";
}

export function MaintenanceStatusBadge({ status, className, showIcon = true, size = "default" }: MaintenanceStatusBadgeProps) {
  // Use centralized badge configuration
  const variant = getBadgeVariant(status, "MAINTENANCE");

  const getStatusConfig = () => {
    switch (status) {
      case MAINTENANCE_STATUS.PENDING:
        return {
          icon: IconClock,
          label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.PENDING],
        };

      case MAINTENANCE_STATUS.IN_PROGRESS:
        return {
          icon: IconPlayerPlay,
          label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.IN_PROGRESS],
        };

      case MAINTENANCE_STATUS.COMPLETED:
        return {
          icon: IconCircleCheck,
          label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.COMPLETED],
        };

      case MAINTENANCE_STATUS.CANCELLED:
        return {
          icon: IconCircleX,
          label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.CANCELLED],
        };

      case MAINTENANCE_STATUS.OVERDUE:
        return {
          icon: IconAlertTriangle,
          label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.OVERDUE],
          className: "animate-pulse",
        };

      default:
        return {
          icon: IconClock,
          label: status,
        };
    }
  };

  const { icon: Icon, label, className: statusClassName } = getStatusConfig();

  return (
    <Badge variant={variant} size={size} className={cn("flex items-center gap-1 font-medium", statusClassName, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}
