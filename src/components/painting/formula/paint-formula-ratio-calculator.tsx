import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { IconCalculator, IconScale, IconFlask, IconShoppingCart, IconAlertTriangle, IconPackage, IconLoader } from "@tabler/icons-react";
import type { PaintFormula } from "../../../types";
import { formatCurrency } from "../../../utils";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT, routes } from "../../../constants";
import { usePaintProductionMutations } from "../../../hooks";

interface PaintFormulaRatioCalculatorProps {
  formula: PaintFormula;
}

interface ComponentCalculation {
  id: string;
  name: string;
  ratio: number;
  calculatedWeight: number;
  calculatedVolume: number;
  availableStock: number;
  stockUnit: string;
  requiredUnits: number;
  unitPrice: number;
  totalCost: number;
  hasStock: boolean;
  itemDensity: number;
}

export function PaintFormulaRatioCalculator({ formula }: PaintFormulaRatioCalculatorProps) {
  const navigate = useNavigate();
  const { createAsync: createProduction } = usePaintProductionMutations();

  const [targetWeight, setTargetWeight] = useState<number>(1000); // Default 1kg
  const [targetWeightUnit, setTargetWeightUnit] = useState<MEASURE_UNIT>(MEASURE_UNIT.GRAM);
  const [removedAmount, setRemovedAmount] = useState<number>(0); // Amount removed for testing
  const [removedUnit, setRemovedUnit] = useState<MEASURE_UNIT>(MEASURE_UNIT.GRAM);
  const [isCreatingProduction, setIsCreatingProduction] = useState(false);

  const components = formula.components || [];

  // Convert target weight to grams
  const targetWeightInGrams = targetWeightUnit === MEASURE_UNIT.KILOGRAM ? targetWeight * 1000 : targetWeight;

  // Convert removed amount to grams
  const removedAmountInGrams = removedUnit === MEASURE_UNIT.KILOGRAM ? removedAmount * 1000 : removedAmount;

  // Calculate actual weight after removal
  const actualTargetWeight = targetWeightInGrams - removedAmountInGrams;

  // Calculate component requirements based on ratios
  const componentCalculations = useMemo((): ComponentCalculation[] => {
    return components.map((comp) => {
      // Calculate weight based on ratio and actual target weight (after removal)
      const calculatedWeight = (comp.ratio / 100) * actualTargetWeight;

      const item = comp.item;
      const unitPrice = item?.prices?.[0]?.value || 0;
      const availableStock = item?.quantity || 0;

      // Get weight and volume measures
      const weightMeasure = item?.measures?.find((m) => m.measureType === "WEIGHT" && m.unit === MEASURE_UNIT.GRAM);
      const volumeMeasure = item?.measures?.find((m) => m.measureType === "VOLUME" && m.unit === MEASURE_UNIT.MILLILITER);

      // Calculate item density
      const itemDensity = weightMeasure?.value && volumeMeasure?.value && volumeMeasure.value > 0 ? weightMeasure.value / volumeMeasure.value : Number(formula.density) || 1.0;

      // Calculate volume based on weight and density
      const calculatedVolume = calculatedWeight / itemDensity;

      // Determine stock unit and calculate required units
      const stockUnit = item?.measures?.[0]?.unit || MEASURE_UNIT.UNIT;
      let requiredUnits = calculatedWeight;

      if (stockUnit === MEASURE_UNIT.KILOGRAM) {
        requiredUnits = calculatedWeight / 1000;
      } else if (stockUnit === MEASURE_UNIT.GRAM) {
        requiredUnits = calculatedWeight;
      } else if (weightMeasure?.value) {
        // For items with specific weight per unit
        requiredUnits = calculatedWeight / weightMeasure.value;
      }

      const totalCost = requiredUnits * unitPrice;
      const hasStock = availableStock >= requiredUnits;

      return {
        id: comp.id || "",
        name: item?.name || `Componente`,
        ratio: comp.ratio,
        calculatedWeight,
        calculatedVolume,
        availableStock,
        stockUnit,
        requiredUnits,
        unitPrice,
        totalCost,
        hasStock,
        itemDensity,
      };
    });
  }, [components, actualTargetWeight, formula.density]);

  // Calculate totals
  const calculatedTotals = useMemo(() => {
    const totalWeight = componentCalculations.reduce((sum, calc) => sum + calc.calculatedWeight, 0);
    const totalVolume = componentCalculations.reduce((sum, calc) => sum + calc.calculatedVolume, 0);
    const totalCost = componentCalculations.reduce((sum, calc) => sum + calc.totalCost, 0);
    const missingComponents = componentCalculations.filter((calc) => !calc.hasStock);
    const calculatedVolumeInLiters = totalVolume / 1000;
    const costPerLiter = calculatedVolumeInLiters > 0 ? totalCost / calculatedVolumeInLiters : 0;

    return {
      totalWeight,
      totalVolume,
      totalCost,
      missingComponents,
      calculatedVolumeInLiters,
      costPerLiter,
    };
  }, [componentCalculations]);

  const calculatedDensity = calculatedTotals.totalVolume > 0 ? calculatedTotals.totalWeight / calculatedTotals.totalVolume : 0;

  const handleStartProduction = async () => {
    try {
      setIsCreatingProduction(true);

      // Validate required data
      if (!formula.id) {
        return;
      }

      if (!formula.paint?.id) {
        return;
      }

      if (actualTargetWeight <= 0) {
        return;
      }

      // Calculate volume from weight using formula density
      const formulaDensity = Number(formula.density) || 1.0;
      const volumeInMl = actualTargetWeight / formulaDensity;
      const volumeInLiters = volumeInMl / 1000;

      // Create the production with the calculated volume (in liters)
      const result = await createProduction({
        formulaId: formula.id,
        volumeLiters: volumeInLiters,
      });

      // Navigate to the production details page
      if (result?.data?.id) {
        navigate(routes.painting.productions.details(result.data.id));
      } else {
        // Fallback to productions list if no ID is returned
        navigate(routes.painting.productions.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating production:", error);
      }
      // Error handled by API client
    } finally {
      setIsCreatingProduction(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCalculator className="h-5 w-5" />
          Calculadora de Proporção
        </CardTitle>
        <CardDescription>Calcule as quantidades necessárias para produzir a quantidade desejada de tinta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Weight Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="targetWeight">Peso desejado para produção</Label>
            <div className="flex gap-2">
              <Input
                type="decimal"
                value={targetWeight}
                onChange={(value) => setTargetWeight(typeof value === "number" ? value : 0)}
                placeholder="Digite o peso"
                className="flex-1"
              />
              <select
                value={targetWeightUnit}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetWeightUnit(e.target.value as MEASURE_UNIT)}
                className="px-3 py-1 border rounded-md bg-background"
              >
                <option value={MEASURE_UNIT.GRAM}>g</option>
                <option value={MEASURE_UNIT.KILOGRAM}>kg</option>
              </select>
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Volume Estimado</div>
            <div className="text-lg font-bold">{calculatedTotals.calculatedVolumeInLiters.toFixed(2).replace(".", ",")} L</div>
            <div className="text-xs text-muted-foreground">Densidade: {calculatedDensity.toFixed(3).replace(".", ",")} g/ml</div>
          </div>
        </div>

        {/* Removed Amount Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="removedAmount">Quantidade retirada para teste</Label>
            <div className="flex gap-2">
              <Input
                type="decimal"
                value={removedAmount}
                onChange={(value) => setRemovedAmount(typeof value === "number" ? value : 0)}
                placeholder="Quantidade"
                className="flex-1"
              />
              <select
                value={removedUnit}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRemovedUnit(e.target.value as MEASURE_UNIT)}
                className="px-3 py-1 border rounded-md bg-background"
              >
                <option value={MEASURE_UNIT.GRAM}>g</option>
                <option value={MEASURE_UNIT.KILOGRAM}>kg</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Digite a quantidade de tinta que foi retirada para ajustar automaticamente os componentes</p>
          </div>
          {removedAmount > 0 && (
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-sm text-muted-foreground">Peso Ajustado</div>
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {measureUtils.formatMeasure({
                  value: actualTargetWeight,
                  unit: MEASURE_UNIT.GRAM,
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                após retirar{" "}
                {measureUtils.formatMeasure({
                  value: removedAmountInGrams,
                  unit: MEASURE_UNIT.GRAM,
                })}
              </div>
            </div>
          )}
        </div>

        {actualTargetWeight <= 0 && removedAmount > 0 && (
          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertDescription>A quantidade retirada não pode ser maior que o peso desejado para produção.</AlertDescription>
          </Alert>
        )}

        {actualTargetWeight > 0 && targetWeightInGrams > 0 && (
          <>
            {/* Missing Components Alert */}
            {calculatedTotals.missingComponents.length > 0 && (
              <Alert variant="destructive">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Estoque insuficiente:</strong> {calculatedTotals.missingComponents.length} componente(s) sem estoque suficiente para esta produção.
                </AlertDescription>
              </Alert>
            )}

            {/* Component Calculations */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <IconPackage className="h-4 w-4" />
                Componentes Necessários
              </h4>

              {componentCalculations.map((calc) => (
                <div key={calc.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium">{calc.name}</h5>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {/* Required Weight */}
                        <div className="flex items-center gap-1">
                          <IconScale className="h-3 w-3" />
                          <span>Peso:</span>
                          <Badge variant="secondary">
                            {measureUtils.formatMeasure({
                              value: calc.calculatedWeight,
                              unit: MEASURE_UNIT.GRAM,
                            })}
                          </Badge>
                        </div>

                        {/* Required Volume */}
                        {calc.calculatedVolume > 0 && (
                          <div className="flex items-center gap-1">
                            <IconFlask className="h-3 w-3" />
                            <span>Volume:</span>
                            <Badge variant="secondary">
                              {measureUtils.formatMeasure({
                                value: calc.calculatedVolume,
                                unit: MEASURE_UNIT.MILLILITER,
                              })}
                            </Badge>
                          </div>
                        )}

                        {/* Stock Status */}
                        <div className="flex items-center gap-1">
                          <IconShoppingCart className="h-3 w-3" />
                          <span>Necessário:</span>
                          <Badge variant={calc.hasStock ? "default" : "destructive"}>
                            {calc.requiredUnits.toFixed(2)} {calc.stockUnit}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Disponível: {calc.availableStock} {calc.stockUnit}
                        {calc.unitPrice > 0 && (
                          <span className="ml-2">
                            <span className="font-enhanced-unicode">•</span> Custo: {formatCurrency(calc.totalCost)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-medium">{((calc.calculatedWeight / calculatedTotals.totalWeight) * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">da mistura</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Production Summary */}
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Peso Total</div>
                <div className="text-xl font-bold">
                  {measureUtils.formatMeasure({
                    value: calculatedTotals.totalWeight,
                    unit: MEASURE_UNIT.GRAM,
                  })}
                </div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Volume Total</div>
                <div className="text-xl font-bold">{calculatedTotals.calculatedVolumeInLiters.toFixed(2)} L</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Custo Total</div>
                <div className="text-xl font-bold">{formatCurrency(calculatedTotals.totalCost)}</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Custo por Litro</div>
                <div className="text-xl font-bold">{formatCurrency(calculatedTotals.costPerLiter)}</div>
              </div>
            </div>

            {/* Production Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={calculatedTotals.missingComponents.length > 0 || actualTargetWeight <= 0 || isCreatingProduction}
                onClick={handleStartProduction}
              >
                {isCreatingProduction ? (
                  <>
                    <IconLoader className="h-4 w-4 mr-2 animate-spin" />
                    Criando Produção...
                  </>
                ) : (
                  <>
                    <IconCalculator className="h-4 w-4 mr-2" />
                    Iniciar Produção
                  </>
                )}
              </Button>
              <Button variant="outline" disabled={isCreatingProduction}>
                Salvar Cálculo
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
