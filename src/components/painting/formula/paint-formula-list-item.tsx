import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconFlask, IconPackage, IconDroplet } from "@tabler/icons-react";
import { IconBrush, IconCurrencyReal } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../constants";
import type { PaintFormula } from "../../../types";
import { formatCurrency, formatNumberWithDecimals } from "../../../utils";
import { cn } from "@/lib/utils";

interface PaintFormulaListItemProps {
  formula: PaintFormula;
  className?: string;
}

export function PaintFormulaListItem({ formula, className }: PaintFormulaListItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to paint details page since formulas are now managed there
    if (formula.paintId) {
      navigate(routes.painting.catalog.details(formula.paintId));
    }
  };

  const componentCount = formula.components?.length || 0;
  const hasValidDensity = formula.density && Number(formula.density) > 0;
  const hasValidPrice = formula.pricePerLiter && Number(formula.pricePerLiter) > 0;

  return (
    <Card className={cn("hover:shadow-sm transition-all duration-200 cursor-pointer", "border hover:border-primary/50", className)} onClick={handleClick}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <IconBrush className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="truncate">{formula.paint?.name || "Tinta sem nome"}</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm truncate">{formula.description || "Sem descrição"}</CardDescription>
          </div>
          {formula.paint?.id && (
            <Badge variant="outline" className="ml-1 sm:ml-2 text-xs sm:text-sm whitespace-nowrap">
              {formula.paint.id.slice(0, 8)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4">
        {/* Component Count */}
        <div className="flex items-center gap-2">
          <IconPackage className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          <span className="text-xs sm:text-sm text-muted-foreground">
            {componentCount} {componentCount === 1 ? "componente" : "componentes"}
          </span>
        </div>

        <Separator />

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Price per Liter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <IconCurrencyReal className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Preço/L</span>
            </div>
            <p className="text-xs sm:text-sm font-medium">{hasValidPrice ? formatCurrency(Number(formula.pricePerLiter)) : "-"}</p>
          </div>

          {/* Density */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <IconDroplet className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Densidade</span>
            </div>
            <p className="text-xs sm:text-sm font-medium font-mono">{hasValidDensity ? `${formatNumberWithDecimals(Number(formula.density), 2)} g/ml` : "-"}</p>
          </div>
        </div>

        {/* Component Preview */}
        {componentCount > 0 && formula.components && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <IconFlask className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Principais componentes:</span>
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {formula.components
                  .slice(0, 3)
                  .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
                  .map((component) => (
                    <Badge key={component.id} variant="secondary" className="text-xs max-w-full">
                      <span className="truncate">
                        {component.item?.name || "Item"} <span className="font-enhanced-unicode">•</span> {formatNumberWithDecimals(component.ratio || 0, 2)}%
                      </span>
                    </Badge>
                  ))}
                {componentCount > 3 && (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    +{componentCount - 3}
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-1 sm:pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              if (formula.paintId) {
                navigate(routes.painting.catalog.details(formula.paintId));
              }
            }}
            className="text-xs sm:text-sm"
          >
            Ver detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
