import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RepresentativeDetailSkeleton() {
  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Basic Info Card Skeleton */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-6">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-6">
                <div className="flex justify-center mb-6">
                  <Skeleton className="h-24 w-24 rounded-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Card Skeleton */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-6">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                <div className="space-y-4 pt-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                <div className="space-y-4 pt-6">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
