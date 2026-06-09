import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IconX } from "@tabler/icons-react";

export interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drawer title, e.g. "Itens - Filtros". */
  title?: string;
  /** Optional icon rendered before the title, e.g. <IconFilter className="h-5 w-5" />. */
  titleIcon?: React.ReactNode;
  /** Optional helper text below the title. */
  description?: string;
  /** Number of active filters. When > 0, shows a badge in the title (click to reset) and on the apply button. */
  activeFilterCount?: number;
  /** The filter fields. Each top-level child is spaced with `space-y-6`. */
  children: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  /** Hide the reset button when false. */
  showReset?: boolean;
  /** Hide the whole footer when false. */
  showFooter?: boolean;
  side?: "left" | "right" | "top" | "bottom";
  /** Extra classes for the SheetContent (e.g. a wider/narrower max-width). */
  className?: string;
  /** Extra classes for the scrollable content wrapper. */
  contentClassName?: string;
}

/**
 * Canonical filter drawer used across list/statistics pages.
 *
 * Layout contract (keeps every filter sheet visually consistent):
 * - right-side sheet, `sm:max-w-xl`, flex column
 * - header with optional icon + active-filter count badge
 * - scrollable field area that grows to fill the available height
 * - fixed footer (reset + apply) that never scrolls, with a softened divider
 */
export function FilterDrawer({
  open,
  onOpenChange,
  title = "Filtros",
  titleIcon,
  description,
  activeFilterCount = 0,
  children,
  onApply,
  onReset,
  applyLabel = "Aplicar filtros",
  resetLabel = "Limpar todos",
  showReset = true,
  showFooter = true,
  side = "right",
  className,
  contentClassName,
}: FilterDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("w-full sm:max-w-xl md:max-w-xl flex flex-col border-border/50", className)}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {titleIcon}
            {title}
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className={cn("ml-2", onReset && "cursor-pointer transition-colors hover:bg-destructive hover:text-destructive-foreground")}
                onClick={onReset}
                title={onReset ? "Clique para limpar todos os filtros" : undefined}
              >
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className={cn("flex-1 overflow-y-auto -mx-4 px-4 mt-6 space-y-6", contentClassName)}>{children}</div>

        {showFooter && (
          <div className="flex gap-2 pt-4 mt-4 border-t border-border/50 shrink-0">
            {showReset && onReset && (
              <Button variant="outline" onClick={onReset} className="flex-1">
                <IconX className="mr-2 h-4 w-4" />
                {resetLabel}
              </Button>
            )}
            {onApply && (
              <Button onClick={onApply} className="flex-1">
                {applyLabel}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
