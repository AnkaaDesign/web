import { useState, useMemo } from 'react';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { PageHeader } from '@/components/ui/page-header';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, ITEM_CATEGORY_TYPE, STOCK_MODEL } from '../../../../constants';
import { ITEM_CATEGORY_TYPE_LABELS, STOCK_MODEL_LABELS } from '@/constants/enum-labels';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useCanViewPrices } from '@/hooks';
import {
  IconRefresh,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconFilter,
  IconShoppingCartPlus,
  IconLoader2,
} from '@tabler/icons-react';
import {
  useAutoOrderAnalysis,
  useCreateOrdersFromAutoOrder,
  type AutoOrderRecommendation,
  type AutoOrderSupplierGroup,
  type AutoOrderCreatePayload,
} from '@/services/api/auto-order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency, formatNumberWithDecimals } from '@/utils/number';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSearchInput } from '@/components/ui/table-search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';

type SortConfig = {
  column: string;
  direction: 'asc' | 'desc';
};

/** How to split the "no supplier" group into orders on creation. */
type NoSupplierStrategy = 'combined' | 'per-item' | 'by-category';

const CRITICALITY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Baixo Estoque' },
  { value: 'critical', label: 'Críticos' },
];

const NO_SUPPLIER_STRATEGY_OPTIONS = [
  { value: 'combined', label: 'Pedido único' },
  { value: 'per-item', label: 'Um pedido por item' },
  { value: 'by-category', label: 'Um pedido por categoria' },
];

const groupKey = (supplierId: string | null) => supplierId || 'no-supplier';

/** Shared column widths so every supplier-group table aligns identically
 *  (used together with `table-fixed`). MOTIVO is left without a width so it
 *  absorbs the remaining space. The checkbox column is fixed to w-12 by the
 *  Table primitive's `:has([role=checkbox])` rule. */
const COL = {
  item: 'w-[20%]',
  stock: 'w-[11%]',
  days: 'w-[11%]',
  trend: 'w-[10%]',
  qty: 'w-[12%]',
  price: 'w-[9%]',
  urgency: 'w-[10%]',
} as const;


