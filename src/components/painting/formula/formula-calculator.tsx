import { useState, useMemo, useEffect } from "react";
import { IconCheck, IconX, IconLoader, IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { PaintFormula, Item } from "../../../types";
import { formatCurrency, formatNumberWithDecimals } from "../../../utils";
import { toast } from "sonner";
import { useItems } from "../../../hooks";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormulaCalculatorProps {
  formula: PaintFormula;
  onStartProduction: (data: { formulaId: string; weight: number }) => Promise<void>;
}

export function FormulaCalculator({ formula, onStartProduction }: FormulaCalculatorProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [desiredVolume, setDesiredVolume] = useState(() => searchParams.get("volume") || "2000");
  const [showPrices, setShowPrices] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>(() => {
    const used = searchParams.get("used");
    return used ? used.split(",").filter(Boolean) : [];
  });

  // Correction mode state
  const [correctionMode, setCorrectionMode] = useState(false);
  const [errorComponentId, setErrorComponentId] = useState<string | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [selectedComponentForError, setSelectedComponentForError] = useState<string | null>(null);

  // Update URL params when state changes
  useEffect(() => {
    const params = new URLSearchParams();

    // Update volume
    if (desiredVolume && desiredVolume !== "2000") {
      params.set("volume", desiredVolume);
    }

    // Update used components
    if (selectedComponents.length > 0) {
      params.set("used", selectedComponents.join(","));
    }

    // Only update if params actually changed
    const newParamsString = params.toString();
    const currentParamsString = searchParams.toString();

    if (newParamsString !== currentParamsString) {
      setSearchParams(params, { replace: true });
    }
  }, [desiredVolume, selectedComponents, searchParams, setSearchParams]);

  // Get item IDs from formula components
  const itemIds = useMemo(() => {
    return formula.components?.map((c) => c.itemId).filter(Boolean) || [];
  }, [formula.components]);

  // Fetch items with measures and prices
  const { data: itemsResponse } = useItems({
    where: {
      id: { in: itemIds },
    },
    include: {
      measures: true,
      prices: true,
    },
    enabled: itemIds.length > 0,
  });

  // Create a map of items by ID for quick lookup
  const itemsMap = useMemo(() => {
    const map = new Map<string, Item>();
    itemsResponse?.data?.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [itemsResponse]);

  // Calculate error ratio if in correction mode
  const errorRatio = useMemo(() => {
    if (!correctionMode || !errorComponentId || !actualAmount) return 1;

    const errorComponent = formula.components?.find((c) => c.id === errorComponentId);
    if (!errorComponent) return 1;

    // Check if ratios need to be normalized (same logic as in calculatedComponents)
    const ratioSum = formula.components?.reduce((sum, c) => sum + (c.ratio || 0), 0) || 0;
    const needsNormalization = ratioSum > 0 && ratioSum < 10;

    let componentRatio = errorComponent.ratio || 0;
    if (needsNormalization) {
      componentRatio = componentRatio * 100;
    }

    // Formula ratios are WEIGHT percentages, not volume percentages
    const volumeInMl = parseFloat(desiredVolume) || 0;
    const formulaDensity = Number(formula.density) || 1.0;

    // Calculate expected weight based on total weight and component ratio
    const totalWeightInGrams = volumeInMl * formulaDensity;
    const expectedWeight = (totalWeightInGrams * componentRatio) / 100;

    // Get actual weight entered by user
    const actualWeight = parseFloat(actualAmount) || 0;

    // Error ratio is simply actual weight / expected weight
    return actualWeight / expectedWeight;
  }, [correctionMode, errorComponentId, actualAmount, formula, desiredVolume]);

  // Calculate components based on desired volume
  const calculatedComponents = useMemo(() => {
    if (!formula.components || formula.components.length === 0) return [];

    const volumeInMl = parseFloat(desiredVolume) || 0;
    if (volumeInMl <= 0) return [];

    // Formula density in g/ml
    const formulaDensity = Number(formula.density) || 1.0;

    // Total weight for the desired volume
    const totalWeightInGrams = volumeInMl * formulaDensity;

    // Check if ratios need to be normalized (if they sum to ~1 instead of 100)
    const ratioSum = formula.components.reduce((sum, c) => sum + (c.ratio || 0), 0);
    const needsNormalization = ratioSum > 0 && ratioSum < 10; // If sum is between 0 and 10, assume it needs to be multiplied by 100

    // Calculate each component
    return formula.components
      .map((component) => {
        let ratio = component.ratio || 0;

        // Normalize ratio if needed (convert from decimal to percentage)
        if (needsNormalization) {
          ratio = ratio * 100;
        }

        // IMPORTANT: The ratio represents WEIGHT percentage based on the original formula
        // Calculate component weight based on the total weight needed
        const componentWeightInGrams = (totalWeightInGrams * ratio) / 100;

        // Get item info from either the component or the fetched items map
        const item = itemsMap.get(component.itemId) || component.item;

        // Get weight measure from item (weight per can/unit)
        const weightMeasure = item?.measures?.find((m) => m.measureType === "WEIGHT");

        // Calculate weight per unit in grams
        let weightPerUnitInGrams = 0;
        if (weightMeasure) {
          if (weightMeasure.unit === "KILOGRAM") {
            weightPerUnitInGrams = (weightMeasure.value || 0) * 1000; // Convert kg to grams
          } else if (weightMeasure.unit === "GRAM") {
            weightPerUnitInGrams = weightMeasure.value || 0;
          }
        }

        // If no weight measure, check for volume measure and use density
        if (weightPerUnitInGrams === 0) {
          const volumeMeasure = item?.measures?.find((m) => m.measureType === "VOLUME");
          if (volumeMeasure) {
            // Use formula density to estimate weight from volume
            let volumeInMl = 0;
            if (volumeMeasure.unit === "LITER") {
              volumeInMl = (volumeMeasure.value || 0) * 1000;
            } else if (volumeMeasure.unit === "MILLILITER") {
              volumeInMl = volumeMeasure.value || 0;
            }
            weightPerUnitInGrams = volumeInMl * formulaDensity; // Use formula density as approximation
          }
        }

        // If still no weight, assume the item quantity is already in the unit we need (fallback)
        if (weightPerUnitInGrams === 0) {
          weightPerUnitInGrams = 1; // Last resort: assume 1g per unit
        }

        // Calculate total available weight in grams
        const totalAvailableWeight = (item?.quantity || 0) * weightPerUnitInGrams;

        // Calculate density: if we have weight and volume measures, use them to calculate density
        // Otherwise use the formula's density
        const volumeMeasure = item?.measures?.find((m) => m.measureType === "VOLUME");
        let itemDensity = formulaDensity; // Default to formula density

        if (weightMeasure?.value && volumeMeasure?.value && volumeMeasure.value > 0) {
          // Density = weight (g) / volume (ml)
          itemDensity = weightMeasure.value / volumeMeasure.value;
        }

        // Calculate component's proportional volume based on formula volume
        // The total volume is the desired volume, components share it proportionally by ratio
        const componentVolumeInMl = (volumeInMl * ratio) / 100;

        // Calculate actual price based on item price and weight
        // Get the item's price
        const itemPrice = item?.prices?.[0]?.value || 0;

        // Calculate price per gram for this item
        const pricePerGram = weightPerUnitInGrams > 0 ? itemPrice / weightPerUnitInGrams : 0;

        // Calculate the actual cost for this component based on weight needed
        const componentCost = pricePerGram * componentWeightInGrams;

        // Calculate the component's price per liter (for reference)
        const componentPricePerLiterShare = volumeInMl > 0 ? (componentCost * 1000) / volumeInMl : 0;

        // Calculate corrected amounts if in correction mode
        let correctedWeightInGrams = componentWeightInGrams;
        let correctedVolumeInMl = componentVolumeInMl;
        let additionalWeightNeeded = 0;

        // Determine if component was already added (checked before the error)
        const wasAlreadyAdded = selectedComponents.includes(component.id);
        const isErrorComponent = component.id === errorComponentId;

        if (correctionMode && errorRatio !== 1) {
          // Apply error ratio to weight and volume for components not yet added
          correctedWeightInGrams = componentWeightInGrams * errorRatio;
          correctedVolumeInMl = componentVolumeInMl * errorRatio;

          // If component was already added (checked) and it's not the error component
          // Calculate how much MORE is needed to reach the corrected amount
          if (wasAlreadyAdded && !isErrorComponent) {
            // Additional amount = corrected total - original amount already added
            additionalWeightNeeded = correctedWeightInGrams - componentWeightInGrams;
          }
          // For components not yet added, they need the full corrected amount
          // (no calculation needed here, just use correctedWeightInGrams)
        }

        return {
          id: component.id,
          itemId: component.itemId,
          name: item?.name || "Item não encontrado",
          code: item?.uniCode || "SEM CÓDIGO",
          ratio, // This is now the normalized ratio (in percentage)
          weightInGrams: componentWeightInGrams,
          volumeInMl: componentVolumeInMl,
          density: itemDensity,
          price: componentCost, // This is the absolute cost for this component
          pricePerLiter: componentPricePerLiterShare, // Store the component's share of price per liter
          hasStock: totalAvailableWeight >= (correctionMode ? correctedWeightInGrams : componentWeightInGrams),
          stockQuantity: totalAvailableWeight, // Now represents total weight available, not units
          correctedWeightInGrams: correctionMode ? correctedWeightInGrams : undefined,
          correctedVolumeInMl: correctionMode ? correctedVolumeInMl : undefined,
          additionalWeightNeeded: correctionMode ? additionalWeightNeeded : undefined,
          wasAlreadyAdded,
          hasError: isErrorComponent,
        };
      })
      .sort((a, b) => b.ratio - a.ratio); // Sort by ratio (highest first)
  }, [formula, desiredVolume, itemsMap, correctionMode, errorRatio, errorComponentId, selectedComponents]);

  // Calculate totals with validation
  const totals = useMemo(() => {
    const totalWeight = calculatedComponents.reduce((sum, comp) => sum + comp.weightInGrams, 0);
    const totalVolume = calculatedComponents.reduce((sum, comp) => sum + comp.volumeInMl, 0);
    // Sum up the absolute costs for all components
    const totalCost = calculatedComponents.reduce((sum, comp) => sum + comp.price, 0);
    const allInStock = calculatedComponents.every((comp) => comp.hasStock);

    // Calculate price per liter based on actual costs
    const volumeInLiters = totalVolume / 1000;
    const pricePerLiter = volumeInLiters > 0 ? totalCost / volumeInLiters : 0;

    // Calculate total ratio for validation
    const totalRatio = calculatedComponents.reduce((sum, comp) => sum + comp.ratio, 0);
    const ratioIsValid = Math.abs(totalRatio - 100) <= 0.1;

    // Validate component weights
    const hasExcessiveWeights = calculatedComponents.some((comp) => comp.weightInGrams > 50000);

    // Validate density
    const formulaDensity = Number(formula.density) || 1.0;
    const densityIsValid = formulaDensity >= 0.5 && formulaDensity <= 3.0;

    // Volume validation
    const volumeInMl = parseFloat(desiredVolume) || 0;
    const volumeIsValid = volumeInMl > 0 && volumeInMl <= 100000;

    // Weight validation
    const weightIsValid = totalWeight > 0 && totalWeight <= 300000;

    // DEBUG LOGGING - Price tracking});

    return {
      weight: totalWeight,
      volume: totalVolume,
      price: totalCost, // Total absolute cost
      productionCost: totalCost, // Same as price for clarity
      allInStock,
      pricePerLiter: pricePerLiter, // Formula's price per liter
      // Validation flags
      totalRatio,
      ratioIsValid,
      hasExcessiveWeights,
      densityIsValid,
      volumeIsValid,
      weightIsValid,
      isValid: ratioIsValid && !hasExcessiveWeights && densityIsValid && volumeIsValid && weightIsValid && allInStock,
    };
  }, [calculatedComponents, desiredVolume, formula.pricePerLiter, formula.density]);

  const handleToggleComponent = (componentId: string) => {
    // In both normal and correction mode, toggle the checkbox
    setSelectedComponents((prev) => (prev.includes(componentId) ? prev.filter((id) => id !== componentId) : [...prev, componentId]));
  };

  const handleComponentError = (componentId: string) => {
    setSelectedComponentForError(componentId);
    setShowErrorDialog(true);
  };

  const handleConfirmError = () => {
    if (selectedComponentForError && actualAmount) {
      setErrorComponentId(selectedComponentForError);
      setCorrectionMode(true);
      setShowErrorDialog(false);
    }
  };

  const handleResetCorrection = () => {
    setCorrectionMode(false);
    setErrorComponentId(null);
    setActualAmount("");
  };

  const handleProduction = async () => {
    // Comprehensive validation before production
    const validationErrors: string[] = [];

    // Check using validation flags from totals
    if (!totals.allInStock) {
      validationErrors.push("Alguns componentes não têm estoque suficiente");
    }

    if (!totals.volumeIsValid) {
      validationErrors.push("Volume deve estar entre 1ml e 100L");
    }

    if (!totals.ratioIsValid) {
      validationErrors.push(`Proporções dos componentes devem somar 100% (atual: ${totals.totalRatio.toFixed(1)}%)`);
    }

    if (totals.hasExcessiveWeights) {
      validationErrors.push("Alguns componentes têm peso excessivo (>50kg)");
    }

    if (!totals.densityIsValid) {
      validationErrors.push("Densidade da fórmula deve estar entre 0.5 e 3.0 g/ml");
    }

    if (!totals.weightIsValid) {
      validationErrors.push("Peso total deve estar entre 1g e 300kg");
    }

    // Check formula completeness
    if (!formula.components || formula.components.length === 0) {
      validationErrors.push("Fórmula deve ter pelo menos um componente");
    }

    // Show all validation errors
    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    setIsProducing(true);
    try {
      const productionData = {
        formulaId: formula.id,
        weight: correctionMode ? totals.weight * errorRatio : totals.weight, // Send corrected weight if in correction mode
      };

      await onStartProduction(productionData);

      // Success is handled in the parent component
      // Reset correction mode after successful production
      if (correctionMode) {
        handleResetCorrection();
      }
    } catch (error) {
      // Error is handled by the parent component
    } finally {
      setIsProducing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Section */}
      <div className="flex items-start gap-6 mb-6">
        {/* Volume Input with Quick Buttons - Compact width */}
        <div className="space-y-2 max-w-md">
          <Label htmlFor="desired-volume" className="text-sm font-medium">
            Volume Desejado (ml)
          </Label>
          <Input
            id="desired-volume"
            value={desiredVolume}
            onChange={(value) => {
              setDesiredVolume(typeof value === "string" ? value : String(value || ""));
            }}
            type="natural"
            placeholder="Digite o volume desejado em ml"
            className="text-base h-10 bg-transparent w-full"
            disabled={correctionMode}
          />
          {/* Quick Amount Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[100, 500, 1000, 2000, 3600, 5000].map((amount) => (
              <Button
                key={amount}
                variant={parseInt(desiredVolume) === amount ? "default" : "outline"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setDesiredVolume(amount.toString());
                }}
                disabled={correctionMode}
              >
                {amount >= 1000 ? `${amount / 1000}L` : `${amount}ml`}
              </Button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center justify-end gap-6 flex-1">
          {/* Price Toggle */}
          <div className="flex items-center space-x-3">
            <Label htmlFor="show-prices" className="text-sm font-medium">
              Exibir Preços
            </Label>
            <Switch id="show-prices" checked={showPrices} onCheckedChange={setShowPrices} />
          </div>

          {/* Correction Mode Toggle */}
          <div className="flex items-center space-x-3">
            <Label htmlFor="correction-mode" className="text-sm font-medium">
              Modo Correção
            </Label>
            <Switch
              id="correction-mode"
              checked={correctionMode}
              onCheckedChange={(checked) => {
                if (!checked) {
                  handleResetCorrection();
                } else {
                  setCorrectionMode(true);
                  // Find first unchecked component and open error dialog
                  const firstUnchecked = calculatedComponents.find((c) => !selectedComponents.includes(c.id));
                  if (firstUnchecked) {
                    handleComponentError(firstUnchecked.id);
                  }
                }
              }}
              disabled={parseFloat(desiredVolume) <= 0}
            />
          </div>
        </div>
      </div>

      {/* Components Table */}
      {calculatedComponents.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-12 min-w-12 max-w-12 shrink-0 p-0">
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={calculatedComponents.length > 0 && calculatedComponents.every((c) => selectedComponents.includes(c.id))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedComponents(calculatedComponents.map((c) => c.id));
                        } else {
                          setSelectedComponents([]);
                        }
                      }}
                      disabled={correctionMode}
                    />
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase">Item</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase w-48">Peso (g)</TableHead>
                {correctionMode && <TableHead className="text-right font-semibold text-xs uppercase w-48">Correção</TableHead>}
                {showPrices && <TableHead className="text-right font-semibold text-xs uppercase w-48">Preço</TableHead>}
                <TableHead className="text-right font-semibold text-xs uppercase w-40">Proporção</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedComponents.map((component, index) => (
                <TableRow
                  key={component.id}
                  className={cn(
                    "cursor-pointer transition-colors border-b border-border",
                    index % 2 === 1 && "bg-muted/10",
                    "hover:bg-muted/20",
                    selectedComponents.includes(component.id) && "bg-muted/30 hover:bg-muted/40",
                    correctionMode && component.hasError && "bg-red-50 hover:bg-red-100",
                  )}
                  onClick={() => {
                    // In correction mode: don't toggle checkboxes
                    // In normal mode: toggle checkboxes
                    if (!correctionMode) {
                      handleToggleComponent(component.id);
                    }
                  }}
                >
                  <TableCell className="w-12 min-w-12 max-w-12 shrink-0 p-0">
                    <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      {correctionMode ? (
                        component.hasError ? (
                          <IconAlertCircle className="h-4 w-4 text-red-600" />
                        ) : component.wasAlreadyAdded ? (
                          <IconCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <IconX className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <Checkbox checked={selectedComponents.includes(component.id)} onCheckedChange={() => handleToggleComponent(component.id)} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-0">
                    <div className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          <span className="font-medium text-muted-foreground">{component.code}</span>
                          <span className="mx-2">-</span>
                          <span>{component.name}</span>
                        </span>
                        {!component.hasStock && <IconAlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-0 text-right">
                    <div className="px-4 py-2 tabular-nums text-base">
                      {component.weightInGrams > 20 ? Math.round(component.weightInGrams) : formatNumberWithDecimals(component.weightInGrams, 1)}
                    </div>
                  </TableCell>
                  {correctionMode && (
                    <TableCell className="p-0 text-right">
                      <div className="px-4 py-2 tabular-nums text-base">
                        {component.hasError ? (
                          // Show actual amount entered for error component
                          <span className="text-red-600 font-medium">
                            {parseFloat(actualAmount.replace(",", ".")) > 20 ? Math.round(parseFloat(actualAmount.replace(",", "."))) : formatNumberWithDecimals(parseFloat(actualAmount.replace(",", ".")) || 0, 1)}
                          </span>
                        ) : component.correctedWeightInGrams ? (
                          component.wasAlreadyAdded && component.additionalWeightNeeded !== undefined ? (
                            // Already added component: show additional amount needed (difference)
                            <span className="text-amber-600 font-medium">
                              {component.additionalWeightNeeded >= 0 ? "+" : ""}
                              {component.additionalWeightNeeded > 20 || component.additionalWeightNeeded < -20
                                ? Math.round(component.additionalWeightNeeded)
                                : formatNumberWithDecimals(component.additionalWeightNeeded, 1)}
                            </span>
                          ) : (
                            // Not yet added component: show full corrected amount
                            <span className="text-blue-600 font-medium">
                              {component.correctedWeightInGrams > 20 ? Math.round(component.correctedWeightInGrams) : formatNumberWithDecimals(component.correctedWeightInGrams, 1)}
                            </span>
                          )
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                  {showPrices && (
                    <TableCell className="p-0 text-right">
                      <div className="px-4 py-2 tabular-nums text-base">{formatCurrency(component.price)}</div>
                    </TableCell>
                  )}
                  <TableCell className="p-0 text-right">
                    <div className="px-4 py-2 tabular-nums text-base">{formatNumberWithDecimals(component.ratio, 2)}%</div>
                  </TableCell>
                  <TableCell className="p-0"></TableCell>
                </TableRow>
              ))}
              {/* Total Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="p-0"></TableCell>
                <TableCell className="p-0">
                  <div className="px-4 py-2 text-base">Total</div>
                </TableCell>
                <TableCell className="p-0 text-right">
                  <div className="px-4 py-2 tabular-nums text-base">{totals.weight > 20 ? Math.round(totals.weight) : formatNumberWithDecimals(totals.weight, 1)}</div>
                </TableCell>
                {correctionMode && (
                  <TableCell className="p-0 text-right">
                    <div className="px-4 py-2 tabular-nums text-base text-blue-600">
                      {totals.weight * errorRatio > 20 ? Math.round(totals.weight * errorRatio) : formatNumberWithDecimals(totals.weight * errorRatio, 1)}
                    </div>
                  </TableCell>
                )}
                {showPrices && (
                  <TableCell className="p-0 text-right">
                    <div className="px-4 py-2 tabular-nums text-base text-primary">{formatCurrency(totals.price)}</div>
                  </TableCell>
                )}
                <TableCell className="p-0 text-right">
                  <div className="px-4 py-2 text-base">100%</div>
                </TableCell>
                <TableCell className="p-0"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Production Button and Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Button - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-medium text-sm mb-3">Produção</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Volume: {correctionMode ? formatNumberWithDecimals(parseFloat(desiredVolume) * errorRatio, 1) : desiredVolume} ml | Peso Total:{" "}
                  {totals.weight > 20
                    ? Math.round(totals.weight * (correctionMode ? errorRatio : 1))
                    : formatNumberWithDecimals(totals.weight * (correctionMode ? errorRatio : 1), 1)}{" "}
                  g
                </p>
                {showPrices && <p className="text-sm text-muted-foreground">Custo de Produção: {formatCurrency(totals.productionCost)}</p>}
              </div>

              {!totals.allInStock && (
                <Alert variant="destructive">
                  <AlertDescription>Alguns componentes não têm estoque suficiente. Verifique a disponibilidade antes de produzir.</AlertDescription>
                </Alert>
              )}

              <Button className="w-full" size="lg" onClick={handleProduction} disabled={!totals.allInStock || totals.weight <= 0 || isProducing}>
                {isProducing ? (
                  <>
                    <IconLoader className="h-4 w-4 mr-2 animate-spin" />
                    Criando Produção...
                  </>
                ) : (
                  <>Produzir</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Specifications - 1/3 width */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <h3 className="font-medium text-sm mb-3">Especificações</h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Densidade</p>
                <p className="text-sm font-semibold">{formatNumberWithDecimals(Number(formula.density), 3)} g/ml</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Preço por Litro</p>
                <p className="text-sm font-semibold">
                  {(() => {
                    const displayPrice = totals.pricePerLiter;
                    return formatCurrency(displayPrice);
                  })()}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                <p className="text-xs">{formula.description || "Sem descrição"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Dialog */}
      <Dialog
        open={showErrorDialog}
        onOpenChange={(open) => {
          setShowErrorDialog(open);
          // If closing the dialog without confirming, reset correction mode
          if (!open && !errorComponentId) {
            setCorrectionMode(false);
            setActualAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar Quantidade Real</DialogTitle>
            <DialogDescription>
              {selectedComponentForError &&
                (() => {
                  const component = calculatedComponents.find((c) => c.id === selectedComponentForError);
                  return component ? (
                    <>
                      Você está marcando o componente <strong>{component.name}</strong> como tendo um erro. A quantidade esperada era de{" "}
                      <strong>{formatNumberWithDecimals(component.weightInGrams, 1)}g</strong>. Por favor, informe a quantidade real que foi adicionada.
                    </>
                  ) : null;
                })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actual-amount">Quantidade Real (g)</Label>
              <Input
                id="actual-amount"
                type="decimal"
                value={actualAmount ? parseFloat(actualAmount.replace(",", ".")) : null}
                onChange={(value) => {
                  if (value === null) {
                    setActualAmount("");
                  } else {
                    setActualAmount(String(value).replace(".", ","));
                  }
                }}
                placeholder="Digite a quantidade real em gramas"
                autoFocus
              />
              {selectedComponentForError &&
                (() => {
                  const component = calculatedComponents.find((c) => c.id === selectedComponentForError);
                  const expectedWeight = component?.weightInGrams || 0;
                  const typedValue = parseFloat(actualAmount.replace(",", ".")) || 0;

                  if (actualAmount && typedValue < expectedWeight) {
                    return (
                      <p className="text-xs text-destructive">
                        A quantidade não pode ser menor que o esperado ({formatNumberWithDecimals(expectedWeight, 1)}g)
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowErrorDialog(false);
                setCorrectionMode(false);
                setActualAmount("");
                setSelectedComponentForError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmError}
              disabled={(() => {
                if (!actualAmount) return true;

                const component = calculatedComponents.find((c) => c.id === selectedComponentForError);
                const expectedWeight = component?.weightInGrams || 0;
                const typedValue = parseFloat(actualAmount.replace(",", ".")) || 0;

                return typedValue < expectedWeight;
              })()}
            >
              Confirmar Erro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
