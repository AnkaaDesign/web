import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { addDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChartType } from "@/components/statistics/consumption-chart";

export type XAxisType = "sector" | "user";
export type YAxisType = "quantity" | "price";
export type PeriodType = "custom" | "month" | "year" | "quarter" | "last30days" | "last90days";
export type SortType = "item_name" | "item_unicode" | "item_price" | "item_quantity" | "item_consumption" | "item_total_price" | "user_name" | "sector_name";

export interface LabelConfig {
  showUserName: boolean;
  showSectorName: boolean;
  showItemName: boolean;
  showItemUnicode: boolean;
  showItemQuantity: boolean;
  showItemConsumption: boolean;
  showItemPrice: boolean;
  showPercentage: boolean;
  showTotal: boolean;
  position: "top" | "inside" | "bottom" | "right";
}

interface SubOptions {
  items?: string[];
  users?: string[];
  sectors?: string[];
}

interface ConsumptionFiltersAdvancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  xAxis: XAxisType;
  yAxis: YAxisType;
  period: PeriodType;
  dateRange: DateRange | undefined;
  sort: SortType;
  labelConfig: LabelConfig;
  subOptions: SubOptions;
  onXAxisChange: (value: XAxisType) => void;
  onYAxisChange: (value: YAxisType) => void;
  onPeriodChange: (value: PeriodType) => void;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onSortChange: (value: SortType) => void;
  onLabelConfigChange: (config: LabelConfig) => void;
  onSubOptionsChange: (options: SubOptions) => void;
  onApply: () => void;
  onReset: () => void;
  itemOptions?: Array<{ value: string; label: string; unicode?: string; description?: string }>;
  userOptions?: Array<{ value: string; label: string; description?: string }>;
  sectorOptions?: Array<{ value: string; label: string; description?: string }>;
  onItemSearch?: (search: string) => void;
  onUserSearch?: (search: string) => void;
  onSectorSearch?: (search: string) => void;
  isLoadingItems?: boolean;
  isLoadingUsers?: boolean;
  isLoadingSectors?: boolean;
}

