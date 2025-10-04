import { Skeleton } from "@/components/ui/skeleton";

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>

      {/* Core Information Grid */}
      <div className="space-y-6">
        {/* Order Info and Changelog Grid (2x1) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Info Card */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-48" />
            </div>

            {/* Order Status Badge */}
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-44" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-40" />
              </div>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </div>

          {/* Changelog History */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-full max-w-md" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Items Section - Full Width */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          {/* Items Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-muted/50 rounded-lg font-medium text-sm">
            <div className="col-span-4">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="col-span-2 text-center">
              <Skeleton className="h-4 w-20 mx-auto" />
            </div>
            <div className="col-span-2 text-center">
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
            <div className="col-span-2 text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
            <div className="col-span-2 text-right">
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                {/* Mobile Layout */}
                <div className="block md:hidden space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Skeleton className="h-4 w-8" />
                      <span>/</span>
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Skeleton className="h-4 w-8" />
                      <span>/</span>
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                  <div className="col-span-2 text-right flex items-center justify-end gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>

                {/* Progress bars */}
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />

                  <div className="flex justify-between text-xs">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary Footer */}
          <div className="border-t pt-4 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <Skeleton className="h-4 w-16 mx-auto" />
                <Skeleton className="h-6 w-8 mx-auto" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-20 mx-auto" />
                <Skeleton className="h-6 w-12 mx-auto" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-18 mx-auto" />
                <Skeleton className="h-6 w-16 mx-auto" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 mx-auto" />
                <Skeleton className="h-6 w-20 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
