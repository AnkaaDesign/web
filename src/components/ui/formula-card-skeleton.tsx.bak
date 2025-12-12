import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FormulaCardSkeletonProps {
  className?: string;
  itemCount?: number;
}

export function FormulaCardSkeleton({ className, itemCount = 3 }: FormulaCardSkeletonProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Skeleton className="h-5 w-5" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 flex-1 overflow-y-auto">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index}>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  {/* Formula description */}
                  <Skeleton className="h-5 w-3/4" />

                  {/* Formula metrics */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
                {/* Calculator badge */}
                <Skeleton className="h-6 w-20 ml-2" />
              </div>
            </div>
            {index < itemCount - 1 && <Separator className="my-3" />}
          </div>
        ))}

        {/* Add formula button */}
        <div className="pt-2">
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