export const AutomaticOrderListPage = () => {
  const canViewPrices = useCanViewPrices();
  const [searchValue, setSearchValue] = useState('');
  const [minStockCriteria, setMinStockCriteria] = useState<'all' | 'low' | 'critical'>('all');
  const [sortConfigs, setSortConfigs] = useState<Map<string, SortConfig>>(new Map());
  const [showFilters, setShowFilters] = useState(false);

  // Selection + editable quantities for order creation.
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [noSupplierStrategy, setNoSupplierStrategy] = useState<NoSupplierStrategy>('combined');
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

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

  const { mutateAsync: createOrders, isPending: isCreating } = useCreateOrdersFromAutoOrder();

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

  // Single source of truth for the URGÊNCIA column. Emergency override is the
  // top of the hierarchy: the item will run out BEFORE its next scheduled order
  // arrives, so it must be reordered now. The backend already forces such items
  // to urgency='critical', which is why stacking a separate "EMERGENCIAL" badge
  // next to "CRÍTICO" was redundant. We collapse to a single badge and give the
  // emergency tier the most alarming treatment (pulsing red + warning icon).
  const getUrgencyBadge = (item: AutoOrderRecommendation) => {
    if (item.isEmergencyOverride) {
      return (
        <Badge
          variant="red"
          className="gap-1 ring-2 ring-red-500/40 animate-pulse dark:ring-red-400/40"
        >
          <IconAlertTriangle className="h-3 w-3" />
          EMERGENCIAL
        </Badge>
      );
    }

    switch (item.urgency) {
      case 'critical':
        return <Badge variant="destructive">CRÍTICO</Badge>;
      case 'high':
        return <Badge variant="orange">ALTO</Badge>;
      case 'medium':
        return <Badge variant="secondary">MÉDIO</Badge>;
      default:
        return <Badge variant="outline">BAIXO</Badge>;
    }
  };

  const toggleSort = (supplierId: string | null, column: string) => {
    const key = groupKey(supplierId);
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
    const config = sortConfigs.get(groupKey(supplierId));

    if (config?.column !== column) {
      return <IconSelector className="h-4 w-4 opacity-50" />;
    }

    return config.direction === 'asc' ? (
      <IconChevronUp className="h-4 w-4" />
    ) : (
      <IconChevronDown className="h-4 w-4" />
    );
  };

  const sortItems = (items: AutoOrderRecommendation[], supplierId: string | null) => {
    const config = sortConfigs.get(groupKey(supplierId));

    if (!config) return items;

    return [...items].sort((a, b) => {
      let aVal = (a as any)[config.column];
      let bVal = (b as any)[config.column];

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

  // ---- Selection + quantity helpers ----

  const getQty = (item: AutoOrderRecommendation) =>
    quantities[item.itemId] ?? item.recommendedOrderQuantity;

  const setItemQty = (itemId: string, value: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: value }));
  };

  // Expected price tracks the (possibly edited) quantity, mirroring the order
  // schedule's "Preço esperado" column. unitPrice satisfies the invariant
  // estimatedCost = unitPrice × recommendedOrderQuantity.
  const getExpectedPrice = (item: AutoOrderRecommendation) => item.unitPrice * getQty(item);

  const groupExpectedTotal = (group: AutoOrderSupplierGroup) =>
    group.items.reduce((sum, item) => sum + getExpectedPrice(item), 0);

  // Live total across the whole analysis (not search-filtered) so the summary
  // card reflects quantity edits, consistent with the per-group totals.
  const totalExpectedValue = useMemo(
    () =>
      (analysisData?.data.supplierGroups ?? []).reduce(
        (sum, group) =>
          sum +
          group.items.reduce(
            (s, item) => s + item.unitPrice * (quantities[item.itemId] ?? item.recommendedOrderQuantity),
            0,
          ),
        0,
      ),
    [analysisData?.data.supplierGroups, quantities],
  );

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleGroupAll = (group: AutoOrderSupplierGroup, checked: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      group.items.forEach(item => {
        if (checked) next.add(item.itemId);
        else next.delete(item.itemId);
      });
      return next;
    });
  };

  const selectedInGroup = (group: AutoOrderSupplierGroup) =>
    group.items.filter(item => selectedItems.has(item.itemId));

  /** The items a "create" action will act on: the explicit selection when the
   *  user has picked rows, otherwise the whole table. */
  const targetItemsInGroup = (group: AutoOrderSupplierGroup) => {
    const selected = selectedInGroup(group);
    return selected.length > 0 ? selected : group.items;
  };

  /** Turns one supplier group's target items into the orders[] payload,
   *  honoring the no-supplier split strategy. */
  const buildOrdersForGroup = (group: AutoOrderSupplierGroup): AutoOrderCreatePayload['orders'] => {
    const selected = targetItemsInGroup(group);
    if (selected.length === 0) return [];

    const toLine = (item: AutoOrderRecommendation) => ({
      itemId: item.itemId,
      quantity: getQty(item),
    });

    // Items with a supplier → always one order for the group.
    if (group.supplierId) {
      return [{ supplierId: group.supplierId, items: selected.map(toLine) }];
    }

    // No-supplier group → apply the chosen split strategy.
    if (noSupplierStrategy === 'per-item') {
      return selected.map(item => ({ supplierId: null, items: [toLine(item)] }));
    }
    if (noSupplierStrategy === 'by-category') {
      const byCategory = new Map<string, AutoOrderRecommendation[]>();
      selected.forEach(item => {
        const key = item.categoryId ?? 'no-category';
        const arr = byCategory.get(key) ?? [];
        arr.push(item);
        byCategory.set(key, arr);
      });
      return Array.from(byCategory.values()).map(items => ({
        supplierId: null,
        items: items.map(toLine),
      }));
    }
    // combined
    return [{ supplierId: null, items: selected.map(toLine) }];
  };

  const handleCreate = async (orders: AutoOrderCreatePayload['orders'], key: string) => {
    if (orders.length === 0) return;
    setCreatingKey(key);
    try {
      await createOrders({ orders });
      // Drop the items we just ordered from the selection + quantity overrides.
      const orderedIds = orders.flatMap(o => o.items.map(i => i.itemId));
      setSelectedItems(prev => {
        const next = new Set(prev);
        orderedIds.forEach(id => next.delete(id));
        return next;
      });
      setQuantities(prev => {
        const next = { ...prev };
        orderedIds.forEach(id => delete next[id]);
        return next;
      });
    } catch {
      // The api-client interceptor surfaces the error toast; keep selection.
    } finally {
      setCreatingKey(null);
    }
  };

  const handleCreateGroup = (group: AutoOrderSupplierGroup) =>
    handleCreate(buildOrdersForGroup(group), groupKey(group.supplierId));

  const handleCreateAllSelected = () =>
    handleCreate(filteredGroups.flatMap(buildOrdersForGroup), 'all');

  // What the top "Criar pedidos" button will act on: selected rows when any are
  // picked, otherwise every visible row (full table).
  const totalEffective = filteredGroups.reduce(
    (sum, group) => sum + targetItemsInGroup(group).length,
    0,
  );

  // Tool badge keys on the item's stockModel (capability-fields contract);
  // categoryType is used only for the display label when it's a TOOL category.
  const renderCategoryBadge = (item: AutoOrderRecommendation) => {
    if (item.stockModel !== STOCK_MODEL.FIXED_TARGET) return null;
    const label =
      item.categoryType === ITEM_CATEGORY_TYPE.TOOL
        ? ITEM_CATEGORY_TYPE_LABELS[item.categoryType]
        : STOCK_MODEL_LABELS[STOCK_MODEL.FIXED_TARGET];
    return (
      <Badge variant="outline" className="ml-2 text-[10px] font-medium">
        {label}
      </Badge>
    );
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Pedidos Automáticos"
          favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_AUTOMATICOS_LISTAR}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estoque', href: routes.inventory.root },
            { label: 'Pedidos', href: routes.inventory.orders.list },
            { label: 'Automáticos' },
          ]}
          actions={[
            {
              key: 'create-selected',
              label: totalEffective > 0 ? `Criar pedidos (${totalEffective})` : 'Criar pedidos',
              icon: IconShoppingCartPlus,
              onClick: handleCreateAllSelected,
              variant: 'default',
              disabled: totalEffective === 0 || isCreating,
              loading: isCreating && creatingKey === 'all',
            },
            {
              key: 'refresh',
              label: 'Atualizar',
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: 'outline',
              loading: isRefetching,
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
                  <div className={`grid grid-cols-1 gap-4 ${canViewPrices ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Total de Itens</div>
                      <div className="text-2xl font-bold">{analysisData.data.summary.totalItems}</div>
                    </div>
                    {canViewPrices && (
                      <div className="p-4 border border-border rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Valor Estimado</div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(totalExpectedValue)}
                        </div>
                      </div>
                    )}
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Críticos</div>
                      <div className="text-2xl font-bold text-destructive">
                        {analysisData.data.summary.criticalItems}
                      </div>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
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
                    placeholder="Pesquisar itens ou fornecedores..."
                    className="flex-1"
                  />

                  <div className="flex flex-col gap-2 w-[200px]">
                    <Combobox
                      options={CRITICALITY_OPTIONS}
                      value={minStockCriteria}
                      onValueChange={(value) => setMinStockCriteria(value as 'all' | 'low' | 'critical')}
                      placeholder="Criticidade"
                      emptyText="Nenhuma opção encontrada"
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
                                emptyText="Nenhuma opção encontrada"
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
                    <div className="space-y-10 pb-4">
                      {filteredGroups.map(group => {
                        const sortedItems = sortItems(group.items, group.supplierId);
                        const groupSelected = selectedInGroup(group);
                        const allSelected =
                          group.items.length > 0 && groupSelected.length === group.items.length;
                        const someSelected = groupSelected.length > 0 && !allSelected;
                        const isNoSupplier = !group.supplierId;
                        const key = groupKey(group.supplierId);

                        return (
                          <div key={key} className="space-y-2">
                            {/* Supplier header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h2 className="text-lg font-semibold">{group.supplierName || 'Sem Fornecedor'}</h2>
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-muted-foreground">
                                  {group.itemCount} item(ns){canViewPrices && <> • Valor estimado: {formatCurrency(groupExpectedTotal(group))}</>}
                                </div>
                                {isNoSupplier && (
                                  <div className="w-[200px]">
                                    <Combobox
                                      options={NO_SUPPLIER_STRATEGY_OPTIONS}
                                      value={noSupplierStrategy}
                                      onValueChange={(value) =>
                                        setNoSupplierStrategy(value as NoSupplierStrategy)
                                      }
                                      placeholder="Como criar?"
                                      emptyText="Nenhuma opção"
                                      searchPlaceholder="Buscar..."
                                    />
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateGroup(group)}
                                  disabled={group.items.length === 0 || isCreating}
                                >
                                  {isCreating && creatingKey === key ? (
                                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <IconShoppingCartPlus className="h-4 w-4 mr-2" />
                                  )}
                                  Criar pedido{` (${groupSelected.length > 0 ? groupSelected.length : group.items.length})`}
                                </Button>
                              </div>
                            </div>

                            {/* Table */}
                            <div className="border border-border rounded-lg overflow-hidden">
                              <Table className="table-fixed">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">
                                      <div className="flex items-center justify-center">
                                        <Checkbox
                                          checked={allSelected}
                                          indeterminate={someSelected}
                                          onCheckedChange={(checked) =>
                                            toggleGroupAll(group, checked === true)
                                          }
                                          aria-label="Selecionar todos do grupo"
                                        />
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className={cn(COL.item, 'whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50')}
                                      onClick={() => toggleSort(group.supplierId, 'itemName')}
                                    >
                                      <div className="flex items-center gap-2">
                                        ITEM
                                        {getSortIcon(group.supplierId, 'itemName')}
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className={cn(COL.stock, 'whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50')}
                                      onClick={() => toggleSort(group.supplierId, 'currentStock')}
                                    >
                                      <div className="flex items-center gap-2">
                                        ESTOQUE
                                        {getSortIcon(group.supplierId, 'currentStock')}
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className={cn(COL.days, 'whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50')}
                                      onClick={() => toggleSort(group.supplierId, 'daysUntilStockout')}
                                    >
                                      <div className="flex items-center gap-2">
                                        DIAS ATÉ ZERAR
                                        {getSortIcon(group.supplierId, 'daysUntilStockout')}
                                      </div>
                                    </TableHead>
                                    <TableHead className={cn(COL.trend, 'whitespace-nowrap font-bold uppercase text-xs')}>
                                      TENDÊNCIA
                                    </TableHead>
                                    <TableHead
                                      className={cn(COL.qty, 'whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50')}
                                      onClick={() => toggleSort(group.supplierId, 'recommendedOrderQuantity')}
                                    >
                                      <div className="flex items-center gap-2">
                                        QTD. A PEDIR
                                        {getSortIcon(group.supplierId, 'recommendedOrderQuantity')}
                                      </div>
                                    </TableHead>
                                    {canViewPrices && (
                                      <TableHead className={cn(COL.price, 'whitespace-nowrap font-bold uppercase text-xs text-right')}>
                                        PREÇO
                                      </TableHead>
                                    )}
                                    <TableHead
                                      className={cn(COL.urgency, 'whitespace-nowrap font-bold uppercase text-xs cursor-pointer select-none hover:bg-muted/50')}
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
                                    const checked = selectedItems.has(item.itemId);
                                    return (
                                      <TableRow
                                        key={item.itemId}
                                        className={cn(
                                          'hover:bg-muted/30',
                                          checked && 'bg-primary/5',
                                          item.urgency === 'critical' && 'bg-red-50 dark:bg-red-900/10',
                                          isSync && 'bg-blue-50 dark:bg-blue-900/10'
                                        )}
                                      >
                                        <TableCell className="py-2">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={() => toggleItem(item.itemId)}
                                              aria-label={`Selecionar ${item.itemName}`}
                                            />
                                          </div>
                                        </TableCell>
                                        <TableCell className="font-medium py-2">
                                          <span className="inline-flex items-center">
                                            {item.itemName}
                                            {renderCategoryBadge(item)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                          {formatNumberWithDecimals(item.currentStock, item.currentStock % 1 === 0 ? 0 : 2)}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            'text-center font-semibold py-2',
                                            item.daysUntilStockout <= 7 ? 'text-destructive' : 'text-foreground'
                                          )}
                                        >
                                          {item.daysUntilStockout}
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
                                        <TableCell className="py-2">
                                          <div className="flex items-center justify-center">
                                            <Input
                                              type="number"
                                              min={0}
                                              value={getQty(item)}
                                              onChange={(value) =>
                                                setItemQty(item.itemId, Number(value) || 0)
                                              }
                                              className="h-8 w-20 text-center font-bold text-primary"
                                            />
                                          </div>
                                        </TableCell>
                                        {canViewPrices && (
                                          <TableCell className="text-right tabular-nums font-medium py-2">
                                            {formatCurrency(getExpectedPrice(item))}
                                          </TableCell>
                                        )}
                                        <TableCell className="py-2">{getUrgencyBadge(item)}</TableCell>
                                        <TableCell
                                          className="text-sm text-muted-foreground truncate py-2"
                                          title={item.reason}
                                        >
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
