import { Skeleton } from "@/components/ui/skeleton";

export function CategoryListSkeleton() {
  return (
    <div className="rounded-lg flex flex-col">
      {/* Fixed Header Skeleton */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <div className="bg-muted p-0">
          <div className="flex">
            {/* Checkbox column */}
            <div className="w-12 min-w-12 max-w-12 p-3">
              <Skeleton className="h-4 w-4" />
            </div>
            {/* Name column */}
            <div className="flex-1 p-3">
              <Skeleton className="h-4 w-20" />
            </div>
            {/* EPI column */}
            <div className="w-20 p-3">
              <Skeleton className="h-4 w-12" />
            </div>
            {/* Count column */}
            <div className="w-32 p-3">
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Created at column */}
            <div className="w-32 p-3">
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Body Skeleton */}
      <div className="flex-1 border-l border-r border-b border-border rounded-b-lg">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className={`flex border-b border-border ${index % 2 === 1 ? "bg-muted/10" : ""}`}>
            {/* Checkbox column */}
            <div className="w-12 min-w-12 max-w-12 p-3 flex items-center justify-center">
              <Skeleton className="h-4 w-4" />
            </div>
            {/* Name column */}
            <div className="flex-1 p-3">
              <Skeleton className="h-4 w-full max-w-[200px]" />
            </div>
            {/* EPI column */}
            <div className="w-20 p-3">
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            {/* Count column */}
            <div className="w-32 p-3">
              <Skeleton className="h-4 w-8" />
            </div>
            {/* Created at column */}
            <div className="w-32 p-3">
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
