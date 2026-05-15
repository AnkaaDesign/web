// web/src/pages/inventory/statistics/stock-movement.tsx
//
// Canonical statistics page for stock movement (entradas / saídas / saldo).
// Layout matches productivity / collection / consumption: PageHeader inside a
// fixed shell, Card body with toolbar + KPI cards + chart that fills viewport.
//
// NOTE: no backend hook exists yet for stock-movement analytics. The page is
// wired to an inline `useStockMovementAnalytics` placeholder that returns
// empty data and is TODO so the layout is correct as soon as the real hook
// lands. Replace the placeholder with `@/hooks/inventory/use-stock-movement-analytics`
// when it's available.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  formatCurrency,
  formatNumber,
  MONTH_OPTIONS,
  generateYearOptions,
  type StatisticsChartType,
  type YAxisMode,
  type TrendLineType,
} from '@/types/statistics-common';
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { toast } from '@/components/ui/sonner';
import {
  IconChartBar, IconChartLine, IconChartArea, IconStack2,
  IconFilter, IconDownload, IconRefresh, IconAlertCircle,
  IconCalendarStats, IconChartArcs3, IconTrendingUp,
  IconArrowUp, IconArrowDown, IconScale, IconPackage, IconX,
  IconFileTypeCsv, IconFileTypeXls,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';

// =====================
// Local types — placeholder until a real analytics module exists
// =====================

type StockMovementXAxisMode = 'month' | 'year';
type StockMovementYAxisMode = 'count' | 'value';
type StockMovementChartType = 'bar' | 'bar-stacked' | 'line' | 'line-smooth' | 'area' | 'area-smooth';

interface StockMovementFilters {
  xAxisMode: StockMovementXAxisMode;
  yAxisMode: StockMovementYAxisMode;
  startDate?: Date;
  endDate?: Date;
}

interface StockMovementItem {
  period: string;       // "2026-01" or "2026"
  periodLabel: string;  // "Janeiro 2026" or "2026"
  inbound: number;      // entries
  outbound: number;     // exits
  balance: number;      // inbound - outbound
  itemsMoved: number;   // distinct items
  inboundValue: number;
  outboundValue: number;
}

interface StockMovementSummary {
  totalInbound: number;
  totalOutbound: number;
  totalBalance: number;
  totalItemsMoved: number;
  totalInboundValue: number;
  totalOutboundValue: number;
}

interface StockMovementAnalytics {
  items: StockMovementItem[];
  summary: StockMovementSummary;
}

// TODO: replace with real hook `@/hooks/inventory/use-stock-movement-analytics`
// when the backend endpoint exists. Until then we return empty data so the
// page renders the canonical empty-state without crashing.
function useStockMovementAnalytics(_filters: StockMovementFilters) {
  return {
    data: {
      data: {
        items: [] as StockMovementItem[],
        summary: {
          totalInbound: 0,
          totalOutbound: 0,
          totalBalance: 0,
          totalItemsMoved: 0,
          totalInboundValue: 0,
          totalOutboundValue: 0,
        },
      } satisfies StockMovementAnalytics,
    },
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: () => {},
  };
}

// =====================
// Constants
// =====================

const YEAR_OPTIONS = generateYearOptions(6);

type ChartTypeOption = { value: StockMovementChartType; label: string; icon: typeof IconChartBar; description: string };
const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar',         label: 'Colunas',            icon: IconChartBar,  description: 'Colunas agrupadas' },
  { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2,    description: 'Entradas/saídas empilhadas' },
  { value: 'line',        label: 'Linha Reta',         icon: IconChartLine, description: 'Linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave',        icon: IconChartLine, description: 'Linhas suavizadas' },
  { value: 'area',        label: 'Área Reta',          icon: IconChartArea, description: 'Área preenchida' },
  { value: 'area-smooth', label: 'Área Suave',         icon: IconChartArea, description: 'Área preenchida suavizada' },
];

