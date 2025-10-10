import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerBatchMutations } from "../../../../hooks";
import type { Customer } from "../../../../types";
import type { CustomerGetManyFormData } from "../../../../schemas";
import { routes, BRAZILIAN_STATES } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { CustomerTable } from "./customer-table";
import { IconFilter } from "@tabler/icons-react";
import { CustomerFilters } from "./customer-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { CustomerExport } from "./customer-export";
import { createCustomerColumns } from "./customer-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { CustomerMergeDialog } from "../merge/customer-merge-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeCustomers } from "../../../../api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomerListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function CustomerList({ className }: CustomerListProps) {
  const navigate = useNavigate();
  const { batchDeleteAsync: batchDeleteMutation } = useCustomerBatchMutations();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page customers and total count from the table
  const [tableData, setTableData] = useState<{ customers: Customer[]; totalRecords: number }>({ customers: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Customer[]; isBulk: boolean } | null>(null);
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; customers: Customer[] }>({ open: false, customers: [] });

  // Merge mutation
  const { mutate: mergeMutation, isPending: isMerging } = useMutation({
    mutationFn: mergeCustomers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { customers: Customer[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected customers functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for customer filters
  const deserializeCustomerFilters = useCallback((params: URLSearchParams): Partial<CustomerGetManyFormData> => {
    const filters: Partial<CustomerGetManyFormData> = {};

    // Parse boolean filters
    const hasTasks = params.get("hasTasks");
    if (hasTasks !== null) {
      filters.hasTasks = hasTasks === "true";
    }

    const hasLogo = params.get("hasLogo");
    if (hasLogo !== null) {
      filters.hasLogo = hasLogo === "true";
    }

    // Parse array filters
    const states = params.get("states");
    if (states) {
      try {
        const statesArray = JSON.parse(states);
        if (Array.isArray(statesArray) && statesArray.length > 0) {
          const validStates = statesArray.filter((state) => Object.values(BRAZILIAN_STATES).includes(state));
          if (validStates.length > 0) {
            filters.states = validStates;
          }
        }
      } catch (e) {
        // If parsing fails, ignore the filter
      }
    }

    const cities = params.get("cities");
    if (cities) {
      try {
        const citiesArray = JSON.parse(cities);
        if (Array.isArray(citiesArray) && citiesArray.length > 0) {
          filters.cities = citiesArray;
        }
      } catch (e) {
        // If parsing fails, ignore the filter
      }
    }

    const tags = params.get("tags");
    if (tags) {
      try {
        const tagsArray = JSON.parse(tags);
        if (Array.isArray(tagsArray) && tagsArray.length > 0) {
          filters.tags = tagsArray;
        }
      } catch (e) {
        // If parsing fails, ignore the filter
      }
    }

    // Parse date range filters
    const createdAfter = params.get("createdAfter");
    const createdBefore = params.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    const updatedAfter = params.get("updatedAfter");
    const updatedBefore = params.get("updatedBefore");
    if (updatedAfter || updatedBefore) {
      filters.updatedAt = {
        ...(updatedAfter && { gte: new Date(updatedAfter) }),
        ...(updatedBefore && { lte: new Date(updatedBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for customer filters
  const serializeCustomerFilters = useCallback((filters: Partial<CustomerGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Boolean filters
    if (typeof filters.hasTasks === "boolean") {
      params.hasTasks = String(filters.hasTasks);
    }
    if (typeof filters.hasLogo === "boolean") {
      params.hasLogo = String(filters.hasLogo);
    }

    // Array filters
    if (filters.states?.length) params.states = JSON.stringify(filters.states);
    if (filters.cities?.length) params.cities = JSON.stringify(filters.cities);
    if (filters.tags?.length) params.tags = JSON.stringify(filters.tags);

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.updatedAt?.gte) params.updatedAfter = filters.updatedAt.gte.toISOString();
    if (filters.updatedAt?.lte) params.updatedBefore = filters.updatedAt.lte.toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<CustomerGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeCustomerFilters,
    deserializeFromUrl: deserializeCustomerFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "customer-list-visible-columns",
    new Set(["fantasyName", "document", "corporateName", "email", "phones", "taskCount"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createCustomerColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    console.log("[CustomerList] baseQueryFilters:", baseQueryFilters);
    console.log("[CustomerList] filterWithoutOrderBy:", filterWithoutOrderBy);

    const result = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    console.log("[CustomerList] queryFilters result:", result);
    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<CustomerGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to also handle searchingFor
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      // Entity data will be passed by filter-utils as needed
    });
  }, [filters, searchingFor, onRemoveFilter]);

  // Count active filters (excluding searchingFor for button display)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.hasTasks) count++;
    if (filters.states && filters.states.length > 0) count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.taskCount?.min || filters.taskCount?.max) count++;
    if (filters.createdAt?.gte || filters.createdAt?.lte) count++;
    if (filters.updatedAt?.gte || filters.updatedAt?.lte) count++;
    return count;
  }, [filters]);

  // Context menu handlers
  const handleBulkEdit = (customers: Customer[]) => {
    if (customers.length === 1) {
      // Single customer - navigate to edit page
      navigate(routes.administration.customers.edit(customers[0].id));
    } else {
      // Multiple customers - navigate to batch edit page
      const ids = customers.map((customer) => customer.id).join(",");
      navigate(`${routes.administration.customers.batchEdit}?ids=${ids}`);
    }
  };

  const handleBulkDelete = (customers: Customer[]) => {
    setDeleteDialog({ items: customers, isBulk: customers.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((customer) => customer.id);
      await batchDeleteMutation({ customerIds: ids });

      // Selection is now managed by URL state and will be cleared automatically
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error deleting customer(s):", error);
    }
  };

  // Handle merge action
  const handleMerge = useCallback((customers: Customer[]) => {
    if (customers.length < 2) {
      return;
    }
    setMergeDialog({ open: true, customers });
  }, []);

  const handleMergeConfirm = useCallback(
    async (targetId: string, resolutions: Record<string, any>) => {
      try {
        // Calculate source IDs from the customers in the merge dialog
        const sourceIds = mergeDialog.customers.map(customer => customer.id).filter(id => id !== targetId);

        mergeMutation({
          targetCustomerId: targetId,
          sourceCustomerIds: sourceIds,
          conflictResolutions: resolutions,
        });

        setMergeDialog({ open: false, customers: [] });
      } catch (error) {
        // Error is handled by the API client
        console.error("Error merging customers:", error);
      }
    },
    [mergeMutation, mergeDialog.customers]
  );

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              console.log("[CustomerList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por nome, CNPJ, CPF, email..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={activeFilterCount > 0 ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                Filtros
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <CustomerExport filters={filters} currentCustomers={tableData.customers} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters.map((filter) => ({
              key: filter.id,
              label: filter.label,
              value: filter.value,
              onRemove: filter.onRemove,
              iconType: filter.iconType,
            }))}
            onClearAll={clearAllFilters}
            className="px-1 py-1"
          />
        )}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <CustomerTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onDelete={handleBulkDelete}
            onMerge={handleMerge}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <CustomerFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} clientes? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o cliente "${deleteDialog?.items[0]?.fantasyName || deleteDialog?.items[0]?.corporateName}"? Esta ação não pode ser desfeita.`}
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

      {/* Merge Dialog */}
      <CustomerMergeDialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog({ open, customers: mergeDialog.customers })}
        customers={mergeDialog.customers}
        onMerge={handleMergeConfirm}
      />
    </Card>
  );
}
