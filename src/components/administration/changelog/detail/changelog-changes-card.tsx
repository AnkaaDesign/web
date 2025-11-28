import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconCode, IconArrowRight } from "@tabler/icons-react";
import type { ChangeLog } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatDateTime, formatCurrency } from "../../../../utils";

interface ChangelogChangesCardProps {
  changelog: ChangeLog;
  className?: string;
}

export function ChangelogChangesCard({ changelog, className }: ChangelogChangesCardProps) {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "—";
    }
    if (typeof value === "boolean") {
      return value ? "Sim" : "Não";
    }
    if (typeof value === "object") {
      if (value instanceof Date || (typeof value === "string" && !isNaN(Date.parse(value)))) {
        return formatDateTime(value);
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "number" && changelog.field?.toLowerCase().includes("price")) {
      return formatCurrency(value);
    }
    return String(value);
  };

  const renderFieldChange = () => {
    if (!changelog.field) {
      return <div className="text-sm text-muted-foreground text-center py-8">Nenhuma alteração de campo específico registrada</div>;
    }

    const isJsonValue = (value: any) => {
      return value && typeof value === "object" && !(value instanceof Date);
    };

    const oldValueIsJson = isJsonValue(changelog.oldValue);
    const newValueIsJson = isJsonValue(changelog.newValue);

    if (oldValueIsJson || newValueIsJson) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Campo Alterado</span>
            <span className="text-sm font-semibold text-foreground font-mono">{changelog.field}</span>
          </div>

          {changelog.oldValue !== null && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <span className="text-sm font-medium text-red-700 dark:text-red-400 block mb-2">Valor Anterior:</span>
              <pre className="text-xs bg-white dark:bg-gray-900 rounded p-3 overflow-auto max-h-48">
                <code>{formatValue(changelog.oldValue)}</code>
              </pre>
            </div>
          )}

          {changelog.newValue !== null && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <span className="text-sm font-medium text-green-700 dark:text-green-400 block mb-2">Novo Valor:</span>
              <pre className="text-xs bg-white dark:bg-gray-900 rounded p-3 overflow-auto max-h-48">
                <code>{formatValue(changelog.newValue)}</code>
              </pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Campo Alterado</span>
          <span className="text-sm font-semibold text-foreground font-mono">{changelog.field}</span>
        </div>

        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground block mb-1">Anterior</span>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
                <span className="text-sm font-medium text-red-700 dark:text-red-400 break-all">{formatValue(changelog.oldValue)}</span>
              </div>
            </div>

            <IconArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />

            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground block mb-1">Novo</span>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-md px-3 py-2">
                <span className="text-sm font-medium text-green-700 dark:text-green-400 break-all">{formatValue(changelog.newValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconCode className="h-5 w-5 text-muted-foreground" />
          Alterações
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">{renderFieldChange()}</CardContent>
    </Card>
  );
}
