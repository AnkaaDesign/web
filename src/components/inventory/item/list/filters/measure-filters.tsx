import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { MEASURE_UNIT, MEASURE_TYPE, MEASURE_UNIT_LABELS, MEASURE_TYPE_LABELS } from "../../../../../constants";
import { IconRuler, IconRulerMeasure, IconScale, IconSettings } from "@tabler/icons-react";

interface MeasureFiltersProps {
  measureUnits?: string[];
  onMeasureUnitsChange: (units: string[]) => void;
  measureTypes?: string[];
  onMeasureTypesChange: (types: string[]) => void;
  hasMeasures?: boolean;
  onHasMeasuresChange: (value: boolean | undefined) => void;
  hasMultipleMeasures?: boolean;
  onHasMultipleMeasuresChange: (value: boolean | undefined) => void;
}

export function MeasureFilters({
  measureUnits = [],
  onMeasureUnitsChange,
  measureTypes = [],
  onMeasureTypesChange,
  hasMeasures,
  onHasMeasuresChange,
  hasMultipleMeasures,
  onHasMultipleMeasuresChange,
}: MeasureFiltersProps) {
  // Group measure units by category for better organization
  const measureUnitsByCategory = {
    weight: [MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM],
    volume: [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER],
    length: [MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER, MEASURE_UNIT.INCHES],
    count: [MEASURE_UNIT.UNIT, MEASURE_UNIT.PAIR, MEASURE_UNIT.DOZEN, MEASURE_UNIT.HUNDRED, MEASURE_UNIT.THOUSAND],
    packaging: [MEASURE_UNIT.PACKAGE, MEASURE_UNIT.BOX, MEASURE_UNIT.ROLL, MEASURE_UNIT.SHEET, MEASURE_UNIT.SET],
  };

  // Create measure unit options grouped by category
  const measureUnitOptions = [
    // Special options
    { value: "null", label: "Sem unidade de medida" },

    // Group all categorized units
    ...[
      // Weight units
      {
        category: "Peso",
        options: measureUnitsByCategory.weight.map((unit) => ({
          value: unit,
          label: `${MEASURE_UNIT_LABELS[unit]} (${unit.toLowerCase()})`,
        })),
      },

      // Volume units
      {
        category: "Volume",
        options: measureUnitsByCategory.volume.map((unit) => ({
          value: unit,
          label: `${MEASURE_UNIT_LABELS[unit]} (${unit.toLowerCase()})`,
        })),
      },

      // Length units
      {
        category: "Comprimento",
        options: measureUnitsByCategory.length.map((unit) => ({
          value: unit,
          label: `${MEASURE_UNIT_LABELS[unit]} (${unit.toLowerCase()})`,
        })),
      },

      // Count units
      {
        category: "Contagem",
        options: measureUnitsByCategory.count.map((unit) => ({
          value: unit,
          label: `${MEASURE_UNIT_LABELS[unit]} (${unit.toLowerCase()})`,
        })),
      },

      // Packaging units
      {
        category: "Embalagem",
        options: measureUnitsByCategory.packaging.map((unit) => ({
          value: unit,
          label: `${MEASURE_UNIT_LABELS[unit]} (${unit.toLowerCase()})`,
        })),
      },
    ].flatMap((group) => [
      // Add category separator for visual grouping
      { value: `__separator_${group.category}`, label: `--- ${group.category} ---`, disabled: true },
      ...group.options,
    ]),
  ];

  // Create measure type options
  const measureTypeOptions = Object.values(MEASURE_TYPE).map((type) => ({
    value: type,
    label: MEASURE_TYPE_LABELS[type],
  }));

  return (
    <div className="space-y-4">
      {/* Measure Status Switches */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconSettings className="h-4 w-4" />
          Status de Medidas
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasMeasures" className="text-sm font-normal flex items-center gap-2">
              <IconRuler className="h-4 w-4 text-muted-foreground" />
              Possui medidas definidas
            </Label>
            <Switch id="hasMeasures" checked={hasMeasures ?? false} onCheckedChange={(checked) => onHasMeasuresChange(checked ? true : undefined)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="hasMultipleMeasures" className="text-sm font-normal flex items-center gap-2">
              <IconScale className="h-4 w-4 text-muted-foreground" />
              Possui múltiplas medidas
            </Label>
            <Switch id="hasMultipleMeasures" checked={hasMultipleMeasures ?? false} onCheckedChange={(checked) => onHasMultipleMeasuresChange(checked ? true : undefined)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Measure Types */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconRulerMeasure className="h-4 w-4" />
          Tipos de Medida
        </Label>
        <Combobox
          mode="multiple"
          options={measureTypeOptions}
          value={measureTypes}
          onValueChange={onMeasureTypesChange}
          placeholder="Selecione tipos de medida..."
          emptyText="Nenhum tipo encontrado"
          searchPlaceholder="Buscar tipos..."
        />
        {measureTypes.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {measureTypes.length} tipo{measureTypes.length !== 1 ? "s" : ""} selecionado{measureTypes.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Measure Units */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconRuler className="h-4 w-4" />
          Unidades de Medida
        </Label>
        <Combobox
          mode="multiple"
          options={measureUnitOptions}
          value={measureUnits}
          onValueChange={onMeasureUnitsChange}
          placeholder="Selecione unidades de medida..."
          emptyText="Nenhuma unidade encontrada"
          searchPlaceholder="Buscar unidades..."
        />
        {measureUnits.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {measureUnits.length} unidade{measureUnits.length !== 1 ? "s" : ""} selecionada{measureUnits.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <Separator />

      {/* Quick Filter Buttons */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconSettings className="h-4 w-4" />
          Filtros Rápidos
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMeasureUnitsChange(measureUnitsByCategory.weight)}
            className="px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            Apenas Peso
          </button>
          <button
            type="button"
            onClick={() => onMeasureUnitsChange(measureUnitsByCategory.volume)}
            className="px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            Apenas Volume
          </button>
          <button
            type="button"
            onClick={() => onMeasureUnitsChange(measureUnitsByCategory.length)}
            className="px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            Apenas Comprimento
          </button>
          <button
            type="button"
            onClick={() => onMeasureUnitsChange(measureUnitsByCategory.count)}
            className="px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            Apenas Contagem
          </button>
        </div>
      </div>
    </div>
  );
}
