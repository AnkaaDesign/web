import { IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

interface TableSortIconProps {
  direction: SortDirection;
  order?: number | null;
  showMultipleSortOrder?: boolean;
  className?: string;
}

/**
 * Standardized sort icon component for table headers
 * Provides consistent sizing and design across all tables
 */
export function TableSortIcon({ direction, order = null, showMultipleSortOrder = false, className }: TableSortIconProps) {
  const showOrder = order !== null && showMultipleSortOrder;

  return (
    <div className={cn("inline-flex items-center ml-1", className)}>
      {direction === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
      {direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
      {direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
      {showOrder && <span className="text-xs ml-0.5 text-foreground">{(order as number) + 1}</span>}
    </div>
  );
}
