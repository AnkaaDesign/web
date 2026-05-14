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
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useReceivablesAnalytics } from '@/hooks/financial/use-financial-analytics';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import type { ReceivablesAnalyticsFilters, ForecastDayBucket } from '@/types/financial-analytics';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { customerKeys } from '@/hooks/common/query-keys';
import { ForecastBucketInstallmentsModal } from '@/components/financial/forecast-bucket-installments-modal';
import ReactECharts from 'echarts-for-react';
import { format, startOfDay, endOfDay, subMonths } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import {
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconUsers,
  IconCalendar,
  IconCalendarStats,
  IconX,
  IconClock,
  IconCash,
  IconAlertTriangle,
  IconReceiptOff,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconBuildingBank,
  IconNumbers,
  IconTrendingUp,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COMBOBOX_PAGE_SIZE = 20;

const BUCKET_COLORS: Record<string, string> = {
  OVERDUE: '#dc2626',
  D7:  '#059669',
  D15: '#0284c7',
  D30: '#0891b2',
  D60: '#7c3aed',
  D90: '#d97706',
};

// Forecast cards shown in the KPI grid (separate from the chart).
// We expose 7d / 30d / 60d / 90d — all clickable to drill into the matching bucket.
type ForecastCardKey = 'D7' | 'D30' | 'D60' | 'D90';
const FORECAST_CARD_KEYS: ForecastCardKey[] = ['D7', 'D30', 'D60', 'D90'];
const FORECAST_CARD_TITLES: Record<ForecastCardKey, string> = {
  D7:  'A receber em 7 dias',
  D30: 'A receber em 30 dias',
  D60: 'A receber em 60 dias',
  D90: 'A receber em 90 dias',
};
const FORECAST_CARD_HINT: Record<ForecastCardKey, string> = {
  D7:  'Vencimentos da próxima semana',
  D30: 'Vencimentos no próximo mês',
  D60: 'Vencimentos nos próximos 2 meses',
  D90: 'Vencimentos no próximo trimestre',
};

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ReceivablesAnalyticsFilters;
  onApply: (f: ReceivablesAnalyticsFilters) => void;
}

