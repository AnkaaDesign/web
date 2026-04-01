import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { routes } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { usePayrollTrends, getHrComparisonType } from '@/hooks/human-resources/use-hr-analytics';
import type { HrAnalyticsFilters, HrChartType } from '@/types/hr-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatCurrency, formatPercentage, formatNumber } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReceipt,
  IconPercentage,
  IconGift,
  IconChartArea,
  IconStack2,
  IconBuilding,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconInfoCircle,
  IconCalendarStats,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;

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

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 3; i++) {
    const year = currentYear - i;
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
};

const YEAR_OPTIONS = generateYearOptions();

type PayrollYAxisMode = 'gross' | 'net' | 'taxes' | 'bonuses';

const Y_AXIS_OPTIONS: Array<{ value: PayrollYAxisMode; label: string }> = [
  { value: 'gross', label: 'Salário Bruto' },
  { value: 'net', label: 'Salário Líquido' },
  { value: 'taxes', label: 'Descontos / Impostos' },
  { value: 'bonuses', label: 'Bônus' },
];

const getAvailableChartTypes = (isComparisonMode: boolean): Array<{
  value: HrChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => {
  const baseTypes: Array<{
    value: HrChartType;
    label: string;
    icon: typeof IconChartBar;
    description: string;
  }> = [
    { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Gráfico de barras vertical' },
    { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Gráfico de linhas' },
    { value: 'area', label: 'Área', icon: IconChartArea, description: 'Gráfico de área' },
  ];

  if (isComparisonMode) {
    baseTypes.push({ value: 'bar-stacked', label: 'Barras Empilhadas', icon: IconStack2, description: 'Barras empilhadas para comparação' });
  } else {
    baseTypes.push({ value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Gráfico de pizza' });
  }

  return baseTypes;
};

// =====================
// Filter Sheet Component
// =====================

interface PayrollFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: HrAnalyticsFilters;
  onApply: (filters: HrAnalyticsFilters) => void;
  onReset: () => void;
  yAxisMode: PayrollYAxisMode;
  onYAxisModeChange: (mode: PayrollYAxisMode) => void;
}

function PayrollFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
  yAxisMode,
  onYAxisModeChange,
}: PayrollFiltersProps) {
  const [localFilters, setLocalFilters] = useState<HrAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<PayrollYAxisMode>(yAxisMode);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalYAxisMode(yAxisMode);
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters, yAxisMode]);

  const fetchSectors = useCallback(async (search: string, page: number = 1) => {
    const response = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    return count;
  }, [localFilters, selectedMonths]);

  const buildPeriods = useCallback(() => {
    if (!selectedYear || selectedMonths.length < 2) return undefined;
    return selectedMonths
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((monthStr) => {
        const monthNum = parseInt(monthStr);
        const monthStart = startOfMonth(new Date(selectedYear, monthNum - 1));
        const monthEnd = endOfMonth(new Date(selectedYear, monthNum - 1));
        const label = MONTH_OPTIONS.find((m) => m.value === monthStr)?.label || monthStr;
        return {
          id: `${selectedYear}-${monthStr}`,
          label: `${label} ${selectedYear}`,
          startDate: startOfDay(monthStart),
          endDate: endOfDay(monthEnd),
        };
      });
  }, [selectedYear, selectedMonths]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    if (selectedYear && selectedMonths.length > 0) {
      if (selectedMonths.length === 1) {
        const monthNum = parseInt(selectedMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.periods = undefined;
      } else {
        const periods = buildPeriods();
        finalFilters.periods = periods;
        const monthNums = selectedMonths.map((m) => parseInt(m));
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, Math.min(...monthNums) - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, Math.max(...monthNums) - 1)));
      }
    } else {
      finalFilters.periods = undefined;
    }

    onApply(finalFilters);
    onYAxisModeChange(localYAxisMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, buildPeriods, onApply, onOpenChange, localYAxisMode, onYAxisModeChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: HrAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'grossSalary',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
    setLocalYAxisMode('gross');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Folha de Pagamento - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise da folha de pagamento
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
                onChange={(value: string | number | null) => {
                  const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseInt(value) || 50 : 50);
                  setLocalFilters({ ...localFilters, limit: numValue });
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
                onValueChange={(value) => setLocalYAxisMode(value as PayrollYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                Define o valor exibido no eixo Y do gráfico
              </p>
            </div>

            {/* Period Selection */}
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
                      const yearStr = Array.isArray(year) ? year[0] : year;
                      const newYear = yearStr ? parseInt(yearStr) : undefined;
                      setSelectedYear(newYear);
                      if (!newYear) setSelectedMonths([]);
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
                    onValueChange={(months) => {
                      if (Array.isArray(months)) setSelectedMonths(months);
                      else if (months) setSelectedMonths([months]);
                      else setSelectedMonths([]);
                    }}
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

            {/* Sectors Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.sectorIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  sectorIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={[...sectorKeys.lists()]}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Selecione setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                loadingText="Carregando setores..."
                searchable={true}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                Selecione 2+ setores para modo de comparação
              </p>
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

// =====================
// Main Page Component
// =====================

const PayrollStatisticsPage = () => {
  usePageTracker({
    page: 'hr-payroll-analytics',
    title: 'Folha de Pagamento - Estatísticas',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<HrAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'grossSalary',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<HrChartType>('area');
  const [yAxisMode, setYAxisMode] = useState<PayrollYAxisMode>('gross');

  const comparisonType = useMemo(() => getHrComparisonType(filters), [filters]);
  const isComparisonMode = comparisonType !== 'simple';

  const availableChartTypes = useMemo(() => getAvailableChartTypes(isComparisonMode), [isComparisonMode]);

  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some((type) => type.value === selectedChartType);
    if (!isCurrentTypeAvailable) setSelectedChartType('area');
  }, [availableChartTypes, selectedChartType]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.periods && filters.periods.length >= 2) count++;
    return count;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = usePayrollTrends(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;

  const handleFilterApply = useCallback((newFilters: HrAnalyticsFilters) => {
    setFilters({ ...newFilters, limit: newFilters.limit || 50 });
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'grossSalary',
      sortOrder: 'desc',
      limit: 50,
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Período', 'Salário Bruto', 'Salário Líquido', 'Descontos', 'INSS', 'IRRF', 'FGTS', 'HE 50%', 'HE 100%', 'Adicional Noturno', 'Bônus', 'Funcionários'];
      const rows = items.map((item) => [
        item.label,
        item.grossSalary.toFixed(2),
        item.netSalary.toFixed(2),
        item.totalDiscounts.toFixed(2),
        item.inssAmount.toFixed(2),
        item.irrfAmount.toFixed(2),
        item.fgtsAmount.toFixed(2),
        item.overtime50Amount.toFixed(2),
        item.overtime100Amount.toFixed(2),
        item.nightDifferentialAmount.toFixed(2),
        item.bonusTotal.toFixed(2),
        item.headcount.toString(),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `folha-pagamento-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  const chartYAxisMode: YAxisMode = yAxisMode === 'gross' || yAxisMode === 'net' ? 'value' : 'value';

  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.map((item) => {
      let value: number;
      let secondaryValue: number;

      switch (yAxisMode) {
        case 'net':
          value = item.netSalary;
          secondaryValue = item.grossSalary;
          break;
        case 'taxes':
          value = item.totalDiscounts;
          secondaryValue = item.grossSalary;
          break;
        case 'bonuses':
          value = item.bonusTotal;
          secondaryValue = item.grossSalary;
          break;
        default:
          value = item.grossSalary;
          secondaryValue = item.netSalary;
          break;
      }

      return {
        name: item.label,
        value,
        secondaryValue,
      };
    });
  }, [items, yAxisMode]);

  const valueFormatter = useCallback((value: number, _mode: YAxisMode): string => {
    return formatCurrency(value);
  }, []);

  const yAxisLabel = useMemo(() => {
    switch (yAxisMode) {
      case 'net': return 'Salário Líquido (R$)';
      case 'taxes': return 'Descontos (R$)';
      case 'bonuses': return 'Bônus (R$)';
      default: return 'Salário Bruto (R$)';
    }
  }, [yAxisMode]);

  const tooltipLabels = useMemo(() => {
    switch (yAxisMode) {
      case 'net': return { primary: 'Salário Líquido', secondary: 'Salário Bruto' };
      case 'taxes': return { primary: 'Descontos', secondary: 'Salário Bruto' };
      case 'bonuses': return { primary: 'Bônus', secondary: 'Salário Bruto' };
      default: return { primary: 'Salário Bruto', secondary: 'Salário Líquido' };
    }
  }, [yAxisMode]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[600px] flex items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-[400px] w-[600px]" />
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'Ocorreu um erro ao buscar os dados'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros para visualizar os dados
            </p>
          </div>
        </div>
      );
    }

    return (
      <StatisticsChart
        data={chartData}
        chartType={selectedChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={isComparisonMode}
        height="600px"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        tooltipLabels={tooltipLabels}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Folha de Pagamento"
          icon={IconCash}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Recursos Humanos', href: routes.statistics.humanResources.root },
            { label: 'Folha de Pagamento' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Folha Total</CardTitle>
              <IconCash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[140px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {summary ? formatCurrency(summary.totalGrossSalary) : 'R$ 0,00'}
                  </div>
                  {summary && summary.monthOverMonthGrowth !== 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {summary.monthOverMonthGrowth > 0 ? (
                        <IconTrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <IconTrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      {formatPercentage(Math.abs(summary.monthOverMonthGrowth))} vs. mês anterior
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salário Médio</CardTitle>
              <IconReceipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[120px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? formatCurrency(summary.avgGrossSalary) : 'R$ 0,00'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carga Tributária</CardTitle>
              <IconPercentage className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[80px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? formatPercentage(summary.taxBurdenPercent) : '0%'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Bônus</CardTitle>
              <IconGift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[120px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? formatCurrency(summary.totalBonuses) : 'R$ 0,00'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Tendências da Folha de Pagamento</CardTitle>
                  <CardDescription>
                    Visualize a evolução da folha de pagamento por período
                    {isComparisonMode && (
                      <Badge variant="secondary" className="ml-2">
                        Modo Comparação: {comparisonType === 'sectors' ? 'Setores' : 'Períodos'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Chart Type Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {(() => {
                          const currentType = availableChartTypes.find((t) => t.value === selectedChartType);
                          const Icon = currentType?.icon;
                          return (
                            <>
                              {Icon && <Icon className="h-4 w-4 mr-2" />}
                              {currentType?.label}
                            </>
                          );
                        })()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={selectedChartType}
                        onValueChange={(value) => setSelectedChartType(value as HrChartType)}
                      >
                        {availableChartTypes.map((chartType) => {
                          const ChartIcon = chartType.icon;
                          return (
                            <DropdownMenuRadioItem key={chartType.value} value={chartType.value} className="group">
                              <ChartIcon className="h-4 w-4 mr-2" />
                              <div>
                                <div className="font-medium">{chartType.label}</div>
                                <div className="text-xs text-muted-foreground">{chartType.description}</div>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filter Button */}
                  <Button variant="outline" size="sm" onClick={() => setShowFilterDrawer(true)}>
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Export */}
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>

                  {/* Refresh */}
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <IconRefresh className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              {renderChart()}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        {items.length > 0 && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Período</CardTitle>
                <CardDescription>Valores detalhados da folha de pagamento</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">INSS</TableHead>
                      <TableHead className="text-right">IRRF</TableHead>
                      <TableHead className="text-right">FGTS</TableHead>
                      <TableHead className="text-right">Bônus</TableHead>
                      <TableHead className="text-right">Funcionários</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.period}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.grossSalary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.netSalary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.totalDiscounts)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.inssAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.irrfAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.fgtsAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.bonusTotal)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.headcount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      <PayrollFilters
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filters={filters}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        yAxisMode={yAxisMode}
        onYAxisModeChange={setYAxisMode}
      />
    </div>
  );
};

export default PayrollStatisticsPage;
