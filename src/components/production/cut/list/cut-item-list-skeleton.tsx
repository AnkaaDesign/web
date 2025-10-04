import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CutItemListSkeleton() {
  return (
    <div className="rounded-lg flex flex-col overflow-hidden">
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full [&>div]:border-0 [&>div]:rounded-none">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-12 p-2">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead className="w-64">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="w-32">
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full [&>div]:border-0 [&>div]:rounded-none">
          <TableBody>
            {Array.from({ length: 10 }).map((_, index: number) => (
              <TableRow key={index} className={index % 2 === 1 ? "bg-muted/10" : ""}>
                <TableCell className="w-12 p-2">
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell className="w-64">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell className="w-32">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="w-32">
                  <Skeleton className="h-6 w-24" />
                </TableCell>
                <TableCell className="w-32">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </TableCell>
                <TableCell className="w-12">
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </div>
  );
}
