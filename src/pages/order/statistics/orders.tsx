// web/src/pages/order/statistics/orders.tsx

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useOrderAnalytics } from '@/hooks/inventory/use-order-analytics';
import type { OrderAnalyticsFilters, OrderChartType } from '@/types/order-analytics';
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
  IconClipboardList,
  IconCash,
  IconPackage,
  IconArrowsSort,
  IconChartArea,
  IconStack2,
  IconBox,
} from '@tabler/icons-react';

// Y-axis display mode type
type YAxisMode = 'quantity' | 'value';
import { format, startOfDay, endOfDay, subMonths } from 'date-fns';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderFilters } from '@/components/inventory/statistics/order-filters';
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

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#ef4444', // red
];

// Chart type options with context awareness (like consumption analysis)
const getAvailableChartTypes = (isComparisonMode: boolean) => {
  const baseTypes: Array<{
    value: OrderChartType;
    label: string;
    icon: typeof IconChartBar;
    description: string;
  }> = [
    {
      value: 'bar' as OrderChartType,
      label: 'Barras',
      icon: IconChartBar,
      description: 'Gráfico de barras vertical',
    },
    {
      value: 'line' as OrderChartType,
      label: 'Linhas',
      icon: IconChartLine,
      description: 'Gráfico de linhas',
    },
    {
      value: 'area' as OrderChartType,
      label: 'Área',
      icon: IconChartArea,
      description: 'Gráfico de área',
    },
  ];

  if (isComparisonMode) {
    baseTypes.push({
      value: 'bar-stacked' as OrderChartType,
      label: 'Barras Empilhadas',
      icon: IconStack2,
      description: 'Barras empilhadas para comparação',
    });
  } else {
    baseTypes.push({
      value: 'pie' as OrderChartType,
      label: 'Pizza',
      icon: IconChartPie,
      description: 'Gráfico de pizza',
    });
  }

  return baseTypes;
};

