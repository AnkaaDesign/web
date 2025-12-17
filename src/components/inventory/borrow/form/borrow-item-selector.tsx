import React, { useState, useMemo, useRef, useEffect, useCallback, MouseEvent } from "react";
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

interface BorrowItemSelectorProps {
  selectedItems: Set<string>;
  onSelectItem: (itemId: string) => void;
  onSelectAll: () => void;
  className?: string;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  quantities?: Record<string, number>;
  isSelected?: (itemId: string) => boolean;
  showQuantityInput?: boolean;
  // New props for URL state management
  showSelectedOnly?: boolean;
  onShowSelectedOnlyChange?: (value: boolean) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  showInactive?: boolean;
  onShowInactiveChange?: (value: boolean) => void;
  categoryIds?: string[];
  onCategoryIdsChange?: (value: string[]) => void;
  brandIds?: string[];
  onBrandIdsChange?: (value: string[]) => void;
  supplierIds?: string[];
  onSupplierIdsChange?: (value: string[]) => void;
  // Sorting props
  sortConfigs?: Array<{ column: string; direction: "asc" | "desc" }>;
  toggleSort?: (column: string) => void;
  getSortDirection?: (column: string) => "asc" | "desc" | null;
  getSortOrder?: (column: string) => number | null;
  // Pagination props (optional - uses internal pagination if not provided)
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onTotalRecordsChange?: (total: number) => void;
  // Batch selection function - combines both selected items and quantities in one atomic update
  updateSelectedItems?: (items: Set<string>, quantities: Record<string, number>) => void;
}

