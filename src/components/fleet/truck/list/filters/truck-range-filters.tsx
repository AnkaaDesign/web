import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconRuler, IconMapPin } from "@tabler/icons-react";

interface TruckRangeFiltersProps {
  xPositionRange?: { min?: number; max?: number };
  yPositionRange?: { min?: number; max?: number };
  onXPositionRangeChange: (value: { min?: number; max?: number } | undefined) => void;
  onYPositionRangeChange: (value: { min?: number; max?: number } | undefined) => void;
}

interface RangeInputProps {
  label: string;
  unit: string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
  step?: number;
  placeholder?: { min: string; max: string };
}

function RangeInput({ label, unit, min, max, onChange, step = 0.1, placeholder }: RangeInputProps) {
  const handleMinChange = (value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    onChange(numValue, max);
  };

  const handleMaxChange = (value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    onChange(min, numValue);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mínimo ({unit})</Label>
          <Input type="number" step={step} value={min ?? ""} onChange={(value) => handleMinChange(value as string)} placeholder={placeholder?.min || "0"} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Máximo ({unit})</Label>
          <Input type="number" step={step} value={max ?? ""} onChange={(value) => handleMaxChange(value as string)} placeholder={placeholder?.max || "100"} />
        </div>
      </div>
    </div>
  );
}

export function TruckRangeFilters({
  xPositionRange,
  yPositionRange,
  onXPositionRangeChange,
  onYPositionRangeChange,
}: TruckRangeFiltersProps) {
  return (
    <div className="space-y-6">

      {/* Position Ranges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconMapPin className="h-5 w-5" />
            Posicionamento
          </CardTitle>
          <CardDescription>Filtre por intervalos de posição X e Y dos caminhões</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RangeInput
            label="Posição X"
            unit="m"
            min={xPositionRange?.min}
            max={xPositionRange?.max}
            onChange={(min, max) => {
              if (min === undefined && max === undefined) {
                onXPositionRangeChange(undefined);
              } else {
                onXPositionRangeChange({ min, max });
              }
            }}
            step={1}
            placeholder={{ min: "0", max: "100" }}
          />

          <RangeInput
            label="Posição Y"
            unit="m"
            min={yPositionRange?.min}
            max={yPositionRange?.max}
            onChange={(min, max) => {
              if (min === undefined && max === undefined) {
                onYPositionRangeChange(undefined);
              } else {
                onYPositionRangeChange({ min, max });
              }
            }}
            step={1}
            placeholder={{ min: "0", max: "100" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