export function ConsumptionFiltersAdvanced({
  open,
  onOpenChange,
  xAxis,
  yAxis,
  period,
  dateRange,
  sort,
  labelConfig,
  subOptions,
  onXAxisChange,
  onYAxisChange,
  onPeriodChange,
  onDateRangeChange,
  onSortChange,
  onLabelConfigChange,
  onSubOptionsChange,
  onApply,
  onReset,
  itemOptions = [],
  userOptions = [],
  sectorOptions = [],
}: ConsumptionFiltersAdvancedProps) {
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
      case "quarter":
        const currentMonth = now.getMonth();
        const quarterStart = new Date(now.getFullYear(), Math.floor(currentMonth / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(currentMonth / 3) * 3 + 3, 0);
        newRange = {
          from: quarterStart,
          to: quarterEnd,
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
        newRange = tempDateRange;
        break;
    }

    if (newRange) {
      setTempDateRange(newRange);
      onDateRangeChange(newRange);
    }
  };

  // Dynamic sort options based on X-axis selection
  const getSortOptions = useMemo(() => {
    const baseOptions = [
      { value: "item_name", label: "Nome do Item" },
      { value: "item_unicode", label: "Código do Item" },
      { value: "item_price", label: "Preço do Item" },
      { value: "item_quantity", label: "Quantidade do Item" },
      { value: "item_consumption", label: "Consumo do Item" },
      { value: "item_total_price", label: "Valor Total do Item" },
    ];

    if (xAxis === "user") {
      return [
        { value: "user_name", label: "Nome do Usuário" },
        ...baseOptions,
      ];
    } else if (xAxis === "sector") {
      return [
        { value: "sector_name", label: "Nome do Setor" },
        ...baseOptions,
      ];
    }

    return baseOptions;
  }, [xAxis]);

  // Dynamic label options based on axis selections
  const getLabelOptions = useMemo(() => {
    const options = [];

    if (xAxis === "sector") {
      options.push({ key: "showSectorName", label: "Nome do Setor" });
    }
    if (xAxis === "user") {
      options.push({ key: "showUserName", label: "Nome do Usuário" });
    }

    options.push(
      { key: "showItemName", label: "Nome do Item" },
      { key: "showItemUnicode", label: "Código do Item" },
      { key: "showItemQuantity", label: "Quantidade" },
      { key: "showItemConsumption", label: "Consumo" },
      { key: "showItemPrice", label: "Preço" },
      { key: "showPercentage", label: "Porcentagem" },
      { key: "showTotal", label: "Total Geral" }
    );

    return options;
  }, [xAxis]);


  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (subOptions.items && subOptions.items.length > 0) count++;
    if (subOptions.users && subOptions.users.length > 0) count++;
    if (subOptions.sectors && subOptions.sectors.length > 0) count++;
    return count;
  }, [subOptions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>Filtros Avançados de Consumo</SheetTitle>
          <SheetDescription>
            Configure os parâmetros principais e suas sub-opções
          </SheetDescription>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="w-fit">
              {activeFiltersCount} sub-filtros ativos
            </Badge>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Main Section - 6 Primary Controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <h3 className="font-semibold text-sm">Configurações Principais</h3>
              </div>

              {/* 1. X Axis Selection */}
              <div className="space-y-2">
                <Label htmlFor="x-axis">1. Eixo X - Agrupar dados por</Label>
                <Combobox
                  value={xAxis}
                  onValueChange={(value) => value && onXAxisChange(value as XAxisType)}
                  options={[
                    { value: "sector", label: "Por Setor", description: "Agrupar consumo por setores" },
                    { value: "user", label: "Por Usuário", description: "Agrupar consumo por usuários" },
                  ]}
                  mode="single"
                  placeholder="Selecione o agrupamento"
                />
              </div>

              {/* 2. Y Axis Selection */}
              <div className="space-y-2">
                <Label htmlFor="y-axis">2. Eixo Y - Métrica de valor</Label>
                <Combobox
                  value={yAxis}
                  onValueChange={(value) => value && onYAxisChange(value as YAxisType)}
                  options={[
                    { value: "quantity", label: "Quantidade" },
                    { value: "price", label: "Preço (R$)" },
                  ]}
                  mode="single"
                  placeholder="Selecione a métrica"
                />
              </div>

              {/* 3. Period Selection */}
              <div className="space-y-2">
                <Label htmlFor="period">3. Período de análise</Label>
                <Combobox
                  value={period}
                  onValueChange={(value) => value && handlePeriodChange(value as PeriodType)}
                  options={[
                    { value: "month", label: "Mês Atual" },
                    { value: "quarter", label: "Trimestre Atual" },
                    { value: "year", label: "Ano Atual" },
                    { value: "last30days", label: "Últimos 30 dias" },
                    { value: "last90days", label: "Últimos 90 dias" },
                    { value: "custom", label: "Personalizado" },
                  ]}
                  mode="single"
                  placeholder="Selecione o período"
                />
              </div>

              {/* Custom Date Range (shown only for custom period) */}
              {period === "custom" && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>Intervalo personalizado</Label>
                  <DateRangePicker
                    dateRange={tempDateRange}
                    onDateRangeChange={(range) => {
                      setTempDateRange(range);
                      onDateRangeChange(range);
                    }}
                  />
                </div>
              )}

              {/* 4. Sort Options */}
              <div className="space-y-2">
                <Label htmlFor="sort">4. Ordenação dos dados</Label>
                <Combobox
                  value={sort}
                  onValueChange={(value) => value && onSortChange(value as SortType)}
                  options={getSortOptions}
                  mode="single"
                  placeholder="Selecione a ordenação"
                />
              </div>

              {/* 5. Label Configuration */}
              <div className="space-y-2">
                <Label>5. Configuração de rótulos</Label>
                <div className="space-y-3">
                  <Combobox
                    value={getLabelOptions
                      .filter(option => labelConfig[option.key as keyof LabelConfig] === true)
                      .map(option => option.key)}
                    onValueChange={(values) => {
                      const newConfig = { ...labelConfig };
                      // Reset all boolean flags
                      getLabelOptions.forEach(option => {
                        newConfig[option.key as keyof LabelConfig] = false as any;
                      });
                      // Set selected flags to true
                      (values as string[]).forEach(key => {
                        newConfig[key as keyof LabelConfig] = true as any;
                      });
                      onLabelConfigChange(newConfig);
                    }}
                    options={getLabelOptions.map(option => ({
                      value: option.key,
                      label: option.label,
                    }))}
                    mode="multiple"
                    placeholder="Selecione os rótulos a exibir"
                    searchPlaceholder="Buscar rótulos..."
                    emptyText="Nenhum rótulo encontrado"
                    selectAllLabel="Selecionar todos"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="label-position" className="text-sm">Posição dos rótulos</Label>
                    <Combobox
                      value={labelConfig.position}
                      onValueChange={(value) =>
                        value && onLabelConfigChange({ ...labelConfig, position: value as "top" | "inside" | "bottom" | "right" })
                      }
                      options={[
                        { value: "top", label: "Acima" },
                        { value: "inside", label: "Dentro" },
                        { value: "bottom", label: "Abaixo" },
                        { value: "right", label: "À Direita" },
                      ]}
                      mode="single"
                      placeholder="Selecione a posição"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Sub-options Section - Dynamic based on main selections */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 bg-secondary rounded-full" />
                <h3 className="font-semibold text-sm">Sub-opções Dinâmicas</h3>
              </div>

              {/* Filter by Sectors (shown when X-axis is sector) */}
              {xAxis === "sector" && sectorOptions && (
                <div className="space-y-2">
                  <Label>Filtrar por Setores</Label>
                  <Combobox
                    value={subOptions.sectors || []}
                    onValueChange={(value) => {
                      // Handle "todos" option
                      if (value?.includes("todos")) {
                        const allSectorIds = sectorOptions.map(s => s.value);
                        onSubOptionsChange({ ...subOptions, sectors: allSectorIds });
                      } else {
                        onSubOptionsChange({ ...subOptions, sectors: value as string[] });
                      }
                    }}
                    options={[
                      { value: "todos", label: "Todos os Setores", description: "Selecionar todos" },
                      ...sectorOptions
                    ]}
                    mode="multiple"
                    placeholder="Selecione os setores"
                    searchPlaceholder="Buscar setores..."
                    emptyText="Nenhum setor encontrado"
                    selectAllLabel="Selecionar todos"
                  />
                </div>
              )}

              {/* Filter by Users (shown when X-axis is user) */}
              {xAxis === "user" && userOptions && (
                <div className="space-y-2">
                  <Label>Filtrar por Usuários</Label>
                  <Combobox
                    value={subOptions.users || []}
                    onValueChange={(value) => {
                      // Handle "todos" option
                      if (value?.includes("todos")) {
                        const allUserIds = userOptions.map(u => u.value);
                        onSubOptionsChange({ ...subOptions, users: allUserIds });
                      } else {
                        onSubOptionsChange({ ...subOptions, users: value as string[] });
                      }
                    }}
                    options={[
                      { value: "todos", label: "Todos os Usuários", description: "Selecionar todos" },
                      ...userOptions
                    ]}
                    mode="multiple"
                    placeholder="Selecione os usuários"
                    searchPlaceholder="Buscar usuários..."
                    emptyText="Nenhum usuário encontrado"
                    selectAllLabel="Selecionar todos"
                  />
                </div>
              )}

              {/* Filter by Items (always shown) */}
              {itemOptions && (
                <div className="space-y-2">
                  <Label>Filtrar por Itens</Label>
                  <Combobox
                    value={subOptions.items || []}
                    onValueChange={(value) => {
                      // Handle "todos" option
                      if (value?.includes("todos")) {
                        const allItemIds = itemOptions.map(i => i.value);
                        onSubOptionsChange({ ...subOptions, items: allItemIds });
                      } else {
                        onSubOptionsChange({ ...subOptions, items: value as string[] });
                      }
                    }}
                    options={[
                      { value: "todos", label: "Todos os Itens", description: "Selecionar todos" },
                      ...itemOptions.map(item => ({
                        value: item.value,
                        label: item.label,
                        description: item.unicode ? `Código: ${item.unicode}` : undefined,
                      }))
                    ]}
                    mode="multiple"
                    placeholder="Selecione os itens"
                    searchPlaceholder="Buscar itens..."
                    emptyText="Nenhum item encontrado"
                    selectAllLabel="Selecionar todos"
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer with action buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 border-t bg-background">
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onReset}
            >
              Limpar
            </Button>
            <Button
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