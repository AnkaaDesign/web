import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PriceDisplayProps {
  children: ReactNode;
  className?: string;
}

export function PriceDisplay({ children, className }: PriceDisplayProps) {
  return <span className={cn("price-value", className)}>{children}</span>;
}
