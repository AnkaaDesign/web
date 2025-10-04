import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { addDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";

export type XAxisType = "sector" | "user";
export type YAxisType = "quantity" | "price";
export type PeriodType = "custom" | "month" | "year" | "last30days" | "last90days";
export type SortType = "name_asc" | "name_desc" | "value_asc" | "value_desc" | "total_asc" | "total_desc";
export type LabelConfig = {
  showValues: boolean;
  showPercentage: boolean;
  showName: boolean;
  position: "top" | "inside" | "bottom";
};

interface ConsumptionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  xAxis: XAxisType;
  yAxis: YAxisType;
  period: PeriodType;
  dateRange: DateRange | undefined;
  sort: SortType;
  labelConfig: LabelConfig;
  onXAxisChange: (value: XAxisType) => void;
  onYAxisChange: (value: YAxisType) => void;
  onPeriodChange: (value: PeriodType) => void;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onSortChange: (value: SortType) => void;
  onLabelConfigChange: (config: LabelConfig) => void;
  onApply: () => void;
  onReset: () => void;
}

export function ConsumptionFilters({
  open,
  onOpenChange,
  xAxis,
  yAxis,
  period,
  dateRange,
  sort,
  labelConfig,
  onXAxisChange,
  onYAxisChange,
  onPeriodChange,
  onDateRangeChange,
  onSortChange,
  onLabelConfigChange,
  onApply,
  onReset,
}: ConsumptionFiltersProps) {
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);

  const handlePeriodChange = (value: PeriodType) => {
    onPeriodChange(value);

    const now = new Date();
    let newRange: DateRange | undefined;

    switch (value) {
      case "month":
        newRange = {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
        break;
      case "year":
        newRange = {
          from: startOfYear(now),
          to: endOfYear(now),
        };
        break;
      case "last30days":
        newRange = {
          from: addDays(now, -30),
          to: now,
        };
        break;
      case "last90days":
        newRange = {
          from: addDays(now, -90),
          to: now,
        };
        break;
      case "custom":
      default:
        // Keep current range for custom
        newRange = tempDateRange;
        break;
    }

    if (newRange) {
      setTempDateRange(newRange);
      onDateRangeChange(newRange);
    }
  };

  const getSortOptions = () => {
    const baseOptions = [
      { value: "value_desc", label: "Maior valor" },
      { value: "value_asc", label: "Menor valor" },
    ];

    if (xAxis === "user") {
      return [
        { value: "name_asc", label: "Nome (A-Z)" },
        { value: "name_desc", label: "Nome (Z-A)" },
        ...baseOptions,
      ];
    } else if (xAxis === "sector") {
      return [
        { value: "name_asc", label: "Setor (A-Z)" },
        { value: "name_desc", label: "Setor (Z-A)" },
        ...baseOptions,
        { value: "total_asc", label: "Total crescente" },
        { value: "total_desc", label: "Total decrescente" },
      ];
    }

    return baseOptions;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros de Consumo</SheetTitle>
          <SheetDescription>
            Configure os parâmetros de visualização do gráfico
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* X Axis Selection */}
          <div className="space-y-2">
            <Label htmlFor="x-axis">Eixo X - Agrupar por</Label>
            <Select value={xAxis} onValueChange={onXAxisChange}>
              <SelectTrigger id="x-axis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sector">Setor</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Y Axis Selection */}
          <div className="space-y-2">
            <Label htmlFor="y-axis">Eixo Y - Métrica</Label>
            <Select value={yAxis} onValueChange={onYAxisChange}>
              <SelectTrigger id="y-axis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity">Quantidade</SelectItem>
                <SelectItem value="price">Valor (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Period Selection */}
          <div className="space-y-2">
            <Label>Período</Label>
            <RadioGroup value={period} onValueChange={handlePeriodChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="month" id="month" />
                <Label htmlFor="month" className="font-normal">
                  Mês atual
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="year" id="year" />
                <Label htmlFor="year" className="font-normal">
                  Ano atual
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last30days" id="last30days" />
                <Label htmlFor="last30days" className="font-normal">
                  Últimos 30 dias
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last90days" id="last90days" />
                <Label htmlFor="last90days" className="font-normal">
                  Últimos 90 dias
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">
                  Personalizado
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Range Picker (only for custom period) */}
          {period === "custom" && (
            <div className="space-y-2">
              <Label>Intervalo de datas</Label>
              <DateRangePicker
                dateRange={tempDateRange}
                onDateRangeChange={(range) => {
                  setTempDateRange(range);
                  onDateRangeChange(range);
                }}
              />
            </div>
          )}

          {/* Sort Options */}
          <div className="space-y-2">
            <Label htmlFor="sort">Ordenação</Label>
            <Select value={sort} onValueChange={onSortChange}>
              <SelectTrigger id="sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getSortOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label Configuration */}
          <div className="space-y-4">
            <Label>Configuração de Rótulos</Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-values" className="font-normal">
                  Mostrar valores
                </Label>
                <Switch
                  id="show-values"
                  checked={labelConfig.showValues}
                  onCheckedChange={(checked) =>
                    onLabelConfigChange({ ...labelConfig, showValues: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-percentage" className="font-normal">
                  Mostrar porcentagem
                </Label>
                <Switch
                  id="show-percentage"
                  checked={labelConfig.showPercentage}
                  onCheckedChange={(checked) =>
                    onLabelConfigChange({ ...labelConfig, showPercentage: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-name" className="font-normal">
                  Mostrar nome
                </Label>
                <Switch
                  id="show-name"
                  checked={labelConfig.showName}
                  onCheckedChange={(checked) =>
                    onLabelConfigChange({ ...labelConfig, showName: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label-position">Posição dos rótulos</Label>
                <Select
                  value={labelConfig.position}
                  onValueChange={(value: "top" | "inside" | "bottom") =>
                    onLabelConfigChange({ ...labelConfig, position: value })
                  }
                >
                  <SelectTrigger id="label-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Acima</SelectItem>
                    <SelectItem value="inside">Dentro</SelectItem>
                    <SelectItem value="bottom">Abaixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onReset}
            >
              Redefinir
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onApply();
                onOpenChange(false);
              }}
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}