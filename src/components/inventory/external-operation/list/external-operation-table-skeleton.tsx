import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

interface ExternalOperationTableSkeletonProps {
  visibleColumns: Set<string>;
  className?: string;
}

// Column configuration to match the actual table (see external-operation-table.tsx)
const skeletonColumns = [
  { key: "withdrawerName", width: "16rem" },
  { key: "customer", width: "12rem" },
  { key: "status", width: "10rem" },
  { key: "type", width: "9rem" },
  { key: "notes", width: "12rem" },
  { key: "itemCount", width: "6rem" },
  { key: "total", width: "9rem" },
  { key: "totalQuantity", width: "9rem" },
  { key: "createdAt", width: "10rem" },
  { key: "updatedAt", width: "11rem" },
];

export function ExternalOperationTableSkeleton({ visibleColumns, className }: ExternalOperationTableSkeletonProps) {
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
                      {column.key === "withdrawerName" ? (
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      ) : column.key === "status" || column.key === "type" ? (
                        <Skeleton className="h-6 w-24 rounded-full" />
                      ) : column.key === "itemCount" || column.key === "totalQuantity" ? (
                        <div className="flex justify-center">
                          <Skeleton className="h-4 w-10" />
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
