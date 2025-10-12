/**
 * Chart Placeholder Component
 *
 * Placeholder for charts while loading or when no data is available.
 */

import { Card, CardContent } from "@/components/ui/card";
import { IconChartBar, IconAlertCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface ChartPlaceholderProps {
  title?: string;
  message?: string;
  type?: "loading" | "noData" | "error";
  className?: string;
}

/**
 * Chart Placeholder Component
 */
export function ChartPlaceholder({
  title,
  message,
  type = "loading",
  className,
}: ChartPlaceholderProps) {
  if (type === "loading") {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="p-6 h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === "error") {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="p-6 h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <IconAlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold mb-1">{title || "Erro ao carregar"}</h3>
              <p className="text-sm text-muted-foreground">
                {message || "Não foi possível carregar os dados."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="p-6 h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <IconChartBar className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-semibold mb-1">{title || "Sem dados"}</h3>
            <p className="text-sm text-muted-foreground">
              {message || "Não há dados disponíveis para o período selecionado."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
