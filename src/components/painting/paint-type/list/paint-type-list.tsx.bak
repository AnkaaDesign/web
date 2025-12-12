import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePaintTypeMutations, usePaintTypeBatchMutations } from "../../../../hooks";
import type { PaintType } from "../../../../types";
import type { PaintTypeGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PaintTypeTable } from "./paint-type-table";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createPaintTypeColumns, getDefaultVisibleColumns } from "./paint-type-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
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

interface PaintTypeListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Move default filters outside component to prevent re-creation on every render
const DEFAULT_FILTERS = {
  limit: DEFAULT_PAGE_SIZE,
};

// Move exclude from URL array outside component to prevent re-creation
const EXCLUDE_FROM_URL = ["limit", "orderBy"];

export function PaintTypeList({ className }: PaintTypeListProps) {
  const navigate = useNavigate();
  const { delete: deletePaintType } = usePaintTypeMutations();
  const { batchDelete, batchUpdate } = usePaintTypeBatchMutations();

  // State to hold current page paint types and total count from the table
  const [tableData, setTableData] = useState<{ paintTypes: PaintType[]; totalRecords: number }>({ paintTypes: [], totalRecords: 0 });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ items: PaintType[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { paintTypes: PaintType[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected paint types functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

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
  } = useTableFilters<PaintTypeGetManyFormData>({
    defaultFilters: DEFAULT_FILTERS,
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    excludeFromUrl: EXCLUDE_FROM_URL,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "paint-type-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createPaintTypeColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<PaintTypeGetManyFormData>) => {
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
    (key: string, itemId?: string) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, itemId);
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

    return extractActiveFilters(filtersWithSearch, onRemoveFilter);
  }, [filters, searchingFor, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (paintTypes: PaintType[]) => {
    if (paintTypes.length === 1) {
      // Single paint type - navigate to edit page
      navigate(routes.painting.paintTypes.edit(paintTypes[0].id));
    } else {
      // Multiple paint types - navigate to batch edit page (when implemented)
      const ids = paintTypes.map((pt) => pt.id).join(",");
      // navigate(`${routes.painting.paintTypes.batchEdit}?ids=${ids}`);
      console.log("Batch edit not implemented yet for paint types:", ids);
    }
  };

  const handleBulkDelete = async (paintTypes: PaintType[]) => {
    setDeleteDialog({ items: paintTypes, isBulk: paintTypes.length > 1 });
  };

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        const ids = deleteDialog.items.map((pt) => pt.id);
        await batchDelete({ paintTypeIds: ids });

        // Selection is now managed by URL state and will be cleared automatically
      } catch (error) {
        // Error is handled by the API client with detailed message
        console.error("Error deleting paint type(s):", error);
      }
      setDeleteDialog(null);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar tipos de tinta..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <PaintTypeTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} tipo${deleteDialog.items.length > 1 ? "s" : ""} de tinta? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o tipo "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
