import React, { useCallback, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS, MEASURE_TYPE, MEASURE_TYPE_LABELS } from "../../constants";
import { Combobox } from "./combobox";
import { Input } from "./input";
import { Label } from "./label";
import { formatNumber, roundToDecimals } from "../../utils";
import { getMeasureUnitCategory, canConvertUnits, convertValue } from "../../types";

interface MeasureInputProps {
  value?: number | null;
  unit?: MEASURE_UNIT | null;
  measureType?: MEASURE_TYPE;
  onChange?: (value: { value: number | null | undefined; unit: MEASURE_UNIT | null; measureType: MEASURE_TYPE }) => void;
  onValueChange?: (value: number | null | undefined) => void;
  onUnitChange?: (unit: MEASURE_UNIT | null) => void;
  onMeasureTypeChange?: (measureType: MEASURE_TYPE) => void;
  className?: string;
  valueClassName?: string;
  unitClassName?: string;
  measureTypeClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showMeasureType?: boolean;
  filterUnits?: MEASURE_UNIT[];
  allowedMeasureTypes?: MEASURE_TYPE[];
  label?: string;
  error?: string;
  showConversion?: boolean;
  convertTo?: MEASURE_UNIT;
  max?: number;
  min?: number;
  step?: number;
  decimals?: number;
}

export function MeasureInput({
  value,
  unit,
  measureType = MEASURE_TYPE.COUNT,
  onChange,
  onValueChange,
  onUnitChange,
  onMeasureTypeChange,
  className,
  valueClassName,
  unitClassName,
  measureTypeClassName,
  placeholder = "Digite o valor",
  disabled = false,
  required = false,
  showMeasureType = false,
  filterUnits,
  allowedMeasureTypes,
  label,
  error,
  showConversion = false,
  convertTo,
  max,
  min = 0,
  step = 0.01,
  decimals = 4,
  ...props
}: MeasureInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(() => (value !== undefined && value !== null ? formatNumber(value) : ""));
  const [convertedValue, setConvertedValue] = useState<string>("");

  // Get available units based on measure type and filters
  const getAvailableUnits = useCallback(() => {
    let units: MEASURE_UNIT[] = [];

    // Get units for the current measure type
    switch (measureType) {
      case MEASURE_TYPE.WEIGHT:
        units = [MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM];
        break;
      case MEASURE_TYPE.VOLUME:
        units = [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER];
        break;
      case MEASURE_TYPE.LENGTH:
        units = [MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER, MEASURE_UNIT.INCHES];
        break;
      case MEASURE_TYPE.COUNT:
        units = [MEASURE_UNIT.UNIT, MEASURE_UNIT.PAIR, MEASURE_UNIT.DOZEN, MEASURE_UNIT.HUNDRED, MEASURE_UNIT.THOUSAND];
        break;
      case MEASURE_TYPE.AREA:
        // For area, we might need to extend the enum or use combinations
        units = [MEASURE_UNIT.METER]; // Could be extended to square meters, etc.
        break;
      case MEASURE_TYPE.SIZE:
        // For SIZE type (PPE), include common size units
        units = Object.values(MEASURE_UNIT).filter((u) => u.includes("SIZE_") || ["P", "M", "G", "GG", "XG"].includes(u));
        break;
      default:
        units = Object.values(MEASURE_UNIT);
    }

    // Apply filter if provided
    if (filterUnits) {
      units = units.filter((u) => filterUnits.includes(u));
    }

    return units;
  }, [measureType, filterUnits]);

  // Handle value input change
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      // Allow empty value
      if (rawValue === "") {
        setInputValue("");
        onValueChange?.(null);
        onChange?.({ value: null, unit: unit ?? null, measureType });
        return;
      }

      // Replace comma with dot for decimal separator
      const normalizedValue = rawValue.replace(",", ".");

      // Validate number format
      if (!/^\d*\.?\d*$/.test(normalizedValue)) {
        return; // Don't update if invalid format
      }

      const numericValue = parseFloat(normalizedValue);

      // Check bounds
      if (!isNaN(numericValue)) {
        if (min !== undefined && numericValue < min) return;
        if (max !== undefined && numericValue > max) return;

        const roundedValue = roundToDecimals(numericValue, decimals);
        setInputValue(rawValue); // Keep original input for better UX
        onValueChange?.(roundedValue);
        onChange?.({ value: roundedValue, unit: unit ?? null, measureType });
      }
    },
    [unit, measureType, onChange, onValueChange, min, max, decimals],
  );

  // Handle unit change
  const handleUnitChange = useCallback(
    (newUnitValue: string) => {
      const newUnit = newUnitValue === "" ? null : (newUnitValue as MEASURE_UNIT);

      // Convert value if possible
      if (value !== undefined && value !== null && unit && newUnit && unit !== newUnit && canConvertUnits(unit, newUnit)) {
        const convertedVal = convertValue(value, unit, newUnit);
        if (convertedVal !== null) {
          const roundedValue = roundToDecimals(convertedVal, decimals);
          setInputValue(formatNumber(roundedValue));
          onValueChange?.(roundedValue);
          onChange?.({ value: roundedValue, unit: newUnit, measureType });
        }
      } else {
        onChange?.({ value, unit: newUnit ?? null, measureType });
      }

      onUnitChange?.(newUnit);
    },
    [value, unit, measureType, onChange, onUnitChange, onValueChange, decimals],
  );

  // Handle measure type change
  const handleMeasureTypeChange = useCallback(
    (newMeasureType: MEASURE_TYPE) => {
      // When measure type changes, reset to default unit for that type
      let defaultUnit: MEASURE_UNIT;
      switch (newMeasureType) {
        case MEASURE_TYPE.WEIGHT:
          defaultUnit = MEASURE_UNIT.KILOGRAM;
          break;
        case MEASURE_TYPE.VOLUME:
          defaultUnit = MEASURE_UNIT.LITER;
          break;
        case MEASURE_TYPE.LENGTH:
          defaultUnit = MEASURE_UNIT.METER;
          break;
        case MEASURE_TYPE.COUNT:
          defaultUnit = MEASURE_UNIT.UNIT;
          break;
        case MEASURE_TYPE.AREA:
          defaultUnit = MEASURE_UNIT.METER;
          break;
        default:
          defaultUnit = MEASURE_UNIT.UNIT;
      }

      onChange?.({ value, unit: defaultUnit, measureType: newMeasureType });
      onMeasureTypeChange?.(newMeasureType);
      onUnitChange?.(defaultUnit);
    },
    [value, onChange, onMeasureTypeChange, onUnitChange],
  );

  // Update conversion when value, unit, or convertTo changes
  useEffect(() => {
    if (showConversion && convertTo && value !== undefined && value !== null && unit && canConvertUnits(unit, convertTo)) {
      const converted = convertValue(value, unit, convertTo);
      if (converted !== null) {
        setConvertedValue(`≈ ${formatNumber(roundToDecimals(converted, decimals))} ${MEASURE_UNIT_LABELS[convertTo]}`);
      } else {
        setConvertedValue("");
      }
    } else {
      setConvertedValue("");
    }
  }, [value, unit, convertTo, showConversion, decimals]);

  // Update input value when external value changes
  useEffect(() => {
    if (!inputRef.current?.matches(":focus")) {
      setInputValue(value !== undefined && value !== null ? formatNumber(value) : "");
    }
  }, [value]);

  const availableUnits = getAvailableUnits();
  const availableMeasureTypes = allowedMeasureTypes || Object.values(MEASURE_TYPE);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label className={cn(required && "after:content-['*'] after:text-destructive after:ml-1")}>{label}</Label>}

      <div className="flex gap-2">
        {/* Value Input */}
        <div className="flex-1">
          <Input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={handleValueChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            min={min}
            max={max}
            step={step}
            className={cn(error && "border-destructive focus-visible:ring-destructive", valueClassName)}
            {...props}
          />
        </div>

        {/* Unit Selector */}
        <div className="min-w-[100px]">
          <Combobox
            value={unit || ""}
            onValueChange={handleUnitChange}
            disabled={disabled}
            placeholder="Selecione unidade"
            triggerClassName={cn(error && "border-destructive focus-visible:ring-destructive", unitClassName)}
            options={[
              // Add option to clear unit for SIZE type measures
              ...(measureType === MEASURE_TYPE.SIZE ? [{ value: "", label: "Sem unidade" }] : []),
              ...availableUnits.map((unitOption) => ({
                value: unitOption,
                label: MEASURE_UNIT_LABELS[unitOption],
              })),
            ]}
            searchable={availableUnits.length > 10}
            clearable={false}
          />
        </div>

        {/* Measure Type Selector */}
        {showMeasureType && (
          <div className="min-w-[120px]">
            <Combobox
              value={measureType}
              onValueChange={(value) => value && handleMeasureTypeChange(value as MEASURE_TYPE)}
              disabled={disabled}
              placeholder="Tipo de medida"
              triggerClassName={cn(error && "border-destructive focus-visible:ring-destructive", measureTypeClassName)}
              options={availableMeasureTypes.map((typeOption) => ({
                value: typeOption,
                label: MEASURE_TYPE_LABELS[typeOption],
              }))}
              searchable={false}
              clearable={false}
            />
          </div>
        )}
      </div>

      {/* Conversion Display */}
      {showConversion && convertedValue && <div className="text-sm text-muted-foreground">{convertedValue}</div>}

      {/* Error Message */}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}

// Helper function to get measure type from unit
export function getMeasureTypeFromUnit(unit: MEASURE_UNIT): MEASURE_TYPE {
  const category = getMeasureUnitCategory(unit);
  switch (category) {
    case "Peso":
      return MEASURE_TYPE.WEIGHT;
    case "Volume":
      return MEASURE_TYPE.VOLUME;
    case "Comprimento":
      return MEASURE_TYPE.LENGTH;
    case "Contagem":
      return MEASURE_TYPE.COUNT;
    default:
      return MEASURE_TYPE.COUNT;
  }
}

// Preset configurations for common use cases
export const MEASURE_INPUT_PRESETS = {
  weight: {
    measureType: MEASURE_TYPE.WEIGHT,
    unit: MEASURE_UNIT.KILOGRAM,
    showConversion: true,
    convertTo: MEASURE_UNIT.GRAM,
    decimals: 3,
  },
  volume: {
    measureType: MEASURE_TYPE.VOLUME,
    unit: MEASURE_UNIT.LITER,
    showConversion: true,
    convertTo: MEASURE_UNIT.MILLILITER,
    decimals: 3,
  },
  length: {
    measureType: MEASURE_TYPE.LENGTH,
    unit: MEASURE_UNIT.METER,
    showConversion: false,
    decimals: 2,
  },
  count: {
    measureType: MEASURE_TYPE.COUNT,
    unit: MEASURE_UNIT.UNIT,
    showConversion: false,
    decimals: 0,
    step: 1,
  },
} as const;
