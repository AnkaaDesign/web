import type { Paint } from "../../../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PaintCard } from "./paint-card";
import type { PaintGetManyFormData } from "../../../../schemas";

interface PaintCardGridVirtualizedProps {
  paints: Paint[];
  isLoading: boolean;
  onFilterChange?: (filters: Partial<PaintGetManyFormData>) => void;
  currentFilters?: Partial<PaintGetManyFormData>;
  showEffects?: boolean;
  onMerge?: () => void;
}

export function PaintCardGridVirtualized({ paints, isLoading, onFilterChange, currentFilters, showEffects = true, onMerge }: PaintCardGridVirtualizedProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 w-full">
        {Array.from({ length: 20 }).map((_, i) => (
          <Card key={i} className="overflow-hidden h-full flex flex-col">
            {/* Color preview skeleton - matches the 128px height */}
            <Skeleton className="h-32 w-full flex-shrink-0" />

            {/* Card content skeleton */}
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              {/* Name and type */}
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-18 rounded-full" />
              </div>

              {/* Formula count */}
              <Skeleton className="h-4 w-24" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!paints.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Nenhuma tinta encontrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 w-full">
      {paints.map((paint) => (
        <PaintCard key={paint.id} paint={paint} onFilterChange={onFilterChange} currentFilters={currentFilters} showEffects={showEffects} onMerge={onMerge} />
      ))}
    </div>
  );
}
