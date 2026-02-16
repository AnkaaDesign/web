import { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Item } from "../../../types";

interface FormulaSamplerProps {
  availableItems?: Item[];
}

export function FormulaSampler({ availableItems = [] }: FormulaSamplerProps) {
  const { watch, setValue } = useFormContext();
  const [sampleAmount, setSampleAmount] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Watch all component values
  const components = watch("components") || [];

  // Calculate current total quantity
  const currentTotal = useMemo(() => {
    if (!components || components.length === 0) return 0;

    const total = components.reduce((total: number, component: { ratio?: number; weightInGrams?: number; weightValue?: number; quantity?: number }) => {
      // Try different possible weight field names
      const weight = component.ratio || component.weightInGrams || component.weightValue || component.quantity || 0;
      return total + Number(weight) || 0;
    }, 0);

    return total;
  }, [components]);

  // Calculate remaining total after sampling
  const remainingTotal = useMemo(() => {
    const sample = parseFloat(sampleAmount) || 0;
    return Math.max(0, currentTotal - sample);
  }, [currentTotal, sampleAmount]);

  // Calculate scaling factor (what percentage remains)
  const scalingFactor = useMemo(() => {
    if (currentTotal === 0) return 1;
    return remainingTotal / currentTotal;
  }, [currentTotal, remainingTotal]);

  // Preview of new component quantities
  const previewComponents = useMemo(() => {
    return components.map((component: { itemId: string; weightInGrams?: number; [key: string]: any }) => {
      const originalWeight = component.ratio || 0;
      const newWeight = Math.round(originalWeight * scalingFactor * 100) / 100; // Round to 2 decimal places

      // Find the item details
      const item = availableItems.find((item) => item.id === component.itemId) || {
        name: "Item desconhecido",
        uniCode: null,
      };

      return {
        ...component,
        originalWeight,
        newWeight,
        item,
      };
    });
  }, [components, scalingFactor, availableItems]);

  const handleApplyAdjustment = () => {
    // Update all component quantities
    previewComponents.forEach((component: { newWeight: number }, index: number) => {
      setValue(`components.${index}.ratio`, component.newWeight);
      setValue(`components.${index}.rawInput`, component.newWeight.toString());
    });

    // Reset state
    setSampleAmount("");
    setIsAdjusting(false);
  };

  const handleCancelAdjustment = () => {
    setSampleAmount("");
    setIsAdjusting(false);
  };

  const handleSampleAmountChange = (value: string) => {
    setSampleAmount(value);
    setIsAdjusting(value.trim() !== "" && parseFloat(value) > 0);
  };

  // Show the sampler if there are any components with meaningful data
  const hasComponents =
    components.length > 0 &&
    (components.some((c: { itemId?: string }) => c.itemId) || // Has at least one item selected
      components.some((c: { weightInGrams?: number }) => (c.weightInGrams || 0) > 0) || // Has at least one weight > 0
      currentTotal > 0); // Or there's a total (fallback)

  const sampleValue = parseFloat(sampleAmount) || 0;
  const isValidSample = sampleValue > 0 && sampleValue < currentTotal;

  // Don't show anything if no components
  if (!hasComponents && currentTotal === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-6 mt-6 border-t border-dashed">
      {/* Sampling input */}
      <div className="space-y-2">
        <Label htmlFor="sample-amount" className="text-sm">
          Quantidade da amostra (g)
        </Label>
        <div className="flex gap-2">
          <Input
            id="sample-amount"
            type="number"
            placeholder="Ex: 10"
            value={sampleAmount}
            onChange={(value) => handleSampleAmountChange(value as string)}
            min={0}
            max={currentTotal}
            step={0.01}
            className="text-left font-mono bg-transparent"
          />
          <div className="flex gap-1">
            <Button type="button" size="sm" onClick={handleApplyAdjustment} disabled={!isValidSample} className="whitespace-nowrap">
              <IconCheck className="h-4 w-4 mr-1" />
              Aplicar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCancelAdjustment} disabled={!isAdjusting}>
              <IconX className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
        {!isValidSample && sampleValue > 0 && <p className="text-xs text-destructive">A amostra deve ser menor que o total da fórmula ({currentTotal.toFixed(2)}g)</p>}
      </div>

      {/* Preview of changes */}
      {isAdjusting && isValidSample && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Prévia das alterações:</h4>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Total restante: <strong className="font-mono">{remainingTotal.toFixed(2)}g</strong>
                </span>
                <span>
                  Proporção: <strong className="font-mono">{(scalingFactor * 100).toFixed(1)}%</strong>
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {previewComponents.map((component: { itemId: string; ratio?: number; originalWeight: number; newWeight: number; item: { name: string } }, index: number) => {
                if (!component.itemId || component.originalWeight <= 0) return null;

                const item = component.item || { name: component.itemId };
                const difference = component.newWeight - component.originalWeight;

                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs">
                    <span className="truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">{component.originalWeight.toFixed(2)}g</span>
                      <span className="font-enhanced-unicode">→</span>
                      <span className={cn("font-medium", difference < 0 ? "text-red-600" : "text-muted-foreground")}>{component.newWeight.toFixed(2)}g</span>
                      <span className={cn("text-xs", difference < 0 ? "text-red-500" : "text-muted-foreground")}>
                        ({difference >= 0 ? "+" : ""}
                        {difference.toFixed(2)}g)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
