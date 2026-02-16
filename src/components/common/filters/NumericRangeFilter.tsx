import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconFilter, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface NumericRangeFilterProps {
  value?: NumericRange;
  onChange: (range: NumericRange | undefined) => void;
  placeholder?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  className?: string;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export function NumericRangeFilter({
  value,
  onChange,
  placeholder = "Filtrar por intervalo",
  minPlaceholder = "Mínimo",
  maxPlaceholder = "Máximo",
  className,
  step = 1,
  prefix,
  suffix,
}: NumericRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState<string>(value?.min?.toString() || "");
  const [localMax, setLocalMax] = useState<string>(value?.max?.toString() || "");

  useEffect(() => {
    setLocalMin(value?.min?.toString() || "");
    setLocalMax(value?.max?.toString() || "");
  }, [value]);

  const handleApply = () => {
    const min = localMin ? parseFloat(localMin) : undefined;
    const max = localMax ? parseFloat(localMax) : undefined;

    if (min !== undefined || max !== undefined) {
      onChange({ min, max });
    } else {
      onChange(undefined);
    }
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalMin("");
    setLocalMax("");
    onChange(undefined);
    setOpen(false);
  };

  const formatDisplay = () => {
    if (!value || (value.min === undefined && value.max === undefined)) {
      return placeholder;
    }

    const formatValue = (num: number) => {
      return `${prefix || ""}${num}${suffix || ""}`;
    };

    if (value.min !== undefined && value.max !== undefined) {
      return `${formatValue(value.min)} - ${formatValue(value.max)}`;
    }
    if (value.min !== undefined) {
      return `≥ ${formatValue(value.min)}`;
    }
    if (value.max !== undefined) {
      return `≤ ${formatValue(value.max)}`;
    }
    return placeholder;
  };

  const hasValue = value && (value.min !== undefined || value.max !== undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal", !hasValue && "text-muted-foreground", className)}
        >
          <IconFilter className="mr-2 h-4 w-4" />
          {formatDisplay()}
          {hasValue && (
            <IconX
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px]" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="min">Mínimo</Label>
            <Input
              id="min"
              type="number"
              step={step}
              placeholder={minPlaceholder}
              value={localMin}
              onChange={(value) => setLocalMin(value as string)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApply();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Máximo</Label>
            <Input
              id="max"
              type="number"
              step={step}
              placeholder={maxPlaceholder}
              value={localMax}
              onChange={(value) => setLocalMax(value as string)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApply();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClear()} className="flex-1">
              Limpar
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
