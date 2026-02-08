import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItemCategories, useItemMutations, useItemBatchMutations } from "../../../../hooks";
import type { Item } from "../../../../types";
import type { ItemGetManyFormData } from "../../../../schemas";
import { routes, ITEM_CATEGORY_TYPE, PPE_TYPE } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PpeTable } from "./ppe-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { PpeFilters } from "./ppe-filters";
import { FilterIndicators } from "./filter-indicators";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { getDefaultVisibleColumns, createPpeColumns } from "./ppe-table-columns";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { Badge } from "@/components/ui/badge";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { PpeExport } from "./ppe-export";

interface PpeListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility - moved outside component to avoid initialization issues
function createDebounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  return debounced;
}

export function PpeList({ className }: PpeListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Item[]; totalRecords: number }>({ items: [], totalRecords: 0 });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Item[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // State from URL params - must be declared before debounced search
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get("search") || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");

  // Debounced search function - defined after state declarations
  const debouncedSearch = useCallback(
    createDebounce((value: string) => {
      // Only update if value actually changed
      setSearchingFor((prev) => {
        if (prev !== value) {
          return value;
        }
        return prev;
      });
    }, 300), // 300ms delay
    [setSearchingFor],
  );

  // Handle search input change - receives value directly from custom Input component
  const handleSearchInputChange = useCallback(
    (value: string | number | null) => {
      const stringValue = value?.toString() || "";
      setDisplaySearchText(stringValue); // Immediate UI update
      debouncedSearch(stringValue); // Debounced API call
    },
    [debouncedSearch],
  );

  // Load entity data for filter labels
  const { data: categoriesData } = useItemCategories({
    where: { type: ITEM_CATEGORY_TYPE.PPE },
    orderBy: { name: "asc" },
  });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "ppe-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // Get all columns for the visibility manager
  const columns = createPpeColumns();

  const [showFilterModal, setShowFilterModal] = useState(false);

  // Track if filters are being initialized to prevent loops
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): Partial<ItemGetManyFormData> => {
    const filters: Partial<ItemGetManyFormData> = {
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    };

    // Parse category filter
    const categoryId = searchParams.get("categoryId");
    const categoryIds = searchParams.get("categoryIds");
    if (categoryIds) {
      filters.categoryIds = categoryIds.split(",");
    } else if (categoryId) {
      filters.where = { ...filters.where, categoryId };
    }

    // Parse PPE type filter
    const ppeType = searchParams.get("ppeType");
    if (ppeType) {
      filters.ppeType = ppeType.split(",") as PPE_TYPE[];
    }

    // Parse low stock filter
    const lowStock = searchParams.get("lowStock");
    if (lowStock === "true") {
      filters.lowStock = true;
    }

    // Parse out of stock filter
    const outOfStock = searchParams.get("outOfStock");
    if (outOfStock === "true") {
      filters.outOfStock = true;
    }

    // Parse isActive filter (boolean or "all" for ambos)
    const isActive = searchParams.get("isActive");
    if (isActive === "true") {
      filters.isActive = true;
    } else if (isActive === "false") {
      filters.isActive = false;
    } else if (isActive === "all") {
      // Explicitly showing all (ambos) - don't set isActive
      filters.isActive = undefined;
    } else if (isActive === null) {
      // No parameter = first visit, default to showing only active
      filters.isActive = true;
    }

    return filters;
  }, [searchParams]);

  // Current filters state
  const [filters, setFilters] = useState<Partial<ItemGetManyFormData>>(() => getFiltersFromUrl());

  // Initialize filters from URL on mount
  useEffect(() => {
    if (!filtersInitialized) {
      const urlFilters = getFiltersFromUrl();
      setFilters(urlFilters);
      setFiltersInitialized(true);
    }
  }, [getFiltersFromUrl, filtersInitialized]);

  // Update URL when filters or search change
  useEffect(() => {
    if (!filtersInitialized) return;

    const newParams = new URLSearchParams(searchParams); // Preserve existing params

    // Clear filter-specific parameters first
    newParams.delete("search");
    newParams.delete("categoryIds");
    newParams.delete("categoryId");
    newParams.delete("ppeType");
    newParams.delete("lowStock");
    newParams.delete("outOfStock");
    newParams.delete("isActive");

    // Add search parameter
    if (searchingFor) {
      newParams.set("search", searchingFor);
    }

    // Add filter parameters
    if (filters.categoryIds?.length) {
      newParams.set("categoryIds", filters.categoryIds.join(","));
    } else if (filters.where?.categoryId) {
      newParams.set("categoryId", filters.where.categoryId);
    }

    if (filters.ppeType?.length) {
      newParams.set("ppeType", filters.ppeType.join(","));
    }

    if (filters.lowStock) {
      newParams.set("lowStock", "true");
    }

    if (filters.outOfStock) {
      newParams.set("outOfStock", "true");
    }

    // Serialize isActive (true/false/"all")
    if (typeof filters.isActive === "boolean") {
      newParams.set("isActive", String(filters.isActive));
    } else if (filters.isActive === undefined && filtersInitialized) {
      // When explicitly showing all (ambos), set to "all"
      newParams.set("isActive", "all");
    }

    setSearchParams(newParams, { replace: true });
  }, [filters, searchingFor, setSearchParams, filtersInitialized, searchParams]);

  // Query filters to send to API
  const queryFilters = useMemo(() => {
    return {
      ...filters,
      searchingFor: searchingFor || undefined,
    };
  }, [filters, searchingFor]);

  // Handler for filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handler to remove specific filter
  const onRemoveFilter = useCallback((filterKey: string, filterValue?: any) => {
    // If removing search filter, also clear the search input states
    if (filterKey === "searchingFor") {
      setSearchingFor("");
      setDisplaySearchText("");
    }
    createFilterRemover(setFilters)(filterKey, filterValue);
  }, []);

  // Handler to clear all filters but keep search
  const handleClearAllFilters = useCallback(() => {
    setFilters({
      isActive: true, // Reset to default: show only active items
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    });
  }, []);

  // Compute active filters for UI indicators
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      categories: categoriesData?.data,
    });
  }, [filters, searchingFor, categoriesData?.data, onRemoveFilter]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearch && typeof debouncedSearch.cancel === "function") {
        debouncedSearch.cancel();
      }
    };
  }, [debouncedSearch]);

  // Get mutation hooks
  const { update } = useItemMutations();
  const { batchUpdate } = useItemBatchMutations();

  // Context menu handlers
  const handleBulkEdit = (items: Item[]) => {
    if (items.length === 1) {
      // Single item - navigate to edit page
      navigate(routes.inventory.ppe.edit(items[0].id));
    } else {
      // Multiple items - navigate to batch edit page (note: batch edit route may need to be added to ppe routes)
      const ids = items.map((item) => item.id).join(",");
      navigate(`${routes.inventory.products.batchEdit}?ids=${ids}&category=epi`);
    }
  };

  const handleActivate = async (items: Item[]) => {
    try {
      if (items.length === 1) {
        // Single item update
        const updateData = { id: items[0].id, data: { isActive: true } };

        await update(updateData);
      } else {
        // Batch update
        const updateItems = items.map((item) => ({
          id: item.id,
          data: { isActive: true },
        }));
        const batchData = { items: updateItems };

        await batchUpdate(batchData);
      }
    } catch (error: any) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error activating PPE item(s):", error);
      }
    }
  };

  const handleDeactivate = async (items: Item[]) => {
    try {
      if (items.length === 1) {
        // Single item update
        const updateData = { id: items[0].id, data: { isActive: false } };

        await update(updateData);
      } else {
        // Batch update
        const updateItems = items.map((item) => ({
          id: item.id,
          data: { isActive: false },
        }));
        const batchData = { items: updateItems };

        await batchUpdate(batchData);
      }
    } catch (error: any) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deactivating PPE item(s):", error);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nome, código, marca..."
              value={displaySearchText}
              onChange={handleSearchInputChange}
              transparent={true}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={activeFilters.length > 0 ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4" />
              <span>Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}</span>
            </Button>
            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <PpeExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <PpeTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <PpeFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
    </Card>
  );
}
