import React from "react";
import { Badge } from "@/components/ui/badge";
import { BORROW_STATUS } from "../../../../constants";
import { IconAlertTriangle } from "@tabler/icons-react";
import { differenceInHours, differenceInDays, parseISO } from "date-fns";

interface OverdueIndicatorProps {
  status: BORROW_STATUS;
  expectedReturnAt?: string | Date | null;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export function OverdueIndicator({ status, expectedReturnAt, className, showIcon = true, compact = false }: OverdueIndicatorProps) {
  // Only show for active borrows with an expected return date
  const shouldShow = React.useMemo(() => {
    if (status !== BORROW_STATUS.ACTIVE || !expectedReturnAt) {
      return false;
    }

    const returnDate = typeof expectedReturnAt === "string" ? parseISO(expectedReturnAt) : expectedReturnAt;
    const now = new Date();

    return returnDate < now;
  }, [status, expectedReturnAt]);

  // Calculate overdue duration
  const overdueInfo = React.useMemo(() => {
    if (!shouldShow || !expectedReturnAt) return null;

    const returnDate = typeof expectedReturnAt === "string" ? parseISO(expectedReturnAt) : expectedReturnAt;
    const now = new Date();

    const hoursOverdue = differenceInHours(now, returnDate);
    const daysOverdue = differenceInDays(now, returnDate);

    // Determine severity based on how long it's overdue
    let severity: "warning" | "error" = "warning";
    if (daysOverdue >= 7) {
      severity = "error";
    }

    // Format the overdue text
    let text: string;
    if (compact) {
      if (hoursOverdue < 24) {
        text = `${hoursOverdue}h`;
      } else {
        text = `${daysOverdue}d`;
      }
    } else {
      if (hoursOverdue < 24) {
        text = `Atrasado há ${hoursOverdue} ${hoursOverdue === 1 ? "hora" : "horas"}`;
      } else {
        text = `Atrasado há ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"}`;
      }
    }

    return {
      text,
      severity,
      hoursOverdue,
      daysOverdue,
    };
  }, [shouldShow, expectedReturnAt, compact]);

  if (!shouldShow || !overdueInfo) {
    return null;
  }

  return (
    <Badge variant={overdueInfo.severity} className={className}>
      {showIcon && <IconAlertTriangle className="mr-1 h-3 w-3" />}
      {overdueInfo.text}
    </Badge>
  );
}
