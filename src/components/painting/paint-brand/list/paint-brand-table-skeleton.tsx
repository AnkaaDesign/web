import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function PaintBrandTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Batch actions skeleton */}
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-4 ml-2" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 ml-2" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}
