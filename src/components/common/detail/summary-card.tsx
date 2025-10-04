import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface EssentialInfoItem {
  icon: ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string | ReactNode;
  action?: () => void;
  className?: string;
}

interface VisualStatus {
  type: "progress" | "gauge" | "badge";
  value: number;
  maxValue?: number;
  label: string;
  variant?: "default" | "success" | "warning" | "danger";
}

interface SummaryCardProps {
  essentialInfo: EssentialInfoItem[];
  visualStatus?: VisualStatus;
  className?: string;
}

export const SummaryCard = ({ essentialInfo, visualStatus, className }: SummaryCardProps) => {
  const renderVisualStatus = () => {
    if (!visualStatus) return null;

    switch (visualStatus.type) {
      case "progress":
        const percentage = visualStatus.maxValue ? (visualStatus.value / visualStatus.maxValue) * 100 : visualStatus.value;

        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{visualStatus.label}</span>
              <span className="text-sm text-muted-foreground">{visualStatus.maxValue ? `${visualStatus.value} / ${visualStatus.maxValue}` : `${Math.round(percentage)}%`}</span>
            </div>
            <div
              className={cn(
                "h-2",
                visualStatus.variant === "success" && "[&>div]:bg-[hsl(var(--success))]",
                visualStatus.variant === "warning" && "[&>div]:bg-[hsl(var(--warning))]",
                visualStatus.variant === "danger" && "[&>div]:bg-[hsl(var(--error))]",
              )}
            >
              <Progress value={percentage} />
            </div>
          </div>
        );

      case "gauge":
        // Simplified gauge representation
        const gaugePercentage = visualStatus.maxValue ? (visualStatus.value / visualStatus.maxValue) * 100 : visualStatus.value;

        return (
          <div className="relative w-32 h-32 mx-auto">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" className="text-muted" />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(gaugePercentage * 351.86) / 100} 351.86`}
                className={cn(
                  "transition-all duration-300",
                  visualStatus.variant === "success" && "text-[hsl(var(--success))]",
                  visualStatus.variant === "warning" && "text-[hsl(var(--warning))]",
                  visualStatus.variant === "danger" && "text-[hsl(var(--error))]",
                  !visualStatus.variant && "text-primary",
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{visualStatus.value}</span>
              <span className="text-xs text-muted-foreground">{visualStatus.label}</span>
            </div>
          </div>
        );

      case "badge":
        return (
          <div className="flex items-center justify-center p-6">
            <div
              className={cn(
                "px-6 py-3 rounded-full font-semibold text-lg",
                visualStatus.variant === "success" && "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
                visualStatus.variant === "warning" && "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
                visualStatus.variant === "danger" && "bg-[hsl(var(--error))]/15 text-[hsl(var(--error))]",
                !visualStatus.variant && "bg-primary/10 text-primary",
              )}
            >
              {visualStatus.value} {visualStatus.label}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6">
          {/* Essential Info Grid */}
          <div
            className={cn(
              "grid gap-4",
              essentialInfo.length <= 2 && "grid-cols-1 sm:grid-cols-2",
              essentialInfo.length === 3 && "grid-cols-1 sm:grid-cols-3",
              essentialInfo.length >= 4 && "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {essentialInfo.map((item, index) => (
              <div key={index} className={cn("flex items-start gap-3 group", item.action && "cursor-pointer", item.className)} onClick={item.action}>
                <div className="p-2 bg-muted rounded-lg group-hover:bg-muted/80 transition-colors">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <div className="mt-0.5 font-semibold">{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Visual Status */}
          {visualStatus && <div className="flex items-center justify-center border-l pl-6">{renderVisualStatus()}</div>}
        </div>
      </CardContent>
    </Card>
  );
};
