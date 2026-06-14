import { useState, useCallback, useMemo, useRef } from "react";
import { useVacationMutations } from "../../../../hooks/personnel-department/use-vacations";
import type { Vacation } from "../../../../types/vacation";
import type { VacationGetManyFormData } from "../../../../schemas/vacation";
import { VACATION_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { VacationTable } from "./vacation-table";
import { IconFilter } from "@tabler/icons-react";
import { VacationFilters } from "./vacation-filters";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "./filter-indicator";
import { createVacationColumns, DEFAULT_VACATION_VISIBLE_COLUMNS } from "./vacation-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
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

interface VacationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function VacationList({ className }: VacationListProps) {
  const { deleteAsync, deleteMutation } = useVacationMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Vacation | null>(null);

  const deserializeFilters = useCallback((params: URLSearchParams): Partial<VacationGetManyFormData> => {
    const filters: Partial<VacationGetManyFormData> = {};

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const userIds = params.get("userIds");
    if (userIds) {
      filters.userIds = userIds.split(",");
    }

    const concessiveAfter = params.get("concessiveAfter");
    const concessiveBefore = params.get("concessiveBefore");
    if (concessiveAfter || concessiveBefore) {
      filters.where = {
        concessiveEnd: {
          ...(concessiveAfter && { gte: new Date(concessiveAfter) }),
          ...(concessiveBefore && { lte: new Date(concessiveBefore) }),
        },
      };
    }

    return filters;
  }, []);

  const serializeFilters = useCallback((filters: Partial<VacationGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.userIds?.length) params.userIds = filters.userIds.join(",");

    const range = (filters.where as any)?.concessiveEnd;
    if (range?.gte) params.concessiveAfter = new Date(range.gte).toISOString();
    if (range?.lte) params.concessiveBefore = new Date(range.lte).toISOString();

    return params;
  }, []);

  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    VacationGetManyFormData
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

  const { visibleColumns, setVisibleColumns } = useColumnVisibility("vacation-list-visible-columns", DEFAULT_VACATION_VISIBLE_COLUMNS);

  const allColumns = useMemo(() => createVacationColumns(), []);

  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<VacationGetManyFormData>;
  }, [baseQueryFilters]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<VacationGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

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

  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };
    return extractActiveFilters(filtersWithSearch, onRemoveFilter);
  }, [filters, searchingFor, onRemoveFilter]);

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
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting vacation:", error);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por colaborador ou observações"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_VACATION_VISIBLE_COLUMNS}
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

        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        <div className="flex-1 min-h-0 overflow-auto">
          <VacationTable visibleColumns={visibleColumns} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      <VacationFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de férias{deleteDialog?.user?.name ? ` de "${deleteDialog.user.name}"` : ""}? Esta ação não pode ser desfeita.
              {deleteDialog?.status === VACATION_STATUS.PAID && (
                <span className="block mt-2 font-medium text-destructive">Atenção: estas férias já foram pagas.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
