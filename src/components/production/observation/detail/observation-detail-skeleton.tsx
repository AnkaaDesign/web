import { Skeleton } from "@/components/ui/skeleton";

export function ObservationDetailSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Basic Information Card */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-48" />
            </div>

            {/* Description Section */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <div className="bg-muted/50 rounded-lg p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </div>
            </div>

            {/* Task Information Section */}
            <div className="pt-4 border-t border-border/50">
              <Skeleton className="h-5 w-36 mb-3" />
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            </div>

            {/* Commissions Section */}
            <div className="pt-4 border-t border-border/50">
              <Skeleton className="h-5 w-40 mb-3" />
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                    <div className="flex justify-between items-center mb-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-64 mt-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Date Information Section */}
            <div className="pt-4 border-t border-border/50">
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="text-right">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <div className="text-right">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Files Card */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-20 rounded-full ml-auto" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
