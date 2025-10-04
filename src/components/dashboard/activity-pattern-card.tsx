import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PatternData {
  label: string;
  value: number;
}

interface ActivityPatternCardProps {
  title: string;
  data: PatternData[];
  icon: LucideIcon;
  className?: string;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "yellow";
}

const colorMap = {
  blue: "bg-blue-600 dark:bg-blue-500",
  green: "bg-green-600 dark:bg-green-500",
  purple: "bg-purple-600 dark:bg-purple-500",
  orange: "bg-orange-600 dark:bg-orange-500",
  red: "bg-red-600 dark:bg-red-500",
  yellow: "bg-yellow-600 dark:bg-yellow-500",
};

export function ActivityPatternCard({ title, data, icon: Icon, className, color = "blue", labelWidth = "w-36" }: ActivityPatternCardProps & { labelWidth?: string }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card className={cn("hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground leading-tight">{title}</h3>
        </div>
        <div className="space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className={`text-xs text-muted-foreground ${labelWidth} text-left truncate`} title={item.label}>
                {item.label}
              </span>
              <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 relative overflow-hidden">
                <div
                  className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-500", colorMap[color])}
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground w-10 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
