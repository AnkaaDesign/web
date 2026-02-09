import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { GroupByField } from "./GroupBySelector";
import type { Aggregation } from "./AggregationSelector";

export interface GroupingPreviewProps {
  groups: GroupByField[];
  aggregations: Aggregation[];
  sampleData?: any[];
  className?: string;
}

export function GroupingPreview({
  groups,
  aggregations,
  sampleData: _sampleData = [],
  className,
}: GroupingPreviewProps) {
  if (groups.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
          <CardDescription>Configure agrupamentos para ver a estrutura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum agrupamento definido</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Pré-visualização da Estrutura</CardTitle>
        <CardDescription>
          Como os dados serão agrupados ({groups.length} nível{groups.length > 1 ? "eis" : ""})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Hierarchy visualization */}
          <div className="space-y-2">
            {groups.map((group, index) => (
              <div key={group.id} className={cn("flex items-center gap-2", index > 0 && "ml-8")}>
                {index > 0 && (
                  <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Badge variant="outline" className="font-mono">
                  Nível {index + 1}
                </Badge>
                <span className="font-medium">{group.label}</span>
              </div>
            ))}
          </div>

          {/* Aggregations */}
          {aggregations.length > 0 && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">Agregações</div>
              <div className="space-y-1">
                {aggregations.map((agg) => (
                  <div key={agg.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {agg.function}
                    </Badge>
                    <span className="text-muted-foreground">de</span>
                    <span>{agg.label || agg.field}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample structure */}
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Exemplo de estrutura</div>
            <div className="rounded-lg bg-muted p-4 space-y-2 font-mono text-xs">
              {groups.map((group, index) => (
                <div key={group.id} style={{ marginLeft: `${index * 16}px` }}>
                  {"└ ".repeat(index > 0 ? 1 : 0)}
                  {group.label}: <span className="text-muted-foreground">[valores]</span>
                </div>
              ))}
              {aggregations.length > 0 && (
                <div style={{ marginLeft: `${groups.length * 16}px` }} className="text-primary">
                  └ Agregações: {aggregations.length} cálculo{aggregations.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
