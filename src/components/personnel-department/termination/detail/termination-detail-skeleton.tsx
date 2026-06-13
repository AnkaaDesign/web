import { Skeleton } from "@/components/ui/skeleton";

export function TerminationDetailSkeleton() {
  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Stepper skeleton */}
      <Skeleton className="h-32 w-full" />

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-96 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>

      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
