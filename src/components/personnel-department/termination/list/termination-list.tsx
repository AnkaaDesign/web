import { useState, useCallback, useMemo, useRef } from "react";
import { useTerminationMutations, useTerminationAdvance } from "../../../../hooks/personnel-department/use-terminations";
import type { Termination } from "../../../../types/termination";
import type { TerminationGetManyFormData } from "../../../../schemas/termination";
import { TERMINATION_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Textarea } from "@/components/ui/textarea";
import { TerminationTable } from "./termination-table";
import { IconFilter } from "@tabler/icons-react";
import { TerminationFilters } from "./termination-filters";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "./filter-indicator";
import { createTerminationColumns, DEFAULT_TERMINATION_VISIBLE_COLUMNS } from "./termination-table-columns";
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

interface TerminationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Não-finais: por padrão a lista mostra apenas rescisões em andamento
// (Concluída/Cancelada ficam ocultas até serem filtradas explicitamente).
const ACTIVE_TERMINATION_STATUSES: string[] = Object.values(TERMINATION_STATUS).filter(
  (status) => status !== TERMINATION_STATUS.COMPLETED && status !== TERMINATION_STATUS.CANCELLED,
);

export function TerminationList({ className }: TerminationListProps) {
  const { deleteAsync, deleteMutation } = useTerminationMutations();
  const advance = useTerminationAdvance();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<Termination | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<Termination | null>(null);

  // Custom deserializer for termination filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<TerminationGetManyFormData> => {
    const filters: Partial<TerminationGetManyFormData> = {};

    const types = params.get("types");
    if (types) {
      filters.types = types.split(",");
    }

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const terminationAfter = params.get("terminationAfter");
    const terminationBefore = params.get("terminationBefore");
    if (terminationAfter || terminationBefore) {
      filters.where = {
        terminationDate: {
          ...(terminationAfter && { gte: new Date(terminationAfter) }),
          ...(terminationBefore && { lte: new Date(terminationBefore) }),
        },
      };
    }

    return filters;
  }, []);

  // Custom serializer for termination filters
  const serializeFilters = useCallback((filters: Partial<TerminationGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.types?.length) params.types = filters.types.join(",");
    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");

    const range = (filters.where as any)?.terminationDate;
    if (range?.gte) params.terminationAfter = new Date(range.gte).toISOString();
    if (range?.lte) params.terminationBefore = new Date(range.lte).toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    TerminationGetManyFormData
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

  // Visible columns state with localStorage persistence.
  // -v2: COLABORADOR no longer stacks the position; SETOR + CARGO are now their
  // own columns. Bump the key so stale saved preferences reset to the new defaults.
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("termination-list-visible-columns-v2", DEFAULT_TERMINATION_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createTerminationColumns(), []);

  // True when the user picked a status filter explicitly (else default to active-only).
  const hasExplicitStatusFilter = Array.isArray(filters.statuses) && filters.statuses.length > 0;

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    const hasStatuses = Array.isArray((filterWithoutOrderBy as any).statuses) && (filterWithoutOrderBy as any).statuses.length > 0;

    return {
      ...filterWithoutOrderBy,
      // Default: hide Concluída/Cancelada until explicitly filtered.
      ...(hasStatuses ? {} : { statuses: ACTIVE_TERMINATION_STATUSES }),
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<TerminationGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TerminationGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal
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

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    const extracted = extractActiveFilters(filtersWithSearch, onRemoveFilter);
    // Default active-only filter (no explicit status): show it with an escape
    // hatch to reveal Concluída/Cancelada too.
    if (!hasExplicitStatusFilter) {
      return [
        {
          key: "status-default",
          label: "Exibindo",
          value: "Em andamento",
          onRemove: () => handleFilterChange({ ...filters, statuses: Object.values(TERMINATION_STATUS) }),
        },
        ...extracted,
      ];
    }
    return extracted;
  }, [filters, searchingFor, onRemoveFilter, hasExplicitStatusFilter, handleFilterChange]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  const confirmCancel = async () => {
    if (!cancelDialog) return;
    const reason = cancelReason.trim();
    if (!reason) return;

    try {
      await advance.mutateAsync({ id: cancelDialog.id, data: { status: TERMINATION_STATUS.CANCELLED, reason } });
      setCancelDialog(null);
      setCancelReason("");
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling termination:", error);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      await deleteAsync(deleteDialog.id);
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting termination:", error);
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
            placeholder="Buscar por colaborador, motivo ou artigo"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_TERMINATION_VISIBLE_COLUMNS}
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
          <TerminationTable visibleColumns={visibleColumns} onCancel={setCancelDialog} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <TerminationFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!cancelDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialog(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar rescisão</AlertDialogTitle>
            <AlertDialogDescription>
              A rescisão{cancelDialog?.user?.name ? ` de "${cancelDialog.user.name}"` : ""} será marcada como cancelada na etapa atual e não poderá mais ser avançada. Informe o
              motivo de não ter sido concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento (obrigatório)" rows={4} autoFocus />
            {cancelReason.trim().length === 0 && <p className="text-xs text-muted-foreground">O motivo é obrigatório para cancelar.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={advance.isPending || cancelReason.trim().length === 0} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar rescisão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a rescisão{deleteDialog?.user?.name ? ` de "${deleteDialog.user.name}"` : ""}? Esta ação não pode ser desfeita.
              {deleteDialog?.status === TERMINATION_STATUS.COMPLETED && (
                <span className="block mt-2 font-medium text-destructive">Não é possível excluir uma rescisão concluída.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || deleteDialog?.status === TERMINATION_STATUS.COMPLETED}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
