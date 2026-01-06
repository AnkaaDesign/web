import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PaintProductionSkeletonProps {
  className?: string;
}

export function PaintProductionSkeleton({ className }: PaintProductionSkeletonProps) {
  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Filter Controls Skeleton */}
        <div className="flex items-center gap-3">
          {/* Search Skeleton */}
          <Skeleton className="h-10 flex-1 max-w-sm" />

          {/* Filter Button Skeleton */}
          <Skeleton className="h-10 w-24" />

          {/* Show Selected Toggle Skeleton */}
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Table Container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table Header Skeleton */}
          <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
            <div className="bg-muted p-0">
              <div className="flex items-center min-h-[2.5rem]">
                <div className="flex-1 px-4 py-2">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex-1 px-4 py-2">
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex-1 px-4 py-2">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex-1 px-4 py-2">
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          </div>

          {/* Table Body Skeleton */}
          <div className="flex-1 overflow-hidden border-l border-r border-border">
            <div className="space-y-0">
              {[...Array(10)].map((_, index) => (
                <div key={index} className={cn("flex items-center p-4 border-b border-border", index % 2 === 1 && "bg-muted/10")}>
                  <div className="flex-1 flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-md" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Footer Skeleton */}
          <div className="px-4 py-3 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
