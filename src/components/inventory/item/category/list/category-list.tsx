import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItemCategoryBatchMutations } from "../../../../../hooks";
import type { ItemCategory } from "../../../../../types";
import type { ItemCategoryGetManyFormData } from "../../../../../schemas";
import { routes } from "../../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryTable } from "./category-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { CategoryFilters } from "./category-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { useCategoryTableColumns, getDefaultVisibleColumns } from "./category-table-columns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface CategoryListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
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

export function CategoryList({ className }: CategoryListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { batchDelete } = useItemCategoryBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ categories: ItemCategory[]; totalRecords: number }>({ categories: [], totalRecords: 0 });
  const [deleteDialog, setDeleteDialog] = useState<{ categories: ItemCategory[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { categories: ItemCategory[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Keep focus on search input after data updates
  useEffect(() => {
    // Only restore focus if the search input was already focused
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (searchInputRef.current) {
          const length = searchInputRef.current.value.length;
          searchInputRef.current.setSelectionRange(length, length);
        }
      });
    }
  }, [tableData.categories.length]); // Only depend on items length to reduce re-runs

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const allColumns = useCategoryTableColumns();
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "category-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // State from URL params
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get("search") || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Track if filters are being initialized to prevent loops
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): Partial<ItemCategoryGetManyFormData> => {
    const filters: Partial<ItemCategoryGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };

    // Parse type filter
    const type = searchParams.get("type");
    if (type) {
      filters.where = { ...filters.where, type };
    }

    // Parse date range filters
    const createdAfter = searchParams.get("createdAfter");
    const createdBefore = searchParams.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    return filters;
  }, [searchParams]);

  const [filters, setFilters] = useState<Partial<ItemCategoryGetManyFormData>>(() => {
    // Initialize with default to prevent errors
    return { limit: DEFAULT_PAGE_SIZE };
  });

  // Initialize filters from URL after mount to prevent hydration issues
  useEffect(() => {
    if (!filtersInitialized) {
      const initialFilters = getFiltersFromUrl();
      setFilters(initialFilters);
      setFiltersInitialized(true);
    }
  }, [filtersInitialized, getFiltersFromUrl]);

  // Sync displaySearchText when URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (filtersInitialized) {
      const urlSearch = searchParams.get("search") || "";
      if (urlSearch !== displaySearchText && urlSearch !== searchingFor) {
        setDisplaySearchText(urlSearch);
        setSearchingFor(urlSearch);
      }
    }
  }, [searchParams.get("search"), filtersInitialized]); // Only depend on search param value

  // Update URL when search changes - using callback to prevent loops
  const updateSearchInUrl = useCallback(
    (search: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (search) {
            params.set("search", search);
          } else {
            params.delete("search");
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Only update URL when searchingFor actually changes
  const prevSearchingForRef = useRef(searchingFor);
  useEffect(() => {
    if (prevSearchingForRef.current !== searchingFor) {
      prevSearchingForRef.current = searchingFor;
      updateSearchInUrl(searchingFor);
    }
  }, [searchingFor, updateSearchInUrl]);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    // Don't process filters until initialized
    if (!filtersInitialized) {
      return { limit: DEFAULT_PAGE_SIZE };
    }

    // Create a new object without orderBy from filters to avoid conflicts
    const { orderBy: filterOrderBy, ...filterWithoutOrderBy } = filters;

    // Build where clause
    const where = filterWithoutOrderBy.where ? { ...filterWithoutOrderBy.where } : {};

    return {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      ...(searchingFor && { searchingFor }), // Only include if not empty
      // orderBy will be handled by the table component via URL state
    };
  }, [filters, searchingFor, filtersInitialized]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<ItemCategoryGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);

      // Update URL immediately when filters change
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);

          // Clear all filter params first
          const filterKeys = ["search", "type", "createdAfter", "createdBefore"];
          filterKeys.forEach((key) => params.delete(key));

          // Add new filter params
          if (newFilters.searchingFor) params.set("search", newFilters.searchingFor);

          const where = newFilters.where || {};
          if (where.type) params.set("type", where.type);

          // Add date filters
          if (newFilters.createdAt?.gte) params.set("createdAfter", newFilters.createdAt.gte.toISOString());
          if (newFilters.createdAt?.lte) params.set("createdBefore", newFilters.createdAt.lte.toISOString());

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to also handle searchingFor
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearchingFor("");
        setDisplaySearchText("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter],
  );

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    const resetFilters: Partial<ItemCategoryGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    setFilters(resetFilters);
    // Also clear the search
    setSearchingFor("");
    setDisplaySearchText("");

    // Clear URL params except sort
    setSearchParams(
      (prev) => {
        const sortParam = prev.get("sort");
        const newParams = new URLSearchParams();
        if (sortParam) {
          newParams.set("sort", sortParam);
        }
        return newParams;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter);
  }, [filters, searchingFor, onRemoveFilter]);

  // Check if there are active filters (excluding search)
  const hasActiveFilters = useMemo(() => {
    return !!(filters.where?.type || filters.createdAt?.gte || filters.createdAt?.lte);
  }, [filters]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        // Only update if value actually changed
        setSearchingFor((prev) => {
          if (prev !== value) {
            return value;
          }
          return prev;
        });
      }, 300), // 300ms delay
    [],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
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
  const handleBulkEdit = (categories: ItemCategory[]) => {
    if (categories.length === 1) {
      // Single category - navigate to edit page
      navigate(routes.inventory.products.categories.edit(categories[0].id));
    } else {
      // Multiple categories - navigate to batch edit page
      const ids = categories.map((category) => category.id).join(",");
      navigate(`${routes.inventory.products.categories.batchEdit}?ids=${ids}`);
    }
  };

  const handleBulkDelete = (categories: ItemCategory[]) => {
    setDeleteDialog({ categories, isBulk: categories.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.categories.map((category) => category.id);
      await batchDelete({ itemCategoryIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error(`Error deleting categor${deleteDialog.categories.length > 1 ? "ies" : "y"}:`, error);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input ref={searchInputRef} type="text" placeholder="Buscar categorias..." value={displaySearchText} onChange={(e) => handleSearch(e.target.value)} transparent={true} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                {hasActiveFilters ? `Filtros (${activeFilters.filter((f) => f.key !== "searchingFor").length})` : "Filtros"}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <CategoryTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <CategoryFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.categories.length} categorias` : "esta categoria"}?
                  <br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
