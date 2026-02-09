import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../constants";
import { formatNumber, roundToDecimals } from "../../utils";
import { canConvertUnits, convertValue, getMeasureUnitCategory, getUnitsInCategory } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Combobox } from "./combobox";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { Alert, AlertDescription } from "./alert";
import { IconArrowsExchange, IconCopy, IconRefresh } from "@tabler/icons-react";

interface UnitConverterProps {
  className?: string;
  defaultFromUnit?: MEASURE_UNIT;
  defaultToUnit?: MEASURE_UNIT;
  defaultValue?: number;
  onConversionChange?: (result: ConversionResult) => void;
  showCopyButton?: boolean;
  showHistory?: boolean;
  compact?: boolean;
  restrictToCategory?: string;
  title?: string;
}

interface ConversionResult {
  fromValue: number;
  fromUnit: MEASURE_UNIT;
  toValue: number;
  toUnit: MEASURE_UNIT;
  factor: number;
  category: string;
}

interface ConversionHistory {
  id: string;
  timestamp: Date;
  result: ConversionResult;
}

export function UnitConverter({
  className,
  defaultFromUnit = MEASURE_UNIT.METER,
  defaultToUnit = MEASURE_UNIT.CENTIMETER,
  defaultValue = 1,
  onConversionChange,
  showCopyButton = true,
  showHistory = false,
  compact = false,
  restrictToCategory,
  title = "Conversor de Unidades",
}: UnitConverterProps) {
  const [fromValue, setFromValue] = useState(defaultValue.toString());
  const [fromUnit, setFromUnit] = useState(defaultFromUnit);
  const [toUnit, setToUnit] = useState(defaultToUnit);
  const [toValue, setToValue] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversionHistory[]>([]);

  // Get available units based on category restriction
  const getAvailableUnits = useCallback(() => {
    if (restrictToCategory) {
      return getUnitsInCategory(restrictToCategory as any);
    }
    return Object.values(MEASURE_UNIT);
  }, [restrictToCategory]);

  // Get units for a specific category
  const getUnitsByCategory = () => {
    const availableUnits = getAvailableUnits();
    const categories: Record<string, MEASURE_UNIT[]> = {};

    availableUnits.forEach((unit) => {
      const category = getMeasureUnitCategory(unit);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(unit);
    });

    return categories;
  };

  // Perform conversion
  const performConversion = useCallback(() => {
    const numericValue = parseFloat(fromValue.replace(",", "."));

    if (isNaN(numericValue)) {
      setError("Valor inválido");
      setToValue("0");
      return;
    }

    if (numericValue < 0) {
      setError("Valor não pode ser negativo");
      setToValue("0");
      return;
    }

    if (!canConvertUnits(fromUnit, toUnit)) {
      setError(`Não é possível converter de ${MEASURE_UNIT_LABELS[fromUnit]} para ${MEASURE_UNIT_LABELS[toUnit]}`);
      setToValue("0");
      return;
    }

    const converted = convertValue(numericValue, fromUnit, toUnit);
    if (converted === null) {
      setError("Conversão não suportada");
      setToValue("0");
      return;
    }

    const rounded = roundToDecimals(converted, 6);
    setToValue(formatNumber(rounded));
    setError(null);

    const conversionResult: ConversionResult = {
      fromValue: numericValue,
      fromUnit,
      toValue: rounded,
      toUnit,
      factor: rounded / numericValue,
      category: getMeasureUnitCategory(fromUnit),
    };

    onConversionChange?.(conversionResult);

    // Add to history
    if (showHistory && numericValue > 0) {
      const historyEntry: ConversionHistory = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        result: conversionResult,
      };

      setHistory((prev) => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
    }
  }, [fromValue, fromUnit, toUnit, onConversionChange, showHistory]);

  // Handle value change
  const handleFromValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty value and valid number formats
    if (value === "" || /^\d*[,.]?\d*$/.test(value)) {
      setFromValue(value);
    }
  };

  // Swap units
  const handleSwapUnits = () => {
    if (canConvertUnits(fromUnit, toUnit)) {
      setFromUnit(toUnit);
      setToUnit(fromUnit);
      setFromValue(toValue.replace(/\./g, "").replace(",", "."));
    }
  };

  // Copy result to clipboard
  const handleCopyResult = async () => {
    try {
      await navigator.clipboard.writeText(`${toValue} ${MEASURE_UNIT_LABELS[toUnit]}`);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Load conversion from history
  const handleLoadFromHistory = (historyItem: ConversionHistory) => {
    setFromValue(historyItem.result.fromValue.toString());
    setFromUnit(historyItem.result.fromUnit);
    setToUnit(historyItem.result.toUnit);
  };

  // Clear history
  const handleClearHistory = () => {
    setHistory([]);
  };

  // Perform conversion when inputs change
  useEffect(() => {
    performConversion();
  }, [performConversion]);

  // Render compact version
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Input value={fromValue} onChange={handleFromValueChange} placeholder="Valor" className="w-20" />

        <Combobox
          value={fromUnit}
          onValueChange={(value) => setFromUnit(value as MEASURE_UNIT)}
          options={getAvailableUnits().map((unit) => ({
            value: unit,
            label: MEASURE_UNIT_LABELS[unit],
          }))}
          placeholder="Selecione"
          triggerClassName="w-20"
        />

        <Button variant="ghost" size="sm" onClick={handleSwapUnits} disabled={!canConvertUnits(fromUnit, toUnit)}>
          <IconArrowsExchange className="h-4 w-4" />
        </Button>

        <Combobox
          value={toUnit}
          onValueChange={(value) => setToUnit(value as MEASURE_UNIT)}
          options={getAvailableUnits().map((unit) => ({
            value: unit,
            label: MEASURE_UNIT_LABELS[unit],
          }))}
          placeholder="Selecione"
          triggerClassName="w-20"
        />

        <div className="flex items-center gap-2">
          <span className="font-medium">{toValue}</span>
          {showCopyButton && (
            <Button variant="ghost" size="sm" onClick={handleCopyResult}>
              <IconCopy className="h-4 w-4" />
            </Button>
          )}
        </div>

        {error && (
          <Badge variant="destructive" className="text-xs">
            {error}
          </Badge>
        )}
      </div>
    );
  }

  // Render full version
  const unitsByCategory = getUnitsByCategory();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconArrowsExchange className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Conversion inputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* From */}
          <div className="space-y-2">
            <label className="text-sm font-medium">De:</label>
            <Input value={fromValue} onChange={handleFromValueChange} placeholder="Digite o valor" type="text" inputMode="decimal" />
            <Combobox
              value={fromUnit}
              onValueChange={(value) => setFromUnit(value as MEASURE_UNIT)}
              options={Object.entries(unitsByCategory).flatMap(([category, units]) =>
                units.map((unit) => ({
                  value: unit,
                  label: MEASURE_UNIT_LABELS[unit],
                  category,
                })),
              )}
              placeholder="Selecione a unidade"
              formatDisplay="category"
              renderOption={(option, _isSelected) => (
                <div>
                  <div className="truncate">{option.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{option.category}</div>
                </div>
              )}
            />
          </div>

          {/* To */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Para:</label>
            <div className="relative">
              <Input value={toValue} readOnly className="bg-muted" />
              {showCopyButton && (
                <Button variant="ghost" size="sm" onClick={handleCopyResult} className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0">
                  <IconCopy className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Combobox
              value={toUnit}
              onValueChange={(value) => setToUnit(value as MEASURE_UNIT)}
              options={Object.entries(unitsByCategory).flatMap(([category, units]) =>
                units.map((unit) => ({
                  value: unit,
                  label: MEASURE_UNIT_LABELS[unit],
                  category,
                })),
              )}
              placeholder="Selecione a unidade"
              formatDisplay="category"
              renderOption={(option, _isSelected) => (
                <div>
                  <div className="truncate">{option.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{option.category}</div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleSwapUnits} disabled={!canConvertUnits(fromUnit, toUnit)}>
            <IconArrowsExchange className="h-4 w-4 mr-2" />
            Trocar unidades
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Conversion result summary */}
        {!error && parseFloat(fromValue.replace(",", ".")) > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <strong>
                {fromValue} {MEASURE_UNIT_LABELS[fromUnit]}
              </strong>{" "}
              ={" "}
              <strong>
                {toValue} {MEASURE_UNIT_LABELS[toUnit]}
              </strong>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Fator de conversão: 1 {MEASURE_UNIT_LABELS[fromUnit]} = {formatNumber(parseFloat(toValue) / parseFloat(fromValue.replace(",", ".")))} {MEASURE_UNIT_LABELS[toUnit]}
            </div>
          </div>
        )}

        {/* History */}
        {showHistory && history.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Histórico de Conversões</h4>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                <IconRefresh className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="text-xs p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleLoadFromHistory(item)}>
                  <div className="font-medium">
                    {item.result.fromValue} {MEASURE_UNIT_LABELS[item.result.fromUnit]} <span className="font-enhanced-unicode">→</span> {formatNumber(item.result.toValue)}{" "}
                    {MEASURE_UNIT_LABELS[item.result.toUnit]}
                  </div>
                  <div className="text-muted-foreground">{item.timestamp.toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Preset converter components for common use cases
export function WeightConverter(props: Omit<UnitConverterProps, "restrictToCategory" | "defaultFromUnit" | "defaultToUnit">) {
  return <UnitConverter {...props} restrictToCategory="Peso" defaultFromUnit={MEASURE_UNIT.KILOGRAM} defaultToUnit={MEASURE_UNIT.GRAM} title="Conversor de Peso" />;
}

export function VolumeConverter(props: Omit<UnitConverterProps, "restrictToCategory" | "defaultFromUnit" | "defaultToUnit">) {
  return <UnitConverter {...props} restrictToCategory="Volume" defaultFromUnit={MEASURE_UNIT.LITER} defaultToUnit={MEASURE_UNIT.MILLILITER} title="Conversor de Volume" />;
}

export function LengthConverter(props: Omit<UnitConverterProps, "restrictToCategory" | "defaultFromUnit" | "defaultToUnit">) {
  return (
    <UnitConverter {...props} restrictToCategory="Comprimento" defaultFromUnit={MEASURE_UNIT.METER} defaultToUnit={MEASURE_UNIT.CENTIMETER} title="Conversor de Comprimento" />
  );
}
