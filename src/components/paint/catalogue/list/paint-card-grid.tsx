import type { Paint } from "../../../../types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaintCard } from "./paint-card";
import type { PaintGetManyFormData } from "../../../../schemas";

interface PaintCardGridProps {
  paints: Paint[];
  isLoading: boolean;
  onFilterChange?: (filters: Partial<PaintGetManyFormData>) => void;
  currentFilters?: Partial<PaintGetManyFormData>;
}

export function PaintCardGrid({ paints, isLoading, onFilterChange, currentFilters }: PaintCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-24 w-full mb-4" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-8 w-full" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      {paints.map((paint) => (
        <PaintCard key={paint.id} paint={paint} onFilterChange={onFilterChange} currentFilters={currentFilters} />
      ))}
    </div>
  );
}
