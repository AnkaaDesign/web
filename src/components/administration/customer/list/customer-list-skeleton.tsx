import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

export function CustomerListSkeleton() {
  return (
    <div className="rounded-lg flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg bg-muted">
        <div className="flex items-center min-h-[2.5rem]">
          {/* Checkbox */}
          <div className={cn(TABLE_LAYOUT.checkbox.className, "flex items-center justify-center px-2 py-2")}>
            <Skeleton className="h-4 w-4" />
          </div>

          {/* Column headers */}
          <div className="flex-1 flex items-center gap-4 px-4 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 border-l border-r border-border overflow-hidden">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className={cn("flex items-center min-h-[3rem] border-b border-border", index % 2 === 1 && "bg-muted/10")}>
            {/* Checkbox */}
            <div className={cn(TABLE_LAYOUT.checkbox.className, "flex items-center justify-center px-2 py-2")}>
              <Skeleton className="h-4 w-4" />
            </div>

            {/* Row data */}
            <div className="flex-1 flex items-center gap-4 px-4 py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer - Pagination */}
      <div className="px-4 py-3 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </div>
  );
}
