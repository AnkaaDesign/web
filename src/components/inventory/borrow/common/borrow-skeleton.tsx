import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Skeleton for BorrowTable rows
 * Used when loading borrow data in table format
 */
export function BorrowTableRowSkeleton() {
  return (
    <div className="border-b border-border p-4 hover:bg-muted/50">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-4" />
        <div className="flex-1 space-y-2">
          {/* Item name and code */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-24 opacity-70" />
          </div>
          {/* User name and email */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-36 opacity-70" />
            <Skeleton className="h-4 w-32 opacity-70" />
          </div>
        </div>
        {/* Quantity */}
        <Skeleton className="h-4 w-8" />
        {/* Status badge */}
        <Skeleton className="h-6 w-20" />
        {/* Dates */}
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        {/* Actions */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full skeleton for BorrowTable including header and pagination
 * Used as the main loading state for the borrow list page
 */
export function BorrowTableSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Search and filters skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full sm:w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
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
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            </div>

            {/* Table rows skeleton */}
            {Array.from({ length: 10 }).map((_, index) => (
              <BorrowTableRowSkeleton key={index} />
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

/**
 * Skeleton for BorrowInfoCard
 * Used in the borrow detail page to show loading state for borrow information
 */
export function BorrowCardSkeleton() {
  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Item Information Section */}
          <div>
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="bg-muted/30 rounded-lg p-4">
              <Skeleton className="h-5 w-48 mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          </div>

          {/* User Information Section */}
          <div className="pt-6 border-t border-border/50">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="bg-muted/30 rounded-lg p-4">
              <Skeleton className="h-5 w-36 mb-3" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          </div>

          {/* Borrow Details Section */}
          <div className="pt-6 border-t border-border/50">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-5 w-36" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for BorrowForm
 * Used when loading the create/edit borrow form
 */
export function BorrowFormSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Item Selector */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>

          {/* User Selector */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-56" />
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-40" />
          </div>

          {/* Status and Return Date (for edit mode) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex justify-end gap-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a single borrow item card
 * Can be used in grid layouts or as standalone cards
 */
export function BorrowItemCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Item name */}
          <Skeleton className="h-5 w-3/4" />

          {/* Status badge */}
          <Skeleton className="h-6 w-20" />

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for borrow history timeline
 * Used in the borrow detail page to show loading state for history
 */
export function BorrowHistorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-2 w-2 rounded-full mt-2" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32 opacity-70" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
