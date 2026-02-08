import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";

interface TaskHistoryTableSkeletonProps {
  className?: string;
}

export function TaskHistoryTableSkeleton({ className }: TaskHistoryTableSkeletonProps) {
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();
  const pageSize = 40; // Default page size

  // Mock columns for skeleton
  const mockColumns = [
    { id: "name", className: "w-48" },
    { id: "customer", className: "w-32" },
    { id: "generalPainting", className: "w-32" },
    { id: "sector", className: "w-28" },
    { id: "serialNumber", className: "w-32" },
    { id: "finishedAt", className: "w-32" },
  ];

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <div className="h-4 w-4 animate-pulse bg-muted-foreground/20 rounded" />
                </div>
              </TableHead>

              {/* Data columns */}
              {mockColumns.map((column) => (
                <TableHead key={column.id} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                    <div className="h-3 w-16 animate-pulse bg-muted-foreground/20 rounded" />
                  </div>
                </TableHead>
              ))}

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {[...Array(pageSize)].map((_, index) => (
              <TableRow key={index} className={cn("border-b border-border", index % 2 === 1 && "bg-muted/10")}>
                {/* Selection checkbox */}
                <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2 py-2">
                    <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                  </div>
                </TableCell>

                {/* Data columns */}
                {mockColumns.map((column) => (
                  <TableCell key={column.id} className={cn(column.className, "p-0 !border-r-0")}>
                    <div className="px-4 py-2">
                      <div className="h-4 animate-pulse bg-muted rounded" style={{ width: `${Math.random() * 50 + 50}%` }} />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <div className="flex items-center justify-between py-3">
          <div className="h-4 w-32 animate-pulse bg-muted rounded" />
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 animate-pulse bg-muted rounded" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded" />
          </div>
          <div className="h-4 w-24 animate-pulse bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}