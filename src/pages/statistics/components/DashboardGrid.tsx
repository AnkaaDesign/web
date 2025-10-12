/**
 * Dashboard Grid Component
 *
 * Responsive grid layout for dashboard widgets with:
 * - Responsive grid columns
 * - Widget placement
 * - Optional drag-and-drop (future enhancement)
 */

import { cn } from "@/lib/utils";
import type { WidgetConfig } from "../utils/dashboard-config";

export interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Dashboard Grid Component
 *
 * Provides a responsive grid layout for dashboard widgets.
 */
export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface DashboardWidgetProps {
  config: WidgetConfig;
  children: React.ReactNode;
  className?: string;
}

/**
 * Dashboard Widget Container
 *
 * Wraps a widget with appropriate sizing based on configuration.
 */
export function DashboardWidget({
  config,
  children,
  className,
}: DashboardWidgetProps) {
  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 sm:col-span-2",
    large: "col-span-1 sm:col-span-2 lg:col-span-3",
    full: "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4",
  };

  return (
    <div className={cn(sizeClasses[config.size], className)}>
      {children}
    </div>
  );
}
