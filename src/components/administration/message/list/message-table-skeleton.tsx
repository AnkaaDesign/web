import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function MessageTableSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>

        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </Card>
  );
}
