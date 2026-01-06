import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  scrollable?: boolean;
  maxHeight?: string;
}

export function DashboardSection({ title, children, className, action, scrollable = false, maxHeight = "max-h-[400px]" }: DashboardSectionProps) {
  return (
    <div className={cn("bg-card dark:bg-card rounded-lg shadow-sm", className)}>
      <div className="flex items-center justify-between p-4 pb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className={cn(scrollable ? `${maxHeight} overflow-y-auto custom-scrollbar px-6 pb-6` : "px-6 pb-6", "transition-all duration-200")}>{children}</div>
    </div>
  );
}
