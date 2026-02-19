import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/types";
import type { TaskGetManyFormData } from "@/schemas";
import { useSectors, useCustomers, useUsers, useCurrentUser, taskKeys } from "@/hooks";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "@/constants";
import { taskService } from "@/api-client/task";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useTableState } from "@/hooks/common/use-table-state";
import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Button } from "@/components/ui/button";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { TaskPreparationTable } from "./task-preparation-table";
import { TaskHistoryFilters } from "../history/task-history-filters";
import { TaskExport } from "../history/task-export";
import { ColumnVisibilityManager } from "../history/column-visibility-manager";
import { createTaskHistoryColumns } from "../history/task-history-columns";
import { extractActiveFilters, createFilterRemover } from "../history/filter-utils";
import { AdvancedBulkActionsHandler } from "../bulk-operations/AdvancedBulkActionsHandler";
import { CopyFromTaskModal } from "../schedule/copy-from-task-modal";
import type { CopyableTaskField } from "@/types/task-copy";
import { IconFilter, IconHandClick, IconX, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { hasPrivilege } from "@/utils";
import { getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";
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

interface TaskPreparationViewProps {
  className?: string;
  storageKey?: string;
  searchPlaceholder?: string;
}

export function TaskPreparationView({
  className,
  storageKey = "task-preparation-visible-columns",
  searchPlaceholder = "Buscar por nome, número de série, placa...",
}: TaskPreparationViewProps) {
  // Query client for manual cache invalidation
  const queryClient = useQueryClient();

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

  // Get table state for selected tasks functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds, resetSelection, selectRange } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Track the last clicked task ID for cross-table shift+click selection
  const lastClickedTaskIdRef = useRef<string | null>(null);

  // Advanced actions ref
  const advancedActionsRef = useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);

  // State for tracking expanded groups across all tables with localStorage persistence
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
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
  const [hasGroups, setHasGroups] = useState(false);

  // Persist expanded groups to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('task-groups-expanded', JSON.stringify(Array.from(expandedGroups)));
    } catch (error) {
      console.error('Failed to save expanded groups to localStorage:', error);
    }
  }, [expandedGroups]);

  // Ref to track all available group IDs from tables
  const allGroupIds = useRef<string[]>([]);

  // Handler called by tables when groups are detected
  const handleGroupsDetected = useCallback((groupIds: string[], tableHasGroups: boolean) => {
    // Merge group IDs from all tables
    allGroupIds.current = Array.from(new Set([...allGroupIds.current, ...groupIds]));
    setHasGroups(prev => prev || tableHasGroups);
  }, []);

  // Handler to expand all groups
  const handleExpandAll = useCallback(() => {
    setExpandedGroups(new Set(allGroupIds.current));
  }, []);

  // Handler to collapse all groups
  const handleCollapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Copy from task state
  const [copyFromTaskState, setCopyFromTaskState] = useState<CopyFromTaskState>(initialCopyFromTaskState);

  // Custom deserializer for task filters
  const deserializeTaskFilters = useCallback(
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
    [],
  );

  // Custom serializer for task filters
  const serializeTaskFilters = useCallback((filters: Partial<TaskGetManyFormData>): Record<string, string> => {
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
      status: [TASK_STATUS.PREPARATION],
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeTaskFilters,
    deserializeFromUrl: deserializeTaskFilters,
    excludeFromUrl: ["limit", "orderBy", "status"],
  });

  // Get user's sector privilege for default columns
  const userSectorPrivilege = currentUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Default visible columns for preparation view
  const defaultVisibleColumns = useMemo(() => {
    const baseColumns = ["name", "customer.fantasyName", "identificador"];
    const visibleServiceOrderTypes = getVisibleServiceOrderTypes(userSectorPrivilege);
    const serviceOrderColumns = visibleServiceOrderTypes.map(type => `serviceOrders.${type.toLowerCase()}`);

    return new Set([
      ...baseColumns,
      "forecastDate",
      ...serviceOrderColumns,
    ]);
  }, [userSectorPrivilege]);

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(storageKey, defaultVisibleColumns);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);

  // For table ordering: use exact match so admins get regular table order (not financial order)
  const useFinancialTableOrder = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  // Aggregate table data from all three tables
  const [preparationTableData, setPreparationTableData] = useState<Task[]>([]);
  const [productionTableData, setProductionTableData] = useState<Task[]>([]);
  const [completedTableData, setCompletedTableData] = useState<Task[]>([]);

  // Track ordered task IDs from each table (after grouping/sorting)
  const [preparationOrderedIds, setPreparationOrderedIds] = useState<string[]>([]);
  const [productionOrderedIds, setProductionOrderedIds] = useState<string[]>([]);
  const [completedOrderedIds, setCompletedOrderedIds] = useState<string[]>([]);

  // Combined ordered task IDs for cross-table shift+click selection
  // Order matches display: financial = completed first, others = production first
  const allOrderedTaskIds = useMemo(() => {
    if (useFinancialTableOrder) {
      return [
        ...completedOrderedIds,
        ...productionOrderedIds,
        ...preparationOrderedIds,
      ];
    }
    return [
      ...productionOrderedIds,
      ...preparationOrderedIds,
      ...completedOrderedIds,
    ];
  }, [preparationOrderedIds, productionOrderedIds, completedOrderedIds, useFinancialTableOrder]);

  // Combined table data for export (includes all three tables)
  // Order matches display: financial = completed first, others = production first
  const allTableData = useMemo(() => {
    if (useFinancialTableOrder) {
      return [
        ...completedTableData,
        ...productionTableData,
        ...preparationTableData,
      ];
    }
    return [
      ...productionTableData,
      ...preparationTableData,
      ...completedTableData,
    ];
  }, [preparationTableData, productionTableData, completedTableData, useFinancialTableOrder]);

  // Get all columns for visibility manager
  const allColumns = useMemo(
    () => createTaskHistoryColumns({
      canViewPrice,
      currentUserId: currentUser?.id,
      sectorPrivilege: userSectorPrivilege,
      navigationRoute: 'preparation',
    }),
    [canViewPrice, currentUser?.id, userSectorPrivilege]
  );

  // Determine preparation exclusion flags based on user's sector privilege
  // For filtering: use hasPrivilege() so admins can see all service order types
  const isFinancialUser = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL);
  const isLogisticUser = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC);
  const isDesignerUser = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.DESIGNER;

  // Prepare final query filters with preparation-specific logic
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    const result: Record<string, any> = {
      ...filterWithoutOrderBy,
      // Include serviceOrders for progress bar display
      include: {
        serviceOrders: true,
      },
    };

    // DESIGNER users have special display logic: only show tasks with incomplete artwork SOs or no artwork SOs
    if (isDesignerUser) {
      result.shouldDisplayForDesigner = true;
    } else {
      // Non-designer users use the standard preparation display logic
      result.shouldDisplayInPreparation = true;

      // Only FINANCIAL users see FINANCIAL service order requirements
      if (!isFinancialUser) {
        result.preparationExcludeFinancial = true;
      }
      // Only LOGISTIC users see LOGISTIC service order requirements
      if (!isLogisticUser) {
        result.preparationExcludeLogistic = true;
      }
    }

    // Remove status filter to allow any status (except CANCELLED and fully completed)
    delete result.status;

    return result;
  }, [baseQueryFilters, isFinancialUser, isLogisticUser, isDesignerUser]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TaskGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Create filter remover
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to handle search removal
  const onRemoveFilter = useCallback(
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
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      search: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      sectors: sectorsData?.data || [],
      customers: customersData?.data || [],
      users: usersData?.data || [],
      hideStatusTags: true, // Hide status tags in preparation view
    });
  }, [filters, searchingFor, sectorsData?.data, customersData?.data, usersData?.data, onRemoveFilter]);

  // Handlers for table data changes
  const handlePreparationTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setPreparationTableData(data.items);
  }, []);

  const handleProductionTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setProductionTableData(data.items);
  }, []);

  const handleCompletedTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setCompletedTableData(data.items);
  }, []);

  // Handlers for ordered task IDs
  const handlePreparationOrderedIdsChange = useCallback((orderedIds: string[]) => {
    setPreparationOrderedIds(orderedIds);
  }, []);

  const handleProductionOrderedIdsChange = useCallback((orderedIds: string[]) => {
    setProductionOrderedIds(orderedIds);
  }, []);

  const handleCompletedOrderedIdsChange = useCallback((orderedIds: string[]) => {
    setCompletedOrderedIds(orderedIds);
  }, []);

  // Handler for shift+click selection across all tables
  const handleShiftClickSelect = useCallback((taskId: string) => {
    if (lastClickedTaskIdRef.current && allOrderedTaskIds.length > 0) {
      selectRange(allOrderedTaskIds, lastClickedTaskIdRef.current, taskId);
    }
    lastClickedTaskIdRef.current = taskId;
  }, [allOrderedTaskIds, selectRange]);

  // Handler to update last clicked task ID
  const handleSingleClickSelect = useCallback((taskId: string) => {
    lastClickedTaskIdRef.current = taskId;
  }, []);

  // Copy from task handlers
  const handleStartCopyFromTask = useCallback((targetTasks: Task[]) => {
    setCopyFromTaskState({
      step: "selecting_fields",
      targetTasks,
      selectedFields: [],
      sourceTask: null,
    });
  }, []);

  const handleStartSourceSelection = useCallback((selectedFields: CopyableTaskField[]) => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "selecting_source",
      selectedFields,
    }));
  }, []);

  const handleSourceTaskSelected = useCallback(async (sourceTask: Task) => {
    try {
      const fullSourceTask = await taskService.getTaskById(sourceTask.id, {
        include: {
          artworks: { include: { file: true } },
          budgets: true,
          invoices: true,
          receipts: true,
          pricing: true,
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

      setCopyFromTaskState((prev): CopyFromTaskState => ({
        ...prev,
        step: "confirming",
        sourceTask: fullSourceTask.data ?? null,
      }));
    } catch (error) {
      console.error('Failed to fetch source task:', error);
      toast.error('Falha ao carregar detalhes da tarefa de origem');
      setCopyFromTaskState(initialCopyFromTaskState);
    }
  }, []);

  const handleCopyFromTaskConfirm = useCallback(
    async (selectedFields: CopyableTaskField[], sourceTask: Task) => {
      const { targetTasks } = copyFromTaskState;

      try {
        // Call the copy-from endpoint for each target task sequentially
        // to avoid budgetNumber unique constraint race conditions when copying pricing
        const results: { success: boolean; taskId: string; result?: any; error?: any }[] = [];
        for (const targetTask of targetTasks) {
          try {
            const result = await taskService.copyFromTask(targetTask.id, {
              sourceTaskId: sourceTask.id,
              fields: selectedFields,
            });
            results.push({ success: true, taskId: targetTask.id, result });
          } catch (error) {
            console.error(`Failed to copy to task ${targetTask.id}:`, error);
            results.push({ success: false, taskId: targetTask.id, error });
          }
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        if (successCount > 0) {
          toast.success(`Campos copiados com sucesso`, {
            description: failureCount === 0
              ? `${selectedFields.length} campo(s) copiado(s) de "${sourceTask.name}" para ${successCount} tarefa(s)`
              : `${successCount} tarefa(s) atualizada(s), ${failureCount} falhou(ram)`,
          });
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
          // Invalidate task queries to refresh the UI with fresh data
          queryClient.invalidateQueries({
            queryKey: taskKeys.all,
          });
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast.error("Erro ao copiar campos", {
          description: "Não foi possível copiar os campos. Tente novamente.",
        });
      }
    },
    [copyFromTaskState, resetSelection, queryClient]
  );

  const handleCopyFromTaskCancel = useCallback(() => {
    setCopyFromTaskState(initialCopyFromTaskState);
  }, []);

  const handleChangeSource = useCallback(() => {
    setCopyFromTaskState((prev) => ({
      ...prev,
      step: "selecting_source",
      sourceTask: null,
    }));
  }, []);

  // Effect to handle escape key during source selection
  useEffect(() => {
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
      <CardContent className="flex flex-col p-4 pt-6 space-y-4 pb-6">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder={searchPlaceholder}
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
              <TaskExport filters={queryFilters} currentItems={allTableData} totalRecords={allTableData.length} visibleColumns={visibleColumns} />
            )}
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

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

        {/* Three tables grouped by status */}
        {/* For FINANCIAL users: Show Completed first, then In Production, then Preparation */}
        {useFinancialTableOrder ? (
          <div className="space-y-8 pb-8">
            {/* Table 1: Concluído - First for financial */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.COMPLETED],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handleCompletedTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handleCompletedOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>

            {/* Table 2: Em Produção */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.IN_PRODUCTION],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handleProductionTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handleProductionOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>

            {/* Table 3: Em Preparação + Aguardando Produção */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handlePreparationTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handlePreparationOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-8">
            {/* Table 1: Em Produção - First for non-financial */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.IN_PRODUCTION],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handleProductionTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handleProductionOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>

            {/* Table 2: Em Preparação + Aguardando Produção */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handlePreparationTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handlePreparationOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>

            {/* Table 3: Concluído */}
            <div>
              <TaskPreparationTable
                filters={{
                  ...queryFilters,
                  status: [TASK_STATUS.COMPLETED],
                  limit: 1000,
                }}
                visibleColumns={visibleColumns}
                onDataChange={handleCompletedTableDataChange}
                advancedActionsRef={advancedActionsRef}
                onStartCopyFromTask={handleStartCopyFromTask}
                isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                onSourceTaskSelect={handleSourceTaskSelected}
                onShiftClickSelect={handleShiftClickSelect}
                onSingleClickSelect={handleSingleClickSelect}
                externalExpandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onGroupsDetected={handleGroupsDetected}
                onOrderedTaskIdsChange={handleCompletedOrderedIdsChange}
                showSelectedOnly={showSelectedOnly}
                allOrderedTaskIds={allOrderedTaskIds}
              />
            </div>
          </div>
        )}

        {/* Filter Modal */}
        <TaskHistoryFilters
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
          filters={filters}
          onFilterChange={handleFilterChange}
          canViewPrice={canViewPrice}
          canViewStatusFilter={false}
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
