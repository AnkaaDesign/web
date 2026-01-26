import { useState, useMemo } from 'react';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { PageHeader } from '@/components/ui/page-header';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from '../../../../constants';
import { usePageTracker } from '@/hooks/use-page-tracker';
import {
  IconRefresh,
  IconShoppingCart,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconPackage,
  IconClock,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconFilter,
} from '@tabler/icons-react';
import { useAutoOrderAnalysis, useCreateAutoOrders } from '@/services/api/auto-order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/number';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TABLE_LAYOUT } from '@/components/ui/table-constants';
import { TableSearchInput } from '@/components/ui/table-search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';

type SortConfig = {
  column: string;
  direction: 'asc' | 'desc';
};

const CRITICALITY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Baixo Estoque' },
  { value: 'critical', label: 'Críticos' },
];

export const AutomaticOrderListPage = () => {
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState('');
  const [minStockCriteria, setMinStockCriteria] = useState<'all' | 'low' | 'critical'>('all');
  const [sortConfigs, setSortConfigs] = useState<Map<string, SortConfig>>(new Map());
  const [showFilters, setShowFilters] = useState(false);

  // Track page access
  usePageTracker({
    title: 'Pedidos Automáticos',
    icon: 'robot',
  });

  const {
    data: analysisData,
    isLoading,
    refetch,
    isRefetching,
  } = useAutoOrderAnalysis({
    minStockCriteria,
  });

  const createAutoOrders = useCreateAutoOrders();

  const handleCreateOrders = async () => {
    if (!analysisData?.data.recommendations || analysisData.data.recommendations.length === 0) {
      toast({
        title: 'Nenhum item para ordenar',
        description: 'Não há recomendações de pedidos automáticos',
        variant: 'destructive',
      });
      return;
    }

    const recommendations = analysisData.data.recommendations;

    try {
      await createAutoOrders.mutateAsync({
        recommendations: recommendations.map(r => ({
          itemId: r.itemId,
          quantity: r.recommendedOrderQuantity,
          reason: r.reason,
        })),
        groupBySupplier: true,
      });

      toast({
        title: 'Pedidos criados com sucesso',
        description: `${recommendations.length} item(ns) adicionado(s) aos pedidos`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Erro ao criar pedidos',
        description: 'Não foi possível criar os pedidos automáticos',
        variant: 'destructive',
      });
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <IconTrendingUp className="h-4 w-4 text-orange-500" />;
      case 'decreasing':
        return <IconTrendingDown className="h-4 w-4 text-blue-500" />;
      default:
        return <IconMinus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive">CRÍTICO</Badge>;
      case 'high':
        return <Badge variant="default" className="bg-orange-500 text-white">ALTO</Badge>;
      case 'medium':
        return <Badge variant="secondary">MÉDIO</Badge>;
      default:
        return <Badge variant="outline">BAIXO</Badge>;
    }
  };

  const toggleSort = (supplierId: string | null, column: string) => {
    const key = supplierId || 'no-supplier';
    const newConfigs = new Map(sortConfigs);
    const current = newConfigs.get(key);

    if (current?.column === column) {
      if (current.direction === 'asc') {
        newConfigs.set(key, { column, direction: 'desc' });
      } else {
        newConfigs.delete(key);
      }
    } else {
      newConfigs.set(key, { column, direction: 'asc' });
    }

    setSortConfigs(newConfigs);
  };

  const getSortIcon = (supplierId: string | null, column: string) => {
    const key = supplierId || 'no-supplier';
    const config = sortConfigs.get(key);

    if (config?.column !== column) {
      return <IconSelector className="h-4 w-4 opacity-50" />;
    }

    return config.direction === 'asc' ? (
      <IconChevronUp className="h-4 w-4" />
    ) : (
      <IconChevronDown className="h-4 w-4" />
    );
  };

  const sortItems = (items: any[], supplierId: string | null) => {
    const key = supplierId || 'no-supplier';
    const config = sortConfigs.get(key);

    if (!config) return items;

    return [...items].sort((a, b) => {
      let aVal = a[config.column];
      let bVal = b[config.column];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Filter supplier groups by search
  const filteredGroups = useMemo(() => {
    if (!analysisData?.data.supplierGroups) return [];
    if (!searchValue.trim()) return analysisData.data.supplierGroups;

    const search = searchValue.toLowerCase().trim();

    return analysisData.data.supplierGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.itemName?.toLowerCase().includes(search) ||
          group.supplierName?.toLowerCase().includes(search)
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [analysisData?.data.supplierGroups, searchValue]);

  const handleClearSearch = () => {
    setSearchValue('');
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Pedidos Automáticos"
          favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_AUTOMATICOS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estoque', href: routes.inventory.root },
            { label: 'Pedidos', href: routes.inventory.orders.list },
            { label: 'Automáticos' },
          ]}
          actions={[
            {
              key: 'refresh',
              label: 'Atualizar',
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: 'outline',
              loading: isRefetching,
            },
            {
              key: 'create',
              label: 'Criar Pedidos (0)',
              icon: IconShoppingCart,
              onClick: handleCreateOrders,
              variant: 'default',
              disabled: !analysisData?.data.recommendations?.length,
              loading: createAutoOrders.isPending,
            },
          ]}
          className="flex-shrink-0"
        />

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardContent className="p-4 flex-1 flex flex-col gap-4 min-h-0">
            {/* Summary Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={`skeleton-${i}`} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                {analysisData?.data.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 border border-border/40 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Total de Itens</div>
                      <div className="text-2xl font-bold">{analysisData.data.summary.totalItems}</div>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Valor Estimado</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(analysisData.data.summary.totalEstimatedCost || 0)}
                      </div>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Críticos</div>
                      <div className="text-2xl font-bold text-destructive">
                        {analysisData.data.summary.criticalItems}
                      </div>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Overrides Emergenciais</div>
                      <div className="text-2xl font-bold text-orange-500">
                        {analysisData.data.summary.emergencyOverrides}
                      </div>
                    </div>
                  </div>
                )}

                {/* Search and Filters */}
                <div className="flex items-center gap-2">
                  <TableSearchInput
                    value={searchValue}
                    onChange={setSearchValue}
                    onClear={handleClearSearch}
                    placeholder="Pesquisar itens ou fornecedores..."
                    className="flex-1"
                  />

                  <div className="flex flex-col gap-2 w-[200px]">
                    <Combobox
                      options={CRITICALITY_OPTIONS}
                      value={minStockCriteria}
                      onValueChange={(value) => setMinStockCriteria(value as 'all' | 'low' | 'critical')}
                      placeholder="Criticidade"
                      emptyMessage="Nenhuma opção encontrada"
                      searchPlaceholder="Buscar..."
                    />
                  </div>

                  <Popover open={showFilters} onOpenChange={setShowFilters}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="default">
                        <IconFilter className="h-4 w-4 mr-2" />
                        Filtros
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-sm mb-3">Opções de Filtro</h4>
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2">
                              <Label className="text-sm">Criticidade</Label>
                              <Combobox
                                options={CRITICALITY_OPTIONS}
                                value={minStockCriteria}
                                onValueChange={(value) => setMinStockCriteria(value as 'all' | 'low' | 'critical')}
                                placeholder="Selecione..."
                                emptyMessage="Nenhuma opção encontrada"
                                searchPlaceholder="Buscar..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Supplier-grouped tables */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {filteredGroups && filteredGroups.length > 0 ? (
                    <div className="space-y-6 pb-4">
                      {filteredGroups.map(group => {
                        const sortedItems = sortItems(group.items, group.supplierId);

                        return (
                          <div key={group.supplierId || 'no-supplier'} className="space-y-2">
                            {/* Supplier header */}
                            <div className="flex items-center justify-between">
                              <h2 className="text-lg font-semibold">{group.supplierName || 'Sem Fornecedor'}</h2>
                              <div className="text-sm text-muted-foreground">
                                {group.itemCount} item(ns) • Valor estimado: {formatCurrency(group.totalEstimatedCost || 0)}
                              </div>
                            </div>

                            {/* Table */}
                            <div className="border border-border/40 rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead
                                      className="whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50"
                                      onClick={() => toggleSort(group.supplierId, 'itemName')}
                                    >
                                      <div className="flex items-center gap-2">
                                        ITEM
                                        {getSortIcon(group.supplierId, 'itemName')}
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50"
                                      onClick={() => toggleSort(group.supplierId, 'currentStock')}
                                    >
                                      <div className="flex items-center gap-2">
                                        ESTOQUE ATUAL
                                        {getSortIcon(group.supplierId, 'currentStock')}
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50"
                                      onClick={() => toggleSort(group.supplierId, 'daysUntilStockout')}
                                    >
                                      <div className="flex items-center gap-2">
                                        DIAS ATÉ ZERAR
                                        {getSortIcon(group.supplierId, 'daysUntilStockout')}
                                      </div>
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap font-bold uppercase text-xs">
                                      TENDÊNCIA
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50"
                                      onClick={() => toggleSort(group.supplierId, 'recommendedOrderQuantity')}
                                    >
                                      <div className="flex items-center gap-2">
                                        QTD. RECOMENDADA
                                        {getSortIcon(group.supplierId, 'recommendedOrderQuantity')}
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50"
                                      onClick={() => toggleSort(group.supplierId, 'urgency')}
                                    >
                                      <div className="flex items-center gap-2">
                                        URGÊNCIA
                                        {getSortIcon(group.supplierId, 'urgency')}
                                      </div>
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap font-bold uppercase text-xs">
                                      MOTIVO
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedItems.map(item => {
                                    const isSync = item.reason?.includes('Sincronização');
                                    return (
                                      <TableRow
                                        key={item.itemId}
                                        className={cn(
                                          'hover:bg-muted/30',
                                          item.urgency === 'critical' && 'bg-red-50 dark:bg-red-900/10',
                                          isSync && 'bg-blue-50 dark:bg-blue-900/10'
                                        )}
                                      >
                                        <TableCell className="font-medium py-2">{item.itemName}</TableCell>
                                        <TableCell className="text-center py-2">{item.currentStock}</TableCell>
                                        <TableCell
                                          className={cn(
                                            'text-center font-semibold py-2',
                                            item.daysUntilStockout <= 7 ? 'text-destructive' : 'text-foreground'
                                          )}
                                        >
                                          <div className="flex items-center justify-center gap-1">
                                            <IconClock className="h-3 w-3" />
                                            {item.daysUntilStockout}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="flex items-center gap-1">
                                            {getTrendIcon(item.trend)}
                                            <span className="text-sm">
                                              {item.trendPercentage && item.trendPercentage > 0 ? '+' : ''}
                                              {item.trendPercentage?.toFixed(0) || '0'}%
                                            </span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-primary py-2">
                                          <div className="flex items-center justify-center gap-1">
                                            <IconPackage className="h-3 w-3" />
                                            {item.recommendedOrderQuantity}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-2">{getUrgencyBadge(item.urgency)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate py-2">
                                          {item.reason}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Alert>
                      <IconAlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {searchValue
                          ? 'Nenhum item encontrado com os critérios de busca.'
                          : 'Nenhuma recomendação de pedido automático encontrada. Todos os itens estão com estoque adequado!'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivilegeRoute>
  );
};
