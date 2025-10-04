import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Maximize2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BaseChartProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: {
    variant?: "default" | "secondary" | "destructive" | "outline";
    children: React.ReactNode;
  };
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  height?: number;
  showExport?: boolean;
  showRefresh?: boolean;
  showFullscreen?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onExport?: () => void;
  onRefresh?: () => void;
  onFullscreen?: () => void;
  actions?: React.ReactNode;
}

export function BaseChart({
  title,
  description,
  icon,
  badge,
  children,
  className,
  contentClassName,
  height = 400,
  showExport = true,
  showRefresh = false,
  showFullscreen = false,
  isLoading = false,
  error = null,
  onExport,
  onRefresh,
  onFullscreen,
  actions,
}: BaseChartProps) {
  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Default export functionality - create a simple PNG download
      const chartElement = document.querySelector('.recharts-wrapper');
      if (chartElement) {
        // This is a simplified approach - in a real implementation,
        // you might want to use html2canvas or similar library
        console.log('Exporting chart as image...');
      }
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="text-primary">{icon}</div>}
            <div className="space-y-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm text-muted-foreground">
                  {description}
                </CardDescription>
              )}
            </div>
            {badge && (
              <Badge variant={badge.variant || "default"}>
                {badge.children}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {actions}
            {showRefresh && onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
            {showFullscreen && onFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onFullscreen}
                className="h-8 w-8"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {showExport && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExport}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("pt-0", contentClassName)}>
        {error ? (
          <div
            className="flex items-center justify-center text-destructive bg-destructive/10 rounded-lg border border-destructive/20"
            style={{ height }}
          >
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Erro ao carregar gráfico</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div
            className="flex items-center justify-center bg-muted/30 rounded-lg animate-pulse"
            style={{ height }}
          >
            <div className="text-center space-y-2">
              <div className="h-8 w-32 bg-muted rounded mx-auto" />
              <div className="h-4 w-24 bg-muted rounded mx-auto" />
            </div>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Color palettes based on project's theme
export const chartColors = {
  primary: ["#3B82F6", "#1D4ED8", "#2563EB", "#1E40AF", "#1E3A8A"],
  success: ["#10B981", "#059669", "#047857", "#065F46", "#064E3B"],
  warning: ["#F59E0B", "#D97706", "#B45309", "#92400E", "#78350F"],
  danger: ["#EF4444", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D"],
  neutral: ["#6B7280", "#4B5563", "#374151", "#1F2937", "#111827"],
  rainbow: [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // yellow
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#84CC16", // lime
    "#F97316", // orange
    "#14B8A6", // teal
  ],
};

// Common chart configurations
export const chartConfig = {
  margin: {
    top: 5,
    right: 30,
    left: 20,
    bottom: 5,
  },
  grid: {
    strokeDasharray: "3 3",
    stroke: "hsl(var(--border))",
  },
  axis: {
    fontSize: 12,
    fill: "hsl(var(--muted-foreground))",
  },
  tooltip: {
    contentStyle: {
      backgroundColor: "hsl(var(--background))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    },
    labelStyle: {
      color: "hsl(var(--foreground))",
    },
  },
  legend: {
    wrapperStyle: {
      paddingTop: "20px",
    },
  },
};

// Utility function to format numbers for display
export const formatChartValue = (value: number, type: "currency" | "percentage" | "number" = "number"): string => {
  switch (type) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString("pt-BR");
  }
};

// Utility function to get responsive height based on screen size
export const getResponsiveHeight = (baseHeight: number = 400): number => {
  if (typeof window === "undefined") return baseHeight;

  const width = window.innerWidth;
  if (width < 640) return Math.max(250, baseHeight * 0.6); // mobile
  if (width < 1024) return Math.max(300, baseHeight * 0.8); // tablet
  return baseHeight; // desktop
};