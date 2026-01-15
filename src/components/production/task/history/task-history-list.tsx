import React from "react";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { useSectors, useCustomers, useUsers, useCurrentUser, useTaskBatchMutations } from "../../../../hooks";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTableState } from "@/hooks/use-table-state";
import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Button } from "@/components/ui/button";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { TaskHistoryTable } from "./task-history-table";
import { TaskHistoryFilters } from "./task-history-filters";
import { TaskExport } from "./task-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createTaskHistoryColumns } from "./task-history-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { AdvancedBulkActionsHandler } from "../bulk-operations/AdvancedBulkActionsHandler";
import { CopyFromTaskModal, type CopyableField } from "../schedule/copy-from-task-modal";
import { IconFilter, IconHandClick, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { hasPrivilege } from "../../../../utils";
import { getVisibleServiceOrderTypes } from "../../../../utils/permissions/service-order-permissions";
import { toast } from "sonner";

// Copy from task state type
interface CopyFromTaskState {
  step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
  targetTasks: Task[];
  selectedFields: CopyableField[];
  sourceTask: Task | null;
}

const initialCopyFromTaskState: CopyFromTaskState = {
  step: "idle",
  targetTasks: [],
  selectedFields: [],
  sourceTask: null,
};

interface TaskHistoryListProps {
  className?: string;
  statusFilter?: TASK_STATUS[];
  storageKey?: string;
  searchPlaceholder?: string;
  navigationRoute?: 'history' | 'preparation' | 'schedule';
  hideStatusFilter?: boolean;
}

const DEFAULT_PAGE_SIZE = 40;

export function TaskHistoryList({
  className,
  statusFilter = [TASK_STATUS.COMPLETED],
  storageKey = "task-history-visible-columns",
  searchPlaceholder = "Buscar por nome, cliente, setor...",
  navigationRoute = 'history',
  hideStatusFilter = false,
}: TaskHistoryListProps) {
  // Load entity data for filter labels
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" } });
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: currentUser } = useCurrentUser();

  // Check if user can view price (Admin or Financial only)
  const canViewPrice = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL)
  );

  // Check if user is admin
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Check if user can view/change status filter (Admin or Financial only, and not explicitly hidden)
  const canViewStatusFilter = !hideStatusFilter && currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL)
  );

  // Get table state for selected tasks functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds, resetSelection } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Advanced actions ref
  const advancedActionsRef = React.useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);

  // Copy from task state
  const [copyFromTaskState, setCopyFromTaskState] = React.useState<CopyFromTaskState>(initialCopyFromTaskState);

  // Batch mutations for copy operation
  const { batchUpdateAsync } = useTaskBatchMutations();

  // Custom deserializer for task filters
  const deserializeTaskFilters = React.useCallback(
    (params: URLSearchParams): Partial<TaskGetManyFormData> => {
      const filters: Partial<TaskGetManyFormData> = {};

      // Entity filters
      const sectors = params.get("sectors");
      if (sectors) filters.sectorIds = sectors.split(",");

      const customers = params.get("customers");
      if (customers) filters.customerIds = customers.split(",");

      const users = params.get("users");
      if (users) filters.assigneeIds = users.split(",");

      // Status filter
      const statusParam = params.get("status");
      if (statusParam) {
        filters.status = statusParam.split(",") as TASK_STATUS[];
      } else {
        filters.status = statusFilter;
      }

      // Date ranges
      const finishedFrom = params.get("finishedFrom");
      const finishedTo = params.get("finishedTo");
      if (finishedFrom || finishedTo) {
        filters.finishedDateRange = {
          ...(finishedFrom && { from: new Date(finishedFrom) }),
          ...(finishedTo && { to: new Date(finishedTo) }),
        };
      }

      const entryFrom = params.get("entryFrom");
      const entryTo = params.get("entryTo");
      if (entryFrom || entryTo) {
        filters.entryDateRange = {
          ...(entryFrom && { from: new Date(entryFrom) }),
          ...(entryTo && { to: new Date(entryTo) }),
        };
      }

      const termFrom = params.get("termFrom");
      const termTo = params.get("termTo");
      if (termFrom || termTo) {
        filters.termRange = {
          ...(termFrom && { from: new Date(termFrom) }),
          ...(termTo && { to: new Date(termTo) }),
        };
      }

      const startedFrom = params.get("startedFrom");
      const startedTo = params.get("startedTo");
      if (startedFrom || startedTo) {
        filters.startedDateRange = {
          ...(startedFrom && { from: new Date(startedFrom) }),
          ...(startedTo && { to: new Date(startedTo) }),
        };
      }

      // Price range
      const priceMin = params.get("priceMin");
      const priceMax = params.get("priceMax");
      if (priceMin || priceMax) {
        filters.priceRange = {
          ...(priceMin && { from: Number(priceMin) }),
          ...(priceMax && { to: Number(priceMax) }),
        };
      }

      // Boolean filters
      if (params.get("hasCustomer") === "true") filters.hasCustomer = true;
      if (params.get("hasSector") === "true") filters.hasSector = true;
      if (params.get("hasAssignee") === "true") filters.hasAssignee = true;
      if (params.get("hasTruck") === "true") filters.hasTruck = true;
      if (params.get("hasObservation") === "true") filters.hasObservation = true;
      if (params.get("hasArtworks") === "true") filters.hasArtworks = true;
      if (params.get("hasPaints") === "true") filters.hasPaints = true;
      if (params.get("hasCommissions") === "true") filters.hasCommissions = true;
      if (params.get("hasServices") === "true") filters.hasServices = true;

      return filters;
    },
    [statusFilter],
  );

  // Custom serializer for task filters
  const serializeTaskFilters = React.useCallback((filters: Partial<TaskGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Entity filters
    if (filters.sectorIds?.length) params.sectors = filters.sectorIds.join(",");
    if (filters.customerIds?.length) params.customers = filters.customerIds.join(",");
    if (filters.assigneeIds?.length) params.users = filters.assigneeIds.join(",");

    // Status filter
    if (filters.status?.length) {
      params.status = filters.status.join(",");
    }

    // Date filters
    if (filters.finishedDateRange?.from) params.finishedFrom = filters.finishedDateRange.from.toISOString();
    if (filters.finishedDateRange?.to) params.finishedTo = filters.finishedDateRange.to.toISOString();
    if (filters.entryDateRange?.from) params.entryFrom = filters.entryDateRange.from.toISOString();
    if (filters.entryDateRange?.to) params.entryTo = filters.entryDateRange.to.toISOString();
    if (filters.termRange?.from) params.termFrom = filters.termRange.from.toISOString();
    if (filters.termRange?.to) params.termTo = filters.termRange.to.toISOString();
    if (filters.startedDateRange?.from) params.startedFrom = filters.startedDateRange.from.toISOString();
    if (filters.startedDateRange?.to) params.startedTo = filters.startedDateRange.to.toISOString();

    // Price range
    if (filters.priceRange?.from !== undefined) params.priceMin = String(filters.priceRange.from);
    if (filters.priceRange?.to !== undefined) params.priceMax = String(filters.priceRange.to);

    // Boolean filters
    if (filters.hasCustomer) params.hasCustomer = "true";
    if (filters.hasSector) params.hasSector = "true";
    if (filters.hasAssignee) params.hasAssignee = "true";
    if (filters.hasTruck) params.hasTruck = "true";
    if (filters.hasObservation) params.hasObservation = "true";
    if (filters.hasArtworks) params.hasArtworks = "true";
    if (filters.hasPaints) params.hasPaints = "true";
    if (filters.hasCommissions) params.hasCommissions = "true";
    if (filters.hasServices) params.hasServices = "true";

    return params;
  }, []);

  // Filter state management
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
  } = useTableFilters<TaskGetManyFormData>({
    defaultFilters: {
      status: statusFilter,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeTaskFilters,
    deserializeFromUrl: deserializeTaskFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Get user's sector privilege early for default columns computation
  const userSectorPrivilege = currentUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Default visible columns based on navigation route and sector privilege
  const defaultVisibleColumns = React.useMemo(
    () => {
      // Base columns that are always visible
      const baseColumns = [
        "name",
        "customer.fantasyName",
        "identificador",
      ];

      // Get visible service order types based on user's sector privilege
      const visibleServiceOrderTypes = getVisibleServiceOrderTypes(userSectorPrivilege);
      const serviceOrderColumns = visibleServiceOrderTypes.map(type => `serviceOrders.${type.toLowerCase()}`);

      if (navigationRoute === 'preparation') {
        // Agenda page: show base columns + forecastDate + visible service order columns
        return new Set([
          ...baseColumns,
          "forecastDate",
          ...serviceOrderColumns,
        ]);
      }

      if (navigationRoute === 'schedule') {
        // Cronograma page: name, customer, general painting, identificador, sector, term, forecastDate
        return new Set([
          "name",
          "customer.fantasyName",
          "generalPainting",
          "identificador",
          "sector.name",
          "term",
          "forecastDate",
        ]);
      }

      // History page: name, customer, general painting, identificador, sector, finishedAt, commission
      return new Set([
        "name",
        "customer.fantasyName",
        "generalPainting",
        "identificador",
        "sector.name",
        "finishedAt",
        "commission",
      ]);
    },
    [navigationRoute, userSectorPrivilege]
  );

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(storageKey, defaultVisibleColumns);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = React.useState(false);

  // Table data for export
  const [tableData, setTableData] = React.useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Get all columns for visibility manager
  // Columns are filtered based on user's sector privilege:
  // - ADMIN: sees all service order columns
  // - COMMERCIAL: sees PRODUCTION + FINANCIAL + COMMERCIAL
  // - DESIGNER: sees PRODUCTION + ARTWORK (view only)
  // - FINANCIAL: sees PRODUCTION + FINANCIAL only
  // - LOGISTIC: sees PRODUCTION + LOGISTIC only
  // - PRODUCTION/WAREHOUSE/etc: sees PRODUCTION only
  // - HR: sees no service order columns
  const allColumns = React.useMemo(
    () => createTaskHistoryColumns({
      canViewPrice,
      currentUserId: currentUser?.id,
      sectorPrivilege: userSectorPrivilege,
      navigationRoute,
    }),
    [canViewPrice, currentUser?.id, userSectorPrivilege, navigationRoute]
  );

  // Prepare final query filters
  const queryFilters = React.useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    const result = {
      ...filterWithoutOrderBy,
      status: filterWithoutOrderBy.status || statusFilter,
    };

    // Add agenda display filtering for preparation view
    // This applies the universal agenda logic (not role-based):
    // - Excludes CANCELLED tasks
    // - Excludes COMPLETED tasks only if they have all 4 SO types AND all SOs are completed
    if (navigationRoute === "preparation") {
      result.shouldDisplayInAgenda = true;
      // Remove status filter to allow any status (except CANCELLED and fully completed)
      delete result.status;
    }

    return result;
  }, [baseQueryFilters, statusFilter, navigationRoute]);

  // Handle filter changes
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<TaskGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Create filter remover
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to handle search removal
  const onRemoveFilter = React.useCallback(
    (key: string, value?: any) => {
      if (key === "search" || key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = React.useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      search: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      sectors: sectorsData?.data || [],
      customers: customersData?.data || [],
      users: usersData?.data || [],
      hideStatusTags: hideStatusFilter || !canViewStatusFilter, // Hide status tags if explicitly requested or for non-admin/financial users
    });
  }, [filters, searchingFor, sectorsData?.data, customersData?.data, usersData?.data, onRemoveFilter, canViewStatusFilter, hideStatusFilter]);

  // Handle table data changes
  const handleTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Copy from task handlers
  const handleStartCopyFromTask = React.useCallback((targetTasks: Task[]) => {
    setCopyFromTaskState({
      step: "selecting_fields",
      targetTasks,
      selectedFields: [],
      sourceTask: null,
    });
  }, []);

  const handleStartSourceSelection = React.useCallback((selectedFields: CopyableField[]) => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "selecting_source",
      selectedFields,
    }));
  }, []);

  const handleSourceTaskSelected = React.useCallback((sourceTask: Task) => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "confirming",
      sourceTask,
    }));
  }, []);

  const handleCopyFromTaskConfirm = React.useCallback(
    async (selectedFields: CopyableField[], sourceTask: Task) => {
      const { targetTasks } = copyFromTaskState;

      try {
        const updates = targetTasks.map((targetTask) => {
          const updateData: Record<string, unknown> = {};

          selectedFields.forEach((field) => {
            switch (field) {
              case "details":
                updateData.details = sourceTask.details;
                break;
              case "term":
                updateData.term = sourceTask.term;
                break;
              case "artworkIds":
                // artworkIds must be File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
                updateData.artworkIds = sourceTask.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [];
                break;
              case "budgetId":
                updateData.budgetId = sourceTask.budgetId;
                break;
              case "paintId":
                updateData.paintId = sourceTask.paintId;
                break;
              case "paintIds":
                updateData.paintIds = sourceTask.logoPaints?.map((p) => p.id) || [];
                break;
              case "services":
                if (sourceTask.services && sourceTask.services.length > 0) {
                  updateData.services = sourceTask.services.map((service) => ({
                    status: service.status,
                    statusOrder: service.statusOrder,
                    description: service.description,
                    startedAt: null,
                    finishedAt: null,
                  }));
                }
                break;
              case "cuts":
                if (sourceTask.cuts && sourceTask.cuts.length > 0) {
                  updateData.cuts = sourceTask.cuts.map((cut) => ({
                    fileId: cut.fileId,
                    type: cut.type,
                    status: cut.status,
                    statusOrder: cut.statusOrder,
                    origin: cut.origin,
                    reason: cut.reason,
                    startedAt: null,
                    completedAt: null,
                  }));
                }
                break;
              case "layout":
                if (sourceTask.truck) {
                  const truckData: Record<string, unknown> = {
                    xPosition: sourceTask.truck.xPosition,
                    yPosition: sourceTask.truck.yPosition,
                  };

                  if (sourceTask.truck.leftSideLayout) {
                    truckData.leftSideLayout = {
                      height: sourceTask.truck.leftSideLayout.height,
                      photoId: sourceTask.truck.leftSideLayout.photoId || null,
                      layoutSections: sourceTask.truck.leftSideLayout.layoutSections?.map((section, index) => ({
                        width: section.width,
                        isDoor: section.isDoor,
                        doorHeight: section.doorHeight,
                        position: section.position ?? index,
                      })) || [],
                    };
                  }

                  if (sourceTask.truck.rightSideLayout) {
                    truckData.rightSideLayout = {
                      height: sourceTask.truck.rightSideLayout.height,
                      photoId: sourceTask.truck.rightSideLayout.photoId || null,
                      layoutSections: sourceTask.truck.rightSideLayout.layoutSections?.map((section, index) => ({
                        width: section.width,
                        isDoor: section.isDoor,
                        doorHeight: section.doorHeight,
                        position: section.position ?? index,
                      })) || [],
                    };
                  }

                  if (sourceTask.truck.backSideLayout) {
                    truckData.backSideLayout = {
                      height: sourceTask.truck.backSideLayout.height,
                      photoId: sourceTask.truck.backSideLayout.photoId || null,
                      layoutSections: sourceTask.truck.backSideLayout.layoutSections?.map((section, index) => ({
                        width: section.width,
                        isDoor: section.isDoor,
                        doorHeight: section.doorHeight,
                        position: section.position ?? index,
                      })) || [],
                    };
                  }

                  updateData.truck = truckData;
                }
                break;
            }
          });

          return {
            id: targetTask.id,
            data: updateData,
          };
        });

        await batchUpdateAsync({
          tasks: updates,
          triggeredBy: "TASK_COPY_FROM_TASK",
          metadata: {
            sourceTaskName: sourceTask.name,
            sourceTaskId: sourceTask.id,
          },
        });

        toast.success(
          `Copiado de outra tarefa`,
          {
            description: `${selectedFields.length} campo(s) copiado(s) de "${sourceTask.name}" para ${targetTasks.length} tarefa(s)`,
          }
        );

        setCopyFromTaskState(initialCopyFromTaskState);
        resetSelection();
      } catch (error) {
        toast.error("Erro ao copiar campos", {
          description: "Não foi possível copiar os campos. Tente novamente.",
        });
      }
    },
    [copyFromTaskState, batchUpdateAsync, resetSelection]
  );

  const handleCopyFromTaskCancel = React.useCallback(() => {
    setCopyFromTaskState(initialCopyFromTaskState);
  }, []);

  const handleChangeSource = React.useCallback(() => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "selecting_source",
      sourceTask: null,
    }));
  }, []);

  // Effect to handle escape key during source selection
  React.useEffect(() => {
    if (copyFromTaskState.step !== "selecting_source") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCopyFromTaskCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [copyFromTaskState.step, handleCopyFromTaskCancel]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar por nome, número de série, placa..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={activeFilters.length > 0 ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(!showFilterModal)}
            >
              <IconFilter className="h-4 w-4" />
              <span>Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}</span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} defaultColumns={defaultVisibleColumns} />
            {currentUser?.sector?.privileges !== SECTOR_PRIVILEGES.WAREHOUSE && (
              <TaskExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
            )}
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1 flex-shrink-0" />}

        {/* Source selection mode indicator */}
        {copyFromTaskState.step === "selecting_source" && (
          <div className="bg-primary/10 border border-primary/20 rounded-md p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconHandClick className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Clique em uma tarefa para selecionar como origem dos dados
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopyFromTaskCancel}>
              <IconX className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 min-h-0">
          <TaskHistoryTable
            filters={queryFilters}
            visibleColumns={visibleColumns}
            onDataChange={handleTableDataChange}
            className="h-full"
            navigationRoute={navigationRoute}
            advancedActionsRef={advancedActionsRef}
            onStartCopyFromTask={handleStartCopyFromTask}
            isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
            onSourceTaskSelect={handleSourceTaskSelected}
          />
        </div>

        {/* Filter Modal */}
        <TaskHistoryFilters
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
          filters={filters}
          onFilterChange={handleFilterChange}
          canViewPrice={canViewPrice}
          canViewStatusFilter={canViewStatusFilter}
        />

        {/* Advanced Bulk Actions Handler */}
        <AdvancedBulkActionsHandler
          ref={advancedActionsRef}
          selectedTaskIds={new Set(selectedIds)}
          onClearSelection={resetSelection}
        />

        {/* Copy From Task Modal */}
        <CopyFromTaskModal
          open={copyFromTaskState.step === "selecting_fields" || copyFromTaskState.step === "confirming"}
          onOpenChange={(open) => !open && handleCopyFromTaskCancel()}
          step={copyFromTaskState.step === "confirming" ? "confirming" : "selecting_fields"}
          targetTasks={copyFromTaskState.targetTasks}
          sourceTask={copyFromTaskState.sourceTask}
          onStartSourceSelection={handleStartSourceSelection}
          onConfirm={handleCopyFromTaskConfirm}
          onCancel={handleCopyFromTaskCancel}
          onChangeSource={handleChangeSource}
        />
      </CardContent>
    </Card>
  );
}