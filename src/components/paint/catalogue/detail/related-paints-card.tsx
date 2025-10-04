import { useNavigate } from "react-router-dom";
import { IconLink } from "@tabler/icons-react";

import type { Paint } from "../../../../types";
import { PAINT_BRAND_LABELS, PAINT_FINISH_LABELS } from "../../../../constants";
import { routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RelatedPaintsCardProps {
  paint: Paint;
}

export function RelatedPaintsCard({ paint }: RelatedPaintsCardProps) {
  const navigate = useNavigate();

  // Combine related paints and remove duplicates
  const allRelated = [...(paint.relatedPaints || []), ...(paint.relatedTo || [])].filter((relatedPaint, index, self) => index === self.findIndex((p) => p.id === relatedPaint.id));

  const handlePaintClick = (paintId: string) => {
    navigate(routes.painting.catalog.details(paintId));
  };

  if (allRelated.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-sm border border-border" level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconLink className="h-5 w-5 text-primary" />
          </div>
          Tintas Relacionadas ({allRelated.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="overflow-x-auto pb-4 -mx-6 px-6">
          <div className="flex gap-4 w-max">
            {allRelated.map((relatedPaint) => (
              <div
                key={relatedPaint.id}
                className="bg-muted/50 rounded-lg p-4 hover:bg-muted/70 transition-colors cursor-pointer w-64"
                onClick={() => handlePaintClick(relatedPaint.id)}
              >
                <div className="space-y-3">
                  {/* Color Strip */}
                  <div className="h-16 rounded-md border" style={{ backgroundColor: relatedPaint.hex }} />

                  {/* Paint Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">{relatedPaint.name}</h4>
                    <code className="text-xs font-mono text-muted-foreground">{relatedPaint.hex}</code>
                    <div className="flex flex-wrap gap-1">
                      {relatedPaint.brand && (
                        <Badge variant="secondary" className="text-xs">
                          {PAINT_BRAND_LABELS[relatedPaint.brand]}
                        </Badge>
                      )}
                      {relatedPaint.finish && (
                        <Badge variant="outline" className="text-xs">
                          {PAINT_FINISH_LABELS[relatedPaint.finish]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
