import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAccessCardProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "yellow" | "gray" | "teal";
  onClick?: () => void;
  className?: string;
}

const colorMap = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-400/20",
    icon: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-green-500/10 dark:bg-green-400/20",
    icon: "text-green-600 dark:text-green-400",
  },
  purple: {
    bg: "bg-purple-500/10 dark:bg-purple-400/20",
    icon: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-400/20",
    icon: "text-orange-600 dark:text-orange-400",
  },
  red: {
    bg: "bg-red-500/10 dark:bg-red-400/20",
    icon: "text-red-600 dark:text-red-400",
  },
  yellow: {
    bg: "bg-yellow-500/10 dark:bg-yellow-400/20",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
  gray: {
    bg: "bg-neutral-500/10 dark:bg-neutral-400/20",
    icon: "text-neutral-600 dark:text-neutral-400",
  },
  teal: {
    bg: "bg-teal-500/10 dark:bg-teal-400/20",
    icon: "text-teal-600 dark:text-teal-400",
  },
};

export function QuickAccessCard({ title, icon: Icon, count, color = "blue", onClick, className }: QuickAccessCardProps) {
  const colors = colorMap[color];

  return (
    <Card className={cn("hover:shadow-md transition-all hover:scale-105 cursor-pointer", className)} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", colors.bg)}>
              <Icon className={cn("w-5 h-5", colors.icon)} />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{title}</h3>
              {count !== undefined && <p className="text-sm text-muted-foreground">{count} registros</p>}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/60" />
        </div>
      </CardContent>
    </Card>
  );
}
