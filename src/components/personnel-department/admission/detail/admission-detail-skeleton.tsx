import { Skeleton } from "@/components/ui/skeleton";

export function AdmissionDetailSkeleton() {
  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      {/* Header skeleton */}
      <Skeleton className="h-24 w-full" />

      {/* Status stepper skeleton */}
      <Skeleton className="h-40 w-full" />

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>

      {/* Documents skeleton */}
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
