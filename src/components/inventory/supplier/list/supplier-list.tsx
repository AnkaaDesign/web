import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBatchDeleteSuppliers } from "../../../../hooks";
import type { Supplier } from "../../../../types";
import type { SupplierGetManyFormData } from "../../../../schemas";
import { routes, BRAZILIAN_STATES } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SupplierTable } from "./supplier-table";
import { IconFilter, IconShoppingCart, IconMapPin, IconPackages, IconCalendarPlus } from "@tabler/icons-react";
import { SupplierFilters } from "./supplier-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createSupplierColumns } from "./supplier-table-columns";
import { SupplierExport } from "./supplier-export";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SupplierListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function SupplierList({ className }: SupplierListProps) {
  const navigate = useNavigate();
  const batchDeleteMutation = useBatchDeleteSuppliers();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page suppliers and total count from the table
  const [tableData, setTableData] = useState<{ suppliers: Supplier[]; totalRecords: number }>({ suppliers: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ suppliers: Supplier[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { suppliers: Supplier[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected suppliers functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for supplier filters
  const deserializeSupplierFilters = useCallback((params: URLSearchParams): Partial<SupplierGetManyFormData> => {
    const filters: Partial<SupplierGetManyFormData> = {};

    // Parse boolean filters
    const hasActiveOrders = params.get("hasActiveOrders");
    if (hasActiveOrders === "true") {
      filters.hasActiveOrders = true;
    }

    const hasLogo = params.get("hasLogo");
    if (hasLogo !== null) {
      filters.hasLogo = hasLogo === "true";
    }

    const hasItems = params.get("hasItems");
    if (hasItems !== null) {
      filters.hasItems = hasItems === "true";
    }

    const hasOrders = params.get("hasOrders");
    if (hasOrders !== null) {
      filters.hasOrders = hasOrders === "true";
    }

    const hasCnpj = params.get("hasCnpj");
    if (hasCnpj !== null) {
      filters.hasCnpj = hasCnpj === "true";
    }

    const hasEmail = params.get("hasEmail");
    if (hasEmail !== null) {
      filters.hasEmail = hasEmail === "true";
    }

    const hasSite = params.get("hasSite");
    if (hasSite !== null) {
      filters.hasSite = hasSite === "true";
    }

    // Parse array filters
    const states = params.get("states");
    if (states) {
      try {
        const statesArray = JSON.parse(states);
        if (Array.isArray(statesArray) && statesArray.length > 0) {
          const validStates = statesArray.filter((state) => BRAZILIAN_STATES.includes(state));
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

    // Parse text filters
    const phoneContains = params.get("phoneContains");
    if (phoneContains) {
      filters.phoneContains = phoneContains;
    }

    const cnpj = params.get("cnpj");
    if (cnpj) {
      filters.cnpj = cnpj;
    }

    // Parse range filters
    const itemCountMin = params.get("itemCountMin");
    const itemCountMax = params.get("itemCountMax");
    if (itemCountMin || itemCountMax) {
      filters.itemCount = {
        ...(itemCountMin && { min: Number(itemCountMin) }),
        ...(itemCountMax && { max: Number(itemCountMax) }),
      };
    }

    const orderCountMin = params.get("orderCountMin");
    const orderCountMax = params.get("orderCountMax");
    if (orderCountMin || orderCountMax) {
      filters.orderCount = {
        ...(orderCountMin && { min: Number(orderCountMin) }),
        ...(orderCountMax && { max: Number(orderCountMax) }),
      };
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

  // Custom serializer for supplier filters
  const serializeSupplierFilters = useCallback((filters: Partial<SupplierGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Boolean filters
    if (typeof filters.hasActiveOrders === "boolean") params.hasActiveOrders = String(filters.hasActiveOrders);
    if (typeof filters.hasLogo === "boolean") params.hasLogo = String(filters.hasLogo);
    if (typeof filters.hasItems === "boolean") params.hasItems = String(filters.hasItems);
    if (typeof filters.hasOrders === "boolean") params.hasOrders = String(filters.hasOrders);
    if (typeof filters.hasCnpj === "boolean") params.hasCnpj = String(filters.hasCnpj);
    if (typeof filters.hasEmail === "boolean") params.hasEmail = String(filters.hasEmail);
    if (typeof filters.hasSite === "boolean") params.hasSite = String(filters.hasSite);

    // Array filters
    if (filters.states?.length) params.states = JSON.stringify(filters.states);
    if (filters.cities?.length) params.cities = JSON.stringify(filters.cities);

    // Text filters
    if (filters.phoneContains) params.phoneContains = filters.phoneContains;
    if (filters.cnpj) params.cnpj = filters.cnpj;

    // Range filters
    if (filters.itemCount?.min !== undefined) params.itemCountMin = String(filters.itemCount.min);
    if (filters.itemCount?.max !== undefined) params.itemCountMax = String(filters.itemCount.max);
    if (filters.orderCount?.min !== undefined) params.orderCountMin = String(filters.orderCount.min);
    if (filters.orderCount?.max !== undefined) params.orderCountMax = String(filters.orderCount.max);

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
  } = useTableFilters<SupplierGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeSupplierFilters,
    deserializeFromUrl: deserializeSupplierFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    const result = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<SupplierGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Use column visibility hook with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "supplier-list-visible-columns",
    new Set(["fantasyName", "cnpj", "email", "phones", "_count.items"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createSupplierColumns(), []);

  // Handle filter removal
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        setFilters((prev) => {
          const updated = { ...prev };
          delete updated[key as keyof SupplierGetManyFormData];
          return updated;
        });
      }
    },
    [setFilters, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const filtersArray = [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    if (filtersWithSearch.searchingFor) {
      filtersArray.push({
        id: "searchingFor",
        label: "Buscar",
        value: filtersWithSearch.searchingFor,
        onRemove: () => onRemoveFilter("searchingFor"),
      });
    }

    if (filtersWithSearch.hasActiveOrders) {
      filtersArray.push({
        id: "hasActiveOrders",
        label: "Pedidos ativos",
        value: "Sim",
        onRemove: () => onRemoveFilter("hasActiveOrders"),
        icon: <IconShoppingCart className="h-3 w-3" />,
      });
    }

    if (filtersWithSearch.states && filtersWithSearch.states.length > 0) {
      // Create individual badges for each state
      filtersWithSearch.states.forEach((state: string) => {
        filtersArray.push({
          id: `states-${state}`,
          label: "Estado",
          value: state,
          onRemove: () => {
            // Remove this specific state from the filter
            const newStates = filtersWithSearch.states?.filter((s: string) => s !== state);
            setFilters((prev) => ({
              ...prev,
              states: newStates && newStates.length > 0 ? newStates : undefined,
            }));
          },
          icon: <IconMapPin className="h-3 w-3" />,
        });
      });
    }

    if (filtersWithSearch.itemCount?.min || filtersWithSearch.itemCount?.max) {
      const min = filtersWithSearch.itemCount?.min;
      const max = filtersWithSearch.itemCount?.max;
      const value = min && max ? `${min}-${max}` : min ? `≥${min}` : `≤${max}`;
      filtersArray.push({
        id: "itemCount",
        label: "Qtd. Itens",
        value: value || "",
        onRemove: () => onRemoveFilter("itemCount"),
        icon: <IconPackages className="h-3 w-3" />,
      });
    }

    if (filtersWithSearch.createdAt?.gte || filtersWithSearch.createdAt?.lte) {
      const gte = filtersWithSearch.createdAt?.gte;
      const lte = filtersWithSearch.createdAt?.lte;
      let value = "";

      if (gte && lte) {
        value = `${new Date(gte).toLocaleDateString("pt-BR")} - ${new Date(lte).toLocaleDateString("pt-BR")}`;
      } else if (gte) {
        value = `A partir de ${new Date(gte).toLocaleDateString("pt-BR")}`;
      } else if (lte) {
        value = `Até ${new Date(lte).toLocaleDateString("pt-BR")}`;
      }

      filtersArray.push({
        id: "createdAt",
        label: "Data de cadastro",
        value,
        onRemove: () => onRemoveFilter("createdAt"),
        icon: <IconCalendarPlus className="h-3 w-3" />,
      });
    }

    return filtersArray;
  }, [filters, searchingFor, onRemoveFilter, setFilters]);

  // Context menu handlers
  const handleBulkEdit = (suppliers: Supplier[]) => {
    if (suppliers.length === 1) {
      // Single supplier - navigate to edit page
      navigate(routes.inventory.suppliers.edit(suppliers[0].id));
    } else {
      // Multiple suppliers - navigate to batch edit page
      const ids = suppliers.map((supplier) => supplier.id).join(",");
      navigate(`${routes.inventory.suppliers.batchEdit}?ids=${ids}`);
    }
  };

  const handleBulkDelete = (suppliers: Supplier[]) => {
    setDeleteDialog({ suppliers, isBulk: suppliers.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.suppliers.map((supplier) => supplier.id);
      await batchDeleteMutation.mutateAsync({ supplierIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar por nome fantasia, razão social, CNPJ, email..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <SupplierExport filters={queryFilters} currentSuppliers={tableData.suppliers} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <SupplierTable
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
      <SupplierFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.suppliers.length} fornecedores` : "este fornecedor"}?
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