function FilterSheet({ open, onOpenChange, filters, onApply }: FilterSheetProps) {
  const [local, setLocal] = useState<ReceivablesAnalyticsFilters>(filters);

  useEffect(() => { if (open) setLocal(filters); }, [open, filters]);

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const r = await getCustomers({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return { data: (r.data || []).map(c => ({ value: c.id, label: c.fantasyName })), hasMore: r.meta?.hasNextPage || false };
  }, []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (local.customerIds?.length) n++;
    return n;
  }, [local]);

  const apply = useCallback(() => { onApply(local); onOpenChange(false); }, [local, onApply, onOpenChange]);

  const clear = useCallback(() => {
    setLocal({
      startDate: startOfDay(subMonths(new Date(), 12)),
      endDate: endOfDay(new Date()),
      limit: 20,
      forecastDays: 90,
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" /> Filtros — Recebíveis
            {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            As faixas de atraso são sempre calculadas a partir de hoje. O intervalo abaixo apenas limita
            a janela de cohortes de recuperação.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconCalendar className="h-4 w-4" /> Janela de Cohortes (faturas geradas)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-foreground/70 mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.startDate}
                    onChange={d => d && d instanceof Date && setLocal({ ...local, startDate: startOfDay(d) })}
                    hideLabel
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground/70 mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.endDate}
                    onChange={d => d && d instanceof Date && setLocal({ ...local, endDate: endOfDay(d) })}
                    hideLabel
                  />
                </div>
              </div>
              <p className="text-xs text-foreground/70">
                A análise de faixas de atraso e o DSO consideram todas as parcelas em aberto,
                independente desta janela.
              </p>
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
                searchable clearable
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <IconNumbers className="h-4 w-4" /> Resultados por Tabela
              </Label>
              <Input
                type="number"
                min={5}
                max={100}
                value={local.limit ?? 20}
                onChange={value => {
                  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) || 20 : 20;
                  setLocal({ ...local, limit: n });
                }}
                placeholder="20"
                className="bg-transparent"
              />
              <p className="text-xs text-foreground/70">
                Limite de linhas para "Maiores Devedores" e "Faixas de Atraso por Cliente".
              </p>
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

const ReceivablesStatisticsPage = () => {
  usePageTracker({ page: 'financial-receivables-analytics', title: 'Recebíveis' });

  const theme = useChartTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ReceivablesAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 12)),
    endDate: endOfDay(new Date()),
    limit: 20,
    forecastDays: 90,
  });
  const [openBucket, setOpenBucket] = useState<ForecastDayBucket | null>(null);

  const { data, isLoading, isError, error, refetch } = useReceivablesAnalytics(filters);
  const summary = data?.data?.summary;
  const topDelinquents = data?.data?.topDelinquents || [];
  const customerAging = data?.data?.customerAging || [];
  const forecastBuckets = data?.data?.forecastBuckets || [];
  const recoveryCohorts = data?.data?.recoveryCohorts || [];

  const bucketByKey = useMemo(() => {
    const m: Record<string, ForecastDayBucket> = {};
    forecastBuckets.forEach(b => { m[b.bucket] = b; });
    return m;
  }, [forecastBuckets]);

  // Synthetic "all" bucket: union of every other bucket, used by the Total a Receber card.
  const allBucket = useMemo<ForecastDayBucket | null>(() => {
    if (!forecastBuckets.length) return null;
    const installments = forecastBuckets.flatMap(b => b.installments ?? []);
    const installmentCount = forecastBuckets.reduce((s, b) => s + b.installmentCount, 0);
    const dueAmount = forecastBuckets.reduce((s, b) => s + b.dueAmount, 0);
    const truncated = forecastBuckets.some(b => b.truncated);
    return {
      bucket: 'ALL',
      bucketLabel: 'Todas as parcelas em aberto',
      installments,
      installmentCount,
      dueAmount: Math.round(dueAmount * 100) / 100,
      truncated,
    };
  }, [forecastBuckets]);

  const openBucketByKey = useCallback((key: string) => {
    const b = key === 'ALL' ? allBucket : bucketByKey[key];
    if (!b) return;
    if (!b.installmentCount) {
      toast.info('Sem parcelas nesta faixa.');
      return;
    }
    setOpenBucket(b);
  }, [bucketByKey, allBucket]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.customerIds?.length) n++;
    return n;
  }, [filters]);

  // Cumulative amount per forecast card. Backend already exposes per-bucket
  // dueAmount, but the cards show *cumulative* exposure (7d ⊂ 30d ⊂ 60d ⊂ 90d).
  const cumulativeForecast = useMemo<Record<ForecastCardKey, number>>(() => ({
    D7:  summary?.forecastNext7  ?? 0,
    D30: summary?.forecastNext30 ?? 0,
    D60: summary?.forecastNext60 ?? 0,
    D90: summary?.forecastNext90 ?? 0,
  }), [summary]);

  const cumulativeCount = useMemo<Record<ForecastCardKey, number>>(() => {
    const c = (k: string) => bucketByKey[k]?.installmentCount ?? 0;
    return {
      D7:  c('D7'),
      D30: c('D7') + c('D15') + c('D30'),
      D60: c('D7') + c('D15') + c('D30') + c('D60'),
      D90: c('D7') + c('D15') + c('D30') + c('D60') + c('D90'),
    };
  }, [bucketByKey]);

  // Forecast chart
  const forecastOption = useMemo(() => {
    if (!forecastBuckets.length) return {} as any;
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const b = forecastBuckets[params[0].dataIndex];
          const action = b.installmentCount > 0 ? '<br/><em>Clique para ver as parcelas</em>' : '';
          return `<strong>${b.bucketLabel}</strong><br/>Valor: ${formatCurrency(b.dueAmount)}<br/>Parcelas: ${formatNumber(b.installmentCount, 0)}${action}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '14%', containLabel: true, top: 20 },
      xAxis: { type: 'category' as const, data: forecastBuckets.map(b => b.bucketLabel), axisLabel: { fontSize: 10, color: theme.subTextColor } },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim(), fontSize: 10, color: theme.subTextColor },
      },
      series: [{
        type: 'bar' as const,
        cursor: 'pointer',
        data: forecastBuckets.map(b => ({
          value: b.dueAmount,
          itemStyle: { color: BUCKET_COLORS[b.bucket] || '#666', borderRadius: [4, 4, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: theme.textColor,
          formatter: (p: any) => p.value > 0 ? formatCurrency(p.value) : '',
        },
        emphasis: { focus: 'self' as const },
      }],
    };
  }, [forecastBuckets, theme]);

  const onForecastChartClick = useCallback((params: any) => {
    const idx = params?.dataIndex;
    if (typeof idx !== 'number') return;
    const b = forecastBuckets[idx];
    if (!b) return;
    if (!b.installmentCount) {
      toast.info('Sem parcelas nesta faixa.');
      return;
    }
    setOpenBucket(b);
  }, [forecastBuckets]);

  // Recovery cohort chart.
  // When all 4 series have very similar values (common when cohorts are old
  // and most payments arrived within 30 days), the lines visually overlap and
  // the chart looks like a single line. We render with bold symbols + distinct
  // line styles + emphasis-on-series so the layers stay readable.
  const cohortOption = useMemo(() => {
    if (!recoveryCohorts.length) return {} as any;
    const singleCohort = recoveryCohorts.length === 1;
    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const c = recoveryCohorts[params[0].dataIndex];
          return `<strong>${c.cohortLabel}</strong><br/>
            Faturado: ${formatCurrency(c.invoicedAmount)}<br/>
            Recebido em 30d: ${formatPercentage(c.recoveredAt30Days)}<br/>
            Recebido em 60d: ${formatPercentage(c.recoveredAt60Days)}<br/>
            Recebido em 90d: ${formatPercentage(c.recoveredAt90Days)}<br/>
            Recebido até hoje: ${formatPercentage(c.recoveredFinal)}`;
        },
      },
      legend: {
        top: 0,
        fontSize: 11,
        icon: 'roundRect' as const,
        textStyle: { color: theme.textColor },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true, top: 40 },
      xAxis: {
        type: 'category' as const,
        data: recoveryCohorts.map(c => c.cohortLabel),
        boundaryGap: singleCohort,
        axisLabel: { fontSize: 10, color: theme.subTextColor },
      },
      yAxis: {
        type: 'value' as const,
        max: 100,
        axisLabel: { formatter: '{value}%', fontSize: 10, color: theme.subTextColor },
      },
      color: ['#2563eb', '#0891b2', '#7c3aed', '#10b981'],
      series: [
        {
          name: 'Em 30 dias',
          type: 'line' as const,
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 9,
          lineStyle: { width: 2.5, type: 'solid' as const },
          emphasis: { focus: 'series' as const, scale: 1.2 },
          data: recoveryCohorts.map(c => c.recoveredAt30Days),
        },
        {
          name: 'Em 60 dias',
          type: 'line' as const,
          smooth: true,
          showSymbol: true,
          symbol: 'rect',
          symbolSize: 9,
          lineStyle: { width: 2.5, type: 'dashed' as const },
          emphasis: { focus: 'series' as const, scale: 1.2 },
          data: recoveryCohorts.map(c => c.recoveredAt60Days),
        },
        {
          name: 'Em 90 dias',
          type: 'line' as const,
          smooth: true,
          showSymbol: true,
          symbol: 'triangle',
          symbolSize: 10,
          lineStyle: { width: 2.5, type: 'dotted' as const },
          emphasis: { focus: 'series' as const, scale: 1.2 },
          data: recoveryCohorts.map(c => c.recoveredAt90Days),
        },
        {
          name: 'Até hoje',
          type: 'line' as const,
          smooth: true,
          showSymbol: true,
          symbol: 'diamond',
          symbolSize: 11,
          lineStyle: { width: 3, type: 'solid' as const },
          emphasis: { focus: 'series' as const, scale: 1.2 },
          data: recoveryCohorts.map(c => c.recoveredFinal),
        },
      ],
    };
  }, [recoveryCohorts, theme]);

  // Aging stacked bar per customer (top N)
  const agingOption = useMemo(() => {
    if (!customerAging.length) return {} as any;
    const top = customerAging.slice(0, 15);
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const idx = params[0].dataIndex;
          const c = top[idx];
          return `<strong>${c.customerName}</strong><br/>
            No prazo: ${formatCurrency(c.current)}<br/>
            1-30d em atraso: ${formatCurrency(c.band30)}<br/>
            31-60d em atraso: ${formatCurrency(c.band60)}<br/>
            61-90d em atraso: ${formatCurrency(c.band90)}<br/>
            90+d em atraso: ${formatCurrency(c.band90Plus)}<br/>
            DSO: ${formatNumber(c.dso, 0)} dias`;
        },
      },
      legend: { top: 0, fontSize: 10, textStyle: { color: theme.textColor } },
      grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true, top: 30 },
      xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim(), fontSize: 10, color: theme.subTextColor } },
      yAxis: {
        type: 'category' as const,
        inverse: true,
        data: top.map(c => c.customerName.length > 24 ? c.customerName.slice(0, 22) + '…' : c.customerName),
        axisLabel: { fontSize: 10, color: theme.textColor },
      },
      color: ['#16a34a', '#facc15', '#f97316', '#ef4444', '#7c3aed'],
      series: [
        { name: 'No prazo',  type: 'bar' as const, stack: 'aging', data: top.map(c => c.current) },
        { name: '1-30d',     type: 'bar' as const, stack: 'aging', data: top.map(c => c.band30) },
        { name: '31-60d',    type: 'bar' as const, stack: 'aging', data: top.map(c => c.band60) },
        { name: '61-90d',    type: 'bar' as const, stack: 'aging', data: top.map(c => c.band90) },
        { name: '90+d',      type: 'bar' as const, stack: 'aging', data: top.map(c => c.band90Plus) },
      ],
    };
  }, [customerAging, theme]);

  // Exports
  const handleExportCSV = useCallback(() => {
    if (!topDelinquents.length && !customerAging.length) { toast.error('Nenhum dado'); return; }
    try {
      const headers = ['Cliente', 'Em Atraso (R$)', 'Parcelas Vencidas', 'Dias Mais Antiga', 'Total a Receber (R$)'];
      const rows = topDelinquents.map(d => [d.customerName, d.overdueAmount.toFixed(2), d.overdueCount, d.daysOverdueMax, d.totalReceivable.toFixed(2)]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `recebiveis-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [topDelinquents, customerAging]);

  const handleExportXLSX = useCallback(() => {
    if (!topDelinquents.length && !customerAging.length) { toast.error('Nenhum dado'); return; }
    try {
      const wb = XLSX.utils.book_new();
      if (topDelinquents.length) {
        const headers = ['Cliente', 'Em Atraso (R$)', 'Parcelas Vencidas', 'Dias Mais Antiga', 'Total a Receber (R$)'];
        const rows = topDelinquents.map(d => [d.customerName, d.overdueAmount, d.overdueCount, d.daysOverdueMax, d.totalReceivable]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 32 : 18 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Maiores Devedores');
      }
      if (customerAging.length) {
        const headers = ['Cliente', 'No prazo', '1-30d', '31-60d', '61-90d', '90+d', 'Total', 'DSO (dias)'];
        const rows = customerAging.map(c => [c.customerName, c.current, c.band30, c.band60, c.band90, c.band90Plus, c.total, c.dso]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 32 : 14 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Faixas de Atraso');
      }
      XLSX.writeFile(wb, `recebiveis-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [topDelinquents, customerAging]);

  if (isError) {
    return (
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Recebíveis & Clientes"
          icon={IconBuildingBank}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_RECEBIVEIS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Recebíveis' },
          ]}
        />
        <Card className="mt-4 flex-1 flex items-center justify-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <IconAlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-foreground/70">{error?.message || 'Erro'}</p>
            <Button onClick={() => refetch()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Recebíveis & Clientes"
            icon={IconBuildingBank}
            favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_RECEBIVEIS}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Financeiro', href: routes.statistics.financial.root },
              { label: 'Recebíveis' },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconBuildingBank className="h-5 w-5 text-primary" /> Análise de Recebíveis
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1 text-foreground/75">
                    Saldo a receber por faixa de atraso, prazo médio de pagamento e previsão de caixa.
                    <Badge variant="outline" className="text-xs">Snapshot atual</Badge>
                    {filters.startDate && (
                      <Badge variant="secondary" className="text-xs">
                        Cohorts: {format(filters.startDate, 'dd/MM/yy')} – {format(filters.endDate, 'dd/MM/yy')}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                      <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || (!topDelinquents.length && !customerAging.length)}>
                        <IconDownload className="h-4 w-4" /> Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleExportCSV}><IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV (Devedores)</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleExportXLSX}><IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (2 abas)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Unified KPI strip: 3 position metrics + 4 forecast cards, all in one row on wide screens */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <IconCalendarStats className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Resumo de Recebíveis</h3>
                  <span className="text-xs text-foreground/65">— clique em um cartão de previsão ou na barra do gráfico para ver as parcelas</span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                  <Card
                    className={`transition-colors ${!isLoading && allBucket?.installmentCount ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={!isLoading && allBucket?.installmentCount ? () => openBucketByKey('ALL') : undefined}
                    role={!isLoading && allBucket?.installmentCount ? 'button' : undefined}
                    tabIndex={!isLoading && allBucket?.installmentCount ? 0 : undefined}
                    onKeyDown={e => {
                      if (!isLoading && allBucket?.installmentCount && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openBucketByKey('ALL');
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconCash className="h-3.5 w-3.5" /> Total a Receber
                      </div>
                      {isLoading ? <Skeleton className="h-7 w-32 mt-1" /> :
                        <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(summary?.totalReceivable ?? 0)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {allBucket?.installmentCount ? `${formatNumber(allBucket.installmentCount, 0)} parcelas · clique para ver →` : 'Saldo aberto em todas as faixas'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={`transition-colors ${!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? () => openBucketByKey('OVERDUE') : undefined}
                    role={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 'button' : undefined}
                    tabIndex={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 0 : undefined}
                    onKeyDown={e => {
                      if (!isLoading && bucketByKey['OVERDUE']?.installmentCount && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openBucketByKey('OVERDUE');
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconAlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> Em Atraso
                      </div>
                      {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                        <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(summary?.totalOverdue ?? 0)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {bucketByKey['OVERDUE']?.installmentCount ? `${formatNumber(bucketByKey['OVERDUE']!.installmentCount, 0)} parcelas · clique para ver →` : 'Nenhuma parcela vencida'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconClock className="h-3.5 w-3.5" /> Prazo Médio de Pagamento
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px]">
                            DSO (<em>Days Sales Outstanding</em>) — quantos dias, em média, um cliente leva entre receber a fatura e pagá-la.
                            Quanto menor, melhor.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                        <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.avgDso ?? 0, 0)} dias</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        Da emissão da fatura ao pagamento
                      </div>
                    </CardContent>
                  </Card>

                  {FORECAST_CARD_KEYS.map(key => {
                    const value = cumulativeForecast[key];
                    const count = cumulativeCount[key];
                    const color = BUCKET_COLORS[key] || '#666';
                    const interactive = !isLoading && count > 0;
                    return (
                      <Card
                        key={key}
                        className={`relative overflow-hidden transition-colors ${interactive ? 'cursor-pointer hover:bg-muted/50' : 'opacity-90'}`}
                        onClick={interactive ? () => openBucketByKey(key) : undefined}
                        role={interactive ? 'button' : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        onKeyDown={e => {
                          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            openBucketByKey(key);
                          }
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ background: color }}
                        />
                        <CardContent className="py-3 px-4 pl-5">
                          <div className="text-xs font-medium text-foreground/70 flex items-center justify-between gap-1.5">
                            <span>{FORECAST_CARD_TITLES[key]}</span>
                            {interactive && (
                              <span className="text-[10px] text-foreground/50">Ver →</span>
                            )}
                          </div>
                          {isLoading ? (
                            <Skeleton className="h-7 w-32 mt-1" />
                          ) : (
                            <div className="text-xl font-bold mt-0.5" style={{ color }}>
                              {formatCurrency(value)}
                            </div>
                          )}
                          <div className="text-[11px] text-foreground/70 mt-0.5">
                            {count > 0 ? `${formatNumber(count, 0)} parcela${count !== 1 ? 's' : ''}` : 'Nenhuma parcela'} · {FORECAST_CARD_HINT[key]}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Forecast chart + Cohort chart */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <IconCalendarStats className="h-4 w-4 text-primary" /> Curva de Vencimentos
                    </CardTitle>
                    <CardDescription className="text-xs text-foreground/70">
                      Saldo a receber distribuído por janela de vencimento. <strong>Clique em uma barra</strong> para ver as parcelas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-2">
                    {isLoading ? <Skeleton className="h-[380px] w-full" /> : forecastBuckets.length > 0 ? (
                      <ReactECharts
                        option={forecastOption}
                        style={{ height: 380, cursor: 'pointer' }}
                        onEvents={{ click: onForecastChartClick }}
                      />
                    ) : (
                      <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Sem parcelas em aberto</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <IconTrendingUp className="h-4 w-4 text-primary" /> Quanto Recebemos por Mês de Fatura
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex"><IconInfoCircle className="h-3.5 w-3.5 text-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[320px]">
                          Para cada mês em que faturamos, quanto desse valor já entrou no caixa.
                          As três primeiras linhas mostram o ritmo: o que voltou em 30, 60 e 90 dias.
                          A linha <strong>"Até hoje"</strong> mostra o total recebido — inclui pagamentos
                          que vieram depois dos 90 dias.
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription className="text-xs text-foreground/70">
                      Mede a velocidade de recebimento: quanto antes a curva fica perto de 100%, melhor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-2">
                    {isLoading ? <Skeleton className="h-[380px] w-full" /> : recoveryCohorts.length > 0 ? (
                      <ReactECharts option={cohortOption} style={{ height: 380 }} />
                    ) : (
                      <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Sem faturas no período selecionado.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Customer aging stacked */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconUsers className="h-4 w-4 text-primary" /> Composição por Cliente — Top 15
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex"><IconInfoCircle className="h-3.5 w-3.5 text-foreground/50" /></span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[320px]">
                        Cada barra mostra o saldo a receber de um cliente, dividido por faixa de atraso:
                        verde = no prazo, amarelo a vermelho = atrasado (quanto mais escuro, mais antiga é a dívida).
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Saldo de cada cliente separado por faixa de atraso.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? <Skeleton className="h-[500px] w-full" /> : customerAging.length > 0 ? (
                    <ReactECharts option={agingOption} style={{ height: 500 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Nenhum cliente com saldo</div>
                  )}
                </CardContent>
              </Card>

              {/* Top delinquents + DSO table */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <IconReceiptOff className="h-4 w-4 text-red-600 dark:text-red-400" /> Maiores Devedores
                    </CardTitle>
                    <CardDescription className="text-xs text-foreground/70">
                      Clientes com os maiores saldos vencidos no momento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Em Atraso</TableHead>
                            <TableHead className="text-right">Parcelas</TableHead>
                            <TableHead className="text-right">Dias Máx.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                          ) : topDelinquents.length > 0 ? topDelinquents.map(d => (
                            <TableRow key={d.customerId}>
                              <TableCell className="font-medium text-foreground">{d.customerName}</TableCell>
                              <TableCell className="text-right text-red-700 dark:text-red-400 font-medium">{formatCurrency(d.overdueAmount)}</TableCell>
                              <TableCell className="text-right text-foreground/85">{formatNumber(d.overdueCount, 0)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={d.daysOverdueMax > 90 ? 'red' : d.daysOverdueMax > 30 ? 'orange' : 'secondary'}>
                                  {formatNumber(d.daysOverdueMax, 0)} d
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-foreground/60 py-6">Sem inadimplentes</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <IconClock className="h-4 w-4 text-primary" /> Prazo Médio por Cliente
                    </CardTitle>
                    <CardDescription className="text-xs text-foreground/70">
                      Dias médios entre faturamento e pagamento (DSO).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">DSO</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow><TableCell colSpan={3}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                          ) : customerAging.length > 0 ? customerAging.map(c => (
                            <TableRow key={c.customerId}>
                              <TableCell className="font-medium text-foreground">{c.customerName}</TableCell>
                              <TableCell className="text-right text-foreground/85">{formatCurrency(c.total)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={c.dso > 60 ? 'red' : c.dso > 30 ? 'orange' : 'secondary'}>
                                  {formatNumber(c.dso, 0)} d
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={3} className="text-center text-sm text-foreground/60 py-6">Sem clientes ativos</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          onApply={setFilters}
        />

        {openBucket && (
          <ForecastBucketInstallmentsModal
            open={!!openBucket}
            onOpenChange={(o) => { if (!o) setOpenBucket(null); }}
            bucketLabel={openBucket.bucketLabel}
            bucketKey={openBucket.bucket}
            dueAmount={openBucket.dueAmount}
            installments={openBucket.installments || []}
            totalCount={openBucket.installmentCount}
            truncated={openBucket.truncated}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default ReceivablesStatisticsPage;
