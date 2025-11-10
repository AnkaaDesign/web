import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  IconCalculator,
  IconScale,
  IconFlask,
  IconShoppingCart,
  IconAlertTriangle,
  IconCircleCheck,
  IconBuildingFactory,
  IconCurrencyDollar,
  IconClock,
} from "@tabler/icons-react";
import type { PaintFormula } from "../../../types";
import { formatCurrency } from "../../../utils";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT } from "../../../constants";

interface ProductionCalculatorProps {
  formula: PaintFormula;
  onStartProduction?: (productionData: ProductionPlan) => void;
}

export interface ProductionPlan {
  formulaId: string;
  targetWeight: number;
  targetWeightUnit: MEASURE_UNIT;
  estimatedVolume: number;
  totalCost: number;
  componentRequirements: ComponentRequirement[];
  canProduce: boolean;
  missingComponents: string[];
}

interface ComponentRequirement {
  itemId: string;
  itemName: string;
  requiredWeight: number; // For production calculation
  requiredVolume: number; // For ordering calculation
  requiredUnits: number; // For inventory deduction
  unitCost: number;
  totalCost: number;
  availableStock: number;
  stockUnit: string;
  hasStock: boolean;
  density: number;
  percentageOfFormula: number;
}

export function ProductionCalculator({ formula, onStartProduction }: ProductionCalculatorProps) {
  const [targetWeight, setTargetWeight] = useState<number>(1000); // Default 1kg
  const [targetWeightUnit, setTargetWeightUnit] = useState<MEASURE_UNIT>(MEASURE_UNIT.GRAM);
  const [productionMode, setProductionMode] = useState<"weight" | "volume">("weight");
  const [targetVolume, setTargetVolume] = useState<number>(1); // Default 1L

  const components = formula.components || [];

  // Calculate base formula metrics
  const baseFormulaMetrics = useMemo(() => {
    const totalWeight = components.reduce((sum, comp) => {
      // Use ratio as percentage to estimate weight contribution
      return sum + (comp.ratio || 0);
    }, 0);

    const totalVolume = components.reduce((sum, comp) => {
      // Use ratio to estimate volume - simplified calculation
      // In a real implementation, you'd calculate from item measures
      return sum + (comp.ratio || 0);
    }, 0);

    const averageDensity = totalVolume > 0 ? totalWeight / totalVolume : formula.density;

    return {
      totalWeight,
      totalVolume,
      averageDensity,
    };
  }, [components, formula.density]);

  // Calculate production requirements
  const productionPlan = useMemo((): ProductionPlan => {
    let targetWeightInGrams: number;
    let estimatedVolume: number;

    if (productionMode === "weight") {
      targetWeightInGrams = targetWeightUnit === MEASURE_UNIT.KILOGRAM ? targetWeight * 1000 : targetWeight;
      estimatedVolume = targetWeightInGrams / baseFormulaMetrics.averageDensity; // in ml
    } else {
      estimatedVolume = targetVolume * 1000; // Convert L to ml
      targetWeightInGrams = estimatedVolume * baseFormulaMetrics.averageDensity;
    }

    const scalingFactor = baseFormulaMetrics.totalWeight > 0 ? targetWeightInGrams / baseFormulaMetrics.totalWeight : 0;

    const componentRequirements: ComponentRequirement[] = components.map((comp) => {
      const item = comp.item;
      // Use ratio as base calculation since PaintFormulaComponent doesn't have weight/volume values
      const baseWeight = comp.ratio || 0; // Use ratio as proxy for weight percentage
      const baseVolume = comp.ratio || 0; // Use ratio as proxy for volume percentage
      const density = 1; // Default density, would need to be calculated from item measures

      // Production calculations (weight-based)
      const requiredWeight = baseWeight * scalingFactor;
      const requiredVolume = baseVolume * scalingFactor;

      // Inventory calculations (based on item's unit)
      let requiredUnits = requiredWeight; // Default to grams

      // Get the first measure from the item if available
      const firstMeasure = item?.measures?.[0];
      const stockUnit = firstMeasure?.unit || MEASURE_UNIT.UNIT;
      const availableStock = item?.quantity || 0;

      if (stockUnit === MEASURE_UNIT.KILOGRAM) {
        requiredUnits = requiredWeight / 1000; // Convert to kg
      } else if (stockUnit === MEASURE_UNIT.LITER) {
        requiredUnits = requiredVolume / 1000; // Convert to liters
      } else if (stockUnit === MEASURE_UNIT.MILLILITER) {
        requiredUnits = requiredVolume; // Already in ml
      } else if (firstMeasure?.value) {
        // For items with specific weight per unit
        requiredUnits = requiredWeight / firstMeasure.value;
      }

      const unitCost = item?.prices?.[0]?.value || 0;
      const totalCost = requiredUnits * unitCost;
      const hasStock = availableStock >= requiredUnits;
      const percentageOfFormula = baseFormulaMetrics.totalWeight > 0 ? (baseWeight / baseFormulaMetrics.totalWeight) * 100 : 0;

      return {
        itemId: item?.id || "",
        itemName: item?.name || "Item não encontrado",
        requiredWeight,
        requiredVolume,
        requiredUnits,
        unitCost,
        totalCost,
        availableStock,
        stockUnit,
        hasStock,
        density,
        percentageOfFormula,
      };
    });

    const totalCost = componentRequirements.reduce((sum, req) => sum + req.totalCost, 0);
    const missingComponents = componentRequirements.filter((req) => !req.hasStock).map((req) => req.itemName);
    const canProduce = missingComponents.length === 0;

    return {
      formulaId: formula.id,
      targetWeight: targetWeightInGrams,
      targetWeightUnit: MEASURE_UNIT.GRAM,
      estimatedVolume: estimatedVolume / 1000, // Convert to liters
      totalCost,
      componentRequirements,
      canProduce,
      missingComponents,
    };
  }, [targetWeight, targetWeightUnit, targetVolume, productionMode, components, baseFormulaMetrics, formula.id]);

  const costPerLiter = productionPlan.estimatedVolume > 0 ? productionPlan.totalCost / productionPlan.estimatedVolume : 0;

  const stockStatusPercentage =
    productionPlan.componentRequirements.length > 0
      ? (productionPlan.componentRequirements.filter((req) => req.hasStock).length / productionPlan.componentRequirements.length) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Production Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuildingFactory className="h-5 w-5" />
            Calculadora de Produção
          </CardTitle>
          <CardDescription>Calcule materiais necessários para produção de tinta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button variant={productionMode === "weight" ? "default" : "outline"} onClick={() => setProductionMode("weight")} size="sm">
              <IconScale className="h-4 w-4 mr-2" />
              Por Peso
            </Button>
            <Button variant={productionMode === "volume" ? "default" : "outline"} onClick={() => setProductionMode("volume")} size="sm">
              <IconFlask className="h-4 w-4 mr-2" />
              Por Volume
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Input */}
            {productionMode === "weight" ? (
              <div>
                <Label htmlFor="targetWeight">Peso desejado</Label>
                <div className="flex gap-2">
                  <Input
                    id="targetWeight"
                    type="number"
                    value={targetWeight}
                    onChange={(value) => setTargetWeight(typeof value === "number" ? value : 0)}
                    min="0"
                    step="0.1"
                    className="flex-1"
                  />
                  <select value={targetWeightUnit} onChange={(e) => setTargetWeightUnit(e.target.value as MEASURE_UNIT)} className="px-3 py-1 border rounded-md bg-background">
                    <option value={MEASURE_UNIT.GRAM}>g</option>
                    <option value={MEASURE_UNIT.KILOGRAM}>kg</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="targetVolume">Volume desejado (L)</Label>
                <Input id="targetVolume" type="number" value={targetVolume} onChange={(value) => setTargetVolume(typeof value === "number" ? value : 0)} min="0" step="0.1" />
              </div>
            )}

            {/* Production Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Produção Estimada</div>
              <div className="text-lg font-bold">
                {measureUtils.formatMeasure({
                  value: productionPlan.targetWeight,
                  unit: MEASURE_UNIT.GRAM,
                })}
              </div>
              <div className="text-sm text-muted-foreground">Volume: {productionPlan.estimatedVolume.toFixed(2)} L</div>
              <div className="text-sm text-muted-foreground">Densidade: {baseFormulaMetrics.averageDensity.toFixed(3)} g/ml</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconShoppingCart className="h-5 w-5" />
            Status de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Disponibilidade dos Componentes</span>
              <span className="text-sm font-medium">{stockStatusPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full">
              <Progress value={stockStatusPercentage} />
            </div>

            {productionPlan.missingComponents.length > 0 && (
              <Alert variant="destructive">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">Componentes em falta:</div>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {productionPlan.missingComponents.map((component, index) => (
                      <li key={index}>{component}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Component Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Requisitos dos Componentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {productionPlan.componentRequirements.map((req, index) => (
              <div key={req.itemId || index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium">{req.itemName}</h5>
                      {req.hasStock ? <IconCircleCheck className="h-4 w-4 text-green-500" /> : <IconAlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                      {/* Weight for Production */}
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconScale className="h-3 w-3" />
                          <span>Produção:</span>
                        </div>
                        <Badge variant="secondary">
                          {measureUtils.formatMeasure({
                            value: req.requiredWeight,
                            unit: MEASURE_UNIT.GRAM,
                          })}
                        </Badge>
                      </div>

                      {/* Volume for Ordering */}
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconFlask className="h-3 w-3" />
                          <span>Volume:</span>
                        </div>
                        <Badge variant="secondary">
                          {measureUtils.formatMeasure({
                            value: req.requiredVolume,
                            unit: MEASURE_UNIT.MILLILITER,
                          })}
                        </Badge>
                      </div>

                      {/* Inventory Units */}
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconShoppingCart className="h-3 w-3" />
                          <span>Estoque:</span>
                        </div>
                        <Badge variant={req.hasStock ? "default" : "destructive"}>
                          {req.requiredUnits.toFixed(2)} {req.stockUnit}
                        </Badge>
                      </div>

                      {/* Cost */}
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconCurrencyDollar className="h-3 w-3" />
                          <span>Custo:</span>
                        </div>
                        <Badge variant="outline">{formatCurrency(req.totalCost)}</Badge>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      Disponível: {req.availableStock} {req.stockUnit}
                      <span className="font-enhanced-unicode">•</span> Densidade: {req.density.toFixed(3)} g/ml
                      <span className="font-enhanced-unicode">•</span> {req.percentageOfFormula.toFixed(1)}% da fórmula
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Production Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalculator className="h-5 w-5" />
            Resumo da Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Peso Total</div>
              <div className="text-xl font-bold">
                {measureUtils.formatMeasure({
                  value: productionPlan.targetWeight,
                  unit: MEASURE_UNIT.GRAM,
                })}
              </div>
            </div>

            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Volume Estimado</div>
              <div className="text-xl font-bold">{productionPlan.estimatedVolume.toFixed(2)} L</div>
            </div>

            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Custo Total</div>
              <div className="text-xl font-bold">{formatCurrency(productionPlan.totalCost)}</div>
            </div>

            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Custo por Litro</div>
              <div className="text-xl font-bold">{formatCurrency(costPerLiter)}</div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!productionPlan.canProduce} onClick={() => onStartProduction?.(productionPlan)}>
              <IconBuildingFactory className="h-4 w-4 mr-2" />
              {productionPlan.canProduce ? "Iniciar Produção" : "Estoque Insuficiente"}
            </Button>
            <Button variant="outline">
              <IconClock className="h-4 w-4 mr-2" />
              Salvar Plano
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