const OrderPage = () => {
  usePageTracker({
    page: 'order-analytics',
    title: 'Análise de Pedidos',
  });

  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<OrderAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate: endOfDay(new Date()),
    sortBy: 'quantity',
    sortOrder: 'desc',
    limit: 50,
    topSuppliersLimit: 10,
    topItemsLimit: 10,
    trendGroupBy: 'month',
  });

  // Chart type state
  const [selectedChartType, setSelectedChartType] = useState<OrderChartType>('bar');

  // Y-axis mode state (quantity or value)
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('quantity');

  // Determine comparison mode (like consumption analysis)
  const isComparisonMode = useMemo(() => {
    return (filters.periods && filters.periods.length >= 2) || false;
  }, [filters.periods]);

  // Get available chart types based on mode
  const availableChartTypes = useMemo(
    () => getAvailableChartTypes(isComparisonMode),
    [isComparisonMode]
  );

  // Auto-switch chart type if current type becomes unavailable
  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some(
      (type) => type.value === selectedChartType
    );
    if (!isCurrentTypeAvailable) {
      setSelectedChartType('bar');
    }
  }, [availableChartTypes, selectedChartType]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.supplierIds && filters.supplierIds.length > 0) count++;
    if (filters.itemIds && filters.itemIds.length > 0) count++;
    if (filters.brandIds && filters.brandIds.length > 0) count++;
    if (filters.categoryIds && filters.categoryIds.length > 0) count++;
    if (filters.periods && filters.periods.length >= 2) count++;
    return count;
  }, [filters]);

  // Fetch data
  const { data, isLoading, isError, error, refetch } = useOrderAnalytics(filters);

  const summary = data?.data?.summary;
  const topItems = data?.data?.topItems || [];

  // Format currency
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  // Handle filter apply
  const handleFilterApply = useCallback((newFilters: OrderAnalyticsFilters) => {
    const updatedFilters = {
      ...newFilters,
      limit: newFilters.limit || 50,
    };
    setFilters(updatedFilters);
  }, []);

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
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
    setFilters(defaultFilters);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({
      ...filters,
      sortBy: sortBy as 'quantity' | 'value' | 'name',
      sortOrder,
    });
  }, [filters]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!topItems || topItems.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Item', 'Categoria', 'Marca', 'Quantidade', 'Valor Total', 'Preço Médio', 'Nº Pedidos'];

      const rows = topItems.map((item) => [
        item.itemName,
        item.categoryName || '-',
        item.brandName || '-',
        item.totalOrdered.toFixed(2),
        item.totalValue.toFixed(2),
        (item.totalValue / item.totalOrdered).toFixed(2),
        item.orderCount.toString(),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pedidos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error('Erro ao exportar CSV:', error);
      }
      toast.error('Erro ao exportar dados');
    }
  }, [topItems]);

  // Render chart based on selected type using ECharts
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

    if (!topItems || topItems.length === 0) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconPackage className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros para visualizar os dados
            </p>
          </div>
        </div>
      );
    }

    // Prepare chart data
    const chartLimit = Math.min(topItems.length, filters.limit || 50);
    const chartData = topItems.slice(0, chartLimit);

    // Calculate if we need dataZoom (more than 8 items)
    const needsScroll = chartData.length > 8;
    const zoomEnd = needsScroll ? (8 / chartData.length) * 100 : 100;

    const xAxisData = chartData.map((item) => item.itemName);

    // Get display value based on Y-axis mode
    const getDisplayValue = (item: typeof chartData[0]) =>
      yAxisMode === 'quantity' ? item.totalOrdered : item.totalValue;

    const yAxisLabel = yAxisMode === 'quantity' ? 'Quantidade' : 'Preço (R$)';
    // PIE CHART (only available in non-comparison mode)
    if (selectedChartType === 'pie' && !isComparisonMode) {
      const pieData = chartData.map((item) => ({
        name: item.itemName,
        value: getDisplayValue(item),
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const formattedValue = yAxisMode === 'quantity'
              ? `${Math.round(params.value)} un`
              : formatCurrency(params.value);
            return `${params.name}: ${formattedValue} (${params.percent}%)`;
          },
        },
        legend: {
          bottom: 0,
          left: 'center',
        },
        color: CHART_COLORS,
        series: [
          {
            type: 'pie',
            radius: '60%',
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            label: {
              formatter: (params: any) => {
                const formattedValue = yAxisMode === 'quantity'
                  ? Math.round(params.value).toString()
                  : formatCurrency(params.value);
                return `${params.name}: ${formattedValue}`;
              },
            },
          },
        ],
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }

    // LINE CHART
    if (selectedChartType === 'line') {
      const seriesData = chartData.map((item) => ({
        value: getDisplayValue(item),
        quantity: item.totalOrdered,
        totalValue: item.totalValue,
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const p = params[0];
            const qty = Math.round(p.data.quantity);
            const price = formatCurrency(p.data.totalValue);
            return `<strong>${p.name}</strong><br/>Quantidade: ${qty} un<br/>Valor: ${price}`;
          },
        },
        grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: {
          type: 'value',
          axisLabel: yAxisMode === 'value' ? {
            formatter: (value: number) => formatCurrency(value).replace('R$', '').trim(),
          } : undefined,
        },
        color: CHART_COLORS,
        dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
        series: [{ name: yAxisLabel, type: 'line', data: seriesData, smooth: true, itemStyle: { color: CHART_COLORS[0] } }],
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }

    // AREA CHART
    if (selectedChartType === 'area') {
      const seriesData = chartData.map((item) => ({
        value: getDisplayValue(item),
        quantity: item.totalOrdered,
        totalValue: item.totalValue,
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const p = params[0];
            const qty = Math.round(p.data.quantity);
            const price = formatCurrency(p.data.totalValue);
            return `<strong>${p.name}</strong><br/>Quantidade: ${qty} un<br/>Valor: ${price}`;
          },
        },
        grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: {
          type: 'value',
          axisLabel: yAxisMode === 'value' ? {
            formatter: (value: number) => formatCurrency(value).replace('R$', '').trim(),
          } : undefined,
        },
        color: CHART_COLORS,
        dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
        series: [{ name: yAxisLabel, type: 'line', data: seriesData, smooth: true, areaStyle: { opacity: 0.6 }, itemStyle: { color: CHART_COLORS[0] } }],
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }

    // BAR CHART (default)
    const seriesData = chartData.map((item) => ({
      value: getDisplayValue(item),
      quantity: item.totalOrdered,
      totalValue: item.totalValue,
    }));

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const qty = Math.round(p.data.quantity);
          const price = formatCurrency(p.data.totalValue);
          return `<strong>${p.name}</strong><br/>Quantidade: ${qty} un<br/>Valor: ${price}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
      xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
      yAxis: {
        type: 'value',
        axisLabel: yAxisMode === 'value' ? {
          formatter: (value: number) => formatCurrency(value).replace('R$', '').trim(),
        } : undefined,
      },
      color: CHART_COLORS,
      dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
      series: [{
        name: yAxisLabel,
        type: 'bar',
        data: seriesData,
        itemStyle: { color: CHART_COLORS[0] },
        label: {
          show: true,
          position: 'top',
          fontSize: 9,
          formatter: (params: any) => {
            if (params.data.value > 0) {
              return yAxisMode === 'quantity'
                ? Math.round(params.data.value).toString()
                : formatCurrency(params.data.value).replace('R$', '').trim();
            }
            return '';
          },
        },
      }],
    };

    return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Pedidos"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_PEDIDOS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Estoque', href: routes.statistics.inventory.root },
            { label: 'Pedidos' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Análise de Pedidos de Itens</CardTitle>
              <CardDescription>
                Visualize e compare os pedidos de itens por período, fornecedor e categoria
                {isComparisonMode && (
                  <Badge variant="secondary" className="ml-2">
                    Modo Comparação: Períodos
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
                      const currentChartType = availableChartTypes.find((t) => t.value === selectedChartType);
                      const Icon = currentChartType?.icon;
                      return (
                        <>
                          {Icon && <Icon className="h-4 w-4 mr-2" />}
                          {currentChartType?.label}
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
                    onValueChange={(value) => setSelectedChartType(value as OrderChartType)}
                  >
                    {availableChartTypes.map((chartType) => {
                      const ChartIcon = chartType.icon;
                      return (
                        <DropdownMenuRadioItem key={chartType.value} value={chartType.value} className="group">
                          <ChartIcon className="h-4 w-4 mr-2" />
                          <div className="flex flex-col">
                            <span>{chartType.label}</span>
                            <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/90">{chartType.description}</span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <IconArrowsSort className="h-4 w-4 mr-2" />
                    Ordenar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSortChange('quantity', 'desc')}>
                    <IconTrendingDown className="h-4 w-4 mr-2" />
                    Quantidade (maior primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('quantity', 'asc')}>
                    <IconTrendingUp className="h-4 w-4 mr-2" />
                    Quantidade (menor primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('value', 'desc')}>
                    <IconCash className="h-4 w-4 mr-2" />
                    Valor (maior primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('value', 'asc')}>
                    <IconCash className="h-4 w-4 mr-2" />
                    Valor (menor primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('name', 'asc')}>
                    Nome (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('name', 'desc')}>
                    Nome (Z-A)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter Button */}
              <Button
                variant={activeFilterCount > 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilterDrawer(true)}
              >
                <IconFilter className="h-4 w-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {/* Export Button */}
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading || !topItems.length}>
                <IconDownload className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Total de Pedidos</CardTitle>
                  <IconClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{summary.totalOrders}</div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Total de Itens</CardTitle>
                  <IconBox className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{summary.totalItems}</div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Valor Total</CardTitle>
                  <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{formatCurrency(summary.totalValue)}</div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Valor Médio por Pedido</CardTitle>
                  <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{formatCurrency(summary.averageOrderValue)}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chart Section */}
          <Card>
            <CardContent className="p-4">
              {renderChart()}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Detalhamento dos Dados</CardTitle>
              <CardDescription>
                {topItems.length > 0
                  ? `Exibindo ${topItems.length} ${topItems.length === 1 ? 'item' : 'itens'}`
                  : 'Nenhum item para exibir'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Preço Médio</TableHead>
                      <TableHead className="text-right">Nº Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : topItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    ) : (
                      topItems.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell>{item.categoryName || '-'}</TableCell>
                          <TableCell>{item.brandName || '-'}</TableCell>
                          <TableCell className="text-right">{item.totalOrdered.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalValue)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.totalOrdered > 0 ? item.totalValue / item.totalOrdered : 0)}
                          </TableCell>
                          <TableCell className="text-right">{item.orderCount}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Filter Drawer */}
      <OrderFilters
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filters={filters}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        yAxisMode={yAxisMode}
        onYAxisModeChange={setYAxisMode}
      />
        </div>
      </div>
    </div>
  );
};

// Export wrapper
export const OrderStatisticsPage = () => {
  return <OrderPage />;
};

export default OrderStatisticsPage;
