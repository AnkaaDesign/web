import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", "motion-reduce:animate-none", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando..."
      {...props}
    />
  );
}

export { Skeleton };
