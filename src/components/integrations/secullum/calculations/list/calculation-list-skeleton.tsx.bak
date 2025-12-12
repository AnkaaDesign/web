import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

export function CalculationListSkeleton() {
  // Create array for skeleton rows
  const skeletonRows = Array.from({ length: 15 }, (_, index) => index);

  // Create array for skeleton columns (approximating the calculation columns)
  const skeletonColumns = [
    "Data", "Entrada 1", "Saída 1", "Entrada 2", "Saída 2",
    "Normal", "Ex50%", "Ex100%", "DSR", "Ajuste"
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg">
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>

              {/* Data columns */}
              {skeletonColumns.map((header, index) => (
                <TableHead key={index} className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-24">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                    <Skeleton className="h-4 w-16" />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {skeletonRows.map((_, rowIndex) => (
              <TableRow key={rowIndex} className={cn("border-b border-border", rowIndex % 2 === 1 && "bg-muted/10")}>
                {/* Selection checkbox */}
                <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2 py-2">
                    <Skeleton className="h-4 w-4" />
                  </div>
                </TableCell>

                {/* Data columns */}
                {skeletonColumns.map((_, colIndex) => (
                  <TableCell key={colIndex} className="p-0 !border-r-0 w-24 text-center">
                    <div className="px-4 py-2">
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}