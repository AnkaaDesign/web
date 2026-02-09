import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function RepresentativeTableSkeleton() {
  return (
    <Card className="w-full">
      <div className="p-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
          <Skeleton className="h-9 w-9" />
        </div>

        {/* Table rows skeleton */}
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-3 border-b last:border-0"
          >
            <div className="flex items-center gap-4 flex-1">
              <Skeleton className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>
    </Card>
  );
}