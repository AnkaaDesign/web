// web/src/components/inventory/statistics/order-filters.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import {
  IconFilter,
  IconX,
  IconCalendar,
  IconUsers,
  IconPackage,
  IconTag,
  IconCategory,
  IconNumbers,
  IconRuler,
} from '@tabler/icons-react';
import { startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { OrderAnalyticsFilters, OrderPeriod } from '@/types/order-analytics';
import { getSuppliers } from '@/api-client/supplier';
import { getItems } from '@/api-client/item';
import { getItemBrands } from '@/api-client/item-brand';
import { getItemCategories } from '@/api-client/item-category';
import { supplierKeys, itemKeys, itemBrandKeys, itemCategoryKeys } from '@/hooks/common/query-keys';



// Page size for async combobox
const COMBOBOX_PAGE_SIZE = 20;

type YAxisMode = 'quantity' | 'value';

interface OrderFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: OrderAnalyticsFilters;
  onApply: (filters: OrderAnalyticsFilters) => void;
  onReset: () => void;
  yAxisMode?: YAxisMode;
  onYAxisModeChange?: (mode: YAxisMode) => void;
}

// Generate year options (current year and 3 years back)
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 3; i++) {
    const year = currentYear - i;
    years.push({
      value: year.toString(),
      label: year.toString(),
    });
  }
  return years;
};

// Month options
const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const YEAR_OPTIONS = generateYearOptions();

// Y-axis mode options
const Y_AXIS_OPTIONS = [
  { value: 'quantity', label: 'Quantidade' },
  { value: 'value', label: 'Preço (R$)' },
];