export const BorrowItemSelector = ({
  selectedItems,
  onSelectItem,
  className,
  onQuantityChange,
  quantities = {},
  isSelected = (itemId: string) => selectedItems.has(itemId),
  showQuantityInput = true,
  // New props with defaults
  showSelectedOnly: showSelectedOnlyProp,
  onShowSelectedOnlyChange,
  searchTerm: searchTermProp,
  onSearchTermChange,
  showInactive: showInactiveProp,
  onShowInactiveChange: _onShowInactiveChange,
  categoryIds: categoryIdsProp,
  onCategoryIdsChange: _onCategoryIdsChange,
  brandIds: brandIdsProp,
  onBrandIdsChange: _onBrandIdsChange,
  supplierIds: supplierIdsProp,
  onSupplierIdsChange: _onSupplierIdsChange,
  // Pagination props
  page: pageProp,
  pageSize: pageSizeProp,
  totalRecords: totalRecordsProp,
  onPageChange,
  onPageSizeChange,
  onTotalRecordsChange,
  // Sorting props
  sortConfigs: sortConfigsProp,
  toggleSort: toggleSortProp,
  getSortDirection: getSortDirectionProp,
  getSortOrder: getSortOrderProp,
  // Batch selection function
  updateSelectedItems,
}: BorrowItemSelectorProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ref to track last clicked item for shift+click range selection
  const lastClickedIdRef = useRef<string | null>(null);

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
  // IMPORTANT: URL state uses 1-based pages, pagination component uses 0-based
  // Keep separate variables for API (1-based) and component (0-based)
  const apiPage = pageProp !== undefined ? pageProp : (localPage + 1); // API always uses 1-based
  const currentPage = pageProp !== undefined ? Math.max(0, pageProp - 1) : localPage; // Component uses 0-based
  const pageSize = pageSizeProp !== undefined ? pageSizeProp : localPageSize;
  const currentTotalRecords = totalRecordsProp || 0;
  // Wrap setPage to convert from 0-based (component) to 1-based (URL state)
  const setPage = onPageChange
    ? (page0Based: number) => onPageChange(Math.max(1, page0Based + 1))
    : setLocalPage;
  const setPageSize = onPageSizeChange || setLocalPageSize;

  // Use sorting from props if provided, otherwise use local table state
  const sortConfigs = sortConfigsProp || localSortConfigs;
  const toggleSort = toggleSortProp || localToggleSort;
  const getSortDirection = getSortDirectionProp || localGetSortDirection;
  const getSortOrder = getSortOrderProp || localGetSortOrder;

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
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
      orderItems: {
        include: {
          order: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  // Use debouncedSearchTerm for API calls to reduce unnecessary requests
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply search and other filters (but keep them in state)
      ...(!showSelectedOnlyProp && {
        searchingFor: debouncedSearchTerm,
      }),
      // Map showInactive to isActive at root level
      ...(!showSelectedOnlyProp && typeof showInactive === "boolean" && { isActive: !showInactive }),
      where: {
        // When showSelectedOnly is true, only filter by selected IDs
        ...(showSelectedOnlyProp && selectedItems.size > 0
          ? {
              id: { in: Array.from(selectedItems) },
              // Still apply TOOL filter even when showing selected only
              category: { type: "TOOL" },
            }
          : {
              // Apply all filters when not showing selected only
              category: { type: "TOOL" },
              ...(categoryIds.length && { categoryId: { in: categoryIds } }),
              ...(brandIds.length && { brandId: { in: brandIds } }),
              ...(supplierIds.length && { supplierId: { in: supplierIds } }),
            }),
      },
      page: apiPage,
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
    }),
    [debouncedSearchTerm, showInactive, categoryIds, brandIds, supplierIds, showSelectedOnlyProp, selectedItems, apiPage, pageSize, includeConfig, sortConfigs],
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

  // Get filter options - only TOOL categories
  const { data: categoriesResponse } = useItemCategories({
    where: { type: "TOOL" },
    orderBy: { name: "asc" },
  });
  const { data: brandsResponse } = useItemBrands({ orderBy: { name: "asc" } });
  const { data: suppliersResponse } = useSuppliers({ orderBy: { name: "asc" } });

  const categories = categoriesResponse?.data || [];
  const brands = brandsResponse?.data || [];
  const suppliers = suppliersResponse?.data || [];

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

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Scroll to top of container
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Get current page item IDs for shift+click range selection
  const currentPageItemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Handle row selection with shift+click support
  const handleRowSelection = useCallback(
    (item: typeof items[0], event?: MouseEvent) => {
      // Calculate available stock
      const activeBorrowsQuantity =
        item.borrows?.reduce((total, borrow) => {
          return borrow.status === "ACTIVE" ? total + borrow.quantity : total;
        }, 0) || 0;
      const availableStock = item.quantity - activeBorrowsQuantity;

      // Don't allow selection of items without stock
      if (availableStock <= 0) return;

      // Shift+click: select range of items
      if (event?.shiftKey && lastClickedIdRef.current) {
        const lastIndex = currentPageItemIds.indexOf(lastClickedIdRef.current);
        const currentIndex = currentPageItemIds.indexOf(item.id);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = currentPageItemIds.slice(start, end + 1);

          // Select all items in range that are not already selected (and have stock)
          rangeIds.forEach((id) => {
            if (!selectedItems.has(id)) {
              const rangeItem = items.find((i) => i.id === id);
              if (rangeItem) {
                const rangeActiveBorrows =
                  rangeItem.borrows?.reduce((total, borrow) => {
                    return borrow.status === "ACTIVE" ? total + borrow.quantity : total;
                  }, 0) || 0;
                const rangeAvailableStock = rangeItem.quantity - rangeActiveBorrows;
                if (rangeAvailableStock > 0) {
                  onSelectItem(id);
                }
              }
            }
          });
        }
      } else {
        // Regular click: toggle single item
        onSelectItem(item.id);
      }

      // Always update last clicked ID
      lastClickedIdRef.current = item.id;
    },
    [selectedItems, currentPageItemIds, items, onSelectItem]
  );

  // Check if all current page items are selected
  const allPageItemsSelected = items.length > 0 && items.every((item) => isSelected(item.id));
  const somePageItemsSelected = items.some((item) => isSelected(item.id));

  // Handle select all on current page
  const handleSelectAllPage = () => {
    // Calculate available stock for filtering
    const itemsWithStock = items.map((item) => {
      const activeBorrowsQuantity =
        item.borrows?.reduce((total, borrow) => {
          return borrow.status === "ACTIVE" ? total + borrow.quantity : total;
        }, 0) || 0;
      return {
        id: item.id,
        availableStock: item.quantity - activeBorrowsQuantity,
      };
    });

    // Use batch update function if available for atomic state update
    if (updateSelectedItems) {
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };

      if (allPageItemsSelected) {
        // Deselect all on current page
        items.forEach((item) => {
          if (newSelected.has(item.id)) {
            newSelected.delete(item.id);
            delete newQuantities[item.id];
          }
        });
      } else {
        // Select all on current page - only items with available stock
        itemsWithStock.forEach(({ id, availableStock }) => {
          if (!newSelected.has(id) && availableStock > 0) {
            newSelected.add(id);
            newQuantities[id] = quantities[id] || 1;
          }
        });
      }

      // Single atomic update - pass both selected items and quantities
      updateSelectedItems(newSelected, newQuantities);
    } else {
      // Fallback to old behavior if batch function not provided
      if (allPageItemsSelected) {
        // Deselect all on current page
        items.forEach((item) => {
          if (isSelected(item.id)) {
            onSelectItem(item.id);
          }
        });
      } else {
        // Select all on current page - only items with available stock
        itemsWithStock.forEach(({ id, availableStock }) => {
          if (!isSelected(id) && availableStock > 0) {
            onSelectItem(id);
          }
        });
      }
    }
  };

  // Calculate available stock for each item
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

  // Render sort icon
  const renderSortIcon = (column: string) => {
    const sortDirection = getSortDirection(column);
    const sortOrder = getSortOrder(column);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

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

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search and Filters Section */}
      <div className="space-y-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, código, marca ou categoria..."
              value={searchTerm}
              onChange={(e) => {
                const value = e?.target?.value ?? e ?? '';
                handleSearch(value);
              }}
              className="pl-10 bg-transparent"
            />
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
        {hasActiveFilters && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}
      </div>

      {/* Items Table Section */}
      <div className="flex-1 min-h-0">
        <div className={cn("rounded-lg flex flex-col overflow-hidden h-full")}>
          {/* Fixed Header Table */}
          <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
            <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allPageItemsSelected}
                        indeterminate={somePageItemsSelected && !allPageItemsSelected}
                        onCheckedChange={handleSelectAllPage}
                        aria-label="Select all items"
                        className={cn(somePageItemsSelected && !allPageItemsSelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                        disabled={isLoadingItems || items.length === 0}
                        data-checkbox
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-28 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <button
                      onClick={() => toggleSort("uniCode")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <TruncatedTextWithTooltip text="CÓDIGO" />
                      {renderSortIcon("uniCode")}
                    </button>
                  </TableHead>
                  <TableHead className="w-64 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <TruncatedTextWithTooltip text="ITEM" />
                      {renderSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead className="w-24 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <button
                      onClick={() => toggleSort("brand.name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <TruncatedTextWithTooltip text="MARCA" />
                      {renderSortIcon("brand.name")}
                    </button>
                  </TableHead>
                  <TableHead className="w-32 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <button
                      onClick={() => toggleSort("category.name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <TruncatedTextWithTooltip text="CATEGORIA" />
                      {renderSortIcon("category.name")}
                    </button>
                  </TableHead>
                  <TableHead className="w-24 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <button
                      onClick={() => toggleSort("quantity")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <TruncatedTextWithTooltip text="ESTOQUE" />
                      {renderSortIcon("quantity")}
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
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
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
                  {itemsWithAvailableStock.map((item, index) => {
                    const itemIsSelected = isSelected(item.id);
                    const quantity = quantities[item.id] || 1;
                    const hasStock = item.availableStock > 0;

                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          "transition-colors border-b border-border",
                          hasStock ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                          index % 2 === 1 && "bg-muted/10",
                          hasStock && "hover:bg-muted/20",
                          itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                        )}
                        onClick={(e) => hasStock && handleRowSelection(item, e)}
                      >
                        <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                          <div
                            className="flex items-center justify-center h-full w-full px-2 py-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasStock) handleRowSelection(item, e as unknown as MouseEvent<HTMLTableRowElement>);
                            }}
                          >
                            <Checkbox
                              checked={itemIsSelected}
                              aria-label={`Select ${item.name}`}
                              disabled={!hasStock}
                              data-checkbox
                            />
                          </div>
                        </TableCell>
                        {/* Código */}
                        <TableCell className="w-28 p-0 !border-r-0">
                          <div className="px-4 py-1">
                            <div className="font-mono text-sm">{item.uniCode || "-"}</div>
                          </div>
                        </TableCell>
                        {/* Nome do Item */}
                        <TableCell className="w-64 p-0 !border-r-0">
                          <div className="px-4 py-1">
                            <div className="font-medium truncate">{item.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="w-24 p-0 !border-r-0">
                          <div className="px-4 py-1">
                            <div className="text-sm truncate">{item.brand?.name || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="w-32 p-0 !border-r-0">
                          <div className="px-4 py-1">
                            <div className="text-sm truncate">{item.category?.name || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="w-24 p-0 !border-r-0">
                          <div className="px-4 py-1">
                            <StockStatusIndicator item={item} showQuantity={true} className="justify-start" />
                          </div>
                        </TableCell>
                        {showQuantityInput && (
                          <TableCell className="w-24 p-0 !border-r-0" onClick={(e) => e.stopPropagation()}>
                            <div className="px-4 py-1">
                              {itemIsSelected ? (
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.availableStock}
                                  step="1"
                                  value={quantity}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const inputValue = e.target.value;

                                    // If empty, don't update (will be handled on blur)
                                    if (inputValue === "") {
                                      return;
                                    }

                                    const numericValue = parseInt(inputValue, 10);

                                    // If invalid, don't update
                                    if (isNaN(numericValue) || numericValue < 1) {
                                      return;
                                    }

                                    // Ensure quantity doesn't exceed available stock
                                    const validQuantity = Math.min(numericValue, item.availableStock);
                                    onQuantityChange?.(item.id, validQuantity);
                                  }}
                                  onBlur={(e) => {
                                    const inputValue = e.target.value;
                                    const numericValue = parseInt(inputValue, 10);

                                    // If empty or invalid, default to 1
                                    if (inputValue === "" || isNaN(numericValue) || numericValue < 1) {
                                      onQuantityChange?.(item.id, 1);
                                    } else {
                                      // Ensure it's within bounds
                                      const validQuantity = Math.min(numericValue, item.availableStock);
                                      onQuantityChange?.(item.id, validQuantity);
                                    }
                                  }}
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
              onPageChange={handlePageChange}
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
  );
};
