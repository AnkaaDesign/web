import * as React from "react";
import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  className?: string;
  max?: number;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ count, className, max = 99 }) => {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-background",
        "animate-in fade-in zoom-in duration-200",
        className
      )}
    >
      {displayCount}
    </span>
  );
};
