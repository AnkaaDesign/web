import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { IconSearch, IconFilter, IconChevronUp, IconChevronDown, IconRefresh, IconSelector } from "@tabler/icons-react";
import { useItems, useItemCategories, useItemBrands, useSuppliers } from "../../../../hooks";
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
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useDebounce } from "@/hooks/use-debounce";
import { extractActiveFilters } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { useDirectFilterUpdate } from "./use-direct-filter-update";
import { StockStatusIndicator } from "@/components/inventory/item/list/stock-status-indicator";
import { NaturalFloatInput } from "@/components/ui/natural-float-input";

interface ActivityItemSelectorProps {
  selectedItems: Set<string>;
  onSelectItem: (itemId: string, quantity?: number) => void;
  onSelectAll: () => void;
  className?: string;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  quantities?: Record<string, number>;
  isSelected?: (itemId: string) => boolean;
  showQuantityInput?: boolean;
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

export const ActivityItemSelector = ({
  selectedItems,
  onSelectItem,
  onSelectAll: _onSelectAll,
  className,
  onQuantityChange,
  quantities = {},
  isSelected = (itemId: string) => selectedItems.has(itemId),
  showQuantityInput = true,
  // URL state props
  showSelectedOnly: showSelectedOnlyProp,
  searchTerm: searchTermProp,
  showInactive: showInactiveProp,
  categoryIds: categoryIdsProp,
  brandIds: brandIdsProp,
  supplierIds: supplierIdsProp,
  onSearchTermChange,
  onShowInactiveChange: _onShowInactiveChange,
  onCategoryIdsChange: _onCategoryIdsChange,
  onBrandIdsChange: _onBrandIdsChange,
  onSupplierIdsChange: _onSupplierIdsChange,
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
}: ActivityItemSelectorProps) => {
  // Use direct filter update for immediate, atomic URL updates
  const { updateFilters: directUpdateFilters } = useDirectFilterUpdate();

  // Form state - always use local state for immediate UI updates
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTermProp || "");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Local filter state for modal (only applied when "Apply" is clicked)
  const [tempShowInactive, setTempShowInactive] = useState(false);
  const [tempCategoryIds, setTempCategoryIds] = useState<string[]>([]);
  const [tempBrandIds, setTempBrandIds] = useState<string[]>([]);
  const [tempSupplierIds, setTempSupplierIds] = useState<string[]>([]);

  // Sync prop changes to local state
  useEffect(() => {
    if (searchTermProp !== undefined) {
      setLocalSearchTerm(searchTermProp);
    }
  }, [searchTermProp]);

  // Always use local state for immediate UI feedback
  const searchTerm = localSearchTerm;
  const showInactive = showInactiveProp || false;
  const categoryIds = categoryIdsProp || [];
  const brandIds = brandIdsProp || [];
  const supplierIds = supplierIdsProp || [];

  // Use refs to track current filter values without causing effect re-runs
  const filterRefs = useRef({
    showInactive: showInactive,
    categoryIds: categoryIds,
    brandIds: brandIds,
    supplierIds: supplierIds,
  });

  // Update refs when filter values change
  useEffect(() => {
    filterRefs.current = {
      showInactive: showInactive,
      categoryIds: categoryIds,
      brandIds: brandIds,
      supplierIds: supplierIds,
    };
  }, [showInactive, categoryIds, brandIds, supplierIds]);

