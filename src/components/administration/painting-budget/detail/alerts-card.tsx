import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvePaintingAlert } from "@/hooks";
import type { PaintingAlertSeverity, PaintingAnalysisAlert } from "@/types";

const SEVERITY_VARIANTS: Record<PaintingAlertSeverity, BadgeProps["variant"]> = {
  INFO: "blue",
  WARNING: "pending",
  ERROR: "red",
};

const SEVERITY_LABELS: Record<PaintingAlertSeverity, string> = {
  INFO: "Info",
  WARNING: "Aviso",
  ERROR: "Erro",
};

interface AlertsCardProps {
  alerts: PaintingAnalysisAlert[];
}

/** Alertas não resolvidos da análise, com ação de resolver. */
export function AlertsCard({ alerts }: AlertsCardProps) {
  const resolveAlertMutation = useResolvePaintingAlert();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
              alert.severity === "WARNING" || alert.severity === "ERROR" ? "border-amber-500/40 bg-amber-500/10" : "border-blue-500/40 bg-blue-500/10"
            }`}
          >
            {alert.severity === "WARNING" || alert.severity === "ERROR" ? (
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            ) : (
              <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            )}
            <div className="flex flex-1 flex-col gap-1">
              <span>{alert.message}</span>
              <span className="flex items-center gap-2">
                <Badge variant={SEVERITY_VARIANTS[alert.severity]} size="sm">
                  {SEVERITY_LABELS[alert.severity]}
                </Badge>
                <span className="text-xs text-muted-foreground">{alert.code}</span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => resolveAlertMutation.mutate(alert.id)} disabled={resolveAlertMutation.isPending}>
              Resolver
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
