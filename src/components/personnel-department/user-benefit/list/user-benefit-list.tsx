import { useState, useCallback, useMemo, useRef } from "react";
import { useUserBenefitMutations } from "../../../../hooks/personnel-department/use-user-benefits";
import { useBenefits } from "../../../../hooks/personnel-department/use-benefits";
import { useUsers } from "../../../../hooks/personnel-department/use-user";
import type { UserBenefit } from "../../../../types/benefit";
import type { UserBenefitGetManyFormData } from "../../../../schemas/benefit";
import { BENEFIT_ENROLLMENT_STATUS_LABELS, BENEFIT_KIND_LABELS, type BENEFIT_ENROLLMENT_STATUS, type BENEFIT_KIND } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserBenefitTable } from "./user-benefit-table";
import { IconFilter } from "@tabler/icons-react";
import { UserBenefitFilters } from "./user-benefit-filters";
import { UserBenefitTerminateDialog } from "../dialogs/terminate-dialog";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { createUserBenefitColumns, DEFAULT_USER_BENEFIT_VISIBLE_COLUMNS } from "./user-benefit-table-columns";
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

interface UserBenefitListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function UserBenefitList({ className }: UserBenefitListProps) {
  const { deleteAsync, isDeleting } = useUserBenefitMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<UserBenefit | null>(null);
  const [terminateDialog, setTerminateDialog] = useState<UserBenefit | null>(null);

  // Custom deserializer for enrollment filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<UserBenefitGetManyFormData> => {
    const filters: Partial<UserBenefitGetManyFormData> = {};

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const benefits = params.get("benefits");
    if (benefits) {
      filters.benefitIds = benefits.split(",");
    }

    const users = params.get("users");
    if (users) {
      filters.userIds = users.split(",");
    }

    const kinds = params.get("kinds");
    if (kinds) {
      filters.kinds = kinds.split(",");
    }

    return filters;
  }, []);

  // Custom serializer for enrollment filters
  const serializeFilters = useCallback((filters: Partial<UserBenefitGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.benefitIds?.length) params.benefits = filters.benefitIds.join(",");
    if (filters.userIds?.length) params.users = filters.userIds.join(",");
    if (filters.kinds?.length) params.kinds = filters.kinds.join(",");

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    UserBenefitGetManyFormData
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

  // Load labels for active filter indicators
  const benefitIds = (filters.benefitIds || []) as string[];
  const userIds = (filters.userIds || []) as string[];

  const { data: benefitsData } = useBenefits(
    { where: { id: { in: benefitIds } }, limit: benefitIds.length || 1 },
    { enabled: benefitIds.length > 0 },
  );
  const { data: usersData } = useUsers(
    { where: { id: { in: userIds } }, limit: userIds.length || 1 },
    { enabled: userIds.length > 0 },
  );

  // Visible columns state with localStorage persistence.
  // -v2: added SETOR + CARGO columns; bump the key so saved prefs include them.
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("user-benefit-list-visible-columns-v2", DEFAULT_USER_BENEFIT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserBenefitColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<UserBenefitGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<UserBenefitGetManyFormData>) => {
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
        value: BENEFIT_ENROLLMENT_STATUS_LABELS[status as BENEFIT_ENROLLMENT_STATUS] || status,
        onRemove: () => handleFilterChange({ ...filters, statuses: (filters.statuses || []).filter((s: string) => s !== status) }),
      });
    });

    (filters.kinds || []).forEach((kind: string) => {
      indicators.push({
        key: `kind-${kind}`,
        label: "Tipo",
        value: BENEFIT_KIND_LABELS[kind as BENEFIT_KIND] || kind,
        onRemove: () => handleFilterChange({ ...filters, kinds: (filters.kinds || []).filter((k: string) => k !== kind) }),
      });
    });

    (filters.benefitIds || []).forEach((benefitId: string) => {
      const benefit = benefitsData?.data?.find((b) => b.id === benefitId);
      indicators.push({
        key: `benefit-${benefitId}`,
        label: "Benefício",
        value: benefit?.name || benefitId,
        onRemove: () => handleFilterChange({ ...filters, benefitIds: (filters.benefitIds || []).filter((id: string) => id !== benefitId) }),
      });
    });

    (filters.userIds || []).forEach((userId: string) => {
      const user = usersData?.data?.find((u) => u.id === userId);
      indicators.push({
        key: `user-${userId}`,
        label: "Colaborador",
        value: user?.name || userId,
        onRemove: () => handleFilterChange({ ...filters, userIds: (filters.userIds || []).filter((id: string) => id !== userId) }),
      });
    });

    return indicators;
  }, [filters, searchingFor, benefitsData?.data, usersData?.data, handleFilterChange, setSearch]);

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
        console.error("Error deleting enrollment:", error);
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
            placeholder="Buscar por colaborador, benefício ou observação"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_USER_BENEFIT_VISIBLE_COLUMNS}
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
          <UserBenefitTable visibleColumns={visibleColumns} onTerminate={setTerminateDialog} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <UserBenefitFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Terminate Dialog */}
      <UserBenefitTerminateDialog userBenefit={terminateDialog} onOpenChange={(open) => !open && setTerminateDialog(null)} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a adesão
              {deleteDialog?.user?.name ? ` de "${deleteDialog.user.name}"` : ""}
              {deleteDialog?.benefit?.name ? ` ao benefício "${deleteDialog.benefit.name}"` : ""}? Esta ação não pode ser desfeita.
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
