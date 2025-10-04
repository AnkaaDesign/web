import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Activity {
  item: string;
  info: string;
  quantity: string;
  time: string;
}

interface RecentActivitiesCardProps {
  title: string;
  activities: Activity[];
  icon: LucideIcon;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "yellow";
  className?: string;
}

const colorMap = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  purple: "text-purple-600 dark:text-purple-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
};

export function RecentActivitiesCard({ title, activities, icon: Icon, color = "blue", className }: RecentActivitiesCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (activities.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % activities.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [activities.length]);

  if (activities.length === 0) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className={cn("w-3.5 h-3.5", colorMap[color])} />
            <h3 className="text-xs font-semibold text-foreground leading-tight">{title}</h3>
          </div>
          <div className="h-20 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Sem atividades recentes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activity = activities[currentIndex];

  return (
    <Card className={cn("h-full hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className={cn("w-3.5 h-3.5", colorMap[color])} />
          <h3 className="text-xs font-semibold text-foreground leading-tight">{title}</h3>
        </div>
        <div className="h-20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{activity.item}</p>
              <p className="text-xs text-muted-foreground">{activity.info}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{activity.quantity}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
          {activities.length > 1 && (
            <div className="flex gap-1 justify-center mt-2">
              {activities.map((_, index) => (
                <div key={index} className={cn("h-1 rounded-full transition-all", index === currentIndex ? "bg-neutral-800 dark:bg-neutral-200 w-3" : "bg-neutral-300 dark:bg-neutral-600 w-1")} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
