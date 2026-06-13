import { useState, useCallback, useMemo, useRef } from "react";
import { useBenefitMutations } from "../../../../hooks/personnel-department/use-benefits";
import type { Benefit } from "../../../../types/benefit";
import type { BenefitGetManyFormData } from "../../../../schemas/benefit";
import { BENEFIT_KIND_LABELS, type BENEFIT_KIND } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { BenefitTable } from "./benefit-table";
import { IconFilter } from "@tabler/icons-react";
import { BenefitFilters } from "./benefit-filters";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { createBenefitColumns, DEFAULT_BENEFIT_VISIBLE_COLUMNS } from "./benefit-table-columns";
import { cn } from "@/lib/utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
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

interface BenefitListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function BenefitList({ className }: BenefitListProps) {
  const { deleteAsync, isDeleting } = useBenefitMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Benefit | null>(null);

  // Custom deserializer for benefit filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<BenefitGetManyFormData> => {
    const filters: Partial<BenefitGetManyFormData> = {};

    const kinds = params.get("kinds");
    if (kinds) {
      filters.kinds = kinds.split(",");
    }

    const isActive = params.get("isActive");
    if (isActive === "true" || isActive === "false") {
      filters.isActive = isActive === "true";
    }

    return filters;
  }, []);

  // Custom serializer for benefit filters
  const serializeFilters = useCallback((filters: Partial<BenefitGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.kinds?.length) params.kinds = filters.kinds.join(",");
    if (typeof filters.isActive === "boolean") params.isActive = String(filters.isActive);

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    BenefitGetManyFormData
  >({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("benefit-list-visible-columns", DEFAULT_BENEFIT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createBenefitColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<BenefitGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<BenefitGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const indicators: Array<{ key: string; label: string; value: string; onRemove: () => void }> = [];

    if (searchingFor) {
      indicators.push({
        key: "searchingFor",
        label: "Buscar",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    (filters.kinds || []).forEach((kind: string) => {
      indicators.push({
        key: `kind-${kind}`,
        label: "Tipo",
        value: BENEFIT_KIND_LABELS[kind as BENEFIT_KIND] || kind,
        onRemove: () => handleFilterChange({ ...filters, kinds: (filters.kinds || []).filter((k: string) => k !== kind) }),
      });
    });

    if (typeof filters.isActive === "boolean") {
      indicators.push({
        key: "isActive",
        label: "Status",
        value: filters.isActive ? "Ativos" : "Inativos",
        onRemove: () => handleFilterChange({ ...filters, isActive: undefined }),
      });
    }

    return indicators;
  }, [filters, searchingFor, handleFilterChange, setSearch]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "boolean") return true;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      await deleteAsync(deleteDialog.id);
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting benefit:", error);
      }
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
            placeholder="Buscar por nome, fornecedor ou observação"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_BENEFIT_VISIBLE_COLUMNS}
            />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <BenefitTable visibleColumns={visibleColumns} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <BenefitFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o benefício "{deleteDialog?.name}"?
              {deleteDialog?._count?.enrollments ? (
                <span className="block mt-2 font-medium text-destructive">
                  Atenção: Este benefício possui {deleteDialog._count.enrollments} {deleteDialog._count.enrollments === 1 ? "adesão vinculada" : "adesões vinculadas"}.
                </span>
              ) : null}{" "}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