  // Initialize temp state from URL state ONLY when modal opens
  useEffect(() => {
    if (isFilterModalOpen) {
      // Sync current URL state to temp state when opening
      setTempShowInactive(filterRefs.current.showInactive || false);
      setTempCategoryIds(filterRefs.current.categoryIds || []);
      setTempBrandIds(filterRefs.current.brandIds || []);
      setTempSupplierIds(filterRefs.current.supplierIds || []);
    }
  }, [isFilterModalOpen]); // Only re-run when modal open state changes

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
  const includeConfig = React.useMemo(
    () => ({
      brand: true,
      category: true,
      supplier: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  // Use debouncedSearchTerm for API calls to reduce unnecessary requests
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply search and other filters (but keep them in state)
      ...(!showSelectedOnly && {
        searchingFor: debouncedSearchTerm,
      }),
      where: {
        // When showSelectedOnly is true, only filter by selected IDs
        ...(showSelectedOnly && selectedItems.size > 0
          ? { id: { in: Array.from(selectedItems) } }
          : {
              // Apply other filters only when not showing selected only
              // Filter by active status: only show inactive items when showInactive is true
              ...(!showInactive && { isActive: true }),
              ...(categoryIds.length && { categoryId: { in: categoryIds } }),
              ...(brandIds.length && { brandId: { in: brandIds } }),
              ...(supplierIds.length && { supplierId: { in: supplierIds } }),
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
    [debouncedSearchTerm, showInactive, categoryIds, brandIds, supplierIds, showSelectedOnly, selectedItems, currentPage, pageSize, includeConfig, sortConfigs],
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

  // Get filter options
  const { data: categoriesResponse } = useItemCategories({
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });
  const { data: brandsResponse } = useItemBrands({
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    where: { status: "ACTIVE" },
  });

  const categories = categoriesResponse?.data || [];
  const brands = brandsResponse?.data || [];
  const suppliers = suppliersResponse?.data || [];

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

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
  }, [items, selectedItems, onSelectItem]);

  // Clear all filters - preserves sort order like item list
  const handleClearAllFilters = useCallback(() => {
    // Clear search immediately
    setLocalSearchTerm("");

    // Use direct URL update for atomic clearing
    directUpdateFilters({
      showInactive: false,
      categoryIds: [],
      brandIds: [],
      supplierIds: [],
      searchTerm: "",
      page: 1,
    });
  }, [directUpdateFilters]);

  // Build filters object for active filter extraction
  const currentFilters = useMemo(
    () => ({
      searchingFor: debouncedSearchTerm,
      showInactive,
      categoryIds,
      brandIds,
      supplierIds,
    }),
    [debouncedSearchTerm, showInactive, categoryIds, brandIds, supplierIds],
  );

  // Handle individual filter removal using direct updates
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      const updates: any = { page: 1 }; // Always reset page when removing filters

      if (key === "searchingFor") {
        setLocalSearchTerm("");
        updates.searchTerm = "";
      } else if (key === "showInactive") {
        updates.showInactive = false;
      } else if (key === "categoryIds") {
        if (value && Array.isArray(categoryIds)) {
          // Remove specific category
          const filtered = categoryIds.filter((id) => id !== value);
          updates.categoryIds = filtered;
        } else {
          // Remove all categories
          updates.categoryIds = [];
        }
      } else if (key === "brandIds") {
        if (value && Array.isArray(brandIds)) {
          // Remove specific brand
          const filtered = brandIds.filter((id) => id !== value);
          updates.brandIds = filtered;
        } else {
          // Remove all brands
          updates.brandIds = [];
        }
      } else if (key === "supplierIds") {
        if (value && Array.isArray(supplierIds)) {
          // Remove specific supplier
          const filtered = supplierIds.filter((id) => id !== value);
          updates.supplierIds = filtered;
        } else {
          // Remove all suppliers
          updates.supplierIds = [];
        }
      }

      directUpdateFilters(updates);
    },
    [categoryIds, brandIds, supplierIds, directUpdateFilters],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    return extractActiveFilters(currentFilters, onRemoveFilter, {
      categories,
      brands,
      suppliers,
    });
  }, [currentFilters, categories, brands, suppliers, onRemoveFilter]);

  const hasActiveFilters = activeFilters.length > 0;

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

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search and Filters Section */}
      <div className="space-y-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome, código, marca ou categoria..." value={searchTerm} onChange={(value) => handleSearch(value as string)} className="pl-10 bg-transparent" />
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            {/* Show Selected Toggle - only visible when items are selected */}
            {selectedItems.size > 0 && onShowSelectedOnlyChange && (
              <ShowSelectedToggle showSelectedOnly={showSelectedOnlyProp || false} onToggle={(value) => onShowSelectedOnlyChange(value)} selectionCount={selectedItems.size} />
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
                      <Switch id="modal-showInactive" checked={tempShowInactive} onCheckedChange={setTempShowInactive} />
                      <Label htmlFor="modal-showInactive" className="text-sm text-muted-foreground">
                        Mostrar também desativados
                      </Label>
                    </div>
                  </div>

                  {/* Categories Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Categorias</Label>
                    <Combobox
                      placeholder="Todas as categorias"
                      options={categories.map((cat) => ({
                        value: cat.id,
                        label: cat.name,
                      }))}
                      value={tempCategoryIds}
                      onValueChange={setTempCategoryIds}
                      mode="multiple"
                      triggerClassName="h-10"
                    />
                  </div>

                  {/* Brands Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Marcas</Label>
                    <Combobox
                      placeholder="Todas as marcas"
                      options={brands.map((brand) => ({
                        value: brand.id,
                        label: brand.name,
                      }))}
                      value={tempBrandIds}
                      onValueChange={setTempBrandIds}
                      mode="multiple"
                      triggerClassName="h-10"
                    />
                  </div>

                  {/* Suppliers Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fornecedores</Label>
                    <Combobox
                      placeholder="Todos os fornecedores"
                      options={suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.fantasyName || supplier.corporateName || "Sem nome",
                      }))}
                      value={tempSupplierIds}
                      onValueChange={setTempSupplierIds}
                      mode="multiple"
                      triggerClassName="h-10"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Clear temp state
                      setTempShowInactive(false);
                      setTempCategoryIds([]);
                      setTempBrandIds([]);
                      setTempSupplierIds([]);
                    }}
                  >
                    <IconRefresh className="h-3 w-3 mr-1" />
                    Limpar Filtros
                  </Button>
                  <Button
                    onClick={() => {
                      // Apply temp filters to URL state
                      directUpdateFilters({
                        showInactive: tempShowInactive,
                        categoryIds: tempCategoryIds,
                        brandIds: tempBrandIds,
                        supplierIds: tempSupplierIds,
                        page: 1, // Reset page when applying filters
                      });
                      setIsFilterModalOpen(false);
                    }}
                  >
                    Aplicar Filtros
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}
      </div>

      {/* Items Table Section - matching the working table structure exactly */}
      <div className={cn("rounded-lg flex flex-col overflow-hidden", "flex-1")}>
        {/* Fixed Header Table */}
        <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      indeterminate={someCurrentPageSelected && !allCurrentPageSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                      className={cn(someCurrentPageSelected && !allCurrentPageSelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                      disabled={isLoadingItems || items.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
                <TableHead className={cn(TABLE_LAYOUT.firstDataColumn.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <button
                    onClick={() => toggleSort("uniCode")}
                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  >
                    <TruncatedTextWithTooltip text="CÓDIGO" />
                    {renderSortIndicator("uniCode")}
                  </button>
                </TableHead>
                <TableHead className="w-64 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  >
                    <TruncatedTextWithTooltip text="ITEM" />
                    {renderSortIndicator("name")}
                  </button>
                </TableHead>
                <TableHead className="w-32 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <button
                    onClick={() => toggleSort("brand.name")}
                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  >
                    <TruncatedTextWithTooltip text="MARCA" />
                    {renderSortIndicator("brand.name")}
                  </button>
                </TableHead>
                <TableHead className="w-40 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <button
                    onClick={() => toggleSort("category.name")}
                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  >
                    <TruncatedTextWithTooltip text="CATEGORIA" />
                    {renderSortIndicator("category.name")}
                  </button>
                </TableHead>
                <TableHead className="w-28 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <button
                    onClick={() => toggleSort("quantity")}
                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  >
                    <TruncatedTextWithTooltip text="ESTOQUE" />
                    {renderSortIndicator("quantity")}
                  </button>
                </TableHead>
                {showQuantityInput && (
                  <TableHead className="w-32 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
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

        {/* Scrollable Body Table */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
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
            <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableBody>
                {items.map((item, index) => {
                  const itemIsSelected = isSelected(item.id);
                  const quantity = Number(quantities[item.id]) || 1;

                  return (
                    <TableRow
                      key={item.id}
                      data-state={itemIsSelected ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                        // Selected state overrides alternating colors
                        itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                      )}
                      onClick={(e) => {
                        // Only handle row click if not clicking on interactive elements
                        const target = e.target as HTMLElement;
                        // Check if clicking directly on interactive elements
                        if (target.closest('input, button, [role="checkbox"]')) {
                          return;
                        }
                        onSelectItem(item.id, 1);
                      }}
                    >
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={itemIsSelected}
                            onCheckedChange={() => {
                              onSelectItem(item.id, 1);
                            }}
                            aria-label={`Select ${item.name}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                      {/* Código */}
                      <TableCell className={cn(TABLE_LAYOUT.firstDataColumn.className, "p-0 !border-r-0")}>
                        <div className="px-4 py-1">
                          <div className="font-mono text-sm truncate">{item.uniCode || "-"}</div>
                        </div>
                      </TableCell>
                      {/* Nome do Item */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-1">
                          <div className="font-medium truncate">{item.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="w-32 p-0 !border-r-0">
                        <div className="px-4 py-1">
                          <div className="text-sm truncate">{item.brand?.name || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-1">
                          <div className="text-sm truncate">{item.category?.name || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="w-28 p-0 !border-r-0">
                        <div className="px-4 py-1">
                          <StockStatusIndicator item={item} showQuantity={true} className="justify-start" />
                        </div>
                      </TableCell>
                      {showQuantityInput && (
                        <TableCell className="w-32 p-0 !border-r-0" onClick={(e) => e.stopPropagation()}>
                          <div className="px-4 py-1">
                            {itemIsSelected ? (
                              <NaturalFloatInput
                                value={quantity}
                                onChange={(value) => onQuantityChange?.(item.id, value)}
                                min={0.01}
                                max={999999}
                                step={0.01}
                                className="w-full h-8 text-sm"
                              />
                            ) : (
                              <div className="h-8 flex items-center">
                                <span className="text-muted-foreground">-</span>
                              </div>
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
        <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
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
  );
};
