import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../../constants";

interface ActivityReasonBadgeProps {
  reason: ACTIVITY_REASON;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function ActivityReasonBadge({ reason, className, size = "default" }: ActivityReasonBadgeProps) {
  // Map specific activity reasons to appropriate badge variants
  const getReasonVariant = (activityReason: ACTIVITY_REASON) => {
    switch (activityReason) {
      // Positive/Inbound reasons - Green
      case ACTIVITY_REASON.ORDER_RECEIVED:
      case ACTIVITY_REASON.RETURN:
      case ACTIVITY_REASON.PAINT_PRODUCTION:
        return "success";

      // Negative/Outbound reasons - Red
      case ACTIVITY_REASON.PRODUCTION_USAGE:
      case ACTIVITY_REASON.PPE_DELIVERY:
      case ACTIVITY_REASON.EXTERNAL_WITHDRAWAL:
      case ACTIVITY_REASON.DAMAGE:
      case ACTIVITY_REASON.LOSS:
        return "error";

      // Warning/Attention reasons - Orange
      case ACTIVITY_REASON.MANUAL_ADJUSTMENT:
      case ACTIVITY_REASON.INVENTORY_COUNT:
      case ACTIVITY_REASON.MAINTENANCE:
        return "warning";

      // Neutral/Process reasons - Blue
      case ACTIVITY_REASON.BORROW:
      case ACTIVITY_REASON.EXTERNAL_WITHDRAWAL_RETURN:
        return "info";

      // Other/Default - Default
      case ACTIVITY_REASON.OTHER:
      default:
        return "default";
    }
  };

  const variant = getReasonVariant(reason);

  // Get display text
  const displayText = ACTIVITY_REASON_LABELS[reason] || reason;

  return (
    <Badge variant={variant} size={size} className={cn(className)}>
      {displayText}
    </Badge>
  );
}
