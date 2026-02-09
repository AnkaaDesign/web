import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconScale, IconFlask, IconCalculator, IconPackage } from "@tabler/icons-react";
import type { PaintFormula } from "../../../types";
import { formatCurrency } from "../../../utils";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT, SECTOR_PRIVILEGES } from "../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { DensityValidator } from "./density-validator";
import { FormulaComponentsRatioTable } from "./formula-components-ratio-table";
import { PaintFormulaChangelogHistoryCard } from "./paint-formula-changelog-history-card";

interface PaintFormulaDetailProps {
  formula: PaintFormula;
}

export function PaintFormulaDetail({ formula }: PaintFormulaDetailProps) {
  const { user } = useAuth();
  const components = formula.components || [];

  // Hide prices for warehouse users
  const isWarehouseUser = user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;
  const showPrices = !isWarehouseUser;

  // Calculate total ratio (should be 100%)
  const totalRatio = components.reduce((sum, comp) => sum + (comp.ratio || 0), 0);
  const ratioMismatch = Math.abs(totalRatio - 100) > 0.1;

  return (
    <div className="space-y-4">
      {/* Formula Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <IconFlask className="h-4 w-4" />
                Fórmula da Tinta
              </CardTitle>
              <CardDescription>{formula.description}</CardDescription>
            </div>
            <div className="text-right">
              {showPrices && (
                <div className="text-2xl font-bold text-primary">{formatCurrency(Number(formula.pricePerLiter))}/L</div>
              )}
              <div className="text-sm text-muted-foreground">Densidade: {Number(formula.density).toFixed(3)} g/ml</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Density Validation */}
      <DensityValidator formula={formula} />

      {/* Components List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <IconPackage className="h-4 w-4" />
            Componentes ({components.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {components.map((component, index) => (
              <div key={component.id || index}>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{component.item?.name || `Componente ${index + 1}`}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {/* Ratio Display */}
                      <div className="flex items-center gap-1">
                        <IconCalculator className="h-3 w-3" />
                        <span>Proporção:</span>
                        <Badge variant="secondary">{(component.ratio || 0).toFixed(1)}%</Badge>
                      </div>

                      {/* Item measures if available */}
                      {component.item?.measures && component.item.measures.length > 0 && (
                        <>
                          {component.item.measures.find((m) => m.measureType === "WEIGHT") && (
                            <div className="flex items-center gap-1">
                              <IconScale className="h-3 w-3" />
                              <span>Peso unitário:</span>
                              <Badge variant="outline">
                                {measureUtils.formatMeasure({
                                  value: component.item.measures.find((m) => m.measureType === "WEIGHT")?.value || 0,
                                  unit: component.item.measures.find((m) => m.measureType === "WEIGHT")?.unit || MEASURE_UNIT.GRAM,
                                })}
                              </Badge>
                            </div>
                          )}
                          {component.item.measures.find((m) => m.measureType === "VOLUME") && (
                            <div className="flex items-center gap-1">
                              <IconFlask className="h-3 w-3" />
                              <span>Volume unitário:</span>
                              <Badge variant="outline">
                                {measureUtils.formatMeasure({
                                  value: component.item.measures.find((m) => m.measureType === "VOLUME")?.value || 0,
                                  unit: component.item.measures.find((m) => m.measureType === "VOLUME")?.unit || MEASURE_UNIT.MILLILITER,
                                })}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Item Details */}
                    {component.item && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Estoque: {component.item.quantity} {component.item.measures?.[0]?.unit || "un"}
                        {showPrices && component.item.prices?.[0] && (
                          <span className="ml-2">
                            <span className="font-enhanced-unicode">•</span> Preço: {formatCurrency(component.item.prices[0].value)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {/* Ratio percentage */}
                    <div className="text-base font-semibold text-primary">{(component.ratio || 0).toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">da fórmula</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Formula Summary */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Total de Componentes</div>
                <div className="text-xl font-bold">{components.length}</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Soma das Proporções</div>
                <div className="text-xl font-bold">{totalRatio.toFixed(1)}%</div>
                {ratioMismatch && (
                  <div className="text-xs text-destructive mt-1">
                    <IconAlertTriangle className="h-3 w-3 inline mr-1" />
                    Deve somar 100%
                  </div>
                )}
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Densidade da Fórmula</div>
                <div className="text-xl font-bold">{Number(formula.density).toFixed(3)} g/ml</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components Ratio Table */}
      <FormulaComponentsRatioTable components={components} />

      {/* Changelog History */}
      <PaintFormulaChangelogHistoryCard formula={formula} />
    </div>
  );
}
