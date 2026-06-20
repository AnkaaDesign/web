import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserBatchMutations, usePositions, useSectors } from "../../../../hooks";
import type { User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";
import { routes, CONTRACT_TYPE, CONTRACT_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserTable } from "./user-table";
import { IconFilter } from "@tabler/icons-react";
import { UserFilters } from "./user-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { UserExport } from "./user-export";
import { createUserColumns } from "./user-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { UserMergeDialog } from "../merge/user-merge-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeUsers } from "../../../../api-client";
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

interface UserListProps {
  className?: string;
  teamScope?: boolean;
}

const DEFAULT_PAGE_SIZE = 40;

export function UserList({ className, teamScope }: UserListProps) {
  const navigate = useNavigate();
  const { batchDelete, batchUpdateAsync } = useUserBatchMutations();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page users and total count from the table
  const [tableData, setTableData] = useState<{ users: User[]; totalRecords: number }>({ users: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);
  const [dismissDialog, setDismissDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);
  const [contractDialog, setContractDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; users: User[] }>({ open: false, users: [] });

  // Merge mutation
  const { mutate: mergeMutation } = useMutation({
    mutationFn: (params: { targetUserId: string; sourceUserIds: string[]; conflictResolutions?: Record<string, any> }) =>
      mergeUsers(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { users: User[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: positionsData } = usePositions({ orderBy: { name: "asc" } });
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });

  // Get table state for selected users functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for user filters
  const deserializeUserFilters = useCallback((params: URLSearchParams): Partial<UserGetManyFormData> => {
    const filters: Partial<UserGetManyFormData> = {};

    // Parse contract type filters (support both single and multiple selections).
    // `contractTypes` is canonical; `contractKinds`/`contractKind` kept as back-compat aliases.
    const contractType = params.get("contractType") || params.get("contractKind");
    const contractTypes = params.get("contractTypes") || params.get("contractKinds");
    if (contractTypes) {
      filters.contractTypes = contractTypes.split(",") as any;
    } else if (contractType) {
      filters.where = { ...filters.where, currentContractType: contractType } as any;
    }

    // Situação (current vínculo lifecycle status) — multi-select.
    const contractStatuses = params.get("contractStatuses");
    if (contractStatuses) {
      filters.contractStatuses = contractStatuses.split(",") as any;
    }

    // Categoria (worker category) — multi-select.
    const employeeTypes = params.get("employeeTypes");
    if (employeeTypes) {
      filters.employeeTypes = employeeTypes.split(",") as any;
    }

    // Exibir (tri-state): isActive=true → Ativos, false → Demitidos, omit → Todos.
    const isActive = params.get("isActive");
    if (isActive !== null) {
      filters.isActive = isActive === "true";
    }

    // Parse entity filters (support both single and multiple selections)
    const position = params.get("position");
    const positions = params.get("positions");
    if (positions) {
      filters.positionId = positions.split(",");
    } else if (position) {
      filters.where = { ...filters.where, positionId: position };
    }

    const sector = params.get("sector");
    const sectors = params.get("sectors");
    if (sectors) {
      filters.sectorId = sectors.split(",");
    } else if (sector) {
      filters.where = { ...filters.where, sectorId: sector };
    }

    const ledSector = params.get("ledSector");
    const ledSectors = params.get("ledSectors");
    if (ledSectors) {
      filters.ledSectorId = ledSectors.split(",");
    } else if (ledSector) {
      filters.where = { ...filters.where, ledSectorId: ledSector };
    }

    // Parse boolean filters

    const hasLedSector = params.get("hasLedSector");
    if (hasLedSector !== null) {
      filters.hasLedSector = hasLedSector === "true";
    }

    const verified = params.get("verified");
    if (verified !== null) {
      filters.verified = verified === "true";
    }

    const requirePasswordChange = params.get("requirePasswordChange");
    if (requirePasswordChange !== null) {
      filters.requirePasswordChange = requirePasswordChange === "true";
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

    const birthAfter = params.get("birthAfter");
    const birthBefore = params.get("birthBefore");
    if (birthAfter || birthBefore) {
      filters.birth = {
        ...(birthAfter && { gte: new Date(birthAfter) }),
        ...(birthBefore && { lte: new Date(birthBefore) }),
      };
    }

    const lastLoginAfter = params.get("lastLoginAfter");
    const lastLoginBefore = params.get("lastLoginBefore");
    if (lastLoginAfter || lastLoginBefore) {
      filters.lastLoginAt = {
        ...(lastLoginAfter && { gte: new Date(lastLoginAfter) }),
        ...(lastLoginBefore && { lte: new Date(lastLoginBefore) }),
      };
    }

    // Dismissal (terminationDate) and admission (exp1EndAt) ranges now live on the
    // related current EmploymentContract, expressed via where.currentContract.is.{...}.
    const dismissedAfter = params.get("dismissedAfter");
    const dismissedBefore = params.get("dismissedBefore");
    const exp1EndAfter = params.get("exp1EndAfter");
    const exp1EndBefore = params.get("exp1EndBefore");
    if (dismissedAfter || dismissedBefore || exp1EndAfter || exp1EndBefore) {
      const relIs: any = {};
      if (dismissedAfter || dismissedBefore) {
        relIs.terminationDate = {
          ...(dismissedAfter && { gte: new Date(dismissedAfter) }),
          ...(dismissedBefore && { lte: new Date(dismissedBefore) }),
        };
      }
      if (exp1EndAfter || exp1EndBefore) {
        relIs.exp1EndAt = {
          ...(exp1EndAfter && { gte: new Date(exp1EndAfter) }),
          ...(exp1EndBefore && { lte: new Date(exp1EndBefore) }),
        };
      }
      filters.where = { ...filters.where, currentContract: { is: relIs } } as any;
    }

    // Parse range filters

    return filters;
  }, []);

  // Custom serializer for user filters
  const serializeUserFilters = useCallback((filters: Partial<UserGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Contract type filters
    if (filters.contractTypes?.length) params.contractTypes = filters.contractTypes.join(",");
    else if ((filters.where as any)?.currentContractType) params.contractType = (filters.where as any).currentContractType as string;

    // Situação / Categoria multi-selects
    if (filters.contractStatuses?.length) params.contractStatuses = filters.contractStatuses.join(",");
    if (filters.employeeTypes?.length) params.employeeTypes = filters.employeeTypes.join(",");

    // Exibir tri-state (only serialize when explicitly Ativos/Demitidos; Todos omits).
    if (typeof filters.isActive === "boolean") params.isActive = String(filters.isActive);

    // Entity filters
    if (filters.positionId?.length) params.positions = filters.positionId.join(",");
    else if (filters.where?.positionId) params.position = filters.where.positionId as string;

    if (filters.sectorId?.length) params.sectors = filters.sectorId.join(",");
    else if (filters.where?.sectorId) params.sector = filters.where.sectorId as string;

    if (filters.ledSectorId?.length) params.ledSectors = filters.ledSectorId.join(",");
    else if (filters.where?.ledSectorId) params.ledSector = filters.where.ledSectorId as string;

    // Boolean filters
    if (typeof filters.hasLedSector === "boolean") {
      params.hasLedSector = String(filters.hasLedSector);
    }
    if (typeof filters.verified === "boolean") {
      params.verified = String(filters.verified);
    }
    if (typeof filters.requirePasswordChange === "boolean") {
      params.requirePasswordChange = String(filters.requirePasswordChange);
    }

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.updatedAt?.gte) params.updatedAfter = filters.updatedAt.gte.toISOString();
    if (filters.updatedAt?.lte) params.updatedBefore = filters.updatedAt.lte.toISOString();
    if (filters.birth?.gte) params.birthAfter = filters.birth.gte.toISOString();
    if (filters.birth?.lte) params.birthBefore = filters.birth.lte.toISOString();
    if (filters.lastLoginAt?.gte) params.lastLoginAfter = filters.lastLoginAt.gte.toISOString();
    if (filters.lastLoginAt?.lte) params.lastLoginBefore = filters.lastLoginAt.lte.toISOString();
    // Dismissal/admission ranges read off the current EmploymentContract relation filter.
    const currentContractIs = (filters.where as any)?.currentContract?.is as
      | { terminationDate?: { gte?: Date; lte?: Date }; exp1EndAt?: { gte?: Date; lte?: Date } }
      | undefined;
    if (currentContractIs?.terminationDate?.gte) params.dismissedAfter = currentContractIs.terminationDate.gte.toISOString();
    if (currentContractIs?.terminationDate?.lte) params.dismissedBefore = currentContractIs.terminationDate.lte.toISOString();
    if (currentContractIs?.exp1EndAt?.gte) params.exp1EndAfter = currentContractIs.exp1EndAt.gte.toISOString();
    if (currentContractIs?.exp1EndAt?.lte) params.exp1EndBefore = currentContractIs.exp1EndAt.lte.toISOString();

    // Range filters

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
  } = useTableFilters<UserGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
      // Exibir defaults to "Ativos" so the landing list shows active collaborators;
      // the user can switch to Demitidos (isActive:false) or Todos (omit) in the filter sheet.
      isActive: true,
    },
    searchDebounceMs: 500,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeUserFilters,
    deserializeFromUrl: deserializeUserFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "user-list-visible-columns-v4", // v4: added "documents" (admission checklist progress) to defaults
    new Set(["payrollNumber", "name", "position.hierarchy", "sector.name", "currentContractStatus", "documents"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    // Check if user has explicitly selected contract type filters
    const hasExplicitContractTypeFilter =
      filterWithoutOrderBy.contractTypes &&
      Array.isArray(filterWithoutOrderBy.contractTypes) &&
      filterWithoutOrderBy.contractTypes.length > 0;

    // Check if a dismissal (terminationDate) range filter is active on the
    // current EmploymentContract relation.
    const hasDismissedAtFilter = Boolean(
      (filterWithoutOrderBy.where as any)?.currentContract?.is?.terminationDate?.gte ||
      (filterWithoutOrderBy.where as any)?.currentContract?.is?.terminationDate?.lte,
    );

    // Build result object - preserve searchingFor from baseQueryFilters
    const result: Partial<UserGetManyFormData> = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
      // Make sure searchingFor is preserved
      searchingFor: filterWithoutOrderBy.searchingFor,
    };

    // Remove any where.currentContractType filters to avoid conflicts with contractTypes
    if ((result.where as any)?.currentContractType) {
      const { currentContractType: _ct, ...restWhere } = result.where as any;
      if (Object.keys(restWhere).length > 0) {
        result.where = restWhere;
      } else {
        delete result.where;
      }
    }

    // Convert frontend filter names to API schema names
    // The API expects plural field names (positionIds, sectorIds, ledSectorIds)
    if (result.positionId) {
      result.positionIds = result.positionId;
      delete result.positionId;
    }
    if (result.sectorId) {
      result.sectorIds = result.sectorId;
      delete result.sectorId;
    }
    if (result.ledSectorId) {
      result.ledSectorIds = result.ledSectorId;
      delete result.ledSectorId;
    }

    // The API accepts `contractKinds` (mapped to currentContractType server-side);
    // emit the server-recognized param for the modalidade filter and drop the alias.
    delete (result as any).contractTypes;
    if (hasExplicitContractTypeFilter) {
      result.contractKinds = [...filterWithoutOrderBy.contractTypes!];
    }

    // Filtering by dismissal date implies dismissed vínculos: force Exibir to
    // Demitidos (isActive:false) so the active default does not hide the matches.
    if (hasDismissedAtFilter) {
      result.isActive = false;
    }

    if (teamScope) {
      (result as any)._useTeamStaffEndpoint = true;
    }

    return result;
  }, [baseQueryFilters, teamScope]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<UserGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;

      // Clean up any where.currentContractType filters if we have a direct contractTypes array filter
      if (filtersWithoutOrderBy.contractTypes && Array.isArray(filtersWithoutOrderBy.contractTypes)) {
        if ((filtersWithoutOrderBy.where as any)?.currentContractType) {
          const { currentContractType: _ct, ...restWhere } = filtersWithoutOrderBy.where as any;
          if (Object.keys(restWhere).length > 0) {
            filtersWithoutOrderBy.where = restWhere;
          } else {
            delete filtersWithoutOrderBy.where;
          }
        }
      }

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
    if (!positionsData?.data || !sectorsData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      positions: positionsData.data,
      sectors: sectorsData.data,
    });
  }, [filters, searchingFor, positionsData?.data, sectorsData?.data, onRemoveFilter]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  // Context menu handlers
  const handleBulkEdit = (users: User[]) => {
    if (users.length === 1) {
      // Single user - navigate to edit page
      navigate(routes.administration.users.edit(users[0].id));
    } else {
      // Multiple users - navigate to batch edit page
      const ids = users.map((user) => user.id).join(",");
      navigate(`${routes.administration.users.batchEdit}?ids=${ids}`);
    }
  };

  const handleMarkAsContracted = (users: User[]) => {
    setContractDialog({ items: users, isBulk: users.length > 1 });
  };

  const handleMarkAsDismissed = (users: User[]) => {
    setDismissDialog({ items: users, isBulk: users.length > 1 });
  };

  const handleBulkDelete = (users: User[]) => {
    setDeleteDialog({ items: users, isBulk: users.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((user) => user.id);
      await batchDelete({ userIds: ids });

      // Selection is now managed by URL state and will be cleared automatically
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting user(s):", error);
      }
    }
  };

  const confirmMarkAsContracted = async () => {
    if (!contractDialog) return;

    try {
      const updateUsers = contractDialog.items.map((user) => ({
        id: user.id,
        data: {
          // Efetivação (CLT art. 451): converts the bond to prazo indeterminado
          // and flips its lifecycle status to ACTIVE.
          contractType: CONTRACT_TYPE.INDETERMINATE,
          contractStatus: CONTRACT_STATUS.ACTIVE,
          effectedAt: new Date(),
        },
      }));

      await batchUpdateAsync({ users: updateUsers });
      setContractDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error marking user(s) as effected:", error);
      }
    }
  };

  const confirmMarkAsDismissed = async () => {
    if (!dismissDialog) return;

    try {
      const updateUsers = dismissDialog.items.map((user) => ({
        id: user.id,
        data: { contractStatus: CONTRACT_STATUS.TERMINATED, terminationDate: new Date() },
      }));

      await batchUpdateAsync({ users: updateUsers });
      setDismissDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error marking user(s) as dismissed:", error);
      }
    }
  };

  // Handle merge action
  const handleMerge = useCallback((users: User[]) => {
    if (users.length < 2) {
      return;
    }
    setMergeDialog({ open: true, users });
  }, []);

  const handleMergeConfirm = useCallback(
    async (targetId: string, resolutions: Record<string, any>) => {
      try {
        // Calculate source IDs from the users in the merge dialog
        const sourceIds = mergeDialog.users.map(user => user.id).filter(id => id !== targetId);

        mergeMutation({
          targetUserId: targetId,
          sourceUserIds: sourceIds,
          conflictResolutions: resolutions,
        });

        setMergeDialog({ open: false, users: [] });
      } catch (error) {
        // Error is handled by the API client
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error merging users:", error);
        }
      }
    },
    [mergeMutation, mergeDialog.users]
  );

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
            placeholder="Buscar: nome, email, CPF ou nº folha (apenas números)"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
            <UserExport filters={filters} currentUsers={tableData.users} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <UserTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onMarkAsContracted={handleMarkAsContracted}
            onMarkAsDismissed={handleMarkAsDismissed}
            onDelete={handleBulkDelete}
            onMerge={handleMerge}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <UserFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} usuários? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o usuário "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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

      {/* Mark as Contracted Confirmation Dialog */}
      <AlertDialog open={!!contractDialog} onOpenChange={(open) => !open && setContractDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar contratação</AlertDialogTitle>
            <AlertDialogDescription>
              {contractDialog?.isBulk
                ? `Tem certeza que deseja marcar ${contractDialog.items.length} usuários como contratados?`
                : `Tem certeza que deseja marcar o usuário "${contractDialog?.items[0]?.name}" como contratado?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkAsContracted}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Dismissed Confirmation Dialog */}
      <AlertDialog open={!!dismissDialog} onOpenChange={(open) => !open && setDismissDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desligamento</AlertDialogTitle>
            <AlertDialogDescription>
              {dismissDialog?.isBulk
                ? `Tem certeza que deseja marcar ${dismissDialog.items.length} usuários como desligados?`
                : `Tem certeza que deseja marcar o usuário "${dismissDialog?.items[0]?.name}" como desligado?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkAsDismissed}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <UserMergeDialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog({ open, users: mergeDialog.users })}
        users={mergeDialog.users}
        onMerge={handleMergeConfirm}
      />
    </Card>
  );
}
