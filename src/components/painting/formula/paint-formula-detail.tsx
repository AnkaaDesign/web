import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconAlertTriangle, IconScale, IconFlask, IconCalculator, IconPackage } from "@tabler/icons-react";
import type { PaintFormula } from "../../../types";
import { formatCurrency } from "../../../utils";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT } from "../../../constants";
import { DensityValidator } from "./density-validator";
import { FormulaComponentsRatioTable } from "./formula-components-ratio-table";

interface PaintFormulaDetailProps {
  formula: PaintFormula;
}

export function PaintFormulaDetail({ formula }: PaintFormulaDetailProps) {
  const components = formula.components || [];

  // Calculate total ratio (should be 100%)
  const totalRatio = components.reduce((sum, comp) => sum + (comp.ratio || 0), 0);
  const ratioMismatch = Math.abs(totalRatio - 100) > 0.1;

  return (
    <div className="space-y-6">
      {/* Formula Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconFlask className="h-5 w-5" />
                Fórmula da Tinta
              </CardTitle>
              <CardDescription>{formula.description}</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{formatCurrency(Number(formula.pricePerLiter))}/L</div>
              <div className="text-sm text-muted-foreground">Densidade: {Number(formula.density).toFixed(3)} g/ml</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Density Validation */}
      <DensityValidator formula={formula} />

      {/* Components List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPackage className="h-5 w-5" />
            Componentes ({components.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {components.map((component, index) => (
              <div key={component.id || index}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{component.item?.name || `Componente ${index + 1}`}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
                      <div className="mt-2 text-xs text-muted-foreground">
                        Estoque: {component.item.quantity} {component.item.measures?.[0]?.unit || "un"}
                        {component.item.prices?.[0] && (
                          <span className="ml-2">
                            <span className="font-enhanced-unicode">•</span> Preço: {formatCurrency(component.item.prices[0].value)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {/* Ratio percentage */}
                    <div className="text-lg font-semibold text-primary">{(component.ratio || 0).toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">da fórmula</div>
                  </div>
                </div>

                {index < components.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>

          {/* Formula Summary */}
          <Separator className="my-4" />
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
        </CardContent>
      </Card>

      {/* Components Ratio Table */}
      <FormulaComponentsRatioTable components={components} />
    </div>
  );
}
