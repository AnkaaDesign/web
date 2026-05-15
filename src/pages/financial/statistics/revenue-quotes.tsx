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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { GOAL_METRIC, GOAL_METRIC_UNIT, routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { GoalMetaPopover } from '@/components/statistics/goal-meta-popover';
import { useQuoteFunnelAnalytics } from '@/hooks/financial/use-financial-analytics';
import type { QuoteFunnelAnalyticsFilters } from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import {
  CHART_COLORS,
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { getSectors } from '@/api-client/sector';
import { customerKeys, sectorKeys } from '@/hooks/common/query-keys';
import ReactECharts from 'echarts-for-react';
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconStack2,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconReportMoney,
  IconUsers,
  IconBuilding,
  IconCalendar,
  IconCalendarStats,
  IconX,
  IconReceipt,
  IconChartArcs3,
  IconClock,
  IconCash,
  IconTrendingUp,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconLayoutGrid,
  IconRuler,
} from '@tabler/icons-react';
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

const COMBOBOX_PAGE_SIZE = 20;

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => ({
    value: (currentYear - i).toString(),
    label: (currentYear - i).toString(),
  }));
};
const YEAR_OPTIONS = generateYearOptions();

const QUOTE_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'BUDGET_APPROVED', label: 'Orçamento Aprovado' },
  { value: 'COMMERCIAL_APPROVED', label: 'Aprovado pelo Comercial' },
  { value: 'BILLING_APPROVED', label: 'Faturamento Aprovado' },
  { value: 'UPCOMING', label: 'A Vencer' },
  { value: 'DUE', label: 'Vencido' },
  { value: 'PARTIAL', label: 'Parcial' },
  { value: 'SETTLED', label: 'Liquidado' },
];

type YMode = 'value' | 'count';
const Y_AXIS_OPTIONS: Array<{ value: YMode; label: string }> = [
  { value: 'value', label: 'Valor (R$)' },
  { value: 'count', label: 'Quantidade' },
];

type ChartTypeKey = 'bar' | 'line' | 'line-smooth' | 'area' | 'bar-stacked';
const CHART_TYPE_OPTIONS: Array<{ value: ChartTypeKey; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'bar',         label: 'Colunas',           icon: IconChartBar,  description: 'Barras agrupadas por período' },
  { value: 'bar-stacked', label: 'Colunas Empilhadas',icon: IconStack2,    description: 'Estágios do funil empilhados' },
  { value: 'line',        label: 'Linha Reta',        icon: IconChartLine, description: 'Linhas retas (compara estágios)' },
  { value: 'line-smooth', label: 'Linha Suave',       icon: IconChartLine, description: 'Linhas suavizadas' },
  { value: 'area',        label: 'Área',              icon: IconChartArea, description: 'Área preenchida' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: QuoteFunnelAnalyticsFilters;
  yMode: YMode;
  onApply: (filters: QuoteFunnelAnalyticsFilters, yMode: YMode) => void;
}

