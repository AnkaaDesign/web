import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Maximize2, Grid, List, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHART_TYPE } from "../../constants";

export interface ChartContainerProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function ChartContainer({ children, className, title, subtitle, actions }: ChartContainerProps) {
  return (
    <Card className={cn("w-full", className)}>
      {(title || subtitle || actions) && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

export interface ChartGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function ChartGrid({ children, columns = 2, gap = "md", className }: ChartGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
  };

  const gapSize = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
  };

  return (
    <div className={cn("grid", gridCols[columns], gapSize[gap], className)}>
      {children}
    </div>
  );
}

export interface ChartExportButtonProps {
  onExport?: () => void;
  format?: "png" | "jpg" | "svg" | "pdf";
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
}

export function ChartExportButton({
  onExport,
  format = "png",
  disabled = false,
  size = "default"
}: ChartExportButtonProps) {
  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Default export logic
      console.log(`Exporting chart as ${format.toUpperCase()}...`);
      // In a real implementation, you might use html2canvas or similar
    }
  };

  return (
    <Button
      variant="outline"
      size={size === "default" ? "sm" : size}
      onClick={handleExport}
      disabled={disabled}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {format.toUpperCase()}
    </Button>
  );
}

export interface ChartTypeSelector {
  value: CHART_TYPE;
  onChange: (type: CHART_TYPE) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ChartTypeSelector({ value, onChange, disabled = false, compact = false }: ChartTypeSelector) {
  const chartTypes = [
    { value: CHART_TYPE.BAR, label: "Barras", icon: BarChart3 },
    { value: CHART_TYPE.LINE, label: "Linhas", icon: Grid },
    { value: CHART_TYPE.PIE, label: "Pizza", icon: Grid },
    { value: CHART_TYPE.AREA, label: "Área", icon: Grid },
    { value: CHART_TYPE.DONUT, label: "Rosca", icon: Grid },
    { value: CHART_TYPE.STACKED, label: "Empilhado", icon: List },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Button
              key={type.value}
              variant={value === type.value ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onChange(type.value)}
              disabled={disabled}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(newValue) => onChange(newValue as CHART_TYPE)}
      disabled={disabled}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Tipo de gráfico" />
      </SelectTrigger>
      <SelectContent>
        {chartTypes.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            <div className="flex items-center gap-2">
              <type.icon className="h-4 w-4" />
              {type.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface ChartMetricsProps {
  metrics: Array<{
    label: string;
    value: string | number;
    change?: number;
    format?: "currency" | "percentage" | "number";
  }>;
  className?: string;
}

export function ChartMetrics({ metrics, className }: ChartMetricsProps) {
  const formatValue = (value: string | number, format?: string) => {
    if (typeof value === "string") return value;

    switch (format) {
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

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {metrics.map((metric, index) => (
        <div key={index} className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-foreground">
            {formatValue(metric.value, metric.format)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {metric.label}
          </div>
          {metric.change !== undefined && (
            <div className={cn("text-xs mt-1", getChangeColor(metric.change))}>
              {metric.change > 0 ? "+" : ""}{metric.change.toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export interface ChartLoadingProps {
  height?: number;
  message?: string;
}

export function ChartLoading({ height = 400, message = "Carregando gráfico..." }: ChartLoadingProps) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-muted/30 rounded-lg animate-pulse"
      style={{ height }}
    >
      <div className="space-y-3 text-center">
        <div className="h-8 w-32 bg-muted rounded mx-auto" />
        <div className="h-4 w-24 bg-muted rounded mx-auto" />
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

export interface ChartErrorProps {
  height?: number;
  error: string;
  onRetry?: () => void;
}

export function ChartError({ height = 400, error, onRetry }: ChartErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-destructive bg-destructive/10 rounded-lg border border-destructive/20"
      style={{ height }}
    >
      <div className="text-center space-y-4 max-w-md">
        <div className="text-lg font-medium">Erro ao carregar gráfico</div>
        <div className="text-sm text-muted-foreground">{error}</div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ChartEmptyProps {
  height?: number;
  message?: string;
  action?: React.ReactNode;
}

export function ChartEmpty({
  height = 400,
  message = "Nenhum dado disponível para exibir",
  action
}: ChartEmptyProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30"
      style={{ height }}
    >
      <div className="text-center space-y-4 max-w-md">
        <div className="text-lg font-medium">{message}</div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

// Helper hook for managing chart state
export interface UseChartStateOptions {
  initialType?: CHART_TYPE;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useChartState(options: UseChartStateOptions = {}) {
  const {
    initialType = CHART_TYPE.BAR,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [chartType, setChartType] = React.useState<CHART_TYPE>(initialType);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());

  const refresh = React.useCallback(() => {
    setLastUpdated(new Date());
    setError(null);
  }, []);

  const setLoadingState = React.useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (loading) setError(null);
  }, []);

  const setErrorState = React.useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  // Auto-refresh effect
  React.useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    chartType,
    setChartType,
    isLoading,
    error,
    lastUpdated,
    refresh,
    setLoadingState,
    setErrorState,
  };
}