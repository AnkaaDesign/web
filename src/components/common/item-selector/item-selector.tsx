import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { IconSearch, IconFilter, IconChevronUp, IconChevronDown, IconRefresh, IconSelector } from "@tabler/icons-react";
import { useItems } from "../../../hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { cn } from "@/lib/utils";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useDebounce } from "@/hooks/use-debounce";
import { getItemCategories, getItemBrands, getSuppliers } from "../../../api-client";
import type { ItemCategory, ItemBrand, Supplier } from "../../../types";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

// Type definitions for better type safety

interface ItemSelectorProps {
  selectedItems: Set<string>;
  onSelectItem: (itemId: string) => void;
  onSelectAll?: () => void;
  className?: string;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  quantities?: Record<string, number>;
  isSelected?: (itemId: string) => boolean;
  showQuantityInput?: boolean;
  itemTypeFilter?: string; // Filter items by category type (e.g., "TOOL", "MATERIAL", "PPE")

  // URL state props
  showSelectedOnly?: boolean;
  searchTerm?: string;
  showInactive?: boolean;
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
  onSearchTermChange?: (term: string) => void;
  onShowInactiveChange?: (show: boolean) => void;
  onCategoryIdsChange?: (ids: string[]) => void;
  onBrandIdsChange?: (ids: string[]) => void;
  onSupplierIdsChange?: (ids: string[]) => void;
  onShowSelectedOnlyChange?: (value: boolean) => void;

  // Sorting props
  sortConfigs?: Array<{ column: string; direction: "asc" | "desc" }>;
  toggleSort?: (column: string) => void;
  getSortDirection?: (column: string) => "asc" | "desc" | null;
  getSortOrder?: (column: string) => number | null;

  // Pagination props
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onTotalRecordsChange?: (total: number) => void;
}

