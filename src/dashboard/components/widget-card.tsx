// Shared chrome for dashboard widgets — gives every tile the same visual
// language (rounded card + border + shadow + optional header bar with icon,
// title, count badge, and a "view all" link). Widgets compose this around
// their content rather than re-rolling card classes individually.

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";
import { borderClassFor } from "./widget-accent";
import type { WidgetBorderColor } from "./widget-accent";

interface WidgetCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  /** Optional "see all" link rendered in the header. */
  viewAllHref?: string;
  /** Optional right-side header content (e.g., counts, action buttons). */
  headerExtra?: ReactNode;
  /** Optional integer shown as a muted pill before viewAll. */
  count?: number | null;
  /** Hide the header entirely (e.g. when the user disabled `showHeader`). */
  showHeader?: boolean;
  /** Optional border accent color — overrides the default `border-border`. */
  borderColor?: WidgetBorderColor;
  className?: string;
  children: ReactNode;
}

export function WidgetCard({
  title,
  icon,
  viewAllHref,
  headerExtra,
  count,
  showHeader = true,
  borderColor,
  className,
  children,
}: WidgetCardProps) {
  const borderClass = borderClassFor(borderColor);
  return (
    <div
      className={`h-full w-full flex flex-col min-h-0 rounded-lg bg-card border ${borderClass} shadow-sm overflow-hidden ${
        className ?? ""
      }`}
    >
      {showHeader && (title || icon || viewAllHref || headerExtra || count != null) && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border shrink-0 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            {title && (
              <h3 className="text-sm font-semibold text-secondary-foreground truncate">
                {title}
              </h3>
            )}
            {count != null && (
              <span className="shrink-0 rounded-md bg-muted/70 text-muted-foreground text-[10px] font-medium tabular-nums px-1.5 py-0.5">
                {count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            {viewAllHref && (
              <Link
                to={viewAllHref}
                className="group flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Ver todos
                <IconChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
