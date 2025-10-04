import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime, formatRelativeTime } from "../../../../utils";
import { IconCalendar, IconClock, IconRotate, IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Maintenance } from "../../../../types";

interface LastRunDisplayProps {
  maintenance: Maintenance & {
    lastMaintenanceRun?: Maintenance; // Self-reference for last completed maintenance
    lastRun?: Date | null; // Optional lastRun field that might come from schedule
    nextRun?: Date | null; // Next run date for schedules
  };
  showTooltip?: boolean;
  variant?: "badge" | "card" | "inline";
  className?: string;
}

export function LastRunDisplay({ maintenance, showTooltip = true, variant = "inline", className }: LastRunDisplayProps) {
  const { lastRun, lastMaintenanceRun } = maintenance;

  // Determine what to display - prefer lastRun date over lastMaintenanceRun
  const displayDate = lastRun || lastMaintenanceRun?.finishedAt;
  const hasHistory = !!displayDate;
  const isFromSelfReference = !lastRun && !!lastMaintenanceRun;

  const renderContent = () => {
    if (!hasHistory) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <IconAlertCircle className="h-4 w-4" />
          <span className="text-sm">Nunca executada</span>
        </div>
      );
    }

    const date = new Date(displayDate!);
    const relativeTime = formatRelativeTime(date);
    const formattedDate = formatDate(date);
    const formattedDateTime = formatDateTime(date);

    const content = (
      <div className="flex items-center gap-2">
        <IconCircleCheck className="h-4 w-4 text-green-700" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{formattedDate}</span>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
        </div>
        {isFromSelfReference && (
          <Badge variant="outline" size="sm" className="ml-2">
            <IconRotate className="h-3 w-3 mr-1" />
            Ciclo Anterior
          </Badge>
        )}
      </div>
    );

    if (showTooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">{content}</div>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              <div className="space-y-2">
                <p className="font-medium">Última Execução</p>
                <div className="space-y-1 text-xs">
                  <p>
                    <span className="font-medium">Data:</span> {formattedDateTime}
                  </p>
                  <p>
                    <span className="font-medium">Tempo decorrido:</span> {relativeTime}
                  </p>
                  {isFromSelfReference && lastMaintenanceRun && (
                    <>
                      <hr className="my-2" />
                      <p className="font-medium text-muted-foreground">Referência do Ciclo Anterior:</p>
                      <p>
                        <span className="font-medium">Manutenção:</span> {lastMaintenanceRun.name}
                      </p>
                      <p>
                        <span className="font-medium">Status:</span> {lastMaintenanceRun.status}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  // Render based on variant
  if (variant === "badge") {
    return (
      <Badge
        variant={hasHistory ? "default" : "secondary"}
        className={cn("inline-flex items-center gap-2", hasHistory ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-50 text-gray-500", className)}
      >
        {hasHistory ? (
          <>
            <IconCircleCheck className="h-3 w-3" />
            {formatDate(new Date(displayDate!))}
          </>
        ) : (
          <>
            <IconAlertCircle className="h-3 w-3" />
            Nunca
          </>
        )}
      </Badge>
    );
  }

  if (variant === "card") {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", hasHistory ? "bg-green-100" : "bg-gray-100")}>
              {hasHistory ? <IconCalendar className="h-4 w-4 text-green-700" /> : <IconClock className="h-4 w-4 text-gray-500" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Última Execução</h4>
              {renderContent()}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default inline variant
  return <div className={cn("", className)}>{renderContent()}</div>;
}

// Helper component for compact display in tables
export function LastRunCompact({
  maintenance,
  className,
}: {
  maintenance: Maintenance & {
    lastMaintenanceRun?: Maintenance;
    lastRunMaintenance?: Maintenance;
    lastRun?: Date | null; // Optional lastRun field that might come from schedule
    nextRun?: Date | null; // Next run date for schedules
  };
  className?: string;
}) {
  const displayDate = maintenance.lastRun || maintenance.lastRunMaintenance?.finishedAt || maintenance.lastMaintenanceRun?.finishedAt;

  if (!displayDate) {
    return <span className={cn("text-muted-foreground text-sm", className)}>Nunca</span>;
  }

  const date = new Date(displayDate);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  let colorClass = "text-muted-foreground";
  if (diffInDays <= 30) {
    colorClass = "text-green-700";
  } else if (diffInDays <= 90) {
    colorClass = "text-blue-600";
  } else if (diffInDays <= 180) {
    colorClass = "text-yellow-600";
  } else {
    colorClass = "text-red-700";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-sm font-medium cursor-help", colorClass, className)}>{formatDate(date)}</span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p>{formatDateTime(date)}</p>
            <p>{formatRelativeTime(date)}</p>
            {!maintenance.lastRun && maintenance.lastMaintenanceRun && <p className="text-muted-foreground mt-1">(Ciclo anterior: {maintenance.lastMaintenanceRun.name})</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default LastRunDisplay;
