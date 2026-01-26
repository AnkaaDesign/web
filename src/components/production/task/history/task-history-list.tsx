import React from "react";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { useSectors, useCustomers, useUsers, useCurrentUser, useTaskBatchMutations } from "../../../../hooks";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { taskService } from "../../../../api-client/task";
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
import { CopyFromTaskModal } from "../schedule/copy-from-task-modal";
import type { CopyableTaskField } from "@/types/task-copy";
import { IconFilter, IconHandClick, IconX, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { hasPrivilege } from "../../../../utils";
import { getVisibleServiceOrderTypes } from "../../../../utils/permissions/service-order-permissions";
import { toast } from "sonner";

// Copy from task state type
interface CopyFromTaskState {
  step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
  targetTasks: Task[];
  selectedFields: CopyableTaskField[];
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
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds, resetSelection, selectRange } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Track the last clicked task ID for cross-table shift+click selection
  const lastClickedTaskIdRef = React.useRef<string | null>(null);

  // Advanced actions ref
  const advancedActionsRef = React.useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);

  // State for tracking expanded groups across all tables with localStorage persistence
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('task-groups-expanded');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load expanded groups from localStorage:', error);
    }
    return new Set();
  });
  const [hasGroups, setHasGroups] = React.useState(false);

  // Persist expanded groups to localStorage whenever it changes
  React.useEffect(() => {
    try {
      localStorage.setItem('task-groups-expanded', JSON.stringify(Array.from(expandedGroups)));
    } catch (error) {
      console.error('Failed to save expanded groups to localStorage:', error);
    }
  }, [expandedGroups]);

  // Ref to track all available group IDs from tables
  const allGroupIds = React.useRef<string[]>([]);

  // Handler called by tables when groups are detected
  const handleGroupsDetected = React.useCallback((groupIds: string[], tableHasGroups: boolean) => {
    // Merge group IDs from all tables
    allGroupIds.current = Array.from(new Set([...allGroupIds.current, ...groupIds]));
    setHasGroups(prev => prev || tableHasGroups);
  }, []);

  // Handler to expand all groups
  const handleExpandAll = React.useCallback(() => {
    setExpandedGroups(new Set(allGroupIds.current));
  }, []);

  // Handler to collapse all groups
  const handleCollapseAll = React.useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

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
      if (params.get("hasServiceOrders") === "true") filters.hasServiceOrders = true;

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
    if (filters.hasServiceOrders) params.hasServiceOrders = "true";

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

  // Table data for export and cross-table selection
  const [tableData, setTableData] = React.useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Aggregate table data from all three tables for agenda view (for cross-table shift selection)
  const [preparationTableData, setPreparationTableData] = React.useState<Task[]>([]);
  const [productionTableData, setProductionTableData] = React.useState<Task[]>([]);
  const [completedTableData, setCompletedTableData] = React.useState<Task[]>([]);

  // Combined ordered task IDs for cross-table shift+click selection (agenda view only)
  const allAgendaTaskIds = React.useMemo(() => {
    if (navigationRoute !== 'preparation') return [];
    // Order: Preparation/Waiting -> In Production -> Completed
    return [
      ...preparationTableData.map(t => t.id),
      ...productionTableData.map(t => t.id),
      ...completedTableData.map(t => t.id),
    ];
  }, [navigationRoute, preparationTableData, productionTableData, completedTableData]);

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

  // Determine agenda exclusion flags based on user's sector privilege
  const isFinancialUser = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL);
  const isLogisticUser = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC);

  // Prepare final query filters
  const queryFilters = React.useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    const result: Record<string, any> = {
      ...filterWithoutOrderBy,
      status: filterWithoutOrderBy.status || statusFilter,
    };

    // Add agenda display filtering for preparation view
    // Role-based behavior (hasPrivilege treats ADMIN as having all privileges):
    // - ADMIN users: See ALL tasks (no exclusions - hasPrivilege returns true for all privileges)
    // - FINANCIAL users: Need PRODUCTION, COMMERCIAL, ARTWORK, FINANCIAL (exclude LOGISTIC)
    // - LOGISTIC users: Need PRODUCTION, COMMERCIAL, ARTWORK, LOGISTIC (exclude FINANCIAL)
    // - All other users: Only need PRODUCTION, COMMERCIAL, ARTWORK (exclude both FINANCIAL and LOGISTIC)
    if (navigationRoute === "preparation") {
      result.shouldDisplayInAgenda = true;

      // Only FINANCIAL users see FINANCIAL service order requirements
      if (!isFinancialUser) {
        result.agendaExcludeFinancial = true;
      }
      // Only LOGISTIC users see LOGISTIC service order requirements
      if (!isLogisticUser) {
        result.agendaExcludeLogistic = true;
      }

      // Remove status filter to allow any status (except CANCELLED and fully completed)
      delete result.status;
    }

    return result;
  }, [baseQueryFilters, statusFilter, navigationRoute, isFinancialUser, isLogisticUser]);

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

  // Handlers for cross-table data collection (agenda view)
  const handlePreparationTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setPreparationTableData(data.items);
    // Also update main table data for export (use preparation table as primary)
    setTableData(data);
  }, []);

  const handleProductionTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setProductionTableData(data.items);
  }, []);

  const handleCompletedTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setCompletedTableData(data.items);
  }, []);

  // Handler for shift+click selection across all agenda tables
  const handleShiftClickSelect = React.useCallback((taskId: string) => {
    // If there's a last clicked task, select the range
    if (lastClickedTaskIdRef.current && allAgendaTaskIds.length > 0) {
      selectRange(allAgendaTaskIds, lastClickedTaskIdRef.current, taskId);
    }
    lastClickedTaskIdRef.current = taskId;
  }, [allAgendaTaskIds, selectRange]);

  // Handler to update last clicked task ID for cross-table shift+click
  const handleSingleClickSelect = React.useCallback((taskId: string) => {
    lastClickedTaskIdRef.current = taskId;
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

  const handleStartSourceSelection = React.useCallback((selectedFields: CopyableTaskField[]) => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "selecting_source",
      selectedFields,
    }));
  }, []);

  const handleSourceTaskSelected = React.useCallback(async (sourceTask: Task) => {
    console.log('[CopyFromTask] ========== handleSourceTaskSelected CALLED (HISTORY VIEW) ==========');
    console.log('[CopyFromTask] Source task ID:', sourceTask?.id);
    console.log('[CopyFromTask] Source task artworks:', sourceTask?.artworks);

    // CRITICAL FIX: Refetch the source task with proper includes to get artwork fileIds
    // The task from the table doesn't have the file relationship loaded on artworks
    try {
      console.log(`[CopyFromTask] Refetching source task ${sourceTask.id} with full artwork details...`);

      const fullSourceTask = await taskService.getTaskById(sourceTask.id, {
        include: {
          artworks: { include: { file: true } },  // ✅ Include file relationship
          budgets: true,
          invoices: true,
          receipts: true,
          pricing: true,  // ✅ Include pricing (one-to-many: one pricing can be shared across multiple tasks)
          logoPaints: true,
          cuts: true,
          serviceOrders: true,
          truck: {
            include: {
              leftSideLayout: { include: { layoutSections: true, photo: true } },
              rightSideLayout: { include: { layoutSections: true, photo: true } },
              backSideLayout: { include: { layoutSections: true, photo: true } },
            },
          },
        },
      });

      if (!fullSourceTask.success || !fullSourceTask.data) {
        throw new Error('Failed to fetch source task details');
      }

      console.log(
        `[CopyFromTask] Fetched source task with ${fullSourceTask.data.artworks?.length || 0} artworks`,
        fullSourceTask.data.artworks
      );

      // Move to confirming step with fully loaded source task
      setCopyFromTaskState((prev) => ({
        ...prev,
        step: "confirming",
        sourceTask: fullSourceTask.data,  // Use refetched task
      }));
    } catch (error) {
      console.error('[CopyFromTask] Failed to fetch source task:', error);
      toast.error('Falha ao carregar detalhes da tarefa de origem');
      // Reset to idle on error
      setCopyFromTaskState({
        step: "idle",
        targetTasks: [],
        selectedFields: [],
        sourceTask: null,
      });
    }
  }, []);

  const handleCopyFromTaskConfirm = React.useCallback(
    async (selectedFields: CopyableTaskField[], sourceTask: Task) => {
      const { targetTasks } = copyFromTaskState;

      try {
        console.log(`[CopyFromTask] Copying ${selectedFields.length} field(s) from task ${sourceTask.id} to ${targetTasks.length} task(s)`);
        console.log(`[CopyFromTask] Selected fields:`, selectedFields);

        // Call the copy-from endpoint for each target task
        const copyPromises = targetTasks.map(async (targetTask) => {
          try {
            const result = await taskService.copyFromTask(targetTask.id, {
              sourceTaskId: sourceTask.id,
              fields: selectedFields,
            });
            console.log(`[CopyFromTask] Successfully copied to task ${targetTask.id}:`, result);
            return { success: true, taskId: targetTask.id, result };
          } catch (error) {
            console.error(`[CopyFromTask] Failed to copy to task ${targetTask.id}:`, error);
            return { success: false, taskId: targetTask.id, error };
          }
        });

        const results = await Promise.all(copyPromises);
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        if (successCount > 0) {
          toast.success(
            `Campos copiados com sucesso`,
            {
              description: failureCount === 0
                ? `${selectedFields.length} campo(s) copiado(s) de "${sourceTask.name}" para ${successCount} tarefa(s)`
                : `${successCount} tarefa(s) atualizada(s), ${failureCount} falhou(ram)`,
            }
          );
        }

        if (failureCount > 0 && successCount === 0) {
          toast.error("Erro ao copiar campos", {
            description: `Falha ao copiar para ${failureCount} tarefa(s). Tente novamente.`,
          });
        }

        setCopyFromTaskState(initialCopyFromTaskState);
        resetSelection();

        // Refresh task list to show updated data
        if (successCount > 0) {
          // Note: The refetch will happen automatically via React Query invalidation
        }
      } catch (error) {
        console.error('[CopyFromTask] Unexpected error:', error);
        toast.error("Erro ao copiar campos", {
          description: "Não foi possível copiar os campos. Tente novamente.",
        });
      }
    },
    [copyFromTaskState, resetSelection]
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

            {/* Expand/Collapse All Groups Button */}
            {hasGroups && (
              <Button
                variant="outline"
                size="default"
                onClick={expandedGroups.size > 0 ? handleCollapseAll : handleExpandAll}
                title={expandedGroups.size > 0 ? "Recolher todos os grupos" : "Expandir todos os grupos"}
              >
                {expandedGroups.size > 0 ? (
                  <>
                    <IconChevronRight className="h-4 w-4" />
                    <span>Recolher Grupos</span>
                  </>
                ) : (
                  <>
                    <IconChevronDown className="h-4 w-4" />
                    <span>Expandir Grupos</span>
                  </>
                )}
              </Button>
            )}

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

        {/* Tables - separated by status for preparation route */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {navigationRoute === 'preparation' ? (
            <div className="space-y-12 h-full">
              {/* Group 1: Em Preparação + Aguardando Produção */}
              <div>
                <TaskHistoryTable
                  filters={{
                    ...queryFilters,
                    status: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
                  }}
                  visibleColumns={visibleColumns}
                  onDataChange={handlePreparationTableDataChange}
                  navigationRoute={navigationRoute}
                  advancedActionsRef={advancedActionsRef}
                  onStartCopyFromTask={handleStartCopyFromTask}
                  isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                  onSourceTaskSelect={handleSourceTaskSelected}
                  disablePagination={true}
                  onShiftClickSelect={handleShiftClickSelect}
                  onSingleClickSelect={handleSingleClickSelect}
                  externalExpandedGroups={expandedGroups}
                  onExpandedGroupsChange={setExpandedGroups}
                  onGroupsDetected={handleGroupsDetected}
                />
              </div>

              {/* Group 2: Em Produção */}
              <div>
                <TaskHistoryTable
                  filters={{
                    ...queryFilters,
                    status: [TASK_STATUS.IN_PRODUCTION],
                  }}
                  visibleColumns={visibleColumns}
                  onDataChange={handleProductionTableDataChange}
                  navigationRoute={navigationRoute}
                  advancedActionsRef={advancedActionsRef}
                  onStartCopyFromTask={handleStartCopyFromTask}
                  isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                  onSourceTaskSelect={handleSourceTaskSelected}
                  disablePagination={true}
                  onShiftClickSelect={handleShiftClickSelect}
                  onSingleClickSelect={handleSingleClickSelect}
                  externalExpandedGroups={expandedGroups}
                  onExpandedGroupsChange={setExpandedGroups}
                  onGroupsDetected={handleGroupsDetected}
                />
              </div>

              {/* Group 3: Concluído */}
              <div>
                <TaskHistoryTable
                  filters={{
                    ...queryFilters,
                    status: [TASK_STATUS.COMPLETED],
                  }}
                  visibleColumns={visibleColumns}
                  onDataChange={handleCompletedTableDataChange}
                  navigationRoute={navigationRoute}
                  advancedActionsRef={advancedActionsRef}
                  onStartCopyFromTask={handleStartCopyFromTask}
                  isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                  onSourceTaskSelect={handleSourceTaskSelected}
                  disablePagination={true}
                  onShiftClickSelect={handleShiftClickSelect}
                  onSingleClickSelect={handleSingleClickSelect}
                  externalExpandedGroups={expandedGroups}
                  onExpandedGroupsChange={setExpandedGroups}
                  onGroupsDetected={handleGroupsDetected}
                />
              </div>
            </div>
          ) : (
            // Single table for non-preparation routes
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
              externalExpandedGroups={expandedGroups}
              onExpandedGroupsChange={setExpandedGroups}
              onGroupsDetected={handleGroupsDetected}
            />
          )}
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
          userPrivilege={userSectorPrivilege}
        />
      </CardContent>
    </Card>
  );
}