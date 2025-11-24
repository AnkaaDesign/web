import { useNavigate } from "react-router-dom";
import { IconLayersIntersect, IconDroplet, IconSparkles } from "@tabler/icons-react";

import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS } from "../../../../constants";
import { routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GroundPaintsCardProps {
  paint: Paint;
  className?: string;
}

export function GroundPaintsCard({ paint, className }: GroundPaintsCardProps) {
  const navigate = useNavigate();

  // Extract ground paints from the paint
  const groundPaints = paint.paintGrounds?.map((gp: any) => gp.groundPaint).filter(Boolean) || [];

  const handlePaintClick = (paintId: string) => {
    navigate(routes.painting.catalog.details(paintId));
  };

  if (groundPaints.length === 0) {
    return null;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6 flex-shrink-0">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconLayersIntersect className="h-5 w-5 text-primary" />
          </div>
          Fundos Recomendados ({groundPaints.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-y-auto">
        {/* Ground Paints Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {groundPaints.map((groundPaint: any) => (
            <div
              key={groundPaint.id}
              className="bg-muted/30 rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors border border-muted min-w-[280px] flex-shrink-0"
              onClick={() => handlePaintClick(groundPaint.id)}
            >
              <div className="flex items-start gap-3">
                {/* Small color preview - prefer colorPreview image */}
                <div className="w-12 h-12 rounded-md flex-shrink-0 ring-1 ring-muted shadow-sm overflow-hidden">
                  {groundPaint.colorPreview ? (
                    <img src={groundPaint.colorPreview} alt={groundPaint.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: groundPaint.hex }} />
                  )}
                </div>

                {/* Paint info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h6 className="font-medium text-sm truncate">{groundPaint.name}</h6>
                  <code className="text-xs font-mono text-muted-foreground">{groundPaint.hex}</code>
                  <div className="flex flex-wrap gap-1">
                    {groundPaint.paintType?.name && (
                      <Badge variant="secondary" className="text-xs">
                        <IconDroplet className="h-3 w-3 mr-1" />
                        {groundPaint.paintType.name}
                      </Badge>
                    )}
                    {groundPaint.finish && (
                      <Badge variant="secondary" className="text-xs">
                        <IconSparkles className="h-3 w-3 mr-1" />
                        {PAINT_FINISH_LABELS[groundPaint.finish]}
                      </Badge>
                    )}
                    {groundPaint.paintBrand?.name && (
                      <Badge variant="outline" className="text-xs">
                        {groundPaint.paintBrand.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
