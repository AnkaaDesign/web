import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserBatchMutations, usePositions, useSectors } from "../../../../hooks";
import type { User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";
import { routes, USER_STATUS, ACTIVE_USER_STATUSES } from "../../../../constants";
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
import { useTableState } from "@/hooks/use-table-state";
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

interface UserListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function UserList({ className }: UserListProps) {
  const navigate = useNavigate();
  const { batchDelete, batchUpdateAsync } = useUserBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page users and total count from the table
  const [tableData, setTableData] = useState<{ users: User[]; totalRecords: number }>({ users: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);
  const [dismissDialog, setDismissDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);
  const [contractDialog, setContractDialog] = useState<{ items: User[]; isBulk: boolean } | null>(null);

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

    // Parse status filters (support both single and multiple selections)
    const status = params.get("status");
    const statuses = params.get("statuses");
    if (statuses) {
      filters.status = statuses.split(",");
    } else if (status) {
      filters.where = { ...filters.where, status: status };
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

    const managedSector = params.get("managedSector");
    const managedSectors = params.get("managedSectors");
    if (managedSectors) {
      filters.managedSectorId = managedSectors.split(",");
    } else if (managedSector) {
      filters.where = { ...filters.where, managedSectorId: managedSector };
    }

    // Parse boolean filters

    const hasManagedSector = params.get("hasManagedSector");
    if (hasManagedSector !== null) {
      filters.hasManagedSector = hasManagedSector === "true";
    }

    const verified = params.get("verified");
    if (verified !== null) {
      filters.verified = verified === "true";
    }

    const requirePasswordChange = params.get("requirePasswordChange");
    if (requirePasswordChange !== null) {
      filters.requirePasswordChange = requirePasswordChange === "true";
    }

    const showDismissed = params.get("showDismissed");
    if (showDismissed !== null) {
      filters.showDismissed = showDismissed === "true";
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

    const birthDateAfter = params.get("birthDateAfter");
    const birthDateBefore = params.get("birthDateBefore");
    if (birthDateAfter || birthDateBefore) {
      filters.birthDate = {
        ...(birthDateAfter && { gte: new Date(birthDateAfter) }),
        ...(birthDateBefore && { lte: new Date(birthDateBefore) }),
      };
    }

    const hireDateAfter = params.get("hireDateAfter");
    const hireDateBefore = params.get("hireDateBefore");
    if (hireDateAfter || hireDateBefore) {
      filters.hireDate = {
        ...(hireDateAfter && { gte: new Date(hireDateAfter) }),
        ...(hireDateBefore && { lte: new Date(hireDateBefore) }),
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

    // Parse range filters

    return filters;
  }, []);

  // Custom serializer for user filters
  const serializeUserFilters = useCallback((filters: Partial<UserGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filters
    if (filters.status?.length) params.statuses = filters.status.join(",");
    else if (filters.where?.status) params.status = filters.where.status as string;

    // Entity filters
    if (filters.positionId?.length) params.positions = filters.positionId.join(",");
    else if (filters.where?.positionId) params.position = filters.where.positionId as string;

    if (filters.sectorId?.length) params.sectors = filters.sectorId.join(",");
    else if (filters.where?.sectorId) params.sector = filters.where.sectorId as string;

    if (filters.managedSectorId?.length) params.managedSectors = filters.managedSectorId.join(",");
    else if (filters.where?.managedSectorId) params.managedSector = filters.where.managedSectorId as string;

    // Boolean filters
    if (typeof filters.hasManagedSector === "boolean") {
      params.hasManagedSector = String(filters.hasManagedSector);
    }
    if (typeof filters.verified === "boolean") {
      params.verified = String(filters.verified);
    }
    if (typeof filters.requirePasswordChange === "boolean") {
      params.requirePasswordChange = String(filters.requirePasswordChange);
    }
    if (typeof filters.showDismissed === "boolean") {
      params.showDismissed = String(filters.showDismissed);
    }

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.updatedAt?.gte) params.updatedAfter = filters.updatedAt.gte.toISOString();
    if (filters.updatedAt?.lte) params.updatedBefore = filters.updatedAt.lte.toISOString();
    if (filters.birthDate?.gte) params.birthDateAfter = filters.birthDate.gte.toISOString();
    if (filters.birthDate?.lte) params.birthDateBefore = filters.birthDate.lte.toISOString();
    if (filters.hireDate?.gte) params.hireDateAfter = filters.hireDate.gte.toISOString();
    if (filters.hireDate?.lte) params.hireDateBefore = filters.hireDate.lte.toISOString();
    if (filters.lastLoginAt?.gte) params.lastLoginAfter = filters.lastLoginAt.gte.toISOString();
    if (filters.lastLoginAt?.lte) params.lastLoginBefore = filters.lastLoginAt.lte.toISOString();

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
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeUserFilters,
    deserializeFromUrl: deserializeUserFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "user-list-visible-columns",
    new Set(["payrollNumber", "name", "position.name", "sector.name", "status"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    // Check if user has explicitly selected status filters
    const hasExplicitStatusFilter =
      filterWithoutOrderBy.status &&
      Array.isArray(filterWithoutOrderBy.status) &&
      filterWithoutOrderBy.status.length > 0;

    // Build result object
    const result: Partial<UserGetManyFormData> = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    // Remove any where.status filters to avoid conflicts
    if (result.where?.status) {
      const { status: _, ...restWhere } = result.where;
      if (Object.keys(restWhere).length > 0) {
        result.where = restWhere;
      } else {
        delete result.where;
      }
    }

    // Convert frontend filter names to API schema names
    // The API expects plural field names (statuses, positionIds, sectorIds, managedSectorIds)
    if (result.status) {
      result.statuses = result.status;
      delete result.status;
    }
    if (result.positionId) {
      result.positionIds = result.positionId;
      delete result.positionId;
    }
    if (result.sectorId) {
      result.sectorIds = result.sectorId;
      delete result.sectorId;
    }
    if (result.managedSectorId) {
      result.managedSectorIds = result.managedSectorId;
      delete result.managedSectorId;
    }

    // Apply status filter logic
    if (hasExplicitStatusFilter) {
      // User has explicitly selected statuses - use only those
      result.statuses = [...filterWithoutOrderBy.status!];
    } else {
      // No explicit filter - default to active users only
      result.statuses = [...ACTIVE_USER_STATUSES];
    }

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<UserGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;

      // Clean up any where.status filters if we have a direct status array filter
      if (filtersWithoutOrderBy.status && Array.isArray(filtersWithoutOrderBy.status)) {
        if (filtersWithoutOrderBy.where?.status) {
          const { status: _, ...restWhere } = filtersWithoutOrderBy.where;
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
      console.error("Error deleting user(s):", error);
    }
  };

  const confirmMarkAsContracted = async () => {
    if (!contractDialog) return;

    try {
      const updateUsers = contractDialog.items.map((user) => ({
        id: user.id,
        data: { status: USER_STATUS.CONTRACTED },
      }));

      await batchUpdateAsync({ users: updateUsers });
      setContractDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error marking user(s) as contracted:", error);
    }
  };

  const confirmMarkAsDismissed = async () => {
    if (!dismissDialog) return;

    try {
      const updateUsers = dismissDialog.items.map((user) => ({
        id: user.id,
        data: { status: USER_STATUS.DISMISSED, dismissal: new Date() },
      }));

      await batchUpdateAsync({ users: updateUsers });
      setDismissDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error marking user(s) as dismissed:", error);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              console.log("[UserList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por nome, email, CPF, PIS..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <UserExport filters={filters} currentUsers={tableData.users} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <UserTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onMarkAsContracted={handleMarkAsContracted}
            onMarkAsDismissed={handleMarkAsDismissed}
            onDelete={handleBulkDelete}
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
    </Card>
  );
}
