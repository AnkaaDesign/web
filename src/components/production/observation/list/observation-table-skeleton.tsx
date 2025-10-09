import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

interface ObservationTableSkeletonProps {
  visibleColumns: Set<string>;
  className?: string;
}

// Column configuration to match the actual table
const skeletonColumns = [
  { key: "task.name", width: "200px" },
  { key: "description", width: "300px" },
  { key: "filesCount", width: "120px" },
  { key: "createdAt", width: "160px" },
  { key: "updatedAt", width: "160px" },
];

export function ObservationTableSkeleton({ visibleColumns, className }: ObservationTableSkeletonProps) {
  const filteredColumns = skeletonColumns.filter((col) => visibleColumns.has(col.key));

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2 min-h-[2.5rem]">
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              {filteredColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0", "border-r border-border last:border-r-0")}
                  style={{ minWidth: column.width }}
                >
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index} className={cn("border-b border-border", index % 2 === 1 && "bg-muted/10")}>
                <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2 py-2">
                    <Skeleton className="h-4 w-4" />
                  </div>
                </TableCell>
                {filteredColumns.map((column) => (
                  <TableCell key={column.key} className="p-0 !border-r-0" style={{ minWidth: column.width }}>
                    <div className="px-4 py-2">
                      {column.key === "task.name" ? (
                        <Skeleton className="h-4 w-40" />
                      ) : column.key === "description" ? (
                        <Skeleton className="h-4 w-64" />
                      ) : column.key === "filesCount" ? (
                        <div className="flex items-center gap-1.5">
                          <Skeleton className="h-4 w-4" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                      ) : column.key === "createdAt" || column.key === "updatedAt" ? (
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ) : (
                        <Skeleton className="h-4 w-20" />
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50 py-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
