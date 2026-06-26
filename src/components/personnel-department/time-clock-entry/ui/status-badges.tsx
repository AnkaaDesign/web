import { IconCheck, IconX, IconClock, IconAlertTriangle, IconCamera, IconMapPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  className?: string;
  variant?: "success" | "error" | "warning" | "info" | "neutral";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatusBadge({ className, variant = "neutral", size = "md", children, icon }: StatusBadgeProps) {
  const baseClasses = "inline-flex items-center gap-1.5 rounded-full font-medium";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-2.5 py-1.5 text-xs",
    lg: "px-3 py-2 text-sm",
  };

  const variantClasses = {
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    neutral: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <span className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}>
      {icon}
      {children}
    </span>
  );
}

interface ModificationBadgeProps {
  isModified: boolean;
  className?: string;
}

export function ModificationBadge({ isModified, className }: ModificationBadgeProps) {
  if (!isModified) return null;

  return (
    <StatusBadge variant="warning" size="sm" className={cn("absolute -top-1 -right-1", className)} icon={<IconAlertTriangle className="h-3 w-3" />}>
      Modificado
    </StatusBadge>
  );
}

interface DataSourceBadgeProps {
  source: "ELECTRONIC" | "MANUAL";
  hasPhoto?: boolean;
  hasLocation?: boolean;
  className?: string;
}

export function DataSourceBadge({ source, hasPhoto, hasLocation, className }: DataSourceBadgeProps) {
  const isElectronic = source === "ELECTRONIC";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <StatusBadge variant={isElectronic ? "success" : "neutral"} size="sm" icon={isElectronic ? <IconCheck className="h-3 w-3" /> : <IconX className="h-3 w-3" />}>
        {isElectronic ? "Eletrônico" : "Manual"}
      </StatusBadge>

      {hasPhoto && (
        <StatusBadge variant="info" size="sm" icon={<IconCamera className="h-3 w-3" />}>
          Foto
        </StatusBadge>
      )}

      {hasLocation && (
        <StatusBadge variant="info" size="sm" icon={<IconMapPin className="h-3 w-3" />}>
          GPS
        </StatusBadge>
      )}
    </div>
  );
}

interface WeekendBadgeProps {
  isWeekend: boolean;
  className?: string;
}

export function WeekendBadge({ isWeekend, className }: WeekendBadgeProps) {
  if (!isWeekend) return null;

  return (
    <StatusBadge variant="error" size="sm" className={className} icon={<IconClock className="h-3 w-3" />}>
      Final de semana
    </StatusBadge>
  );
}

interface ChangesCountBadgeProps {
  count: number;
  className?: string;
}

export function ChangesCountBadge({ count, className }: ChangesCountBadgeProps) {
  if (count === 0) return null;

  return (
    <StatusBadge variant="warning" size="sm" className={className}>
      {count} {count === 1 ? "alteração" : "alterações"}
    </StatusBadge>
  );
}
