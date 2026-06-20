// Shared progress bar used to show the admission document checklist completion
// (e.g. "6/6"). Reused by the Admissões table and the Colaboradores table so
// both render the document progress identically.

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DocumentProgressBarProps {
  done: number;
  total: number;
  className?: string;
}

export function DocumentProgressBar({ done, total, className }: DocumentProgressBarProps) {
  const isComplete = total > 0 && done >= total;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress
        value={done}
        max={total}
        className={cn("h-2 w-40", isComplete && "[&>div]:bg-green-600 dark:[&>div]:bg-green-500")}
      />
      <span className={cn("text-xs font-medium tabular-nums whitespace-nowrap", isComplete ? "text-green-700 dark:text-green-500" : "text-muted-foreground")}>
        {done}/{total}
      </span>
    </div>
  );
}
