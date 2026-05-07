// Shared chrome for dashboard widgets — gives every tile the same visual
// language: rounded card + border + a fixed-height header strip and a
// matching footer strip. The fixed header height (h-9) is what keeps every
// widget's header visually aligned regardless of whether the widget shows a
// search input, day navigator, or other taller controls inside `headerExtra`.

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";
import { borderClassFor } from "./widget-accent";
import type { WidgetBorderColor } from "./widget-accent";

interface WidgetCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  /** "See all" link rendered centered in the bottom footer strip. */
  viewAllHref?: string;
  /** Optional right-side header content (e.g., search, day navigator). */
  headerExtra?: ReactNode;
  /** Optional extra content rendered to the right of the centered "Ver todos" link. */
  footerExtra?: ReactNode;
  /** Optional integer shown as a muted pill in the header. */
  count?: number | null;
  /** Hide the header entirely (e.g. when the user disabled `showHeader`). */
  showHeader?: boolean;
  /** Hide the footer entirely. Defaults to true. */
  showFooter?: boolean;
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
  footerExtra,
  count,
  showHeader = true,
  showFooter = true,
  borderColor,
  className,
  children,
}: WidgetCardProps) {
  const borderClass = borderClassFor(borderColor);
  const renderFooter = showFooter && (viewAllHref || footerExtra);
  return (
    <div
      className={`h-full w-full flex flex-col min-h-0 rounded-lg bg-card border ${borderClass} shadow-sm overflow-hidden ${
        className ?? ""
      }`}
    >
      {showHeader && (title || icon || headerExtra || count != null) && (
        <div className="flex items-center justify-between gap-3 px-3 h-9 border-b border-border shrink-0 bg-muted/30">
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
          {headerExtra && (
            <div className="flex items-center gap-2 shrink-0">{headerExtra}</div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      {renderFooter && (
        <div className="relative flex items-center justify-center px-3 h-7 border-t border-border shrink-0 bg-muted/30">
          {viewAllHref && (
            <Link
              to={viewAllHref}
              className="group flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Ver todos
              <IconChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {footerExtra && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {footerExtra}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
