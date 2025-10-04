import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconExternalLink, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface RelatedEntity {
  id: string;
  title: string;
  subtitle?: string;
  badges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "outline" | "destructive";
  }>;
  metrics?: Array<{
    label: string;
    value: string | number;
  }>;
  onClick?: () => void;
}

interface RelatedEntitiesListProps {
  title: string;
  description?: string;
  entities: RelatedEntity[];
  emptyMessage?: string;
  onAdd?: () => void;
  addLabel?: string;
  viewAllUrl?: string;
  maxItems?: number;
  className?: string;
}

export const RelatedEntitiesList = ({
  title,
  description,
  entities,
  emptyMessage = "Nenhum item relacionado",
  onAdd,
  addLabel = "Adicionar",
  viewAllUrl,
  maxItems = 5,
  className,
}: RelatedEntitiesListProps) => {
  const displayedEntities = maxItems ? entities.slice(0, maxItems) : entities;
  const hasMore = entities.length > displayedEntities.length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {onAdd && (
            <Button size="sm" variant="outline" onClick={onAdd}>
              <IconPlus className="h-4 w-4 mr-2" />
              {addLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayedEntities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            {onAdd && (
              <Button size="sm" variant="outline" onClick={onAdd} className="mt-4">
                <IconPlus className="h-4 w-4 mr-2" />
                {addLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedEntities.map((entity) => (
              <div
                key={entity.id}
                className={cn("flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors", entity.onClick && "cursor-pointer")}
                onClick={entity.onClick}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{entity.title}</h4>
                    {entity.badges?.map((badge, index) => (
                      <Badge key={index} variant={badge.variant || "secondary"} className="text-xs">
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                  {entity.subtitle && <p className="text-sm text-muted-foreground truncate">{entity.subtitle}</p>}
                  {entity.metrics && entity.metrics.length > 0 && (
                    <div className="flex items-center gap-4 mt-2">
                      {entity.metrics.map((metric, index) => (
                        <div key={index} className="text-xs">
                          <span className="text-muted-foreground">{metric.label}: </span>
                          <span className="font-medium">{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {entity.onClick && <IconExternalLink className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
              </div>
            ))}

            {/* View All Link */}
            {(hasMore || viewAllUrl) && (
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (viewAllUrl) {
                      window.location.href = viewAllUrl;
                    }
                  }}
                >
                  Ver todos ({entities.length})
                  <IconExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
