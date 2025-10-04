import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function SupplierListSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Search and filters skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full sm:w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="w-full">
            {/* Table header skeleton */}
            <div className="border-b border-border bg-muted/50 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" /> {/* Fantasy Name */}
                <Skeleton className="h-4 w-40" /> {/* Corporate Name */}
                <Skeleton className="h-4 w-28" /> {/* CNPJ */}
                <Skeleton className="h-4 w-36" /> {/* Email */}
                <Skeleton className="h-4 w-24" /> {/* Phones */}
                <Skeleton className="h-4 w-24" /> {/* City */}
                <Skeleton className="h-4 w-16" /> {/* State */}
                <Skeleton className="h-4 w-20 ml-auto" /> {/* Actions */}
              </div>
            </div>

            {/* Table rows skeleton */}
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="border-b border-border p-4 hover:bg-muted/50">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-5 w-40" /> {/* Fantasy Name */}
                      <Skeleton className="h-5 w-48" /> {/* Corporate Name */}
                      <Skeleton className="h-5 w-32" /> {/* CNPJ */}
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-44 opacity-70" /> {/* Email */}
                      <Skeleton className="h-4 w-28 opacity-70" /> {/* Phone */}
                      <Skeleton className="h-4 w-24 opacity-70" /> {/* City */}
                      <Skeleton className="h-4 w-12 opacity-70" /> {/* State */}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-8" /> {/* Products count */}
                    <Skeleton className="h-6 w-8" /> {/* Orders count */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}
