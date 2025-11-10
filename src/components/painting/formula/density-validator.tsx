import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconCircleCheck, IconCalculator, IconInfoCircle } from "@tabler/icons-react";
import type { PaintFormula } from "../../../types";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT } from "../../../constants";

interface DensityValidatorProps {
  formula: PaintFormula;
  showDetails?: boolean;
  className?: string;
}

interface DensityValidationResult {
  status: "valid" | "warning" | "error" | "unknown";
  message: string;
  calculatedDensity: number | null;
  specifiedDensity: number;
  difference: number | null;
  suggestions: string[];
}

export function DensityValidator({ formula, showDetails = false, className }: DensityValidatorProps) {
  const components = formula.components || [];

  // Calculate density validation
  const validation = (): DensityValidationResult => {
    const specifiedDensity = Number(formula.density);

    // Check if we have components with items that have measures
    const componentsWithValidItems = components.filter((comp) => comp.item?.measures && comp.item.measures.length >= 2);

    if (componentsWithValidItems.length === 0) {
      return {
        status: "unknown",
        message: "Densidade não pode ser validada - componentes sem itens ou medidas",
        calculatedDensity: null,
        specifiedDensity,
        difference: null,
        suggestions: ["Certifique-se de que os componentes incluem informações dos itens", "Verifique se os itens têm medidas de peso e volume cadastradas"],
      };
    }

    // Calculate total weight and volume from components using ratios and item measures
    let totalWeight = 0;
    let totalVolume = 0;
    let hasValidCalculation = false;

    // Assume 1kg base for ratio calculations (as done in the API)
    const baseWeight = 1000; // grams

    components.forEach((comp) => {
      if (!comp.item?.measures) return;

      // Get weight and volume measures from item
      const weightMeasure = comp.item.measures.find((m) => m.measureType === "WEIGHT" && m.unit === "GRAM");
      const volumeMeasure = comp.item.measures.find((m) => m.measureType === "VOLUME" && m.unit === "MILLILITER");

      if (weightMeasure && volumeMeasure && volumeMeasure.value && volumeMeasure.value > 0) {
        // Calculate component weight from ratio
        const componentWeight = (comp.ratio / 100) * baseWeight;

        // Calculate item density
        const itemDensity = (weightMeasure.value || 0) / (volumeMeasure.value || 1);

        // Calculate component volume from weight and density
        const componentVolume = componentWeight / itemDensity;

        totalWeight += componentWeight;
        totalVolume += componentVolume;
        hasValidCalculation = true;
      }
    });

    if (!hasValidCalculation || totalVolume <= 0) {
      return {
        status: "error",
        message: "Erro no cálculo - não foi possível calcular densidade a partir dos componentes",
        calculatedDensity: null,
        specifiedDensity,
        difference: null,
        suggestions: ["Verifique se todos os itens têm medidas de peso e volume", "Certifique-se de que as medidas estão corretas"],
      };
    }

    if (totalWeight <= 0 || totalVolume <= 0) {
      return {
        status: "error",
        message: "Erro no cálculo - peso ou volume total inválido",
        calculatedDensity: null,
        specifiedDensity,
        difference: null,
        suggestions: ["Verifique se todos os componentes têm valores válidos", "Certifique-se de que peso e volume são maiores que zero"],
      };
    }

    const calculatedDensity = totalWeight / totalVolume;
    const difference = Math.abs(calculatedDensity - specifiedDensity);
    const percentageDifference = (difference / specifiedDensity) * 100;

    let status: "valid" | "warning" | "error";
    let message: string;
    let suggestions: string[] = [];

    if (percentageDifference <= 2) {
      status = "valid";
      message = "Densidade está dentro da tolerância esperada";
      suggestions = ["Densidade validada com sucesso"];
    } else if (percentageDifference <= 10) {
      status = "warning";
      message = `Densidade calculada difere da especificada em ${percentageDifference.toFixed(1)}%`;
      suggestions = ["Verifique se as medidas dos componentes estão corretas", "Considere atualizar a densidade especificada", "Confirme se todos os componentes foram incluídos"];
    } else {
      status = "error";
      message = `Grande divergência na densidade (${percentageDifference.toFixed(1)}% de diferença)`;
      suggestions = [
        "Revise urgentemente as medidas dos componentes",
        "Verifique se a densidade especificada está correta",
        "Confirme se não há componentes faltando ou em excesso",
        "Considere recalibrar a fórmula",
      ];
    }

    return {
      status,
      message,
      calculatedDensity,
      specifiedDensity,
      difference,
      suggestions,
    };
  };

  const result = validation();

  const getIcon = () => {
    switch (result.status) {
      case "valid":
        return <IconCircleCheck className="h-4 w-4" />;
      case "warning":
        return <IconAlertTriangle className="h-4 w-4" />;
      case "error":
        return <IconAlertTriangle className="h-4 w-4" />;
      case "unknown":
        return <IconInfoCircle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (result.status) {
      case "valid":
        return "default";
      case "warning":
        return "warning" as const;
      case "error":
        return "destructive";
      case "unknown":
        return "default";
    }
  };

  if (!showDetails && result.status === "valid") {
    return null; // Don't show anything if validation passes and details not requested
  }

  return (
    <div className={className}>
      <Alert variant={getVariant()}>
        {getIcon()}
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">{result.message}</div>

            {result.calculatedDensity && (
              <div className="flex items-center gap-2 text-sm">
                <span>Especificada:</span>
                <Badge variant="outline">{result.specifiedDensity.toFixed(3)} g/ml</Badge>
                <span>Calculada:</span>
                <Badge variant="secondary">{result.calculatedDensity.toFixed(3)} g/ml</Badge>
                {result.difference && (
                  <>
                    <span>Diferença:</span>
                    <Badge variant={result.status === "error" ? "destructive" : "default"}>{result.difference.toFixed(3)} g/ml</Badge>
                  </>
                )}
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {showDetails && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconCalculator className="h-4 w-4" />
              Detalhes da Validação
            </CardTitle>
            <CardDescription>Análise detalhada da densidade da fórmula</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Component Analysis */}
            <div>
              <h4 className="text-sm font-medium mb-2">Análise dos Componentes:</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• Total de componentes: {components.length}</div>
                <div>• Componentes com itens e medidas: {components.filter((c) => c.item?.measures && c.item.measures.length >= 2).length}</div>
                <div>
                  • Componentes com medidas válidas:{" "}
                  {
                    components.filter((c) => {
                      const weightMeasure = c.item?.measures?.find((m) => m.measureType === "WEIGHT" && m.unit === "GRAM");
                      const volumeMeasure = c.item?.measures?.find((m) => m.measureType === "VOLUME" && m.unit === "MILLILITER");
                      return weightMeasure && volumeMeasure;
                    }).length
                  }
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Recomendações:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Formula Totals */}
            {result.calculatedDensity && (
              <div>
                <h4 className="text-sm font-medium mb-2">Totais da Fórmula:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Peso Total:</span>
                    <div className="font-medium">
                      {measureUtils.formatMeasure({
                        value: (() => {
                          const baseWeight = 1000; // grams
                          return components.reduce((sum, comp) => sum + (comp.ratio / 100) * baseWeight, 0);
                        })(),
                        unit: MEASURE_UNIT.GRAM,
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Volume Total:</span>
                    <div className="font-medium">
                      {measureUtils.formatMeasure({
                        value: (() => {
                          const baseWeight = 1000; // grams
                          let totalVolume = 0;
                          components.forEach((comp) => {
                            const weightMeasure = comp.item?.measures?.find((m) => m.measureType === "WEIGHT" && m.unit === "GRAM");
                            const volumeMeasure = comp.item?.measures?.find((m) => m.measureType === "VOLUME" && m.unit === "MILLILITER");
                            if (weightMeasure && volumeMeasure && volumeMeasure.value && volumeMeasure.value > 0) {
                              const componentWeight = (comp.ratio / 100) * baseWeight;
                              const itemDensity = (weightMeasure.value || 0) / (volumeMeasure.value || 1);
                              const componentVolume = componentWeight / itemDensity;
                              totalVolume += componentVolume;
                            }
                          });
                          return totalVolume;
                        })(),
                        unit: MEASURE_UNIT.MILLILITER,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
