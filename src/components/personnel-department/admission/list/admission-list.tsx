import { useState, useCallback, useMemo, useRef } from "react";
import { useAdmissionMutations, useAdmissionAdvance } from "../../../../hooks/personnel-department/use-admissions";
import { useUsers } from "../../../../hooks";
import type { Admission } from "../../../../types/admission";
import type { AdmissionGetManyFormData } from "../../../../schemas/admission";
import { ADMISSION_STATUS, ADMISSION_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { AdmissionTable } from "./admission-table";
import { IconFilter } from "@tabler/icons-react";
import { AdmissionFilters } from "./admission-filters";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { createAdmissionColumns, DEFAULT_ADMISSION_VISIBLE_COLUMNS } from "./admission-table-columns";
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

interface AdmissionListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function AdmissionList({ className }: AdmissionListProps) {
  const { deleteAsync, deleteMutation } = useAdmissionMutations();
  const advanceMutation = useAdmissionAdvance();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Admission | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Admission | null>(null);

  // Custom deserializer for admission filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<AdmissionGetManyFormData> => {
    const filters: Partial<AdmissionGetManyFormData> = {};

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const users = params.get("users");
    if (users) {
      filters.userIds = users.split(",");
    }

    const hireAfter = params.get("hireAfter");
    const hireBefore = params.get("hireBefore");
    if (hireAfter || hireBefore) {
      filters.where = {
        hireDate: {
          ...(hireAfter && { gte: new Date(hireAfter) }),
          ...(hireBefore && { lte: new Date(hireBefore) }),
        },
      };
    }

    return filters;
  }, []);

  // Custom serializer for admission filters
  const serializeFilters = useCallback((filters: Partial<AdmissionGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.userIds?.length) params.users = filters.userIds.join(",");

    const hireDate = (filters.where as any)?.hireDate as { gte?: Date; lte?: Date } | undefined;
    if (hireDate?.gte) params.hireAfter = hireDate.gte.toISOString();
    if (hireDate?.lte) params.hireBefore = hireDate.lte.toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    AdmissionGetManyFormData
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
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("admission-list-visible-columns", DEFAULT_ADMISSION_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createAdmissionColumns(), []);

  // Load names for selected user filters (labels only)
  const selectedUserIds = filters.userIds || [];
  const { data: filterUsersData } = useUsers(
    { where: { id: { in: selectedUserIds } }, limit: selectedUserIds.length || 1 },
    { enabled: selectedUserIds.length > 0 },
  );

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<AdmissionGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<AdmissionGetManyFormData>) => {
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

    (filters.statuses || []).forEach((status: string) => {
      indicators.push({
        key: `status-${status}`,
        label: "Status",
        value: ADMISSION_STATUS_LABELS[status as ADMISSION_STATUS] || status,
        onRemove: () => handleFilterChange({ ...filters, statuses: (filters.statuses || []).filter((s: string) => s !== status) }),
      });
    });

    (filters.userIds || []).forEach((userId: string) => {
      const user = filterUsersData?.data?.find((u) => u.id === userId);
      indicators.push({
        key: `user-${userId}`,
        label: "Colaborador",
        value: user?.name || userId,
        onRemove: () => handleFilterChange({ ...filters, userIds: (filters.userIds || []).filter((id: string) => id !== userId) }),
      });
    });

    const hireDate = (filters.where as any)?.hireDate as { gte?: Date; lte?: Date } | undefined;
    if (hireDate?.gte || hireDate?.lte) {
      const gte = hireDate.gte ? formatDate(hireDate.gte) : "...";
      const lte = hireDate.lte ? formatDate(hireDate.lte) : "...";
      indicators.push({
        key: "hireDate",
        label: "Data de Admissão",
        value: `${gte} - ${lte}`,
        onRemove: () => {
          const where = { ...(filters.where as any) };
          delete where.hireDate;
          handleFilterChange({ ...filters, where: Object.keys(where).length > 0 ? where : undefined });
        },
      });
    }

    return indicators;
  }, [filters, searchingFor, filterUsersData?.data, handleFilterChange, setSearch]);

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
        console.error("Error deleting admission:", error);
      }
    }
  };

  const confirmCancel = async () => {
    if (!cancelDialog) return;

    try {
      await advanceMutation.mutateAsync({ id: cancelDialog.id, data: { status: ADMISSION_STATUS.CANCELLED } });
      setCancelDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling admission:", error);
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
            placeholder="Buscar por colaborador ou observação"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_ADMISSION_VISIBLE_COLUMNS}
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
          <AdmissionTable visibleColumns={visibleColumns} onCancel={setCancelDialog} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <AdmissionFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar admissão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a admissão{cancelDialog?.user?.name ? ` de "${cancelDialog.user.name}"` : ""}? O processo será marcado como cancelado e não
              poderá mais ser avançado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={advanceMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar admissão
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
              Tem certeza que deseja excluir a admissão{deleteDialog?.user?.name ? ` de "${deleteDialog.user.name}"` : ""}? Os documentos do checklist também serão
              removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
