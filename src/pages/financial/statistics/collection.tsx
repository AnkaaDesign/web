import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import { useCollectionAnalytics } from '@/hooks/financial/use-financial-analytics';
import type { FinancialAnalyticsFilters } from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  CHART_COLORS,
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { customerKeys } from '@/hooks/common/query-keys';
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
  IconCalendar,
  IconCalendarStats,
  IconX,
  IconReceipt,
  IconClock,
  IconCash,
  IconTrendingUp,
  IconPercentage,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconRuler,
  IconAlertTriangle,
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
  const cy = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => ({ value: (cy - i).toString(), label: (cy - i).toString() }));
};
const YEAR_OPTIONS = generateYearOptions();

const INVOICE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PARTIALLY_PAID', label: 'Parcialmente Paga' },
  { value: 'PAID', label: 'Paga' },
];

type YMode = 'value' | 'percentage';
const Y_AXIS_OPTIONS: Array<{ value: YMode; label: string }> = [
  { value: 'value', label: 'Valor (R$)' },
  { value: 'percentage', label: 'Taxa de Recebimento (%)' },
];

type ChartTypeKey = 'bar' | 'bar-stacked' | 'line' | 'line-smooth' | 'area';
const CHART_TYPE_OPTIONS: Array<{ value: ChartTypeKey; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'bar',         label: 'Colunas',            icon: IconChartBar,  description: 'Barras lado a lado' },
  { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2,    description: 'Faturado/recebido/atraso empilhados' },
  { value: 'line',        label: 'Linha Reta',         icon: IconChartLine, description: 'Linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave',        icon: IconChartLine, description: 'Linhas suavizadas' },
  { value: 'area',        label: 'Área',               icon: IconChartArea, description: 'Área preenchida' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

const AGING_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FinancialAnalyticsFilters;
  yMode: YMode;
  onApply: (filters: FinancialAnalyticsFilters, yMode: YMode) => void;
}