export function OrderFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
  yAxisMode = 'quantity',
  onYAxisModeChange,
}: OrderFiltersProps) {
  const [localFilters, setLocalFilters] = useState<OrderAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<YAxisMode>(yAxisMode);

  // Year and month state for period selector
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Sync local state when drawer opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalYAxisMode(yAxisMode);
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters, yAxisMode]);

  // Handle Y-axis mode change - automatically update sortBy
  const handleYAxisModeChange = useCallback((mode: YAxisMode) => {
    setLocalYAxisMode(mode);
    // Auto-update sortBy based on Y-axis mode
    setLocalFilters(prev => ({
      ...prev,
      sortBy: mode === 'value' ? 'value' : 'quantity',
    }));
  }, []);

  // Async query functions for comboboxes
  const fetchSuppliers = useCallback(async (search: string, page: number = 1) => {
    const response = await getSuppliers({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((supplier) => ({
        value: supplier.id,
        label: supplier.fantasyName,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const fetchItems = useCallback(async (search: string, page: number = 1) => {
    const response = await getItems({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((item) => ({
        value: item.id,
        label: item.name,
        description: item.brand?.name || item.category?.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const fetchBrands = useCallback(async (search: string, page: number = 1) => {
    const response = await getItemBrands({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((brand) => ({
        value: brand.id,
        label: brand.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const fetchCategories = useCallback(async (search: string, page: number = 1) => {
    const response = await getItemCategories({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.supplierIds && localFilters.supplierIds.length > 0) count++;
    if (localFilters.itemIds && localFilters.itemIds.length > 0) count++;
    if (localFilters.brandIds && localFilters.brandIds.length > 0) count++;
    if (localFilters.categoryIds && localFilters.categoryIds.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    return count;
  }, [localFilters, selectedMonths]);

  // Calculate period date range when year/months are selected
  const periodDateRange = useMemo(() => {
    if (!selectedYear || selectedMonths.length === 0) return null;

    const monthNumbers = selectedMonths.map(m => parseInt(m));
    const minMonth = Math.min(...monthNumbers);
    const maxMonth = Math.max(...monthNumbers);

    const fromDate = startOfMonth(new Date(selectedYear, minMonth - 1));
    const toDate = endOfMonth(new Date(selectedYear, maxMonth - 1));

    return { from: startOfDay(fromDate), to: endOfDay(toDate) };
  }, [selectedYear, selectedMonths]);

  // Build periods for comparison when multiple months selected
  const buildPeriods = useCallback((): OrderPeriod[] | undefined => {
    if (!selectedYear || selectedMonths.length < 2) return undefined;

    return selectedMonths
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(monthStr => {
        const monthNum = parseInt(monthStr);
        const monthStart = startOfMonth(new Date(selectedYear, monthNum - 1));
        const monthEnd = endOfMonth(new Date(selectedYear, monthNum - 1));
        const monthLabel = MONTH_OPTIONS.find(m => m.value === monthStr)?.label || monthStr;

        return {
          id: `${selectedYear}-${monthStr}`,
          label: `${monthLabel} ${selectedYear}`,
          startDate: startOfDay(monthStart),
          endDate: endOfDay(monthEnd),
        };
      });
  }, [selectedYear, selectedMonths]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    // Handle year/month selection
    if (selectedYear && selectedMonths.length > 0) {
      if (selectedMonths.length === 1) {
        // Single month: use as date range filter
        const monthNum = parseInt(selectedMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.periods = undefined;
      } else {
        // Multiple months: use for period comparison
        const periods = buildPeriods();
        finalFilters.periods = periods;
        if (periodDateRange) {
          finalFilters.startDate = periodDateRange.from;
          finalFilters.endDate = periodDateRange.to;
        }
      }
    } else {
      finalFilters.periods = undefined;
    }

    onApply(finalFilters);
    onYAxisModeChange?.(localYAxisMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, buildPeriods, periodDateRange, onApply, onOpenChange, localYAxisMode, onYAxisModeChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: OrderAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      sortBy: 'quantity',
      sortOrder: 'desc',
      limit: 50,
      topSuppliersLimit: 10,
      topItemsLimit: 10,
      trendGroupBy: 'month',
    };
    setLocalFilters(defaultFilters);
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Análise de Pedidos - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de pedidos
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Limit */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconNumbers className="h-4 w-4" />
                Número de Resultados
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={localFilters.limit || 50}
                onChange={(value: number | undefined) => {
                  const numValue = value || 50;
                  setLocalFilters({
                    ...localFilters,
                    limit: numValue,
                  });
                }}
                placeholder="50"
                className="bg-transparent"
              />
            </div>

            {/* Y-Axis Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconRuler className="h-4 w-4" />
                Eixo Y (Gráfico)
              </Label>
              <Combobox
                value={localYAxisMode}
                onValueChange={(value) => handleYAxisModeChange(value as YAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                Define o valor exibido no eixo Y e a ordenação padrão
              </p>
            </div>

            {/* Period Selection - Year and Month */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Período
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Combobox
                    value={selectedYear?.toString() || ''}
                    onValueChange={(year) => {
                      const newYear = year ? parseInt(year) : undefined;
                      setSelectedYear(newYear);
                      if (!newYear) {
                        setSelectedMonths([]);
                      }
                    }}
                    options={YEAR_OPTIONS}
                    placeholder="Ano..."
                    searchable={false}
                    clearable={true}
                  />
                </div>
                <div className="col-span-2">
                  <Combobox
                    mode="multiple"
                    value={selectedMonths}
                    onValueChange={(months) => setSelectedMonths(months)}
                    options={MONTH_OPTIONS}
                    placeholder={selectedYear ? 'Selecione os meses...' : 'Selecione um ano primeiro'}
                    searchPlaceholder="Buscar meses..."
                    emptyText="Nenhum mês encontrado"
                    disabled={!selectedYear}
                    searchable={true}
                    clearable={true}
                  />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Data Personalizada
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.startDate}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setLocalFilters({
                          ...localFilters,
                          startDate: startOfDay(date),
                        });
                        // Clear period selection when using custom date
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data inicial..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.endDate}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setLocalFilters({
                          ...localFilters,
                          endDate: endOfDay(date),
                        });
                        // Clear period selection when using custom date
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data final..."
                  />
                </div>
              </div>
            </div>

            {/* Suppliers Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconUsers className="h-4 w-4" />
                Fornecedores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.supplierIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  supplierIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={supplierKeys.lists()}
                queryFn={fetchSuppliers}
                minSearchLength={0}
                placeholder="Todos os fornecedores"
                searchPlaceholder="Buscar fornecedor..."
                emptyText="Nenhum fornecedor encontrado"
                loadingText="Carregando fornecedores..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Items Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconPackage className="h-4 w-4" />
                Itens
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.itemIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  itemIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={itemKeys.lists()}
                queryFn={fetchItems}
                minSearchLength={0}
                placeholder="Todos os itens"
                searchPlaceholder="Buscar item..."
                emptyText="Nenhum item encontrado"
                loadingText="Carregando itens..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Brands Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconTag className="h-4 w-4" />
                Marcas
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.brandIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  brandIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={itemBrandKeys.lists()}
                queryFn={fetchBrands}
                minSearchLength={0}
                placeholder="Todas as marcas"
                searchPlaceholder="Buscar marca..."
                emptyText="Nenhuma marca encontrada"
                loadingText="Carregando marcas..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Categories Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCategory className="h-4 w-4" />
                Categorias
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.categoryIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  categoryIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={itemCategoryKeys.lists()}
                queryFn={fetchCategories}
                minSearchLength={0}
                placeholder="Todas as categorias"
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada"
                loadingText="Carregando categorias..."
                searchable={true}
                clearable={true}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
