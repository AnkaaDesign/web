import { useState, useMemo } from "react";
import { useFormContext, useWatch, type UseFieldArrayReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { MEASURE_UNIT, MEASURE_TYPE, MEASURE_UNIT_LABELS, MEASURE_TYPE_LABELS } from "../../../../constants";
import { fractionToDecimal, decimalToFraction } from "../../../../utils/fraction";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface MeasureInputProps {
  fieldArray: UseFieldArrayReturn<ItemCreateFormData | ItemUpdateFormData, "measures", "id">;
  disabled?: boolean;
  required?: boolean;
  categoryId?: string;
}

// Unit categories based on measure type
const UNIT_CATEGORIES = {
  [MEASURE_TYPE.WEIGHT]: [MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM],
  [MEASURE_TYPE.VOLUME]: [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER],
  [MEASURE_TYPE.LENGTH]: [MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER, MEASURE_UNIT.INCHES],
  [MEASURE_TYPE.AREA]: [MEASURE_UNIT.SQUARE_CENTIMETER, MEASURE_UNIT.SQUARE_METER],
  [MEASURE_TYPE.COUNT]: [
    MEASURE_UNIT.UNIT,
    MEASURE_UNIT.PAIR,
    MEASURE_UNIT.DOZEN,
    MEASURE_UNIT.HUNDRED,
    MEASURE_UNIT.THOUSAND,
    MEASURE_UNIT.PACKAGE,
    MEASURE_UNIT.BOX,
    MEASURE_UNIT.ROLL,
    MEASURE_UNIT.SHEET,
    MEASURE_UNIT.SET,
  ],
  [MEASURE_TYPE.DIAMETER]: [
    MEASURE_UNIT.MILLIMETER,
    MEASURE_UNIT.CENTIMETER,
    MEASURE_UNIT.INCHES,
  ],
  [MEASURE_TYPE.THREAD]: [MEASURE_UNIT.THREAD_MM, MEASURE_UNIT.THREAD_TPI],
  [MEASURE_TYPE.ELECTRICAL]: [MEASURE_UNIT.WATT, MEASURE_UNIT.VOLT, MEASURE_UNIT.AMPERE],
  // SIZE type is handled only in PPE config, not in general measures
};

export function MeasureInput({ fieldArray, disabled }: MeasureInputProps) {
  const { fields, append, remove } = fieldArray;
  const [newMeasure, setNewMeasure] = useState({
    measureType: MEASURE_TYPE.WEIGHT,
    unit: MEASURE_UNIT.KILOGRAM,
    value: 0,
  });
  // Track input string for INCHES unit (fractions like "1/4")
  const [inputString, setInputString] = useState<string>("");

  // Get existing measure types to avoid duplicates
  const { getValues } = useFormContext<ItemCreateFormData | ItemUpdateFormData>();
  const existingMeasureTypes = useMemo(() => {
    const formValues = getValues();
    return (formValues.measures || [])
      .map((measure: any) => measure?.measureType)
      .filter(Boolean);
  }, [fields.length, getValues]);

  const addMeasure = () => {
    // SIZE type is handled only in PPE config, not here
    // All other types require both value and unit

    // For INCHES unit, convert fraction string to decimal
    let finalValue = newMeasure.value;
    if (newMeasure.unit === MEASURE_UNIT.INCHES && inputString) {
      const decimalValue = fractionToDecimal(inputString);
      if (decimalValue === null || decimalValue <= 0) {
        // Invalid fraction input
        return;
      }
      finalValue = decimalValue;
    }

    const isValid = finalValue > 0 && newMeasure.unit;

    if (isValid && !existingMeasureTypes.includes(newMeasure.measureType)) {
      append({
        value: finalValue,
        unit: newMeasure.unit,
        measureType: newMeasure.measureType,
      });
      // Reset to next suggested type
      setNewMeasure(getNextSuggestedMeasure());
      setInputString("");
    }
  };

  const getNextSuggestedMeasure = () => {
    // Skip SIZE type as it's only for PPE config
    if (!existingMeasureTypes.includes(MEASURE_TYPE.WEIGHT)) {
      return { measureType: MEASURE_TYPE.WEIGHT, unit: MEASURE_UNIT.KILOGRAM, value: 0 };
    } else if (!existingMeasureTypes.includes(MEASURE_TYPE.VOLUME)) {
      return { measureType: MEASURE_TYPE.VOLUME, unit: MEASURE_UNIT.LITER, value: 0 };
    } else if (!existingMeasureTypes.includes(MEASURE_TYPE.LENGTH)) {
      return { measureType: MEASURE_TYPE.LENGTH, unit: MEASURE_UNIT.METER, value: 0 };
    } else if (!existingMeasureTypes.includes(MEASURE_TYPE.AREA)) {
      return { measureType: MEASURE_TYPE.AREA, unit: MEASURE_UNIT.SQUARE_METER, value: 0 };
    } else {
      return { measureType: MEASURE_TYPE.COUNT, unit: MEASURE_UNIT.UNIT, value: 0 };
    }
  };

  const removeMeasure = (index: number) => {
    remove(index);
  };

  // Get available units for a specific measure type
  const getAvailableUnits = (measureType: string) => {
    return UNIT_CATEGORIES[measureType as keyof typeof UNIT_CATEGORIES] || Object.values(MEASURE_UNIT);
  };

  // Get full unit description with abbreviation and name
  const getUnitDisplayName = (unit: MEASURE_UNIT) => {
    const unitDescriptions: Record<MEASURE_UNIT, string> = {
      // Weight
      [MEASURE_UNIT.GRAM]: `${MEASURE_UNIT_LABELS[unit]} - Grama`,
      [MEASURE_UNIT.KILOGRAM]: `${MEASURE_UNIT_LABELS[unit]} - Quilograma`,

      // Volume
      [MEASURE_UNIT.MILLILITER]: `${MEASURE_UNIT_LABELS[unit]} - Mililitro`,
      [MEASURE_UNIT.LITER]: `${MEASURE_UNIT_LABELS[unit]} - Litro`,
      [MEASURE_UNIT.CUBIC_METER]: `${MEASURE_UNIT_LABELS[unit]} - Metro Cúbico`,
      [MEASURE_UNIT.CUBIC_CENTIMETER]: `${MEASURE_UNIT_LABELS[unit]} - Centímetro Cúbico`,

      // Length
      [MEASURE_UNIT.MILLIMETER]: `${MEASURE_UNIT_LABELS[unit]} - Milímetro`,
      [MEASURE_UNIT.CENTIMETER]: `${MEASURE_UNIT_LABELS[unit]} - Centímetro`,
      [MEASURE_UNIT.METER]: `${MEASURE_UNIT_LABELS[unit]} - Metro`,
      [MEASURE_UNIT.INCHES]: `${MEASURE_UNIT_LABELS[unit]} - Polegada`,

      // Area
      [MEASURE_UNIT.SQUARE_CENTIMETER]: `${MEASURE_UNIT_LABELS[unit]} - Centímetro Quadrado`,
      [MEASURE_UNIT.SQUARE_METER]: `${MEASURE_UNIT_LABELS[unit]} - Metro Quadrado`,

      // Count
      [MEASURE_UNIT.UNIT]: `${MEASURE_UNIT_LABELS[unit]} - Unidade`,
      [MEASURE_UNIT.PAIR]: `${MEASURE_UNIT_LABELS[unit]} - Par`,
      [MEASURE_UNIT.DOZEN]: `${MEASURE_UNIT_LABELS[unit]} - Dúzia`,
      [MEASURE_UNIT.HUNDRED]: `${MEASURE_UNIT_LABELS[unit]} - Centena`,
      [MEASURE_UNIT.THOUSAND]: `${MEASURE_UNIT_LABELS[unit]} - Milheiro`,
      [MEASURE_UNIT.PACKAGE]: `${MEASURE_UNIT_LABELS[unit]} - Pacote`,
      [MEASURE_UNIT.BOX]: `${MEASURE_UNIT_LABELS[unit]} - Caixa`,
      [MEASURE_UNIT.ROLL]: `${MEASURE_UNIT_LABELS[unit]} - Rolo`,
      [MEASURE_UNIT.SHEET]: `${MEASURE_UNIT_LABELS[unit]} - Folha`,
      [MEASURE_UNIT.SET]: `${MEASURE_UNIT_LABELS[unit]} - Conjunto`,
      [MEASURE_UNIT.SACK]: `${MEASURE_UNIT_LABELS[unit]} - Saco`,


      // Thread pitch
      [MEASURE_UNIT.THREAD_MM]: `${MEASURE_UNIT_LABELS[unit]} - Milímetros de Passo`,
      [MEASURE_UNIT.THREAD_TPI]: `${MEASURE_UNIT_LABELS[unit]} - Fios por Polegada`,

      // Electrical
      [MEASURE_UNIT.WATT]: `${MEASURE_UNIT_LABELS[unit]} - Watts`,
      [MEASURE_UNIT.VOLT]: `${MEASURE_UNIT_LABELS[unit]} - Volts`,
      [MEASURE_UNIT.AMPERE]: `${MEASURE_UNIT_LABELS[unit]} - Amperes`,

      // PPE Size units
      [MEASURE_UNIT.P]: `${MEASURE_UNIT_LABELS[unit]} - Pequeno`,
      [MEASURE_UNIT.M]: `${MEASURE_UNIT_LABELS[unit]} - Médio`,
      [MEASURE_UNIT.G]: `${MEASURE_UNIT_LABELS[unit]} - Grande`,
      [MEASURE_UNIT.GG]: `${MEASURE_UNIT_LABELS[unit]} - Extra Grande`,
      [MEASURE_UNIT.XG]: `${MEASURE_UNIT_LABELS[unit]} - Extra Extra Grande`,
    };

    return unitDescriptions[unit] || MEASURE_UNIT_LABELS[unit];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medidas</CardTitle>
        <p className="text-sm text-muted-foreground">Configure as medidas do item (peso, volume, comprimento, etc.)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input row for adding new measure */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] gap-2">
          {/* Measure Type */}
          <Combobox
            key="measure-type-select"
            value={newMeasure.measureType}
            onValueChange={(value: string) => {
              const measureType = value as MEASURE_TYPE;
              const availableUnits = getAvailableUnits(measureType);
              setNewMeasure({
                measureType,
                unit: availableUnits[0] || MEASURE_UNIT.UNIT,
                value: newMeasure.value,
              });
            }}
            disabled={disabled}
            options={Object.values(MEASURE_TYPE)
              .filter((type) => type !== MEASURE_TYPE.SIZE) // Exclude SIZE type - only for PPE config
              .map((type) => ({
                label: MEASURE_TYPE_LABELS[type],
                value: type,
              }))}
            placeholder="Selecione o tipo"
            searchPlaceholder="Buscar tipo..."
            className="w-full"
          />

          {/* Value */}
          {newMeasure.unit === MEASURE_UNIT.INCHES ? (
            <Input
              type="text"
              value={inputString}
              onChange={(value) => {
                const stringValue = typeof value === "string" ? value : "";
                setInputString(stringValue);
                // Try to convert to decimal for validation
                const decimal = fractionToDecimal(stringValue);
                setNewMeasure((prev: any) => ({
                  ...prev,
                  value: decimal !== null ? decimal : 0,
                }));
              }}
              placeholder='1/4, 1/2, 1 1/4...'
              disabled={disabled}
              className="w-full md:w-32"
              transparent
            />
          ) : (
            <Input
              type="decimal"
              value={newMeasure.value || null}
              onChange={(value) => {
                setNewMeasure((prev: any) => ({
                  ...prev,
                  value: typeof value === "number" ? value : 0,
                }));
              }}
              placeholder="0"
              disabled={disabled}
              className="w-full md:w-32"
              transparent
            />
          )}

          {/* Unit */}
          <Combobox
            key={`measure-unit-select-${newMeasure.measureType}`}
            value={newMeasure.unit}
            onValueChange={(value: string) => {
              const newUnit = value as MEASURE_UNIT;
              // If switching to INCHES and we have a value, convert to fraction string
              if (newUnit === MEASURE_UNIT.INCHES && newMeasure.value > 0) {
                setInputString(decimalToFraction(newMeasure.value));
              } else {
                setInputString("");
              }
              setNewMeasure((prev: any) => ({
                ...prev,
                unit: newUnit,
              }));
            }}
            disabled={disabled}
            options={getAvailableUnits(newMeasure.measureType).map((unit) => ({
              label: getUnitDisplayName(unit),
              value: unit,
            }))}
            placeholder="Selecione a unidade"
            searchPlaceholder="Buscar unidade..."
            className="w-full"
          />

          {/* Add Button */}
          <Button
            type="button"
            onClick={addMeasure}
            disabled={disabled || existingMeasureTypes.includes(newMeasure.measureType) || newMeasure.value <= 0 || !newMeasure.unit}
            size="icon"
            variant="default"
            className="flex-shrink-0"
          >
            <IconPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Existing measures */}
        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((field: any, index: number) => (
              <MeasureInputRow key={field.id} index={index} disabled={disabled} onRemove={() => removeMeasure(index)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MeasureInputRowProps {
  index: number;
  disabled?: boolean;
  onRemove: () => void;
}

function MeasureInputRow({ index, disabled, onRemove }: MeasureInputRowProps) {
  const form = useFormContext<ItemCreateFormData | ItemUpdateFormData>();
  // Watch the current values for this measure
  const currentMeasure = useWatch({
    control: form.control,
    name: `measures.${index}`,
    defaultValue: {
      measureType: MEASURE_TYPE.COUNT,
      unit: MEASURE_UNIT.UNIT,
      value: 0,
    },
  });

  // Format value - show fractions for INCHES
  const displayValue = () => {
    if (currentMeasure?.measureType === MEASURE_TYPE.SIZE) {
      return currentMeasure?.value ? currentMeasure.value : "-";
    }
    if (currentMeasure?.unit === MEASURE_UNIT.INCHES && currentMeasure?.value) {
      return `${decimalToFraction(currentMeasure.value)}"`;
    }
    return currentMeasure?.value || 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] gap-2">
      <div className="px-3 py-2 border border-input bg-muted/50 rounded-md text-sm w-full">
        {currentMeasure?.measureType ? MEASURE_TYPE_LABELS[currentMeasure.measureType as MEASURE_TYPE] : "Tipo"}
      </div>
      <div className="px-3 py-2 border border-input bg-muted/50 rounded-md text-sm text-center w-full md:w-32">
        {displayValue()}
      </div>
      <div className="px-3 py-2 border border-input bg-muted/50 rounded-md text-sm w-full">
        {currentMeasure?.measureType === MEASURE_TYPE.SIZE
          ? currentMeasure?.unit
            ? MEASURE_UNIT_LABELS[currentMeasure.unit as MEASURE_UNIT]
            : "-"
          : currentMeasure?.unit
            ? MEASURE_UNIT_LABELS[currentMeasure.unit as MEASURE_UNIT]
            : "Unidade"}
      </div>

      <Button type="button" onClick={onRemove} disabled={disabled} size="icon" variant="destructive" className="flex-shrink-0">
        <IconTrash className="h-4 w-4" />
      </Button>
    </div>
  );
}