function FilterSheet({ open, onOpenChange, filters, yMode, onApply }: FilterSheetProps) {
  const [local, setLocal] = useState<FinancialAnalyticsFilters>(filters);
  const [localY, setLocalY] = useState<YMode>(yMode);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => {
    if (open) { setLocal(filters); setLocalY(yMode); setYear(undefined); setMonths([]); }
  }, [open, filters, yMode]);

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const r = await getCustomers({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (r.data || []).map(c => ({ value: c.id, label: c.fantasyName })),
      hasMore: r.meta?.hasNextPage || false,
    };
  }, []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (local.customerIds?.length) n++;
    if (local.status?.length) n++;
    if (months.length > 0) n++;
    return n;
  }, [local, months]);

  const apply = useCallback(() => {
    const f = { ...local };
    if (year && months.length > 0) {
      const nums = months.map(m => parseInt(m, 10));
      f.startDate = startOfDay(startOfMonth(new Date(year, Math.min(...nums) - 1)));
      f.endDate = endOfDay(endOfMonth(new Date(year, Math.max(...nums) - 1)));
    }
    onApply(f, localY);
    onOpenChange(false);
  }, [local, year, months, localY, onApply, onOpenChange]);

  const clear = useCallback(() => {
    setLocal({
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'amount',
      sortOrder: 'desc',
      limit: 50,
    });
    setLocalY('value');
    setYear(undefined);
    setMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" /> Filtros — Cobranças
            {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Refine o fluxo de caixa por período, cliente e status da fatura.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconRuler className="h-4 w-4" /> Eixo Y do Gráfico
              </Label>
              <Combobox value={localY} onValueChange={v => setLocalY(v as YMode)} options={Y_AXIS_OPTIONS} searchable={false} clearable={false} />
              <p className="text-xs text-muted-foreground">
                "Valor" mostra somatórios em R$; "Taxa de Recebimento" mostra o % pago/faturado.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconCalendar className="h-4 w-4" /> Período</Label>
              <div className="grid grid-cols-3 gap-3">
                <Combobox
                  value={year?.toString() || ''}
                  onValueChange={y => {
                    const yStr = Array.isArray(y) ? y[0] : y;
                    const ny = yStr ? parseInt(yStr, 10) : undefined;
                    setYear(ny);
                    if (!ny) setMonths([]);
                  }}
                  options={YEAR_OPTIONS}
                  placeholder="Ano..."
                  searchable={false}
                  clearable
                />
                <div className="col-span-2">
                  <Combobox
                    mode="multiple"
                    value={months}
                    onValueChange={m => {
                      if (Array.isArray(m)) setMonths(m);
                      else if (m) setMonths([m]);
                      else setMonths([]);
                    }}
                    options={MONTH_OPTIONS}
                    placeholder={year ? 'Selecione meses...' : 'Selecione um ano primeiro'}
                    searchable
                    clearable
                    disabled={!year}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconCalendar className="h-4 w-4" /> Intervalo Personalizado</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.startDate}
                    onChange={d => {
                      if (d && d instanceof Date) {
                        setLocal({ ...local, startDate: startOfDay(d) });
                        setYear(undefined); setMonths([]);
                      }
                    }}
                    hideLabel
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.endDate}
                    onChange={d => {
                      if (d && d instanceof Date) {
                        setLocal({ ...local, endDate: endOfDay(d) });
                        setYear(undefined); setMonths([]);
                      }
                    }}
                    hideLabel
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconUsers className="h-4 w-4" /> Clientes</Label>
              <Combobox
                mode="multiple"
                async
                value={local.customerIds || []}
                onValueChange={v => setLocal({ ...local, customerIds: Array.isArray(v) && v.length ? v : undefined })}
                queryKey={[...customerKeys.lists()]}
                queryFn={fetchCustomers}
                minSearchLength={0}
                placeholder="Todos os clientes"
                searchable
                clearable
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconReceipt className="h-4 w-4" /> Status da Fatura</Label>
              <Combobox
                mode="multiple"
                value={local.status || []}
                onValueChange={v => setLocal({ ...local, status: Array.isArray(v) && v.length ? v : undefined })}
                options={INVOICE_STATUS_OPTIONS}
                placeholder="Todos os status"
                searchable={false}
                clearable
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={clear} className="flex-1"><IconX className="h-4 w-4 mr-2" /> Limpar</Button>
          <Button onClick={apply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Page
// =====================

const CashflowStatisticsPage = () => {
  usePageTracker({ page: 'financial-cashflow-analytics', title: 'Cobranças & Fluxo de Caixa' });

  const theme = useChartTheme();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FinancialAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'amount',
    sortOrder: 'desc',
    limit: 50,
  });
  const [yMode, setYMode] = useState<YMode>('value');
  const [chartType, setChartType] = useState<ChartTypeKey>('bar-stacked');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);

  const { data, isLoading, isError, error, refetch } = useCollectionAnalytics(filters);
  const items = data?.data?.items || [];
  const summary = data?.data?.summary;
  const agingAnalysis = data?.data?.agingAnalysis || [];
  const revenueFunnel = data?.data?.revenueFunnel;

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.customerIds?.length) n++;
    if (filters.status?.length) n++;
    return n;
  }, [filters]);

  // For percentage mode we show one series (collectionRate). For value mode we use comparison mode
  // with three series: Faturado / Recebido / Em Atraso.
  const isComparisonMode = yMode === 'value';
  const chartData = useMemo(() => {
    if (!items.length) return [];
    if (yMode === 'percentage') {
      return items.map(i => ({ name: i.periodLabel, value: i.collectionRate }));
    }
    return items.map(i => ({
      name: i.periodLabel,
      value: i.invoicedAmount,
      comparisons: [
        { entityName: 'Faturado',   value: i.invoicedAmount },
        { entityName: 'Recebido',   value: i.paidAmount },
        { entityName: 'Em Atraso',  value: i.overdueAmount },
      ],
    }));
  }, [items, yMode]);

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'percentage') return `${value.toFixed(1)}%`;
    if (mode === 'value') return formatCurrency(value);
    return formatNumber(value, 0);
  }, []);

  // Aging analysis chart
  const agingOption = useMemo(() => {
    if (!agingAnalysis.length) return {} as any;
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) => {
          if (!Array.isArray(p) || !p.length) return '';
          const b = agingAnalysis[p[0].dataIndex];
          return `<strong>${b.bandLabel}</strong><br/>Parcelas: ${b.count}<br/>Valor: ${formatCurrency(b.amount)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category' as const, data: agingAnalysis.map(b => b.bandLabel),
        axisLabel: { fontSize: 10, color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLineColor } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim(), fontSize: 10, color: theme.subTextColor },
        axisLine: { lineStyle: { color: theme.axisLineColor } },
        splitLine: { lineStyle: { color: theme.gridLineColor } },
      },
      series: [{
        type: 'bar' as const,
        data: agingAnalysis.map((b, i) => ({ value: b.amount, itemStyle: { color: AGING_COLORS[i] || '#888' } })),
        label: { show: true, position: 'top' as const, fontSize: 9, color: theme.textColor, formatter: (p: any) => p.value > 0 ? formatCurrency(p.value) : '' },
      }],
    };
  }, [agingAnalysis, theme]);

  // Funnel chart
  const funnelOption = useMemo(() => {
    if (!revenueFunnel) return {} as any;
    const funnelData = [
      { name: 'Faturado', value: revenueFunnel.invoiced },
      { name: 'Boletos Emitidos', value: revenueFunnel.billed },
      { name: 'Recebido', value: revenueFunnel.collected },
      { name: 'Pendente', value: revenueFunnel.outstanding },
    ];
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) => `<strong>${p.name}</strong><br/>${formatCurrency(p.value)}`,
      },
      color: CHART_COLORS,
      series: [{
        type: 'funnel' as const,
        left: '5%', right: '5%', top: 20, bottom: 30,
        sort: 'descending' as const,
        gap: 4,
        label: { show: true, position: 'inside' as const, formatter: (p: any) => `${p.name}\n${formatCurrency(p.value)}`, fontSize: 11, color: '#fff' },
        data: funnelData,
      }],
    };
  }, [revenueFunnel, theme]);

  // CSV / XLSX export
  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
      const rows = items.map(i => [i.periodLabel, i.invoicedAmount.toFixed(2), i.paidAmount.toFixed(2), i.collectionRate.toFixed(1), i.overdueAmount.toFixed(2)]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cobrancas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
      const rows = items.map(i => [i.periodLabel, i.invoicedAmount, i.paidAmount, i.collectionRate, i.overdueAmount]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');
      XLSX.writeFile(wb, `cobrancas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [items]);

  const handleExportPDF = useCallback(async () => {
    toast.info('Geração de PDF em breve — use CSV ou XLSX.');
  }, []);

  const renderMainChart = () => {
    if (isLoading) {
      return (
        <div style={{ height: 'calc(100vh - 460px)', minHeight: 460, maxHeight: 560 }} className="flex items-center justify-center">
          <div className="space-y-3"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-[380px] w-[600px]" /></div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={{ height: 'calc(100vh - 460px)', minHeight: 460, maxHeight: 560 }} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          <div className="text-center"><p className="font-semibold">Erro ao carregar dados</p><p className="text-sm text-foreground/70">{error?.message || 'Erro'}</p></div>
          <Button onClick={() => refetch()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={{ height: 'calc(100vh - 460px)', minHeight: 460, maxHeight: 560 }} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-foreground/50" />
          <div className="text-center"><p className="font-semibold">Nenhum dado encontrado</p><p className="text-sm text-foreground/70">Ajuste os filtros.</p></div>
        </div>
      );
    }
    return (
      <div style={{ height: 'calc(100vh - 460px)', minHeight: 460, maxHeight: 560 }}>
        <StatisticsChart
          data={chartData}
          chartType={chartType as StatisticsChartType}
          yAxisMode={yMode as YAxisMode}
          isComparisonMode={isComparisonMode}
          height="100%"
          yAxisLabel={yMode === 'value' ? 'Valor (R$)' : 'Taxa (%)'}
          valueFormatter={valueFormatter}
          trendLine={trendLine}
          tooltipLabels={{ primary: yMode === 'value' ? 'Faturado' : 'Taxa' }}
        />
      </div>
    );
  };

  const currentChartTypeOption = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Cobranças & Fluxo de Caixa"
          icon={IconReportMoney}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Cobranças' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconCash className="h-5 w-5 text-primary" />
                  Cobranças por Período
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1 text-foreground/75">
                  Faturamento, recebimento e inadimplência ao longo do tempo.
                  <Badge variant="outline" className="text-xs">{yMode === 'value' ? 'R$' : 'Taxa de Recebimento'}</Badge>
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
                      <currentChartTypeOption.icon className="h-4 w-4" />{currentChartTypeOption.label}
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
                      <IconTrendingUp className="h-4 w-4" />{trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Linha de tendência</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setTrendLine(null)}>Desativada</DropdownMenuItem>
                    {(['linear', 'sma3', 'sma6', 'sma12'] as TrendLineType[]).map(t => (
                      <DropdownMenuItem key={t} onSelect={() => setTrendLine(t)}>{TREND_LABELS[t]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

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
                    <DropdownMenuItem onSelect={handleExportPDF}><IconFileTypePdf className="h-4 w-4 mr-2" /> PDF do Gráfico</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleExportCSV}><IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados</DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleExportXLSX}><IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* KPI Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconPercentage className="h-3.5 w-3.5" /> Taxa de Recebimento
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatPercentage(summary?.collectionRate ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">Quanto do faturado já voltou ao caixa</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconClock className="h-3.5 w-3.5" /> Dias Médios até Pagamento
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.avgDaysToPayment ?? 0, 1)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">Do vencimento até a liquidação</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconAlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> Total em Atraso
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                    <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(summary?.totalOverdue ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">Saldo de parcelas já vencidas</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconPercentage className="h-3.5 w-3.5" /> Taxa de Inadimplência
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatPercentage(summary?.overdueRate ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">% das parcelas ativas que estão vencidas</div>
                </CardContent>
              </Card>
            </div>

            <Card><CardContent className="p-4">{renderMainChart()}</CardContent></Card>

            {/* Funnel + Aging panels */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconCash className="h-4 w-4 text-primary" /> Funil de Receita
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Da fatura à liquidação — quanto entra em cada estágio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? <Skeleton className="h-[380px] w-full" /> : revenueFunnel ? (
                    <ReactECharts option={funnelOption} style={{ height: 380 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Sem dados</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /> Faixas de Atraso
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Saldo de cada parcela vencida, agrupado pelo tempo de atraso.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? <Skeleton className="h-[380px] w-full" /> : agingAnalysis.length > 0 ? (
                    <ReactECharts option={agingOption} style={{ height: 380 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Sem parcelas vencidas</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detail table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalhamento por Período</CardTitle>
                <CardDescription className="text-xs text-foreground/70">Valores faturados, recebidos e em atraso por período.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Faturado</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="text-right">Em Atraso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={5}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                      ) : items.length > 0 ? items.map(i => (
                        <TableRow key={i.period}>
                          <TableCell className="font-medium text-foreground">{i.periodLabel}</TableCell>
                          <TableCell className="text-right text-foreground/85">{formatCurrency(i.invoicedAmount)}</TableCell>
                          <TableCell className="text-right text-foreground/85">{formatCurrency(i.paidAmount)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={i.collectionRate >= 80 ? 'completed' : i.collectionRate >= 50 ? 'pending' : 'red'}>
                              {formatPercentage(i.collectionRate)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-red-700 dark:text-red-400 font-medium">{formatCurrency(i.overdueAmount)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={5} className="text-center text-sm text-foreground/60 py-6">Sem dados</TableCell></TableRow>
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
    </div>
  );
};

export default CashflowStatisticsPage;
