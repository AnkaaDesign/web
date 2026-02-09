import { useNavigate } from "react-router-dom";
import type { PaintProduction } from "../../../../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { routes, PAINT_FINISH } from "../../../../constants";
import { IconFlask, IconCalendar, IconDroplet, IconScale, IconColorSwatch, IconTruckLoading, IconSparkles, IconAlertTriangle } from "@tabler/icons-react";
import { formatDateTime, formatCurrency } from "../../../../utils";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import { CanvasNormalMapRenderer } from "../../effects/canvas-normal-map-renderer";

interface PaintProductionCardProps {
  production: PaintProduction;
}

export function PaintProductionCard({ production }: PaintProductionCardProps) {
  const navigate = useNavigate();

  const paint = production.formula?.paint;
  const formula = production.formula;

  // Get labels for paint properties
  const finishLabel = paint?.finish ? PAINT_FINISH_LABELS[paint.finish] || paint.finish : "";
  const brandLabel = paint?.paintBrand?.name || "";
  const manufacturerLabel = paint?.manufacturer ? TRUCK_MANUFACTURER_LABELS[paint.manufacturer] || paint.manufacturer : null;

  // Color for the paint preview
  const paintColor = paint?.hex || "#cccccc";

  const handleClick = () => {
    if (paint?.id) {
      navigate(routes.painting.catalog.details(paint.id));
    }
  };

  // Handle missing paint/formula data
  const hasPaintData = paint && formula;
  if (!hasPaintData) {
    return (
      <Card className="overflow-hidden h-full flex flex-col opacity-75">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="w-12 h-12 rounded-full border-2 border-border flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <IconAlertTriangle className="h-6 w-6 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-muted-foreground">Dados da tinta não encontrados</h3>
            <p className="text-sm text-muted-foreground">Fórmula ou tinta pode ter sido removida</p>
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <IconDroplet className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-sm font-medium">{production.volumeLiters.toFixed(3)}L</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Produzido em</p>
              <p className="text-sm font-medium">{formatDateTime(production.createdAt)}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-sm transition-shadow cursor-pointer h-full flex flex-col" onClick={handleClick}>
      {/* Header with paint color preview */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {/* Color preview - prefer colorPreview image */}
        <div className="w-12 h-12 rounded-md ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
          {paint?.colorPreview ? (
            <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" loading="lazy" />
          ) : paint?.finish ? (
            <CanvasNormalMapRenderer baseColor={paintColor} finish={paint.finish as PAINT_FINISH} width={48} height={48} quality="medium" className="w-full h-full" />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: paintColor }} />
          )}
        </div>

        {/* Paint and formula info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base line-clamp-1">{paint?.name || "Tinta não encontrada"}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{formula?.description || "Fórmula sem descrição"}</p>
        </div>
      </div>

      {/* Production details */}
      <div className="p-4 space-y-3 flex-1">
        {/* Production volume and date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <IconDroplet className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-sm font-medium">{production.volumeLiters.toFixed(3)}L</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Produzido em</p>
              <p className="text-sm font-medium">{formatDateTime(production.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Formula details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconFlask className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-muted-foreground">Densidade: {formula?.density?.toFixed(2) || "N/A"} g/ml</span>
          </div>

          {formula?.pricePerLiter && (
            <div className="flex items-center gap-2">
              <IconScale className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-muted-foreground">Custo: {formatCurrency(formula.pricePerLiter)}/L</span>
            </div>
          )}
        </div>

        {/* Paint badges */}
        {paint && (
          <div className="flex flex-wrap gap-1">
            {finishLabel && (
              <Badge variant="secondary" className="text-xs">
                <IconSparkles className="h-3 w-3 mr-1" />
                {finishLabel}
              </Badge>
            )}

            {brandLabel && (
              <Badge variant="outline" className="text-xs">
                {brandLabel}
              </Badge>
            )}

            {manufacturerLabel && (
              <Badge variant="outline" className="text-xs">
                <IconTruckLoading className="h-3 w-3 mr-1" />
                {manufacturerLabel}
              </Badge>
            )}
          </div>
        )}

        {/* Paint type and color info */}
        {paint && (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconColorSwatch className="h-4 w-4 text-indigo-600" />
                <span className="text-sm text-muted-foreground">{paint.paintType?.name || "Tipo não especificado"}</span>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {paint.hex}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
