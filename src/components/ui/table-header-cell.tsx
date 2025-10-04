import React from "react";
import { TableHead } from "@/components/ui/table";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TableSortIcon, type SortDirection } from "@/components/ui/table-sort-icon";
import { cn } from "@/lib/utils";

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortDirection?: SortDirection;
  sortOrder?: number | null;
  showMultipleSortOrder?: boolean;
  align?: "left" | "center" | "right";
  onSort?: () => void;
}

/**
 * Standardized table header cell component
 * Enforces uppercase titles and consistent styling across all tables
 */
export function TableHeaderCell({
  children,
  className,
  sortable = false,
  sortDirection = null,
  sortOrder = null,
  showMultipleSortOrder = false,
  align = "left",
  onSort,
}: TableHeaderCellProps) {
  const headerText = typeof children === "string" ? children : String(children);

  const alignmentClasses = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right",
  };

  if (sortable) {
    return (
      <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0", className)}>
        <button
          onClick={onSort}
          className={cn(
            "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
            alignmentClasses[align],
          )}
        >
          <TruncatedTextWithTooltip text={headerText.toUpperCase()} />
          <TableSortIcon direction={sortDirection} order={sortOrder} showMultipleSortOrder={showMultipleSortOrder} />
        </button>
      </TableHead>
    );
  }

  return (
    <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0", className)}>
      <div className={cn("flex items-center h-full min-h-[2.5rem] px-4 py-2", alignmentClasses[align])}>
        <TruncatedTextWithTooltip text={headerText.toUpperCase()} />
      </div>
    </TableHead>
  );
}
