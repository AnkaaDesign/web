import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AdmissionListSkeletonProps {
  className?: string;
}

export function AdmissionListSkeleton({ className }: AdmissionListSkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border flex flex-col overflow-hidden", className)}>
      {/* Header skeleton */}
      <div className="bg-muted px-4 py-3 flex gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Rows skeleton */}
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
