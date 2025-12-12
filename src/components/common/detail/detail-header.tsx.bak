import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface KeyMetric {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  severity?: "success" | "warning" | "danger";
  icon?: ComponentType<{ className?: string }>;
}

interface Action {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
}

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  status?: {
    label: string;
    variant?: "default" | "secondary" | "outline" | "destructive";
  };
  keyMetrics?: KeyMetric[];
  primaryAction?: Action;
  secondaryActions?: Action[];
  backUrl?: string;
  onRefresh?: () => void;
  className?: string;
}

export const DetailHeader = ({ title, subtitle, status, keyMetrics = [], primaryAction, secondaryActions = [], backUrl, onRefresh, className }: DetailHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backUrl) {
      navigate(backUrl);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Main Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 pb-4 border-b">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left Section */}
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack} className="mt-1">
              <IconArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-bold">{title}</h1>
                {status && <Badge variant={status.variant || "default"}>{status.label}</Badge>}
              </div>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2 ml-12 lg:ml-0">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <IconRefresh className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            )}
            {secondaryActions.map((action, index) => (
              <Button key={index} variant={action.variant || "outline"} size="sm" onClick={action.onClick}>
                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                {action.label}
              </Button>
            ))}
            {primaryAction && (
              <Button variant={primaryAction.variant || "default"} size="sm" onClick={primaryAction.onClick}>
                {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-2" />}
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        {keyMetrics.length > 0 && (
          <div className="flex flex-wrap gap-6 mt-4 ml-12">
            {keyMetrics.map((metric, index) => (
              <div key={index} className="flex items-center gap-3">
                {metric.icon && <metric.icon className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      metric.severity === "success" && "text-green-600",
                      metric.severity === "warning" && "text-yellow-600",
                      metric.severity === "danger" && "text-red-600",
                    )}
                  >
                    {metric.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
