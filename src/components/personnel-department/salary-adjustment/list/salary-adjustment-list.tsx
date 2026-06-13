import { useState, useCallback, useMemo, useRef } from "react";
import { useSalaryAdjustmentMutations } from "../../../../hooks/personnel-department/use-salary-adjustment";
import { usePositions } from "../../../../hooks";
import type { SalaryAdjustment } from "../../../../types/salary-adjustment";
import type { SalaryAdjustmentGetManyFormData } from "../../../../schemas/salary-adjustment";
import { SALARY_ADJUSTMENT_TYPE_LABELS, type SALARY_ADJUSTMENT_TYPE } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SalaryAdjustmentTable } from "./salary-adjustment-table";
import { IconFilter } from "@tabler/icons-react";
import { SalaryAdjustmentFilters } from "./salary-adjustment-filters";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { createSalaryAdjustmentColumns, DEFAULT_SALARY_ADJUSTMENT_VISIBLE_COLUMNS } from "./salary-adjustment-table-columns";
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

interface SalaryAdjustmentListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function SalaryAdjustmentList({ className }: SalaryAdjustmentListProps) {
  const { deleteAsync, isDeleting } = useSalaryAdjustmentMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<SalaryAdjustment | null>(null);

  // Load positions for filter labels
  const { data: positionsData } = usePositions({ orderBy: { name: "asc" } });

  // Custom deserializer for salary adjustment filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<SalaryAdjustmentGetManyFormData> => {
    const filters: Partial<SalaryAdjustmentGetManyFormData> = {};

    const types = params.get("types");
    if (types) {
      filters.types = types.split(",");
    }

    const positions = params.get("positions");
    if (positions) {
      filters.positionIds = positions.split(",");
    }

    const effectiveAfter = params.get("effectiveAfter");
    const effectiveBefore = params.get("effectiveBefore");
    if (effectiveAfter || effectiveBefore) {
      filters.effectiveDateRange = {
        ...(effectiveAfter && { gte: new Date(effectiveAfter) }),
        ...(effectiveBefore && { lte: new Date(effectiveBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for salary adjustment filters
  const serializeFilters = useCallback((filters: Partial<SalaryAdjustmentGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.types?.length) params.types = filters.types.join(",");
    if (filters.positionIds?.length) params.positions = filters.positionIds.join(",");
    if (filters.effectiveDateRange?.gte) params.effectiveAfter = filters.effectiveDateRange.gte.toISOString();
    if (filters.effectiveDateRange?.lte) params.effectiveBefore = filters.effectiveDateRange.lte.toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    SalaryAdjustmentGetManyFormData
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
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("salary-adjustment-list-visible-columns", DEFAULT_SALARY_ADJUSTMENT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createSalaryAdjustmentColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<SalaryAdjustmentGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<SalaryAdjustmentGetManyFormData>) => {
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

    (filters.types || []).forEach((type: string) => {
      indicators.push({
        key: `type-${type}`,
        label: "Tipo",
        value: SALARY_ADJUSTMENT_TYPE_LABELS[type as SALARY_ADJUSTMENT_TYPE] || type,
        onRemove: () => handleFilterChange({ ...filters, types: (filters.types || []).filter((t: string) => t !== type) }),
      });
    });

    (filters.positionIds || []).forEach((positionId: string) => {
      const position = positionsData?.data?.find((p) => p.id === positionId);
      indicators.push({
        key: `position-${positionId}`,
        label: "Cargo",
        value: position?.name || positionId,
        onRemove: () => handleFilterChange({ ...filters, positionIds: (filters.positionIds || []).filter((id: string) => id !== positionId) }),
      });
    });

    if (filters.effectiveDateRange?.gte || filters.effectiveDateRange?.lte) {
      const gte = filters.effectiveDateRange.gte ? formatDate(filters.effectiveDateRange.gte) : "...";
      const lte = filters.effectiveDateRange.lte ? formatDate(filters.effectiveDateRange.lte) : "...";
      indicators.push({
        key: "effectiveDateRange",
        label: "Vigência",
        value: `${gte} - ${lte}`,
        onRemove: () => handleFilterChange({ ...filters, effectiveDateRange: undefined }),
      });
    }

    return indicators;
  }, [filters, searchingFor, positionsData?.data, handleFilterChange, setSearch]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
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
        console.error("Error deleting salary adjustment:", error);
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
            placeholder="Buscar por observação, cargo ou responsável"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_SALARY_ADJUSTMENT_VISIBLE_COLUMNS}
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
          <SalaryAdjustmentTable visibleColumns={visibleColumns} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <SalaryAdjustmentFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este reajuste salarial
              {deleteDialog?.effectiveDate ? ` de ${formatDate(new Date(deleteDialog.effectiveDate))}` : ""}? A exclusão remove apenas o registro do histórico — as
              remunerações atuais dos cargos não serão alteradas. Esta ação não pode ser desfeita.
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
