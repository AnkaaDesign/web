import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  status: string;
  quantity: number;
  total: number;
  icon: LucideIcon;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "yellow" | "gray";
  unit?: string;
  className?: string;
}

const colorMap = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500 dark:bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    bg: "bg-green-500 dark:bg-green-600",
    text: "text-green-600 dark:text-green-400",
  },
  purple: {
    icon: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500 dark:bg-purple-600",
    text: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500 dark:bg-orange-600",
    text: "text-orange-600 dark:text-orange-400",
  },
  red: {
    icon: "text-red-600 dark:text-red-400",
    bg: "bg-red-500 dark:bg-red-600",
    text: "text-red-600 dark:text-red-400",
  },
  yellow: {
    icon: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500 dark:bg-yellow-600",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  gray: {
    icon: "text-neutral-600 dark:text-neutral-400",
    bg: "bg-neutral-500 dark:bg-neutral-600",
    text: "text-neutral-600 dark:text-neutral-400",
  },
};

export function StatusCard({ status, quantity, total, icon: Icon, color = "blue", unit = "itens", className }: StatusCardProps) {
  const percentage = total > 0 ? (quantity / total) * 100 : 0;
  const colors = colorMap[color];

  return (
    <Card className={cn("hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn("w-3.5 h-3.5", colors.icon)} />
          <span className={cn("text-xs font-medium", colors.text)}>{percentage.toFixed(1)}%</span>
        </div>
        <h3 className="text-xs font-semibold text-foreground mb-1">{status}</h3>
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold text-foreground">{quantity}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        <div className="mt-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1 overflow-hidden">
          <div className={cn("h-full transition-all duration-500", colors.bg)} style={{ width: `${percentage}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
