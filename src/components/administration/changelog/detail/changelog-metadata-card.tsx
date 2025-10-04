import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconInfoCircle } from "@tabler/icons-react";
import type { ChangeLog } from "../../../../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChangelogMetadataCardProps {
  changelog: ChangeLog;
  className?: string;
}

export function ChangelogMetadataCard({ changelog, className }: ChangelogMetadataCardProps) {
  const hasMetadata = changelog.metadata && Object.keys(changelog.metadata).length > 0;

  const renderMetadataValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }

    if (typeof value === "boolean") {
      return <Badge variant={value ? "success" : "secondary"}>{value ? "Sim" : "Não"}</Badge>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">Lista vazia</span>;
      }
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="text-sm">
              • {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      return (
        <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32">
          <code>{JSON.stringify(value, null, 2)}</code>
        </pre>
      );
    }

    return <span className="text-sm">{String(value)}</span>;
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconFileText className="h-5 w-5 text-primary" />
          </div>
          Metadados
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {!hasMetadata ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconInfoCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum metadado adicional registrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Dados Adicionais</h3>
              <div className="space-y-3">
                {Object.entries(changelog.metadata).map(([key, value]) => (
                  <div key={key} className="bg-background rounded-lg px-3 py-2">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-sm font-medium text-muted-foreground min-w-[120px]">{key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}:</span>
                      <div className="flex-1 text-right">{renderMetadataValue(value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {typeof changelog.metadata === "object" && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Ver JSON completo</summary>
                <div className="mt-2">
                  <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-64">
                    <code>{JSON.stringify(changelog.metadata, null, 2)}</code>
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