export const ItemSelector = ({
  selectedItems,
  onSelectItem,
  onSelectAll,
  className,
  onQuantityChange,
  quantities = {},
  isSelected = (itemId: string) => selectedItems.has(itemId),
  showQuantityInput = true,
  itemTypeFilter,

  // URL state props with defaults
  showSelectedOnly: showSelectedOnlyProp = false,
  searchTerm: searchTermProp = "",
  showInactive: showInactiveProp = false,
  categoryIds: categoryIdsProp = [],
  brandIds: brandIdsProp = [],
  supplierIds: supplierIdsProp = [],
  onSearchTermChange,
  onShowInactiveChange,
  onCategoryIdsChange,
  onBrandIdsChange,
  onSupplierIdsChange,
  onShowSelectedOnlyChange,

  // Sorting props
  sortConfigs: sortConfigsProp,
  toggleSort: toggleSortProp,
  getSortDirection: getSortDirectionProp,
  getSortOrder: getSortOrderProp,

  // Pagination props
  page: pageProp,
  pageSize: pageSizeProp,
  totalRecords: totalRecordsProp,
  onPageChange,
  onPageSizeChange,
  onTotalRecordsChange,
}: ItemSelectorProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Form state - always use local state for immediate UI updates
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTermProp || "");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Sync prop changes to local state
  useEffect(() => {
    if (searchTermProp !== undefined) {
      setLocalSearchTerm(searchTermProp);
    }
  }, [searchTermProp]);

  // Always use local state for immediate UI feedback
  const searchTerm = localSearchTerm;
  const showInactive = showInactiveProp;
  const categoryIds = categoryIdsProp;
  const brandIds = brandIdsProp;
  const supplierIds = supplierIdsProp;

  // Debounced search term for API calls - improves performance by reducing unnecessary requests
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use pagination from props or fallback to internal state
  const {
    page: localPage,
    pageSize: localPageSize,
    sortConfigs: localSortConfigs,
    setPage: setLocalPage,
    setPageSize: setLocalPageSize,
    toggleSort: localToggleSort,
    getSortDirection: localGetSortDirection,
    getSortOrder: localGetSortOrder,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Use props if provided, otherwise fall back to local state
  const currentPage = pageProp !== undefined ? pageProp : localPage;
  const pageSize = pageSizeProp !== undefined ? pageSizeProp : localPageSize;
  const currentTotalRecords = totalRecordsProp || 0;
  const setPage = onPageChange || setLocalPage;
  const setPageSize = onPageSizeChange || setLocalPageSize;
  const sortConfigs = sortConfigsProp || localSortConfigs;
  const toggleSort = toggleSortProp || localToggleSort;
  const getSortDirection = getSortDirectionProp || localGetSortDirection;
  const getSortOrder = getSortOrderProp || localGetSortOrder;

  // Use prop if provided, otherwise use local state
  const showSelectedOnly = showSelectedOnlyProp;

  // Memoize include configuration to prevent re-renders
  const includeConfig = useMemo(
    () => ({
      brand: true,
      category: true,
      supplier: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
      borrows: {
        where: { status: "ACTIVE" },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  // Use debouncedSearchTerm for API calls to reduce unnecessary requests
  const queryParams = useMemo(
    () => ({
      searchingFor: debouncedSearchTerm,
      showInactive,
      where: {
        // Apply item type filter if provided
        ...(itemTypeFilter && {
          category: {
            type: itemTypeFilter,
          },
        }),
        ...(categoryIds.length && { categoryId: { in: categoryIds } }),
        ...(brandIds.length && { brandId: { in: brandIds } }),
        ...(supplierIds.length && { supplierId: { in: supplierIds } }),
        // Filter by selected IDs when showSelectedOnly is true
        ...(showSelectedOnly &&
          selectedItems.size > 0 && {
            id: { in: Array.from(selectedItems) },
          }),
      },
      page: currentPage,
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
    }),
    [debouncedSearchTerm, showInactive, itemTypeFilter, categoryIds, brandIds, supplierIds, showSelectedOnly, selectedItems, currentPage, pageSize, includeConfig, sortConfigs],
  );

  // Get items with filtering
  const { data: itemsResponse, isLoading: isLoadingItems } = useItems(queryParams);

  const items = itemsResponse?.data || [];
  const apiTotalRecords = itemsResponse?.meta?.totalRecords || 0;
  const totalPages = apiTotalRecords > 0 ? Math.ceil(apiTotalRecords / pageSize) : 1;

  // Update total records in URL state when it changes from API
  useEffect(() => {
    if (apiTotalRecords > 0 && onTotalRecordsChange && apiTotalRecords !== currentTotalRecords) {
      onTotalRecordsChange(apiTotalRecords);
    }
  }, [apiTotalRecords, onTotalRecordsChange, currentTotalRecords]);

  // No longer loading filter data via hooks - now using async comboboxes

  // Get current page item IDs for selection
  const currentPageItemIds = useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

  // Create caches for filter comboboxes
  const categoryCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const brandCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const supplierCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Query function for categories filter
  const queryCategoriesFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: { status: "ACTIVE" },
      };

      if (itemTypeFilter) {
        queryParams.where.type = itemTypeFilter;
      }

      if (searchTerm && searchTerm.trim()) {
        queryParams.where.name = { contains: searchTerm.trim(), mode: "insensitive" };
      }

      const response = await getItemCategories(queryParams);
      const categories = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = categories.map((category: ItemCategory) => {
        const option = { label: category.name, value: category.id };
        categoryCacheRef.current.set(category.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching categories:", error);
      }
      return { data: [], hasMore: false };
    }
  }, [itemTypeFilter]);

  // Query function for brands filter
  const queryBrandsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: { status: "ACTIVE" },
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where.name = { contains: searchTerm.trim(), mode: "insensitive" };
      }

      const response = await getItemBrands(queryParams);
      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = brands.map((brand: ItemBrand) => {
        const option = { label: brand.name, value: brand.id };
        brandCacheRef.current.set(brand.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching brands:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Query function for suppliers filter
  const querySuppliersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { fantasyName: "asc" },
        page: page,
        take: 50,
        include: { logo: true },
        where: { status: "ACTIVE" },
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where.OR = [
          { fantasyName: { contains: searchTerm.trim(), mode: "insensitive" } },
          { corporateName: { contains: searchTerm.trim(), mode: "insensitive" } },
        ];
      }

      const response = await getSuppliers(queryParams);
      const suppliers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = suppliers.map((supplier: Supplier) => {
        const label = supplier.fantasyName || supplier.corporateName || "Sem nome";
        const option = { label, value: supplier.id, logo: supplier.logo };
        supplierCacheRef.current.set(supplier.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching suppliers:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Debounced callback for parent updates
  const debouncedOnSearchTermChange = useMemo(() => {
    if (!onSearchTermChange) return null;

    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onSearchTermChange(value);
      }, 300);
    };
  }, [onSearchTermChange]);

  // Handle search - update local state immediately, parent with debouncing
  const handleSearch = useCallback(
    (value: string) => {
      setLocalSearchTerm(value); // Always update local state immediately

      if (debouncedOnSearchTermChange) {
        debouncedOnSearchTermChange(value); // Update parent with debouncing
      }
    },
    [debouncedOnSearchTermChange],
  );

  // Handle select all for current page or filtered results
  const handleSelectAll = useCallback(() => {
    if (onSelectAll) {
      onSelectAll();
      return;
    }

    const currentFiltered = items;
    const filteredIds = currentFiltered.map((item) => item.id);

    if (filteredIds.every((id) => selectedItems.has(id))) {
      // Deselect all current page items
      filteredIds.forEach((id) => onSelectItem(id));
    } else {
      // Select all current page items that aren't already selected
      filteredIds.forEach((id) => {
        if (!selectedItems.has(id)) {
          onSelectItem(id);
        }
      });
    }
  }, [items, selectedItems, onSelectItem, onSelectAll]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    if (onShowInactiveChange) onShowInactiveChange(false);
    if (onCategoryIdsChange) onCategoryIdsChange([]);
    if (onBrandIdsChange) onBrandIdsChange([]);
    if (onSupplierIdsChange) onSupplierIdsChange([]);
    if (onSearchTermChange) {
      onSearchTermChange("");
    } else {
      setLocalSearchTerm("");
    }
    setIsFilterModalOpen(false);
    setPage(1);
  }, [setPage, onShowInactiveChange, onCategoryIdsChange, onBrandIdsChange, onSupplierIdsChange, onSearchTermChange]);

  const hasActiveFilters = showInactive || categoryIds.length > 0 || brandIds.length > 0 || supplierIds.length > 0 || debouncedSearchTerm.length > 0;

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  // Check if all current page items are selected
  const allCurrentPageSelected = currentPageItemIds.length > 0 && currentPageItemIds.every((id) => selectedItems.has(id));
  const someCurrentPageSelected = currentPageItemIds.some((id) => selectedItems.has(id));

  // Calculate available stock for each item (considering active borrows)
  const itemsWithAvailableStock = useMemo(() => {
    return items.map((item) => {
      const activeBorrowsQuantity =
        item.borrows?.reduce((total, borrow) => {
          return borrow.status === "ACTIVE" ? total + borrow.quantity : total;
        }, 0) || 0;

      return {
        ...item,
        availableStock: item.quantity - activeBorrowsQuantity,
      };
    });
  }, [items]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search and Filters Section */}
      <div className="space-y-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome, código, marca ou categoria..." value={searchTerm} onChange={(value) => handleSearch(String(value || ""))} className="pl-10" />
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            {/* Show Selected Toggle - only visible when items are selected */}
            {selectedItems.size > 0 && onShowSelectedOnlyChange && (
              <ShowSelectedToggle showSelectedOnly={showSelectedOnlyProp} onToggle={(value) => onShowSelectedOnlyChange(value)} selectionCount={selectedItems.size} />
            )}

            {/* Filters Modal Trigger */}
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="default" className="group">
                  <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="ml-2 text-foreground">Filtros</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                      {[showInactive ? 1 : 0, categoryIds.length > 0 ? 1 : 0, brandIds.length > 0 ? 1 : 0, supplierIds.length > 0 ? 1 : 0].reduce((a, b) => a + b, 0)}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Filtros de Busca</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Show Inactive Toggle */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Itens Desativados</Label>
                    <div className="flex items-center space-x-2">
                      <Switch id="modal-showInactive" checked={showInactive} onCheckedChange={onShowInactiveChange || (() => {})} />
                      <Label htmlFor="modal-showInactive" className="text-sm text-muted-foreground">
                        Mostrar também desativados
                      </Label>
                    </div>
                  </div>

                  {/* Categories Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Categorias</Label>
                    <Combobox
                      async={true}
                      queryKey={["item-categories", "item-selector-filter", itemTypeFilter || "all"]}
                      queryFn={queryCategoriesFn}
                      initialOptions={[]}
                      mode="multiple"
                      placeholder="Todas as categorias"
                      value={categoryIds}
                      onValueChange={onCategoryIdsChange || (() => {})}
                      className="h-10"
                      minSearchLength={0}
                      pageSize={50}
                      debounceMs={300}
                    />
                  </div>

                  {/* Brands Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Marcas</Label>
                    <Combobox
                      async={true}
                      queryKey={["item-brands", "item-selector-filter"]}
                      queryFn={queryBrandsFn}
                      initialOptions={[]}
                      mode="multiple"
                      placeholder="Todas as marcas"
                      value={brandIds}
                      onValueChange={onBrandIdsChange || (() => {})}
                      className="h-10"
                      minSearchLength={0}
                      pageSize={50}
                      debounceMs={300}
                    />
                  </div>

                  {/* Suppliers Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fornecedores</Label>
                    <Combobox
                      async={true}
                      queryKey={["suppliers", "item-selector-filter"]}
                      queryFn={querySuppliersFn}
                      initialOptions={[]}
                      mode="multiple"
                      placeholder="Todos os fornecedores"
                      value={supplierIds}
                      onValueChange={onSupplierIdsChange || (() => {})}
                      className="h-10"
                      minSearchLength={0}
                      pageSize={50}
                      debounceMs={300}
                      renderOption={(option, isSelected) => (
                        <div className="flex items-center gap-3 w-full">
                          <SupplierLogoDisplay
                            logo={(option as any).logo}
                            supplierName={option.label}
                            size="sm"
                            shape="rounded"
                            className="flex-shrink-0"
                          />
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="font-medium truncate">{option.label}</div>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleClearFilters}>
                    <IconRefresh className="h-3 w-3 mr-1" />
                    Limpar Filtros
                  </Button>
                  <Button onClick={() => setIsFilterModalOpen(false)}>Aplicar Filtros</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Items Table Section */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Table Container */}
          <div className="rounded-lg flex flex-col overflow-hidden flex-1 min-w-0">
            {/* Fixed Header */}
            <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
              <Table className="w-full table-fixed [&>div]:border-0 [&>div]:rounded-none">
                <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    <TableHead className="w-12 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <div className="flex items-center justify-center h-full w-full px-2">
                        <Checkbox
                          checked={allCurrentPageSelected}
                          onCheckedChange={handleSelectAll}
                          className={cn(someCurrentPageSelected && !allCurrentPageSelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-24 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <button
                        onClick={() => toggleSort("uniCode")}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <TruncatedTextWithTooltip text="CÓDIGO" />
                        {renderSortIndicator("uniCode")}
                      </button>
                    </TableHead>
                    <TableHead className="w-60 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <TruncatedTextWithTooltip text="ITEM" />
                        {renderSortIndicator("name")}
                      </button>
                    </TableHead>
                    <TableHead className="w-20 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <button
                        onClick={() => toggleSort("brand.name")}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <TruncatedTextWithTooltip text="MARCA" />
                        {renderSortIndicator("brand.name")}
                      </button>
                    </TableHead>
                    <TableHead className="w-32 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <button
                        onClick={() => toggleSort("category.name")}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <TruncatedTextWithTooltip text="CATEGORIA" />
                        {renderSortIndicator("category.name")}
                      </button>
                    </TableHead>
                    <TableHead className="w-20 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <button
                        onClick={() => toggleSort("quantity")}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <TruncatedTextWithTooltip text="ESTOQUE" />
                        {renderSortIndicator("quantity")}
                      </button>
                    </TableHead>
                    {showQuantityInput && (
                      <TableHead className="w-24 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                        <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                          <TruncatedTextWithTooltip text="QUANTIDADE" />
                        </div>
                      </TableHead>
                    )}

                    {/* Scrollbar spacer - only show if not overlay scrollbar */}
                    {!isOverlay && (
                      <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
              </Table>
            </div>

            {/* Scrollable Body Container */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border max-h-[400px]">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : items.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-lg font-medium mb-2">Nenhum item encontrado</div>
                    <div className="text-sm text-muted-foreground">Ajuste os filtros para ver mais resultados.</div>
                  </div>
                </div>
              ) : (
                <Table className="w-full table-fixed [&>div]:border-0 [&>div]:rounded-none">
                  <TableBody>
                    {itemsWithAvailableStock.map((item, index) => {
                      const itemIsSelected = isSelected(item.id);
                      const quantity = quantities[item.id] || 1;

                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            "cursor-pointer transition-colors border-b border-border h-[2.75rem]",
                            index % 2 === 1 && "bg-muted/10",
                            "hover:bg-muted/20",
                            itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                          )}
                          onClick={() => onSelectItem(item.id)}
                        >
                          <TableCell className="w-12 p-0 !border-r-0">
                            <div className="flex items-center justify-center h-full w-full px-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={itemIsSelected} onCheckedChange={() => onSelectItem(item.id)} />
                            </div>
                          </TableCell>
                          {/* Código */}
                          <TableCell className="w-24 p-0 !border-r-0">
                            <div className="px-4 py-2 h-full flex items-center">
                              <div className="font-mono text-sm">{item.uniCode || "-"}</div>
                            </div>
                          </TableCell>
                          {/* Nome do Item */}
                          <TableCell className="w-60 p-0 !border-r-0">
                            <div className="px-4 py-2 h-full flex items-center">
                              <div className="font-medium truncate">{item.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="w-20 p-0 !border-r-0">
                            <div className="px-4 py-2 h-full flex items-center">
                              <div className="text-sm truncate">{item.brand?.name || "-"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="w-32 p-0 !border-r-0">
                            <div className="px-4 py-2 h-full flex items-center">
                              <div className="text-sm truncate">{item.category?.name || "-"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="w-20 p-0 !border-r-0">
                            <div className="px-4 py-2 h-full flex items-center">
                              <span className="font-medium tabular-nums">{item.availableStock}</span>
                            </div>
                          </TableCell>
                          {showQuantityInput && (
                            <TableCell className="w-24 p-0 !border-r-0" onClick={(e) => e.stopPropagation()}>
                              <div className="px-4 py-2 h-full flex items-center">
                                {itemIsSelected ? (
                                  <Input
                                    type="number"
                                    min="0.01"
                                    max="999999"
                                    step="0.01"
                                    value={quantity}
                                    onChange={(e) => onQuantityChange?.(item.id, parseFloat(e.target.value) || 0.01)}
                                    className="w-full h-6 text-sm py-0 px-2"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50 flex-shrink-0">
              <SimplePaginationAdvanced
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                totalItems={apiTotalRecords}
                pageSizeOptions={[20, 40, 60, 100]}
                onPageSizeChange={setPageSize}
                showPageSizeSelector={true}
                showGoToPage={true}
                showPageInfo={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
