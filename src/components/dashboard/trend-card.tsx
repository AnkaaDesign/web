import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendCardProps {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  percentage?: number;
  icon: LucideIcon;
  subtitle?: string;
  className?: string;
}

export function TrendCard({ title, value, trend = "stable", percentage = 0, icon: Icon, subtitle, className }: TrendCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColorClass = trend === "up" ? "text-green-600 dark:text-green-400" : trend === "down" ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400";

  const trendBgClass = trend === "up" ? "bg-green-500/10 dark:bg-green-400/20" : trend === "down" ? "bg-red-500/10 dark:bg-red-400/20" : "bg-neutral-500/10 dark:bg-neutral-400/20";

  return (
    <Card className={cn("hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 bg-neutral-500/10 dark:bg-neutral-400/20 rounded">
            <Icon className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
          </div>
          {percentage !== undefined && (
            <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded-full", trendBgClass, trendColorClass)}>
              <TrendIcon className="w-2.5 h-2.5" />
              <span className="text-xs font-medium">{Math.abs(percentage)}%</span>
            </div>
          )}
        </div>
        <h3 className="text-lg font-bold text-foreground">{value}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground/80">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
