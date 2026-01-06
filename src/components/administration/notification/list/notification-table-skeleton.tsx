import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";

export function NotificationTableSkeleton() {
  return (
    <div className="rounded-lg flex flex-col overflow-hidden">
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-64 bg-muted !border-r-0">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-28 bg-muted !border-r-0">
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="w-28 bg-muted !border-r-0">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-32 bg-muted !border-r-0">
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead className="w-24 bg-muted !border-r-0">
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead className="w-32 bg-muted !border-r-0">
                <Skeleton className="h-4 w-20" />
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
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
                <TableCell className="w-64 p-0 !border-r-0">
                  <div className="px-4 py-2">
                    <Skeleton className="h-4 w-48" />
                  </div>
                </TableCell>
                <TableCell className="w-28 p-0 !border-r-0">
                  <div className="px-4 py-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="w-28 p-0 !border-r-0">
                  <div className="px-4 py-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="w-32 p-0 !border-r-0">
                  <div className="px-4 py-2 flex gap-1">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="w-24 p-0 !border-r-0">
                  <div className="px-4 py-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="w-32 p-0 !border-r-0">
                  <div className="px-4 py-2">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
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
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}
