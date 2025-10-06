import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItemCategories } from "../../../../hooks";
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
import { useTableState } from "@/hooks/use-table-state";
import { Badge } from "@/components/ui/badge";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
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

  // Track cursor position to maintain it during search operations
  const cursorPositionRef = useRef<number>(0);

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

  // Update cursor position when user interacts with search input
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target;
      cursorPositionRef.current = target.selectionStart || 0;
      setDisplaySearchText(target.value); // Immediate UI update
      debouncedSearch(target.value); // Debounced API call
    },
    [debouncedSearch],
  );

  // Keep focus and cursor position stable during search operations
  useEffect(() => {
    // Only restore cursor position if the search input is currently focused
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM updates are complete
      requestAnimationFrame(() => {
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
          const input = searchInputRef.current;
          const savedPosition = cursorPositionRef.current;
          // Restore cursor position to where the user was typing
          input.setSelectionRange(savedPosition, savedPosition);
        }
      });
    }
  }, [displaySearchText]); // Depend on display text changes, not table data

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
      limit: DEFAULT_PAGE_SIZE,
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
      limit: DEFAULT_PAGE_SIZE,
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

  // Handle search
  const handleSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value); // Immediate UI update
      debouncedSearch(value); // Debounced API call
    },
    [debouncedSearch],
  );

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

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
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
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2 min-w-[1.25rem] h-5 px-1">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <PpeExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <PpeTable visibleColumns={visibleColumns} onEdit={handleBulkEdit} filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <PpeFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
    </Card>
  );
}
