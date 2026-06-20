import { useState, useCallback, useMemo, useRef } from "react";
import { IconFilter, IconFileTypePdf, IconLoader2 } from "@tabler/icons-react";

import { useItemCategories } from "@/hooks/inventory/use-item-category";
import { fispqService } from "@/api-client";
import { useFispqBatchMutations } from "@/hooks/occupational-health/use-fispq";
import { downloadFispqPdfs } from "../download-fispq-pdfs";
import type { Fispq } from "@/types/fispq";
import type { FispqGetManyFormData } from "@/schemas/fispq";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { toast } from "@/components/ui/sonner";
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
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

import { FispqTable } from "./fispq-table";
import { FispqFiltersComponent } from "./fispq-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createFispqColumns, DEFAULT_VISIBLE_COLUMNS } from "./fispq-table-columns";
import { extractActiveFilters, createFilterRemover, type FispqFilters } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";

interface FispqListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function FispqList({ className }: FispqListProps) {
  const { batchDeleteAsync } = useFispqBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Fispq[]; isBulk: boolean } | null>(null);
  const [tableData, setTableData] = useState<{ fispqs: Fispq[]; totalRecords: number }>({ fispqs: [], totalRecords: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // Get table state for selected functionality
  const { selectionCount, selectedIds, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for FISPQ filters
  const deserializeFilters = useCallback((params: URLSearchParams): FispqFilters => {
    const filters: FispqFilters = {};

    const statuses = params.get("statuses");
    if (statuses) filters.statuses = statuses.split(",");

    const signalWords = params.get("signalWords");
    if (signalWords) filters.signalWords = signalWords.split(",");

    const pictograms = params.get("pictograms");
    if (pictograms) filters.pictograms = pictograms.split(",");

    const categoryIds = params.get("categories");
    if (categoryIds) filters.categoryIds = categoryIds.split(",");

    const itemIds = params.get("items");
    if (itemIds) filters.itemIds = itemIds.split(",");

    const expiringInDays = params.get("expiringInDays");
    if (expiringInDays !== null) filters.expiringInDays = Number(expiringInDays);

    const hasPdf = params.get("hasPdf");
    if (hasPdf === "false") filters.hasPdf = false;

    return filters;
  }, []);

  // Custom serializer for FISPQ filters
  const serializeFilters = useCallback((filters: FispqFilters): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.signalWords?.length) params.signalWords = filters.signalWords.join(",");
    if (filters.pictograms?.length) params.pictograms = filters.pictograms.join(",");
    if (filters.categoryIds?.length) params.categories = filters.categoryIds.join(",");
    if (filters.itemIds?.length) params.items = filters.itemIds.join(",");
    if (typeof filters.expiringInDays === "number") params.expiringInDays = String(filters.expiringInDays);
    if (filters.hasPdf === false) params.hasPdf = "false";

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
  } = useTableFilters<FispqFilters>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence.
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("fispq-list-visible-columns-v1", DEFAULT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createFispqColumns(), []);

  // Load categories for filter indicator labels (only the selected ones)
  const filterCategoryIds: string[] = useMemo(() => (Array.isArray(filters.categoryIds) ? filters.categoryIds : []), [filters.categoryIds]);
  const { data: filterCategoriesData } = useItemCategories(
    {
      where: { id: { in: filterCategoryIds } },
      orderBy: { name: "asc" },
    },
    { enabled: filterCategoryIds.length > 0 },
  );

  // Query filters to pass to the paginated table — translate the UI-only
  // categoryIds / hasPdf toggles into a `where` clause the API understands.
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters as any;

    const result: any = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    const where: any = { ...result.where };

    if (result.categoryIds && Array.isArray(result.categoryIds) && result.categoryIds.length > 0) {
      where.item = { is: { categoryId: { in: result.categoryIds } } };
      delete result.categoryIds;
    }

    if (result.hasPdf === false) {
      where.pdfFileId = null;
    }
    delete result.hasPdf;

    if (Object.keys(where).length > 0) {
      result.where = where;
    }

    return result as Partial<FispqGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: FispqFilters) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters as any;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

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
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      categories: filterCategoriesData?.data || [],
    });
  }, [filters, searchingFor, filterCategoriesData?.data, onRemoveFilter]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (key === "hasPdf") return value === false;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  // Action handlers
  const handleDelete = useCallback((fispqs: Fispq[]) => {
    setDeleteDialog({ items: fispqs, isBulk: fispqs.length > 1 });
  }, []);

  const handleDataChange = useCallback((data: { fispqs: Fispq[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      await batchDeleteAsync({ fispqIds: deleteDialog.items.map((fispq) => fispq.id) });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting FISPQ(s):", error);
      }
    }
  };

  // Export = download the actual FDS/FISPQ PDF documents. Uses the selected rows
  // when there is a selection, otherwise every record matching the current filters.
  const handleExportPdfs = async () => {
    setIsExporting(true);
    try {
      const where = selectedIds.length > 0 ? { id: { in: selectedIds } } : (queryFilters as any).where;
      const response = await fispqService.getFispqs({
        ...(queryFilters as any),
        where,
        limit: selectedIds.length > 0 ? selectedIds.length : tableData.totalRecords || 1000,
        include: { item: true, pdfFile: true },
      } as any);
      const fispqs = response.data || [];
      if (fispqs.length === 0) {
        toast.error("Nenhuma FISPQ para exportar.");
        return;
      }
      await downloadFispqPdfs(fispqs);
    } catch {
      toast.error("Não foi possível exportar os PDFs das FDS.");
    } finally {
      setIsExporting(false);
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
            onChange={(value) => setSearch(value)}
            placeholder="Buscar: produto, fabricante, CAS ou ONU"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
            <Button variant="outline" size="default" onClick={handleExportPdfs} disabled={isExporting}>
              {isExporting ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconFileTypePdf className="h-4 w-4" />}
              <span>{selectionCount > 0 ? `Exportar PDFs (${selectionCount})` : "Exportar PDFs"}</span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <FispqTable visibleColumns={visibleColumns} onDelete={handleDelete} onDataChange={handleDataChange} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Filter Modal */}
      <FispqFiltersComponent open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} FISPQs? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a FISPQ de "${deleteDialog?.items[0]?.item?.name || deleteDialog?.items[0]?.productName || "produto"}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