function FilterSheet({ open, onOpenChange, filters, yMode, onApply }: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<QuoteFunnelAnalyticsFilters>(filters);
  const [localYMode, setLocalYMode] = useState<YMode>(yMode);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalYMode(yMode);
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters, yMode]);

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const response = await getCustomers({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (response.data || []).map(c => ({ value: c.id, label: c.fantasyName })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const fetchSectors = useCallback(async (search: string, page: number = 1) => {
    const response = await getSectors({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      page, limit: COMBOBOX_PAGE_SIZE, orderBy: { name: 'asc' },
    });
    return {
      data: (response.data || []).map((s: any) => ({ value: s.id, label: s.name })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (localFilters.customerIds?.length) n++;
    if (localFilters.sectorIds?.length) n++;
    if (localFilters.status?.length) n++;
    if (selectedMonths.length > 0) n++;
    return n;
  }, [localFilters, selectedMonths]);

  const handleApply = useCallback(() => {
    const final = { ...localFilters };
    if (selectedYear && selectedMonths.length > 0) {
      const nums = selectedMonths.map(m => parseInt(m, 10));
      const minM = Math.min(...nums); const maxM = Math.max(...nums);
      final.startDate = startOfDay(startOfMonth(new Date(selectedYear, minM - 1)));
      final.endDate   = endOfDay(endOfMonth(new Date(selectedYear, maxM - 1)));
    }
    onApply(final, localYMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, localYMode, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalFilters({
      startDate: startOfDay(subMonths(new Date(), 12)),
      endDate: endOfDay(new Date()),
    });
    setLocalYMode('value');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros — Receita & Orçamentos
            {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Filtre orçamentos por período, cliente, setor e estágio do funil.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconRuler className="h-4 w-4" /> Eixo Y do Gráfico
              </Label>
              <Combobox
                value={localYMode}
                onValueChange={v => setLocalYMode(v as YMode)}
                options={Y_AXIS_OPTIONS}
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                "Valor" mostra somatórios em R$; "Quantidade" mostra a contagem de orçamentos.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconCalendar className="h-4 w-4" /> Período
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <Combobox
                  value={selectedYear?.toString() || ''}
                  onValueChange={year => {
                    const yStr = Array.isArray(year) ? year[0] : year;
                    const ny = yStr ? parseInt(yStr, 10) : undefined;
                    setSelectedYear(ny);
                    if (!ny) setSelectedMonths([]);
                  }}
                  options={YEAR_OPTIONS}
                  placeholder="Ano..."
                  searchable={false}
                  clearable
                />
                <div className="col-span-2">
                  <Combobox
                    mode="multiple"
                    value={selectedMonths}
                    onValueChange={(m) => {
                      if (Array.isArray(m)) setSelectedMonths(m);
                      else if (m) setSelectedMonths([m]);
                      else setSelectedMonths([]);
                    }}
                    options={MONTH_OPTIONS}
                    placeholder={selectedYear ? 'Selecione meses...' : 'Selecione um ano primeiro'}
                    searchable
                    clearable
                    disabled={!selectedYear}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione ano + meses, ou use o intervalo personalizado abaixo.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconCalendar className="h-4 w-4" /> Intervalo Personalizado
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.startDate}
                    onChange={d => {
                      if (d && d instanceof Date) {
                        setLocalFilters({ ...localFilters, startDate: startOfDay(d) });
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.endDate}
                    onChange={d => {
                      if (d && d instanceof Date) {
                        setLocalFilters({ ...localFilters, endDate: endOfDay(d) });
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconUsers className="h-4 w-4" /> Clientes
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.customerIds || []}
                onValueChange={v => setLocalFilters({
                  ...localFilters,
                  customerIds: Array.isArray(v) && v.length ? v : undefined,
                })}
                queryKey={[...customerKeys.lists()]}
                queryFn={fetchCustomers}
                minSearchLength={0}
                placeholder="Todos os clientes"
                searchable
                clearable
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconBuilding className="h-4 w-4" /> Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.sectorIds || []}
                onValueChange={v => setLocalFilters({
                  ...localFilters,
                  sectorIds: Array.isArray(v) && v.length ? v : undefined,
                })}
                queryKey={[...sectorKeys.lists(), 'revenue-quotes']}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Todos os setores"
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                Filtra orçamentos pelo setor da tarefa associada.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconReceipt className="h-4 w-4" /> Estágios do Orçamento
              </Label>
              <Combobox
                mode="multiple"
                value={localFilters.status || []}
                onValueChange={v => setLocalFilters({
                  ...localFilters,
                  status: Array.isArray(v) && v.length ? v : undefined,
                })}
                options={QUOTE_STATUS_OPTIONS}
                placeholder="Todos os estágios"
                searchable={false}
                clearable
              />
            </div>
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

const RevenueQuotesStatisticsPage = () => {
  usePageTracker({ page: 'financial-revenue-quotes-analytics', title: 'Receita & Orçamentos' });

  const theme = useChartTheme();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<QuoteFunnelAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 12)),
    endDate: endOfDay(new Date()),
  });
  const [yMode, setYMode] = useState<YMode>('value');
  const [chartType, setChartType] = useState<ChartTypeKey>('bar-stacked');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  // Drill-down modal: opens when a clickable summary card is selected. The
  // analytics endpoint doesn't return per-quote listings, so this is a
  // placeholder UI with search + empty state for visual consistency.
  const [drillDown, setDrillDown] = useState<{ title: string; subtitle?: string } | null>(null);
  const [drillDownSearch, setDrillDownSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuoteFunnelAnalytics(filters);
  const summary = data?.data?.summary;
  const funnel = data?.data?.funnel || [];
  const items = data?.data?.items || [];
  const topCustomers = data?.data?.topCustomers || [];
  const topSectors = data?.data?.topSectors || [];

  // 'value' mode shows currency totals → INVOICES_PAID (proxy for revenue
  // booked in the period). 'count' mode shows new-quote counts → FINANCE_QUOTES_PER_PERIOD.
  const goalMetric =
    yMode === 'value' ? GOAL_METRIC.INVOICES_PAID : GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD;

  const [goalOverride, setGoalOverride] = useState<number | null>(null);

  useEffect(() => {
    setGoalOverride(null);
  }, [yMode]);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    aggregation: 'AVERAGE_PER_PERIOD',
    periodMode: 'calendar',
  });

  const goalValue = goalOverride ?? defaultGoal.value;
  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.customerIds?.length) n++;
    if (filters.sectorIds?.length) n++;
    if (filters.status?.length) n++;
    return n;
  }, [filters]);

  // --- Chart data: monthly funnel ---
  // Use "comparison mode" semantics: each stage is its own series so we get
  // multi-series stacked bars / multi-line / area-stack.
  const isComparisonMode = true;
  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(i => ({
      name: i.periodLabel,
      value: yMode === 'value' ? i.totalValue : i.newQuotes,
      comparisons: [
        { entityName: 'Criados',     value: yMode === 'value' ? i.totalValue   : i.newQuotes },
        { entityName: 'Aprovados',   value: yMode === 'value' ? i.totalValue   : i.approvedQuotes },
        { entityName: 'Faturados',   value: yMode === 'value' ? i.settledValue : i.billedQuotes },
        { entityName: 'Liquidados',  value: yMode === 'value' ? i.settledValue : i.settledQuotes },
      ],
    }));
  }, [items, yMode]);

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'value') return formatCurrency(value);
    return formatNumber(value, 0);
  }, []);

  // --- Funnel chart (ECharts funnel) ---
  const funnelOption = useMemo(() => {
    if (!funnel.length) return {} as any;
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) => {
          const stage = funnel[p.dataIndex];
          if (!stage) return '';
          return `<strong>${stage.stageLabel}</strong><br/>
            Quantidade: ${formatNumber(stage.count, 0)}<br/>
            Valor: ${formatCurrency(stage.totalValue)}<br/>
            Conversão da etapa anterior: ${formatPercentage(stage.conversionFromPrevious)}<br/>
            % do total: ${formatPercentage(stage.conversionFromTop)}`;
        },
      },
      color: ['#6366f1', '#3b82f6', '#06b6d4', '#10b981'],
      series: [{
        type: 'funnel' as const,
        left: '5%', right: '5%', top: 20, bottom: 30,
        sort: 'descending' as const,
        gap: 4,
        label: {
          show: true,
          position: 'inside' as const,
          formatter: (p: any) => {
            const s = funnel[p.dataIndex];
            return s ? `${s.stageLabel}\n${formatNumber(s.count, 0)} · ${formatCurrency(s.totalValue)}` : '';
          },
          fontSize: 11,
          color: '#fff',
        },
        data: funnel.map(s => ({ name: s.stageLabel, value: s.count || 1 })),
      }],
    };
  }, [funnel, theme]);

  // --- Top customers chart ---
  const topCustomersOption = useMemo(() => {
    if (!topCustomers.length) return {} as any;
    const top = topCustomers.slice(0, 10);
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const idx = params[0].dataIndex;
          const c = top[idx];
          return `<strong>${c.customerName}</strong><br/>
            Orçamentos: ${formatNumber(c.quoteCount, 0)}<br/>
            Valor Total: ${formatCurrency(c.totalValue)}<br/>
            Liquidado: ${formatCurrency(c.settledValue)}<br/>
            Conversão: ${formatPercentage(c.conversionRate)}`;
        },
      },
      grid: { left: '3%', right: '8%', bottom: '4%', top: 30, containLabel: true },
      xAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim(), fontSize: 10, color: theme.subTextColor },
        axisLine: { lineStyle: { color: theme.axisLineColor } },
        splitLine: { lineStyle: { color: theme.gridLineColor } },
      },
      yAxis: {
        type: 'category' as const,
        inverse: true,
        data: top.map(c => c.customerName.length > 30 ? c.customerName.slice(0, 28) + '…' : c.customerName),
        axisLabel: { fontSize: 10, color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLineColor } },
      },
      color: ['#3b82f6', '#10b981'],
      series: [
        { name: 'Orçado',     type: 'bar' as const, data: top.map(c => c.totalValue),   itemStyle: { borderRadius: [0, 4, 4, 0] } },
        { name: 'Liquidado',  type: 'bar' as const, data: top.map(c => c.settledValue), itemStyle: { borderRadius: [0, 4, 4, 0] } },
      ],
      legend: { top: 0, fontSize: 10, textStyle: { color: theme.textColor } },
    };
  }, [topCustomers, theme]);

  // --- Top sectors pie ---
  const topSectorsOption = useMemo(() => {
    if (!topSectors.length) return {} as any;
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) =>
          `<strong>${p.name}</strong><br/>Valor: ${formatCurrency(p.value)}<br/>${formatPercentage(p.percent ?? 0)}`,
      },
      color: CHART_COLORS,
      legend: { orient: 'vertical' as const, right: 8, top: 'middle' as const, fontSize: 10, textStyle: { color: theme.textColor } },
      series: [{
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: topSectors.map(s => ({ name: s.sectorName, value: s.totalValue })),
      }],
    };
  }, [topSectors, theme]);

  // --- Export CSV ---
  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Criados', 'Aprovados', 'Faturados', 'Liquidados', 'Valor Orçado (R$)', 'Valor Liquidado (R$)'];
      const rows = items.map(i => [
        i.periodLabel,
        i.newQuotes,
        i.approvedQuotes,
        i.billedQuotes,
        i.settledQuotes,
        i.totalValue.toFixed(2),
        i.settledValue.toFixed(2),
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `receita-orcamentos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Criados', 'Aprovados', 'Faturados', 'Liquidados', 'Valor Orçado (R$)', 'Valor Liquidado (R$)'];
      const rows = items.map(i => [i.periodLabel, i.newQuotes, i.approvedQuotes, i.billedQuotes, i.settledQuotes, i.totalValue, i.settledValue]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Receita & Orçamentos');
      XLSX.writeFile(wb, `receita-orcamentos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [items]);

  const handleExportPDF = useCallback(async () => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    toast.info('Geração de PDF em breve — use CSV ou XLSX.');
  }, [items]);

  const renderMainChart = () => {
    const chartHeightStyle = { height: 'max(380px, calc(100vh - 460px))' };
    if (isLoading) {
      return (
        <div style={chartHeightStyle} className="flex items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-[380px] w-[600px]" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-foreground/70">{error?.message || 'Ocorreu um erro'}</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-foreground/50" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p>
          </div>
        </div>
      );
    }
    return (
      <StatisticsChart
        data={chartData}
        chartType={chartType as StatisticsChartType}
        yAxisMode={yMode as YAxisMode}
        isComparisonMode={isComparisonMode}
        height="max(380px, calc(100vh - 460px))"
        yAxisLabel={yMode === 'value' ? 'Valor (R$)' : 'Orçamentos'}
        valueFormatter={valueFormatter}
        trendLine={trendLine}
        goalLine={goalValue != null ? { value: goalValue, label: 'Meta' } : null}
        tooltipLabels={{ primary: yMode === 'value' ? 'Valor' : 'Orçamentos' }}
      />
    );
  };

  const currentChartTypeOption = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Receita & Orçamentos"
          icon={IconReportMoney}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_RECEITA}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Receita & Orçamentos' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconChartArcs3 className="h-5 w-5 text-primary" />
                  Funil de Vendas & Receita
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span>Evolução de orçamentos por estágio e receita liquidada.</span>
                  <Badge variant="outline" className="text-xs">{yMode === 'value' ? 'R$' : 'Quantidade'}</Badge>
                  {trendLine && <Badge variant="outline" className="text-xs">Tendência: {TREND_LABELS[trendLine]}</Badge>}
                  {filters.startDate && (
                    <Badge variant="secondary" className="text-xs">
                      {format(filters.startDate, 'dd/MM/yy')} – {format(filters.endDate, 'dd/MM/yy')}
                    </Badge>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <currentChartTypeOption.icon className="h-4 w-4" />
                      {currentChartTypeOption.label}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={chartType} onValueChange={v => setChartType(v as ChartTypeKey)}>
                      {CHART_TYPE_OPTIONS.map(opt => (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="group">
                          <div className="flex items-start gap-2">
                            <opt.icon className="h-4 w-4 mt-0.5" />
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">{opt.description}</span>
                            </div>
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={trendLine ? 'default' : 'outline'} size="sm" className="gap-2">
                      <IconTrendingUp className="h-4 w-4" />
                      {trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Linha de tendência</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setTrendLine(null)}>Desativada</DropdownMenuItem>
                    {(['linear','sma3','sma6','sma12'] as TrendLineType[]).map(t => (
                      <DropdownMenuItem key={t} onSelect={() => setTrendLine(t)}>
                        {TREND_LABELS[t]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <GoalMetaPopover
                  value={goalValue}
                  defaultValue={defaultGoal.value}
                  source={goalSource}
                  onOverride={setGoalOverride}
                  unit={GOAL_METRIC_UNIT[goalMetric]}
                />

                <Button
                  variant={activeFilterCount > 0 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilters(true)}
                  className="gap-2"
                >
                  <IconFilter className="h-4 w-4" /> Filtros
                  {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || !items.length}>
                      <IconDownload className="h-4 w-4" /> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={handleExportPDF}>
                      <IconFileTypePdf className="h-4 w-4 mr-2" /> PDF do Gráfico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleExportCSV}>
                      <IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleExportXLSX}>
                      <IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* KPI cards — funnel stages + ticket + cycle. Clickable when there's drill-down data. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.totalQuotes ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.totalQuotes ?? 0) > 0
                  ? () => setDrillDown({ title: 'Orçamentos Criados', subtitle: `${formatNumber(summary?.totalQuotes ?? 0, 0)} no período` })
                  : undefined}
                role={!isLoading && (summary?.totalQuotes ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.totalQuotes ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.totalQuotes ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'Orçamentos Criados', subtitle: `${formatNumber(summary?.totalQuotes ?? 0, 0)} no período` });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconReceipt className="h-3.5 w-3.5" /> Orçamentos
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.totalQuotes ?? 0, 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    {formatCurrency(summary?.totalQuotedValue ?? 0)} orçados
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.totalSettledValue ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.totalSettledValue ?? 0) > 0
                  ? () => setDrillDown({ title: 'Orçamentos Liquidados', subtitle: formatCurrency(summary?.totalSettledValue ?? 0) })
                  : undefined}
                role={!isLoading && (summary?.totalSettledValue ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.totalSettledValue ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.totalSettledValue ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'Orçamentos Liquidados', subtitle: formatCurrency(summary?.totalSettledValue ?? 0) });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconCash className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Liquidados
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(summary?.totalSettledValue ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Receita efetiva no período
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconChartArcs3 className="h-3.5 w-3.5" /> Taxa de Conversão
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatPercentage(summary?.conversionRate ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Liquidados ÷ criados
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconCalendarStats className="h-3.5 w-3.5" /> Ticket Médio
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(summary?.avgTicket ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Valor médio por liquidado
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconClock className="h-3.5 w-3.5" /> Ciclo de Fechamento
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.avgSalesCycleDays ?? 0, 1)} dias</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Criação até faturamento
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.activeBacklogValue ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.activeBacklogValue ?? 0) > 0
                  ? () => setDrillDown({ title: 'Backlog Ativo', subtitle: `${formatCurrency(summary?.activeBacklogValue ?? 0)} em andamento` })
                  : undefined}
                role={!isLoading && (summary?.activeBacklogValue ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.activeBacklogValue ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.activeBacklogValue ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'Backlog Ativo', subtitle: `${formatCurrency(summary?.activeBacklogValue ?? 0)} em andamento` });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconLayoutGrid className="h-3.5 w-3.5 text-primary" /> Backlog Ativo
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(summary?.activeBacklogValue ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Receita prevista no pipeline
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main chart */}
            <Card>
              <CardContent className="p-4">{renderMainChart()}</CardContent>
            </Card>

            {/* Funnel + Top sectors */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconChartArcs3 className="h-4 w-4 text-primary" /> Funil de Conversão
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Quantidade e valor de orçamentos que atingiram cada estágio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? (
                    <Skeleton className="h-[380px] w-full" />
                  ) : funnel.length > 0 ? (
                    <ReactECharts option={funnelOption} style={{ height: 380 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">
                      Sem orçamentos no período.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconBuilding className="h-4 w-4 text-primary" /> Receita por Setor
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Distribuição do valor orçado por setor das tarefas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? (
                    <Skeleton className="h-[380px] w-full" />
                  ) : topSectors.length > 0 ? (
                    <ReactECharts option={topSectorsOption} style={{ height: 380 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">
                      Nenhum setor com orçamentos no período.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top customers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <IconUsers className="h-4 w-4 text-primary" /> Top 10 Clientes por Valor Orçado
                </CardTitle>
                <CardDescription className="text-xs text-foreground/70">
                  Comparativo entre valor total orçado e valor efetivamente liquidado.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                {isLoading ? (
                  <Skeleton className="h-[460px] w-full" />
                ) : topCustomers.length > 0 ? (
                  <ReactECharts option={topCustomersOption} style={{ height: 460 }} />
                ) : (
                  <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">
                    Nenhum cliente com orçamentos no período.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Funnel stage table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estágios do Funil — Detalhe</CardTitle>
                <CardDescription className="text-xs text-foreground/70">
                  Conversão entre etapas e tempo médio desde a criação do orçamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estágio</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Conv. Anterior</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                        <TableHead className="text-right">Dias Médios</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={6}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                      ) : funnel.length > 0 ? funnel.map(s => (
                        <TableRow key={s.stage}>
                          <TableCell className="font-medium text-foreground">{s.stageLabel}</TableCell>
                          <TableCell className="text-right text-foreground/85">{formatNumber(s.count, 0)}</TableCell>
                          <TableCell className="text-right text-foreground/85">{formatCurrency(s.totalValue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={s.conversionFromPrevious >= 75 ? 'completed' : s.conversionFromPrevious >= 40 ? 'pending' : 'red'}>
                              {formatPercentage(s.conversionFromPrevious)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-foreground/70">{formatPercentage(s.conversionFromTop)}</TableCell>
                          <TableCell className="text-right text-foreground/85">{formatNumber(s.avgDaysFromCreation, 1)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-foreground/60 py-6">Sem dados</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <FilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        yMode={yMode}
        onApply={(f, m) => { setFilters(f); setYMode(m); }}
      />

      {/* Drill-down placeholder modal — per-quote listings aren't returned by
          the analytics endpoint yet, so this renders a search bar and an empty
          state for UI consistency with other statistics pages. */}
      <Dialog
        open={!!drillDown}
        onOpenChange={(o) => {
          if (!o) {
            setDrillDown(null);
            setDrillDownSearch('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt className="h-5 w-5 text-primary" />
              {drillDown?.title}
              {drillDown?.subtitle && (
                <Badge variant="secondary" className="ml-2">{drillDown.subtitle}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Lista dos orçamentos correspondentes a esta etapa do funil no período filtrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input
              placeholder="Buscar por número, cliente ou setor..."
              value={drillDownSearch}
              onChange={(v) => setDrillDownSearch(v == null ? '' : String(v))}
              className="w-full"
            />
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <IconCalendarStats className="h-12 w-12 text-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Detalhamento por orçamento em breve</p>
                <p className="text-xs text-foreground/65 mt-1 max-w-sm">
                  A listagem individual de cada orçamento ainda não é exposta por esta tela.
                  Por enquanto, consulte a página de Orçamentos para o registro completo.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevenueQuotesStatisticsPage;
