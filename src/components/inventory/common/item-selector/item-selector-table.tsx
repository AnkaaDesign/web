import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

import { IconFilter, IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { useItems, useItemCategories, useItemBrands, useSuppliers, useCanViewPrices } from "../../../../hooks";
import { formatCurrency } from "../../../../utils";
import type { OrderTemporaryItem } from "@/hooks/inventory/use-order-form-url-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { useDebounce } from "@/hooks/common/use-debounce";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import type { Item } from "../../../../types";
import type { ItemGetManyFormData } from "../../../../schemas";
import type {
  ItemSelectorTableProps,
  ItemSelectorContext,
} from "./item-selector-types";
import { createItemSelectorColumns, getDefaultVisibleColumns } from "./item-selector-columns";
import { ItemSelectorFilters } from "./item-selector-filters";
import { ItemSelectorColumnVisibility } from "./item-selector-column-visibility";
import { FilterIndicators } from "./item-selector-filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./item-selector-filter-utils";

/**
 * Shared Item Selector Table Component
 *
 * A comprehensive, reusable table for selecting items across multiple forms.
 * Features:
 * - Full filter system (matching main item list)
 * - Column visibility with fixed columns support
 * - Editable fields (quantity, price, ICMS, IPI)
 * - Pagination, sorting, selection
 * - Show selected only toggle
 * - URL state management support
 */
export const ItemSelectorTable: React.FC<ItemSelectorTableProps> = ({
  selectedItems,
  onSelectItem,
  onBatchSelectItems,
  className,
  quantities = {},
  prices = {},
  icmses = {},
  ipis = {},
  onQuantityChange,
  onPriceChange,
  onIcmsChange,
  onIpiChange,
  editableColumns,
  fixedColumnsConfig,
  storageKey,
  defaultColumns,
  additionalFilters = {},
  enableAdvancedFilters: _enableAdvancedFilters = true,
  // State management props
  page: pageProp,
  pageSize: pageSizeProp,
  showSelectedOnly: showSelectedOnlyProp,
  searchTerm: searchTermProp,
  filters: filtersProp,
  onPageChange,
  onPageSizeChange,
  onShowSelectedOnlyChange,
  onSearchTermChange,
  onFiltersChange,
  enableTemporaryItems = false,
  temporaryItems = [],
  onTemporaryItemAdd,
  onTemporaryItemUpdate,
  onTemporaryItemRemove,
  cycleDays,
}) => {
  const canViewPrices = useCanViewPrices();

  // Local state for immediate UI updates
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTermProp || "");
  const [localFilters, setLocalFilters] = useState<Partial<ItemGetManyFormData>>(filtersProp || {});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Ref to track last clicked item for shift+click range selection
  const lastClickedIdRef = useRef<string | null>(null);

  // Sync prop changes to local state
  useEffect(() => {
    if (searchTermProp !== undefined) {
      setLocalSearchTerm(searchTermProp);
    }
  }, [searchTermProp]);

  useEffect(() => {
    if (filtersProp) {
      setLocalFilters(filtersProp);
    }
  }, [filtersProp]);

  // Debounced search term for API calls
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

  // Table state
  const {
    page: localPage,
    pageSize: localPageSize,
    sortConfigs: localSortConfigs,
    setPage: setLocalPage,
    setPageSize: setLocalPageSize,
    toggleSort: localToggleSort,
    getSortDirection: localGetSortDirection,
    getSortOrder: localGetSortOrder,
    showSelectedOnly: localShowSelectedOnly,
    toggleShowSelectedOnly: localToggleShowSelectedOnly,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Use props if provided, otherwise fall back to local state
  const currentPage = pageProp !== undefined ? Math.max(0, pageProp - 1) : localPage;
  const pageSize = pageSizeProp !== undefined ? pageSizeProp : localPageSize;
  const showSelectedOnly = showSelectedOnlyProp !== undefined ? showSelectedOnlyProp : localShowSelectedOnly;
  const setPage = onPageChange ? (page0Based: number) => onPageChange(Math.max(1, page0Based + 1)) : setLocalPage;
  const setPageSize = onPageSizeChange || setLocalPageSize;
  // Wrap onShowSelectedOnlyChange to convert from setter (value) => void to toggler () => void
  const toggleShowSelectedOnly = onShowSelectedOnlyChange
    ? (newValue?: boolean) => onShowSelectedOnlyChange(newValue !== undefined ? newValue : !showSelectedOnly)
    : localToggleShowSelectedOnly;
  const sortConfigs = localSortConfigs;
  const toggleSort = localToggleSort;
  const getSortDirection = localGetSortDirection;
  const getSortOrder = localGetSortOrder;

  // Column visibility
  const defaultVisibleColumns = useMemo(() => {
    if (defaultColumns && defaultColumns.length > 0) {
      // Use explicit default columns from prop
      const defaults = new Set(defaultColumns);
      // Always ensure checkbox is included
      defaults.add('checkbox');
      // Add editable columns if enabled
      if (editableColumns?.showQuantityInput) defaults.add('quantityInput');
      if (editableColumns?.showPriceInput) defaults.add('priceInput');
      if (editableColumns?.showIcmsInput) defaults.add('icmsInput');
      if (editableColumns?.showIpiInput) defaults.add('ipiInput');
      return defaults;
    }
    // Fall back to automatic defaults
    return getDefaultVisibleColumns(editableColumns);
  }, [defaultColumns, editableColumns]);

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(storageKey, defaultVisibleColumns);

  // Create context ref and update it during render (not in useEffect) to avoid stale state
  const contextRef = useRef<ItemSelectorContext>({
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    onQuantityChange,
    onPriceChange,
    onIcmsChange,
    onIpiChange,
    onSelectItem,
    isSelected: (itemId: string) => selectedItems.has(itemId),
  });

  // Update context ref DURING render (before column accessors run)
  // This ensures column accessors always see the latest state
  contextRef.current = {
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    onQuantityChange,
    onPriceChange,
    onIcmsChange,
    onIpiChange,
    onSelectItem,
    isSelected: (itemId: string) => selectedItems.has(itemId),
  };

  // Column keys that expose monetary information (hidden from warehouse users)
  const PRICE_COLUMN_KEYS = useMemo(() => new Set(["price", "totalPrice", "orderSubtotal", "priceInput", "icmsInput", "ipiInput"]), []);

  const allColumns = useMemo(() => {
    const cols = createItemSelectorColumns(editableColumns, contextRef.current, { cycleDays });
    if (canViewPrices) return cols;
    return cols.filter((col) => !PRICE_COLUMN_KEYS.has(col.key));
  }, [editableColumns, cycleDays, canViewPrices, PRICE_COLUMN_KEYS]);

  // Filter columns by visibility
  const displayColumns = useMemo(() => {
    return allColumns.filter((col) => visibleColumns.has(col.key));
  }, [allColumns, visibleColumns]);

  // Memoize include configuration
  const includeConfig = useMemo(
    () => ({
      brands: true,
      category: true,
      supplier: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    }),
    []
  );

  // Build query parameters
  const queryParams = useMemo(() => {
    // If showing only selected items but none are selected, return a query that returns nothing
    if (showSelectedOnly && selectedItems.size === 0) {
      return {
        where: { id: { in: [] } }, // Empty array will return no results
        page: 1,
        limit: pageSize,
        include: includeConfig,
      };
    }

    // Extract where clause from additionalFilters to handle separately
    const { where: additionalWhere, ...additionalFiltersRest } = additionalFilters;

    // "Ver selecionados" mode: show EVERY currently-selected item, regardless of
    // active status or any browsing filter. Otherwise a selected item that is
    // inactive (or excluded by a category/brand/etc. filter) can never be shown,
    // so the user can't unselect it — yet save is blocked while it stays selected.
    if (showSelectedOnly) {
      return {
        where: { id: { in: Array.from(selectedItems) } },
        page: currentPage + 1,
        limit: pageSize,
        include: includeConfig,
        ...(sortConfigs.length > 0 && {
          orderBy: convertSortConfigsToOrderBy(sortConfigs),
        }),
      };
    }

    const baseParams: any = {
      searchingFor: debouncedSearchTerm,
      where: {
        // Apply additional filters FIRST (e.g., category type filter for borrow)
        ...(additionalWhere || {}),
        // Then apply local filters
        // Status filter is stored as isActive (the drawer maps "Ativo"→true, "Inativo"→false,
        // "Ambos"→absent). Only apply it when explicitly set so "Ambos" returns both active and
        // inactive items. (showInactive is not reliably emitted by the drawer, so don't read it.)
        ...(typeof localFilters.isActive === "boolean" && { isActive: localFilters.isActive }),
        ...(localFilters.categoryIds?.length && { categoryId: { in: localFilters.categoryIds } }),
        ...(localFilters.brandIds?.length && { brands: { some: { id: { in: localFilters.brandIds } } } }),
        ...(localFilters.supplierIds?.length && { supplierId: { in: localFilters.supplierIds } }),
        ...(localFilters.where || {}),
      },
      page: currentPage + 1,
      limit: pageSize,
      include: includeConfig,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Apply non-where additional filters
      ...additionalFiltersRest,
    };

    // Apply other filter types
    if (localFilters.stockLevels) baseParams.stockLevels = localFilters.stockLevels;
    if (localFilters.quantityRange) baseParams.quantityRange = localFilters.quantityRange;
    if (localFilters.totalPriceRange) baseParams.totalPriceRange = localFilters.totalPriceRange;
    if (localFilters.icmsRange) baseParams.icmsRange = localFilters.icmsRange;
    if (localFilters.ipiRange) baseParams.ipiRange = localFilters.ipiRange;
    if (localFilters.monthlyConsumptionRange) baseParams.monthlyConsumptionRange = localFilters.monthlyConsumptionRange;
    if (localFilters.createdAt) baseParams.createdAt = localFilters.createdAt;
    if (localFilters.updatedAt) baseParams.updatedAt = localFilters.updatedAt;

    return baseParams;
  }, [
    debouncedSearchTerm,
    showSelectedOnly,
    selectedItems,
    localFilters,
    currentPage,
    pageSize,
    includeConfig,
    sortConfigs,
    additionalFilters,
  ]);

  // Fetch items
  const { data: itemsResponse, isLoading } = useItems(queryParams);

  const items = itemsResponse?.data || [];
  const totalRecords = itemsResponse?.meta?.totalRecords || 0;
  const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 1;

  // Get filter options for display
  const { data: categoriesResponse } = useItemCategories({ orderBy: { name: "asc" } });
  const { data: brandsResponse } = useItemBrands({ orderBy: { name: "asc" } });
  const { data: suppliersResponse } = useSuppliers({ orderBy: { fantasyName: "asc" } });

  const categories = categoriesResponse?.data || [];
  const brands = brandsResponse?.data || [];
  const suppliers = suppliersResponse?.data || [];

  // Temporary items store the ItemCategory id (persisted as temporaryItemCategoryId).
  // The combobox value is the category id; the label resolves via categoryNameById.
  // Brand stays a plain NAME string (temporaryItemBrand).
  const tempCategoryOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories]);
  const tempBrandOptions = useMemo(() => brands.map((b) => ({ value: b.name, label: b.name })), [brands]);
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Handle search change
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearchTerm(value);
      if (onSearchTermChange) {
        onSearchTermChange(value);
      }
    },
    [onSearchTermChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (newFilters: Partial<ItemGetManyFormData>) => {
      setLocalFilters(newFilters);
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      }
      // Reset to first page when filters change
      setPage(0);
    },
    [onFiltersChange, setPage]
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(localFilters, handleFilterChange);

  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        handleSearchChange("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, handleSearchChange]
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...localFilters,
      searchingFor: debouncedSearchTerm || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      categories,
      brands,
      suppliers,
    });
  }, [localFilters, debouncedSearchTerm, categories, brands, suppliers, onRemoveFilter]);

  const hasActiveFilters = activeFilters.length > 0;

  // Get current page item IDs for shift+click range selection
  const currentPageItemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Handle row click (selection) with shift+click support
  const handleRowClick = useCallback(
    (item: Item, event?: MouseEvent<HTMLElement>) => {
      const isAlreadySelected = selectedItems.has(item.id);

      // Shift+click: select range of items
      if (event?.shiftKey && lastClickedIdRef.current) {
        event.preventDefault(); // Prevent text selection
        const lastIndex = currentPageItemIds.indexOf(lastClickedIdRef.current);
        const currentIndex = currentPageItemIds.indexOf(item.id);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = currentPageItemIds.slice(start, end + 1);

          // Filter out already selected items
          const idsToSelect = rangeIds.filter((id) => !selectedItems.has(id));

          if (idsToSelect.length > 0) {
            // If batch handler is provided, use it for better performance
            if (onBatchSelectItems) {
              const itemData: Record<string, { quantity?: number; price?: number; icms?: number; ipi?: number }> = {};
              idsToSelect.forEach((id) => {
                const rangeItem = items.find((i) => i.id === id);
                if (rangeItem) {
                  // Don't pass quantity - let it use defaultQuantity
                  // Only pass price, icms, ipi from the item
                  itemData[id] = {
                    quantity: undefined,
                    price: rangeItem.prices?.[0]?.value,
                    icms: rangeItem.icms,
                    ipi: rangeItem.ipi,
                  };
                }
              });
              onBatchSelectItems(idsToSelect, itemData);
            } else {
              // Fallback: call onSelectItem for each (may have stale closure issues)
              idsToSelect.forEach((id) => {
                const rangeItem = items.find((i) => i.id === id);
                if (rangeItem) {
                  // Don't pass quantity - let it use defaultQuantity
                  // Only pass price, icms, ipi from the item
                  onSelectItem(
                    id,
                    undefined,
                    rangeItem.prices?.[0]?.value,
                    rangeItem.icms,
                    rangeItem.ipi
                  );
                }
              });
            }
          }

          // Update last clicked to the current item (end of range)
          lastClickedIdRef.current = item.id;
        }
      } else {
        // Regular click: toggle single item
        if (isAlreadySelected) {
          // Item is already selected - call without parameters to trigger deselection
          onSelectItem(item.id);
        } else {
          // Item is not selected - pass price, icms, ipi from item data
          // Don't pass quantity - let it use defaultQuantity
          const price = item.prices?.[0]?.value;
          const icms = item.icms;
          const ipi = item.ipi;
          onSelectItem(item.id, undefined, price, icms, ipi);
        }
        // Update last clicked ID for future shift-clicks
        lastClickedIdRef.current = item.id;
      }
    },
    [onSelectItem, onBatchSelectItems, currentPageItemIds, items, selectedItems]
  );

  // Handle select all on current page
  const handleSelectAllOnPage = useCallback(() => {
    if (items.length === 0) return;

    const allSelected = items.every((item) => selectedItems.has(item.id));
    if (allSelected) {
      // Deselect all on current page - call without parameters
      items.forEach((item) => onSelectItem(item.id));
    } else {
      // Select all on current page
      // Don't pass quantity - let it use defaultQuantity
      // Only pass price, icms, ipi from the item
      items.forEach((item) => {
        if (!selectedItems.has(item.id)) {
          const price = item.prices?.[0]?.value;
          const icms = item.icms;
          const ipi = item.ipi;
          onSelectItem(item.id, undefined, price, icms, ipi);
        }
      });
    }
  }, [items, selectedItems, onSelectItem]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setLocalFilters({});
    setLocalSearchTerm("");
    if (onFiltersChange) {
      onFiltersChange({});
    }
    if (onSearchTermChange) {
      onSearchTermChange("");
    }
  }, [onFiltersChange, onSearchTermChange]);

  // Fixed columns configuration
  const fixedColumns = useMemo(() => {
    const fixed = ["checkbox", ...(fixedColumnsConfig?.fixedColumns || [])];
    // Always include editable columns as fixed
    if (editableColumns?.showQuantityInput) fixed.push("quantityInput");
    if (editableColumns?.showPriceInput) fixed.push("priceInput");
    return fixed;
  }, [fixedColumnsConfig, editableColumns]);

  // Check if all items on current page are selected
  const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item.id));
  const partiallySelected = items.some((item) => selectedItems.has(item.id)) && !allSelected;

  // ===== Sticky temporary-item entry row state =====
  // Local form for the always-visible "add a temporary item" row at the top of the body.
  // Once committed (Enter or +Add), the row is appended to the parent's temporaryItems list.
  // Includes optional metadata (uniCode/brand/category/measures) — when filled,
  // they get composed into the final description by the parent at submit time.
  const initialTempDraft = {
    description: "",
    uniCode: "",
    brand: "",
    categoryId: "",
    measures: "",
    quantity: 1,
    price: 0,
    icms: 0,
    ipi: 0,
  };
  const [tempDraft, setTempDraft] = useState(initialTempDraft);
  const tempDescriptionInputRef = useRef<HTMLInputElement>(null);

  const resetTempDraft = useCallback(() => {
    setTempDraft(initialTempDraft);
  }, []);

  const commitTempDraft = useCallback(() => {
    const description = tempDraft.description.trim();
    if (!description || tempDraft.quantity <= 0) {
      return;
    }
    onTemporaryItemAdd?.({
      temporaryItemDescription: description,
      orderedQuantity: tempDraft.quantity,
      price: tempDraft.price,
      icms: tempDraft.icms,
      ipi: tempDraft.ipi,
      uniCode: tempDraft.uniCode.trim() || undefined,
      brand: tempDraft.brand.trim() || undefined,
      categoryId: tempDraft.categoryId || undefined,
      categoryName: tempDraft.categoryId ? categoryNameById.get(tempDraft.categoryId) : undefined,
      measures: tempDraft.measures.trim() || undefined,
    });
    resetTempDraft();
    // Re-focus the description input so the user can keep typing more items quickly.
    setTimeout(() => tempDescriptionInputRef.current?.focus(), 0);
  }, [tempDraft, onTemporaryItemAdd, resetTempDraft, categoryNameById]);

  const handleTempKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitTempDraft();
      }
    },
    [commitTempDraft],
  );

  const tempInputBaseClass = "h-8 w-full bg-transparent border-border";

  // Cell renderer for the sticky entry-row draft. Falls back to em-dash for
  // inventory-only columns (stock, consumption, catalog price, etc.).
  const renderEntryCell = (columnKey: string): ReactNode => {
    switch (columnKey) {
      case "uniCode":
        return (
          <Input
            value={tempDraft.uniCode}
            onChange={(value) => setTempDraft((prev) => ({ ...prev, uniCode: (value as string) ?? "" }))}
            onKeyDown={handleTempKeyDown}
            placeholder="Código"
            className={tempInputBaseClass}
            maxLength={50}
          />
        );
      case "name":
        return (
          <Input
            ref={tempDescriptionInputRef}
            value={tempDraft.description}
            onChange={(value) => setTempDraft((prev) => ({ ...prev, description: (value as string) ?? "" }))}
            onKeyDown={handleTempKeyDown}
            placeholder="Adicionar item temporário (descrição)…"
            className={tempInputBaseClass}
            maxLength={500}
          />
        );
      case "brand.name":
        return (
          <Combobox
            options={tempBrandOptions}
            value={tempDraft.brand}
            onValueChange={(value) => setTempDraft((prev) => ({ ...prev, brand: (value as string) ?? "" }))}
            placeholder="Marca"
            emptyText="Nenhuma marca encontrada"
            searchPlaceholder="Buscar marca..."
            clearable
            minSearchLength={0}
            triggerClassName={tempInputBaseClass}
          />
        );
      case "category.name":
        return (
          <Combobox
            options={tempCategoryOptions}
            value={tempDraft.categoryId}
            onValueChange={(value) => setTempDraft((prev) => ({ ...prev, categoryId: (value as string) ?? "" }))}
            placeholder="Categoria"
            emptyText="Nenhuma categoria encontrada"
            searchPlaceholder="Buscar categoria..."
            clearable
            minSearchLength={0}
            triggerClassName={tempInputBaseClass}
          />
        );
      case "measures":
        return (
          <Input
            value={tempDraft.measures}
            onChange={(value) => setTempDraft((prev) => ({ ...prev, measures: (value as string) ?? "" }))}
            onKeyDown={handleTempKeyDown}
            placeholder="Medidas"
            className={tempInputBaseClass}
            maxLength={100}
          />
        );
      case "quantityInput":
        return (
          <Input
            type="decimal"
            min={0.01}
            max={999999}
            step={0.01}
            value={tempDraft.quantity || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              setTempDraft((prev) => ({ ...prev, quantity: Number.isFinite(n) ? n : 0 }));
            }}
            onKeyDown={handleTempKeyDown}
            className={tempInputBaseClass}
          />
        );
      case "priceInput":
        return (
          <Input
            type="currency"
            decimals={3}
            value={tempDraft.price || undefined}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              setTempDraft((prev) => ({ ...prev, price: Number.isFinite(n) ? n : 0 }));
            }}
            onKeyDown={handleTempKeyDown}
            placeholder="R$ 0,000"
            className={tempInputBaseClass}
          />
        );
      case "icmsInput":
        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={tempDraft.icms || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              setTempDraft((prev) => ({ ...prev, icms: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 }));
            }}
            onKeyDown={handleTempKeyDown}
            className={tempInputBaseClass}
          />
        );
      case "ipiInput":
        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={tempDraft.ipi || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              setTempDraft((prev) => ({ ...prev, ipi: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 }));
            }}
            onKeyDown={handleTempKeyDown}
            className={tempInputBaseClass}
          />
        );
      case "orderSubtotal": {
        const subtotal = tempDraft.quantity * tempDraft.price;
        const total = subtotal + (subtotal * (tempDraft.icms / 100)) + (subtotal * (tempDraft.ipi / 100));
        if (total === 0) return <span className="text-muted-foreground">—</span>;
        return <span className="font-semibold">{formatCurrency(total)}</span>;
      }
      default:
        return <span className="text-muted-foreground">—</span>;
    }
  };

  // Cell renderer for an already-added temp row.
  const renderTempCell = (columnKey: string, temp: OrderTemporaryItem): ReactNode => {
    switch (columnKey) {
      case "uniCode":
        return (
          <Input
            value={temp.uniCode || ""}
            onChange={(value) => onTemporaryItemUpdate?.(temp.key, { uniCode: ((value as string) || "").trim() || undefined })}
            placeholder="Código"
            className={tempInputBaseClass}
            maxLength={50}
          />
        );
      case "name":
        return (
          <Input
            value={temp.temporaryItemDescription}
            onChange={(value) => onTemporaryItemUpdate?.(temp.key, { temporaryItemDescription: (value as string) ?? "" })}
            placeholder="Descrição do item"
            className={tempInputBaseClass}
            maxLength={500}
          />
        );
      case "brand.name":
        return (
          <Combobox
            options={tempBrandOptions}
            value={temp.brand || ""}
            onValueChange={(value) => onTemporaryItemUpdate?.(temp.key, { brand: ((value as string) || "").trim() || undefined })}
            placeholder="Marca"
            emptyText="Nenhuma marca encontrada"
            searchPlaceholder="Buscar marca..."
            clearable
            minSearchLength={0}
            triggerClassName={tempInputBaseClass}
          />
        );
      case "category.name":
        return (
          <Combobox
            options={tempCategoryOptions}
            value={temp.categoryId || ""}
            onValueChange={(value) =>
              onTemporaryItemUpdate?.(temp.key, {
                categoryId: (value as string) || undefined,
                categoryName: value ? categoryNameById.get(value as string) : undefined,
              })
            }
            placeholder="Categoria"
            emptyText="Nenhuma categoria encontrada"
            searchPlaceholder="Buscar categoria..."
            clearable
            minSearchLength={0}
            triggerClassName={tempInputBaseClass}
          />
        );
      case "measures":
        return (
          <Input
            value={temp.measures || ""}
            onChange={(value) => onTemporaryItemUpdate?.(temp.key, { measures: ((value as string) || "").trim() || undefined })}
            placeholder="Medidas"
            className={tempInputBaseClass}
            maxLength={100}
          />
        );
      case "quantityInput":
        return (
          <Input
            type="decimal"
            min={0.01}
            max={999999}
            step={0.01}
            value={temp.orderedQuantity || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              onTemporaryItemUpdate?.(temp.key, { orderedQuantity: Number.isFinite(n) ? n : 0 });
            }}
            className={tempInputBaseClass}
          />
        );
      case "priceInput":
        return (
          <Input
            type="currency"
            decimals={3}
            value={temp.price || undefined}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              onTemporaryItemUpdate?.(temp.key, { price: Number.isFinite(n) ? n : 0 });
            }}
            placeholder="R$ 0,000"
            className={tempInputBaseClass}
          />
        );
      case "icmsInput":
        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={temp.icms || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              onTemporaryItemUpdate?.(temp.key, { icms: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 });
            }}
            className={tempInputBaseClass}
          />
        );
      case "ipiInput":
        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={temp.ipi || ""}
            onChange={(value) => {
              const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
              onTemporaryItemUpdate?.(temp.key, { ipi: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 });
            }}
            className={tempInputBaseClass}
          />
        );
      case "orderSubtotal": {
        const subtotal = (Number(temp.orderedQuantity) || 0) * (Number(temp.price) || 0);
        const total = subtotal + (subtotal * (temp.icms / 100)) + (subtotal * (temp.ipi / 100));
        return <span className="font-semibold">{formatCurrency(total)}</span>;
      }
      default:
        return <span className="text-muted-foreground">—</span>;
    }
  };

  // Render sort indicator
  const renderSortIndicator = (columnKey: string) => {
    const direction = getSortDirection(columnKey);
    const order = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {direction === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {order !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{order + 1}</span>}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Fixed: Search and controls */}
      <div className="flex-shrink-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={localSearchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar por nome, código, código de barras..."
            isPending={localSearchTerm !== debouncedSearchTerm}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectedItems.size}
            />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setIsFilterModalOpen(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
            <ItemSelectorColumnVisibility
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              fixedColumns={fixedColumns}
              defaultColumns={defaultVisibleColumns}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {hasActiveFilters && (
          <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />
        )}
      </div>

      {/* Table with sticky header, scrollable body, fixed footer.
          Single <table> with `position: sticky` thead — eliminates the dual-
          table column-width drift that plagued the previous architecture. */}
      <div className="flex-1 min-h-0 mt-4">
        <div className={cn("rounded-lg flex flex-col overflow-hidden h-full", TABLE_LAYOUT.tableLayout)}>
          {/* Single scroll container holding the whole table. The thead inside
              is `position: sticky; top: 0;` so it stays pinned while the
              tbody scrolls underneath. Because header and body share the same
              <table>, every column has exactly one width — no cross-table
              drift. */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden border border-border rounded-t-lg">
            <Table className="w-full table-fixed border-separate border-spacing-0 [&>div]:border-0 [&>div]:rounded-none">
              {/* Single source of truth for column widths — applies to every
                  row in the table at once, so checkbox, header, sticky +/X,
                  and body rows can never drift. Browsers ignore per-cell
                  width hints when a <colgroup> exists. The trailing <col />
                  has no explicit width so it absorbs leftover space (data
                  columns stay at exactly their declared widths). */}
              <colgroup>
                <col style={{ width: 48 }} />
                {displayColumns.filter(col => col.key !== 'checkbox').map(col => {
                  // Extract width from Tailwind w-N class (e.g. "w-28" → 112px)
                  const match = col.className?.match(/(?:^|\s)w-(\d+)(?:\s|$)/);
                  const width = match ? parseInt(match[1], 10) * 4 : undefined;
                  return <col key={col.key} style={width ? { width } : undefined} />;
                })}
              </colgroup>
              <TableHeader className="sticky top-0 z-20 [&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  {/* Checkbox column — absolute-positioned 16×16 box at
                      exactly left:16, vertically centered. Bypasses ALL
                      flex/padding/border layout interactions; the box's
                      X position is determined SOLELY by the inline `left`
                      style. Identical positioning is hard-coded in all four
                      checkbox cells (header / sticky / pinned / body). */}
                  <TableHead
                    style={{ width: 48, minWidth: 48, maxWidth: 48, padding: 0, position: "relative", height: 40 }}
                    className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0"
                  >
                    <div
                      className="absolute cursor-pointer"
                      style={{ left: 0, top: 0, right: 0, bottom: 0 }}
                      onClick={() => {
                        if (!isLoading && items.length > 0) handleSelectAllOnPage();
                      }}
                    >
                      <div
                        role="checkbox"
                        aria-checked={partiallySelected ? "mixed" : allSelected}
                        aria-label="Select all items"
                        aria-disabled={isLoading || items.length === 0}
                        tabIndex={0}
                        style={{
                          position: "absolute",
                          left: 16,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 16,
                          height: 16,
                          boxSizing: "border-box",
                        }}
                        className={cn(
                          "rounded-sm border transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          allSelected || partiallySelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-transparent hover:border-primary/50",
                          (isLoading || items.length === 0) && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {(allSelected || partiallySelected) && (
                          <svg
                            className="h-full w-full"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            {partiallySelected ? (
                              <path
                                d="M4 7.5 H11"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            ) : (
                              <path
                                d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                strokeWidth={3}
                              />
                            )}
                          </svg>
                        )}
                      </div>
                    </div>
                  </TableHead>

                  {/* Data columns */}
                  {displayColumns.filter(col => col.key !== 'checkbox').map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0",
                        column.className
                      )}
                    >
                      {column.sortable ? (
                        <button
                          onClick={() => toggleSort(column.key)}
                          className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                          disabled={isLoading || items.length === 0}
                        >
                          {column.header}
                          {renderSortIndicator(column.key)}
                        </button>
                      ) : (
                        <div className="px-4 py-2">
                          {column.header}
                        </div>
                      )}
                    </TableHead>
                  ))}

                </TableRow>
              </TableHeader>
              <TableBody>
                {enableTemporaryItems && (
                  <>
                    {/* Sticky temporary-item entry row — uses the same per-column
                        cells as inventory rows so widths align perfectly.
                        Action button (+) lives in the checkbox column position. */}
                    <TableRow
                      className="bg-primary/5 border-b-2 border-primary/20 hover:bg-primary/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Checkbox column → commit (+) button. Same absolute-
                          positioned 16×16 box as the header checkbox above. */}
                      <TableCell
                        style={{ width: 48, minWidth: 48, maxWidth: 48, padding: 0, position: "relative", height: 48 }}
                        className="!border-r-0"
                      >
                        <div
                          className="absolute cursor-pointer"
                          style={{ left: 0, top: 0, right: 0, bottom: 0 }}
                          onClick={(e) => { e.stopPropagation(); commitTempDraft(); }}
                        >
                          <div
                            role="button"
                            aria-label="Adicionar item temporário (Enter)"
                            title="Adicionar item temporário (Enter)"
                            tabIndex={0}
                            style={{
                              position: "absolute",
                              left: 16,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 16,
                              height: 16,
                              boxSizing: "border-box",
                              backgroundColor: "rgb(34 139 79)",
                              borderColor: "rgb(34 139 79)",
                              color: "#fff",
                            }}
                            className={cn(
                              "rounded-sm border transition-all",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              "hover:brightness-110",
                              !(tempDraft.description.trim() && tempDraft.quantity > 0) && "opacity-50",
                            )}
                          >
                            <svg
                              className="h-full w-full"
                              viewBox="0 0 15 15"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M7.5 4.5 V10.5 M4.5 7.5 H10.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </TableCell>

                      {/* Data columns — render appropriate input or em-dash per column */}
                      {displayColumns.filter((col) => col.key !== "checkbox").map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(column.className, "px-4 py-2 !border-r-0 align-middle")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderEntryCell(column.key)}
                        </TableCell>
                      ))}

                    </TableRow>

                    {/* Pinned temporary items already added — same per-column layout
                        as the entry row + inventory rows, fully editable in place. */}
                    {temporaryItems.map((temp) => (
                      <TableRow
                        key={temp.key}
                        className="bg-primary/[0.02] border-b border-primary/10 hover:bg-primary/5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Checkbox column → X (delete) button. Same absolute-
                            positioned 16×16 box as the other three. */}
                        <TableCell
                          style={{ width: 48, minWidth: 48, maxWidth: 48, padding: 0, position: "relative", height: 48 }}
                          className="!border-r-0"
                        >
                          <div
                            className="absolute cursor-pointer"
                            style={{ left: 0, top: 0, right: 0, bottom: 0 }}
                            onClick={(e) => { e.stopPropagation(); onTemporaryItemRemove?.(temp.key); }}
                          >
                            <div
                              role="button"
                              aria-label="Remover item temporário"
                              title="Remover item temporário"
                              tabIndex={0}
                              style={{
                                position: "absolute",
                                left: 16,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 16,
                                height: 16,
                                boxSizing: "border-box",
                                backgroundColor: "rgb(196 60 60)",
                                borderColor: "rgb(196 60 60)",
                                color: "#fff",
                              }}
                              className={cn(
                                "rounded-sm border transition-all",
                                "hover:brightness-110",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
                              )}
                            >
                              <svg
                                className="h-full w-full"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                {/* X glyph kept inset (4.5–10.5) so its
                                    visual footprint matches the + and checkbox
                                    checkmark — no edge-bleed. */}
                                <path
                                  d="M4.5 4.5 L10.5 10.5 M10.5 4.5 L4.5 10.5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        </TableCell>

                        {/* Data columns */}
                        {displayColumns.filter((col) => col.key !== "checkbox").map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(column.className, "px-4 py-2 !border-r-0 align-middle")}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderTempCell(column.key, temp)}
                          </TableCell>
                        ))}

                      </TableRow>
                    ))}
                  </>
                )}
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <LoadingSpinner />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <div className="text-lg font-medium mb-2">Nenhum item encontrado</div>
                        {hasActiveFilters && (
                          <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const itemIsSelected = selectedItems.has(item.id);

                    return (
                      <TableRow
                        key={item.id}
                        data-state={itemIsSelected ? "selected" : undefined}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border select-none",
                          // Alternating row colors
                          index % 2 === 1 && "bg-muted/10",
                          // Hover state that works with alternating colors
                          "hover:bg-muted/20",
                          // Selected state overrides alternating colors
                          itemIsSelected && "bg-muted/30 hover:bg-muted/40"
                        )}
                        onClick={(e) => handleRowClick(item, e)}
                      >
                        {/* Checkbox cell — same absolute-positioned 16×16 box
                            as the header, sticky entry, and pinned temp cells. */}
                        <TableCell
                          style={{ width: 48, minWidth: 48, maxWidth: 48, padding: 0, position: "relative", height: 36 }}
                          className="!border-r-0"
                        >
                          <div
                            className="absolute cursor-pointer"
                            style={{ left: 0, top: 0, right: 0, bottom: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(item, e);
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: 16,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 16,
                                height: 16,
                                boxSizing: "border-box",
                              }}
                              className={cn(
                                "rounded-sm border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                itemIsSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border bg-transparent hover:border-primary/50"
                              )}
                              aria-label={`Select ${item.name}`}
                              role="checkbox"
                              aria-checked={itemIsSelected}
                              tabIndex={0}
                            >
                              {itemIsSelected && (
                                <svg
                                  className="h-full w-full"
                                  viewBox="0 0 15 15"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    strokeWidth={3}
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Data columns */}
                        {displayColumns.filter(col => col.key !== 'checkbox').map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(
                              column.className,
                              "px-4 py-2 !border-r-0 align-middle"
                            )}
                            onClick={(e) => {
                              // Prevent row click when clicking on input fields
                              if (column.editable) {
                                e.stopPropagation();
                              }
                            }}
                          >
                            {column.accessor(item, contextRef.current)}
                          </TableCell>
                        ))}

                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Fixed Pagination Footer */}
          <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
            <SimplePaginationAdvanced
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={totalRecords}
              pageSizeOptions={[20, 40, 60, 100]}
              onPageSizeChange={setPageSize}
              showPageSizeSelector={true}
              showGoToPage={true}
              showPageInfo={true}
            />
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      <ItemSelectorFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        filters={localFilters}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
};
