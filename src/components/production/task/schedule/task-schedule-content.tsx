import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSectors, useTasks, useCurrentUser, useTaskBatchMutations } from "../../../../hooks";
import { SECTOR_PRIVILEGES, TASK_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { taskService } from "../../../../api-client/task";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskScheduleTable } from "./task-schedule-table";
import { TaskScheduleEmptyState } from "./task-schedule-empty-state";
import { TaskScheduleFilters } from "./task-schedule-filters";
import { ColumnVisibilityManager, getDefaultVisibleColumns, getAvailableColumns } from "./column-visibility-manager";
import { TaskScheduleExport } from "./task-schedule-export";
import { AdvancedBulkActionsHandler } from "../bulk-operations/AdvancedBulkActionsHandler";
import { CopyFromTaskModal } from "./copy-from-task-modal";
import type { CopyableTaskField } from "@/types/task-copy";
import { IconSearch, IconFilter, IconX, IconHandClick } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { hasPrivilege } from "@/utils";
import { toast } from "sonner";

interface TaskScheduleContentProps {
  className?: string;
}

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

export function TaskScheduleContent({ className }: TaskScheduleContentProps) {
  // Shared selection state across all tables
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Track the last clicked task for shift+click selection across tables
  const [lastClickedTaskId, setLastClickedTaskId] = useState<string | null>(null);

  // Copy from task state
  const [copyFromTaskState, setCopyFromTaskState] = useState<CopyFromTaskState>(initialCopyFromTaskState);

  // Shared advanced actions ref
  const advancedActionsRef = useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);

  // Get current user to check permissions
  const { data: currentUser } = useCurrentUser();

  // Batch mutations for copy operation
  const { batchUpdateAsync } = useTaskBatchMutations();

  // Check if user can export (Admin or Financial only)
  const canExport = currentUser && (hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL));

  // Get user's sector privilege for column visibility
  const userSectorPrivilege = currentUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Available columns based on user's sector privilege - cronograma should NOT include service order columns
  const availableColumns = useMemo(() => getAvailableColumns(userSectorPrivilege, false), [userSectorPrivilege]);

  // Default visible columns - cronograma should NOT include service order columns by default
  const defaultVisibleColumns = useMemo(() => getDefaultVisibleColumns(userSectorPrivilege, false), [userSectorPrivilege]);

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("task-schedule-visible-columns", defaultVisibleColumns);

  // Search state
  const [searchText, setSearchText] = useState("");

  // Filters state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Partial<TaskGetManyFormData>>({
    // Cronograma shows only tasks waiting for or in production
    status: [TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION],
    limit: 1000,
  });

  // Load production sectors
  const { data: sectorsData } = useSectors({
    where: {
      privileges: {
        in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.ADMIN],
      },
    },
    orderBy: { name: "asc" },
  });

  const productionSectors = sectorsData?.data || [];

  // Load tasks data with filters applied
  const { data: tasksData, isLoading } = useTasks({
    ...filters,
    include: {
      sector: true,
      customer: true,
      createdBy: true,
      serviceOrders: true,
      generalPainting: {
        include: {
          paintType: true,
          paintBrand: true,
        },
      },
      truck: {
        include: {
          leftSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          rightSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          backSideLayout: {
            include: {
              layoutSections: true,
            },
          },
        },
      },
    },
    orderBy: {
      term: "asc", // Sort by deadline
    },
  });

  const allTasks = tasksData?.data || [];

  // Count active filters (excluding default filters)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchingFor) count++;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.termRange && (filters.termRange.from || filters.termRange.to)) count++;
    if (filters.isOverdue) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFiltersCount > 0;

  // Callback to update selected task IDs
  const handleSelectedTaskIdsChange = useCallback((ids: Set<string>) => {
    setSelectedTaskIds(ids);
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
    console.log('[CopyFromTask] ========== handleSourceTaskSelected CALLED ==========');
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
      setCopyFromTaskState(initialCopyFromTaskState);
    }
  }, []);

  const handleCopyFromTaskConfirm = useCallback(
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

        // Reset state and clear selection
        setCopyFromTaskState(initialCopyFromTaskState);
        setSelectedTaskIds(new Set());

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
    [copyFromTaskState, setSelectedTaskIds]
  );

  const handleCopyFromTaskCancel = useCallback(() => {
    setCopyFromTaskState(initialCopyFromTaskState);
  }, []);

  const handleChangeSource = useCallback(() => {
    // Go back to selecting source mode
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

  // Filter tasks based on search (preparation display filtering is done by backend via shouldDisplayInPreparation)
  const filteredTasks = useMemo(() => {
    // Filter by search text if provided
    if (!searchText) return allTasks;

    const searchLower = searchText.toLowerCase();
    return allTasks.filter((task) => {
      return (
        task.name?.toLowerCase().includes(searchLower) ||
        task.customer?.fantasyName?.toLowerCase().includes(searchLower) ||
        task.customer?.corporateName?.toLowerCase().includes(searchLower) ||
        task.serialNumber?.toLowerCase().includes(searchLower) ||
        task.truck?.plate?.toLowerCase().includes(searchLower) ||
        task.sector?.name?.toLowerCase().includes(searchLower)
      );
    });
  }, [allTasks, searchText]);

  // Get all selected tasks (across all tables) as Task objects
  const selectedTasks = useMemo(() => {
    return filteredTasks.filter(task => selectedTaskIds.has(task.id));
  }, [filteredTasks, selectedTaskIds]);

  // Group tasks by sector
  const tasksBySector = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    // Initialize with empty arrays for each production sector
    productionSectors.forEach((sector) => {
      grouped.set(sector.id, []);
    });

    // Add undefined sector group
    grouped.set("undefined", []);

    // Group tasks
    filteredTasks.forEach((task) => {
      const sectorId = task.sectorId || "undefined";
      const tasks = grouped.get(sectorId) || [];
      tasks.push(task);
      grouped.set(sectorId, tasks);
    });

    return grouped;
  }, [filteredTasks, productionSectors]);

  // Global ordered task list for shift+click selection across tables
  // This maintains the visual order: sector by sector, then undefined
  const globalOrderedTasks = useMemo(() => {
    const orderedTasks: Task[] = [];

    // Add tasks from each production sector in order
    productionSectors.forEach((sector) => {
      const sectorTasks = tasksBySector.get(sector.id) || [];
      orderedTasks.push(...sectorTasks);
    });

    // Add undefined sector tasks at the end
    const undefinedTasks = tasksBySector.get("undefined") || [];
    orderedTasks.push(...undefinedTasks);

    return orderedTasks;
  }, [productionSectors, tasksBySector]);

  // Handle shift+click selection across tables using global task order
  const handleShiftClickSelect = useCallback((taskId: string) => {
    if (!lastClickedTaskId) {
      // No previous selection, just select this task
      setLastClickedTaskId(taskId);
      setSelectedTaskIds(new Set([taskId]));
      return;
    }

    // Find indices in the global ordered list
    const lastIndex = globalOrderedTasks.findIndex((t) => t.id === lastClickedTaskId);
    const currentIndex = globalOrderedTasks.findIndex((t) => t.id === taskId);

    if (lastIndex === -1 || currentIndex === -1) {
      // Fallback: just select the clicked task
      setLastClickedTaskId(taskId);
      return;
    }

    // Select all tasks between lastIndex and currentIndex (inclusive)
    const start = Math.min(lastIndex, currentIndex);
    const end = Math.max(lastIndex, currentIndex);
    const rangeIds = globalOrderedTasks.slice(start, end + 1).map((t) => t.id);

    // Add to existing selection
    setSelectedTaskIds((prev) => {
      const newSelection = new Set(prev);
      rangeIds.forEach((id) => newSelection.add(id));
      return newSelection;
    });
  }, [lastClickedTaskId, globalOrderedTasks]);

  // Handle single click selection (updates last clicked)
  const handleSingleClickSelect = useCallback((taskId: string) => {
    setLastClickedTaskId(taskId);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-muted-foreground">Carregando cronograma...</div>
      </div>
    );
  }

  // Check if there are any tasks
  const hasAnyTasks = allTasks.length > 0;
  const hasSectors = productionSectors.length > 0;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Source selection mode banner */}
        {copyFromTaskState.step === "selecting_source" && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <IconHandClick className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Selecione a tarefa de origem</p>
                <p className="text-xs text-muted-foreground">
                  Clique em qualquer tarefa para copiar os campos selecionados
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyFromTaskCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <IconX className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          </div>
        )}

        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nome, cliente, número de série, placa, setor..."
              value={searchText}
              onChange={setSearchText}
              transparent={true}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setFiltersOpen(true)}
            >
              <IconFilter className="h-4 w-4 mr-2" />
              Filtros{hasActiveFilters ? ` (${activeFiltersCount})` : ""}
            </Button>
            <ColumnVisibilityManager columns={availableColumns} visibleColumns={visibleColumns} onColumnVisibilityChange={setVisibleColumns} sectorPrivilege={userSectorPrivilege} includeServiceOrdersInDefaults={false} />
            {canExport && <TaskScheduleExport tasks={filteredTasks} visibleColumns={visibleColumns} />}
          </div>
        </div>

        {/* Tasks section */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!hasAnyTasks ? (
            <TaskScheduleEmptyState hasSectors={hasSectors} />
          ) : filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada com os critérios de busca</div>
          ) : (
            <div className="space-y-6">
              {/* Production sectors first */}
              {productionSectors.map((sector) => {
                const tasks = tasksBySector.get(sector.id) || [];
                if (tasks.length === 0) return null;

                return (
                  <div key={sector.id}>
                    <h3 className="text-lg font-semibold mb-3">{sector.name}</h3>
                    <TaskScheduleTable
                      tasks={tasks}
                      visibleColumns={visibleColumns}
                      selectedTaskIds={selectedTaskIds}
                      onSelectedTaskIdsChange={handleSelectedTaskIdsChange}
                      advancedActionsRef={advancedActionsRef}
                      allSelectedTasks={selectedTasks}
                      isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                      onSourceTaskSelect={handleSourceTaskSelected}
                      onStartCopyFromTask={handleStartCopyFromTask}
                      onShiftClickSelect={handleShiftClickSelect}
                      onSingleClickSelect={handleSingleClickSelect}
                    />
                  </div>
                );
              })}

              {/* Undefined sector last if it has tasks */}
              {(() => {
                const undefinedTasks = tasksBySector.get("undefined");
                return undefinedTasks && undefinedTasks.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Setor Indefinido</h3>
                    <TaskScheduleTable
                      tasks={undefinedTasks}
                      visibleColumns={visibleColumns}
                      selectedTaskIds={selectedTaskIds}
                      onSelectedTaskIdsChange={handleSelectedTaskIdsChange}
                      advancedActionsRef={advancedActionsRef}
                      allSelectedTasks={selectedTasks}
                      isSelectingSourceTask={copyFromTaskState.step === "selecting_source"}
                      onSourceTaskSelect={handleSourceTaskSelected}
                      onStartCopyFromTask={handleStartCopyFromTask}
                      onShiftClickSelect={handleShiftClickSelect}
                      onSingleClickSelect={handleSingleClickSelect}
                    />
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Filters Sheet */}
        <TaskScheduleFilters
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filters}
          onFilterChange={setFilters}
          sectors={productionSectors}
        />

        {/* Shared Advanced Bulk Actions Handler */}
        <AdvancedBulkActionsHandler
          ref={advancedActionsRef}
          selectedTaskIds={selectedTaskIds}
          onClearSelection={() => setSelectedTaskIds(new Set())}
        />

        {/* Copy From Task Modal */}
        <CopyFromTaskModal
          open={copyFromTaskState.step === "selecting_fields" || copyFromTaskState.step === "confirming"}
          onOpenChange={(open) => {
            if (!open) handleCopyFromTaskCancel();
          }}
          targetTasks={copyFromTaskState.targetTasks}
          sourceTask={copyFromTaskState.sourceTask}
          step={copyFromTaskState.step === "confirming" ? "confirming" : "selecting_fields"}
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