const X_AXIS_OPTIONS: Array<{ value: StockMovementXAxisMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

const Y_AXIS_OPTIONS: Array<{ value: StockMovementYAxisMode; label: string }> = [
  { value: 'count', label: 'Quantidade' },
  { value: 'value', label: 'Valor (R$)' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

// =====================
// Helpers
// =====================

function computeDateRange(
  years: string[],
  months: string[],
): { startDate?: Date; endDate?: Date } {
  if (!years.length) return {};
  const yearNums = years.map(Number).sort((a, b) => a - b);
  const minY = yearNums[0];
  const maxY = yearNums[yearNums.length - 1];
  if (months.length > 0) {
    const monthNums = months.map(Number).sort((a, b) => a - b);
    return {
      startDate: startOfDay(new Date(minY, monthNums[0] - 1, 1)),
      endDate:   endOfDay(new Date(maxY, monthNums[monthNums.length - 1], 0)),
    };
  }
  return {
    startDate: startOfDay(new Date(minY, 0, 1)),
    endDate:   endOfDay(new Date(maxY, 11, 31)),
  };
}

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: StockMovementFilters;
  selectedYears: string[];
  selectedMonths: string[];
  onApply: (filters: StockMovementFilters, years: string[], months: string[]) => void;
}

function FilterSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, onApply,
}: FilterSheetProps) {
  const [localX, setLocalX] = useState<StockMovementXAxisMode>(filters.xAxisMode);
  const [localY, setLocalY] = useState<StockMovementYAxisMode>(filters.yAxisMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);

  useEffect(() => {
    if (open) {
      setLocalX(filters.xAxisMode);
      setLocalY(filters.yAxisMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
    }
  }, [open, filters, selectedYears, selectedMonths]);

  const activeCount =
    (localYears.length > 0 ? 1 : 0) +
    (localMonths.length > 0 ? 1 : 0) +
    (localX !== 'month' ? 1 : 0) +
    (localY !== 'count' ? 1 : 0);

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    onApply(
      { xAxisMode: localX, yAxisMode: localY, startDate, endDate },
      localYears,
      localMonths,
    );
    onOpenChange(false);
  }, [localX, localY, localYears, localMonths, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalX('month');
    setLocalY('count');
    setLocalYears([]);
    setLocalMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure o período e a métrica de movimentação.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Agrupamento do Eixo X
              </Label>
              <Combobox
                value={localX}
                onValueChange={v => setLocalX(v as StockMovementXAxisMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartArcs3 className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as StockMovementYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Anos
              </Label>
              <Combobox
                mode="multiple"
                value={localYears}
                onValueChange={v => setLocalYears(Array.isArray(v) ? v : v ? [v] : [])}
                options={YEAR_OPTIONS}
                placeholder="Selecione os anos..."
                searchPlaceholder="Buscar ano..."
                emptyText="Nenhum ano encontrado"
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                {localYears.length === 0
                  ? 'Sem seleção → últimos 12 períodos'
                  : `${localYears.length} ${localYears.length === 1 ? 'ano' : 'anos'} selecionados`}
              </p>
            </div>

            {localX !== 'year' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendarStats className="h-4 w-4" />
                  Meses
                </Label>
                <Combobox
                  mode="multiple"
                  value={localMonths}
                  onValueChange={v => setLocalMonths(Array.isArray(v) ? v : v ? [v] : [])}
                  options={MONTH_OPTIONS}
                  placeholder="Todos os meses..."
                  searchPlaceholder="Buscar mês..."
                  emptyText="Nenhum mês"
                  searchable
                  clearable
                />
              </div>
            )}

          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" /> Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Page
// =====================

const StockMovementPage = () => {
  usePageTracker({ page: 'inventory-stock-movement-statistics', title: 'Movimentação de Estoque' });

  const [showFilters, setShowFilters] = useState(false);
  const [chartType, setChartType] = useState<StockMovementChartType>('bar-stacked');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);

  const [filters, setFilters] = useState<StockMovementFilters>({
    xAxisMode: 'month',
    yAxisMode: 'count',
  });
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const { data, isLoading, isError, error, refetch } = useStockMovementAnalytics(filters);
  const items = data?.data?.items ?? [];
  const summary = data?.data?.summary;
  const isValue = filters.yAxisMode === 'value';

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selectedYears.length) n++;
    if (selectedMonths.length) n++;
    if (filters.xAxisMode !== 'month') n++;
    if (filters.yAxisMode !== 'count') n++;
    return n;
  }, [filters, selectedYears, selectedMonths]);

  const periodSummaryLabel = useMemo(() => {
    if (filters.xAxisMode === 'year') return 'Movimentação por ano';
    return 'Movimentação por mês';
  }, [filters.xAxisMode]);

  // Build chart data: stacked entradas (positive) and saídas (positive too;
  // we keep both as magnitudes so the comparison bars line up visually).
  const chartData = useMemo(() => {
    if (!items.length) return [] as Array<{
      name: string;
      value: number;
      comparisons?: Array<{ entityName: string; value: number }>;
    }>;
    return items.map(it => {
      const inbound  = isValue ? it.inboundValue  : it.inbound;
      const outbound = isValue ? it.outboundValue : it.outbound;
      return {
        name: it.periodLabel,
        value: inbound + outbound,
        comparisons: [
          { entityName: 'Entradas', value: inbound },
          { entityName: 'Saídas',   value: outbound },
        ],
      };
    });
  }, [items, isValue]);

  const valueFormatter = useCallback((value: number) => {
    if (isValue) return formatCurrency(value);
    return formatNumber(value, 0);
  }, [isValue]);

  const handleFilterApply = useCallback((next: StockMovementFilters, years: string[], months: string[]) => {
    setFilters(next);
    setSelectedYears(years);
    setSelectedMonths(months);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Entradas (qtd)', 'Saídas (qtd)', 'Saldo', 'Itens Movimentados', 'Entradas (R$)', 'Saídas (R$)'];
      const rows = items.map(i => [
        i.periodLabel, i.inbound, i.outbound, i.balance, i.itemsMoved,
        i.inboundValue.toFixed(2), i.outboundValue.toFixed(2),
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `movimentacao-estoque-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Entradas (qtd)', 'Saídas (qtd)', 'Saldo', 'Itens Movimentados', 'Entradas (R$)', 'Saídas (R$)'];
      const rows = items.map(i => [
        i.periodLabel, i.inbound, i.outbound, i.balance, i.itemsMoved,
        i.inboundValue, i.outboundValue,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentação');
      XLSX.writeFile(wb, `movimentacao-estoque-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch {
      toast.error('Erro ao exportar XLSX');
    }
  }, [items]);

  // -------- Render --------

  const renderChart = () => {
    if (isLoading) {
      return (
        <div style={{ height: '100%' }} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={{ height: '100%' }} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{error?.message}</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" /> Tentar Novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={{ height: '100%' }} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar os dados</p>
          </div>
        </div>
      );
    }
    return (
      <StatisticsChart
        data={chartData}
        chartType={chartType as StatisticsChartType}
        yAxisMode={(isValue ? 'value' : 'count') as YAxisMode}
        isComparisonMode
        height="100%"
        yAxisLabel={isValue ? 'Valor (R$)' : 'Quantidade'}
        valueFormatter={valueFormatter}
        tooltipLabels={{ primary: isValue ? 'Valor' : 'Quantidade' }}
        trendLine={trendLine}
      />
    );
  };

  const currentChartTypeOption = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartTypeOption.icon;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
        <div className="flex-shrink-0">
          <PageHeader
            title="Movimentação de Estoque"
            icon={IconTrendingUp}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS_MOVIMENTACAO}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Estoque', href: routes.statistics.inventory.root },
              { label: 'Movimentação' },
            ]}
          />
        </div>

          <Card className="mt-4 flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <IconTrendingUp className="h-5 w-5 text-primary" />
                    {periodSummaryLabel}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span>Entradas e saídas do estoque por período.</span>
                    <Badge variant="outline" className="text-xs">
                      {filters.xAxisMode === 'year' ? 'Agrupamento: Anos' : 'Agrupamento: Meses'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {isValue ? 'R$' : 'Quantidade'}
                    </Badge>
                    {trendLine && (
                      <Badge variant="outline" className="text-xs">{TREND_LABELS[trendLine]}</Badge>
                    )}
                    {selectedYears.length > 0 && (
                      <Badge variant="outline" className="text-xs">{[...selectedYears].sort().join(', ')}</Badge>
                    )}
                    {selectedMonths.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selectedMonths.length} {selectedMonths.length === 1 ? 'mês' : 'meses'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Chart type */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ChartIcon className="h-4 w-4 mr-2" />
                        {currentChartTypeOption.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={chartType}
                        onValueChange={v => setChartType(v as StockMovementChartType)}
                      >
                        {CHART_TYPE_OPTIONS.map(opt => {
                          const Icon = opt.icon;
                          return (
                            <DropdownMenuRadioItem key={opt.value} value={opt.value} className="group">
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{opt.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">
                                  {opt.description}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Trend */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant={trendLine ? 'default' : 'outline'} size="sm">
                        <IconTrendingUp className="h-4 w-4 mr-2" />
                        {trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Linha de Tendência</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={trendLine ?? ''}
                        onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}
                      >
                        <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma3">Média Móvel 3 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média Móvel 6 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média Móvel 12 meses</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filters */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
                  </Button>

                  {/* Export */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isLoading || !items.length}>
                        <IconDownload className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <IconFileTypeCsv className="h-4 w-4 mr-2" />
                        CSV dos Dados
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" />
                        Excel (XLSX) dos Dados
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
              {/* Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconArrowDown className="h-3.5 w-3.5" /> Total Entradas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-24" />
                      : <div className="text-xl font-bold">
                          {isValue
                            ? formatCurrency(summary?.totalInboundValue ?? 0)
                            : formatNumber(summary?.totalInbound ?? 0, 0)}
                        </div>}
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconArrowUp className="h-3.5 w-3.5" /> Total Saídas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-24" />
                      : <div className="text-xl font-bold">
                          {isValue
                            ? formatCurrency(summary?.totalOutboundValue ?? 0)
                            : formatNumber(summary?.totalOutbound ?? 0, 0)}
                        </div>}
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconScale className="h-3.5 w-3.5" /> Saldo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-24" />
                      : <div className="text-xl font-bold">
                          {isValue
                            ? formatCurrency((summary?.totalInboundValue ?? 0) - (summary?.totalOutboundValue ?? 0))
                            : formatNumber(summary?.totalBalance ?? 0, 0)}
                        </div>}
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconPackage className="h-3.5 w-3.5" /> Itens Movimentados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : <div className="text-xl font-bold">{formatNumber(summary?.totalItemsMoved ?? 0, 0)}</div>}
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="flex-1 min-h-0 p-4">
                  {renderChart()}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

        <FilterSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          onApply={handleFilterApply}
        />
      </div>
    </PrivilegeRoute>
  );
};

export const StockMovementStatisticsPage = () => <StockMovementPage />;
export default StockMovementStatisticsPage;
